# 5 — BTW-pipeline

Belastingdienst-conforme belasting-math voor Suriname VAT. Eén service, één rule book, geen floats, 50+ gepinde scenario's in `phpunit`.

Dit is het hoofdstuk dat we aan een externe auditor zullen overhandigen. Alles hier is afdwingbaar, testbaar en geworteld in een enkel bestand: `backend/app/Services/BtwCalculationService.php`.

---

## Waarom geen PHP-floats

BTW is belastingopbrengst. Off-by-one-cent-fouten worden niet getolereerd.

PHP-floats zijn IEEE 754 doubles. Het literal `0.1` is eigenlijk niet `0.1`; het is `0.1000000000000000055511151231257827021181583404541015625`. Tel er drie bij op en je krijgt `0.30000000000000004` in plaats van `0.30`. Vermenigvuldig met een hoeveelheid, tel op bij een subtotaal, deel voor tax-extractie — de fout stapelt zich op.

Een concreet failure mode dat op een bon zou belanden:

```
Inclusive line:  SRD 9.99   (3 × SRD 3.33 at 10% BTW)
Float extraction: 9.99 - 9.99 / 1.10 = 0.9081818181818174   → rounds to 0.91
                  same call repeated 10000 times can drift by a cent
BCMath extraction: '9.99' - '9.99' / '1.10' = '0.9081...' (scale 4)
                  rounded half-up to '0.91' deterministically, forever
```

Test die dit asserteert: `test_no_float_drift_on_btw_extraction` —
`backend/tests/Unit/BtwCalculationServiceTest.php:494`.

Een tweede klasse failure is de afrondingsgrens. `2.675` zou moeten afronden naar `2.68`, maar zijn float-waarde is eigenlijk `2.67499999…` dus `round(2.675, 2)` retourneert `2.67`. De service vermijdt `round()` volledig en rolt zijn eigen half-up:

```php
$halfUnit = '0.' . str_repeat('0', $scale) . '5';
$rounded  = bcadd($abs, $halfUnit, $scale); // bcadd truncates to scale
```

`BtwCalculationService.php:247-262`. Pure string-arithmetic, deterministisch over PHP-versies en operating systems heen.

### Het contract

| | Binnen de service | Op de public boundary |
|---|---|---|
| Scale | 4 decimalen (`SCALE = 4`) | 2 decimalen |
| Rounding | Geen — volledige precisie vastgehouden in strings | Half-up naar 2 plaatsen |
| Type | `string` | `string` |
| Float casts | Nooit | Nooit (één `min()` gebruikt float — zie hieronder) |

De constante zit op `BtwCalculationService.php:22`. De service retourneert nooit een PHP-float — er is een test die dat bewijst: `test_return_values_are_always_string_not_float` (regel 504).

(De ene float-touch: `discountSrd` wordt geklemd op `lineGross` via `min((float) $a, (float) $b)` op regel 61. Het resultaat wordt meteen herformatteerd met `number_format($v, 4, '.', '')` zodat geen float lekt in bcmath downstream.)

---

## `calculateLineItem` — enkele regel

```php
public function calculateLineItem(
    string $unitPrice,
    string $quantity,
    string $btwRate,
    bool   $btwExempt   = false,
    string $discountSrd = '0.00',
): array
```

Gedefinieerd op `BtwCalculationService.php:43`. Retourneert:

| Key | Betekenis |
|---|---|
| `line_gross` | `unit_price × quantity` voor enige korting |
| `line_net` | `line_gross − discount` (de klantgerichte regelprijs) |
| `btw_base` | Het tax-exclusieve deel van `line_net` (of volledige net wanneer exempt) |
| `btw_amount` | Het tax-deel van `line_net` (of `0.00` wanneer exempt) |
| `line_total` | Hetzelfde als `line_net` — wat de regel kost op de bon |

### De math

Prijzen in Suriname zijn **tax-inclusive** geprijsd. Dat is de basis van elke berekening hier. De BTW wordt *geëxtraheerd* uit de inclusieve prijs; hij wordt niet *toegevoegd* aan een tax-exclusieve prijs.

```
line_gross = unit_price × quantity                       (scale 4)
line_net   = line_gross − discount                       (scale 4, clamped to line_gross)

if exempt OR rate == 0:
    btw_amount = 0.00
    btw_base   = line_net
else:
    divisor    = 1 + (rate / 100)
    tax_excl   = line_net / divisor
    btw_amount = line_net − tax_excl
    btw_base   = tax_excl
```

Code op `BtwCalculationService.php:55-89`.

### Uitgewerkt voorbeeld A — SRD 11.00, qty 1, 10% BTW

```
line_gross = 11.00 × 1                = 11.0000
line_net   = 11.0000 − 0.00           = 11.0000
divisor    = 1 + 10/100               = 1.1000
tax_excl   = 11.0000 / 1.1000         = 10.0000
btw_amount = 11.0000 − 10.0000        = 1.0000  → '1.00'
btw_base   = 10.0000                          → '10.00'
line_total = 11.0000                          → '11.00'
```

Gepind door `test_standard_10_pct_btw_single_unit` —
`BtwCalculationServiceTest.php:29`.

### Uitgewerkt voorbeeld B — zelfde regel, item-discount van SRD 1.10

Dit is de Belastingdienst-vereiste volgorde. Korting **eerst**, dan BTW extraheren uit de post-discount net.

```
line_gross = 11.00 × 1                = 11.0000
line_net   = 11.0000 − 1.10           =  9.9000
divisor    = 1.1
tax_excl   = 9.9000 / 1.1000          =  9.0000
btw_amount = 9.9000 − 9.0000          =  0.9000  → '0.90'
btw_base   = 9.0000                            → '9.00'
line_total = 9.9000                            → '9.90'
```

Als we BTW *eerst* zouden hebben toegepast (de verkeerde manier), zou de BTW `1.00` zijn en zou de klant `1.00 − 1.10 = -0.10` aan belasting betalen — onzin. De gepinde test: `test_belastingdienst_discount_applied_before_btw` —
`BtwCalculationServiceTest.php:293`.

### Validatie-guards

Pre-flight checks op `BtwCalculationService.php:266-278`:

| Guard | Throws |
|---|---|
| Negatieve `unitPrice` | `InvalidArgumentException` |
| Negatieve `quantity` | `InvalidArgumentException` |
| Negatieve `discountSrd` | `InvalidArgumentException` |
| `btwRate < 0` of `btwRate > 100` | `InvalidArgumentException` |

Discount wordt ook **geklemd** op `line_gross` — een `999.00`-discount op een `10.00`-item geeft `line_total = 0.00`, nooit een negatief getal. Gepind: `test_item_discount_exceeding_line_gross_is_capped` (regel 109).

---

## `calculateCart` — multi-item

```php
public function calculateCart(
    array  $items,
    string $saleDiscountSrd = '0.00',
    string $saleDiscountPct = '0.00',
): array
```

Gedefinieerd op `BtwCalculationService.php:107`. Retourneert:

| Key | Betekenis |
|---|---|
| `subtotal` | Som van `line_total` van elke regel, **voor** sale-level-discount |
| `sale_discount` | De resolved sale-level-discount die daadwerkelijk werd toegepast |
| `btw_total` | Som van per-line `btw_amount` **na** herverdeling |
| `total` | `subtotal − sale_discount` |
| `items` | Array van per-line-resultaten met aangepaste BTW |

### Drie-pass-algoritme

```
Pass 1 — line-by-line calculation
    for each item:
        result = calculateLineItem(...)
        subtotal += result['line_total']

Pass 2 — resolve sale discount
    if saleDiscountSrd > 0:  use it
    elif saleDiscountPct > 0: discount = subtotal × pct / 100
    cap discount at subtotal

Pass 3 — distribute discount proportionally, recompute BTW
    for each line:
        if last line:
            this_disc = whatever discount is left  (absorbs rounding)
        else:
            weight    = line_total / subtotal
            this_disc = saleDiscount × weight
            remaining -= this_disc
        adjusted = calculateLineItem(
            ..., discountSrd = original_item_disc + this_disc,
        )
        btw_total += adjusted['btw_amount']
```

Code op `BtwCalculationService.php:124-181`.

### Waarom drie passes

Pass 1 produceert het subtotaal dat we nodig hebben om proportionele weights te berekenen in pass 3. We kunnen passes 1 en 3 niet vouwen in één omdat de weighting-noemer het post-item-discount-subtotaal moet zijn, niet de pre-discount-gross.

### Waarom de laatste regel de afronding absorbeert

Het verdelen van SRD 1 over drie gelijke regels geeft `0.3333…` elk, wat afrondt naar `0.33` en `0.01` ongeoormerkt laat. De naïeve aanpak laat elke regel onafhankelijk afronden en het BTW-totaal matcht niet meer met het cart-totaal. De service vermijdt dit door de **laatste** regel te geven wat er ook maar aan korting over is nadat de vorige regels op volledige precisie zijn berekend:

```php
if ($i === $lastIndex) {
    $itemDisc = $remainingDisc;            // absorbs rounding on last item
} else {
    $weight   = bcdiv($line['line_total'], $subtotal, $scale);
    $itemDisc = bcmul($saleDiscount, $weight, $scale);
    $remainingDisc = bcsub($remainingDisc, $itemDisc, $scale);
}
```

`BtwCalculationService.php:159-166`. Resultaat: per-regel BTW telt op tot het gerapporteerde cart-BTW-totaal, elke keer. Gepind door `test_rekenkamer_audit_btw_totals_match_sum_of_line_btw` (regel 547):

```php
$sumBtw = '0.00';
foreach ($result['items'] as $item) {
    $sumBtw = bcadd($sumBtw, $item['btw_amount'], 2);
}
$this->assertSame($result['btw_total'], $sumBtw);
```

### `saleDiscountSrd` vs `saleDiscountPct`

Als beide worden doorgegeven, **wint SRD** (regel 141 checkt SRD eerst). Gepind: `test_cart_srd_discount_preferred_over_pct_when_both_given` (regel 278). Dit matcht de POS-UI waar de kassier de ene input of de andere kiest, niet beide tegelijk.

### Cap op subtotaal

```php
if (bccomp($saleDiscount, $subtotal, $scale) > 0) {
    $saleDiscount = $subtotal;
}
```

Regel 147-149. Een `999.00`-cart-discount op een `10.00`-winkelwagen geeft `total = 0.00`, nooit negatief. Gepind: `test_cart_discount_capped_at_subtotal` (regel 243).

---

## BTW-vrije items

De Surinaamse wet stelt basislevensmiddelen en medicijnen vrij (rijst, brood, melk, kip, voorgeschreven medicijnen, …). Het product draagt een `btw_exempt`-boolean (`products.btw_exempt`-migratie `2026_04_12_200005_create_products_table.php`).

De exempt-branch op `BtwCalculationService.php:69-72`:

```php
if ($btwExempt || bccomp($btwRate, '0', $scale) === 0) {
    $btwAmount = '0.00';
    $btwBase   = $this->round2($lineNet);
}
```

| Property | Gedrag |
|---|---|
| `btw_amount` | Altijd `'0.00'` |
| `btw_base` | Volledige `line_net` — het volledige bedrag is non-taxable revenue |
| Item verschijnt nog in winkelwagen? | Ja |
| Item geteld in `subtotal`? | Ja |
| Item deelt in sale-level-discount? | Ja |
| Item-BTW herberekend na korting? | Ja — komt opnieuw `calculateLineItem` binnen met de nieuwe korting, raakt nog steeds de exempt-branch, retourneert nog steeds `0.00` |

Het laatste punt is de val: het zou makkelijk zijn voor "verdeel de cart-discount proportioneel" om per ongeluk een exempt item te belasten. De exempt-branch vuurt binnen `calculateLineItem` zelf, dus pass 3 van het cart-algoritme kan hem niet omzeilen. Gepind: `test_sale_discount_does_not_affect_exempt_item_btw` (regel 601):

```php
$result = $this->btw->calculateCart([
    ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
    ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
], saleDiscountSrd: '4.00');

$this->assertSame('0.00', $result['items'][1]['btw_amount']);
```

De `btw_rate` is op `10` gezet op het exempt-item om te bewijzen dat de `btw_exempt`-flag voorrang heeft op het tarief.

---

## Multi-rate-winkelwagens

Suriname BTW is meestal 10%, maar de service accepteert elk tarief `0..100` per item. Een overheidsdepartement dat een mix van verbruiksgoederen (10%) en exempte staples (0%) koopt is het realistische geval.

Het cart-algoritme weet niet of geeft niet om tarieven — elke regel wordt identiek verwerkt en de per-rate-breakdown wordt downstream gereconstrueerd op de **bon** en het **BTW-rapport**. De bon-template groepeert items per tarief in `backend/app/Services/ReceiptService.php:45-55`:

```php
$btwItems = $sale->items
    ->where('btw_exempt', false)
    ->where('btw_rate', '>', 0)
    ->groupBy('btw_rate')
    ->map(fn ($group, $rate) => [
        'rate' => number_format((float) $rate, 2, '.', ''),
        'base' => /* sum of (line_total − btw_srd) */,
        'btw'  => /* sum of btw_srd */,
    ]);
```

Mixed-rate-sanity-check in tests: `test_mixed_btw_rates_in_single_basket` (regel 576) — 10%-regel plus 15%-regel, BTW-totaal `25.00`.

---

## De 50+ unit-test-scenario's

Bestand: `backend/tests/Unit/BtwCalculationServiceTest.php` (611 regels). Tien secties, elk pinned één regel.

| Sectie | Wat het vastlegt | Representatieve test |
|---|---|---|
| 1. Basic line-item-extractie | Standaard 10%, decimale qty, decimale prijs-afronding | `test_standard_10_pct_btw_single_unit` |
| 2. Item-level discounts | Discount verlaagt base, 100% discount, cap | `test_item_discount_reduces_btw_base` |
| 3. BTW-rate-variaties | 0%, 5%, 15%, 21%, 100% | `test_5_pct_btw_rate` |
| 4. Cart-level | Mixed exempt/taxable, SRD vs pct discount, lege winkelwagen | `test_cart_srd_sale_discount_distributed_proportionally` |
| 5. Belastingdienst-compliance | Discount-voor-BTW-volgorde, exempte items, Surinaamse winkelwagen | `test_belastingdienst_discount_applied_before_btw` |
| 6. `extractBtw`-helper | Standalone bon-reconstructie | `test_extract_btw_exact_cent_rounding` |
| 7. `pctToSrd`-helper | Pct-discount-math, 0%, 100%, afronding | `test_pct_to_srd_15_pct_rounding` |
| 8. Edge cases / guards | 0-price, 0-qty, zeer klein bedrag, negatieve inputs gooien | `test_very_small_amount_rounds_correctly` |
| 9. Float safety | Klassieke `0.1+0.2`, return types zijn strings | `test_no_float_drift_classic_0_1_plus_0_2_problem` |
| 10. Suriname-compliance | Govt-segregatie, Rekenkamer-totalen matchen, mixed rates, exempt | `test_rekenkamer_audit_btw_totals_match_sum_of_line_btw` |

Een paar die uitlichting verdienen:

```php
// Real Surinamese basket: rice, oil, chicken, soft drink — mixed exempt + 10%
test_typical_supermarket_basket()        // line 321
// Asserts btw_total = '6.40' on a 4-item cart with 2 exempts

// "100% off" must not produce negative BTW
test_cart_100_pct_discount_yields_zero_total()  // line 232

// PHP float fails 0.1 × 3 ≠ 0.30 — assert bcmath path gets '0.30' exact
test_no_float_drift_classic_0_1_plus_0_2_problem()  // line 485

// 999.999 kg × SRD 1.00 — large decimal qty, rounded to '1000.00'
test_large_quantity_decimal_precision()  // line 430
```

Alle 50+ tests draaien op elke CI-commit via `.github/workflows/backend.yml`. Een failure blokkeert merge — de V-Model-gate uit het projectplan.

---

## BTW-rapport-endpoint

`GET /api/reports/btw` — `backend/app/Http/Controllers/Api/ReportController.php:246`.

Permission: `reports.btw` (regel 248). Valideert `store_id`, `date_from`, `date_to`. Aggregeert `sale_items` joined met `sales` (alleen status `completed`) op `(btw_rate, btw_exempt)`:

```sql
SELECT
    btw_rate,
    btw_exempt,
    SUM(line_total_srd)              AS gross_incl_btw,
    SUM(btw_srd)                     AS btw_amount,
    SUM(line_total_srd) − SUM(btw_srd) AS net_excl_btw
FROM sale_items
JOIN sales ON sale_items.sale_id = sales.id
WHERE sales.store_id = ?
  AND sales.status = 'completed'
  AND sales.occurred_at BETWEEN ? AND ?
GROUP BY btw_rate, btw_exempt
ORDER BY btw_exempt, btw_rate
```

Response-shape:

```json
{
  "store_id":  "...",
  "date_from": "2026-05-01",
  "date_to":   "2026-05-31",
  "breakdown": [
    { "btw_rate": "0.00",  "btw_exempt": true,  "gross_incl_btw": "12450.00", "btw_amount": "0.00",    "net_excl_btw": "12450.00" },
    { "btw_rate": "10.00", "btw_exempt": false, "gross_incl_btw": "44000.00", "btw_amount": "4000.00", "net_excl_btw": "40000.00" }
  ],
  "total_btw": "4000.00",
  "format":    "Belastingdienst Suriname"
}
```

PDF-export van dezelfde data is via `GET /api/reports/export?type=btw` (regel 293) — de PDF-wrapper is een placeholder in de huidige build, gemarkeerd voor SPOS-209-uitbreiding.

De reden dat het rapport `sale_items.btw_srd` direct sommeert (in plaats van te herberekenen vanuit `line_total_srd` en `btw_rate`) is de herverdelings-math hierboven: per-regel BTW is de **canonieke** waarde, gepersisteerd op verkoopmoment, vastgelegd door de rij-insert. Herafleiden vanuit alleen het tarief zou de afrondingsbeslissingen weggooien die zijn gemaakt toen de verkoop werd aangeslagen.

---

## Edge cases

| Input | Gedrag | Test |
|---|---|---|
| `quantity = '0'` | `line_gross = 0.00`, `btw_amount = 0.00` | `test_zero_quantity_yields_zero_totals` (414) |
| `unit_price = '0'` | Alle nullen | `test_zero_price_yields_zero_totals` (405) |
| `discount = unit_price × qty` | `line_total = 0.00`, `btw_amount = 0.00` | `test_100_pct_item_discount_yields_zero_line_total` (101) |
| `saleDiscountPct = 100` | `total = 0.00`, `btw_total = 0.00` | `test_cart_100_pct_discount_yields_zero_total` (232) |
| `saleDiscountSrd > subtotal` | Discount geklemd op subtotaal | `test_cart_discount_capped_at_subtotal` (243) |
| Lege winkelwagen | Alle nullen | `test_empty_cart_returns_zeros` (254) |
| `unit_price = '0.01'` × 1, 10% | `btw_amount = '0.00'` (rondt af naar 0) | `test_very_small_amount_rounds_correctly` (421) |
| Negatieve inputs | `InvalidArgumentException` | `test_negative_price_throws_exception` (439) |

Het "999 SRD discount op een 10 SRD item"-geval is dat wat naïeve implementaties betrapt. Zonder de cap krijg je een negatieve `line_total`, die dan een negatieve BTW produceert (een tax *credit* aan de klant), die dan het cart-subtotaal vergiftigt, wat dan het bontotaal onzinnig maakt. De `min()`-clamp op regel 61 blokkeert de hele cascade op één plek.

---

## Helpers

Twee extra publieke methodes op de service die de moeite waard zijn te kennen:

### `extractBtw($inclusiveAmount, $btwRate)`

`BtwCalculationService.php:215`. Gegeven een tax-inclusief totaal en een tarief, retourneert alleen het BTW-bedrag. Gebruikt door code die het gross-cijfer heeft maar niet de cart-structuur — bon-reconstructie, ad-hoc-rapporten.

```
extractBtw('110.00', '10') = '10.00'
extractBtw('1.00',   '10') = '0.09'   (0.0909... rounds half-up)
extractBtw('50.00',  '0')  = '0.00'   (short-circuit)
```

### `pctToSrd($baseAmount, $pct)`

`BtwCalculationService.php:199`. Converteert een percentage-discount naar het SRD-bedrag dat het representeert, afgerond op 2 plaatsen. Throws `InvalidArgumentException` als `pct > 100`. Gebruikt door de discount-rule-service om pct-regels te materialiseren in SRD voordat de BTW-pass de winkelwagen ziet.

```
pctToSrd('100.00', '10')   = '10.00'
pctToSrd('33.33',  '15')   = '5.00'    (4.9995 rounds up)
pctToSrd('500.00', '0')    = '0.00'
```

---

## Aangifte bij de Belastingdienst — `btw_submissions`

Alles hierboven beantwoordt *"hoeveel BTW hebben we geïnd?"*. De aangifte-pijplijn maakt van dat antwoord een formele, manipulatie-aantoonbare aangifte die een Belastingdienst-inspecteur binnen het platform beoordeelt. Eén model (`BtwSubmission`), één service (`BtwSubmissionService`), één controller (`BtwSubmissionController`), één policy (`BtwSubmissionPolicy`).

### De aangifte-rij

Een `btw_submissions`-rij is een **snapshot op indienmoment**, nooit herberekend bij lezen — de inspecteur moet exact zien wat er geclaimd is, zelfs als verkopen later worden geannuleerd (correcties lopen via de supersede-flow, nooit via een stille herberekening):

| Kolom | Betekenis |
|---|---|
| `period_type`, `period_start`, `period_end` | `daily` / `weekly` / `monthly` (`BtwSubmission::PERIOD_TYPES`). |
| `store_id` | NULL = geconsolideerde org-brede aangifte; gezet = per-vestiging-aangifte. |
| `sales_count`, `total_sales_srd`, `btw_exempt_srd`, `btw_taxable_srd`, `total_btw_srd` | Snapshot-totalen uit `BtwSubmissionService::computeTotals`. |
| `status` | `filed` → `accepted` \| `disputed` \| `superseded`. |
| `reference` | Server-gegenereerd, uniek — `BTW-{YYYY}-{MM}-{ORGSLUG}-{DAY\|WK\|MTH}-{NNN}` (per-org-volgnummer per periodetype per maand, dus herindieningen krijgen `-002`, `-003`, …). |
| `submitted_at/by`, `reviewed_at/by`, `submitter_note`, `inspector_note` | Beide kanten van de review-dialoog. |
| `sale_ids` | JSONB-array van de gedekte sale-UUIDs — een Rekenkamer-auditor kan rij-voor-rij van aangifte terug naar bronverkopen lopen. |
| `prev_hash`, `current_hash` | Per-org SHA-256-chain, hieronder. |

Er is **geen `draft`-status** — de dry-run-rol wordt gespeeld door `POST /api/btw-submissions/preview`, die dezelfde `computeTotals` draait en waarschuwt voor een bestaande aangifte voor de periode zonder iets te persisteren.

`computeTotals` (`backend/app/Services/BtwSubmissionService.php`) scoped op `status = 'completed'`, `source IN ('pos','api')` (historische `import`-rijen uitgesloten), `occurred_at` binnen de periode in AST. Vrijgestelde omzet wordt gesommeerd vanuit `sale_items.btw_exempt = true`-regels — *niet* de oude proxy "verkoop met nul BTW is vrijgesteld", die elke gemengde mand (rijst + cola) misclassificeerde. Belastbaar = totaal − vrijgesteld, geklemd op `0.00`.

### Perioden — daily / weekly / monthly

`validatePayload` dwingt de periodevorm af: `daily` moet één dag zijn, `monthly` moet exact eerste-tot-laatste van één kalendermaand zijn, `weekly` heeft geen vormguard (elke bereik in het verleden dient in als weekly). De formele cyclus van de Belastingdienst is maandelijks; daily/weekly bestaan voor high-volume of transparantie-gerichte klanten — en daarom pingen **alleen maandelijkse aangiften de notificatie-bel van de inspecteurs** (`BtwFilingSubmitted`); daily/weekly verschijnen gewoon in de review-queue. Herindieningen pingen altijd (`BtwFilingResubmitted`) — die volgen op een dispuut dat de inspecteur zelf opwierp.

### Org-breed (OA) vs vestiging-gescoped (SM)

BTW is juridisch een aangifte op organisatieniveau, dus de geconsolideerde org-brede aangifte (`store_id` NULL) is de taak van de Org Admin. Een Store Manager kan ook indienen — gebruikelijk voor Surinaamse winkels met één vestiging — maar `validatePayload` **forceert `store_id = $user->store_id`** voor store-bound rollen, wat de client ook meestuurde. Een OA die een specifieke vestiging noemt gaat door `canAccessStore`. Dezelfde splitsing loopt door elke read: `applyListFilters` pint een SM op de aangiften van de eigen vestiging, `BtwSubmissionPolicy::view/supersede` hercheckt het per rij.

### Idempotentie — één actieve aangifte per periode

Drie migraties vertellen het verhaal:

1. `2026_05_26_030001` — platte composite UNIQUE op `(organisation_id, period_type, period_start, period_end)`. Blokkeerde dubbel indienen, maar ook *herindienen*.
2. `2026_05_26_070001` — vervangen door een **partial unique index** `btw_subs_active_period_unique … WHERE status <> 'superseded'`. Superseded rijen bezetten de periode niet meer, dus een periode kan onbeperkt vaak opnieuw ingediend worden.
3. `2026_06_16_000001` — maakte hem **store-aware**: de index bevat nu `COALESCE(store_id, '0000…0000'::uuid)` (sentinel voor NULL, want een gewone nullable kolom zou org-brede duplicaten doorlaten). Netto-effect: één actieve org-brede aangifte per periode, één actieve aangifte per vestiging per periode, en org-breed + per-vestiging voor dezelfde periode bestaan naast elkaar.

Bovenop de index pre-checkt `store()` op een blokkerende `filed`/`accepted`-rij en retourneert `409 BTW_ALREADY_FILED` met de bestaande referentie — een vriendelijkere fout dan de constraint-violation.

### De hash-chain

`BtwSubmissionService::hashChain` berekent `current_hash = sha256(prev_hash . '|' . canonical_json)` over de canonieke aangifte-payload (org, vestiging, periode, totalen, indiener, referentie). De chain is **per organisatie** — de aangiften van een belastingplichtige moeten één doorlopend, op zichzelf staand grootboek vormen; als `prev` globaal was, zou org B's aangifte een schakel in org A's reeks worden en zou per-belastingplichtige-verificatie breken zodra iemand anders indient. `prev` is de laatste `current_hash` van de org, geordend op `submitted_at` (UUID-PKs zijn niet monotoon).

Zelfde patroon als de `audit_logs`-chain (h. 2), maar let op: `php artisan audit:verify` dekt alleen `audit_logs` — een `btw:verify-chain`-tegenhanger wordt genoemd in de migratie-comments en **bestaat nog niet**. Tot die er is, betekent verifiëren: `btw_submissions` per org doorlopen en herberekenen.

### Review-loop — accepteren / betwisten / herindienen

```
OA of SM                              tax_inspector
────────                              ─────────────
preview (dry-run)
indienen → status: filed  ──────────▶ review-queue
                                      ├── accept  → status: accepted   (vergrendeld — kan niet gesuperseded worden)
                                      └── dispute → status: disputed   (inspector_note verplicht, min. 5 tekens)
                        ◀────────────  belastingplichtige genotificeerd (bel + mail)
corrigeren & herindienen:
POST {id}/supersede
  ├── totalen herberekend (pikt voids/refunds van na de aangifte op)
  ├── origineel → status: superseded  (maakt de partial unique index vrij)
  └── nieuwe rij → status: filed  ───▶ inspecteur genotificeerd, herbeoordeling
```

Gates in `BtwSubmissionPolicy`: `review` vereist `btw.review_submission` **én** `status === 'filed'` (accepted/disputed/superseded rijen zijn klaar); `supersede` vereist `btw.submit`, dezelfde org, dezelfde vestiging voor een SM, en `status ∈ [filed, disputed]` — een geaccepteerde aangifte is het dossier van de belastingautoriteit en kan niet vervangen worden. Zelfs de SA gaat door `review` zodat de audit-attributie eerlijk blijft. Elke overgang schrijft een `audit_logs`-rij: `btw.submitted`, `btw.accepted`, `btw.disputed`, `btw.superseded`.

### Endpoints

Allemaal onder `auth:sanctum` (`backend/routes/api.php:342-358`); statische paden geregistreerd vóór de `{btwSubmission}`-wildcards:

| Method | Path | Wie | Notities |
|---|---|---|---|
| `GET` | `/api/btw-submissions` | `btw.view_submissions` | Cross-org-rollen zien alles; OA hun org; SM hun vestiging. Filters: status, period_type, from/to, year, bedragband, `source` (pos/api via `sale_ids`), search. |
| `GET` | `/api/btw-submissions/export` | idem | Gestreamde CSV (UTF-8 BOM voor Excel), zelfde filters als index — de CSV matcht altijd het scherm. |
| `GET` | `/api/btw-submissions/inspector-dashboard` | idem | KPI-snapshot: BTW deze/vorige maand, pending/disputed-tellingen, 30-dagen-trend, top-orgs; cross-org-rollen krijgen ook de lijst van >7 dagen stille laat-indieners. Voor een OA dezelfde shape gescoped op de eigen org. |
| `POST` | `/api/btw-submissions/preview` | `btw.submit` | Dry-run-totalen + waarschuwing voor bestaande aangifte. |
| `POST` | `/api/btw-submissions` | `btw.submit` | Dient in. `409 BTW_ALREADY_FILED` bij een actief duplicaat. |
| `GET` | `/api/btw-submissions/{id}` / `{id}/detail` | policy `view` | Detail voegt per-vestiging, per-source (`sales.source` — Josbin POS vs Layer-3 API vs import), per-betaalmethode, per-BTW-tarief-uitsplitsingen toe + de audit-log-tijdlijn. |
| `POST` | `/api/btw-submissions/{id}/accept` | policy `review` | Optionele notitie. Notificeert belastingplichtige. |
| `POST` | `/api/btw-submissions/{id}/dispute` | policy `review` | Notitie verplicht. Notificeert belastingplichtige. |
| `POST` | `/api/btw-submissions/bulk-accept` | per rij `review` | Max. 200 ids, `throttle:30,1`. Rijen die niet `filed` zijn (of niet reviewbaar door de caller) worden overgeslagen, niet ge-errord; elke accept schrijft nog steeds zijn eigen audit-rij en notificatie. |
| `POST` | `/api/btw-submissions/{id}/supersede` | policy `supersede` | De corrigeer-en-herindien-flow hierboven. |

Notificatie-mechaniek (queued `database`+`mail`, waarom een SMTP-storing de actie van een inspecteur niet kan blokkeren) staat in [10 — Jobs & schedules](10-jobs-and-schedules.md); de `tax_inspector`-rol zelf in [3 — Auth & rollen](03-auth-and-roles.md).

---

## Waar elk stuk zit

```
Service
├── BtwCalculationService           backend/app/Services/BtwCalculationService.php
│   ├── calculateLineItem           :43
│   ├── calculateCart               :107
│   ├── extractBtw                  :215
│   ├── pctToSrd                    :199
│   └── bcRoundHalfUp  (private)    :247

Tests (V-Model gate)
└── BtwCalculationServiceTest       backend/tests/Unit/BtwCalculationServiceTest.php  (611 lines, 50+ tests)

Consumers
├── Api\SaleController::store       backend/app/Http/Controllers/Api/SaleController.php:114
├── V1\SaleController::store        backend/app/Http/Controllers/V1/SaleController.php:82
└── ReceiptService BTW grouping     backend/app/Services/ReceiptService.php:45

Reports
├── ReportController::btwReport     backend/app/Http/Controllers/Api/ReportController.php:246
└── ReportController::export        backend/app/Http/Controllers/Api/ReportController.php:293

Belastingdienst-aangifte-pijplijn
├── BtwSubmission (model)           backend/app/Models/BtwSubmission.php
├── BtwSubmissionService            backend/app/Services/BtwSubmissionService.php
│   ├── computeTotals               snapshot-totalen + sale_ids
│   ├── nextReference               BTW-YYYY-MM-ORGSLUG-…-NNN
│   └── hashChain                   per-org sha256-chain
├── BtwSubmissionController         backend/app/Http/Controllers/Api/BtwSubmissionController.php
├── BtwSubmissionPolicy             backend/app/Policies/BtwSubmissionPolicy.php
├── Notifications                   backend/app/Notifications/BtwFiling{Submitted,Accepted,Disputed,Resubmitted}.php
└── Migraties                       2026_05_26_030001 → 2026_05_26_070001 → 2026_06_16_000001

Pre-BTW discount layer
└── DiscountRuleService::applyRules backend/app/Services/DiscountRuleService.php:33
    (writes applied_discount_srd before BTW sees the cart — compliance ordering)
```

---

→ Volgende: [6 — Kassa en Z-Rapport](06-register-and-z-report.md)
