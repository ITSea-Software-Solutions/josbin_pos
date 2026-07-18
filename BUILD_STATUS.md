# Josbin POS — Build Status

> **Historical document — frozen at 2026-05-25 (session 5).** The living
> feature inventory is [`FEATURES_AND_FLOWS.md`](FEATURES_AND_FLOWS.md); the
> current operational state (infra, access, gating items) is
> [`HANDOVER.md`](HANDOVER.md). Kept for the session-by-session record.

**Last updated:** 2026-05-25 (session 5)
**Version:** Phase 3 complete + Phase 4 prep — multi-cashier concurrency verified end-to-end, per-store stock landed, production-blocker security gaps fixed, docs site live

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Built and wired |
| ⚠️ | Partially built (backend or frontend only, or missing edge cases) |
| ❌ | Not yet built |
| 🔒 | Deferred to Phase 3/4 |

---

## Layer 1 — POS System (Electron / React frontend)

### Authentication & Session
| Feature | Status | Notes |
|---------|--------|-------|
| Login screen (email + password) | ✅ | `LoginScreen.tsx` |
| JWT token auth via Sanctum | ✅ | `authStore.ts` persisted |
| Token expiry enforcement | ✅ | App.tsx checks `expiresAt` |
| Store selection screen | ✅ | `StoreSelectScreen.tsx` |
| Register open gate (opening float) | ✅ | `OpenRegisterGate.tsx` — resume existing session on mount |
| Language toggle (NL/EN instant) | ✅ | i18next, persisted to localStorage |
| Logout | ✅ | Clears token + session |
| Switch store without logout | ✅ | `clearStoreId()` in topbar |

### POS Screen — Product & Cart
| Feature | Status | Notes |
|---------|--------|-------|
| Product grid (tap to add) | ✅ | `ProductGrid.tsx` + `ProductCard.tsx` |
| Category filter bar | ✅ | `CategoryFilter.tsx` |
| Product photo / name / both display | ✅ | Controlled by settings |
| Search bar (name + barcode) | ✅ | In `POSScreen.tsx` |
| USB HID barcode scanner (keyboard wedge) | ✅ | Captures keydown on window |
| Quagga2 camera barcode scanner | ✅ | In `CatalogueScreen` product form; POS relies on USB |
| Manual barcode entry (8–13 chars + Enter) | ✅ | |
| BTW rate per product, auto-calculated | ✅ | `BtwCalculationService` + cart store |
| BTW-exempt flag per product | ✅ | |
| Edit qty / price / BTW / discount per line | ✅ | `LineItemEditModal.tsx` |
| Item-level discount (% or fixed SRD) | ✅ | `DiscountModal.tsx` |
| Sale-level discount (% or fixed SRD) | ✅ | |
| BTW recalculated after all discounts | ✅ | Correct compliance order |
| Hold Bills (save to queue) | ✅ | `HeldBillsPanel.tsx` |
| Load open bill | ✅ | |
| Today's total sales count in topbar | ✅ | Polls every 2 min |
| Add new customer on-the-fly | ✅ | `CustomerModal.tsx` |
| Search existing customer by name/phone | ✅ | |
| Walk-in customer default | ✅ | |

### Payment
| Feature | Status | Notes |
|---------|--------|-------|
| Cash payment (numpad + change calc) | ✅ | `PaymentModal.tsx` |
| Card/PIN payment flow | ✅ | |
| Mixed payment (part cash + part card) | ✅ | |
| Change calculation real-time | ✅ | |

### Receipt
| Feature | Status | Notes |
|---------|--------|-------|
| ESC/POS thermal printer (EPSON TM-T20) | ✅ | `escpos.ts` + `hardware.ts` — network TCP, USB, Windows name |
| Cash drawer kick on cash payment | ✅ | `CASH_DRAWER_1` command in `hardware.ts` |
| PDF receipt (browser print fallback) | ✅ | `ReceiptModal.tsx` |
| Email receipt (bilingual HTML + BTW) | ✅ | `sendReceiptEmail()` → `ReceiptService` → Mailable |
| Receipt customisation (header/footer/logo) | ✅ | Pulled from store settings |
| BTW breakdown on receipt | ✅ | |

### Void / Refund
| Feature | Status | Notes |
|---------|--------|-------|
| Void a completed sale (POS UI) | ✅ | `SalesHistoryScreen.tsx` — search, paginate, void modal with reason |
| Transaction history screen in POS | ✅ | `SalesHistoryScreen.tsx` — date filter, search, pagination |
| Refund flow (POS UI) | ⚠️ | Void exists; partial-amount refund screen deferred Phase 4 |
| Void backend endpoint | ⚠️ | `POST /sales/{sale}/void` — schema (`void_approved_by`) and `sales.void.approve` permission both exist; SRD-threshold trigger for govt dual-approval is still being built — see TODOs in `SaleController::void` |
| Refund backend endpoint | ✅ | `POST /sales/{sale}/refund` |
| Stock restored on void | ✅ | `RecordStockMovements::dispatch` on void |

### Reports (POS)
| Feature | Status | Notes |
|---------|--------|-------|
| Daily Sales report | ✅ | `ReportsScreen.tsx` |
| Monthly Sales report | ✅ | |
| Custom range report | ✅ | |
| X-Report (mid-day snapshot, no close) | ✅ | Tab in ReportsScreen |
| Top Products report | ✅ | |
| Export to PDF | ✅ | |
| Export to CSV | ✅ | |
| Z-Report / End of Day | ✅ | `EndOfDayScreen.tsx` |
| Cash reconciliation (expected vs counted) | ✅ | Via `CloseRegisterModal.tsx` |
| Submit to Headquarters button | ✅ | `EndOfDayScreen.tsx` — per-day confirm modal → `POST /reports/z-report/{id}/submit`, broadcasts `ZReportSubmitted` |

### Register (Till) Management
| Feature | Status | Notes |
|---------|--------|-------|
| Open register with float | ✅ | `OpenRegisterGate.tsx` |
| Close register (cash count + discrepancy) | ✅ | `CloseRegisterModal.tsx` — 6-step flow |
| Request re-open (cashier) | ✅ | Step in CloseRegisterModal |
| Re-open approval in Dashboard | ✅ | `RegistersScreen.tsx` + `ApproveReopenModal` |
| Prevent re-open without manager approval | ✅ | Session status locks POS gate |
| Register CRUD (create/name/deactivate registers) | ✅ | `RegistersScreen.tsx` "Manage" tab — add register form, rename, deactivate. Backend: `createRegister`, `updateRegister`, `destroyRegister` in `RegisterController`. |
| All register activity audit-logged | ✅ | `activity()->log()` on every state change |

### Other POS Screens
| Feature | Status | Notes |
|---------|--------|-------|
| Exchange Rate screen (view/lock/override) | ✅ | `ExchangeRateScreen.tsx` |
| Barcode & Label printing page | ✅ | `BarcodeLabelScreen.tsx` |
| Settings screen | ✅ | `SettingsScreen.tsx` |
| On-screen keyboard toggle | ✅ | `OnScreenKeyboard.tsx` |
| Date format selector (6 options) | ✅ | `utils/date.ts` formatter applied across POS date displays (EndOfDay, ExchangeRate) |

---

## Layer 2 — Super Admin Dashboard (Web)

### Overview & Stores
| Feature | Status | Notes |
|---------|--------|-------|
| Live multi-store overview | ✅ | `DashboardOverview.tsx` — Reverb WebSocket |
| Per-store cards (revenue, transactions, avg basket, top product, sync) | ✅ | |
| Drill down into store transaction list | ✅ | `StoreDetailScreen.tsx` |
| Compare stores side-by-side | ✅ | `StoreComparisonScreen.tsx` — metric switcher, ranked bar chart, detail comparison table |

### Reports
| Feature | Status | Notes |
|---------|--------|-------|
| Consolidated cross-store report | ✅ | `ReportsScreen.tsx` in dashboard |
| BTW consolidated (Belastingdienst format) | ✅ | |
| Export consolidated PDF | ✅ | `DashboardController::exportConsolidated` |
| Export BTW PDF | ✅ | `DashboardController::exportBtw` |
| Rekenkamer audit export (signed PDF) | ✅ | `AuditLogScreen.tsx` → `RekenkamerController` |

### Organisation & Store Management
| Feature | Status | Notes |
|---------|--------|-------|
| Create / edit / deactivate organisations | ✅ | `OrganisationsScreen.tsx` |
| Create / edit / deactivate stores | ✅ | Nested in OrganisationsScreen |
| **Receipt customisation per store (header/footer/logo/BTW nr)** | ✅ | `StoreSettingsScreen` exposes all fields; logo + per-store BTW number now render on PDF/email/ESC-POS receipts |
| Per-store product price overrides | ✅ | `PriceOverridesScreen.tsx` — store selector, override table, add/edit/delete modal |
| Push catalogue to all stores | ✅ | `PriceOverridesScreen.tsx` — "Push catalogue to POS" button → `POST /products/push` → broadcasts `CatalogueRefresh` |

### Product Catalogue
| Feature | Status | Notes |
|---------|--------|-------|
| List / search / filter products | ✅ | `CatalogueScreen.tsx` |
| Create / edit / delete products | ✅ | Modal with all fields incl. BTW, exempt flag |
| CSV import | ✅ | |
| Camera barcode scanner in product form | ✅ | Quagga2 `BarcodeScanModal` |
| Stock adjustment (receive stock, corrections) | ✅ | `StockScreen.tsx` — qty_change input, reason selector, notes, new qty preview. Backend: `stockAdjust()` in `ProductController` |
| Stock movement history | ✅ | `StockScreen.tsx` — movement history modal per product, paginated, reason labels |
| Low stock alerts / thresholds | ✅ | `low_stock_threshold` field on products (migration done). `StockScreen.tsx` "Low stock" tab with alert banner. Filter: `GET /products?low_stock=true` |
| Auto-categorise with AI | ✅ | Backend `AiController` has suggestion endpoint |

### User & Role Management
| Feature | Status | Notes |
|---------|--------|-------|
| Create / edit / deactivate users | ✅ | `UsersScreen.tsx` |
| 6 roles (Super Admin, Org Admin, Store Manager, Cashier, Auditor, API Integration) | ✅ | |
| 2FA enforcement per role | ✅ | `EnsureTwoFactor` middleware |
| **Enforce 2FA requirement per role (policy setting)** | ✅ | `app_settings` policy + `SecurityPolicyController`; Super Admin panel in `UsersScreen`; `User::requires2FA()` reads it |

### Register Management (Dashboard)
| Feature | Status | Notes |
|---------|--------|-------|
| View all sessions per store/date | ✅ | `RegistersScreen.tsx` |
| Approve / deny re-open requests | ✅ | `ApproveReopenModal` |
| Pending requests amber banner + auto-refresh | ✅ | |
| Create / rename / deactivate registers | ✅ | `RegistersScreen.tsx` "Manage" tab — `ManageRegistersPanel` with add form + per-register rename/deactivate |

### Discount Rules
| Feature | Status | Notes |
|---------|--------|-------|
| Discount rules management UI | ✅ | `DiscountRulesScreen.tsx` — full CRUD, active/inactive toggle, `RuleModal` with all fields (%, fixed, min_qty, validity, stackable) |

### Customer Management
| Feature | Status | Notes |
|---------|--------|-------|
| Customer list / search in dashboard | ✅ | `CustomersScreen.tsx` — paginated table, search, avatar initials, spend/visits, edit modal (name/phone/email) |
| Customer created on-the-fly in POS | ✅ | |
| Customer spend + visit count tracking | ✅ | Backend updates on sale |

### AI Features
| Feature | Status | Notes |
|---------|--------|-------|
| Smart product search (pgvector semantic) | ✅ | Backend `AiController` + `AiService` |
| Fraud & anomaly detection (queued job) | ✅ | `DetectSaleAnomaly` job dispatched after each sale |
| Weekly AI sales summary (Monday morning) | ✅ | `GenerateWeeklyAiSummary` command |
| Auto product categorisation suggestion | ✅ | `AiController` endpoint |
| AI insights dashboard screen | ✅ | `AiInsightsScreen.tsx` — weekly summary (stat cards + AI narrative + top products), fraud alerts section with per-alert detail |
| Natural language reports (Phase 2) | 🔒 | Deferred |
| Stock reorder prediction (Phase 2) | 🔒 | Deferred |
| Invoice OCR (Phase 2) | 🔒 | Deferred |

### Z-Report & End of Day
| Feature | Status | Notes |
|---------|--------|-------|
| Z-Report screen with 7-day history | ✅ | `ZReportScreen.tsx` |
| Submit to Headquarters button | ✅ | |
| Sync status per day | ✅ | |

### API Key & Webhooks
| Feature | Status | Notes |
|---------|--------|-------|
| API key create / revoke | ✅ | `ApiKeysScreen.tsx` |
| **Webhook URL configuration in UI** | ✅ | `ApiKeysScreen` "Edit webhook" modal — edit URL/events, rotate signing secret → `PUT /api-keys/{id}` |
| Outbound webhook dispatch (queued) | ✅ | `DispatchWebhook` job |

### License
| Feature | Status | Notes |
|---------|--------|-------|
| License display + expiry warnings | ✅ | `LicenseScreen.tsx` + `LicenseBanner.tsx` |
| License check middleware | ✅ | `EnsureLicenseValid` middleware |
| **License server (separate app)** | ✅ | Built at `/license-server` — issue/activate/validate/renew/revoke, hardware-fingerprint binding, feature tests |
| Hardware fingerprinting | ✅ | `hardware.ts` — MAC + CPU ID + UUID |

---

## Layer 3 — Open Integration API

| Feature | Status | Notes |
|---------|--------|-------|
| POST /v1/sales — third-party sale ingest | ✅ | `V1/SaleController` |
| POST /v1/sales/batch — offline batch | ✅ | Idempotent on `sale_ref` |
| GET report endpoints | ✅ | `V1/ReportController` |
| Outbound webhooks (sale.created, shift.closed, refund.issued) | ✅ | `DispatchWebhook` job |
| API key auth | ✅ | `ValidateApiKey` middleware |
| **OpenAPI / Swagger documentation** | ✅ | `resources/api-docs/openapi.json` served via Swagger UI at `GET /api/v1/docs` |
| Sandbox environment | ✅ | `SandboxSeeder` + `JOSBIN_POS_SANDBOX` flag + `X-Josbin-Environment` header + `docker-compose.sandbox.yml` |

---

## Backend Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Laravel 13 + PHP 8.3 | ✅ | |
| PostgreSQL 16 + pgvector | ✅ | |
| Redis + Laravel Reverb WebSocket | ✅ | |
| Laravel Horizon (queue monitoring) | ✅ | |
| Laravel Telescope (dev debug) | ✅ | |
| Sanctum token auth | ✅ | |
| RBAC (spatie/laravel-permission) | ✅ | |
| Immutable audit log (owen-it/laravel-auditing) | ✅ | |
| BTW calculation service (bcmath precision) | ✅ | `BtwCalculationService` |
| Stock movement service | ✅ | `StockMovementService` + `RecordStockMovements` job |
| Daily rate auto-fetch (06:00 AST) | ✅ | `LockDailyRate` command + scheduler |
| Exchange rate (ExchangeRate-API for SRD) | ✅ | |
| 5-layer offline sync fallback | ✅ | `SyncExportController` — export/import |
| USB encrypted export (Layer 4) | ✅ | `SyncExportController::export` |
| Catch-up sync (Layer 5) | ✅ | |
| IonCube encoding | ❌ | Phase 4 — delivery step |
| Multi-tenancy (stancl/tenancy) | ✅ | |
| Field-level encryption (customer PII) | ✅ | |
| AES-256 at rest | ✅ | Docker + DB config |
| Rate limiting + brute force protection | ✅ | `EnsureLicenseValid`, login throttle |
| Session timeout middleware | ⚠️ | `SessionTimeout` middleware enforces the 12h Sanctum token expiry, but the 15-min POS / 60-min Dashboard **idle** policy (auto-logout while the user is inactive) is not yet implemented — needs a client-side idle timer + `last_activity_at` column |

---

## Gap Summary (session 2 — all P0/P1 resolved)

### ✅ P0 — Resolved this session
| # | Feature | Screen |
|---|---------|--------|
| 1 | Void / transaction history in POS | `SalesHistoryScreen.tsx` |
| 2 | Register CRUD (create/name/deactivate) | `RegistersScreen.tsx` + `RegisterController` |
| 3 | Customer management in Dashboard | `CustomersScreen.tsx` |

### ✅ P1 — Resolved this session
| # | Feature | Screen |
|---|---------|--------|
| 4 | Stock management (receive, adjust, history) | `StockScreen.tsx` + `stockAdjust()` endpoint |
| 5 | Low stock alerts + threshold | `StockScreen.tsx` + migration + `?low_stock=true` filter |
| 6 | AI insights screen | `AiInsightsScreen.tsx` |
| 7 | Per-store price override UI | `PriceOverridesScreen.tsx` |
| 8 | Push catalogue to stores | `PriceOverridesScreen.tsx` → `POST /products/push` |
| 9 | Discount rules management | `DiscountRulesScreen.tsx` |

### ✅ P2 — Resolved this session
| # | Feature | Screen |
|---|---------|--------|
| 10 | Store comparison | `StoreComparisonScreen.tsx` |

### ✅ Session 3 — wiring gaps closed + Phase 3/4 items delivered
| # | Item | Where |
|---|------|-------|
| 1 | Submit-to-HQ Z-Report sync endpoint + POS UI | `ReportController::submitZReport`, `EndOfDayScreen.tsx` |
| 2 | Webhook URL/events editing + secret rotation | `ApiKeysScreen.tsx` "Edit webhook" modal |
| 3 | Date-format selector applied across POS displays | `frontend/src/utils/date.ts` |
| 4 | Per-role 2FA policy (configurable by Super Admin) | `AppSetting`, `SecurityPolicyController`, `UsersScreen.tsx` |
| 5 | Receipt customisation wired to PDF/email/ESC-POS output | `ReceiptService`, receipt blade templates, `ReceiptModal` |
| 6 | OpenAPI / Swagger documentation | `resources/api-docs/openapi.json`, `GET /api/v1/docs` |
| 7 | License server (standalone Laravel 13 app) | `/license-server` |
| 8 | API sandbox environment | `SandboxSeeder`, `docker-compose.sandbox.yml`, `josbin_pos.sandbox` |

### Phase 4 — delivery pipeline (prepared; credential-gated execution)
| # | Item | Status |
|---|------|--------|
| 14 | IonCube encoding | ✅ Pipeline ready — IonCube Loader baked into `docker/php/Dockerfile`; `scripts/encode-ioncube.sh` encodes the backend. Running the encoder needs the paid IonCube licence at delivery time. |
| 15 | Electron code signing | ✅ Config ready — `mac` signing/notarization block + `build/entitlements.mac.plist`; Windows + macOS signing driven by build-time env vars. Needs a code-signing certificate + Apple notarization account at delivery time. Add `frontend/resources/icon.{ico,icns}`. |

Build & delivery runbook: `scripts/README.md`. Dashboard now has CI (`.github/workflows/dashboard.yml`).

### Type-check status (session 3)
- POS frontend (`/frontend`) — `tsc --noEmit` passes clean.
- Dashboard (`/dashboard`) — `tsc --noEmit` passes clean. Pre-existing TypeScript errors in `AuditLogScreen.tsx` (v5 `keepPreviousData` / `as any`), `DashboardOverview.tsx` (unused import), `RegistersScreen.tsx` (non-existent `store_id`) and `store/authStore.ts` (union narrowing) were all fixed.

---

## Session 4 — readiness audit + bug fixes (2026-05-23)

Five parallel static audits (BTW engine, sale flow, migrations/models, boot/config,
API contracts). Bugs found and **fixed this session**:

| Severity | Bug | Fix location |
|----------|-----|--------------|
| Migrate-blocker | `fix_audits_table_for_uuid` altered table `audits`; real table is `audit_logs` — fresh `migrate` failed | `2026_04_13_000001_fix_audits_table_for_uuid.php` |
| Demo-blocker | Cash/card amounts validated but never persisted (`cash_received_srd`/`change_srd`/`card_amount_srd` always NULL) | `SaleController::store` |
| Serious | `.env.example` keys (`EXCHANGE_RATE_*`, `SURAPOS_*`) didn't match config (`EXCHANGERATE_*`, `JOSBIN_POS_*`) | `backend/.env.example` |
| Serious | Fortify/Horizon/Telescope service providers not registered | `bootstrap/providers.php` |
| Serious | BTW `round2/round4` cast money to PHP float | `BtwCalculationService` (now pure bcmath) |
| Serious | Government void could be self-approved | `SaleController::void` |
| Serious | `sale_number` race → duplicate-number failure under concurrent terminals | `Sale::nextNumber` (advisory lock) |
| Serious | USB sync re-import dropped original ids → duplicates; anomaly job bypassed audit hash chain | `SyncExportController`, `DetectSaleAnomaly` |
| Minor | Dead `pushStoreSettings` calling a non-existent route | `dashboard/src/api/organisations.ts` |

All of the above are fixed and verified. The two "still open" items from
session 4 (register_session_id linking, refund stock sign) are both
✅ resolved — see session 5 below.

---

## Session 5 — multi-cashier verification, per-store stock, role hardening (2026-05-25)

Codebase was executed end-to-end for the first time. Two more production
blockers surfaced and were fixed. Several feature gaps closed.

### ✅ Production blockers found + fixed
| Severity | Bug | Fix |
|---|---|---|
| Ship-stopper | `RegisterController` called undefined `activity()` helper at 7 sites — every register open/close 500'd after the DB commit | Replaced with `logRegisterActivity()` writing to canonical `audit_logs` |
| Ship-stopper | `stock_movements.sale_id` was `bigInteger` but `sales.id` is `uuid` — every real sale's queued stock job failed silently | New migration changing column to uuid + FK; 21 retried jobs succeeded; `products.stock_qty` 36→26 correctly after a real sale |
| Security | `ApiIntegrationController`, `DiscountRuleController`, `AiController` had **zero** auth checks — cashiers could create API keys, build 100% discount rules, read business AI summaries | Route-level `can:` middleware on each; new `discount_rules.manage` and `ai.insights` permissions in seeder |
| Security | Dashboard sidebar had 6 nav items with no role filter — cashier saw Users / API Keys / Z-Reports etc. | Every nav item now declares explicit `roles`; cashier is routed straight to "My Account" |

### ✅ Multi-cashier concurrency verified
Two cashiers, two registers, 10 parallel sales of the same product:
- 10 unique sale_numbers (advisory lock holds)
- Cashier attribution + register_session_id correct on every row
- Per-store stock decremented atomically; no overselling between branches

### ✅ Per-store stock — architecture upgrade
- New `product_stocks(product_id, store_id, stock_qty, low_stock_threshold)` table
- Backfilled from `products.stock_qty` per (product × store) within the same org
- `StockMovementService::record` now locks the per-(product, store) row, not the global product row
- `Product::stockForStore($storeId)`, `lowStockThresholdForStore($storeId)`
- POS, byBarcode, low-stock query, manual stock-adjust all use per-store stock
- `products.stock_qty` kept as "default initial stock for a new store"

### ✅ Feature additions
| # | Feature | Where |
|---|---|---|
| 1 | **My Account** for every role — Profile + My Performance + My Shifts | `MyAccountScreen.tsx`, `/api/me/*` (4 endpoints) |
| 2 | **Excel import** (.xlsx, .xls) for product catalogue + XLSX template download | `ProductController::import` + `CatalogueImportExportScreen` |
| 3 | **Demo stack** isolated from live (own DB, own ports, yellow banner) | `docker-compose.demo.yml`, `JOSBIN_POS_DEMO_MODE` flag, `/api/environment` |
| 4 | **Close + Restart buttons** in POS Settings (Manager+) with cart/sync safety checks | `SystemActions.tsx`, `app:quit` / `app:restart` IPC |
| 5 | **VitePress docs site** for /docs and /user_manual at `http://localhost:5180` | `docs-site/` |
| 6 | **42 categories** seeded by default for any new organisation | `CategoriesSeeder` |
| 7 | **Org Admin** seeded (`orgadmin@dehoop.sr`) so HQ workflow is testable out of the box | `DevelopmentDataSeeder` |
| 8 | User manual **Chapter 3 — Your Register** (open / close / reopen flow); 3→13 renumbered | `user_manual/03-register.md` |
| 9 | POS UX: auto-select single register, require note when cash count mismatches | `OpenRegisterGate`, `CloseRegisterModal` |
| 10 | Documentation site stubs for the 12 unwritten dev chapters (no more 404s) | `docs/02-13.md` |

### ⏳ Still open (this session's residue)
- **#20** — Dashboard manual chapter on roles + permissions (the user-facing doc, plain English for HQ admins)
- **#5** — dev docs chapters 2–13 still stubs; needs real content

### ✅ Cross-store / cross-org data leakage audit (just-now) — 2 leaks found + fixed

| Bug | Evidence | Fix |
|---|---|---|
| `SaleController::index` took any `store_id` without checking it belongs to the caller's org — a De Hoop cashier got HTTP 200 querying Diago's sales | `curl /api/sales?store_id=<diago-store>` as kassa@dehoop.sr | New `App\Rules\StoreBelongsToOrg` validation rule on every `store_id` request input across 9 controllers (Sale, Report, Register, Product, Ai, ApiIntegration, DiscountRule, Rekenkamer, SyncExport). Cross-org probes now 422 with clear message. |
| `SalePolicy::view` returned true for any user with `sales.view` — a cashier could GET `/api/sales/{uuid}` for another organisation's sale and read it | curl /api/sales/{diago-sale-uuid} as kassa@dehoop.sr would 200 | Added `ownsSale()` check that requires `$sale->store->organisation_id === $user->organisation_id`. Same guard added to `void` and `refund` policies. Super Admin still bypasses via the existing `before()`. |

Same-store cashier-to-cashier visibility (kassa@ → kassa2's sale) was deliberately left at 200 — that's normal retail (managers need it, end-of-day Z-Report relies on it). The fix targets the leak across organisations, not within stores.

Customers were already org-isolated (verified: 41 returned to De Hoop, 0 to Diago).

---

## What is fully production-ready

**POS System:**
- Full sale flow (products → discounts → payment → receipt print + email)
- BTW calculation (all edge cases, BTW-exempt, after discounts — bcmath precision)
- Register open/close/reopen with manager approval
- Hold Bills (React 19 Activity API)
- Transaction history + void with reason
- Customer lookup and on-the-fly creation
- Exchange rate daily lock + manual override
- Barcode scanning (USB HID + Quagga2 camera)
- Barcode & label printing (EAN-13, Code 128, QR)
- All POS reports (daily/monthly/custom/X/Z) — PDF + CSV export
- On-screen keyboard, date format selector, settings

**Dashboard:**
- Dashboard login with 2FA
- Live multi-store overview with WebSocket (Reverb)
- Per-store drill-down (transactions, revenue, BTW)
- Store comparison (bar chart + detail table)
- Customer management (list, search, edit)
- Stock management (adjust, receive, movement history, low stock alerts)
- Product catalogue (create/edit/delete/CSV import, AI categorisation)
- Per-store price overrides + push catalogue to all POS terminals
- Discount rules (full CRUD, active/inactive toggle)
- Consolidated + BTW reports with PDF export (Belastingdienst format)
- Rekenkamer audit export (signed PDF + CSV)
- Z-Report / End of Day submit to HQ
- Register management (sessions, approve/deny reopen, create/rename registers)
- Organisation + store management
- User + role management (6 roles, 2FA enforcement)
- Audit log with full history (immutable, append-only)
- AI insights (fraud alerts, weekly summaries)
- License banner + expiry enforcement
- 5-layer offline sync (including USB AES-256 export/import)

**Backend / API:**
- AI anomaly detection + weekly summary (backend + display)
- Open Integration API v1 (third-party sale ingest, batch, reports)
- Outbound webhooks (queue-backed with retry)
- Multi-tenancy (stancl/tenancy, database-per-tenant)
