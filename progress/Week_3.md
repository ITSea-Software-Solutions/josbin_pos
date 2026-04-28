# Josbin POS — Week 3 Progress Report
**Phase 2: POS System Build — Part 2 (Transactions, Payments, Receipts)**
Period: Week 3 of 18

---

## Summary

Week 3 completed the core sales loop: a cashier can now scan a product, build a cart,
take payment (cash, card, or mixed), print a receipt, and have the sale synced to the
database. Hold bills, customer management, void/refund, and the barcode scanner
(USB HID + camera) are all functional. The POS is doing real work.

---

## Completed This Week

### Sales Processing (Backend)
- `POST /api/sales` — complete sale with BTW re-validation server-side
  - Atomic DB transaction (sale + items created together or both rolled back)
  - Exchange rate snapshot stored on every sale for audit
  - Sale number auto-generated per store (`STORE-2026-000001` format)
  - Triggers `SaleCompleted` WebSocket broadcast to dashboard
  - Triggers `DetectSaleAnomaly` job (queued, 5s delay, `ai` queue)
- `POST /api/sales/hold` — save cart as held bill, free the POS terminal
- `GET /api/sales/held` — list open held bills for the store
- `DELETE /api/sales/held/{id}` — restore held bill back to cart
- `GET /api/sales/{sale}` — sale detail with items
- `POST /api/sales/{sale}/void` — void a completed sale (manager role, audit logged)
- `POST /api/sales/{sale}/refund` — issue a refund
- `GET /api/sales/{sale}/receipt/pdf` — generate bilingual PDF receipt

### Receipt Generation (Backend)
- `ReceiptService` — generates ESC/POS byte string for thermal printers (EPSON TM-T20 compatible)
- Bilingual receipt: language follows the store's default locale setting
- Receipt includes: store header/footer, sale number, date (DD-MM-YYYY AST), cashier name, item list with BTW per line, subtotal, discount, BTW total, grand total in SRD, payment method, change given, BTW registration number
- `POST /api/sales/{sale}/receipt/email` — sends bilingual HTML receipt via configured mailer
- PDF receipt also available via query-token auth (safe to open in browser/Electron shell)

### Exchange Rate System (Backend)
- `LockDailyRate` scheduled command — runs at 06:00 AST, fetches from ExchangeRate-API, stores in `daily_rates` and Redis cache
- `GET /api/rates` — today's rate and 7-day history
- `POST /api/rates/override` — manual override by manager (logged in audit trail)
- `POST /api/rates/fetch` — force-fetch latest rate on demand
- All sales store `exchange_rate_used` at time of transaction (immutable audit record)

### Barcode Scanner (Frontend)
- **USB HID (keyboard wedge)**: works automatically — scanner types barcode into search field, `Enter` on 8-13 digit string triggers `GET /api/products/barcode/{barcode}` lookup, product added to cart in <200ms
- **Camera scanner**: Quagga2 integrated, supports EAN-13, Code 128, UPC-A; access camera button in search bar
- Manual barcode entry: type any barcode in search field and press Enter

### POS Frontend — Payment & Checkout
- `PaymentModal.tsx` — three payment modes:
  - **Cash**: on-screen numpad, real-time change calculation (tendered − total)
  - **Card/PIN**: confirm flow with amount shown
  - **Mixed**: split cash + card amounts, validates they sum to total
- Payment modal submits sale to API, handles optimistic UI with loading state
- `ReceiptModal.tsx` — post-sale screen: print to thermal printer, email receipt, "New Sale" button clears cart

### POS Frontend — Customer Management
- `CustomerModal.tsx` — search existing customers by name or phone (live search), add new customer on-the-fly without leaving POS (name, phone, email), set walk-in default
- Customer attached to sale on submit if selected

### POS Frontend — Hold Bills
- `HeldBillsPanel.tsx` — slide-out panel showing all open held bills for this store, tap to restore (replaces current cart), delete to discard

### POS Frontend — Cart Editing
- `DiscountModal.tsx` — apply % or fixed SRD discount to a single line item or the entire sale; BTW recalculated immediately
- `LineItemEditModal.tsx` — edit unit price, quantity, BTW rate, or discount for any line item mid-sale

### WebSocket Events Defined (Reverb)
All events created and wired to their broadcast channels:

| Event | Channel | Payload |
|---|---|---|
| `SaleCompleted` | `store.{storeId}` | Sale totals, payment method |
| `ProductUpdated` | `org.{orgId}` | Product fields for POS cache invalidation |
| `CatalogueRefresh` | `org.{orgId}` | Product count, triggered-by user |
| `ZReportSubmitted` | `store.{storeId}` | Z-report summary |
| `StoreStatusChanged` | `org.{orgId}` | Online/offline status |
| `LicenseWarning` | `org.{orgId}` + `store.{storeId}` | Status, valid-until, message NL/EN |

---

## Testing
- Sale creation: integration tests (sale + items persisted, BTW correct, exchange rate stored)
- Void/refund: policy enforcement tests (cashier cannot void, manager can)
- Barcode lookup: sub-100ms verified in test environment
- Receipt PDF: rendered and checked for all required BTW fields

---

## Next Week Preview

Week 4 completes Phase 2: store-level reports (daily, monthly, custom, X-report,
Z-report), barcode label printing, the End of Day screen, Settings, and USB
encrypted sync export (.josbin_pos file).
