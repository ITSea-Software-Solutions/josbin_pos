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
| AUTH-10 | Passkey login (WebAuthn) — register/list/remove in My Account, usernameless passwordless sign-in replacing password+TOTP in one gesture; single-use cached ceremonies, audit events, HTTPS/domain-only (lights up on prod domain; localhost dev) | ✅ | All dashboard roles (2FA-mandatory roles must finish TOTP setup first) | `Api/PasskeyController` + `dashboard/src/lib/passkeys.ts` + `passkeys` table | `dashboard_manual/18` Passkeys §; e2e-proven via virtual authenticator (2026-07-19) |
| AUTH-11 | Forced re-login on role change | ✅ | All | `UserController::update` (revokes tokens) | — |

### 1.2 Organisation & user management

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| ORG-01 | Create / edit / deactivate organisation | ✅ | SA | `OrganisationController` | `dashboard_manual/02` |
| ORG-02 | Stores screen — OA manages stores; **Store Manager no longer sees the Stores menu** (only SA/OA create/edit stores; backend `StorePolicy`/`OrganisationPolicy` already SA/OA-only) | ✅ | SA, OA | `StoresScreen.tsx`, `DashboardLayout` nav | `dashboard_manual/02 §2.4` |
| ORG-03 | Create / edit / deactivate store (under org) | ✅ | SA, OA | `OrganisationController::storeCreate`, `StoreController::update` | `dashboard_manual/02 §2.5` |
| ORG-04 | Licence-gated store creation (LICENSE_REQUIRED / EXPIRED / LIMIT_REACHED) | ✅ | OA blocked when gate fails | `OrganisationController::storeCreate` | this doc §4.3 + G-007 |
| ORG-05 | Per-store receipt template (logo + header + footer) | ✅ | SA, OA, SM | `StoreController::update`, `uploadLogo` | `dashboard_manual/02 §2.7` |
| USER-01 | Create / edit / deactivate user with role | ✅ | SA, OA, SM (manageable subset only) | `UserController` | `dashboard_manual/03` |
| USER-02 | Strict 1:1 user-to-store pin (cashier + store_manager) | ✅ | OA, SM (create), SA (any) | `UserController::store/update` + `User::canAccessStore` | `dashboard_manual/01 §1.3 ‡`, `dashboard_manual/03 §3.2.1` |
| USER-03 | Org-scoped roles ignore `store_id` | ✅ | SA, OA, auditor, api_integration | `User::isOrgScopedRole` | `dashboard_manual/01 §1.3` |
| USER-04 | Welcome email on user create | ✅ | SA, OA | `UserController::store` → queued `WelcomeCredentials` notification (bilingual, never emails a plaintext password) | `dashboard_manual/03 §3.2` · needs live SMTP to deliver |
| USER-05 | Reset 2FA on a user | ✅ | SA, OA | `UserController::reset2fa` | `dashboard_manual/03 §3.10` |
| USER-06 | View licence info on user row | ✅ | SA only | `UserController::index` (`org_license`) | this doc §4.3 |
| USER-07 | My Account — Profile + password (every role) | ✅ | All | `MeController::profile/password` + `MyAccountScreen ProfileTab` | `dashboard_manual/18` |
| USER-08 | My Account — Performance + Shifts tabs (ring-up roles only) | ✅ | Cashier + Store Manager only | `MeController::salesSummary/shifts` + `MyAccountScreen` role gate | `dashboard_manual/18` (gated since G-015) |
| USER-09 | My Account — Activity log (own logins, own audit trail) | ✅ | All roles | `MeController::activity` + `ActivityTab` in `MyAccountScreen` | task #72 |
| USER-10 | My Account — Active sessions + revoke (with audit log) | ✅ | All roles | `MeController::sessions/revokeSession` + `SessionsTab` | task #72 |
| CUST-01 | Customer detail view — profile + aggregates (spend / visits / last visit) + paginated purchase history with refund flags | ✅ | Roles with customer access (not tax inspector) | `CustomerController::history` + `CustomerDetailScreen.tsx` | `dashboard_manual/09 §9.8a` |
| CUST-02 | Customer statement export — date range (default 90 d), PDF + CSV, netted totals (gross / refunds / BTW / net); PII reads audited (`customer.accessed`, `customer.statement_exported`) | ✅ | Same as CUST-01 | `CustomerController::statement` + `reports/customer_statement.blade.php` | `dashboard_manual/09 §9.8a` |

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
| BTW-FILING-12 | Cross-org list for inspector + SA; own-org for OA; **own-store for SM** | ✅ | All BTW roles | `BtwSubmissionController::index` policy scope | — |
| BTW-FILING-13 | Audit log entries for every transition (`btw.submitted/accepted/disputed`) | ✅ | Auto | controller writes `audit_logs` | — |
| BTW-FILING-14 | Resubmission via `superseded` status (recompute totals, audit-logged) | ✅ | OA, SM (own org only) | `BtwSubmissionController::supersede` + `ResubmitModal` + partial unique idx | task #80 |
| BTW-FILING-15a | Tax Inspector dashboard — KPI landing with month-over-month BTW, pending review, disputed open, 30-day trend, top orgs, late-filings alert | ✅ | tax_inspector, SA, OA (scoped) | `BtwSubmissionController::inspectorDashboard` + `TaxInspectorDashboard.tsx` | task #82 |
| BTW-FILING-15b | Submission detail view — per-store + per-source-POS + per-payment-method + per-BTW-rate breakdowns + audit timeline | ✅ | All BTW viewers | `BtwSubmissionController::detail` + `BtwSubmissionDetailScreen.tsx` | task #82 |
| BTW-FILING-15c | Enhanced filters on list — org dropdown, source POS (josbin / external API), search by reference or org, clear-all | ✅ | All BTW viewers | `BtwSubmissionController::index` + `BtwSubmissionsScreen.tsx` filter bar | task #82 |
| BTW-FILING-15d | Click-row → detail navigation + click-tile-on-dashboard → list-with-filter navigation | ✅ | All BTW viewers | `DashboardLayout.tsx` `openSubmissionDetail` + `openBtwListWithFilter` | task #82 |
| BTW-FILING-15e | Source POS attribution visible to inspector (Josbin native vs Layer-3 third-party API contributors per filing) | ✅ | tax_inspector, SA | `sales.source` already on schema; aggregated in detail endpoint | task #82 (future-proof for non-Josbin POS integrators) |
| BTW-FILING-16 | Official **Belastingdienst Suriname government portal** — distinct gov-branded login at `/belastingdienst`, green/gold flag identity carried through sidebar chrome + 2FA screen | ✅ | tax_inspector | `BelastingdienstLoginScreen.tsx`, `theme/belastingdienst.ts`, role-aware `DashboardLayout` + `TwoFactorScreen` | — |
| BTW-FILING-17 | Inspector **bulk-accept** — multi-select filed filings + "Accept selected" (per-row authorised, audited) | ✅ | tax_inspector, SA | `BtwSubmissionController::bulkAccept` + checkbox column / bulk bar | throttle 30/min |
| BTW-FILING-18 | Expanded list filters — **year**, **min/max BTW amount**, **sort** (newest/oldest/amount), on top of org / status / period / source / search | ✅ | All BTW viewers | `BtwSubmissionController::index` (`applyListFilters`) | newest-first default |
| BTW-FILING-19 | **CSV export** of the filtered submission list (Excel-ready, AST, SRD) | ✅ | All BTW viewers | `BtwSubmissionController::export` + `exportBtwSubmissionsCsv` | shares filters with the table |
| BTW-FILING-20 | **Weekly** period type (interim filing) alongside daily / monthly | ✅ | OA, SM | `BtwSubmission::PERIOD_WEEKLY` + filter + submit-modal toggle (last Mon–Sun preset) | monthly stays the formal filing |
| BTW-FILING-21 | **In-app notification bell** — new filing → inspector, resubmit → inspector, dispute → taxpayer (OA + submitter), accept → taxpayer. Queued Notifications (database + branded email), per-user-scoped endpoints, badge + dropdown + mark-(all-)read, click-through to the filing | ✅ | All dashboard users | `app/Notifications/BtwFiling{Submitted,Disputed,Accepted,Resubmitted}`, `NotificationController`, `NotificationBell.tsx` | mail isolated per job — SMTP outage never blocks the action; new queued classes need a `horizon` restart (G-026) |
| BTW-FILING-22 | Org filter populated for cross-org roles (was empty for inspector) | ✅ | tax_inspector, SA | `OrganisationController::index` `?all=true` slim list + `getAllOrganisations()` | bugfix (inspector `organisation_id` is null) |
| BTW-FILING-23 | **Store Manager filing is store-scoped** — SM files / previews / lists / supersedes / views ONLY their own store (forced server-side); OA files the org-wide consolidated return. Store-aware partial unique index lets org-wide + per-store filings coexist per period. Submit modal shows the scope (🏪 store vs 🏢 org). | ✅ | store_manager (scoped), OA (org-wide) | `BtwSubmissionController` (`validatePayload` force + `index`/dashboard scope), `BtwSubmissionPolicy` (view/supersede), `User::isStoreBound`, `btw_subs_store_aware_unique` migration, `SubmitBtwModal` | +BtwStoreScopeTest (8) |
| BTW-FILING-15 | Belastingdienst PDF export of accepted filings | 🔲 | tax_inspector | — | future |
| BTW-FILING-16 | Late-filing oversight — per-store filing cadence (7/30d, inspector-set), daily overdue nudge to the store (bell+mail), inspector overdue list with **Remind**, and escalation to an in-system **inspection case** after ≥3 reminders (notifies the inspectors' queue; nothing dispatched externally) | ✅ | tax_inspector, SA | `BtwOverdueController` + `BtwOverdueService` + `btw:overdue-check` command + `BtwFilingOverdue`/`BtwInspectionCaseOpened` + `TaxInspectorDashboard` overdue panel | +BtwOverdueTest (4); `btw_filing_period_days` on stores + `btw_filing_reminders` + `btw_inspection_cases` |

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
| CAT-17 | Barcode scanner — USB/Bluetooth HID (keyboard wedge). Enter-lookup accepts numeric 6–14 (UPC-E/EAN-8/UPC-A/EAN-13/ITF-14 + scale codes) and alphanumeric Code 39/128 SKUs; AIM prefixes (`]E0`…) stripped | ✅ | Cashier | `lib/barcode.ts` heuristics + `ProductGrid.tsx` | install guide §F0/F4 |
| CAT-18 | Barcode scanner — camera (Quagga2) on the dashboard product form. **Requires a secure context (HTTPS/localhost)** — on plain-HTTP it shows a clear "use USB scanner or type the barcode" message instead of a raw error. Readers: EAN-13/8, UPC-A/E, Code 128/39, ITF | ✅ | OA, SM (product form) | `CatalogueScreen.tsx` `BarcodeScanModal` | `dashboard_manual/04` |
| CAT-18a | Barcode scanner — camera on the **POS** (📷 next to search): same reader set, accepts a code only after two identical consecutive reads (camera misread guard). Same HTTPS-context rule | ✅ | Cashier | `CameraScanModal.tsx` + `ProductGrid.tsx` | install guide §F4 |
| CAT-19 | Product table — click-to-sort columns (name/SKU/category/price/cost/BTW/stock/status, asc→desc→off) on top of server-side search + category filter | ✅ | All catalogue viewers | `CatalogueScreen.tsx` (`sortAccessors`/`toggleSort`) | — |
| CAT-19 | Bulk barcode label printing — platform-routed print: Android → native PrintManager (`printHtmlSheet`), Electron/web → OS print dialog; printer-presence hint (Electron counts system printers; browser/Android show static guidance) | ✅ | OA, SM | `BarcodeLabelScreen.tsx` + `lib/labelSheet.ts` + `hardware.ts::printHtmlSheet` | `user_manual/12` |
| CAT-20 | Weighed-goods / scale barcodes (embedded price or weight EAN-13) — configurable layout, off by default | ✅ | Cashier | `lib/embeddedBarcode.ts` (parser + tests) → `ProductGrid` scan handler; `Settings → Weighed goods` | layout must be confirmed vs the client's scale (prefix 2, 6+5 default) |

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
| POS-13f | QR-wallet payments (Mopé / Uni5Pay+) — POS step + instant till-confirmation + full reporting | ✅ | Cashier | `PaymentModal.tsx` qr_payment step; `Api/SaleController` `payment_confirmed`; receipts/Z/exports/OpenAPI | 2026-07-06: cashier attests wallet's "payment received" → confirmed at sale; unticked → OA pending queue. V1 API accepts all 7 methods (pre-confirmed). |
| POS-13g | QR webhook endpoint stub (HMAC-ready, feature-flagged off) | 🟡 | PSP partners | `QrPaymentWebhookController` + `qr_webhooks_enabled` config | task #79; activates once a Surinamese PSP integrates |
| POS-14 | ESC/POS thermal receipt print | ✅ | Cashier | `lib/escpos.ts`, `lib/hardware.ts` | `user_manual/06 §6.2` |
| POS-15 | Cash drawer pulse on cash sale | ✅ | Cashier | `lib/escpos.ts::openCashDrawer` | README §printer-cash-drawer |
| POS-15a | Manual cash in/out (pay-in / pay-out) during shift → adjusts Z-Report expected cash | ✅ | Cashier, SM | `CashMovementModal.tsx` → `RegisterController::recordCashMovement` + `CashMovement` model | migration 2026_06_12_000001 |
| POS-16 | PDF receipt download | ✅ | Cashier, SM | `SaleController::receiptPdf` | `user_manual/06 §6.4` |
| POS-17 | Email receipt (bilingual HTML) | ✅ | Cashier | `SaleController::emailReceipt` | `user_manual/06 §6.5` |
| POS-17a | Receipt via WhatsApp — wa.me deep link with a compact text receipt (items ≤15 lines, BTW, total, change; nl/en/srn); Suriname phone normalisation (7-digit → 597…), customer-number prefill, empty = chat picker; client-side only, formal receipt stays print/PDF | ✅ | Cashier | `lib/receiptText.ts` + `ReceiptModal.tsx` | `user_manual/06` WhatsApp § |
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
| POS-30 | Morning recovery — "Yesterday was never closed" gate: stale previous-day session blocks the new day into a guided flow (manager counts + closes inline; cashier gets call-manager screen with tel:/WhatsApp from store settings, no cash figures) | ✅ | Cashier, SM | `OpenRegisterGate.tsx` 'yesterday' step + `RegisterController::yesterdayStatus` | `user_manual/03` morning §; `dashboard_manual/19 §19.10` |
| POS-31 | Closing-time nudge — per-store `closing_time`: amber POS strip past closing, once-a-day manager notification (`RegisterStillOpen`, bell+mail), logout guard while register open | ✅ | Cashier (sees), SM (notified) | `TopBar.tsx` + `ClosingTimeReminders` command (every 15 min) | `dashboard_manual/19 §19.10` |
| POS-32 | Opt-in overnight auto-close — per-store `auto_close_enabled`+`auto_close_time`: forgotten sessions sealed *system-closed, cash not counted*; manager reconciles next day (skippable, note-required on discrepancy, audited `register.auto_closed`/`register.reconciled`) | ✅ | System + SM | `AutoCloseRegisters` command + `RegisterController::reconcile` | `dashboard_manual/19 §19.10` |

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
| REP-11 | Rekenkamer audit export (signed PDF + CSV) | ✅ | SA, OA, Auditor | `RekenkamerController` + `ReportPdfExportTest` | `dashboard_manual/10 §10.6` |
| REP-12 | Report PDF export (daily / monthly / custom, store-level) — was 500-broken since the initial commit (G-031 glued Blade directives + data-contract drift), fixed + feature-tested 2026-07-06. CSV export was never implemented: 🔲 | ✅ | All but cashier | `ReportController::export` + `reports/summary.blade.php` + `ReportPdfExportTest` | `dashboard_manual/10 §10.7` |
| REP-13 | Cross-store consolidated dashboard (live SRD totals via WebSocket) | ✅ | SA, OA | `DashboardController::summary` + Reverb | `dashboard_manual/10 §10.8` |
| REP-14 | Custom product report builder | 🟡 | SM, OA | basic version exists; advanced filters pending | `dashboard_manual/10 §10.9` |
| REP-15 | Payment-method × bank/provider breakdown on daily / monthly / custom reports | ✅ | All but cashier | `ReportController::buildRangeSummary` `bank_breakdown` + per-method totals | task #81 |
| REP-16 | Platform Overview panel for Super Admin (cross-tenant KPIs, licence health buckets, BTW pending, next-expiring, recent SA actions) | ✅ | Super Admin only | `DashboardController::platformOverview` + `PlatformOverviewPanel` | task #73 |

### 1.7 Sync & offline (5-layer fallback)

| # | Feature | Status | Roles | Code | Docs |
|---|---|---|---|---|---|
| SYNC-01 | Layer 1 — Real-time sync (every sale → cloud within seconds) | 🟡 | Auto | Data model ready; no per-sale outbox/push job — moot in single-site installs (dashboard reads the same DB). `DispatchWebhook` is the Layer-3-API webhook, NOT store→cloud sync | `docs/07-sync-and-offline.md` §7.3 |
| SYNC-02 | Layer 2 — Auto retry (1m / 5m / 15m / 30m schedule) | 🟡 | Auto | Depends on SYNC-01's outbox; ships with it | `docs/07 §7.3` |
| SYNC-03 | Layer 3 — Z-Report forced retry / submit-to-HQ | ✅ | SM | `ZReportController::submit` (idempotent, stamps `z_reports.synced_at`) | `dashboard_manual/11 §11.4`, `docs/07 §7.3` |
| SYNC-04 | Layer 4 — USB encrypted export (.josbin_pos file, AES-256+HMAC) | ✅ | SM | `SyncExportController::export/import` — roundtrip verified | `dashboard_manual/11 §11.5`, `docs/07 §7.3` |
| SYNC-05 | Layer 5 — Catch-up sync on internet restore | 🟡 | Auto | No `sync:catchup` command yet; mechanical once SYNC-01 lands | `docs/07 §7.3` |
| SYNC-06 | Mobile data dongle fallback (Digicel/Telesur 4G) | 🔲 | Local server setup | doc only; no app code needed | CLAUDE.md §offline |
| SYNC-07 | Offline sale buffering (POS keeps selling without internet) | ✅ | Auto | `sales` written locally; sync layer pushes later | task #43 |
| SYNC-08 | Yesterday-sync notice at the register gate — non-blocking "not at HQ yet" strip when yesterday's Z-Report hasn't synced, with a manager-only Retry (`POST /reports/z-report/{id}/submit`) | ✅ | All (see), SM (retry) | `OpenRegisterGate.tsx` sync-notice | `user_manual/03` morning § |

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
| SET-01 | Printer config UI (network TCP / USB / Android PrintManager) + paper width 80 mm (42 cols) / 58 mm (32 cols) + drawer pin 2/5 | ✅ | All | `SettingsScreen.tsx` Printer tab | install guide §F0–F3 |
| SET-01a | Thermal receipts encode CP858 (`ESC t 19`) — é/ë/ó/ñ print correctly on ESC/POS hardware (Epson, Xprinter, 3nStar, Bixolon, …); unmapped chars transliterate to base letters. BTW label derives from the items' actual rates | ✅ | Cashier | `lib/escpos.ts` (`encodeCp858Char`, `CHARS_PER_LINE`) | install guide §F0 |
| SET-02 | Org-configurable payment pick-lists: wallets / card banks / transfer banks / mobile apps per organisation (`settings.payment_options`, empty = Suriname defaults); POS chips, terminal-bank preselect and wallet-QR cards all consume the effective lists | ✅ | OA (edit), all POS users (consume) | `Organisation::getPaymentOptionsAttribute` + `OrganisationsScreen` editor + `PaymentModal` | `dashboard_manual/22 §22.1a` |
| SET-02 | Cash drawer pin config (Pin 2 / Pin 5) | ✅ | All | `SettingsScreen.tsx` | README §cash-drawer |
| SET-03 | Hardware test buttons — test receipt (real `buildReceiptBytes`→`printEscPos` sale path), test cash drawer pulse, test label sheet (works even with printer type None); all three platform-aware on Windows + Android | ✅ | All | `SettingsScreen.tsx` (`testReceiptPrint` / `testDrawer` / `testLabelPrint`) | `user_manual/13 §13.2`, install guide §F1 |
| SET-04 | Date format selector (6 options, NL default DD-MM-YYYY) | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.3` |
| SET-05 | Default BTW rate / category / customer | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.5` |
| SET-06 | Barcode symbology default (EAN-13 / Code 128 / UPC-A) | ✅ | All | `settingsStore.ts` | `user_manual/13 §13.6` |
| SET-07 | Site name customisation (POS top bar) | ✅ | SM+ | `settingsStore.ts` | `user_manual/13 §13.7` |
| SET-08 | Vendor contact (Josbin name/email/phone) on all "contact support" surfaces | ✅ | All | `config/josbin_pos.php vendor.*` + `useVendor` hook | G-014 in CLAUDE_WORKING_GUIDE.md |
| SET-10 | POS installer download from the store's OWN dashboard (`GET /installer` metadata + `/installer/download`, newest `.exe` in `josbin_pos.installer_dir`, manager-gated, graceful "not deployed" state) — a till can be added over the shop LAN with no internet | ✅ | SM+ | `Api/InstallerController` + `PosLauncherScreen` + `api/installer.ts` | `docs/00 §E3a`, `dashboard_manual/16 §16.5.3` |
| HW-x | **Printer bridge** — Windows app shares its USB receipt printer on TCP 9100 ("📡 Share this printer on the network", Settings → Hardware, USB+Electron only): serialized job queue in Electron main, LAN IPs shown for other tills, auto-restart on boot; turns any USB-only printer + any Windows PC into a network printer for Android tills. Stopgap by design — LAN interface card per counter remains the multi-counter architecture | ✅ | Operator on the Windows till | `electron/main.ts` (bridge server), `SettingsScreen`, `settingsStore` | `docs/15 §15.8` |
| REG-x | **Self-service shift handover** (org policy, default off) — with it on, the next shift's cashier opens a NEW session on a register closed today (own float; closed count stays sealed); index exposes `self_service_handover`, gate renders closed registers openable; kills the ±20 manager reopens/day at a 10-counter 3-shift store | ✅ | OA sets; cashier uses | `RegisterController` (open/index), `OrganisationController`, `OpenRegisterGate`, org edit modal | `dashboard_manual/19`, `user_manual/03` |
| SALE-13 | **Sale-level BTW exemption (vrijstelling)** — govt/diplomatic/export buyers pay ex-BTW prices (engine strips the component per unit, to the cent), **mandatory reason** on sale + receipt + audit, `btw_exempt_forgone_srd` stamped at sale time; dedicated **Reports → BTW exemptions** (rows + forgone summary, org- or store-scoped, `reports.btw` gated); filing detail shows the exemption list to the tax inspector; refunds inherit the flag | ✅ | Cashier+ (report SM+) | `BtwCalculationService::stripBtwForExemptSale`, `SaleController`, `ReportController::btwExemptions`, `CartPanel`/`BtwExemptModal` | `user_manual/05 §5.4c` |
| SET-12 | Native **Android POS app** (Capacitor 8, minSdk 24) for Android till terminals (Posiflex RT etc.) — same React bundle, same runtime ⚙ Server override; receipts + cash drawer via our own native `TcpSocketPlugin` (raw ESC/POS over TCP 9100 → network printer required); scanner = HID as everywhere. 4.3 MB APK, served by `/installer?platform=android` + dashboard card + public downloads. **Pilot: not yet field-tested on real hardware** | 🟡 | Cashier+ | `frontend/android/`, `lib/capacitor-printer.ts`, `lib/hardware.ts` | `docs/00 §E5`, `dashboard_manual/16 §16.5.4` |
| SET-11 | Server-address panel on the POS-app screen — shows the exact address a till must be pointed at (derived from the dashboard's own API base), copy button, 3-step ⚙ Server instructions, same-address warning | ✅ | SM+ | `PosLauncherScreen` + `posServerAddress()` | `docs/00 §E3` |
| SET-09 | Role-aware sectioned dashboard navigation (industry-standard SaaS admin layout) | ✅ | All | `DashboardLayout.tsx` `SECTION_ORDER` + `nav[].sections` | G-016 in CLAUDE_WORKING_GUIDE.md |
| SET-10 | Runtime-configurable server address — `josbin_server_url` localStorage override beats the baked `VITE_API_URL`; "⚙ Server" on the POS login screen (normalise + /health test + save&restart + reset) and Settings → System (manager+); axios client, Reverb discovery and demo banner all read it | ✅ | Anyone at the till (login screen), SM+ (settings) | `lib/serverConfig.ts` + `ServerConfigModal.tsx` | FIELD_RUNBOOK terminal §; `user_manual/13` |
| SET-11 | Sranantongo POS UI (draft) — third language `srn`, 390 keys, fallback srn→nl→en, 🇸🇷 in Settings; WhatsApp text receipts follow; API errors fall back to nl (SetLocale whitelist) | 🟡 draft — native review pending (see PENDING backlog) | All POS users | `i18n/srn.json` + `i18n/index.ts` | `user_manual/06` language §; review keys in generation notes |
| SET-12 | Per-store end-of-day settings — `closing_time`, `auto_close_enabled`, `auto_close_time`, `manager_name`, `manager_phone` (drive POS-30/31/32) | ✅ | SM/OA edit | `StoreSettingsScreen.tsx` "End of day" + `StoreController` H:i validation | `dashboard_manual/19 §19.10` |

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
| Report-endpoint caching (`app/Support/ReportCache.php`) — scope-keyed (platform / org / org+store) `Cache::remember` on 12 heavy GET endpoints; 60 s today-windows, 15 min closed ranges; keys hash ksorted params; locale omitted (payloads are pure data — PDFs uncached) | ✅ | `ReportController` + `DashboardController` + `ReportCacheTest` (7) |

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

### 3.9 Morning recovery — yesterday was never closed (new)

```
07:00 — first person unlocks the till
  └─ POS gate calls GET /registers/yesterday-status
       ├─ nothing stale → normal day (pick register → float → sell)
       ├─ stale OPEN session from yesterday
       │    ├─ MANAGER logged in → inline wizard: expected cash shown,
       │    │   count drawer → note if different → "Close yesterday"
       │    │   → today opens in the same motion
       │    └─ CASHIER logged in → "Yesterday was never closed" screen:
       │        📞 Call [manager] · WhatsApp buttons (store settings)
       │        → manager closes (at the till or from home) → Refresh
       └─ session auto-closed overnight (auto_close_enabled)
            → day is NOT blocked; manager sees a skippable
              "count yesterday's drawer" reconciliation task
              (note required on discrepancy → audit `register.reconciled`)
  └─ independent amber strip if yesterday's Z-Report hasn't reached HQ
      (manager-only Retry; auto-retry continues regardless)
Prevention side: past `closing_time` → amber strip + once-a-day manager
notification + logout guard while the register is still open.
```

Everything time-based is per-store configurable (Dashboard → Store →
**End of day**). Audit trail: `register.auto_closed` (user_id null),
`register.reconciled`, plus the normal close events.

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

- **2026-07-27 (installer force-closes the app — 1.3.3)** — Field blocker: reinstalling over a running till failed with *"Josbin POS cannot be closed"*, and the operator had no window to close (fullscreen + frameless) nor an easy way to kill Electron's process tree. Added `frontend/build/installer.nsh` overriding NSIS `customCheckAppRunning` + `customInit` with `taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T`, wired via `build.nsis.include`. Upgrades are now unattended-safe, which matters because tills auto-launch on boot. Released 1.3.3 on both platforms. See G-049.

- **2026-07-27 (Windows printing + scanner focus — 1.3.2)** — Field session found the printer dead in our app while Windows' own test page printed. TWO stacked causes: (1) `usbPrint` used `print /D:` — a legacy TEXT utility, not raw printing (G-047); replaced with OpenPrinter/StartDocPrinter(RAW)/WritePrinter via PowerShell P/Invoke `-EncodedCommand`. (2) the renderer passed `Buffer.from(bytes)` to the preload bridge, but the renderer is sandboxed so `Buffer` is undefined — it threw before IPC; now `Array.from(bytes)`, matching the network branch that always worked (G-048a). Cash drawer rides the same path, so both are fixed together. ALSO user-reported POS bug: tapping a product left focus on the tile, so the scanner's Enter re-fired that tile and bumped its quantity instead of adding the scanned item — focus now returns to the search box after every add (G-048b). Hardware test failures now display the real Win32/socket message. Released **1.3.2 on both platforms**; downloads page + release notes EN+NL updated.

- **2026-07-27 (Windows raw printing fixed — 1.3.1)** — Office test: Windows' own test page printed, our app's receipt test and sale receipts did nothing. Cause: `usbPrint` used `print /D:` — a legacy TEXT utility, despite a comment claiming it sent RAW jobs (G-047, second false-comment bug of the week). Replaced with the real spooler path — OpenPrinter/StartDocPrinter(datatype RAW)/WritePrinter via PowerShell P/Invoke, `-EncodedCommand` so ExecutionPolicy and spaces-in-printer-names are non-issues, with the Win32 error surfaced verbatim. Settings hardware tests now render the failure message instead of just turning red. Released as **1.3.1 on BOTH platforms** per the sync rule (Android unaffected functionally but versions stay matched), sha256 sidecars, downloads page + release notes (EN+NL) updated.

- **2026-07-27 (synchronized releases + release notes)** — User rule: exe and APK stay version-synced with a documented changelog. Cut **1.3.0** for BOTH platforms from one commit (exe was 1.1.2, apk 1.2.1 — drift ended), sha256 sidecars, installer card verified reporting 1.3.0/1.3.0. New client-facing **docs/17-release-notes.md** (EN+NL, sidebar-registered): per-release highlights, the never-uninstall upgrade rule, checksum pointer, superseded-versions table. Release procedure recorded as a standing rule in the working guide (single version source = frontend/package.json, both artifacts every release, notes appended every time).

- **2026-07-27 (register ops gaps, user-found in office testing)** — Three real walls hit live: **(1)** manager dashboard showed an in-use register with NO close action — the backend allowed manager-close all along, only the UI was missing. RegistersScreen gains a red **Close** button on open rows + CloseSessionModal (count + note); when the closer isn't the session's cashier the backend stamps *"[gesloten door X / closed by X]"* into the note so the shift report names who counted (+test). **(2)** the POS blocked screen (stale yesterday) walled the cashier off from ALL registers even when others were free — added **"→ Continue on another register"** (shown only when an openable register exists; server-side rules unchanged). **(3)** the gate screens had no logout — **⎋ Uitloggen** now on every gate step; a cashier can never be trapped. Docs: dashboard manual 19 force-close section + POS manual 03 two-exits tip (EN+NL).

- **2026-07-27 (printer bridge)** — Office field reality: PP-9000 is the USB-only variant (power+USB+DK confirmed), tills are Android, one Windows laptop available. Built "Share this printer on the network" into the Windows app: Electron main listens on 0.0.0.0:9100, each connection = one job (5s idle guard), jobs **serialized** through a promise queue into the existing `usbPrint` spooler path — so the Windows till behaves exactly like the printer's LAN card, collision-safer even. Settings→Hardware toggle (USB+Electron only) shows the PC's LAN IPs to type on other tills; persisted; auto-starts on boot; stops on quit. i18n ×3. exe rebuilt as **Setup 1.1.0** (first exe refresh since the CSP fix — also picks up exemption UI, handover gate, hardware tests, labels), checksum-verified on downloads. Docs: ch15 **§15.8** EN+NL with the Generic/Text-Only-driver trick and the honest rules (PC must stay on; stopgap, not multi-counter architecture; LAN card per counter remains the real answer), troubleshooting row cross-links it.

- **2026-07-26 (pagination & unbounded-listing sweep, backend half)** — User mandate: nothing may grow into an unbounded page. Full-project audit (agent-inventoried, every endpoint + screen classified paginated/capped/unbounded), then: **(1) per_page hardening** — eight client-controlled paginators clamped to `min(per_page, 200)` (sales ×2, products ×2, users, organisations, btw-submissions, discount-rules) + `/me/activity` limit clamped; any authenticated user could previously turn them unbounded with `per_page=1000000`. **(2) Export guardrails** — Rekenkamer export: 366-day range cap + 20,000-row refusal with localized split-the-period errors (was: arbitrary range, fully in memory — the platform's likeliest first OOM); USB/sync export capped at 92 days (import is idempotent, parts are safe); customer statement capped at 366 days; products CSV now chunks 500 inside the stream (pattern copied from the BTW-submissions export). **(3) Aggregates where pages lied** — `dashboard/summary` no longer scans every Z-report ever into PHP (Postgres `DISTINCT ON` newest-per-store); users index returns `meta_counts` (total/active/with_two_factor); z-reports returns `meta_counts` (synced/pending/failed); pending-payments returns `meta_totals` (queue-wide SRD sum + older-than-7d) — the KPI tiles those screens showed were page-of-N numbers. **(4) POS dead filters fixed** — `/sales` now accepts `date` (AST day) + `search` (sale number); the POS history screen had been sending both for months and Laravel silently dropped them, so the screen showed all-history-paginated while claiming to filter. Belt limits on yesterday-status and the BTW-overdue store fan-out (single-query rewrite noted as future work). ExportGuardrailsTest ×4. Frontend pager half in the same batch (separate entry).

- **2026-07-26 (inspector audit log un-bricked)** — User found the inspector's Audit Log tab empty. Root cause: the nav showed the screen to `tax_inspector` (comment even claimed "the controller scopes for them") but `AuditLogController` only admitted SA/OA/Auditor — the API 403'd and the page sat blank. The promise and the gate disagreed. Fix: inspector admitted with a mandate-shaped scope — `auditable_type = btw_submission` across ALL orgs OR their own `user_id` (their reviews/logins); never an org's operational logs (WBP-S data minimization — products/users/sales are the internal auditor's surface, not the Belastingdienst's). Same split applied to `summary()`. AuditLogInspectorScopeTest ×3 pins: inspector 200s, sees cross-org filing events, never sees `product` events, and the auditor's wider org scope is untouched. Manual ch 13 gets an EN+NL info box explaining why the inspector's list is intentionally short.

- **2026-07-26 (self-service shift handover)** — Came out of the user's "30 opens a day?!" question: opening was already cashier self-service, but a register CLOSED today needed a manager for the next shift (±20 taps/day at 10 counters × 3 shifts). New org policy `register_policy.self_service_handover` (default off = behavior unchanged): when on, the open endpoint lets a cashier start a NEW session on a closed-today register — the sealed count is untouched, one-live-session-per-register still enforced, everything audited. Registers index now returns the flag; the POS gate renders closed registers as openable ("next shift can open") and drops the ask-manager banner; org edit modal gains the Kassabeleid toggle with the lade-wissel explanation. RegisterHandoverTest ×4. Docs: dashboard manual 19 policy section + user manual 03 tip (EN+NL).

- **2026-07-26 (chapter 16: the four setups, diagram-first)** — User asked for a dedicated architecture-solutions section a non-technical client can follow. New **docs/16-deployment-options.md** (EN+NL, sidebar-registered): the 2×2 matrix (Windows/Android till × local/cloud server) as four named setups (A classic store / B Windows+cloud / C modern counter / D lightest start), each with an inline SVG diagram in brand colors, the internet-down verdict color-coded per setup (green "selling continues" vs red "no selling"), a three-question chooser, the invariant rules (scanner→till, drawer→printer, dashboard needs no machine), the mixed-fleet fact (Windows + Android tills on one server) and the migration caveat. §7.0, ch15 intro cross-link to it.

- **2026-07-25 (dedicated Android chapter)** — User request: treat Android as its own special topic. New **docs/15-android-terminals.md** (EN+NL, in the sidebar): the one mental model (terminal touches only the scanner; everything else is network), ASCII topology, wiring table, install/update, the four in-app connection checks, a Windows-vs-Android capability table (USB printing ❌, Find-my-server ❌, camera scanner ❌-for-now, 4 MB vs 108 MB), field checklist (static IPs, UPS, backups, 72h licence tolerance) and a symptom→fix troubleshooting table. §E5 and dashboard-manual §16.5.4 now carry pointers instead of duplicating the story.

- **2026-07-25 (sale-level BTW exemption, e2e)** — User request from the office: government buyers don't pay BTW, with a note so we know why. Built the FULL chain in one pass: engine helper `stripBtwForExemptSale` (prices are BTW-inclusive → exempt buyer pays the net: 11.00→10.00, per-unit round-half-up; already-exempt items untouched; lines snapshot as zero-rate exempt so every existing report bucket just works), mandatory reason (min 5 chars, refused without), **forgone BTW stamped on the sale at sale time** (survives price changes), refunds inherit the flag. POS: 🏛 row in the cart + reason modal with quick picks (en/nl/srn), prices visibly drop, × to undo. Receipts (ESC/POS + HTML + email + WhatsApp text) print the reason. NEW `GET /reports/btw-exemptions` + dashboard **Reports → BTW-vrijstellingen** tab (count / exempt turnover / forgone tiles + who-why table); BTW filing detail now carries an `exemptions` block the inspector sees. Tests: engine 58→63, SaleStore 11→15, new ReportBtwExemptions (2). **Proven end-to-end by driving the real browser POS**: cashier login → 2× Coca-Cola 15.00 → exemption applied → till showed 13.64/BTW exempt → cash 20 → change 6.36 → DB row exempt/forgone 1.36 → manager report row with reason → receipt line — every figure to the cent. One trap caught mid-build: the frontend was about to send STRIPPED prices to a backend that strips again (double exemption) — payload now always sends raw prices; the server is the money authority.

- **2026-07-25 (labels on Android + hardware tests from Settings)** — The office field test found the Labels **Print button dead on the Android build**: `window.print()` is a silent no-op inside the Capacitor WebView (G-045 — 4th member of the packaged-context bug class). HTML printing now platform-routes through `hardware.ts::printHtmlSheet` — Android → native PrintManager via `CapacitorPrinter.printHtml` (`@capgo/capacitor-printer`), Electron/web → the hidden-iframe `window.print()` as before; sheet generation extracted to `lib/labelSheet.ts` (shared, unit-tested). Labels screen also gained a **printer-presence hint** (Electron: `listPrinters()` count via IPC; browser/Android: one static guidance line — no enumeration API exists there) and an inline error line when the native print fails. **User-requested in the same session:** Settings → Printer & Cash Drawer now has **three hardware test buttons** — 🧾 test receipt (a real `buildReceiptBytes` → `printEscPos` ticket, the exact sale path), 🗄 test drawer (existing), 🏷 test label (new; works even with connection type **None**) — all functional on Windows terminals AND the Android app. Stale `helpAndroid` copy (phantom `@anuradev` plugin + "see README") rewritten to the network-printer rule. New i18n: `pos.labels.*` + 7 `settings.printer.*` keys in **en/nl/srn**. Frontend: 109 vitest green (+10 new in `labelSheet.test.ts` / `printHtmlSheet.test.ts`), tsc clean; live-walked on the demo stack (hint renders, label sheet lands in the print iframe, dialog opens, receipt test errors gracefully in a browser). **APK rebuilt and republished** to the droplet downloads (sha256-verified; installer API + docs URL both serve the new build). Manuals: user ch 12 §12.7 + ch 13 §13.2 (EN+NL), install guide §E5 hardware table + §F1 steps (EN+NL).

- **2026-07-25 (field-test fix: USB dead end on Android settings)** — The office terminal let the user pick printer type **USB** and then failed the cash-drawer test with a generic "check connection" — but on Android USB is a dead end by design (no print spooler; only the raw network socket works). Three-layer fix: Settings hides the USB option off-Electron and shows a network-only hint (en/nl/srn), a saved `usb` config self-heals to `network` on such platforms, and `hardware.ts` names the real cause if that state is ever reached anyway. Reminder the error underlined: the drawer NEVER connects to the app — it fires through the printer, so no reachable printer = no drawer, on every platform.

- **2026-07-25 (small-store setups + the CORS catch)** — Office field session shaped the small-store story: docs/07 gains **§7.0 "Which setup fits which store"** (EN+NL) — cloud-only (internet required to sell, hotspot bridges blips) vs any-PC-as-local-server (offline-capable, the "no server budget" answer) vs full per-store server. Along the way the APK surfaced a third launch-blocking config bug this week: **CORS refused the Android WebView origin** — Capacitor has defaulted to `https://localhost` since v5 but config/cors.php only allowed `capacitor://localhost` + http localhost patterns, so every APK login would have failed against every server. Fixed in code defaults (droplet has no .env override, so the fix deploys), verified by replaying the exact preflight with curl (laptop + droplet). Also empirically established: Electron `file://` windows do NOT enforce CORS (real login from a file:// harness against the then-unfixed droplet succeeded), so the Windows exe was never affected — only the CSP was its blocker. See G-044.

- **2026-07-25 (Android app for Posiflex terminals)** — The client's office runs Posiflex Android hardware (RT-series terminal, PP-9000 printer, NT-M8 scanner), so the dormant Capacitor scaffold became a real build: `npx cap add android` (platform folder now committed), a **local native `TcpSocketPlugin.java`** replacing the phantom `@capacitor-community/tcp-sockets` dependency (which does not exist on npm — the old comments claiming "the Capacitor runtime injects it" were wrong; see G-043), `usesCleartextTraffic` for LAN http, and the CSP fix from earlier today carried in. Debug APK (4.3 MB — system WebView, no bundled Chromium) verified from the outside in: plugin class in dex (classes8.dex — debug builds split dex, grep them all), minSdk 24 + cleartext in the compiled manifest, widened CSP + baked demo URL in the web assets. Served three ways: public downloads page, `GET /installer` (now per-platform: flat=exe, `android`=apk, `download?platform=android` with the real APK MIME so Chrome offers install) and a second dashboard-card button. InstallerDownloadTest 6→9. Docs: install guide **§E5** (new, EN+NL — sideload steps, hardware table, the network-printer-required rule, pilot-status warning), dashboard manual §16.5.4 rewritten from stub (EN+NL). **Honest status: compiles, verified structurally, NOT yet run on a real terminal — today's office session is the field test.**

- **2026-07-25 (LAN discovery + CSP production fix)** — **"🔍 Find my server"**: the till sweeps its own /24 for `/api/health` (Electron main, 800 ms per host, 64 concurrent, 6 s hard budget, RFC1918 only), identifies a server by the new `app: "josbin_pos"` health field (falls back to the legacy shape so it still finds older servers, and rejects a payload naming a different app), then auto-tests a single hit or offers a picker; browser builds hide the button. Pure logic in `lib/lan.ts` with 28 unit tests. **The find of the day:** building this surfaced that the renderer CSP blocked every non-`localhost` API call in a packaged build — the runtime server override AND the already-published demo installer were dead on arrival in production, invisible in dev. Verified in a real Electron `file://` window, fixed by widening `connect-src` only, re-verified, and the demo installer rebuilt + republished. See G-042.

- **2026-07-25 (installer distribution + server address)** — Answered "how does a client get the installer, and how does it know which server?" end to end. **Distribution:** the store's own dashboard now serves the installer (`GET /installer` metadata + `/installer/download`, newest `.exe` from `josbin_pos.installer_dir`, Store-Manager-gated, audited by virtue of auth) — so a till can be added over the shop LAN **with no internet**, which is the whole point on a real store install; a missing file is a normal "not deployed" state that hides the card rather than erroring. Central download + USB stay as the first-till/evaluation route. **Address:** one installer now fits every customer — the ⚙ Server override always wins over the baked default, so the `192.168.0.250` convention covers standard installs and anything else (different subnet, cloud, own domain) is a 30-second per-till setting. The POS-app screen shows the exact address with a copy button plus the same-address-per-store warning. +InstallerDownloadTest (6). Docs: install guide §E3 rewritten + new §E3a (EN+NL), dashboard manual §16.5.3 rewritten (EN+NL) — including the two facts worth repeating to clients: hardware is driven by the till (so a remote server does NOT break printer/drawer/scanner; it costs offline resilience), and moving a live store between servers is a data migration, not a setting.

- **2026-07-19 (pending-list clearance)** — Every developer-completable row on PENDING closed in one batch. **(1) EULA working draft** (`legal/eula-draft-nl.md` + EN, internal portal): licensed-not-sold, fingerprint binding + 72 h grace + the exact soft/hard-lock ladder the code enforces, customer-owns-data + 90-day export, WBP-S hook, audit clause — lawyer review is the remaining gate. **(2) Customer detail view + statement** (CUST-01/02): dashboard detail screen (profile, aggregates, paginated history with refund flags) + PDF/CSV statement with netted totals; org-scoped 404s, PII reads audited; 9 tests. **(3) Report caching**: 12 heavy GET report/dashboard endpoints behind `ReportCache` (scope-keyed platform/org/store — bleed impossible, proven by two-org tests; 60 s today / 15 min closed ranges; refund `occurred_at` verified never backdated; X-report timestamp stamped outside the cache); 7 tests incl. time-travel TTL. **(4) June-audit D-items closed** (task #127): D1 — `Sale::nextNumber()` now throws outside a transaction (advisory xact lock was silently scopeless; per-store unique index + per-store counting already existed; all callers verified transactional); D3 — refund legs carry prorated line + sale-level discounts negatively (money was already right, reports now net to the cent: −5.00 item / −3.00 header share proven); D5 — SRD + % sale discounts combine additively (legacy "SRD wins" test updated — it enshrined the bug). Full backend suite after merge: **323 passed / 1096 assertions**. Manuals: dashboard ch 9 §9.8a (EN+NL).

- **2026-07-19 (offline chapter + sync truth-fix)** — `docs/07-sync-and-offline.md` was still a 🚧 stub; now the full install-to-daily-life offline story (EN+NL): what's installed where and why tills never need internet, the sale-commits-locally-first guarantee, the two deployment shapes (single-site = one DB, nothing to sync; multi-site cloud = the 5-layer ladder), per-layer step-by-step with HONEST availability (L3 submit + L4 USB ✓ today; L1/2/5 roadmap for the first cloud multi-store rollout), outage-hour-by-hour (rate stays locked, 72 h licence grace, e-mail queues), 4G-dongle guidance, where-to-see-sync-state table, FAQ. While writing it, §1.7's SYNC-01/02/05 rows were found marked ✅ against the code and the canonical verification doc — corrected to 🟡 with truthful notes (the old rows cited `DispatchWebhook`, which is the Layer-3 API webhook, not store→cloud sync). dashboard_manual ch 11 §11.6 already had the honest table and needed no change.

- **2026-07-19 (payments manual deep-dive)** — user_manual ch 5 (EN+NL) now explains every payment method end-to-end after a real "what do I type here?" question about the card reconciliation screen: new §5.1a seven-methods table (what each needs, when money is confirmed), §5.3 rewritten as a slip-to-screen walkthrough (where AUTH code / last-4 / terminal ref sit on the PIN slip, why the store cares, Skip always allowed), mixed-payment note, and NEW §5.4a bank/mobile transfer (required sender reference, awaiting-confirmation → Dashboard → Pending payments, never treat as cash) + §5.4b foreign cash (USD/EUR at the locked daily rate, both amounts on the receipt). Docs-only change, verified against PaymentModal behaviour before writing.

- **2026-07-19 (ideas batch: WhatsApp bon, Sranantongo, passkeys, runtime server URL)** — Four features from the "worth chasing" list, all shipped and verified. **(1) Receipt via WhatsApp**: POS receipt modal gained a 💬 button — builds a compact bilingual text receipt (store, sale number, items with a 15-line cap, BTW, total, payment, change) into a `wa.me` deep link; phone normalised for Suriname (bare 7-digit mobiles get `597`), customer-number prefill chip, empty number = WhatsApp's own chat picker. Client-side only (`frontend/src/lib/receiptText.ts`, 17 vitest). Live-verified: real sale produced `wa.me/5978812345?text=🧾 De Hoop…TOTAL: SRD 4.00`. **(2) Sranantongo UI (draft)**: third POS language `srn` — full 390-key translation file (`frontend/src/i18n/srn.json`, Paramaribo retail register, native review pending; 15 flagged keys listed in the generation notes), fallback chain srn→nl→en, Settings language picker 🇸🇷. Backend SetLocale falls back to nl by design. Live-verified ("Kassa / seri fu tide / Baskita"). **(3) Passkeys (WebAuthn)** for the dashboard: register under My Account → Profile (name, list, remove), "Sign in with a passkey" on the login screen — one gesture replaces password + TOTP (user-verified passkey = 2 factors; management routes sit inside the 2FA-enforced group so TOTP-mandatory roles must finish setup first). Own `passkeys` table (UUID FK, cascade), Sanctum-token API endpoints (`/auth/passkeys*`, login throttled, single-use cached ceremonies), audit events `auth.passkey_{registered,removed,login}`. HTTPS/domain-only by nature — hidden on the plain-IP droplet with an explanatory card; `PASSKEYS_RP_ID`/`PASSKEYS_ALLOWED_ORIGINS` envs for the prod domain. PROVEN end-to-end with a CDP virtual authenticator: register 201 + passwordless login issued a token for manager@dehoop.sr. +PasskeyTest (8). **(4) Runtime-configurable server URL**: `josbin_server_url` localStorage override read by the axios client, Reverb discovery and demo banner; "⚙ Server" on the POS login screen (test /health + save&restart + reset) and Settings → System (manager+). Kills the rebuild-for-a-wrong-IP field failure; FIELD_RUNBOOK updated. Also: `AuthController::userPayload()` now shared with passkey login; ops cheat-sheet + UPPS/SCB partnership email draft + gov-DB talking points live on the internal portal (17 pages).

- **2026-07-19 (morning recovery)** — The "yesterday was never closed" problem solved four ways, per-store-time configurable. **(1) POS morning screen**: a session still open from a previous day blocks the new day into a guided flow — a *manager* counts + closes yesterday's drawer (or counts an auto-closed one) and today opens in the same motion; a *cashier* gets a call-manager screen (tap-to-call + WhatsApp from store settings, no cash figures). **(2) Closing-time nudge**: past the store's `closing_time`, a persistent amber POS strip + a once-a-day manager notification (`RegisterStillOpen`, database+mail) if a register is still open; logout while the register is open now prompts. **(3) Opt-in overnight auto-close** (`registers:auto-close`, per-store `auto_close_enabled`+`auto_close_time`): seals forgotten sessions as *system-closed — cash not counted* so the morning starts unblocked; the manager reconciles (counts) next day as a skippable task. **(4) Yesterday-sync notice**: a non-blocking "not at HQ yet" line + manager retry at the gate. New: `register_sessions.system_closed/reconciled_*`, `GET /registers/yesterday-status`, `POST /sessions/{id}/reconcile`, store settings `closing_time`/`auto_close_*`/`manager_name`/`manager_phone` (Dashboard → Store → **End of day**), two scheduled commands, `RegisterSession::computeExpectedCash()` (shared with close). Cash figures are manager-only. +MorningRecoveryTest (6); backend 296. Live-verified the cashier call-manager screen; manager expected-cash visibility confirmed via API. Manual: dashboard ch 19 §19.10 + user ch 3 (EN+NL).

- **2026-07-19 (P0 ops)** — Production operations closed out on the droplet: **scripted backups** (nightly dump + weekly base + WAL archiving = point-in-time recovery; first restore drill PASSED with exact row counts), cron installed, laptop `pull-backup.sh` off-site copy; **gzip** on all frontends (POS bundle 448→146 KB); **prod PHP tuning** (full opcode cache + 12 FPM workers; deploys restart app); **fail2ban**; **k6 load-test harness** (10-till scenario; local run clean — contract p95 measured at prod split per playbook). Incident found & fixed during rollout: Redis had run with the compose-default password "secret" since launch (masked by stale container env); now on the strong credential with compose interpolation pinned server-side. Install guide Part I (EN+NL) rewritten around the scripts; playbook gains load-test + password-rotation gates.

- **2026-07-19 (schema hardening)** — Database audit + hardening migration: 21 missing FK indexes added; z_reports / register_sessions / cash_movements delete rules retargeted CASCADE→RESTRICT so financial history can never be erased by a parent hard-delete; **audit_logs append-only enforced by DB triggers** (UPDATE/DELETE/TRUNCATE rejected; only the initial hash-chain stamp permitted) — the "database-level write protection" the security architecture promises is now real, with `audit:rebaseline` as the break-glass path. Audit found zero float money columns, all PKs present, consistent NUMERIC precision, PII encryption intact. +AuditLogImmutabilityTest (4); suite 290.

- **2026-07-19** — **Org-configurable payment pick-lists** (the CARICOM-expansion enabler from the regional payments research): new `organisations.settings` jsonb; `payment_options` (wallets / card_banks / transfer_banks / mobile_apps) editable at Dashboard → Organisations → Edit → "POS payment options" (comma-separated, empty = Suriname defaults from `config/josbin_pos.php`, "Other" never stored); effective lists appended on every organisation payload and on `GET /stores/{id}`, consumed by the POS PaymentModal chips, the simulated-terminal bank preselect, and the Store-settings wallet-QR cards (now one card per configured wallet); wallet-QR upload whitelist is the org's wallet list with `Str::slug` filenames (back-compatible: 'mope'/'uni5pay'), and deleting a QR for a since-removed provider stays allowed. A Guyana deployment now swaps in MMG/Caripay/Kanoo with zero code changes (exactly what OrgPaymentOptionsTest exercises). Also fixed **the first-sale-of-day daily-rate race**: all three DailyRateService creation paths route through `lockRate()`, catching the unique-date violation and returning the concurrent winner's row instead of 500-ing the sale. Backend 286 tests (4 new), tsc clean on both SPAs; dashboard-manual ch 22 §22.1a (EN+NL).

- **2026-07-18** — **South-America hardware compatibility batch.** Thermal receipts now select **code page 858** at init (`ESC t 19`) and encode text as CP858 instead of raw Latin-1 — before this, é/ë/ó/ñ printed as box-drawing garbage on every real ESC/POS printer (they boot in CP437; and Latin-1 byte values ≠ CP858 values). Unmapped characters transliterate to their base letter. **58 mm paper support**: new Settings → Printer → Paper width (80 mm = 42 cols / 58 mm = 32 cols) threaded through the whole receipt builder — the Xprinter/POS-58 class was previously unusable (wrapped lines). **BTW label honesty**: the thermal bon derives the rate label from the items' actual BTW rates (was hardcoded "BTW 10%"). **Scanner intake widened**: Enter-lookup now accepts numeric 6–14 (UPC-E, EAN-8, UPC-A, EAN-13, ITF-14 cartons, scale codes) plus alphanumeric Code 39/128 supplier SKUs, and strips AIM prefixes — the old `^\d{8,13}$` silently rejected UPC-E/ITF-14/alphanumeric codes (new `lib/barcode.ts`, unit-tested). **POS camera scanner** (CAT-18a): 📷 button next to search, Quagga2 with the full 1D reader set, two-identical-reads guard against camera misreads; dashboard scanner's reader set extended to match (adds UPC-E, Code 39, ITF). Install guide gets **§F0 hardware compatibility matrix** (EN+NL): supported printer brands incl. the Star-emulation caveat, paper widths, HID scanners, symbologies, drawers, scales, PIN terminals, and the thermal-logo limitation. Frontend suite 53 vitest (13 new), tsc clean both SPAs. Same day: dependency freshness/security sweep across all five package trees (0 npm vulns in both SPAs, Laravel 13.20, 282 backend tests, license-server lock created; spatie/permission 8 deliberately held).

- **2026-07-06 (docs-sync)** — Documentation freshness audit (4-lens fan-out → adversarial verify → 29 confirmed gaps) + fix sweep across 40+ manual/dev-doc files (EN+NL). Root cause of "recent features feel undocumented": the **EN dashboard sidebar stopped at ch 18** — ch 19 (Registers), 20 (BTW submissions), 21 (Tax inspector) and 22 existed but were unregistered (NL had them); also EN user-manual §5a unregistered, and orphaned `docs/system-flows.md`/`docs/FLOWS.md` now in the sidebars. Content added/corrected: profit report (§10.4a) + bank reconciliation (§10.5.6) + nine-report table; cash in/out (§19.9a + POS §3.2a) + corrected expected-cash formulas (ch11 §11.8, POS ch10 — day-level vs session-level distinction per code); WBP-S erasure §9.5a (chapter previously claimed the feature didn't exist); SM store-settings rights + NL §2.5a port; welcome-email correction (never contains the password); users bulk actions §3.5a (no bulk delete — documented reality); README "first login" (platform overview + onboarding card); POS manual: blind returns §5a.8, offline indicator, real shortcuts (F2/F4/F9/F12/Esc — verified in code, not the old F1/F3 guesses), favorites row, auto-print, weighed goods §13.9; dev docs: 7th role (tax_inspector, 49-permission catalogue), models table, full BTW filing pipeline, register/Z-report + integration-API chapters rewritten from stubs (idempotency correctly (api_integration_id, external_sale_ref)), notifications + G-026. **Two code fixes that fell out:** BlindReturnModal now offers QR-wallet (backend already accepted it), and **Horizon never consumed the `ai` queue** — `DetectSaleAnomaly` (fraud/anomaly detection, dispatched after every sale) has silently never run since launch; horizon.php now consumes `['default','ai']` (deployed + bounced).

- **2026-07-06** — QR-wallet payments (Mopé / Uni5Pay+) shipped end-to-end: POS top-level 🔳 step (wallet chips, optional TX-ID, 'payment received' attestation → instant confirm; unticked → OA pending queue), V1 API extended to all 7 methods (pre-confirmed, provider fields, OpenAPI json+yaml updated), thermal/PDF/email receipts label all methods + print wallet/ref, Z-Report now persists mixed/transfer/foreign/QR totals (new migration), consolidated + store PDF exports and all breakdown UIs show every method (non-zero gate incl. refund-negatives), refunds blocked on unconfirmed payments + refund rows stamped confirmed, session-report cross-org read closed, EUR foreign-cash no longer stamps the USD rate. DemoSeeder deals ~1-in-6 QR sales. **Addendum (same day):** per-store wallet-QR upload (Dashboard → Store settings → QR wallets, `POST /stores/{id}/wallet-qr`, stored in `settings.wallet_qrs`) + the POS now SHOWS the store's static merchant QR full-size with the amount during the QR step; SPA nginxen proxy `/storage` (fixed broken storage images on droplet); full flow/use-case doc at `docs/qr-payment-flow.md`; +StoreWalletQrTest (6). **Addendum 2:** dashboard-manual hoofdstuk 22 (EN+NL) — betaalmethoden / wallet-QR-setup / openstaande-betalingen-wachtrij / pinapparaat-uitleg — in de hoofd-docs op :8095; docs-sidebar registreert nu ook `qr-payment-flow`. **Card terminals:** POS Settings → 'Pinterminal' met drie modi — losse bankterminal (default, Suriname-praktijk), **gesimuleerde terminal** (demo/training: 'Stuur SRD X naar pinterminal' → virtuele goedkeuring vult bank/autorisatie/laatste-4/terminal-ref automatisch), en ECR-koppeling (disabled optie — vereist bankprotocol, koppelpunt klaar). Manual §5.3 (EN+NL) documenteert alle drie.

- **2026-05-26** — Document created. Triggered by user: *"so you creating any file or what now for our features and flows and all"*. Initial inventory of 100+ features across 11 areas (auth, org/user, licence, catalogue, POS register/sales, reports, sync, API, AI, audit, settings) + 7 critical flows + 5 feature deep-dives + roles matrix + code map. Companion to `CLAUDE_WORKING_GUIDE.md` (engineering discipline) and `CLAUDE.md` (spec).
- **2026-05-26** — Added SET-08 (vendor contact in central config + `useVendor` hook). Triggered by user calling the licence-missing banner copy impractical: *"send a request to support, this you think practical? mention Josbin our org name"*. Companion lesson logged as G-014 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Split USER-07 into USER-07 (Profile, every role) + USER-08 (Performance + Shifts, ring-up roles only). Added USER-09 + USER-10 as 🔲 future tabs for org-scoped roles (activity log, active sessions). Triggered by user spotting "My shifts" tab on Super Admin's My Account: *"do you think its practical, you are AI, why not use intelligence then?"*. Companion lesson logged as G-015 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added SET-09 (role-aware sectioned dashboard nav). Super Admin's flat 20-item nav now splits into Platform (7 items they own) + Support — Tenant Data (12 items they can reach for client support but shouldn't browse) + Account. OA / SM / Auditor get their own role-appropriate sections. POS launcher removed from SA + Auditor (they never ring up sales). Triggered by user: *"also check our super admin, the menus, keep things which a Super admin should see and worry. proper industry standards"*. Companion lesson logged as G-016 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added §1.2b BTW filings to Belastingdienst Suriname (16 features). New `tax_inspector` role — 7th role on the platform, cross-org read-only, BTW-only. New `btw_submissions` table with hash-chain audit + sale-ID traceability + idempotency unique constraint. OA / SM file daily or monthly; preview totals before submit; inspector accepts or disputes. New §3.8 end-to-end journey. tax_inspector added to roles matrix. Demo creds `belastingdienst@gov.sr / Inspector@2026` (2FA mandatory). 10 new PHPUnit tests, all green. Triggered by user: *"create portal for a government /tax dept ... yes all orgs and yes daily option too"*. Companion lesson logged as G-018 in `CLAUDE_WORKING_GUIDE.md`.
- **2026-05-26** — Added POS-12a + POS-13a (Phase 1 card payment reconciliation). Four new nullable columns on `sales` — `card_bank`, `card_approval_code`, `card_terminal_ref`, `card_last_four` — captured from the bank's PIN terminal slip. Card flow now has a dedicated step before submit with a bank dropdown (DSB / Hakrinbank / Finabank / RBC / Republic / Visa / Mastercard / Other) + skippable "Skip & complete" path so the cashier line stays fast. Mixed-payment step gets a collapsible reconciliation panel. Receipt template prints *"Paid by DSB ····4242 · Auth A99887"* when filled. PCI-safe (only last 4, never full PAN). 5 new PHPUnit tests, all green. Triggered by user: *"Ship Phase 1 now"* re payment-methods proposal.

- **2026-07-06** — **REP-12 store report PDF export was broken from birth — now fixed + feature-tested.** `GET /api/reports/export` 500'd on every request since the initial commit: (1) glued Blade directives (`t/m@else to@endif`) never compiled — Blade's `\B@` regex skips a directive preceded by a word character, leaving an unclosed `@if` (same defect in `consolidated`, `btw_consolidated` and ~30 sites in `rekenkamer` blades — all four PDF templates fixed, see G-031). The same-day QR-wallet release had already rewired `summary.blade.php` to `buildRangeSummary()`'s real keys with all 7 payment methods (its G-030 sweep), but the template still didn't compile — nothing rendered it to check; (2) export's monthly type expected `date_from/date_to` but the POS Monthly tab sends `year&month` — now takes the same params as each JSON sibling endpoint; (3) `type=btw` rendered an empty array into the blade → now a clean 422 until the Belastingdienst PDF layout ships; (4) the POS "Export PDF" button built a `?token=<session token>` URL, which the backend rightly ignores (P0-5) → 401 in the browser; replaced with the authenticated-blob pattern from `openReceiptPdf`; (5) `RekenkamerController` compact()'d an undefined `$paymentBreakdown` (warning → ErrorException). New `ReportPdfExportTest` (7 tests, fixtures include a qr_payment sale) renders all four PDF endpoints for real; smoke script probes all four. Live-walked in the browser: login → Reports → Export PDF → real `%PDF` in a new tab.
- **2026-07-02** — Improvement batch (survey-driven). **Correctness:** `external_sale_ref` idempotency scoped to `(api_integration_id, external_sale_ref)` (was global unique + store-only lookup; +`api_integration_id` on sales, +V1SaleIdempotencyTest). **USER-04 → ✅:** welcome-credentials email now actually sends (queued `WelcomeCredentials`, bilingual, no plaintext password). **Dashboard:** bulk multi-select actions on Users + Discount Rules (clone of the BTW checkbox/bulk-bar pattern), first-run onboarding checklist on the overview, shared `EmptyState` component. **POS daily-ops finetunes:** online/offline indicator, quick-reason preset chips (refund/blind-return/Z-discrepancy), favorites/recent product row (localStorage), email-receipt validation + prefill, low/out-of-stock reorder toast, split-payment 50/70/30 presets, one-tap sale-discount clear, "Set up printer" deep-link. **Compliance:** `docs/compliance/` — Verwerkersovereenkomst (DPA), OWASP Top-10 self-assessment, incident-response plan (Dutch). Backend 260 tests, 40 vitest, tsc+builds clean. Gated next (need external inputs): pgvector semantic search (AI key), WAL PITR + offsite backups (bucket), passkeys + hardware-fingerprint binding (large, self-contained). See CLAUDE_WORKING_GUIDE §4 G-029 (deploy decoupled from git; verify agent output).

---

*If something in this file is wrong, it's a bug worth fixing — same as the code.*
