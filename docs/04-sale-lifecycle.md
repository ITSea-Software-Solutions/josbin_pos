# 4 — Sale lifecycle

What happens between the cashier tapping **Pay** and the receipt rolling out of the thermal printer. Two hundred milliseconds, eleven moving parts, one DB transaction.

```
   Cashier tap          Sync HTTP (target < 200 ms)         Queue (async)
   ──────────         ───────────────────────────────       ─────────────
                                                                       
   PaymentModal ──▶ POST /api/sales                                    
                       │                                               
                       ├─ Sanctum + license + 2FA + idle                
                       ├─ validate                                     
                       ├─ DiscountRuleService::applyRules               
                       ├─ BtwCalculationService::calculateCart          
                       └─ DB::transaction                              
                            ├─ RegisterSession lookup                   
                            ├─ Sale::nextNumber  (advisory lock)        
                            ├─ Sale::create                             
                            ├─ SaleItem::create × N                     
                            └─ customer.spend++                         
                       │                                               
                       │── 201 ─────────▶ POSScreen ─▶ ReceiptModal     
                       │                                                
                       ▼                                                
                  RecordStockMovements ─▶ Horizon (default queue)       
                  SaleCompleted broadcast ─▶ Reverb (toOthers)          
                  DetectSaleAnomaly      ─▶ Horizon (ai queue +5 s)     
```

The synchronous path returns the saved `Sale` model. Stock, broadcast and fraud scan are deferred so a slow printer or a busy AI worker can never delay the next sale.

---

## 1. HTTP entry

| | |
|---|---|
| Method, path | `POST /api/sales` |
| Auth | Sanctum bearer (POS terminal token) |
| Middleware stack | `auth:sanctum` → `EnsureLicenseValid` → `EnsureTwoFactor` → `SessionTimeout` |
| Controller | `SaleController::store` — `backend/app/Http/Controllers/Api/SaleController.php:37` |
| Route definition | `backend/routes/api.php:186` |

The Sanctum token is issued to a `User` row whose role is `cashier`. `EnsureTwoFactor` is a no-op for cashiers — only Super Admin and government users hit it. `SessionTimeout` returns `401 SESSION_EXPIRED` once the token is past its declared 12-hour expiry; there is no idle timer that revokes earlier. The 15-min / 60-min idle policy is still TBD — see [03-auth-and-roles §session timeout](03-auth-and-roles.md).

### Authorisation

`$this->authorize('create', Sale::class)` at `SaleController.php:39` runs the `SalePolicy::create` check via spatie/laravel-permission. A `cashier` has `sales.create`; a read-only `auditor` does not.

### Validation

The request body is validated as a flat object plus a non-empty `items` array. Notable rules at `SaleController.php:41-60`:

| Field | Rule | Why |
|---|---|---|
| `store_id` | `uuid`, `StoreBelongsToOrg` | Cross-org sale spoofing blocked at validator, not after retrieval |
| `payment_method` | `in:cash,card,mixed` | Three branches downstream — drawer kick, card amount, change |
| `items.*.quantity` | `numeric, min:0.001` | Decimal quantities for weighed goods (rice by the kg) |
| `items.*.btw_rate` | `numeric, min:0, max:100` | Defensive — service re-asserts this |
| `external_sale_ref` | `string, max:100` | Idempotency key for the third-party API and offline catch-up |

### Idempotency (early exit)

If `external_sale_ref` is sent **and** a sale with the same `(store_id, external_sale_ref)` already exists, the controller returns the existing record with status `200` and skips everything below. Code at `SaleController.php:62-70`. This is the deduplication knot that makes offline catch-up safe — chapter 7 covers the wider replay protocol.

### Daily-rate gate

```
$rate = \App\Models\DailyRate::todayRate();
if (! $rate) return 422 NO_DAILY_RATE;
```

`SaleController.php:73-79`. Selling without a locked USD→SRD rate is refused with a Dutch error message. The locked rate is later copied onto the sale row as `exchange_rate_used` so receipts and audit reports stay reproducible if the rate is later edited.

---

## 2. Discount rules

`DiscountRuleService::applyRules($orgId, $storeId, $rawItems)` —
`backend/app/Services/DiscountRuleService.php:33`.

Loads every active rule for the org in one query, then evaluates in priority order:

| Order | Rule scope | Behaviour |
|---|---|---|
| 1 | `product` | Per-SKU rules; `min_qty` gate; stops further line-level rules unless `stackable` |
| 2 | `category` | Whole-category rules; same `min_qty` gate; can stack on top of product rule |
| 3 | `cart`    | Computed on the post-line-discount subtotal |

Rule types are `pct_discount`, `fixed_discount`, and `buy_x_get_y` (line 129). All discount maths use bcmath, scale 4, so combining rules cannot drift.

Return shape:

```php
[
  'items'             => [ ... 'applied_discount_srd' => '0.50' ... ],
  'cart_discount_srd' => '2.00',
  'applied_rules'     => ['Weekend special', 'Buy 3 get 1 rice'],
]
```

The controller merges the per-item `applied_discount_srd` with any **manual** `discount_srd` the cashier set on a line (`SaleController.php:97-107`), and adds the rule-driven `cart_discount_srd` on top of any manual `sale_discount_srd` (`SaleController.php:110-112`). Both layers are summed *before* BTW — see chapter 5 for why the order matters for Belastingdienst compliance.

---

## 3. BTW calculation

```
$cart = $this->btw->calculateCart(
    $cartItems,
    saleDiscountSrd: $combinedCartDiscountSrd,
    saleDiscountPct: $manualCartDiscountPct,
);
```

`SaleController.php:114-118`. The cart object returned holds `subtotal`, `sale_discount`, `btw_total`, `total`, and an `items` array with per-line BTW snapshots. Everything is a string — pure bcmath all the way down.

Full breakdown of the math, the rounding rules and the 50+ unit-test scenarios is in [chapter 5](05-btw-pipeline.md).

---

## 4. The DB transaction

Wrapped in `DB::transaction(function () use (...) { ... })` at `SaleController.php:120`. Postgres holds advisory locks for the duration of the transaction, so the sale-number lock and the row writes commit or roll back together.

### 4.1 Payment-amount derivation

```php
$totalPaid = bcadd($cashTendered ?? '0', $cardAmount ?? '0', 2);
$changeDue = bccomp($totalPaid, (string) $cart['total'], 2) > 0
    ? bcsub($totalPaid, (string) $cart['total'], 2)
    : '0.00';
```

`SaleController.php:122-127`. Mixed payments split the basket across cash and PIN; `change_srd` is only non-zero when more cash was tendered than owed.

### 4.2 Register session lookup

```php
$registerSessionId = RegisterSession::where('cashier_id', $request->user()->id)
    ->where('store_id', $data['store_id'])
    ->where('status', 'open')
    ->latest('opened_at')
    ->value('id');
```

`SaleController.php:131-135`. Every sale is now tied to the cashier's currently open register session so per-session reports (mini Z-Report, cash reconciliation) match the sales they describe. The FK column was added in migration `2026_04_14_100002_add_register_session_id_to_sales.php` and is `nullable` — sales made through the third-party API or imported via USB have no session and stay NULL.

If the cashier somehow has no open session, the sale still records (NULL FK) rather than failing — refusing the sale would punish the customer for a back-office bug. The audit log shows the gap, the Z-Report flags it.

### 4.3 Sale number

`Sale::nextNumber($storeId)` — `backend/app/Models/Sale.php:92`:

```php
DB::select('SELECT pg_advisory_xact_lock(hashtext(?))',
    ["sale_number:{$storeId}:{$year}"]);

$count = static::where('store_id', $storeId)
    ->whereYear('occurred_at', $year)->count() + 1;

return sprintf('POS-%s-%05d', $year, $count);
```

The Postgres advisory lock is scoped to `(store_id, year)` so two cashiers at the **same** store serialise number allocation, while two cashiers at **different** stores never block each other. The lock is held until the transaction commits — `nextNumber` only ever produces a number that the surrounding `Sale::create` will commit. No gaps, no duplicates, no `unique` index violation on the second concurrent sale.

Format: `POS-2026-00042`.

### 4.4 `Sale::create`

`SaleController.php:137-156`. Every column the schema cares about is set explicitly:

| Column | Source |
|---|---|
| `store_id`, `cashier_id` | Request + Sanctum user |
| `register_session_id` | 4.2 lookup |
| `sale_number` | 4.3 advisory lock |
| `subtotal_srd`, `discount_srd`, `btw_srd`, `total_srd` | `$cart` from BTW service |
| `payment_method` | Validated `cash`/`card`/`mixed` |
| `cash_received_srd`, `card_amount_srd`, `change_srd` | 4.1 derivation |
| `status` | Always `completed` here — holds use a separate route |
| `source` | `pos` (default), `api`, or `import` |
| `exchange_rate_used` | Snapshot of `daily_rates.usd_to_srd` for today |
| `external_sale_ref` | Idempotency key (NULL for native POS) |
| `occurred_at` | Client-supplied or `now()` — supports offline catch-up |

The model implements `OwenIt\Auditing\Contracts\Auditable` (`Sale.php:12`), so the row insert automatically writes a row to `audits` with the full before/after JSON for the audit log.

### 4.5 `SaleItem::create` × N

Loop at `SaleController.php:158-175`. Per item:

| Column | Source |
|---|---|
| `product_name_snapshot` | Frozen at sale time — survives later product renames |
| `unit_price_srd` | Snapshot of price at sale time |
| `quantity` | Decimal qty |
| `discount_srd` | Computed from BTW result: `line_gross − line_net` |
| `discount_pct` | Always `'0.00'` — manual pct discounts are normalised to SRD upstream |
| `btw_rate`, `btw_exempt` | Snapshots |
| `btw_srd` | Per-line BTW amount from `calculateCart` |
| `line_total_srd` | Per-line net (post item & sale discount) |

The discount amount the row stores is the **combined** item + share-of-sale-level discount, because that is the actual concession given on this line. Reports that need to separate the two read both `sales.discount_srd` (cart-level) and `sale_items.discount_srd` (per-line aggregate).

### 4.6 Customer counters

```php
if ($sale->customer_id) {
    Customer::where('id', $sale->customer_id)->increment('visit_count');
    Customer::where('id', $sale->customer_id)
        ->increment('total_spend_srd', (float) $cart['total']);
}
```

`SaleController.php:178-182`. Two atomic increments. Walk-in sales (no `customer_id`) skip both.

---

## 5. After the transaction commits

Three queued effects, dispatched **after** `DB::transaction` returns the saved `$sale` so each background worker sees committed rows.

### 5.1 Stock movement job

```
RecordStockMovements::dispatch($sale->id, $request->user()->id, 'sale');
```

`SaleController.php:188`. Defined at `backend/app/Jobs/RecordStockMovements.php:20`:

| Property | Value |
|---|---|
| Queue | `default` (Horizon) |
| Retries | `3` |
| Back-off | `[30, 120, 600]` seconds |
| Failure handler | Logs to `josbin_pos.log`; nothing emails the manager yet |

The job re-reads the sale (`Sale::with('items')->find($saleId)`) and switches on the `reason`:

```php
match ($this->reason) {
    'sale'           => $stock->recordSale($sale, $this->userId),
    'void', 'refund' => $stock->recordVoidOrRefund($sale, $this->reason, $this->userId),
}
```

`recordSale` walks each item and calls `StockMovementService::record(...)` —
`backend/app/Services/StockMovementService.php:93`. **The stock is now per-store.** Before migration `2026_05_25_054551_create_product_stocks_table.php` (24th May) `products.stock_qty` was a single column shared across every store in an organisation — two cashiers at two branches could oversell from the same counter. The migration created `product_stocks (product_id, store_id, stock_qty, low_stock_threshold)` with a unique `(product_id, store_id)` index, backfilled one row per pair, and now `StockMovementService` locks the `product_stocks` row for this `(product, store)` via `lockForUpdate()` (line 53). Sales at *different* stores for the same SKU no longer block each other.

If a `product_stocks` row is missing (a brand-new store added after backfill), the service auto-creates it from the product's default `stock_qty`/`low_stock_threshold` — lines 60-69.

Each call also writes a `stock_movements` row with the signed `qty_change`, the `qty_after`, the reason, the user, and **the sale UUID**. The `sale_id` column was originally created as `bigInteger` — a real production sale would have failed every time with `PDOException: invalid input syntax for type bigint`. Migration `2026_05_25_050301_change_stock_movements_sale_id_to_uuid.php` dropped and re-added the column as `uuid` with the correct FK to `sales.id`.

### 5.2 SaleCompleted broadcast

```
broadcast(new SaleCompletedEvent($sale->load('store')))->toOthers();
```

`SaleController.php:191`. The event implements `ShouldBroadcast` and is queued through the `default` connection — the controller never blocks on Reverb.

`backend/app/Events/SaleCompleted.php:29-34`:

```php
public function broadcastOn(): array
{
    return [
        new PrivateChannel("store.{$this->sale->store_id}"),
        new PrivateChannel("org.{$this->sale->store->organisation_id}"),
    ];
}
```

Two private channels in parallel:

| Channel | Subscriber | Purpose |
|---|---|---|
| `store.{storeId}` | POS terminals in the same store | Sibling terminals refresh their "today total" widget |
| `org.{organisationId}` | Super Admin Dashboard live tiles | HQ sees revenue tick up in real time |

Channel auth lives in `backend/routes/channels.php:25-55` — a user must belong to the organisation (or be a Super Admin) to subscribe. Government org channels are isolated from commercial ones.

`->toOthers()` is the Sanctum-aware version that excludes the *socket* that originated the broadcast — so the cashier's own terminal does not echo its own sale back. Other terminals in the same store still receive it.

Payload sent to subscribers — `SaleCompleted::broadcastWith` (line 42):

```
sale_id, sale_number, store_id, store_name, organisation_id,
total_srd, btw_srd, payment_method, occurred_at, cashier_name
```

No line items in the broadcast — full detail is one `GET /api/sales/{id}` away. Keeps the WebSocket payload tiny for a network of 50 terminals.

### 5.3 Anomaly detection

```
DetectSaleAnomaly::dispatch($sale->id)->onQueue('ai')->delay(now()->addSeconds(5));
```

`SaleController.php:194`. Five-second delay so the sale, items and stock are all settled before the heuristics run. Job at `backend/app/Jobs/DetectSaleAnomaly.php:33`:

| Heuristic | Threshold |
|---|---|
| Off-hours sale | Before 06:00 or after 23:00 AST |
| Large discount | `> 30%` of (total + discount) |
| Z-score basket size | `> 2.5σ` from the store's last-30-day mean |
| Cashier void burst | `≥ 3` voided sales by same cashier in last hour |
| Non-positive total on a non-void | `<= 0.00` |

Code at `DetectSaleAnomaly.php:93-153`. If any heuristic fires, the job optionally asks GPT-4o for a one-paragraph Dutch risk narrative (only when `AiService::isConfigured()` returns true) and writes an `AuditLog` row with `event = 'anomaly_detected'`. The audit row goes through `AuditLog::create` rather than a raw DB insert so the tamper-evident SHA-256 hash chain stays intact — see chapter 3 for the audit hash protocol.

The job has no notification side-effect today; flagged sales surface in the Super Admin Dashboard's audit log view.

---

## 6. Receipt rendering

The response body is the saved `$sale` with eager-loaded items. The frontend then opens `<ReceiptModal>` which has three rendering paths:

| Channel | Builder | Transport |
|---|---|---|
| Thermal print | `buildReceiptBytes()` in `frontend/src/lib/escpos.ts` | `printEscPos(bytes, printer)` |
| PDF (80 mm) | `ReceiptService::generatePdf` — `backend/app/Services/ReceiptService.php:127` | DomPDF, served by `GET /api/sales/{sale}/receipt/pdf` |
| Email | `ReceiptService::sendEmail` — `ReceiptService.php:142` | `Mail::html(view('emails.receipt'))` |

### 6.1 ESC/POS

`buildReceiptBytes` returns a `Uint8Array` of EPSON TM-T20 commands. `printEscPos` in `frontend/src/lib/hardware.ts:50` chooses transport from the `PrinterConfig` saved per terminal:

| `config.type` | Path |
|---|---|
| `network` | TCP socket to `ip:port` (default 9100), Electron `print:network` IPC at `frontend/electron/main.ts:134` |
| `usb` | Windows spooler — temp file + `print /D:"<printerName>" file.bin`, `electron/main.ts:148` (Windows only) |
| `none` | No-op; PDF/email still available |

### 6.2 Cash drawer kick

Triggered in `frontend/src/components/pos/PaymentModal.tsx:63-67` immediately after the `createSale` mutation succeeds:

```ts
if ((step === 'cash' || step === 'mixed') && printer.type !== 'none') {
  openCashDrawer(printer).catch(() => {
    // Drawer failure is non-fatal — sale is already recorded
  })
}
```

`openCashDrawer` builds the `CASH_DRAWER_1` pulse — bytes `[ESC, 0x70, 0x00, 0x19, 0xfa]` defined in `frontend/src/lib/escpos.ts:33` — and pushes them through the same printer transport. Card-only payments do not kick the drawer (the till stays closed for PIN transactions).

### 6.3 BTW breakdown on the receipt

`ReceiptService::buildViewData` groups items by `btw_rate` for the receipt's BTW table — `ReceiptService.php:45-55`. Exempt items are excluded from the breakdown but still appear in the line listing with a "BTW-vrij" label. Per-store `receipt_btw_number` overrides the organisation default (line 77).

USD conversion is added when the sale has an `exchange_rate_used`: `total_usd = total_srd / exchange_rate_used` — non-cosmetic, this is what lets tourists pay in mental USD.

---

## 7. Refund path

`POST /api/sales/{sale}/refund` — `SaleController.php:345`.

A refund **is not an UPDATE** on the original sale. It is a *new* `Sale` row whose monetary columns are negative, linked to the original via `void_reason = 'REFUND: ...'` and sharing the original's `customer_id`, `payment_method`, `exchange_rate_used`.

| Refund column | Value |
|---|---|
| `sale_number` | New, via `Sale::nextNumber` — refunds get their own number |
| `subtotal_srd`, `total_srd`, `btw_srd` | Negative |
| `status` | `completed` (the refund itself completed; the original stays `completed` too) |
| `source` | Copied from original |
| `void_reason` | `'REFUND: ' + reason` |

Per-line, `quantity` is stored as a negative string (`'-' . $qty`) and `btw_srd`/`line_total_srd` are negated proportionally (`qtyRatio = refundQty / originalQty`).

Post-commit, the controller dispatches `RecordStockMovements::dispatch($refund->id, $userId, 'refund')` (line 417). `StockMovementService::recordVoidOrRefund` reads each refund-sale item, takes `abs((float) $item->quantity)` and posts a **positive** `qty_change` — stock is restored. The same code path serves voids, distinguished only by the `reason` string.

Authorisation is `$this->authorize('refund', $sale)`; only completed sales can be refunded.

---

## 8. Void path

`POST /api/sales/{sale}/void` — `SaleController.php:216`.

A void marks the original sale's `status = 'voided'` and writes `voided_by`, `voided_at`, `void_reason`. No new sale row is created.

**Dual approval for government organisations**:

```
$needsSecondApproval = $store?->organisation?->is_government ?? false;
```

`SaleController.php:230`. The flow:

| Step | Govt store | Non-govt store |
|---|---|---|
| 1st `POST /void` | Records `voided_by` + reason, status **stays** `completed`, returns `VOID_PENDING_APPROVAL` | Marks status `voided` immediately |
| 2nd `POST /void` | Marks status `voided`, sets `void_approved_by` to the second user | n/a |

The segregation-of-duties guard is at `SaleController.php:249-254`:

```php
if ($needsSecondApproval && $sale->voided_by === $request->user()->id) {
    return 422 VOID_SAME_APPROVER;
}
```

The first approver cannot also be the second approver — required by the Rekenkamer compliance protocol. The two user IDs end up on different columns (`voided_by` vs `void_approved_by`) so the audit trail shows both names.

Stock is restored by `RecordStockMovements::dispatch($sale->id, $userId, 'void')` at line 268 — same job as the refund path, different reason flag.

---

## 9. Third-party API path (Layer 3)

A separate controller handles external POS submissions: `App\Http\Controllers\V1\SaleController` —
`backend/app/Http/Controllers/V1/SaleController.php`.

| | Sanctum POS path | Integration API path |
|---|---|---|
| Auth | Sanctum bearer | `X-API-Key` (ValidateApiKey middleware) |
| Cashier | `auth()->user()->id` | `null` (no human) |
| Idempotency key | `external_sale_ref` (optional) | `sale_ref` (**required**) |
| Batch endpoint | — | `POST /v1/sales/batch` (max 500 sales) |
| Webhook on success | — | `DispatchWebhook::dispatchIfActive($orgId, 'sale.created', ...)` |
| Broadcast | Yes (Reverb) | No (third-party sales do not push to the dashboard live tiles) |
| Stock movements | Yes | No (third-party POS owns its own stock) |
| Anomaly detection | Yes | No |

The idempotency check is the same `external_sale_ref` lookup, returning the existing record with `200` — `V1/SaleController.php:56-61`.

`POST /v1/sales/batch` (line 152) is a thin wrapper around `store` — it iterates the array, recreates a sub-request per item, and counts `{ created, skipped, failed, errors[] }`. The 500-item cap exists so an offline branch with two weeks of catch-up data can stream sensibly without one giant transaction.

---

## 10. Where each piece lives

```
POST /api/sales
└── backend/routes/api.php:186
    └── App\Http\Controllers\Api\SaleController
        ├── store()        SaleController.php:37
        ├── void()         SaleController.php:216
        ├── refund()       SaleController.php:345
        ├── hold()         SaleController.php:279
        ├── show()         SaleController.php:202
        └── index()        SaleController.php:461

   Services
   ├── DiscountRuleService::applyRules         backend/app/Services/DiscountRuleService.php:33
   ├── BtwCalculationService::calculateCart    backend/app/Services/BtwCalculationService.php:107
   ├── ReceiptService::generatePdf             backend/app/Services/ReceiptService.php:127
   ├── ReceiptService::sendEmail               backend/app/Services/ReceiptService.php:142
   └── StockMovementService::recordSale        backend/app/Services/StockMovementService.php:93

   Models
   ├── Sale                                    backend/app/Models/Sale.php
   ├── Sale::nextNumber  (advisory lock)       backend/app/Models/Sale.php:92
   ├── SaleItem                                backend/app/Models/SaleItem.php
   ├── RegisterSession                         backend/app/Models/RegisterSession.php
   ├── DailyRate::todayRate                    backend/app/Models/DailyRate.php:33
   └── ProductStock  (per-store inventory)     backend/app/Models/ProductStock.php

   Jobs (queued)
   ├── RecordStockMovements  (default queue)   backend/app/Jobs/RecordStockMovements.php
   └── DetectSaleAnomaly     (ai queue, +5s)   backend/app/Jobs/DetectSaleAnomaly.php

   Events
   └── SaleCompleted                           backend/app/Events/SaleCompleted.php
       channels: store.{id}, org.{id}          backend/routes/channels.php:25-55

   Frontend
   ├── PaymentModal                            frontend/src/components/pos/PaymentModal.tsx
   ├── ReceiptModal                            frontend/src/components/pos/ReceiptModal.tsx
   ├── createSale  API client                  frontend/src/api/sales.ts
   ├── buildReceiptBytes  (ESC/POS)            frontend/src/lib/escpos.ts
   ├── printEscPos / openCashDrawer            frontend/src/lib/hardware.ts
   └── Electron print IPC                      frontend/electron/main.ts

   Migrations of note
   ├── add register_session_id to sales        2026_04_14_100002_add_register_session_id_to_sales.php
   ├── per-store product_stocks                2026_05_25_054551_create_product_stocks_table.php
   └── stock_movements.sale_id → uuid          2026_05_25_050301_change_stock_movements_sale_id_to_uuid.php

   Third-party API (Layer 3)
   ├── POST /v1/sales        store()           backend/app/Http/Controllers/V1/SaleController.php:35
   └── POST /v1/sales/batch  batch()           backend/app/Http/Controllers/V1/SaleController.php:152
```

---

→ Next: [5 — BTW pipeline](05-btw-pipeline.md)
