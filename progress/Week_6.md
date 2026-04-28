# Josbin POS — Week 6 Progress Report
**Phase 3 Continued: Security Hardening, Infrastructure & Testing Foundation**
Period: Week 6 of 18

---

## Summary

Week 6 focused on making the platform production-ready: cryptographic audit log integrity,
government-grade login security, full infrastructure automation, and building the testing
foundation (load tests and end-to-end Playwright specs). Eight major feature areas were
completed, taking Phase 3 from 52/96 to **72/97 tasks complete**.

---

## Completed This Week

### Security Hardening

#### Audit Log Cryptographic Hash Chain
Every audit log row now carries a tamper-proof SHA-256 hash chain — the same principle
used by blockchain and financial ledger systems.

- **Migration** `2026_04_14_000001` — adds `previous_row_hash` and `row_hash` columns (VARCHAR 64)
  with composite index on `(organisation_id, created_at)` for fast chain traversal
- **`AuditHashService`** — `computeHash(row, prevHash)`: SHA-256 of
  `org_id|event|auditable_type|auditable_id|new_values|created_at|prev_hash`
- **`AuditLog` Eloquent model** — `creating` hook automatically computes and attaches both
  hash fields before every insert. `updating` and `deleting` hooks return `false` — rows
  are permanently append-only at the application layer
- **`php artisan audit:verify --org=uuid`** (or `--all`) — walks the full chain for an
  organisation, recomputes each hash, reports the first broken row ID if any tampering
  is detected. On failure, logs an `audit_chain_integrity_failure` event to the trail itself.
  Used for: Rekenkamer pre-submission checks, nightly CI, post-incident forensics

**Client benefit:** Any deletion or modification of any audit row — even direct database
access — breaks the chain from that point forward and is immediately detectable.

---

#### Government Account Login Security

Two new security layers activate for government organisations and super_admin accounts:

**Single-device enforcement**
- When a government user logs in, all existing active tokens are revoked before the new
  token is issued. Only one active session can exist at any time per government account.
- Logged in audit trail as `single_device_logout` with IP address

**Geo-alert for non-Suriname logins**
- Uses ip-api.com (free, no API key required, 3-second timeout) to check the country
  of every government login IP
- If country code ≠ `SR` (Suriname), an alert email is sent to the organisation admin
  in Dutch or English based on the user's locale:
  *"Gebruiker Jan de Vries heeft ingelogd vanuit Amsterdam, Netherlands (IP: 1.2.3.4)
  op 14-04-2026 09:15 AST. Als dit niet verwacht was, trek dan direct alle sessies in."*
- Logged as `geo_alert_login` event in the audit trail
- **Never blocks the login** — alert only. Private/loopback IPs are skipped (local installs)

---

#### Webhook HMAC-SHA256 Signing

Outbound webhooks now carry a cryptographic signature receivers can verify.

- **New `webhook_secret` column** on `api_integrations` (migration `2026_04_14_000002`)
  — separate from `api_key_hash`. All existing rows backfilled with random 32-byte secrets.
- **`DispatchWebhook` job updated** — `X-Josbin POS-Signature: sha256=HMAC-SHA256(body, webhook_secret)`
  on every outbound call. `X-Josbin POS-Delivery` header added (job ID for debugging).
- **`POST /api/api-keys/{id}/rotate-webhook-secret`** — rotate the secret without
  changing the API key. Returns new secret once; update your receiver before rotating.
- Both `api_key_hash` and `webhook_secret` are hidden from all API responses.

Receivers verify: `hash_hmac('sha256', $rawBody, $secret) === ltrim($header, 'sha256=')`

---

### Product Enhancements

#### Stock Movement Ledger
Full inventory audit trail — every stock change is now recorded and queryable.

- **Migration** `2026_04_14_000003` — `stock_movements` table (append-only):
  `product_id`, `store_id`, `qty_change` (signed), `qty_after` (snapshot), `reason`,
  `sale_id` (nullable), `user_id` (nullable), `notes`, `created_at`
- **`StockMovement` model** — same immutability enforcement as `AuditLog` (updating/deleting blocked)
- **`StockMovementService`** — `record()` uses `lockForUpdate()` to prevent concurrent over-sells,
  atomically updates `stock_qty` and inserts the movement in one transaction.
  Convenience methods: `recordSale()`, `recordVoidOrRefund()`
- **`RecordStockMovements` job** — queued job so stock ledger updates never add latency to
  the POS sale response. Hooked into sale completion, void, and refund.
- **`GET /api/products/{product}/stock-history`** — paginated movement history per product
  for managers. Shows user, sale number, qty change, reason.

---

#### Product Image Upload
Managers can now upload a product photo from the dashboard or POS admin screens.

- **`POST /api/products/{product}/image`** — accepts JPEG, PNG, WebP, GIF (max 2 MB)
- Stored to `storage/app/public/products/{uuid}.{ext}`, accessible via public URL
- Returns `{ image_path, image_url }`. Old image is deleted on re-upload.
- Fully authorised: only users with `update` permission on the product can upload

---

#### Customer CSV Import
Bulk import customers without leaving the dashboard.

- **`POST /api/customers/import`** — accepts CSV file (max 5 MB)
- Required column: `name`. Optional: `phone`, `email`, `id_number`
- WBP-S compliant deduplication: matches existing customers by phone using HMAC hash
  search (never decrypts all records)
- Returns `{ created, updated, skipped, errors[] }` — row-level error reporting
- All imported PII immediately encrypted at rest (WBP-S compliance)

---

#### Discount Rules Engine
Configurable automatic promotions applied at checkout — before BTW calculation,
as required by Belastingdienst Suriname.

- **Migration** `2026_04_14_000004` — `discount_rules` table:
  scope (`product` / `category` / `cart`), type (`pct_discount` / `fixed_discount` / `buy_x_get_y`),
  `min_qty`, `max_discount_srd` cap, `stackable` flag, `valid_from` / `valid_to` window,
  per-store or org-wide
- **`DiscountRuleService`** — evaluates rules in priority order (product → category → cart).
  Supports `buy X get Y free` (e.g. buy 3 get 1 free). Stacking is opt-in per rule.
  Caps absolute discount at configured `max_discount_srd`.
- **Auto-applied in `SaleController`** before BTW calculation. Applied discounts merge with
  any manual line-item or cart discounts entered by the cashier.
- **CRUD API**: `GET/POST /api/discount-rules`, `PUT/DELETE /api/discount-rules/{rule}`

---

#### Multi-Currency Receipt Line
Receipts now show the USD equivalent total as an informational line.

- `ReceiptService::buildViewData()` now computes `total_usd = total_srd / exchange_rate_used`
  using the rate locked on the sale record (not today's rate — the rate at time of sale)
- Shown on PDF receipt as: *"≈ USD 12.50 (@ koers 36.50 SRD/USD)"*
- Bilingual: "koers" (NL) / "rate" (EN)
- Line only appears when `exchange_rate_used` is on the sale record (always true for POS sales)
- **SRD remains the legally binding amount** — USD line is informational only

---

### Testing Foundation

#### k6 Load Test — 10 Concurrent POS Terminals
Verifies the system meets performance targets under real-world load.

- **`tests/load/pos_concurrent.js`** — two scenarios:
  - `pos_terminals`: 10 constant VUs for 5 minutes (sustained POS load)
  - `morning_rush`: ramps to 50 VUs for 1 minute (shift-start spike)
- Full golden path per VU: login → load products → create sale → token refresh (20%) → void (5%)
- **Thresholds** (CI fails if breached):
  - `p(95) < 300ms` for login
  - `p(95) < 200ms` for product load and sale creation
  - `p(95) < 150ms` for token refresh
  - Error rate `< 1%`
- Custom k6 metrics per endpoint for granular reporting
- **`tests/load/seed_load_test.php`** — seeds 10 cashier accounts, 20 Surinamese products,
  1 test store, and today's exchange rate. Outputs the exact `k6 run` command with UUIDs.

---

#### Playwright E2E Tests — Golden Path Coverage
Automated browser tests cover the full user journey from login to Z-report.

| Spec file | What it tests |
|---|---|
| `01_login.spec.ts` | Login success/failure, logout, language toggle |
| `02_pos_sale.spec.ts` | Add products, barcode search, cash sale, BTW on receipt, line discount, hold bill → restore |
| `03_z_report.spec.ts` | X-report (no close), cash reconciliation, discrepancy enforcement, Z-report submit to HQ |
| `04_receipt.spec.ts` | Receipt content, BTW breakdown, USD equivalent line, email receipt trigger |
| `05_dashboard_overview.spec.ts` | Live store cards, org navigation, licence screen, push catalogue |

- Playwright 1.44 with Chromium. Retries on CI (2), screenshots + video on failure.
- Timezone set to `America/Paramaribo`, locale `nl-SR`
- `tests/e2e/package.json` with named npm scripts per spec (`npm run test:sale`, etc.)
- `tests/e2e/helpers/auth.ts` — shared login helpers for cashier and manager accounts

---

### Infrastructure Completed (Carry-over from Previous Session)

| Component | What was built |
|---|---|
| `GET /api/health` | Unauthenticated — checks DB (`SELECT 1`), Redis (PING), Horizon status, disk space. Returns 200 or 503 |
| Docker health checks | All 5 containers (`app`, `reverb`, `horizon`, `scheduler`, `pgbouncer`) have `HEALTHCHECK` directives |
| PgBouncer | Transaction pool mode, 500 max clients, 25 per pool — prevents PostgreSQL connection exhaustion under load |
| Supervisor | `docker/supervisor/supervisord.conf` — auto-restarts Horizon, Reverb, and scheduler on crash |
| Nginx rate limiting | `limit_req_zone` before Laravel: login (5 req/min), API (120/min), export (10/min), health (60/min) |
| `deploy.sh` | Zero-downtime: git pull → composer → migrate → cache → Horizon terminate → PHP-FPM reload → health check |
| `docker/scripts/backup.sh` | `pg_dump \| gzip \| openssl AES-256-CBC` — no plaintext on disk. Sunday restore test. rclone offsite upload. 30-day retention. Alert email on failure. |

---

## Week 6 Delivery Summary

| Area | Delivered |
|---|---|
| New migrations | 4 (`row_hash`, `webhook_secret`, `stock_movements`, `discount_rules`) |
| New models | 3 (`StockMovement`, `DiscountRule`, `AuditLog` Eloquent wrapper) |
| New services | 3 (`AuditHashService`, `StockMovementService`, `DiscountRuleService`) |
| New jobs | 2 (`RecordStockMovements` queued, updated `DispatchWebhook`) |
| New artisan commands | 1 (`audit:verify`) |
| New API endpoints | 8 (`/stock-history`, `/image`, `/customers/import`, `/discount-rules` CRUD, `/rotate-webhook-secret`) |
| Security layers added | 4 (hash chain, single-device, geo-alert, webhook HMAC) |
| Test files | 7 (1 k6 script + seeder, 5 Playwright specs + config) |
| Phase 3 progress | 52 → **72 / 97 tasks** |

---

## Next Week Preview

Week 7 targets the remaining Phase 3 gaps:

- **Product catalogue UI** — full CRUD from the dashboard (list, create, edit, per-store price overrides, image upload)
- **Discount rules UI** — manage promotions from the dashboard
- **Log rotation config** — Nginx + Laravel logs
- **Input sanitisation middleware** — strip null bytes and control characters at the gateway
- **Swagger UI page** — serve RapiDoc visually rendering the OpenAPI spec at `/api-docs`
- **Phase 4 kick-off** — begin PHPUnit integration tests for the new endpoints (customer import, stock history, discount rules, webhook HMAC)
