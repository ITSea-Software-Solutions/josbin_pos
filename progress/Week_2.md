# Josbin POS — Week 2 Progress Report
**Phase 2: POS System Build — Part 1 (Authentication, Products, Cart)**
Period: Week 2 of 18

---

## Summary

Week 2 delivered the first working software: login, user roles, the product catalogue
system, and the core POS sell screen with a working cart. By end of week the team
could log in with a store cashier account, browse products by category, add items to
a cart, and see live BTW calculations — the core POS loop working end to end.

---

## Completed This Week

### Authentication System (Backend)
- `POST /api/auth/login` — returns Sanctum token on success
- `POST /api/auth/two-factor-challenge` — TOTP 2FA verification (pragmarx/google2fa)
- `GET /api/auth/two-factor/setup` — returns QR code URL for authenticator app
- `POST /api/auth/two-factor/confirm` — confirms and activates 2FA
- `GET /api/auth/me` — returns authenticated user with role and permissions
- `POST /api/auth/refresh` — refreshes token, preserves 2FA-verified ability
- `POST /api/auth/logout` / `logout-all` — single and all-device logout
- Session timeout middleware: 15 min POS, 60 min dashboard
- Three login outcomes handled: normal, 2FA challenge required, 2FA setup required
- Pre-auth tokens with specific `abilities` control the 2FA flow state

### Role-Based Access Control
Six roles implemented with full policy enforcement at API level (not just hidden in UI):

| Role | Access |
|---|---|
| `super_admin` | Full platform — all organisations |
| `organisation_admin` | Their organisation only |
| `store_manager` | Their assigned stores |
| `cashier` | POS screen only |
| `auditor` | Read-only — all reports and audit log |
| `api_integration` | Machine account for third-party POS systems |

### User, Organisation & Store Management (Backend)
- Full CRUD for Organisations (`/api/organisations`)
- Full CRUD for Stores (`/api/stores`)
- Full CRUD for Users (`/api/users`) — includes activate and reset-2FA endpoints
- Organisation-level isolation enforced on all queries

### Product Catalogue (Backend)
- Full CRUD for Categories (`/api/categories`) — Dutch/English names, icon, colour
- Full CRUD for Products (`/api/products`)
  - Bilingual: `name_nl` + `name_en`
  - `price` in SRD (DECIMAL 12,2)
  - `btw_rate` per product, `btw_exempt` flag (basic foodstuffs, medicine)
  - `stock_qty` (DECIMAL 10,3 — supports weight-based products)
  - `barcode` indexed for sub-100ms scanner lookup
  - Per-store price overrides via `store_product_overrides` table
- `GET /api/products/pos` — minimal payload optimised for POS grid (fast)
- `GET /api/products/barcode/{barcode}` — sub-100ms scanner lookup
- `POST /api/products/import` — CSV bulk import (name_nl, name_en, barcode, price, btw_rate, stock_qty)

### BTW Calculation Engine (Backend)
Full `BtwCalculationService` implemented — the financial heart of Josbin POS:
- Per line item: `unit_price × qty − discount_srd = net; net × btw_rate% = btw_amount`
- BTW-exempt check: if `btw_exempt = true`, BTW is always 0 regardless of rate
- Discount applied **before** BTW extraction (correct Belastingdienst Suriname order)
- All arithmetic via `bcmath` with scale 2 — no float rounding errors
- 50+ unit test scenarios written covering all edge cases:
  - Zero BTW rate, 10% rate, exempt flag
  - Discounts at item level and sale level
  - Fractional quantities (0.5kg × SRD 12.00)
  - Zero-value items, maximum discount

### POS Frontend — Login & Store Select
- `LoginScreen.tsx` — email + password, Dutch/English, error handling
- `TwoFactorScreen.tsx` — TOTP 6-digit input for challenge, QR setup flow with recovery codes
- `StoreSelectScreen.tsx` — lists stores the user has access to, saves `storeId` to settings store

### POS Frontend — Core Sell Screen
- `POSScreen.tsx` — main screen orchestrator
- `TopBar.tsx` — logo, navigation tabs, today's totals, language toggle, user/logout
- `CategoryFilter.tsx` — horizontal scrollable category pills, tap to filter
- `ProductGrid.tsx` — responsive grid, product cards with name (Dutch/English based on language), price in SRD, stock indicator
- `ProductCard.tsx` — tap to add to cart, visual feedback
- `CartPanel.tsx` — full cart with line items, quantities, item discounts, live BTW breakdown, total

### Cart State (Zustand)
- `cartStore.ts` — items, customer, sale-level discount
- `totals` computed: subtotal, discount, BTW, total — all in SRD via bcmath-equivalent TS
- Persists in-memory only (no localStorage — security requirement)

---

## Testing
- BTW Calculation Service: 50+ unit tests passing (PHPUnit)
- Authentication endpoints: integration tests passing
- All tests run in CI on every commit

---

## Next Week Preview

Week 3 completes the core POS flow: payment processing (cash/card/mixed), receipt
generation, barcode scanner integration, hold bills, and customer management.
