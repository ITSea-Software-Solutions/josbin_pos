# Audit findings — 2026-06-04

Five parallel auditors swept the codebase (security, data integrity,
performance, UX, compliance). 60+ findings; this page triages them so
we can fix the dangerous ones before the demo and queue the rest.

Severity scale:
- **🔴 CRITICAL** — silent data corruption, money loss, or compliance breach. Fix first.
- **🟠 HIGH** — exploitable / breaks at scale / cashier-facing bug.
- **🟡 MEDIUM** — quality gap, polish, hardening.
- **🔵 LOW** — nits.

Effort: **S** ≤ 1 hr · **M** half day · **L** 1–2 days · **XL** 3+ days.

---

## 🔴 P0 — fix before next demo (silent loss / compliance breach)

> **Batch 1 shipped 2026-06-04** — P0-1, P0-2, P0-3, P1-P1 resolved (oversell class + N+1). G-020. Tests: `OversellPolicyTest`.
> **Batch 2 shipped 2026-06-04** — P0-4, P0-9, P0-10, P1-C1 resolved (compliance correctness). G-022 (AST config), G-023 (hash chain never verified — now fixed). Tests: `ComplianceIntegrityTest`.
> **Batch 3 shipped 2026-06-05** — P0-6 + P1-S1…S7 resolved (security pass). Customer org-scope rule, webhook-secret encryption (col widened to text), svg-upload XSS, sanctum expiry backstop, void/refund throttle, 2FA middleware mounted, reset-2fa step-up, per-IP login throttle. Tests: `SecurityHardeningTest` (8). **Remaining P0:** P0-5 (receipt token scoping — its own pass), P0-7/8 (WBP-S erasure + Customer auditing = Batch 4).

| # | Area | Finding | Effort |
|---|------|---------|--------|
| ✅ **P0-1** | sales | **DONE.** Stock decrement was in a queued job after commit → queue outage = oversell. Moved `StockMovementService::recordSale` inside the sale `DB::transaction`. | M |
| ✅ **P0-2** | sales | **DONE.** `max(0.0,…)` clamp removed — `qty_after` is now the honest running balance (can go negative), ledger stays consistent. Strict mode (`block_oversell=true`) throws `InsufficientStockException` (422) and rolls the sale back. | S |
| ✅ **P0-3** | sales | **DONE.** Variant `->lockForUpdate()->decrement()` (a no-op lock) replaced with `SELECT … FOR UPDATE` + guarded `update()`, respecting the org oversell policy. No DB CHECK — default policy allows negative by design. | M |
| ✅ **P0-4** | compliance | **DONE.** `hashChain` now scopes the previous-hash lookup to `organisation_id` (ordered by `submitted_at`+`created_at`; UUID PK isn't monotonic). Each taxpayer's chain is self-contained. Test: `ComplianceIntegrityTest::test_btw_hash_chain_is_per_organisation`. | S |
| **P0-5** | security | **`?token=` query auth accepts full 12h wildcard tokens** (`AuthenticateViaQueryToken.php:26-42`). Token ends up in webserver access logs / browser history / Referer headers; full account takeover if anyone reads logs. Receipt-PDF links are shared by email. **Fix:** issue short-lived `receipt:{sale_id}` ability tokens; reject `*` in this middleware. | M |
| ✅ **P0-6** | security | **DONE.** New `CustomerBelongsToOrg` rule (mirrors `StoreBelongsToOrg`) on `customer_id` at sale create + hold. Foreign-org customer UUIDs now 422. Test: `SecurityHardeningTest::test_cannot_attach_customer_from_another_org`. | S |
| **P0-7** | compliance | **WBP-S "right to erasure" is unimplemented** for `Customer`. No DELETE/redact endpoint. **Fix:** add `DELETE /customers/{id}` that nulls encrypted PII + hash columns and writes `customer.redacted` to audit log; keep the row + counters so reports stay intact. | M |
| **P0-8** | compliance | **`Customer` model is not Auditable** despite carrying every encrypted PII field. WBP-S § access-log requirement says PII reads/writes must be traceable; today they aren't. **Fix:** `implements Auditable` + `use Auditable` on Customer; explicit `accessed` event on `CustomerController::show`. | S |
| ✅ **P0-9** | compliance | **DONE.** Pinned `'timezone' => env('DB_TIMEZONE', 'America/Paramaribo')` in the pgsql connection so every `whereDate`/`DATE()` truncates in AST regardless of the host/container/managed-DB TZ (was relying implicitly on the compose `TZ` env — broken on managed cloud Postgres). See G-022. | M |
| ✅ **P0-10** | compliance | **DONE.** All 11 raw `DB::table('audit_logs')->insert()` calls converted to `AuditLog::create(...)` so the `creating` hook chains them. **Bonus:** the first chain-verify test revealed the chain *never actually verified* (create vs verify serialised `created_at`/`new_values` differently) — fixed `computeHash` to canonicalise both. See G-023. | M |

**P0 total: ~3 days of focused work.** Demo-blocking.

---

## 🟠 P1 — fix this sprint (exploitable, scale-breaking, or daily-friction)

### Security — ✅ all resolved in Batch 3 (2026-06-05), tests in `SecurityHardeningTest`
| # | Finding | Effort |
|---|---------|--------|
| ✅ P1-S1 | **DONE.** `webhook_secret` `'encrypted'` cast + migration encrypting existing rows; column widened varchar(64)→text for ciphertext. | S |
| ✅ P1-S2 | **DONE.** Dropped `svg` from receipt-logo mime allow-list → png/jpg/webp only. | S |
| ✅ P1-S3 | **DONE.** `reset-2fa` requires actor's `current_password`, blocks mandatory-2FA roles (super_admin/tax_inspector/govt), writes `user.two_factor_reset` audit row. (Email notify = future, endpoint not yet UI-wired.) | S |
| ✅ P1-S4 | **DONE.** `sanctum.expiration` = `env('SANCTUM_EXPIRATION', 720)` backstop; per-token expiries still win (earlier of the two). | S |
| ✅ P1-S5 | **DONE.** `throttle:20,1` on `sales.void` + `sales.refund`. | S |
| ✅ P1-S6 | **DONE.** Login throttle now returns two limits: per-email+IP (5/5min) AND per-IP (20/5min). Message → `errors.too_many_login_attempts`. (Progressive usleep not added — per-IP cap covers the spray case.) | S |
| ✅ P1-S7 | **DONE.** `two_factor` (EnsureTwoFactor) mounted on the authenticated group. Verified safe: 2FA challenge/setup routes are outside the group; non-2FA users pass through; live OA smoke = 200. | S |

### Data integrity
| # | Finding | Effort |
|---|---------|--------|
| P1-D1 | **`Sale::nextNumber()` advisory lock is useless if called outside a txn.** Two concurrent first-sales of the day can compute the same sale_number → unique-index crash 500. **Fix:** assert `DB::transactionLevel() > 0` at top; or use per-store Postgres SEQUENCE. | S |
| P1-D2 | **`customer.total_spend_srd` casts to float** (`SaleController.php:326-328`). All other money is BCMath/DECIMAL. Aggregated LTV drifts vs `SUM(sales.total_srd)`. **Fix:** `update(['total_spend_srd' => DB::raw('total_spend_srd + ?')], [$stringTotal])`. | S |
| P1-D3 | **Refund leg loses original discount info** (`SaleController.php:546-600`). Refund sale_items hard-code `discount_srd='0.00'`; BTW report double-counts the original discount on partial refunds. **Fix:** reuse `BtwCalculationService::calculateLineItem` with negated qty. | M |
| P1-D4 | **`DailyRateService::updateOrCreate` can race on first-sale-of-day.** Two terminals both call the API, both `updateOrCreate`, the second overwrites the first's `usd_to_srd`. Two audit events for one date. **Fix:** wrap in `DB::transaction` with `lockForUpdate` `firstOrCreate`; or `INSERT … ON CONFLICT DO NOTHING RETURNING`. | S |
| P1-D5 | **`sale_discount_pct` silently dropped** when discount rules also produce a cart discount (`SaleController.php:200-208`). Cashier thinks customer got 10% off + loyalty rule; system applied only the loyalty rule. **Fix:** combine before calling the BTW service, or change the service to additively combine. | S |

### Performance (the 200ms budget at scale)
| # | Finding | Effort |
|---|---------|--------|
| ✅ P1-P1 | **DONE.** `stockForStore()` / `lowStockThresholdForStore()` / `priceForStore()` now read the eager-loaded collection via `relationLoaded()` guard; `pos()` eager-loads `storeOverrides` too. POS startup no longer fires a query per product. | S |
| P1-P2 | **`/api/products/pos` returns ALL active products unpaginated** with every storeStocks row eager-loaded. At 50 stores × 10k SKUs = 500k product_stocks rows pulled into PHP per terminal startup. OOM risk. **Fix:** constrain eager-load to requesting `store_id`; paginate 500 + incremental `updated_since` sync. | M |
| P1-P3 | **`whereDate('occurred_at', ...)` defeats `(store_id, occurred_at)` index** in dashboard summary, store detail, every report. At 1M+ rows the planner switches to seq scan. **Fix:** sweep `whereDate` → `whereBetween($from, $toEndOfDay)`. 10–100× perf gain on reports. | M |
| P1-P4 | **`storeDetail` runs 9 sequential queries** every 60 seconds × N dashboards. Several use function-wrapped TZ casts → cannot use index. **Fix:** add expression index `(store_id, DATE(occurred_at AT TIME ZONE 'America/Paramaribo'))` OR rewrite as `BETWEEN`. | M |
| P1-P5 | **`SaleCompleted` broadcasts to BOTH `store.` AND `org.` channels.** Org channel: 50 stores × 1k tx/day = 50k events fanned to every dashboard user. **Fix:** drop the `store.` channel (POS doesn't need echo) or throttle org-channel to 1 aggregated tick/sec. | S |
| P1-P6 | **`StockMovementService::recordSale` does Product::find + lockForUpdate inside the loop.** 20-item basket = 60+ queries inside the txn, row-locks for entire duration; concurrent cashiers serialise. **Fix:** batch-load products + single bulk UPDATE + bulk INSERT of movements. | M |

### UX
| # | Finding | Effort |
|---|---------|--------|
| P1-U1 | **POS has no global keyboard shortcuts.** Cashier must mouse-click for Pay/Hold/Customer/Discount/New sale. Friday-evening killer. **Fix:** `useHotkeys` on POSScreen — F1=customer, F2=hold, F3=discount, F9=pay, Esc=close modal, F12=keyboard. Document in cheat-sheet. | M |
| P1-U2 | **POS `handleHoldBill` swallows errors** (`POSScreen.tsx:69-71`). Network drops → bill silently lost. Same in `downloadSurapos` for the Layer-4 USB export — silent failure in a compliance fallback. **Fix:** shared `useToast()` hook; surface every error. | S |
| P1-U3 | **Destructive actions use browser `confirm()`** (UsersScreen, OrganisationsScreen, CatalogueScreen, ApiKeysScreen, etc.). Inconsistent with StoresScreen's styled modal; breaks in some Electron contexts. **Fix:** reuse `ConfirmDeactivate` pattern; surface what will happen ("3 cashiers will lose POS access"). | M |
| P1-U4 | **Dashboard modals lack Escape-to-close & focus-trap.** Universal "get me out" instinct fails. **Fix:** create shared `dashboard/components/Modal.tsx` mirroring POS's; migrate all dashboard modals. | M |
| P1-U5 | **`StoreDetailScreen` has no back button.** Only exit is sidebar — loses scroll position on parent. **Fix:** add `onBack` like `BtwSubmissionDetailScreen`. | S |
| P1-U6 | **i18n discipline** — ~1175 inline `isNl ? 'Dutch' : 'English'` ternaries instead of `t()`. Inverts the "instant per-user language switch + add Sranantongo via a translation file" promise from CLAUDE.md. **Fix:** migrate to keys progressively (one screen per PR); ESLint rule banning string literals in JSX. | XL |

### Compliance
| # | Finding | Effort |
|---|---------|--------|
| ✅ P1-C1 | **DONE.** Exempt revenue now summed from `sale_items.btw_exempt = true`, not the sale-level `btw_srd == 0` proxy. A mixed basket reports only its exempt line as exempt. Test: `ComplianceIntegrityTest::test_mixed_basket_reports_only_exempt_line_as_exempt`. | S |
| P1-C2 | **`btw_submissions.status` is updated in-place; hash never recomputed.** Tamper-evidence claim in manual ch 20 is overstated. **Fix:** either insert "event" rows (append-only history) or recompute hash on every status change + add a `status_history` JSONB column. | M |
| P1-C3 | **Voided sales are not immutable.** Plain `$sale->update(...)` works post-void; only the OwenIt audit_log captures it. **Fix:** model `updating` hook that throws on `getOriginal('status') === 'voided'`; PG trigger as belt-and-braces. | S |
| P1-C4 | **Audit-log OA scoping filters by `WHERE user_id IN (org_users)`, not `audit_logs.organisation_id`.** System events with `user_id=NULL` are invisible to OA; SA actions on the org's data are also hidden. **Fix:** filter on `audit_logs.organisation_id = ?` (OR `user_id IN (...)` for legacy nulls). | S |
| P1-C5 | **Daily-rate row is not append-only.** `DailyRateService::updateOrCreate` overwrites a locked rate; sales snapshot the rate (good) but Rekenkamer cross-check of `daily_rates` itself fails. **Fix:** model `updating` hook blocking change when `locked_at IS NOT NULL` unless `manual_override=true`. | S |
| P1-C6 | **Receipts without `btw_number` still print.** Belastingdienst expects every BTW-charging receipt to carry a number. **Fix:** block `SaleController::store` when org non-exempt and `organisation.btw_number` is null; Settings-screen warning. | S |

**P1 total: ~2 weeks at one engineer.**

---

## 🟡 P2 — queue for the polish pass

(28 findings — too long to enumerate here. Highlights:)

- **Audit-log search uses `ILIKE '%term%'` on TEXT JSON column.** Full scan on every search; convert to `jsonb` + GIN, or `pg_trgm`.
- **`product_stocks` low-stock check uses `whereRaw('stock_qty <= low_stock_threshold')`** — can't use any index. Add generated column `is_low` with partial index.
- **`ZReport::orderByDesc('report_date')->get()->unique('store_id')`** pulls every Z-report ever written. Switch to `DISTINCT ON (store_id)`.
- **`AuthController::checkGeoAlert`** calls `http://ip-api.com` over plaintext. Leaks government login IPs to a third-party in cleartext. Switch to HTTPS + token.
- **`User::$fillable` includes `role`/`organisation_id`/`is_active`**. Future `User::create($request->all())` would let an attacker elevate. Move them to `$guarded`.
- **CORS pattern matches `http://localhost:*` in production** too. Local app on POS terminal could call production API on a logged-in user. Gate behind `app()->environment('local')`.
- **`tax_inspector` has `audit.view` but the controller filter must restrict to events touching their BTW reviews.** Verify with a feature test.
- **`reports.consolidated` PDF "per-store" rows drop org name** — confusing for SA who deals with multiple orgs.
- **`AuditLogScreen` search has no debounce** + no client highlight.
- **`StockScreen` MovementHistory** modal hardcodes `per_page=50` with no pagination → silent truncation on popular SKUs.
- **`SalesHistoryScreen.tsx:91`** uses `.slice(0,10)` on `toISOString()` → "today" rolls over at 22:00 AST (UTC midnight).
- **`Customer.scopeSearchByName`** HMAC of `mb_strtolower($value)` without NFKD/diacritic strip → "José" vs "jose" misses → duplicate customers (compounds PII exposure).
- **IVFFlat index built on empty table** at migration time; PG16 supports HNSW. Switch + `REINDEX` post-seed.
- **`SyncExportController`** loads entire date range of sales+items into memory then `json_encode`. Stream/chunk + cap at 30 days + gzip before encryption.
- **`CustomerController::store`** lets cashier write `id_number` (WBP-S protected). Restrict to manager+; strip on cashier creates.
- **Per-item `category_id` lookup is N+1** in cart build; batch-load before the map.

---

## 🔵 P3 — nits & cleanup

- `where('auditable_type','like','%Sale')` leading wildcard — use exact FQCN.
- Tab labels in `ReportsScreen` defined inline, not via `t()`.
- DashboardOverview uses "Winkels" / "Winkeldetails" while every other screen uses "Vestiging(en)".
- `sale_items.product_id` has `nullOnDelete` but products uses SoftDeletes — FK only fires on `forceDelete`; document + test that "Top Products" handles null `product_id`.
- `BtwSubmissionController` supersede appends "[Superseded by …]" but overwrites the inspector's original dispute note.

---

## Suggested order (best ROI first)

1. **P0-1 + P0-2 + P0-3** together — same `SaleController` file, one PR, ~3 hours. Eliminates the oversell + ledger-inconsistency class entirely.
2. **P1-P1** (stockForStore N+1) — 5-line fix, instantly unlocks POS startup at scale. Should land same day.
3. **P0-9 + P0-10 + P0-4 + P1-C1** — compliance correctness pass (TZ, hash chain, BTW split). Half a day.
4. **P0-5 + P0-6 + P1-S1 → P1-S7** — security hardening sweep. One day.
5. **P0-7 + P0-8 + P1-C5 + P1-C6 + P1-C4** — WBP-S + Rekenkamer compliance pass. One day.
6. **P1-P3 + P1-P4** — `whereDate` → `whereBetween` sweep. Half a day, massive scaling win.
7. **P1-U1 + P1-U2 + P1-U3 + P1-U4** — UX polish before demo. Two days.
8. P2 polish + P1-U6 (i18n) becomes a continuous background refactor.

Total to close all P0+P1: roughly two engineer-weeks. P0 alone is ~3 days and unlocks the demo.
