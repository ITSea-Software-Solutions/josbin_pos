# Developer System Flows

> **Doelgroep:** Engineers die Josbin POS-code schrijven of reviewen. End-user-flows leven in `user_manual/` en `dashboard_manual/`; deze doc is de *implementatie*-niveau-view van dezelfde flows — de werkelijke modules, tabellen, queues en gates die elk raken.
>
> Houd dit eerlijk: als een flow verandert, update de bijbehorende sectie hier in dezelfde commit. Verouderde systeem-docs zijn erger dan geen docs.

---

## 0. De kaart

Elke request door het systeem raakt één van deze flows:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  POS App    │────▶│  Laravel API │────▶│ PostgreSQL   │
│  (Electron  │     │  (Sanctum +  │     │ + pgvector   │
│   /Capacitor)│    │   policies)  │     │ + RLS-ready  │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌──────────┐              ┌──────────┐
       │  Redis   │              │  Reverb  │
       │ (queue + │              │ (WS for  │
       │  cache)  │              │  live)   │
       └────┬─────┘              └──────────┘
            ▼
       ┌──────────────┐
       │  Horizon     │ → Webhooks, AI jobs, stock ledger, anomaly detection
       │  (worker)    │
       └──────────────┘
                                 ▲
                                 │
        ┌────────────────────────┴───────────┐
        │       Dashboard (React + Vite)     │
        │       Tax Inspector view (React)   │
        │       Open Integration API (/v1/)  │
        └────────────────────────────────────┘
```

Elke genummerde sectie hieronder pakt één van deze flows en loopt deze end-to-end door.

---

## 1. Auth-flow — login → 2FA → token → request

**Modules geraakt:** `AuthController`, `EnsureTwoFactor`-middleware, Sanctum, spatie/permission, `audit_logs`.

```
1. POST /api/auth/login {email, password, device_name}
   │
   ├── RateLimiter::tooManyAttempts("login:email|ip", 5) → 429 + "Account locked"
   ├── Hash::check(password) → fail = 422 + delay
   ├── user.is_active == false → 422 "Account deactivated"
   ├── Audit log: auth.login_success row inserted
   │
   ├── If requires2FA && !two_factor_confirmed_at:
   │   → return {two_factor_setup_required: true, setup_token}
   │     (token has abilities = ['two_factor_setup'] only)
   │
   ├── If requires2FA && two_factor_confirmed_at:
   │   → return {two_factor_required: true, pre_auth_token}
   │     (token has abilities = ['two_factor_challenge'] only)
   │
   └── Else (no 2FA needed):
       → handlePostLoginChecks() (geo-alert, single-device for govt)
       → createToken(abilities: ['*'], expiresAt: now+12h)
       → return {token, expires_at, user}

2. POST /api/auth/two-factor-challenge {pre_auth_token, code}
   │
   ├── Resolve pre_auth_token via Sanctum::findToken()
   ├── tokenCan('two_factor_challenge') — literal check (not via $user->tokenCan
   │   which would be true under '*')
   ├── verifyKey(decrypted_secret, code) → 422 if mismatch
   ├── handlePostLoginChecks()
   ├── pre_auth_token deleted
   └── createToken(abilities: ['*', '2fa_verified'], expiresAt: now+12h)

3. Any authenticated request → /api/* under auth:sanctum
   │
   ├── EnsureTwoFactor middleware:
   │   if (user->requires2FA() && !in_array('2fa_verified', token->abilities, true))
   │       → 403 TWO_FACTOR_REQUIRED
   │   (Literal check, not tokenCan — wildcard would bypass.)
   │
   ├── Controller's $this->authorize() → policy method
   │   → policy returns $user->can('permission.name')
   │   → spatie's Gate::before checks user's permissions table at request time
   │   → FRESH read, never cached on the token (read fresh at request time)
   │
   └── Controller proceeds, writes to DB, optionally enqueues a job
```

**Waarom dit belangrijk is:** in een eerder ontwerp was de `abilities`-kolom van het token een *snapshot* van de permissions van de gebruiker op login-tijd. Permission-wijzigingen (rol-edit, seeder-re-run, nieuwe spatie-perm) vereisten een re-login. Nu laat `['*']` policy-checks verse permissions lezen op request-tijd. Pre-auth-tokens (`['two_factor_setup']`, `['two_factor_challenge']`) zijn nog steeds smal gescoped omdat ze identity-state zijn, geen permission-state.

---

## 2. Sale-flow — cart → calculate → save → audit → webhook

**Modules geraakt:** `SaleController::store`, `BtwCalculationService`, `DiscountRuleService`, `Sale`, `SaleItem`, `audit_logs`, `RecordStockMovements`-job, `DispatchWebhook`-job, Reverb (live dashboard-update).

```
1. POS calls POST /api/sales {store_id, items[], payment_method, payment_*, ...}
   │
   ├── $this->authorize('create', Sale::class) — policy gate
   ├── validate(rules) — including per-method requirements
   │   - card: optional bank/approval/last4 (Phase 1 reconciliation)
   │   - bank_transfer / mobile_transfer: require provider + reference (Phase 2)
   │   - foreign_cash: require currency + amount (Phase 2)
   │   - qr_payment: require provider (Phase 3 scaffolding)
   │
   ├── External_sale_ref idempotency:
   │   if already exists for this store → return existing sale (200, not 201)
   │
   ├── DailyRate::todayRate() must exist → 422 NO_DAILY_RATE
   │
   ├── DiscountRuleService::applyRules() — applies any matching rule before BTW
   │
   ├── BtwCalculationService::calculateCart() — discount-then-tax order
   │   - For each line: applies item discount, computes line total
   │   - Sums to subtotal, applies cart discount
   │   - Extracts BTW from post-discount total (tax-inclusive pricing)
   │   - Returns {subtotal, sale_discount, btw_total, total, line_items[]}
   │
   ├── DB::transaction:
   │   - Look up cashier's open register session (for register_session_id link)
   │   - Sale::create(...) with all snapshotted fields incl. exchange_rate_used
   │   - SaleItem::create(...) per line with btw_srd, discount_srd, etc.
   │   - audit_logs.insert (auto via spatie/auditing on the Sale model)
   │
   ├── Queue jobs (Redis → Horizon worker):
   │   - RecordStockMovements (decrement per_store stock atomically)
   │   - DispatchWebhook for each subscriber to sale.created (HMAC-signed)
   │   - DetectSaleAnomaly (AI fraud check, queued — non-blocking)
   │
   ├── Reverb broadcast SaleCreated event
   │   → dashboard's live store cards update within seconds
   │
   └── Response: {data: Sale with items loaded}, 201
```

**BTW-math** — de wettelijk-vereiste discount-then-tax-volgorde:
```
Item: 100.00 SRD (10% BTW tax-inclusive)
- Apply 10% sale discount → 90.00 SRD
- Extract BTW: 90.00 - 90.00/1.10 = 8.18 SRD
- Net (excl. BTW): 81.82
- Total to pay: 90.00 (unchanged, just broken down)
```

Als we BTW VOOR korting deden, zouden we ~0.83 SRD per 100 SRD overbelasten — illegaal onder Belastingdienst Suriname-regels.

---

## 3. Sync-flow — 5-laagse offline fallback

**Modules geraakt:** `DispatchWebhook`-job (met retry-config), `register_sessions`, `z_reports`, `SyncExportController`, scheduler.

De vijf lagen zorgen ervoor dat geen enkele dag-data vast komt te zitten op één terminal — zelfs met een verlengde internet-outage.

```
Layer 1 — Real-time:
  Sale completed → DispatchWebhook queued → POSTs to cloud webhook within seconds.
  Quiet success, no UI noise.

Layer 2 — Auto retry (internet drops):
  DispatchWebhook job has retry schedule [1m, 5m, 15m, 30m].
  Failed jobs stay in Redis. Yellow "Sync pending — N transactions queued"
  on manager dashboard.

Layer 3 — Z-Report forced retry:
  When manager taps "Submit to Headquarters" on Z-Report close:
  → ZReportController::submit() walks the unsynced queue for that day +
    forces retry NOW, in chronological order.

Layer 4 — USB encrypted export:
  Manager hits "Export .josbin_pos" on the Z-Report history table.
  → SyncExportController::export builds an AES-256-encrypted file
    containing all unsynced sales + z_report for that date.
  Manager saves to USB / WhatsApp / email.
  HQ uploads via dashboard → SyncExportController::import unpacks + replays.

Layer 5 — Catch-up on internet restore:
  Local server pings cloud /api/health every 60s.
  On restore → enumerates all queued days chronologically → fires
  DispatchWebhook for each → marks rows synced_late = true in audit log.

Mobile data fallback (Layer 1-2 path):
  4G USB dongle (Digicel/Telesur) as secondary connection on local server —
  only used for sync payload (50-200KB/day), not for POS operations.
```

**Test-coverage:** Layer 1/2/3/5 zijn e2e-getest. Layer 4 (USB export/import) heeft unit-tests voor de encryptie + integratie-test voor de round-trip.

---

## 4. BTW-aangifte-flow — sale → report → submission → inspecteur

**Modules geraakt:** `BtwSubmissionController`, `BtwSubmissionService`, `Sale`, `audit_logs`, hash chain, `BtwSubmission`-model.

```
1. POST /api/btw-submissions/preview {period_type, period_start, period_end}
   │
   ├── BtwSubmissionService::computeTotals():
   │   - Pull all sales where status='completed' AND source IN ('pos','api')
   │     AND occurred_at within [start.startOfDay(), end.endOfDay()] AST
   │   - Sum total_srd, btw_srd; mark as exempt where btw_srd == 0
   │   - Returns {sales_count, total_sales, btw_taxable, btw_exempt, total_btw, sale_ids[]}
   │
   └── Check for existing filing for this (org, period_type, range) → "existing" flag.
       Returns preview JSON (no DB write).

2. POST /api/btw-submissions {period_type, period_start, period_end, submitter_note?}
   │
   ├── $this->authorize('create', BtwSubmission::class) — OA/SM with btw.submit
   ├── Idempotency: 409 if a non-superseded filing exists for this period
   │
   ├── DB::transaction:
   │   - computeTotals() AGAIN (could differ from preview if a sale was added)
   │   - service->nextReference() — generates BTW-YYYY-MM-ORG-DAY-NNN
   │   - service->hashChain(canonical_row) — SHA-256 of (prev_hash || JSON)
   │     for tamper-evidence (same pattern as audit_logs)
   │   - BtwSubmission::create(...)  — snapshot totals + sale_ids + hashes
   │   - audit_logs.insert event=btw.submitted
   │
   └── Response 201 {data: submission}

3. Tax Inspector reviews (POST /api/btw-submissions/{id}/accept|dispute)
   │
   ├── $this->authorize('review', $submission) — only tax_inspector + SA,
   │   only on status='filed' rows (not already accepted/disputed)
   │
   ├── update status → 'accepted' or 'disputed' (+ inspector_note required for dispute)
   ├── audit_logs.insert event=btw.accepted | btw.disputed
   └── reviewed_at + reviewed_by set

4. OA resubmits (POST /api/btw-submissions/{id}/supersede) — if filed or disputed
   │
   ├── $this->authorize('supersede', $submission) — own org, not yet accepted
   ├── Mark original as 'superseded'
   ├── computeTotals() — recomputes from CURRENT sales (picks up voids/refunds since)
   ├── new row created with fresh reference, status='filed'
   ├── Both rows linked via inspector_note appended ("Superseded by REF-XXX")
   └── audit_logs.insert event=btw.superseded with replacement_ref

5. Detail / dashboard endpoints (GET):
   - GET /api/btw-submissions/{id}/detail
     → per-store, per-source-POS, per-payment-method, per-BTW-rate breakdowns
     → timeline of audit events
   - GET /api/btw-submissions/inspector-dashboard
     → KPIs (this month BTW, pending, disputed, trend, top orgs, late filings)
```

**Unique constraint-nuance:** `btw_submissions` heeft een partial unique op `(organisation_id, period_type, period_start, period_end) WHERE status != 'superseded'` zodat meerdere superseded-rijen voor dezelfde periode naast elkaar bestaan zonder de constraint te schenden — resubmissions kunnen landen. Zie migration `2026_05_26_070001_btw_submissions_partial_unique`.

---

## 5. License-flow — issue → validate → enforce → renew → lock

**Modules geraakt:** `License`, `LicenseService`, `LicenseController`, `OrganisationController::storeCreate` (de gate), `EnsureLicenseValid`-middleware (toekomstig).

```
1. SA issues a licence (POST /api/licenses)
   │
   ├── Authorize: only super_admin
   ├── License::create() with organisation_id, tier, max_stores, max_terminals,
   │   max_users, valid_from, valid_until, is_active=true
   ├── audit_logs.insert event=license.issued
   └── Returns the licence + a printable "certificate" PDF (LicenseScreen builds it)

2. OA tries to create a store (POST /api/organisations/{id}/stores)
   │
   ├── OrganisationController::storeCreate() runs the gate FIRST:
   │   a. No active license row at all → 422 LICENSE_REQUIRED
   │   b. License in soft_lock/hard_lock → 422 LICENSE_EXPIRED (+ valid_until + status)
   │   c. Already at max_stores → 422 LICENSE_STORE_LIMIT_REACHED (+ limit + current)
   │
   └── All checks pass → Store::create() proceeds.

3. License status computation (License::computeRenewalStatus):
   │
   ├── days_left = floor((valid_until - now()) / 86400)  [Carbon 3, cast to int]
   │
   ├── days_left >= 30           → 'active'
   ├── 14 <= days_left < 30      → 'warning_30'
   ├── 0  <= days_left < 14      → 'warning_14'
   ├── -14 <= days_left < 0      → 'grace'        — POS still works, banner shows
   ├── -44 <= days_left < -14    → 'soft_lock'    — new sales blocked, data available
   └── days_left < -44           → 'hard_lock'    — login blocked except export tools

4. Periodic validation (planned):
   │
   ├── Scheduler hits license-server at install boot + every 24h
   ├── 72-hour offline grace if license-server unreachable
   └── Hardware fingerprint (MAC + CPU + UUID) bound at activation, checked every poll

5. Renewal request (POST /api/licenses/{id}/renew):
   │
   ├── OA or SA can request
   ├── Updates valid_until forward
   └── Status drops back to 'active' (or 'warning_30' if very close)
```

**Zie ook:** [`dashboard_manual/15`](../dashboard_manual/15-license-management.md), [`dashboard_manual/16`](../dashboard_manual/16-license-operations.md).

---

## 6. Multi-tenant data-flow — org → store → user → sale

**Modules geraakt:** Elke controller. De scoping-regel.

```
Hierarchy:
  organisation (id, name, btw_number, currency=SRD, locale, is_active)
    ├── store (id, organisation_id, name, default_btw_rate, ...)
    │   ├── register (id, store_id, name, number, is_active)
    │   │   └── register_session (id, register_id, cashier_id, opening_float, ...)
    │   │       └── sale (id, store_id, cashier_id, register_session_id, ...)
    │   │           └── sale_item (id, sale_id, product_id, ...)
    │   └── (per-store overrides: product_stocks, price_overrides)
    ├── product (id, organisation_id, category_id, name_nl/en, ...)
    │   └── product_stock (id, product_id, store_id, qty)
    ├── category (id, organisation_id, name_nl/en, ...)
    ├── customer (id, organisation_id, name [encrypted], phone_hmac, ...)
    └── user (id, organisation_id, store_id [nullable], role, ...)

Scoping per role (in policies + controllers):
  - super_admin       → cross-org; all queries unscoped
  - tax_inspector     → cross-org but READ-ONLY, only BTW submissions
  - organisation_admin → WHERE organisation_id = user.organisation_id
  - store_manager     → WHERE store_id = user.store_id (single store)
  - cashier           → same as SM, no dashboard access
  - auditor           → same as OA, READ-ONLY
  - api_integration   → store-scoped via api_integration.store_id

User-to-store rule:
  Strict 1:1. cashier + store_manager MUST have store_id.
  Org-scoped roles (SA, OA, auditor, api_integration, tax_inspector)
  MUST NOT have store_id.

  isCrossOrgRole() = [super_admin, tax_inspector]
  isOrgScopedRole() = [super_admin, org_admin, auditor, api_integration, tax_inspector]
```

---

## 7. Webhook & externe-integratie-flow (Layer 3 Open API)

**Modules geraakt:** `Api\V1\SaleController`, `ApiIntegration`-model, `DispatchWebhook`-job.

```
Inbound (third-party POS → us):
  External system POSTs to /api/v1/sales with X-API-Key: <key>
  ↓
  api.key middleware looks up ApiIntegration by hashed key (sha256)
  ↓
  Validates store_id is scoped to this integration
  ↓
  Validates JSON:API format
  ↓
  Checks external_sale_ref idempotency: existing → 200 {data: existing}
  ↓
  Sale::create with source='api'
  ↓
  Same downstream as native sale: queue webhooks out, audit log, anomaly check
  ↓
  201 {data: Sale}

Outbound (us → third-party):
  Sale created → DispatchWebhook job enqueued for each subscriber to sale.created
  ↓
  Job: GET ApiIntegration.webhook_url + sign with HMAC-SHA256
       X-JosbinPOS-Signature: sha256=<hmac>
       X-JosbinPOS-Timestamp: <iso>
  ↓
  POST {event: 'sale.created', sale: {...}, signature: ...}
  ↓
  Receiver returns 2xx → marked delivered.
  Receiver returns 5xx → retry per Sanctum job retry config.
```

**Waarom dit van belang is voor BTW:** de belastinginspecteur ziet ZOWEL POS-native sales ALS third-party-API-sales opgerold in dezelfde BTW-aangifte (`BtwSubmissionService` filtert `source IN ('pos', 'api')`). Een belastingplichtige die zowel Josbin als een partner-POS gebruikt dient één aangifte in die beide dekt. Source-attributie wordt behouden op het detailscherm zodat de inspecteur de mix kent.

---

## 8. Backwards-compat / migration-policy

**Database-migraties zijn in de praktijk append-only.** Zelfs wanneer kolommen technisch verwijderbaar zijn, geef de voorkeur aan:
- Nullable kolommen toevoegen boven bestaande wijzigen
- Soft-deactivating rijen boven hard delete (`is_active = false`)
- Partial indexes / unique constraints boven destructieve schema-wijzigingen

**Waarom:** de audit log + Rekenkamer-export hebben voor altijd historische data nodig. Een kolom-rename in 2027 mag het auditspoor van 2026 niet breken.

**API-versioning:** `/api/v1/*` is het publieke Layer-3-contract — wijzigingen daar zijn breaking changes. `/api/*` (intern) mag vrijer evolueren maar coordineer s.v.p. met frontend-wijzigingen in dezelfde PR.

---

## 9. Veelvoorkomende patterns die het waard zijn te kennen

| Pattern | Waar gebruikt | Waarom |
|---|---|---|
| Hash-chain op audit-grade-rijen | `audit_logs`, `btw_submissions` | Manipulatiebestendigheid voor Rekenkamer / Belastingdienst |
| Snapshot-totalen op aangiftes | `btw_submissions` | Belastingdienst verwacht wat geclaimd was op aangiftemoment, geen retroactieve herberekening |
| Partial unique indexes | `btw_submissions`, `sales.card_bank` | Status-aware uniqueness zonder geschiedenis te droppen |
| Idempotency-keys | `external_sale_ref` op sales, `reference` op btw_submissions | Veilige retry vanaf offline POS / externe integrators |
| Per-vestiging-voorraad via `product_stocks` | Alle inventory-queries | Vóór #21 hadden we `products.stock_qty` (enkele waarde); nu multi-vestiging-correct |
| Wildcard `['*']` Sanctum-tokens + literal `'2fa_verified'`-flag | Sessie-tokens current design | Permissions verse lezen op request-tijd; 2FA-flag blijft expliciet |
| Discount-voor-tax BTW-calc | `BtwCalculationService` | Belastingdienst Suriname-wettelijke vereiste |
| AST-tijdzone voor alle voor-mens-zichtbare timestamps | Bonnen, rapporten, audit log | Suriname is UTC-3; toon nooit UTC aan gebruikers |

---

## 10. Cross-references

- [`docs/architecture.html`](architecture.html) — interactieve ER-diagrammen + use cases
- [`docs/offline-fallback-verification.md`](offline-fallback-verification.md) — empirisch bewijs van de 5-laagse sync
- [`docs/00-installation-and-setup.md`](00-installation-and-setup.md) — installatie-runbook
