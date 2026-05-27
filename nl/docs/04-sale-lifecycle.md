# 4 — Verkooplevenscyclus

Wat gebeurt er tussen het tikken van **Betalen** door de kassier en de bon die uit de thermische printer rolt. Tweehonderd milliseconden, elf bewegende delen, één DB-transactie.

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

Het synchrone pad retourneert het opgeslagen `Sale`-model. Voorraad, broadcast en fraude-scan worden uitgesteld zodat een trage printer of een drukke AI-worker nooit de volgende verkoop kan vertragen.

---

## 1. HTTP-entry

| | |
|---|---|
| Method, path | `POST /api/sales` |
| Auth | Sanctum bearer (POS-terminal-token) |
| Middleware-stack | `auth:sanctum` → `EnsureLicenseValid` → `EnsureTwoFactor` → `SessionTimeout` |
| Controller | `SaleController::store` — `backend/app/Http/Controllers/Api/SaleController.php:37` |
| Route-definitie | `backend/routes/api.php:186` |

De Sanctum-token wordt uitgegeven aan een `User`-rij waarvan de rol `cashier` is. `EnsureTwoFactor` is een no-op voor cashiers — alleen Super Admin en government-gebruikers raken hem. `SessionTimeout` retourneert `401 SESSION_EXPIRED` zodra het token zijn opgegeven 12-uurs-expiry voorbij is; er is geen idle timer die eerder revocet. De 15-min / 60-min idle policy is nog TBD — zie [03-auth-and-roles §session timeout](03-auth-and-roles.md).

### Authorisatie

`$this->authorize('create', Sale::class)` op `SaleController.php:39` runt de `SalePolicy::create`-check via spatie/laravel-permission. Een `cashier` heeft `sales.create`; een read-only `auditor` niet.

### Validatie

De request body wordt gevalideerd als een plat object plus een niet-lege `items`-array. Opvallende regels op `SaleController.php:41-60`:

| Veld | Regel | Waarom |
|---|---|---|
| `store_id` | `uuid`, `StoreBelongsToOrg` | Cross-org sale-spoofing geblokkeerd op de validator, niet na ophalen |
| `payment_method` | `in:cash,card,mixed` | Drie branches downstream — drawer kick, card amount, change |
| `items.*.quantity` | `numeric, min:0.001` | Decimale hoeveelheden voor gewogen goederen (rijst per kg) |
| `items.*.btw_rate` | `numeric, min:0, max:100` | Defensief — service re-asserteert dit |
| `external_sale_ref` | `string, max:100` | Idempotency key voor de third-party API en offline catch-up |

### Idempotency (vroege exit)

Als `external_sale_ref` wordt verzonden **en** een verkoop met dezelfde `(store_id, external_sale_ref)` al bestaat, retourneert de controller het bestaande record met status `200` en slaat alles hieronder over. Code op `SaleController.php:62-70`. Dit is de deduplicatie-knoop die offline catch-up veilig maakt — hoofdstuk 7 behandelt het bredere replay-protocol.

### Daily-rate-gate

```
$rate = \App\Models\DailyRate::todayRate();
if (! $rate) return 422 NO_DAILY_RATE;
```

`SaleController.php:73-79`. Verkopen zonder een gelockte USD→SRD-koers wordt geweigerd met een Nederlandse foutmelding. De gelockte koers wordt later op de sale-rij gekopieerd als `exchange_rate_used` zodat bonnen en audit-rapporten reproduceerbaar blijven als de koers later wordt bewerkt.

---

## 2. Discount-regels

`DiscountRuleService::applyRules($orgId, $storeId, $rawItems)` —
`backend/app/Services/DiscountRuleService.php:33`.

Laadt elke actieve regel voor de org in één query, evalueert dan in prioriteitsvolgorde:

| Volgorde | Rule-scope | Gedrag |
|---|---|---|
| 1 | `product` | Per-SKU-regels; `min_qty`-gate; stopt verdere line-level-regels tenzij `stackable` |
| 2 | `category` | Hele-categorie-regels; dezelfde `min_qty`-gate; kan stapelen op product-regel |
| 3 | `cart`    | Berekend op het post-line-discount-subtotaal |

Rule-types zijn `pct_discount`, `fixed_discount` en `buy_x_get_y` (regel 129). Alle discount-math gebruikt bcmath, scale 4, zodat het combineren van regels niet kan driften.

Return-shape:

```php
[
  'items'             => [ ... 'applied_discount_srd' => '0.50' ... ],
  'cart_discount_srd' => '2.00',
  'applied_rules'     => ['Weekend special', 'Buy 3 get 1 rice'],
]
```

De controller merget de per-item `applied_discount_srd` met elke **handmatige** `discount_srd` die de kassier op een regel heeft gezet (`SaleController.php:97-107`), en voegt de regel-gedreven `cart_discount_srd` toe bovenop elke handmatige `sale_discount_srd` (`SaleController.php:110-112`). Beide lagen worden gesommeerd *voor* BTW — zie hoofdstuk 5 voor waarom de volgorde van belang is voor Belastingdienst-compliance.

---

## 3. BTW-berekening

```
$cart = $this->btw->calculateCart(
    $cartItems,
    saleDiscountSrd: $combinedCartDiscountSrd,
    saleDiscountPct: $manualCartDiscountPct,
);
```

`SaleController.php:114-118`. Het cart-object dat wordt geretourneerd bevat `subtotal`, `sale_discount`, `btw_total`, `total` en een `items`-array met per-line BTW-snapshots. Alles is een string — pure bcmath helemaal omlaag.

Volledige breakdown van de math, de afrondingsregels en de 50+ unit-test-scenario's staat in [hoofdstuk 5](05-btw-pipeline.md).

---

## 4. De DB-transactie

Verpakt in `DB::transaction(function () use (...) { ... })` op `SaleController.php:120`. Postgres houdt advisory locks vast voor de duur van de transactie, dus de sale-number-lock en de rij-writes committen of rollen samen terug.

### 4.1 Payment-bedrag-afleiding

```php
$totalPaid = bcadd($cashTendered ?? '0', $cardAmount ?? '0', 2);
$changeDue = bccomp($totalPaid, (string) $cart['total'], 2) > 0
    ? bcsub($totalPaid, (string) $cart['total'], 2)
    : '0.00';
```

`SaleController.php:122-127`. Gemengde betalingen splitsen de winkelwagen over contant en pin; `change_srd` is alleen niet-nul wanneer meer contant is aangereikt dan verschuldigd.

### 4.2 Register-sessie-lookup

```php
$registerSessionId = RegisterSession::where('cashier_id', $request->user()->id)
    ->where('store_id', $data['store_id'])
    ->where('status', 'open')
    ->latest('opened_at')
    ->value('id');
```

`SaleController.php:131-135`. Elke verkoop wordt nu gekoppeld aan de momenteel open kassasessie van de kassier zodat per-sessie-rapporten (mini Z-Rapport, kasreconciliatie) overeenkomen met de verkopen die ze beschrijven. De FK-kolom werd toegevoegd in migration `2026_04_14_100002_add_register_session_id_to_sales.php` en is `nullable` — verkopen gedaan via de third-party API of geïmporteerd via USB hebben geen sessie en blijven NULL.

Als de kassier op de een of andere manier geen open sessie heeft, wordt de verkoop nog steeds geregistreerd (NULL FK) in plaats van te falen — het weigeren van de verkoop zou de klant straffen voor een back-office-bug. De audit log toont de gap, het Z-Rapport flagt het.

### 4.3 Sale-nummer

`Sale::nextNumber($storeId)` — `backend/app/Models/Sale.php:92`:

```php
DB::select('SELECT pg_advisory_xact_lock(hashtext(?))',
    ["sale_number:{$storeId}:{$year}"]);

$count = static::where('store_id', $storeId)
    ->whereYear('occurred_at', $year)->count() + 1;

return sprintf('POS-%s-%05d', $year, $count);
```

De Postgres advisory lock is gescoped op `(store_id, year)` zodat twee kassiers in dezelfde **vestiging** de nummer-toewijzing serialiseren, terwijl twee kassiers in **verschillende** vestigingen elkaar nooit blokkeren. De lock wordt vastgehouden tot de transactie commit — `nextNumber` produceert alleen ooit een nummer dat de omringende `Sale::create` zal committen. Geen gaten, geen duplicaten, geen `unique`-index-violation op de tweede gelijktijdige verkoop.

Format: `POS-2026-00042`.

### 4.4 `Sale::create`

`SaleController.php:137-156`. Elke kolom waar het schema om geeft wordt expliciet gezet:

| Kolom | Bron |
|---|---|
| `store_id`, `cashier_id` | Request + Sanctum-gebruiker |
| `register_session_id` | 4.2 lookup |
| `sale_number` | 4.3 advisory lock |
| `subtotal_srd`, `discount_srd`, `btw_srd`, `total_srd` | `$cart` van BTW-service |
| `payment_method` | Gevalideerde `cash`/`card`/`mixed` |
| `cash_received_srd`, `card_amount_srd`, `change_srd` | 4.1 afleiding |
| `status` | Altijd `completed` hier — holds gebruiken een aparte route |
| `source` | `pos` (default), `api`, of `import` |
| `exchange_rate_used` | Snapshot van `daily_rates.usd_to_srd` voor vandaag |
| `external_sale_ref` | Idempotency key (NULL voor native POS) |
| `occurred_at` | Door client geleverd of `now()` — ondersteunt offline catch-up |

Het model implementeert `OwenIt\Auditing\Contracts\Auditable` (`Sale.php:12`), dus de rij-insert schrijft automatisch een rij naar `audits` met de volledige before/after JSON voor de audit log.

### 4.5 `SaleItem::create` × N

Loop op `SaleController.php:158-175`. Per item:

| Kolom | Bron |
|---|---|
| `product_name_snapshot` | Bevroren op verkoopmoment — overleeft latere product-renames |
| `unit_price_srd` | Snapshot van prijs op verkoopmoment |
| `quantity` | Decimal qty |
| `discount_srd` | Berekend uit BTW-resultaat: `line_gross − line_net` |
| `discount_pct` | Altijd `'0.00'` — handmatige pct-discounts worden upstream genormaliseerd naar SRD |
| `btw_rate`, `btw_exempt` | Snapshots |
| `btw_srd` | Per-line BTW-bedrag uit `calculateCart` |
| `line_total_srd` | Per-line net (post item- & sale-discount) |

Het discount-bedrag dat de rij opslaat is de **gecombineerde** item + share-of-sale-level-discount, omdat dat de werkelijke concessie is op deze regel. Rapporten die de twee moeten scheiden lezen zowel `sales.discount_srd` (cart-level) als `sale_items.discount_srd` (per-line aggregate).

### 4.6 Customer-counters

```php
if ($sale->customer_id) {
    Customer::where('id', $sale->customer_id)->increment('visit_count');
    Customer::where('id', $sale->customer_id)
        ->increment('total_spend_srd', (float) $cart['total']);
}
```

`SaleController.php:178-182`. Twee atomaire increments. Loopklant-verkopen (geen `customer_id`) slaan beide over.

---

## 5. Na de transactie commit

Drie queued effects, gedispatcht **na** `DB::transaction` het opgeslagen `$sale` retourneert zodat elke achtergrondworker committed rijen ziet.

### 5.1 Stock-movement-job

```
RecordStockMovements::dispatch($sale->id, $request->user()->id, 'sale');
```

`SaleController.php:188`. Gedefinieerd op `backend/app/Jobs/RecordStockMovements.php:20`:

| Property | Waarde |
|---|---|
| Queue | `default` (Horizon) |
| Retries | `3` |
| Back-off | `[30, 120, 600]` seconden |
| Failure handler | Logt naar `josbin_pos.log`; niets e-mailt de manager nog |

De job herleest de verkoop (`Sale::with('items')->find($saleId)`) en switcht op de `reason`:

```php
match ($this->reason) {
    'sale'           => $stock->recordSale($sale, $this->userId),
    'void', 'refund' => $stock->recordVoidOrRefund($sale, $this->reason, $this->userId),
}
```

`recordSale` loopt elk item af en roept `StockMovementService::record(...)` aan —
`backend/app/Services/StockMovementService.php:93`. **De voorraad is nu per-vestiging.** Voor migration `2026_05_25_054551_create_product_stocks_table.php` (24 mei) was `products.stock_qty` een enkele kolom gedeeld over elke vestiging in een organisatie — twee kassiers in twee vestigingen konden vanaf dezelfde counter oververkopen. De migration creëerde `product_stocks (product_id, store_id, stock_qty, low_stock_threshold)` met een unique `(product_id, store_id)`-index, backfillde één rij per paar, en nu locked `StockMovementService` de `product_stocks`-rij voor deze `(product, vestiging)` via `lockForUpdate()` (regel 53). Verkopen op *verschillende* vestigingen voor dezelfde SKU blokkeren elkaar niet meer.

Als een `product_stocks`-rij ontbreekt (een gloednieuwe vestiging toegevoegd na backfill), maakt de service hem automatisch aan vanaf de default `stock_qty`/`low_stock_threshold` van het product — regels 60-69.

Elke aanroep schrijft ook een `stock_movements`-rij met de signed `qty_change`, de `qty_after`, de reden, de gebruiker en **de sale UUID**. De `sale_id`-kolom was oorspronkelijk aangemaakt als `bigInteger` — een echte productie-verkoop zou elke keer gefaald hebben met `PDOException: invalid input syntax for type bigint`. Migration `2026_05_25_050301_change_stock_movements_sale_id_to_uuid.php` dropte en re-creëerde de kolom als `uuid` met de juiste FK naar `sales.id`.

### 5.2 SaleCompleted broadcast

```
broadcast(new SaleCompletedEvent($sale->load('store')))->toOthers();
```

`SaleController.php:191`. Het event implementeert `ShouldBroadcast` en is queued via de `default`-connection — de controller blokkeert nooit op Reverb.

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

Twee private channels parallel:

| Channel | Subscriber | Doel |
|---|---|---|
| `store.{storeId}` | POS-terminals in dezelfde vestiging | Zusterterminals verversen hun "vandaag totaal"-widget |
| `org.{organisationId}` | Super Admin Dashboard live tiles | HQ ziet revenue real-time oplopen |

Channel-auth zit in `backend/routes/channels.php:25-55` — een gebruiker moet bij de organisatie horen (of Super Admin zijn) om te subscriben. Government-org-channels zijn geïsoleerd van commerciële.

`->toOthers()` is de Sanctum-aware versie die de *socket* uitsluit die de broadcast initieerde — dus de eigen terminal van de kassier echoot zijn eigen verkoop niet terug. Andere terminals in dezelfde vestiging ontvangen hem nog wel.

Payload naar subscribers — `SaleCompleted::broadcastWith` (regel 42):

```
sale_id, sale_number, store_id, store_name, organisation_id,
total_srd, btw_srd, payment_method, occurred_at, cashier_name
```

Geen line items in de broadcast — volledig detail is één `GET /api/sales/{id}` verderop. Houdt de WebSocket-payload klein voor een netwerk van 50 terminals.

### 5.3 Anomaliedetectie

```
DetectSaleAnomaly::dispatch($sale->id)->onQueue('ai')->delay(now()->addSeconds(5));
```

`SaleController.php:194`. Vijfsecondendelay zodat de verkoop, items en voorraad allemaal gesetteld zijn voordat de heuristieken lopen. Job op `backend/app/Jobs/DetectSaleAnomaly.php:33`:

| Heuristiek | Drempel |
|---|---|
| Off-hours-verkoop | Vóór 06:00 of na 23:00 AST |
| Grote korting | `> 30%` van (totaal + korting) |
| Z-score basket size | `> 2.5σ` van het 30-dagen-gemiddelde van de vestiging |
| Cashier void burst | `≥ 3` voided verkopen door dezelfde kassier in laatste uur |
| Niet-positief totaal op een niet-void | `<= 0.00` |

Code op `DetectSaleAnomaly.php:93-153`. Als een heuristiek vuurt, vraagt de job optioneel GPT-4o om een Nederlandse één-paragraaf risk-narrative (alleen wanneer `AiService::isConfigured()` true retourneert) en schrijft een `AuditLog`-rij met `event = 'anomaly_detected'`. De audit-rij gaat via `AuditLog::create` in plaats van een raw DB-insert zodat de manipulatiebestendige SHA-256 hash chain intact blijft — zie hoofdstuk 3 voor het audit hash-protocol.

De job heeft vandaag geen notificatie-bijwerking; geflaggde verkopen verschijnen in het audit log view van het Super Admin Dashboard.

---

## 6. Bon-rendering

De response body is de opgeslagen `$sale` met eager-loaded items. De frontend opent dan `<ReceiptModal>` die drie render-paden heeft:

| Channel | Builder | Transport |
|---|---|---|
| Thermische print | `buildReceiptBytes()` in `frontend/src/lib/escpos.ts` | `printEscPos(bytes, printer)` |
| PDF (80 mm) | `ReceiptService::generatePdf` — `backend/app/Services/ReceiptService.php:127` | DomPDF, geserveerd door `GET /api/sales/{sale}/receipt/pdf` |
| E-mail | `ReceiptService::sendEmail` — `ReceiptService.php:142` | `Mail::html(view('emails.receipt'))` |

### 6.1 ESC/POS

`buildReceiptBytes` retourneert een `Uint8Array` van EPSON TM-T20-commando's. `printEscPos` in `frontend/src/lib/hardware.ts:50` kiest transport uit de `PrinterConfig` die per terminal is opgeslagen:

| `config.type` | Pad |
|---|---|
| `network` | TCP-socket naar `ip:port` (default 9100), Electron `print:network` IPC op `frontend/electron/main.ts:134` |
| `usb` | Windows-spooler — tempbestand + `print /D:"<printerName>" file.bin`, `electron/main.ts:148` (alleen Windows) |
| `none` | No-op; PDF/e-mail nog beschikbaar |

### 6.2 Cash drawer-kick

Getriggerd in `frontend/src/components/pos/PaymentModal.tsx:63-67` direct nadat de `createSale`-mutation slaagt:

```ts
if ((step === 'cash' || step === 'mixed') && printer.type !== 'none') {
  openCashDrawer(printer).catch(() => {
    // Drawer failure is non-fatal — sale is already recorded
  })
}
```

`openCashDrawer` bouwt de `CASH_DRAWER_1`-puls — bytes `[ESC, 0x70, 0x00, 0x19, 0xfa]` gedefinieerd in `frontend/src/lib/escpos.ts:33` — en duwt ze door hetzelfde printer-transport. Card-only-betalingen kicken de lade niet (de kassa blijft dicht voor pin-transacties).

### 6.3 BTW-breakdown op de bon

`ReceiptService::buildViewData` groepeert items op `btw_rate` voor de BTW-tabel van de bon — `ReceiptService.php:45-55`. Exempte items worden uitgesloten van de breakdown maar verschijnen nog steeds in de regel-listing met een "BTW-vrij"-label. Per-vestiging `receipt_btw_number` overschrijft de organisatie-default (regel 77).

USD-conversie wordt toegevoegd wanneer de verkoop een `exchange_rate_used` heeft: `total_usd = total_srd / exchange_rate_used` — niet-cosmetisch, dit is wat toeristen toestaat mentaal in USD te betalen.

---

## 7. Refund-pad

`POST /api/sales/{sale}/refund` — `SaleController.php:345`.

Een terugbetaling **is geen UPDATE** op de originele verkoop. Het is een *nieuwe* `Sale`-rij waarvan de monetaire kolommen negatief zijn, gelinkt aan het origineel via `void_reason = 'REFUND: ...'` en de `customer_id`, `payment_method`, `exchange_rate_used` van het origineel delend.

| Refund-kolom | Waarde |
|---|---|
| `sale_number` | Nieuw, via `Sale::nextNumber` — terugbetalingen krijgen hun eigen nummer |
| `subtotal_srd`, `total_srd`, `btw_srd` | Negatief |
| `status` | `completed` (de terugbetaling zelf is voltooid; het origineel blijft ook `completed`) |
| `source` | Gekopieerd van origineel |
| `void_reason` | `'REFUND: ' + reason` |

Per-regel wordt `quantity` opgeslagen als een negatieve string (`'-' . $qty`) en `btw_srd`/`line_total_srd` worden proportioneel genegeerd (`qtyRatio = refundQty / originalQty`).

Post-commit dispatched de controller `RecordStockMovements::dispatch($refund->id, $userId, 'refund')` (regel 417). `StockMovementService::recordVoidOrRefund` leest elk refund-sale-item, neemt `abs((float) $item->quantity)` en post een **positieve** `qty_change` — de voorraad wordt hersteld. Dezelfde code-pad bedient voids, alleen onderscheiden door de `reason`-string.

Authorisatie is `$this->authorize('refund', $sale)`; alleen completed sales kunnen worden terugbetaald.

---

## 8. Void-pad

`POST /api/sales/{sale}/void` — `SaleController.php:216`.

Een annulering markeert de `status = 'voided'` van de originele verkoop en schrijft `voided_by`, `voided_at`, `void_reason`. Er wordt geen nieuwe sale-rij aangemaakt.

**Dual approval voor government-organisaties**:

```
$needsSecondApproval = $store?->organisation?->is_government ?? false;
```

`SaleController.php:230`. De flow:

| Stap | Govt-vestiging | Niet-govt-vestiging |
|---|---|---|
| 1e `POST /void` | Registreert `voided_by` + reden, status **blijft** `completed`, retourneert `VOID_PENDING_APPROVAL` | Markeert status meteen als `voided` |
| 2e `POST /void` | Markeert status `voided`, zet `void_approved_by` naar de tweede gebruiker | n.v.t. |

De segregation-of-duties-guard zit op `SaleController.php:249-254`:

```php
if ($needsSecondApproval && $sale->voided_by === $request->user()->id) {
    return 422 VOID_SAME_APPROVER;
}
```

De eerste goedkeurder kan niet ook de tweede goedkeurder zijn — vereist door het Rekenkamer-compliance-protocol. De twee user-IDs eindigen op verschillende kolommen (`voided_by` vs `void_approved_by`) zodat het auditspoor beide namen toont.

Voorraad wordt hersteld door `RecordStockMovements::dispatch($sale->id, $userId, 'void')` op regel 268 — dezelfde job als het refund-pad, andere reason-flag.

---

## 9. Third-party-API-pad (Layer 3)

Een aparte controller behandelt externe POS-submissies: `App\Http\Controllers\V1\SaleController` —
`backend/app/Http/Controllers/V1/SaleController.php`.

| | Sanctum POS-pad | Integration API-pad |
|---|---|---|
| Auth | Sanctum bearer | `X-API-Key` (ValidateApiKey middleware) |
| Kassier | `auth()->user()->id` | `null` (geen mens) |
| Idempotency-key | `external_sale_ref` (optioneel) | `sale_ref` (**vereist**) |
| Batch-endpoint | — | `POST /v1/sales/batch` (max 500 sales) |
| Webhook bij succes | — | `DispatchWebhook::dispatchIfActive($orgId, 'sale.created', ...)` |
| Broadcast | Ja (Reverb) | Nee (third-party-verkopen pushen niet naar de dashboard live tiles) |
| Stock movements | Ja | Nee (third-party POS bezit zijn eigen voorraad) |
| Anomaliedetectie | Ja | Nee |

De idempotency-check is dezelfde `external_sale_ref`-lookup, retournerend het bestaande record met `200` — `V1/SaleController.php:56-61`.

`POST /v1/sales/batch` (regel 152) is een dunne wrapper rond `store` — hij itereert door de array, herbouwt een sub-request per item, en telt `{ created, skipped, failed, errors[] }`. De 500-item-cap bestaat zodat een offline branch met twee weken catch-up data zinvol kan streamen zonder één gigantische transactie.

---

## 10. Waar elk stuk zit

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

→ Volgende: [5 — BTW-pipeline](05-btw-pipeline.md)
