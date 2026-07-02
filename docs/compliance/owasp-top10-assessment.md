# OWASP Top 10 (2021) — Self-Assessment
### Josbin POS

**Document ID:** JOSBIN-OWASP-v1
**Scope:** Backend (Laravel 13 / PHP 8.3), management dashboard + POS (React 19), local Docker
deployment (Nginx, PostgreSQL 16, Redis 7).
**Method:** Internal self-assessment with source-code evidence. This is **not** a substitute for
the independent penetration test recommended before production sign-off (see §11).
**Legend:** ✅ Mitigated · 🟡 Partial / needs configuration · 🔲 Open / external action required

> **Dutch summary.** Dit is de interne OWASP Top 10 (2021)-zelfevaluatie van Josbin POS, met
> broncodebewijs per risico. Het is géén vervanging van de aanbevolen onafhankelijke
> penetratietest (§11). Restpunten staan in §12.

---

## A01:2021 — Broken Access Control  ✅ (met restpunt)

**Risk.** Users acting outside their intended permissions: horizontal (other tenant's data) or
vertical (privilege escalation).

**Mitigation & evidence.**
- **Server-side authorization, deny-by-default.** Every sensitive controller calls
  `$this->authorize(...)` against a Policy — access is enforced at the API level, not hidden in
  the UI. Policies live in `backend/app/Policies/` (`CustomerPolicy`, `SalePolicy`, `UserPolicy`,
  `OrganisationPolicy`, `StorePolicy`, etc.).
- **RBAC** via `spatie/laravel-permission`; seven roles defined in `backend/app/Models/User.php`
  (`ROLE_SUPER_ADMIN` … `ROLE_TAX_INSPECTOR`).
- **Tenant isolation at query level.** Controllers verify organisation ownership before returning
  data — e.g. `CustomerController::ensureSameOrg()` aborts 403 when
  `user.organisation_id !== customer.organisation_id`; `CustomerPolicy::view/update` re-check the
  same. Cross-tenant PII access is blocked before retrieval, not filtered afterwards.
- **Least privilege on destructive actions.** WBP-S erasure (`CustomerPolicy::delete`) is limited
  to Organisation Admin / Super Admin; cashiers and store managers cannot redact PII.
- **Segregation of duties (government).** Void/refund on a government org requires a *second
  approver* — the first request only records intent, a different user approves
  (`SaleController::void`, `$needsSecondApproval = org.is_government`).
- **Authenticated route groups** via `auth:sanctum`; token abilities gate 2FA-setup vs full
  sessions (`routes/api.php`).

**Residual.** Tenant isolation is enforced in application code (policy + `ensureSameOrg`) rather
than by PostgreSQL Row-Level Security. RLS is documented as an architecture goal but is not the
active enforcement layer in the current on-premise build. An external pentest should specifically
probe IDOR/cross-tenant access on every list and detail endpoint.

---

## A02:2021 — Cryptographic Failures  ✅ (met restpunt)

**Risk.** Exposure of sensitive data through weak or missing encryption.

**Mitigation & evidence.**
- **Field-level encryption of customer PII.** Name, phone, email and ID number are encrypted at
  rest with `Crypt::encryptString()` (Laravel `APP_KEY`, cipher **AES-256-CBC** —
  `backend/config/app.php`), decrypted only on read (`backend/app/Models/Customer.php`). Search
  uses an HMAC-SHA256 **blind index** (`name_hash`, `phone_hash`) so lookups never require
  bulk-decryption. Direct DB access yields ciphertext only.
- **Passwords** hashed with **bcrypt cost 12** (`BCRYPT_ROUNDS=12`; `'password' => 'hashed'` cast).
- **Secrets not leaked to logs/audit.** `$hidden` + `$auditExclude` on `User` keep password hash,
  2FA secret and passkey out of JSON responses and the audit log.
- **API secrets encrypted.** `ApiIntegration.webhook_secret` uses the `encrypted` cast.
- **Encrypted backups.** `pg_dump` output is AES-256-CBC encrypted (`docker/scripts/backup.sh`).
- **Transport.** Self-signed HTTPS variant of the dashboard on :8443
  (`docker/frontends/dashboard-tls.conf`); TLS terminated at the proxy in production.

**Residual (🟡).**
- **HSTS is disabled by default** — the `Strict-Transport-Security` header is commented out in
  `docker/nginx/default.conf` and must be enforced by the upstream production proxy.
- The local internal Nginx also listens on **plain HTTP (port 80)**; production must ensure TLS
  termination in front of it and an 80→443 redirect.
- Field-level encryption uses the single application `APP_KEY`; a separate, rotated key for PII
  (as described in the security architecture) is a recommended hardening step.

---

## A03:2021 — Injection  ✅

**Risk.** SQL, command or other injection.

**Mitigation & evidence.**
- **SQL injection structurally prevented.** All database access goes through Eloquent ORM /
  the query builder, which uses parameterised/bound queries. No string-concatenated SQL was found
  in application controllers; user-supplied values (e.g. HMAC search hashes) are always passed as
  bindings (`Customer::scopeSearchByName/Phone`, `where('name_hash', $hash)`).
- **Input validation** via `$request->validate([...])` on write endpoints (see
  `CustomerController::store/update`, `SaleController::store`) constrains type, length and format
  before persistence.
- **XSS (a form of injection) — see A03/A05:** React auto-escapes rendered output and a strict
  Content-Security-Policy is set (`docker/nginx/default.conf`).

**Residual.** CSV import parses user-supplied files (`CustomerController::import`); it validates
mime/size and column counts. Ensure downstream consumers of exported CSV apply spreadsheet
formula-injection defences (prefix `=+-@`) if opened in Excel/Sheets — recommended check.

---

## A04:2021 — Insecure Design  ✅ (met restpunt)

**Risk.** Missing or ineffective security controls by design.

**Mitigation & evidence.**
- **Threat-informed design for a financial/government system:** immutable hash-chained audit log,
  segregation of duties for voids/refunds, deny-by-default RBAC, PII minimisation in logs.
- **Data-never-hostage design:** licence lock still exposes data-export routes for 90 days
  (`EnsureLicenseValid`).
- **Offline-resilience design:** five-layer sync fallback incl. AES-256 USB export
  (`SyncExportController`) so intermittent connectivity does not force insecure workarounds.
- **Rate-limited abuse-prone flows:** login, void/refund (`throttle:20,1`), report export.

**Residual.** No formal, documented threat model / abuse-case catalogue is stored in-repo. Writing
one (STRIDE per data-flow) is recommended before the pentest so findings map to intended controls.

---

## A05:2021 — Security Misconfiguration  🟡

**Risk.** Insecure defaults, verbose errors, missing headers.

**Mitigation & evidence.**
- **Security headers active** in Nginx: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
  nosniff`, `Referrer-Policy`, `Permissions-Policy (geolocation/microphone/camera denied)`, and a
  strict `Content-Security-Policy` (`frame-ancestors 'none'`, restricted `default-src 'self'`) —
  `docker/nginx/default.conf`.
- **Nginx rate-limit zones** for login/api/export/health.
- **Debug tooling gated:** Laravel Telescope config present but is a dev tool; Electron DevTools
  disabled in production builds.
- **Isolated DB network** (Docker private network) per the deployment design.

**Residual (🟡).**
- **HSTS commented out** (A02) — enable at the production proxy.
- **CSP allows `'unsafe-inline'` for script-src and style-src** — a known weakening to support the
  bundled SPA/receipt rendering; tightening to nonces/hashes is recommended.
- Confirm per-deployment that `APP_DEBUG=false` and `APP_ENV=production`, and that Telescope is not
  route-exposed in production.
- **PostgreSQL WAL/PITR not enabled** by default (`docker/postgres/data/postgresql.conf` keeps
  `wal_level`/`archive_mode` at commented defaults) — see A02/backup notes; recovery relies on
  nightly encrypted dumps.

---

## A06:2021 — Vulnerable and Outdated Components  🟡

**Risk.** Known-vulnerable dependencies.

**Mitigation & evidence.**
- Modern, supported stack: Laravel 13 / PHP 8.3, React 19, PostgreSQL 16, Redis 7.
- Dependencies pinned via `composer.lock` / `package-lock.json`.
- CI via GitHub Actions runs tests on every commit (`.github/workflows/`).

**Residual (🟡).** No automated dependency-vulnerability scanning (e.g. `composer audit`,
`npm audit`, Dependabot) was confirmed wired into CI. Add automated SCA and a patch cadence before
production sign-off. Verify IonCube Loader and base Docker images are on current patch levels at
each release.

---

## A07:2021 — Identification and Authentication Failures  ✅

**Risk.** Weak authentication, credential stuffing, session flaws.

**Mitigation & evidence.**
- **bcrypt-12** password storage (A02).
- **Brute-force protection — two dimensions:** 5 attempts / 5 min per email+IP **and** 20 / 5 min
  per IP (`AppServiceProvider::configureRateLimiting`), plus a controller-level throttle in
  `AuthController::login` (5 attempts, 300 s lockout) and an nginx `login` zone (5 r/m). Progressive
  lockout returns HTTP 429 with a localized message.
- **2FA/TOTP** mandatory and non-bypassable for government accounts (`EnsureTwoFactor`);
  per-role 2FA policy configurable by Super Admin (`SecurityPolicyController`). Fortify + passkeys
  available for admin.
- **Token-scoped 2FA:** full session tokens must carry the literal `2fa_verified` ability — a
  wildcard `*` token does not satisfy it (explicit check in `EnsureTwoFactor`), closing a real
  bypass class.
- **Session timeout** enforced by `SessionTimeout` middleware (15 min POS / 60 min dashboard per
  design).

**Residual.** Confirm account-lockout escalation and email alerting on repeated failures are wired
end-to-end (design calls for email alert at 5 failures, admin-unlock at 10). Verify in staging.

---

## A08:2021 — Software and Data Integrity Failures  ✅

**Risk.** Tampering with data or code, insecure deserialization, unsigned updates.

**Mitigation & evidence.**
- **Tamper-evident audit trail.** `audit_logs` is a SHA-256 hash chain (each row hashes its own
  fields + the previous row's hash per organisation — `AuditHashService`), verifiable with
  `php artisan audit:verify`. Model-level `updating`/`deleting` return `false`, so rows cannot be
  modified or deleted through the ORM (`AuditLog::booted`).
- **OwenIt model audits are sealed into the same chain** immediately on write (the `Audited`
  listener in `AppServiceProvider::boot` calls `AuditHashService::sealRow`), so create/update
  events on Product/User/Customer/… cannot be silently dropped.
- **Idempotent external sale ingestion** prevents duplicate/replayed writes
  (batch upload ignores duplicate `sale_ref`).
- **Webhook secrets encrypted**; outbound webhooks are queue-backed with bounded retry
  (`DispatchWebhook`).
- **Code integrity for delivery:** IonCube encoding of PHP and a code-signed, DevTools-disabled
  Electron binary.

**Residual.** Webhook *inbound* authenticity (HMAC verification of PSP callbacks) is gated behind a
feature flag and returns 503 until a partner secret is configured (`qr_webhooks_enabled`) — verify
HMAC checking when enabling.

---

## A09:2021 — Security Logging and Monitoring Failures  ✅ (met restpunt)

**Risk.** Insufficient logging/monitoring delays breach detection.

**Mitigation & evidence.**
- **Comprehensive, immutable audit logging** of admin actions, PII access
  (`customer.accessed`/`updated`/`redacted`), voids/refunds, register sessions, BTW filings — all
  hash-chained (A08). WBP-S PII events store field *names* only, never plaintext values.
- **AST timestamps** on every audit row (`created_at` set to `now()` in `America/Paramaribo`).
- **AI fraud/anomaly detection** job runs after sales and flags unusual voids/discounts/off-hours
  activity (design; `AiController` + OpenAI integration when configured).
- **Queue monitoring** via Laravel Horizon.

**Residual (🟡).** External/centralised monitoring and alerting (Laravel Nightwatch / Sentry)
described in the proposal is **not configured** in the codebase — no error-monitoring DSN or
Nightwatch wiring was found. Add centralised alerting (failed logins, license-lock, sync failures,
audit-verify failures) before production. Confirm `php artisan audit:verify` runs on a schedule and
alerts on a broken chain.

---

## A10:2021 — Server-Side Request Forgery (SSRF)  🟡

**Risk.** Server coerced into making requests to unintended destinations.

**Mitigation & evidence.**
- **Outbound HTTP surface is narrow and fixed:** exchange-rate fetch (ExchangeRate-API),
  license-server check, optional OpenAI calls, and outbound webhooks. The first three target
  fixed, configured hostnames (`config/services.php`, `config/josbin_pos.php`).
- **DB container has no internet access** (isolated Docker network) per deployment design.

**Residual (🟡).** Outbound **webhook URLs are user-configurable** (`ApiIntegration.webhook_url`,
`DispatchWebhook`). Without egress allow-listing, a configured URL could point at internal/metadata
addresses. Recommend: validate/deny private & link-local ranges (RFC1918, 169.254.x, ::1, etc.) on
webhook-URL save and at dispatch time, and place outbound webhook egress behind an allow-list.
Verify the QR/PSP webhook ingestion applies the same URL hygiene when enabled.

---

## §11 — Independent testing status

- ✅ Internal self-assessment (this document).
- 🔲 **Independent penetration test — NOT yet performed.** The proposal budgets USD 2,000–4,000 for
  an external test. This is a **required residual action** before production go-live; the results
  and remediation should be appended here.
- 🔲 Signed OWASP Top 10 compliance report — this document is the working draft to be signed at
  launch after the pentest.

## §12 — Residual actions before production sign-off

| # | Item | OWASP | Priority |
|---|---|---|---|
| 1 | Enable & enforce **HSTS** at the production proxy; ensure 80→443 redirect | A02/A05 | High |
| 2 | Enable **PostgreSQL WAL / point-in-time recovery** (or formally accept nightly-dump RPO) | A05 | High |
| 3 | Add **egress allow-listing + private-range denial** for outbound/inbound webhooks | A10 | High |
| 4 | Wire **centralised monitoring/alerting** (Nightwatch/Sentry) + scheduled `audit:verify` alert | A09 | High |
| 5 | Add **automated dependency scanning** (`composer audit`, `npm audit`/Dependabot) to CI | A06 | High |
| 6 | Commission the **independent penetration test** | All | High |
| 7 | Confirm `APP_DEBUG=false`, Telescope not route-exposed, in every production deployment | A05 | Medium |
| 8 | Tighten CSP away from `'unsafe-inline'` (nonces/hashes) | A05 | Medium |
| 9 | Consider a **separate, rotatable PII encryption key** distinct from `APP_KEY` | A02 | Medium |
| 10 | Evaluate **PostgreSQL Row-Level Security** as defence-in-depth for tenant isolation | A01 | Medium |
| 11 | Add spreadsheet formula-injection prefixing to CSV exports | A03 | Low |
| 12 | Verify failed-login email alerting and admin-unlock flow end-to-end | A07 | Low |

---

**Prepared by:** `[IN TE VULLEN — assessor, date]`
**Reviewed by:** `[IN TE VULLEN — security lead, date]`
