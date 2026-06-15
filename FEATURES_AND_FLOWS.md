# Josbin POS — Features & Flows

> **Audience:** Claude (current + future) and human teammates onboarding to the codebase.
> **Purpose:** Single index of *what the system does*, *who uses it*, *how the flow works*, and *what's built vs planned*.
> **Companion files:**
>  - [`CLAUDE.md`](CLAUDE.md) — product spec, requirements, tech stack (the *what we're building and why*).
>  - [`CLAUDE_WORKING_GUIDE.md`](CLAUDE_WORKING_GUIDE.md) — engineering discipline, surfaces checklist, gotcha registry (the *how we work*).
>  - This file — feature catalogue + user-journey flows (the *what exists and how it flows*).
>
> **Living doc.** Every new feature: add a row to the inventory + a flow (if it crosses ≥2 screens) + cross-refs to code/docs. Update §11 changelog with the date.

---

## §0 Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Fully built + tested + documented |
| 🟡 | Partial — code exists, gaps in tests / docs / UI / role coverage |
| 🔲 | Planned — in CLAUDE.md spec, not yet implemented |
| ⛔ | Out of scope (kept here so we don't keep re-asking) |

When updating status, walk [`CLAUDE_WORKING_GUIDE.md` §2 surfaces checklist](CLAUDE_WORKING_GUIDE.md) — promote 🟡 → ✅ only when *every* surface is covered.

---

## §1 Feature inventory

### 1.1 Authentication & session

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| AUTH-01 | Password login + Sanctum token | ✅ | All | `AuthController::login` | `dashboard_manual/03 §3.8`, `user_manual/01` |
| AUTH-02 | TOTP 2FA (Google Authenticator) | ✅ | Super Admin mandatory; per-role policy for rest | `AuthController::twoFactorChallenge/Setup/Confirm` | `dashboard_manual/03 §3.9` |
| AUTH-03 | Per-role 2FA policy (SA configures which roles must use 2FA) | ✅ | SA only | `SecurityPolicyController` | `dashboard_manual/17` |
| AUTH-04 | Recovery codes (8, single-use) | ✅ | Any user with 2FA | `AuthController::twoFactorConfirm` | `dashboard_manual/17 §17.4` |
| AUTH-05 | Geo-alert for government login from outside Suriname | ✅ | Govt accounts | `AuthController::checkGeoAlert` | `dashboard_manual/17 §17.7` |
| AUTH-06 | Single-device enforcement for govt accounts | ✅ | Govt accounts | `AuthController::handlePostLoginChecks` | `dashboard_manual/17 §17.6` |
| AUTH-07 | Token rotation (`/auth/refresh`) | ✅ | All | `AuthController::refresh` | — |
| AUTH-08 | Logout / logout-all-devices | ✅ | All | `AuthController::logout(All)` | `dashboard_manual/18 §18.4` |
| AUTH-09 | Rate limiting + progressive lockout | ✅ | All | `AuthController::login` + `RateLimiter` | `dashboard_manual/17 §17.3` |
| AUTH-10 | Passkey login (WebAuthn) | 🔲 | SA + govt (planned) | — | CLAUDE.md §security |
| AUTH-11 | Forced re-login on role change | ✅ | All | `UserController::update` (revokes tokens) | — |

### 1.2 Organisation & user management

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| ORG-01 | Create / edit / deactivate organisation | ✅ | SA | `OrganisationController` | `dashboard_manual/02` |
| ORG-02 | Read-only org header for OA / SM | ✅ | OA / SM (view only) | `StoresScreen.tsx` | `dashboard_manual/02 §2.4` |
| ORG-03 | Create / edit / deactivate store (under org) | ✅ | SA, OA | `OrganisationController::storeCreate`, `StoreController::update` | `dashboard_manual/02 §2.5` |
| ORG-04 | Licence-gated store creation (LICENSE_REQUIRED / EXPIRED / LIMIT_REACHED) | ✅ | OA blocked when gate fails | `OrganisationController::storeCreate` | this doc §4.3 + G-007 |
| ORG-05 | Per-store receipt template (logo + header + footer) | ✅ | SA, OA, SM | `StoreController::update`, `uploadLogo` | `dashboard_manual/02 §2.7` |
| USER-01 | Create / edit / deactivate user with role | ✅ | SA, OA, SM (manageable subset only) | `UserController` | `dashboard_manual/03` |
| USER-02 | Strict 1:1 user-to-store pin (cashier + store_manager) | ✅ | OA, SM (create), SA (any) | `UserController::store/update` + `User::canAccessStore` | `dashboard_manual/01 §1.3 ‡`, `dashboard_manual/03 §3.2.1` |
| USER-03 | Org-scoped roles ignore `store_id` | ✅ | SA, OA, auditor, api_integration | `User::isOrgScopedRole` | `dashboard_manual/01 §1.3` |
| USER-04 | Welcome email with credentials | 🟡 | SA, OA | `UserController::store` (`send_welcome_email` flag, no actual mail send yet) | `dashboard_manual/03 §3.2` |
| USER-05 | Reset 2FA on a user | ✅ | SA, OA | `UserController::reset2fa` | `dashboard_manual/03 §3.10` |
| USER-06 | View licence info on user row | ✅ | SA only | `UserController::index` (`org_license`) | this doc §4.3 |
| USER-07 | My Account — Profile + password (every role) | ✅ | All | `MeController::profile/password` + `MyAccountScreen ProfileTab` | `dashboard_manual/18` |
| USER-08 | My Account — Performance + Shifts tabs (ring-up roles only) | ✅ | Cashier + Store Manager only | `MeController::salesSummary/shifts` + `MyAccountScreen` role gate | `dashboard_manual/18` (gated since G-015) |
| USER-09 | My Account — Activity log (own logins, own audit trail) | ✅ | All roles | `MeController::activity` + `ActivityTab` in `MyAccountScreen` | task #72 |
| USER-10 | My Account — Active sessions + revoke (with audit log) | ✅ | All roles | `MeController::sessions/revokeSession` + `SessionsTab` | task #72 |

### 1.2b BTW filings to Belastingdienst Suriname (new)

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| BTW-FILING-01 | `tax_inspector` role — cross-organisation, read-only, BTW-only | ✅ | New role | `User::ROLE_TAX_INSPECTOR` + `RolesAndPermissionsSeeder` | G-018 in CLAUDE_WORKING_GUIDE |
| BTW-FILING-02 | Mandatory 2FA for tax_inspector (government account) | ✅ | tax_inspector | `User::TWO_FACTOR_ALWAYS_ROLES` | dashboard_manual/17 |
| BTW-FILING-03 | Daily BTW submission | ✅ | OA, SM | `BtwSubmissionController::store` | §3.8 journey |
| BTW-FILING-04 | Monthly BTW submission (formal filing) | ✅ | OA, SM | `BtwSubmissionController::store` | §3.8 |
| BTW-FILING-05 | Preview totals before filing (dry-run) | ✅ | OA, SM | `BtwSubmissionController::preview` | UI: SubmitBtwModal |
| BTW-FILING-06 | Snapshot totals at filing time (never recomputed) | ✅ | Auto | `BtwSubmissionService::computeTotals` | migration comment |
| BTW-FILING-07 | Sale-ID traceability per filing (jsonb array) | ✅ | Auto | `btw_submissions.sale_ids` | — |
| BTW-FILING-08 | Auto-generated filing reference (BTW-YYYY-MM-ORG-DAY-NNN) | ✅ | Auto | `BtwSubmissionService::nextReference` | — |
| BTW-FILING-09 | Idempotency: one filing per (org, period_type, range) | ✅ | Auto | unique constraint + 409 BTW_ALREADY_FILED | — |
| BTW-FILING-10 | Tax inspector accept / dispute workflow | ✅ | tax_inspector + SA | `BtwSubmissionController::accept/dispute` | — |
| BTW-FILING-11 | Hash chain (tamper-evident, continues audit trail pattern) | ✅ | Auto | `BtwSubmissionService::hashChain` | — |
| BTW-FILING-12 | Cross-org list for inspector + SA; own-org for OA/SM | ✅ | All BTW roles | `BtwSubmissionController::index` policy scope | — |
| BTW-FILING-13 | Audit log entries for every transition (`btw.submitted/accepted/disputed`) | ✅ | Auto | controller writes `audit_logs` | — |
| BTW-FILING-14 | Resubmission via `superseded` status (recompute totals, audit-logged) | ✅ | OA, SM (own org only) | `BtwSubmissionController::supersede` + `ResubmitModal` + partial unique idx | task #80 |
| BTW-FILING-15a | Tax Inspector dashboard — KPI landing with month-over-month BTW, pending review, disputed open, 30-day trend, top orgs, late-filings alert | ✅ | tax_inspector, SA, OA (scoped) | `BtwSubmissionController::inspectorDashboard` + `TaxInspectorDashboard.tsx` | task #82 |
| BTW-FILING-15b | Submission detail view — per-store + per-source-POS + per-payment-method + per-BTW-rate breakdowns + audit timeline | ✅ | All BTW viewers | `BtwSubmissionController::detail` + `BtwSubmissionDetailScreen.tsx` | task #82 |
| BTW-FILING-15c | Enhanced filters on list — org dropdown, source POS (josbin / external API), search by reference or org, clear-all | ✅ | All BTW viewers | `BtwSubmissionController::index` + `BtwSubmissionsScreen.tsx` filter bar | task #82 |
| BTW-FILING-15d | Click-row → detail navigation + click-tile-on-dashboard → list-with-filter navigation | ✅ | All BTW viewers | `DashboardLayout.tsx` `openSubmissionDetail` + `openBtwListWithFilter` | task #82 |
| BTW-FILING-15e | Source POS attribution visible to inspector (Josbin native vs Layer-3 third-party API contributors per filing) | ✅ | tax_inspector, SA | `sales.source` already on schema; aggregated in detail endpoint | task #82 (future-proof for non-Josbin POS integrators) |
| BTW-FILING-15 | Belastingdienst PDF export of accepted filings | 🔲 | tax_inspector | — | future |
| BTW-FILING-16 | Late-filing alerts (overdue monthly) | 🔲 | OA + SA | — | future |

### 1.3 Licence management

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| LIC-01 | Issue licence (in-dashboard, Path B) | ✅ | SA | `LicenseController::store` | `dashboard_manual/15 §15.5` |
| LIC-02 | List / edit / revoke licence | ✅ | SA (all); OA (own org) | `LicenseController::index/update/destroy` | `dashboard_manual/15 §15.6` |
| LIC-03 | Licence renewal request workflow | ✅ | OA, SA | `LicenseController::renew` | `dashboard_manual/15 §15.8` |
| LIC-04 | Renewal status banners (warning_30 / 14 / grace / soft_lock / hard_lock) | ✅ | All | `License::computeRenewalStatus` | `dashboard_manual/15 §15.4` |
| LIC-05 | Hardware fingerprint binding (MAC + CPU + UUID) | 🟡 | POS install | columns exist, no binding yet | CLAUDE.md §licensing |
| LIC-06 | Daily validation against licence server (24h + 72h offline grace) | 🔲 | All POS installs | scheduler hook planned | CLAUDE.md §licensing |
| LIC-07 | Soft-lock blocks new sales | 🟡 | Cashier | `License::isSoftLocked` exists, not yet wired into `SaleController` | CLAUDE.md §licensing |
| LIC-08 | Hard-lock blocks login | 🔲 | All | — | CLAUDE.md §licensing |
| LIC-09 | Licence certificate generator (printable / email) | ✅ | SA | `LicenseScreen.tsx::buildLicenseSummary` | `dashboard_manual/16 §16.3` |
| LIC-10 | Separate licence server app | 🔲 | Vendor (us) | `license-server/` placeholder | CLAUDE.md §licensing |

### 1.4 Catalogue & inventory

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| CAT-01 | Product CRUD (centralised by default) | ✅ | OA, SM | `ProductController` | `dashboard_manual/04` |
| CAT-02 | Category CRUD (icon + sort_order + i18n) | ✅ | OA | `CategoryController` | `dashboard_manual/04 §4.5` |
| CAT-03 | Per-product BTW rate + exempt flag | ✅ | OA | `ProductController::store` | `dashboard_manual/04 §4.3` |
| CAT-04 | Per-store price override | ✅ | OA | `PriceOverrideController` | `dashboard_manual/06` |
| CAT-05 | Bulk import (CSV) | ✅ | OA | `ProductController::import` | `dashboard_manual/05 §5.3` |
| CAT-06 | Bulk import (Excel/XLSX) | ✅ | OA | `ProductController::import` | `dashboard_manual/05 §5.4` |
| CAT-07 | Import template download | ✅ | OA | `ProductController::importTemplate` | `dashboard_manual/05 §5.2` |
| CAT-08 | 📡 Push catalogue to POS (WebSocket broadcast) | ✅ | OA | `ProductController::push` → Reverb | `dashboard_manual/04 §4.8` |
| CAT-09 | Product image upload (JPEG/PNG/WebP, 2 MB max) | ✅ | OA | `ProductController::uploadImage` | `dashboard_manual/04 §4.6` |
| CAT-10 | Per-store stock via `product_stocks` table | ✅ | OA, SM | `StockMovementService`, `product_stocks` migration | `dashboard_manual/08` |
| CAT-11 | Stock movement ledger (append-only, decremented in the sale transaction) | ✅ | All (auto) | `StockMovementService::recordSale` (in-txn for sales; `RecordStockMovements` job still used for void/refund) | `dashboard_manual/08 §8.3` |
| CAT-11b | Oversell policy per org (`block_oversell`, default OFF = allow + track negative) | ✅ | OA, SA | `organisations.block_oversell`, `InsufficientStockException`, Organisations → edit toggle | G-020 |
| CAT-12 | Stock-history endpoint per product | ✅ | OA, SM | `ProductController::stockHistory` | `dashboard_manual/08 §8.4` |
| CAT-13 | Low-stock threshold (`low_stock_threshold` per product) | ✅ | OA | `ProductController::store/update` | `dashboard_manual/08 §8.7` |
| CAT-14 | Low-stock alert badge on dashboard | ✅ | OA, SM | `ProductsTable.tsx` | `dashboard_manual/08 §8.7` |
| CAT-15 | Low-stock badge on POS product grid | 🟡 | Cashier | `useLowStockSet` hook exists; POS docs missing | task #66 |
| CAT-16 | Discount rules (product / category / cart) | ✅ | OA | `DiscountRuleController` + `DiscountRuleService` | `dashboard_manual/07` |
| CAT-17 | Barcode scanner — USB HID (keyboard wedge) | ✅ | Cashier | Auto via input field listener | `user_manual/04 §4.7` |
| CAT-18 | Barcode scanner — camera (Quagga2) | ✅ | Cashier | `lib/quaggaBarcode.ts` | `user_manual/04 §4.8` |
| CAT-19 | Bulk barcode label printing | ✅ | OA, SM | `BarcodeLabelScreen.tsx` | `user_manual/12` |

### 1.5 POS — register & sales

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| POS-01 | Auto-route to single assigned store (skip picker) | ✅ | Cashier, SM | `StoreSelectScreen` (auto-pick when N=1) | `user_manual/01 §1.3` |
| POS-02 | Open register with cash float | ✅ | Cashier | `RegisterController::open` | `user_manual/03 §3.2` |
| POS-03 | Auto-select single register on open | ✅ | Cashier | `OpenRegisterGate.tsx` | `user_manual/03 §3.2.1` |
| POS-04 | Multi-cashier concurrent selling on different registers | ✅ | Cashier | `register_sessions` row per cashier | tested in task #17 |
| POS-05 | Register session close (per-shift) | ✅ | Cashier | `RegisterController::sessions.close` | `user_manual/03 §3.5` |
| POS-06 | Manager re-opens closed register for next shift | ✅ | SM, OA | `RegisterController::approveReopen` | `user_manual/03 §3.6` |
| POS-07 | Add to cart by tap / barcode / search | ✅ | Cashier | `POSScreen.tsx`, `cartStore.ts` | `user_manual/04` |
| POS-08 | Edit line price / qty / BTW / discount mid-sale | ✅ | Cashier | `cartStore.ts::updateLineItem` | `user_manual/04 §4.6` |
| POS-09 | Item-level discount (% or fixed SRD) | ✅ | Cashier | `cartStore.ts` | `user_manual/08 §8.3` |
| POS-10 | Sale-level discount (% or fixed SRD) | ✅ | Cashier | `cartStore.ts` | `user_manual/08 §8.4` |
| POS-11 | Cash payment + numpad + change calc | ✅ | Cashier | `PaymentModal.tsx` | `user_manual/05 §5.2` |
| POS-12 | Card/PIN payment | ✅ | Cashier | `PaymentModal.tsx` | `user_manual/05 §5.3` |
| POS-12a | Card payment reconciliation fields (bank / approval / last-4 / terminal ref) | ✅ | Cashier | `PaymentModal.tsx` 'card' step + `Sale` model | task #77 / migration 2026_05_26_040001 |
| POS-13 | Mixed payment (cash + card) | ✅ | Cashier | `PaymentModal.tsx` | `user_manual/05 §5.4` |
| POS-13a | Mixed-payment reconciliation panel (collapsible, when card portion > 0) | ✅ | Cashier | `PaymentModal.tsx` mixed step | task #77 |
| POS-13b | `bank_transfer` payment method (B2B / government invoiced sales) | ✅ | Cashier | `PaymentModal.tsx` bank_transfer step + `Sale::PM_BANK_TRANSFER` | task #78 |
| POS-13c | `mobile_transfer` payment method (DSB Mobiel, Hakrinbank Online, etc.) | ✅ | Cashier | `PaymentModal.tsx` mobile_transfer step | task #78 |
| POS-13d | `foreign_cash` payment method (USD/EUR with locked daily rate) | ✅ | Cashier | `PaymentModal.tsx` foreign_cash step | task #78 |
| POS-13e | Pending-payments queue + OA confirmation flow (with audit log) | ✅ | OA, SA | `PendingPaymentsScreen.tsx` + `SaleController::confirmPayment` | task #78 |
| POS-13f | `qr_payment` scaffolding — enum + qr_payload column + lifecycle | 🟡 | Backend only | `Sale::PM_QR_PAYMENT`, migration 060001 | task #79; POS UI pending real PSP |
| POS-13g | QR webhook endpoint stub (HMAC-ready, feature-flagged off) | 🟡 | PSP partners | `QrPaymentWebhookController` + `qr_webhooks_enabled` config | task #79; activates once a Surinamese PSP integrates |
| POS-14 | ESC/POS thermal receipt print | ✅ | Cashier | `lib/escpos.ts`, `lib/hardware.ts` | `user_manual/06 §6.2` |
| POS-15 | Cash drawer pulse on cash sale | ✅ | Cashier | `lib/escpos.ts::openCashDrawer` | README §printer-cash-drawer |
| POS-15a | Manual cash in/out (pay-in / pay-out) during shift → adjusts Z-Report expected cash | ✅ | Cashier, SM | `CashMovementModal.tsx` → `RegisterController::recordCashMovement` + `CashMovement` model | migration 2026_06_12_000001 |
| POS-16 | PDF receipt download | ✅ | Cashier, SM | `SaleController::receiptPdf` | `user_manual/06 §6.4` |
| POS-17 | Email receipt (bilingual HTML) | ✅ | Cashier | `SaleController::emailReceipt` | `user_manual/06 §6.5` |
| POS-18 | Hold bill / restore later | ✅ | Cashier | `SaleController::hold/held` + Activity API pre-render | `user_manual/09` |
| POS-19 | Void sale (manager approval) | ✅ | SM+ | `SaleController::void` + `SalePolicy::void` | `user_manual/04 §4.10` |
| POS-20 | Refund sale (partial or full) | ✅ | SM+ | `SaleController::refund` + `RefundModal.tsx` | task #65 (user_manual coverage pending) |
| POS-20a | Return without original sale (blind return) — manager-gated, BTW extracted, stock restored, heavily audited | ✅ | SM+ | `SaleController::blindReturn` + `BlindReturnModal.tsx` (cart → negative sale) | audit event `sale.blind_return` |
| POS-21 | On-the-fly customer add (name / phone / email) | ✅ | Cashier | `CustomerController::store` | `user_manual/07 §7.3` |
| POS-22 | Today's sales total + count on POS toolbar | ✅ | Cashier | `MeController::salesSummary` | `user_manual/04 §4.2` |
| POS-23 | Language toggle (NL ↔ EN) instant | ✅ | All | `i18n.ts` | `user_manual/13 §13.1` |
| POS-24 | On-screen keyboard toggle (touchscreen) | ✅ | All | `OnScreenKeyboard.tsx` | `user_manual/13 §13.4` |
| POS-25 | POS auto-launch on system boot | ✅ | All | `electron/main.ts` + Settings toggle | task #25 (user_manual coverage pending) |
| POS-26 | Close + Restart buttons (manager-gated) | ✅ | SM+ | `SettingsScreen.tsx` System tab | task #66 (user_manual coverage pending) |
| POS-27 | Settings persist per-device | ✅ | All | `settingsStore.ts` (localStorage) | `user_manual/13` |
| POS-28 | Daily USD→SRD rate lock screen | ✅ | SM | `RateController` + `RateScreen.tsx` | `user_manual/02 §2.3` |
| POS-29 | Manual rate override | ✅ | SM | `RateController::override` | `user_manual/02 §2.4` |

### 1.6 Reports

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| REP-01 | Daily sales report (per store) | ✅ | All but cashier | `ReportController::daily` | `user_manual/11 §11.2`, `dashboard_manual/10 §10.1` |
| REP-02 | Monthly sales report | ✅ | All but cashier | `ReportController::monthly` | `dashboard_manual/10 §10.2` |
| REP-03 | Custom date-range report | ✅ | All but cashier | `ReportController::custom` | `dashboard_manual/10 §10.3` |
| REP-04 | Top products by revenue | ✅ | All but cashier | `ReportController::topProducts` | `dashboard_manual/10 §10.5` |
| REP-05 | X-Report (mid-day snapshot, no close) | ✅ | SM, cashier (own) | `ReportController::xReport` | `user_manual/11 §11.6`, `dashboard_manual/10 §10.5.5` |
| REP-06 | Z-Report (end-of-day close + cash recon) | ✅ | SM | `ReportController::zReport` + `ZReportController` | `user_manual/10`, `dashboard_manual/11` |
| REP-07 | Z-Report 7-day history | ✅ | SM, OA, SA | `ReportController::zReportHistory` | `dashboard_manual/11 §11.3` |
| REP-08 | Z-Report submit to HQ (manual force-sync) | ✅ | SM | `ReportController::zReportSubmit` | `dashboard_manual/11 §11.5` |
| REP-09 | BTW report (per-store, Belastingdienst format) | ✅ | SM, OA | `ReportController::btwReport` | `dashboard_manual/10 §10.4` |
| REP-10 | BTW report (consolidated cross-store) | ✅ | OA, SA | `DashboardController::consolidatedBtw` | `dashboard_manual/10 §10.4.2` |
| REP-11 | Rekenkamer audit export (signed PDF + CSV) | ✅ | SA, OA, Auditor | `RekenkamerController` | `dashboard_manual/10 §10.6` |
| REP-12 | PDF / CSV export of any report | ✅ | All but cashier | `ReportController::export` | `dashboard_manual/10 §10.7` |
| REP-13 | Cross-store consolidated dashboard (live SRD totals via WebSocket) | ✅ | SA, OA | `DashboardController::summary` + Reverb | `dashboard_manual/10 §10.8` |
| REP-14 | Custom product report builder | 🟡 | SM, OA | basic version exists; advanced filters pending | `dashboard_manual/10 §10.9` |
| REP-15 | Payment-method × bank/provider breakdown on daily / monthly / custom reports | ✅ | All but cashier | `ReportController::buildRangeSummary` `bank_breakdown` + per-method totals | task #81 |
| REP-16 | Platform Overview panel for Super Admin (cross-tenant KPIs, licence health buckets, BTW pending, next-expiring, recent SA actions) | ✅ | Super Admin only | `DashboardController::platformOverview` + `PlatformOverviewPanel` | task #73 |

### 1.7 Sync & offline (5-layer fallback)

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| SYNC-01 | Layer 1 — Real-time sync (every sale → cloud within seconds) | ✅ | Auto | `DispatchWebhook` queued job + Reverb | `dashboard_manual/11 §11.5.1` |
| SYNC-02 | Layer 2 — Auto retry (1m / 5m / 15m / 30m schedule) | ✅ | Auto | `DispatchWebhook` retry config | task #43 |
| SYNC-03 | Layer 3 — Z-Report forced retry | ✅ | SM | `ZReportController::submit` | `dashboard_manual/11 §11.5.3` |
| SYNC-04 | Layer 4 — USB encrypted export (.josbin_pos file, AES-256) | ✅ | SM | `SyncExportController::export/import` | `dashboard_manual/11 §11.5.4` |
| SYNC-05 | Layer 5 — Catch-up sync on internet restore | ✅ | Auto | scheduler + `register_sessions.synced_at` | `dashboard_manual/11 §11.5.5` |
| SYNC-06 | Mobile data dongle fallback (Digicel/Telesur 4G) | 🔲 | Local server setup | doc only; no app code needed | CLAUDE.md §offline |
| SYNC-07 | Offline sale buffering (POS keeps selling without internet) | ✅ | Auto | `sales` written locally; sync layer pushes later | task #43 |

### 1.8 Open Integration API (Layer 3)

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| API-01 | API key issuance + rotation | ✅ | OA, SA | `ApiIntegrationController` | `dashboard_manual/12 §12.3` |
| API-02 | `POST /v1/sales` — single sale push | ✅ | API key | `Api/V1/SaleController::store` | `dashboard_manual/12 §12.5`, OpenAPI `/api/v1/docs` |
| API-03 | `POST /v1/sales/batch` — batch upload (idempotent via `external_sale_ref`) | ✅ | API key | `Api/V1/SaleController::batch` | `dashboard_manual/12 §12.6` |
| API-04 | `GET /v1/reports/sales` — third-party pulls own data | ✅ | API key | `Api/V1/ReportController` | `dashboard_manual/12 §12.7` |
| API-05 | Outbound webhooks (sale.created, shift.closed, refund.issued) | ✅ | Auto | `DispatchWebhook` queued job | `dashboard_manual/12 §12.8` |
| API-06 | HMAC webhook signing (`X-JosbinPOS-Signature: sha256=…`) | ✅ | Auto | `DispatchWebhook::sign` | `dashboard_manual/12 §12.8.2` |
| API-07 | Webhook secret rotation | ✅ | OA | `ApiIntegrationController::rotateWebhookSecret` | `dashboard_manual/12 §12.9` |
| API-08 | OpenAPI 3.0 spec auto-generated | ✅ | Public | `routes/api.php` `/api/v1/openapi.json` | `/api/v1/docs` Swagger UI |
| API-09 | Per-API-key rate limiting (1000/min) | ✅ | Auto | Sanctum middleware | `dashboard_manual/12 §12.10` |
| API-10 | Sandbox environment (separate stack, `X-Josbin-Environment: sandbox`) | ✅ | Integration testing | `docker-compose.sandbox.yml` | `dashboard_manual/12 §12.4` |

### 1.9 AI Layer

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| AI-01 | Smart product search (pgvector semantic) | 🟡 | Cashier | `products.embedding` column exists; query helper basic | `dashboard_manual/14 §14.2` |
| AI-02 | Fraud anomaly detection (queued post-sale) | 🟡 | Auto, OA dashboard | `DetectSaleAnomaly` job stub | `dashboard_manual/14 §14.3` |
| AI-03 | Weekly AI sales summary | 🔲 | OA, SM | planned scheduler | `dashboard_manual/14 §14.4` |
| AI-04 | Auto product categorisation + BTW suggestion on add | 🔲 | OA | planned hook in `ProductController::store` | `dashboard_manual/14 §14.5` |
| AI-05 | Natural-language reports (Phase 2) | 🔲 | OA, SM | — | CLAUDE.md §AI |
| AI-06 | Stock reorder prediction (Phase 2) | 🔲 | OA, SM | — | CLAUDE.md §AI |
| AI-07 | Invoice OCR (Phase 2) | 🔲 | OA | — | CLAUDE.md §AI |

### 1.10 Audit & compliance

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| AUD-01 | Append-only audit log (DB-level no-delete) | ✅ | Auto | `audit_logs` table + spatie/laravel-auditing | `dashboard_manual/13` |
| AUD-02 | Audit log viewer (filters, search, JSON diff) | ✅ | SA, OA, Auditor | `AuditLogController` + `AuditLogScreen.tsx` | `dashboard_manual/13` |
| AUD-03 | SHA-256 hash chain (tamper-evidence) | ✅ | Auto | `AuditHashService` + `audit:verify` artisan | `dashboard_manual/13 §13.5` |
| AUD-04 | Successful-login audit events | ✅ | Auto | `AuthController::login` `auth.login_success` | task #57 |
| AUD-05 | Store-assignment change audit | ✅ | Auto | `UserController::logStoreAssignment` | `dashboard_manual/03 §3.2.1` |
| AUD-06 | Customer field-level encryption (WBP-S) | ✅ | Auto | `Customer` model encrypted casts | CLAUDE.md §security |
| AUD-07 | Customer search by HMAC-SHA256 (no partial search by design) | ✅ | Cashier, SM, OA | `CustomerController::index` | `dashboard_manual/09 §9.3` |
| AUD-08 | Rekenkamer audit export (full transaction trail, signed PDF) | ✅ | SA, OA, Auditor | `RekenkamerController` | `dashboard_manual/10 §10.6` |
| AUD-09 | Verwerkersovereenkomst PDF template (NL) | 🔲 | SA (delivery) | template only, no in-app generator | CLAUDE.md §security |

### 1.11 Settings & device

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| SET-01 | Printer config UI (network TCP / USB / Android PrintManager) | ✅ | All | `SettingsScreen.tsx` Printer tab | README §printer-setup |
| SET-02 | Cash drawer pin config (Pin 2 / Pin 5) | ✅ | All | `SettingsScreen.tsx` | README §cash-drawer |
| SET-03 | Test cash drawer pulse button | ✅ | All | `SettingsScreen.tsx::testCashDrawer` | README §cash-drawer |
| SET-04 | Date format selector (6 options, NL default DD-MM-YYYY) | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.3` |
| SET-05 | Default BTW rate / category / customer | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.5` |
| SET-06 | Barcode symbology default (EAN-13 / Code 128 / UPC-A) | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.6` |
| SET-07 | Site name customisation (POS top bar) | ✅ | SM+ | `settingsStore.ts` | `user_manual/13 §13.7` |
| SET-08 | Vendor contact (Josbin name/email/phone) on all "contact support" surfaces | ✅ | All | `config/josbin_pos.php vendor.*` + `useVendor` hook | G-014 in CLAUDE_WORKING_GUIDE.md |
| SET-09 | Role-aware sectioned dashboard navigation (industry-standard SaaS admin layout) | ✅ | All | `DashboardLayout.tsx` `SECTION_ORDER` + `nav[].sections` | G-016 in CLAUDE_WORKING_GUIDE.md |

---

## §2 Cross-cutting features

These don't belong to one area — they're systemic.

| Feature | Status | Notes |
|---|---|---|
| Dutch ↔ English UI parity | ✅ | i18next; all user-facing strings translated. Sranantongo planned. |
| SRD currency throughout | ✅ | DECIMAL(12,2) + BCMath. No float anywhere. |
| AST timezone (America/Paramaribo) | ✅ | All `timestamptz` stored UTC, rendered AST. |
| BTW (discount-then-tax) order | ✅ | `BtwCalculationService` + 56 unit tests. |
| Tenant isolation (cross-org leak prevention) | ✅ | Row-level scoping + policy gates. Audit completed task #22. |
| Idempotency keys for external API | ✅ | `external_sale_ref` UNIQUE per integration. |
| Append-only audit log | ✅ | DB-level + hash chain. |
| 5-layer offline fallback | ✅ | Verified end-to-end task #43. |
| IonCube source protection | 🔲 | Phase 4 — `scripts/encode-ioncube.sh` placeholder. |
| Electron code signing (Windows) | 🔲 | Phase 4. |
| OWASP Top 10 audit | 🔲 | Phase 4 — written report due before go-live. |
| WBP-S compliance certification | 🔲 | Phase 4 — written documentation due. |

---

## §3 Critical user flows (the journeys)

> Some of these also live in [`CLAUDE_WORKING_GUIDE.md` §3](CLAUDE_WORKING_GUIDE.md). When the two diverge, this doc is the source of truth for *what the flow is*; the working guide focuses on *the engineering discipline around touching it*.

### 3.1 New organisation onboarding ⭐ (most common, most fragile)
```
SA (admin@josbin-pos.sr)
  1. Dashboard → Organisations → + Add → fill name, type, BTW number, locale
  2. Users → + Add → role: organisation_admin → assign to new org
  3. Licenses → + Issue → pick org, tier, max_stores, valid_until
  4. Copy credentials + share with client (the credentials banner shows password once)

OA (just-created account)
  5. Login → Dashboard lands on Overview
  6. Vestigingen / Stores → check licence banner shows correctly (tier, status, N/M stores)
  7. + Nieuwe vestiging → fill name, city, address, BTW, POS type (blocked if licence missing/expired/at-limit)
  8. Vestigingsinstellingen → upload logo, set receipt header/footer
  9. Catalogus / Catalogue → + Product manually OR Import/Export → upload Excel/CSV
 10. Catalogus header → 📡 Push to POS (broadcasts via Reverb)
 11. Kassabeheer / Registers → + Add register × N per store (Kassa 1, Kassa 2, …)
 12. Users → + Add → role: store_manager → pick the one store from dropdown
 13. Users → + Add → role: cashier → pick the one store from dropdown
 14. Hand cashier their POS install + credentials

Manager (manager@dehoop.sr)
 15. POS auto-routes to their store (single store, no picker)
 16. Open Register screen → enter opening float → opens
 17. Settings → System tab → see Restart button (Manager+ only)
 18. Z-Report tab → 7-day history visible

Cashier (kassa@dehoop.sr)
 19. POS auto-routes to their store + auto-selects single register (no picker either)
 20. Open Register Gate → enter opening float (e.g. 50.00 SRD)
 21. Ring up sale (scan barcode / tap product / search) — auto BTW + line edits
 22. Apply line discount or sale discount if needed
 23. Press Pay → cash numpad → change calc → Complete
 24. Cash drawer pulses → receipt prints → drawer closes
 25. Logout at end of shift OR close register first
```
**Surfaces touched:** organisations, users, licenses, stores, registers, products, categories, sales, receipts, audit log. **Every single one of those** must work for the journey to complete.

### 3.2 Cashier opens shift, sells, closes
```
1. Cashier logs into POS → auto-routes to assigned store
2. Open Register Gate → enter opening float (50.00 SRD typical)
3. POS screen loaded with today's totals on top bar
4. Add items to cart (3 ways: tap product, scan barcode USB/camera, search)
5. Edit lines as needed (qty, price, BTW rate, line discount)
6. Customer? Search by name/phone or add on-the-fly. Otherwise walk-in default.
7. Press Pay → choose method (cash / card / mixed) → enter tendered → Complete
8. Receipt prints (configurable: print / PDF / email)
9. Cash drawer pulses on cash/mixed
10. Bill cleared, ready for next customer
11. Hold a sale mid-way? Sales → Hold → bill saved to queue
12. Restore later from Open Bills (Activity API keeps it pre-rendered)
13. End of shift: Close Register → enter actual cash counted → discrepancy note if mismatch
14. Logout
```

### 3.3 Manager closes day (Z-Report)
```
1. SM logs into POS (or Dashboard)
2. Verify all cashiers have closed their register sessions (or close them as manager)
3. POS → Reports tab → Z-Report → Close Z-Report for today
4. Cash reconciliation screen → enter actual cash in drawer (per register or aggregate)
5. Discrepancy? Mandatory note field. Logged in audit.
6. Confirm → Z-Report row created → today is now "closed" (immutable from now on)
7. Dashboard → Z-Reports & Sync → submit to HQ button → triggers Layer-3 forced sync
8. Status flips to "Sent ✓ [timestamp]"
9. Print Z-Report (ESC/POS) OR PDF export for Belastingdienst filing
```

### 3.4 Licence lifecycle (issue → expire → renew → soft-lock → hard-lock)
```
T=0:    SA issues licence (standard tier, max_stores=2, valid 30 days)
T=0-25: green status, normal operation
T-25:   warning_30 status → yellow banner on Dashboard
T-14:   warning_14 status → amber banner; daily email reminder
T=0:    EXPIRED → grace status → red banner, full operation continues
        (managers see the banner, cashiers unaffected; new sales still allowed)
T+14:   SOFT_LOCK → new sales blocked; existing data, reports, exports still work
        (LIC-07 — currently 🟡, partial wiring)
T+44:   HARD_LOCK → login blocked except data-export tools (90 days)
        (LIC-08 — 🔲 planned)
T+134:  data export tools also disabled

At any point: SA renews → expiry pushed forward → status drops back to active
```

### 3.5 Offline sale → 5-layer fallback recovery
```
Sale rung up at 14:32 AST
  ↓
Saved locally to sales table on local Postgres
  ↓
Outbox job queued → tries to POST to cloud
  ├── Internet up?    → Layer 1 succeeds within seconds ✅
  └── Internet down?  → Layer 2 retries: 1m, 5m, 15m, 30m
                        ├── Recovered?         → catches up ✅
                        └── Still down?
                            ├── End of day Z-Report → Layer 3 force-retry
                            ├── Still down?        → Layer 4 USB export
                            │   (.josbin_pos AES-256 file, manager carries to HQ)
                            └── Eventually online? → Layer 5 catch-up sync on reconnect
                                pings every 60s; pushes all queued days chronologically
```
Each layer falls through to the next automatically. POS keeps selling regardless.

### 3.6 Reopen-for-next-shift (mid-day cashier hand-off)
```
1. Cashier A closes register at 14:00 (going home)
2. Cashier B arrives at 14:05 to take evening shift
3. SM opens Kassabeheer → finds closed session → Reopen for next shift
4. Audit log entry: register.session_reopened
5. Cashier B logs into POS → register is open again → continues selling
6. End of day: Cashier B closes; Z-Report covers BOTH sessions
```
The Z-Report itself stays one-way once closed. This is the lighter-weight register-session reopen, not a Z-Report reopen.

### 3.8 BTW filing to Belastingdienst Suriname (new)
```
OA (orgadmin@dehoop.sr) — files BTW
  1. Dashboard → Operaties → BTW-aangiftes → + Nieuwe aangifte
  2. Pick period type: Dagelijks (yesterday default) OR Maandelijks (last month default)
  3. Click "🔍 Bereken totalen" → preview shows sales count + total + BTW + exempt portion
     (also flags if a filing already exists for this period — blocks duplicate submit)
  4. Optional note ("één kassa-einde ontbreekt, volgt in volgende aangifte")
  5. Click "✓ Indienen bij Belastingdienst" → 201 Created, reference BTW-2026-05-DEHOOPP-DAY-001
  6. Green banner: filed reference + total BTW. Audit log: btw.submitted

Tax Inspector (belastingdienst@gov.sr) — reviews filings
  7. Login → 2FA mandatory → BTW-aangiftes screen (auto-routed; this is their job)
  8. Cross-org list of all filings sorted by submitted_at DESC
  9. Filter by status (filed/accepted/disputed/superseded), period type, date range
 10. Per filing: see org, period, sales count, total BTW, submitter, timestamp, ref
 11. Click ✓ Accepteer (optional note) → status → accepted; OR
     Click ⚠ Betwist (required reason) → status → disputed
 12. OA sees the status change next time they open BTW-aangiftes

SA (admin@josbin-pos.sr) — vendor-side visibility
 13. Dashboard → Platform → BTW-aangiftes → sees the same cross-org list
     (for support: "client X says their filing wasn't received, let me check")
 14. Can also accept/dispute on behalf of inspector (same gate; audit-logged)

All transitions: written to audit_logs (event = btw.submitted | btw.accepted |
btw.disputed) AND hashed into the btw_submissions.current_hash chain — so
Rekenkamer can verify the filing history wasn't tampered with after the fact.
```

### 3.7 Third-party POS integration (Layer 3 API)
```
1. SA / OA → Dashboard → API & Webhooks → + New integration
2. Pick store, name the integration ("ShopifyPOS @ Paramaribo"), enable events
3. System generates API key (shown once) + webhook secret
4. Client copies key into their POS system
5. Their POS POSTs to /api/v1/sales with X-API-Key header
6. Sale lands in our DB with source='api', `external_sale_ref` for idempotency
7. Webhooks fire to their endpoint: sale.created, shift.closed, refund.issued
8. Webhook signed with HMAC; they verify X-JosbinPOS-Signature
9. They can pull reports back via GET /v1/reports/sales|summary
10. Sandbox available for testing without affecting live data
```

---

## §4 Feature deep-dives (the ones worth detailing)

### 4.1 Money: discount-then-BTW order
```
Item:           Rice 5kg @ 38.50 SRD (10% BTW, not exempt)
                Coca-Cola @ 7.50 SRD (10% BTW)
Subtotal:       46.00 SRD (tax-inclusive)

Sale discount:  10% → discount = 4.60 SRD
After discount: 41.40 SRD

BTW extracted:  41.40 - 41.40/1.10 = 3.7636... → rounds to 3.76 SRD
Net (ex BTW):   37.64 SRD
Total to pay:   41.40 SRD
BTW shown on receipt: 3.76 SRD (separate line, Belastingdienst format)
```
Critically: BTW is **always** extracted from the post-discount total. Doing it before would over-tax the customer. Belastingdienst Suriname enforces this. `BtwCalculationService` + 56 unit tests guard it.

### 4.2 Strict 1:1 user-to-store rule
- `users.store_id` is a single nullable FK to `stores.id`
- **Required** at the application layer for `cashier` and `store_manager` roles (validated in `UserController::store/update`, gated on the dashboard form)
- **Prohibited** for `super_admin`, `organisation_admin`, `auditor`, `api_integration` (these are "org-scoped" and ignore `store_id`)
- No "all stores in org" implicit grant. Missing store_id on a cashier = data error = they can act on **no** stores.
- Need a person at two shops? **Two accounts**, one per store.
- Enforced everywhere: `User::canAccessStore` is called by `RegisterController::open`, `SalePolicy::refund`, `ReportController::zReport`. Returns 403 `STORE_NOT_ASSIGNED` if mismatched.

### 4.3 Licence gate (the one we just hardened)
```
Storefront create:    POST /api/organisations/{id}/stores
  ↓ check licences
  ├── No row at all?           → 422 LICENSE_REQUIRED
  ├── Row is soft_lock/hard_lock? → 422 LICENSE_EXPIRED + valid_until + renewal_status
  ├── Already at max_stores?   → 422 LICENSE_STORE_LIMIT_REACHED + limit + current
  └── All checks pass          → 201 Created
```
Dashboard mirrors the gate so the **+ Nieuwe vestiging** button is `disabled` with the exact reason in a tooltip. Modal shows specific guidance per code (email SA for missing/expired vs vendor for tier upgrade). See G-007 in [`CLAUDE_WORKING_GUIDE.md`](CLAUDE_WORKING_GUIDE.md) §4 for the history.

Also surfaces in the SA Users list (`org_license` column with tier + colour-coded status pill) so SA spots expiring orgs at a glance.

### 4.4 Z-Report immutability
The Z-Report is a one-way legal-style audit boundary. Once closed for a date:
- Cannot be reopened, ever (technically the row stays writable but no UI exposes it; admin would need to manually edit DB to undo).
- New sales for that date are no longer accepted (`SalesController` checks).
- Discrepancy notes captured at close are visible in audit log + Rekenkamer export.

What CAN be reopened: a closed **register session** (per-cashier, mid-day) — for the swap-shift case. See flow §3.6.

### 4.5 Audit log integrity
- `audit_logs` table has no `update`/`delete` permissions granted in Postgres role (DB-level protection)
- Each row carries `prev_hash` + `current_hash` forming a SHA-256 chain
- `php artisan audit:verify` walks the chain and reports the first break
- A Rekenkamer audit can verify chain integrity via the export's signed PDF (signature covers the hash chain)

---

## §5 What's NOT here (out of scope)

These keep coming up; capturing them so we don't keep re-asking:

- ⛔ **Multi-store assignment per user.** Strict 1:1. See §4.2 + G-008.
- ⛔ **Online card-on-file / saved cards.** Suriname card-payment infra doesn't support tokenisation reliably enough. We process card via PIN terminal externally; only the result is recorded.
- ⛔ **Customer loyalty points / store credit.** Not in proposal v3.1.
- ⛔ **Multi-currency mid-transaction.** All sales SRD. USD shown as informational line on receipts only (using the day's locked rate).
- ⛔ **Online customer accounts / e-commerce.** Open Integration API is the path for third-party integrations.

---

## §6 Code-location quick map

| Layer | Where to look |
|---|---|
| Backend routes | `backend/routes/api.php` |
| Backend controllers | `backend/app/Http/Controllers/Api/*` |
| Backend models | `backend/app/Models/*` |
| Backend policies | `backend/app/Policies/*` |
| Backend services (BTW, discount, stock, audit hash, receipts) | `backend/app/Services/*` |
| Backend queued jobs | `backend/app/Jobs/*` |
| Backend artisan commands | `backend/app/Console/Commands/*` |
| Backend tests | `backend/tests/Feature/*` + `backend/tests/Unit/*` |
| POS screens | `frontend/src/screens/*` |
| POS components | `frontend/src/components/pos/*` |
| POS state stores (Zustand) | `frontend/src/store/*` |
| POS ESC/POS + hardware abstraction | `frontend/src/lib/escpos.ts`, `frontend/src/lib/hardware.ts` |
| POS Electron main process | `frontend/electron/*` |
| Dashboard screens | `dashboard/src/screens/*` |
| Dashboard API clients | `dashboard/src/api/*` |
| Dashboard state | `dashboard/src/store/*` |
| Demo seeders | `backend/database/seeders/DevelopmentDataSeeder.php`, `DemoSeeder.php` |
| OpenAPI spec | `backend/storage/openapi.yaml` (served at `/api/v1/openapi.json`) |

---

## §7 Roles → features matrix (quick lookup)

| Role | Sees / Does |
|---|---|
| **super_admin** | Everything across all orgs. Issue licences. Manage other SAs. 2FA mandatory. |
| **organisation_admin** | One org. Bulk-import catalogue. Push catalogue. Create stores (licence-gated). Create users (manageable: SM, cashier, auditor, api_integration). Manage API integrations. Configure security policy. View consolidated reports. |
| **store_manager** | One store. Create cashiers under their store. Run X/Z reports. Close Z-Report. Approve voids + refunds + register-reopens. Reconcile cash. Settings → System (restart). |
| **cashier** | One store. POS only. Ring up sales. Hold bills. Manual customer add. Cannot see reports (except own performance). Cannot refund (needs SM approval). |
| **auditor** | One org. **Read-only** everywhere within the org. Rekenkamer export. Audit log access. Cannot modify anything. |
| **api_integration** | Machine account. Talks only to `/api/v1/*` with API key. Limited to that integration's store. |
| **tax_inspector** | Belastingdienst Suriname tax officer. Cross-org **read-only** access strictly to BTW Submissions + audit-log of own actions. Cannot see catalogue, sales detail, customers, anything else. 2FA mandatory. Default landing screen: BTW Submissions. |

The full permission matrix is in `dashboard_manual/01-roles-and-permissions.md` §1.6.

---

## §8 Doc map (re-stated here for completeness)

| What you want to know | Read |
|---|---|
| Product spec / requirements / phase plan | `CLAUDE.md` |
| Engineering discipline / how we work / gotchas | `CLAUDE_WORKING_GUIDE.md` |
| **Feature inventory / what exists / flows** | **this file** |
| Quick-start commands / test commands / login table | `README.md` |
| HQ / admin user-facing manual | `dashboard_manual/` (18 chapters) |
| POS cashier / manager user-facing manual | `user_manual/` (13 chapters) |
| Architecture diagrams (interactive HTML) | `docs/architecture.html` |
| OpenAPI / Swagger | `http://localhost:8082/api/v1/docs` (when stack up) |

---

## §9 Known gaps (linked to task list)

These are the gaps surfaced in our recent audits, tracked as tasks:

- **#65** POS user manual: add Refund flow chapter (POS-20 docs gap)
- **#66** POS user manual: low-stock badge (CAT-15) + Settings → System (POS-25, POS-26)
- **#67** Dashboard manual: write Registers chapter (POS-04, POS-05, POS-06 reference it but it doesn't exist yet)
- **#68** Docs: BTW + Z-Report end-to-end polish from audit
- **#69** Docs: License grace-state cashier note (LIC-07 user-facing) + dashboard rate visibility

Anything 🟡 in the inventory above is a candidate for a future task — explicit gap on a surface (code, test, docs, or UI).

---

## §10 How to keep this doc honest

**When you add a new feature:**
1. Add a row to the right §1 sub-table with a fresh ID (e.g. `LIC-11`)
2. Set status (🔲 → 🟡 once code merges → ✅ once §2 surfaces checklist all-green in [`CLAUDE_WORKING_GUIDE.md`](CLAUDE_WORKING_GUIDE.md))
3. If the feature touches ≥2 user roles or screens, add a flow to §3
4. Append a §11 changelog entry

**When you remove a feature** (rare):
1. Mark the row ⛔ instead of deleting (so history is traceable)
2. Move it to §5 with a one-line "why removed"

**When you change a feature significantly:**
1. Update the row inline
2. Append a §11 changelog entry naming what changed

**Never edit history.** §11 is append-only — same rule as the audit log.

---

## §11 Changelog — every edit, dated

- **2026-05-26** — Document created. Triggered by user: *"so you creating any file or what now for our features and flows and all"*. Initial inventory of 100+ features across 11 areas (auth, org/user, licence, catalogue, POS register/sales, reports, sync, API, AI, audit, settings) + 7 critical flows + 5 feature deep-dives + roles matrix + code map. Companion to `CLAUDE_WORKING_GUIDE.md` (engineering discipline) and `CLAUDE.md` (spec).
- **2026-05-26** — Added SET-08 (vendor contact in central config + `useVendor` hook). Triggered by user calling the licence-missing banner copy impractical: *"send a request to support, this you think practical? mention Josbin our org name"*. Companion lesson logged as G-014 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Split USER-07 into USER-07 (Profile, every role) + USER-08 (Performance + Shifts, ring-up roles only). Added USER-09 + USER-10 as 🔲 future tabs for org-scoped roles (activity log, active sessions). Triggered by user spotting "My shifts" tab on Super Admin's My Account: *"do you think its practical, you are AI, why not use intelligence then?"*. Companion lesson logged as G-015 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added SET-09 (role-aware sectioned dashboard nav). Super Admin's flat 20-item nav now splits into Platform (7 items they own) + Support — Tenant Data (12 items they can reach for client support but shouldn't browse) + Account. OA / SM / Auditor get their own role-appropriate sections. POS launcher removed from SA + Auditor (they never ring up sales). Triggered by user: *"also check our super admin, the menus, keep things which a Super admin should see and worry. proper industry standards"*. Companion lesson logged as G-016 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added §1.2b BTW filings to Belastingdienst Suriname (16 features). New `tax_inspector` role — 7th role on the platform, cross-org read-only, BTW-only. New `btw_submissions` table with hash-chain audit + sale-ID traceability + idempotency unique constraint. OA / SM file daily or monthly; preview totals before submit; inspector accepts or disputes. New §3.8 end-to-end journey. tax_inspector added to roles matrix. Demo creds `belastingdienst@gov.sr / Inspector@2026` (2FA mandatory). 10 new PHPUnit tests, all green. Triggered by user: *"create portal for a government /tax dept ... yes all orgs and yes daily option too"*. Companion lesson logged as G-018 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added POS-12a + POS-13a (Phase 1 card payment reconciliation). Four new nullable columns on `sales` — `card_bank`, `card_approval_code`, `card_terminal_ref`, `card_last_four` — captured from the bank's PIN terminal slip. Card flow now has a dedicated step before submit with a bank dropdown (DSB / Hakrinbank / Finabank / RBC / Republic / Visa / Mastercard / Other) + skippable "Skip & complete" path so the cashier line stays fast. Mixed-payment step gets a collapsible reconciliation panel. Receipt template prints *"Paid by DSB ····4242 · Auth A99887"* when filled. PCI-safe (only last 4, never full PAN). 5 new PHPUnit tests, all green. Triggered by user: *"Ship Phase 1 now"* re payment-methods proposal.

---

*If something in this file is wrong, it's a bug worth fixing — same as the code.*
