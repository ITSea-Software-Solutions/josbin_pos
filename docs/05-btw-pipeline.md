# 5 — BTW pipeline

Belastingdienst-compliant tax math for Suriname VAT. One service, one rule book, no floats, 50+ pinned scenarios in `phpunit`.

This is the chapter we will hand to an external auditor. Everything here is enforceable, testable, and grounded in a single file: `backend/app/Services/BtwCalculationService.php`.

---

## Why no PHP floats

BTW is tax revenue. Off-by-one-cent errors are not tolerated.

PHP floats are IEEE 754 doubles. The literal `0.1` is not actually `0.1`; it's `0.1000000000000000055511151231257827021181583404541015625`. Add three of those and you get `0.30000000000000004` instead of `0.30`. Multiply by a quantity, add to a subtotal, divide for tax extraction — the error compounds.

A concrete failure mode that would land on a receipt:

```
Inclusive line:  SRD 9.99   (3 × SRD 3.33 at 10% BTW)
Float extraction: 9.99 - 9.99 / 1.10 = 0.9081818181818174   → rounds to 0.91
                  same call repeated 10000 times can drift by a cent
BCMath extraction: '9.99' - '9.99' / '1.10' = '0.9081...' (scale 4)
                  rounded half-up to '0.91' deterministically, forever
```

Test that asserts this: `test_no_float_drift_on_btw_extraction` —
`backend/tests/Unit/BtwCalculationServiceTest.php:494`.

A second class of failure is the rounding edge. `2.675` should round to `2.68`, but its float value is actually `2.67499999…` so `round(2.675, 2)` returns `2.67`. The service avoids `round()` entirely and rolls its own half-up:

```php
$halfUnit = '0.' . str_repeat('0', $scale) . '5';
$rounded  = bcadd($abs, $halfUnit, $scale); // bcadd truncates to scale
```

`BtwCalculationService.php:247-262`. Pure string arithmetic, deterministic across PHP versions and operating systems.

### The contract

| | Inside the service | At the public boundary |
|---|---|---|
| Scale | 4 decimal places (`SCALE = 4`) | 2 decimal places |
| Rounding | None — full precision held in strings | Half-up to 2 places |
| Type | `string` | `string` |
| Float casts | Never | Never (one `min()` uses float — see below) |

The constant is at `BtwCalculationService.php:22`. The service never returns a PHP float — there's a test that proves it: `test_return_values_are_always_string_not_float` (line 504).

(The one float touch: `discountSrd` is clamped to `lineGross` via `min((float) $a, (float) $b)` at line 61. The result is immediately reformatted with `number_format($v, 4, '.', '')` so no float leaks into bcmath downstream.)

---

## `calculateLineItem` — single line

```php
public function calculateLineItem(
    string $unitPrice,
    string $quantity,
    string $btwRate,
    bool   $btwExempt   = false,
    string $discountSrd = '0.00',
): array
```

Defined at `BtwCalculationService.php:43`. Returns:

| Key | Meaning |
|---|---|
| `line_gross` | `unit_price × quantity` before any discount |
| `line_net` | `line_gross − discount` (the customer-facing line price) |
| `btw_base` | The tax-exclusive portion of `line_net` (or full net when exempt) |
| `btw_amount` | The tax portion of `line_net` (or `0.00` when exempt) |
| `line_total` | Same as `line_net` — what the line costs on the receipt |

### The math

Prices in Suriname are quoted **tax-inclusive**. That is the foundation of every calculation here. The BTW is *extracted* from the inclusive price; it is not *added* to a tax-exclusive price.

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

Code at `BtwCalculationService.php:55-89`.

### Worked example A — SRD 11.00, qty 1, 10% BTW

```
line_gross = 11.00 × 1                = 11.0000
line_net   = 11.0000 − 0.00           = 11.0000
divisor    = 1 + 10/100               = 1.1000
tax_excl   = 11.0000 / 1.1000         = 10.0000
btw_amount = 11.0000 − 10.0000        = 1.0000  → '1.00'
btw_base   = 10.0000                          → '10.00'
line_total = 11.0000                          → '11.00'
```

Pinned by `test_standard_10_pct_btw_single_unit` —
`BtwCalculationServiceTest.php:29`.

### Worked example B — same line, item discount of SRD 1.10

This is the Belastingdienst-mandated ordering. Discount **first**, then extract BTW from the post-discount net.

```
line_gross = 11.00 × 1                = 11.0000
line_net   = 11.0000 − 1.10           =  9.9000
divisor    = 1.1
tax_excl   = 9.9000 / 1.1000          =  9.0000
btw_amount = 9.9000 − 9.0000          =  0.9000  → '0.90'
btw_base   = 9.0000                            → '9.00'
line_total = 9.9000                            → '9.90'
```

If we had applied BTW *first* (the wrong way), the BTW would be `1.00` and the customer would pay `1.00 − 1.10 = -0.10` of tax — nonsense. The pinned test: `test_belastingdienst_discount_applied_before_btw` —
`BtwCalculationServiceTest.php:293`.

### Validation guards

Pre-flight checks at `BtwCalculationService.php:266-278`:

| Guard | Throws |
|---|---|
| Negative `unitPrice` | `InvalidArgumentException` |
| Negative `quantity` | `InvalidArgumentException` |
| Negative `discountSrd` | `InvalidArgumentException` |
| `btwRate < 0` or `btwRate > 100` | `InvalidArgumentException` |

Discount is also **capped** at `line_gross` — passing a `999.00` discount on a `10.00` item yields `line_total = 0.00`, never a negative. Pinned: `test_item_discount_exceeding_line_gross_is_capped` (line 109).

---

## `calculateCart` — multi-item

```php
public function calculateCart(
    array  $items,
    string $saleDiscountSrd = '0.00',
    string $saleDiscountPct = '0.00',
): array
```

Defined at `BtwCalculationService.php:107`. Returns:

| Key | Meaning |
|---|---|
| `subtotal` | Sum of `line_total` from each line, **before** sale-level discount |
| `sale_discount` | The resolved sale-level discount actually applied |
| `btw_total` | Sum of per-line `btw_amount` **after** redistribution |
| `total` | `subtotal − sale_discount` |
| `items` | Array of per-line results with adjusted BTW |

### Three-pass algorithm

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

Code at `BtwCalculationService.php:124-181`.

### Why three passes

Pass 1 produces the subtotal we need to compute proportional weights in pass 3. We can't fold passes 1 and 3 into one because the weighting denominator must be the post-item-discount subtotal, not the pre-discount gross.

### Why the last line absorbs the rounding

Distributing SRD 1 across three equal lines gives `0.3333…` each, which rounds to `0.33` and leaves `0.01` unaccounted. The naïve approach lets each line round independently and the BTW total no longer matches the cart total. The service avoids this by giving the **last** line whatever discount is left after the previous lines have been computed at full precision:

```php
if ($i === $lastIndex) {
    $itemDisc = $remainingDisc;            // absorbs rounding on last item
} else {
    $weight   = bcdiv($line['line_total'], $subtotal, $scale);
    $itemDisc = bcmul($saleDiscount, $weight, $scale);
    $remainingDisc = bcsub($remainingDisc, $itemDisc, $scale);
}
```

`BtwCalculationService.php:159-166`. Result: per-line BTW sums to the reported cart BTW total, every time. Pinned by `test_rekenkamer_audit_btw_totals_match_sum_of_line_btw` (line 547):

```php
$sumBtw = '0.00';
foreach ($result['items'] as $item) {
    $sumBtw = bcadd($sumBtw, $item['btw_amount'], 2);
}
$this->assertSame($result['btw_total'], $sumBtw);
```

### `saleDiscountSrd` vs `saleDiscountPct`

If both are passed, **SRD wins** (line 141 checks SRD first). Pinned: `test_cart_srd_discount_preferred_over_pct_when_both_given` (line 278). This matches the POS UI where the cashier picks one input or the other, not both at once.

### Cap at subtotal

```php
if (bccomp($saleDiscount, $subtotal, $scale) > 0) {
    $saleDiscount = $subtotal;
}
```

Line 147-149. A `999.00` cart discount on a `10.00` basket gives `total = 0.00`, never negative. Pinned: `test_cart_discount_capped_at_subtotal` (line 243).

---

## BTW-exempt items

Suriname law exempts basic foodstuffs and medicine (rijst, brood, melk, kip, voorgeschreven medicijnen, …). The product carries a `btw_exempt` boolean (`products.btw_exempt` migration `2026_04_12_200005_create_products_table.php`).

The exempt branch at `BtwCalculationService.php:69-72`:

```php
if ($btwExempt || bccomp($btwRate, '0', $scale) === 0) {
    $btwAmount = '0.00';
    $btwBase   = $this->round2($lineNet);
}
```

| Property | Behaviour |
|---|---|
| `btw_amount` | Always `'0.00'` |
| `btw_base` | Full `line_net` — the entire amount is non-taxable revenue |
| Item still appears on the cart? | Yes |
| Item counted in `subtotal`? | Yes |
| Item shares in sale-level discount? | Yes |
| Item BTW recomputed after discount? | Yes — re-enters `calculateLineItem` with the new discount, still hits the exempt branch, still returns `0.00` |

The last point is the trap: it would be easy for "redistribute the cart discount proportionally" to accidentally tax an exempt item. The exempt branch fires inside `calculateLineItem` itself, so pass 3 of the cart algorithm cannot bypass it. Pinned: `test_sale_discount_does_not_affect_exempt_item_btw` (line 601):

```php
$result = $this->btw->calculateCart([
    ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
    ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
], saleDiscountSrd: '4.00');

$this->assertSame('0.00', $result['items'][1]['btw_amount']);
```

The `btw_rate` is set to `10` on the exempt item to prove the `btw_exempt` flag takes precedence over the rate.

---

## Multi-rate carts

Suriname BTW is mostly 10%, but the service accepts any rate `0..100` per item. A government department buying a mix of consumables (10%) and exempt staples (0%) is the realistic case.

The cart algorithm doesn't know or care about rates — every line is processed identically and the per-rate breakdown is reconstructed downstream on the **receipt** and the **BTW report**. The receipt template groups items by rate in `backend/app/Services/ReceiptService.php:45-55`:

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

Mixed-rate sanity check in tests: `test_mixed_btw_rates_in_single_basket` (line 576) — 10% line plus 15% line, BTW total `25.00`.

---

## The 50+ unit-test scenarios

File: `backend/tests/Unit/BtwCalculationServiceTest.php` (611 lines). Ten sections, each pinning one rule.

| Section | What it locks down | Representative test |
|---|---|---|
| 1. Basic line-item extraction | Standard 10%, decimal qty, decimal price rounding | `test_standard_10_pct_btw_single_unit` |
| 2. Item-level discounts | Discount reduces base, 100% discount, cap | `test_item_discount_reduces_btw_base` |
| 3. BTW rate variations | 0%, 5%, 15%, 21%, 100% | `test_5_pct_btw_rate` |
| 4. Cart-level | Mixed exempt/taxable, SRD vs pct discount, empty cart | `test_cart_srd_sale_discount_distributed_proportionally` |
| 5. Belastingdienst compliance | Discount-before-BTW order, exempt items, Surinamese basket | `test_belastingdienst_discount_applied_before_btw` |
| 6. `extractBtw` helper | Standalone receipt reconstruction | `test_extract_btw_exact_cent_rounding` |
| 7. `pctToSrd` helper | Pct discount math, 0%, 100%, rounding | `test_pct_to_srd_15_pct_rounding` |
| 8. Edge cases / guards | 0-price, 0-qty, very small amount, negative inputs throw | `test_very_small_amount_rounds_correctly` |
| 9. Float safety | Classic `0.1+0.2`, return types are strings | `test_no_float_drift_classic_0_1_plus_0_2_problem` |
| 10. Suriname compliance | Govt segregation, Rekenkamer totals match, mixed rates, exempt | `test_rekenkamer_audit_btw_totals_match_sum_of_line_btw` |

A few worth highlighting:

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

All 50+ tests run on every CI commit via `.github/workflows/backend.yml`. A failure blocks merge — the V-Model gate from the project plan.

---

## BTW report endpoint

`GET /api/reports/btw` — `backend/app/Http/Controllers/Api/ReportController.php:246`.

Permission: `reports.btw` (line 248). Validates `store_id`, `date_from`, `date_to`. Aggregates `sale_items` joined to `sales` (status `completed` only) by `(btw_rate, btw_exempt)`:

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

Response shape:

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

PDF export of the same data is via `GET /api/reports/export?type=btw` (line 293) — the PDF wrapper is a placeholder in the current build, marked for SPOS-209 expansion.

The reason the report sums `sale_items.btw_srd` directly (rather than re-computing from `line_total_srd` and `btw_rate`) is the redistribution math above: per-line BTW is the **canonical** value, persisted at sale time, locked in by the row insert. Re-deriving from the rate alone would discard the rounding decisions made when the sale was rung up.

---

## Edge cases

| Input | Behaviour | Test |
|---|---|---|
| `quantity = '0'` | `line_gross = 0.00`, `btw_amount = 0.00` | `test_zero_quantity_yields_zero_totals` (414) |
| `unit_price = '0'` | All zeros | `test_zero_price_yields_zero_totals` (405) |
| `discount = unit_price × qty` | `line_total = 0.00`, `btw_amount = 0.00` | `test_100_pct_item_discount_yields_zero_line_total` (101) |
| `saleDiscountPct = 100` | `total = 0.00`, `btw_total = 0.00` | `test_cart_100_pct_discount_yields_zero_total` (232) |
| `saleDiscountSrd > subtotal` | Discount capped at subtotal | `test_cart_discount_capped_at_subtotal` (243) |
| Empty cart | All zeros | `test_empty_cart_returns_zeros` (254) |
| `unit_price = '0.01'` × 1, 10% | `btw_amount = '0.00'` (rounds to 0) | `test_very_small_amount_rounds_correctly` (421) |
| Negative inputs | `InvalidArgumentException` | `test_negative_price_throws_exception` (439) |

The "999 SRD discount on a 10 SRD item" case is the one that catches naïve implementations. Without the cap you get a negative `line_total`, which then produces a negative BTW (a tax *credit* to the customer), which then poisons the cart subtotal, which then makes the receipt total nonsense. The `min()` clamp at line 61 blocks the whole cascade in one spot.

---

## Helpers

Two extra public methods on the service worth knowing:

### `extractBtw($inclusiveAmount, $btwRate)`

`BtwCalculationService.php:215`. Given a tax-inclusive total and a rate, returns just the BTW amount. Used by code that has the gross figure but not the cart structure — receipt reconstruction, ad-hoc reports.

```
extractBtw('110.00', '10') = '10.00'
extractBtw('1.00',   '10') = '0.09'   (0.0909... rounds half-up)
extractBtw('50.00',  '0')  = '0.00'   (short-circuit)
```

### `pctToSrd($baseAmount, $pct)`

`BtwCalculationService.php:199`. Converts a percentage discount into the SRD amount it represents, rounded to 2 places. Throws `InvalidArgumentException` if `pct > 100`. Used by the discount-rule service to materialise pct rules into SRD before the BTW pass sees them.

```
pctToSrd('100.00', '10')   = '10.00'
pctToSrd('33.33',  '15')   = '5.00'    (4.9995 rounds up)
pctToSrd('500.00', '0')    = '0.00'
```

---

## Filing to the Belastingdienst — `btw_submissions`

Everything above answers *"how much BTW did we collect?"*. The filing pipeline turns that answer into a formal, tamper-evident return that a Belastingdienst tax inspector reviews inside the platform. One model (`BtwSubmission`), one service (`BtwSubmissionService`), one controller (`BtwSubmissionController`), one policy (`BtwSubmissionPolicy`).

### The submission row

A `btw_submissions` row is a **snapshot at filing time**, never recomputed on read — the inspector must see exactly what was claimed, even if sales are voided later (corrections go through the supersede flow, never a silent recompute):

| Column | Meaning |
|---|---|
| `period_type`, `period_start`, `period_end` | `daily` / `weekly` / `monthly` (`BtwSubmission::PERIOD_TYPES`). |
| `store_id` | NULL = consolidated org-wide filing; set = per-store filing. |
| `sales_count`, `total_sales_srd`, `btw_exempt_srd`, `btw_taxable_srd`, `total_btw_srd` | Snapshot totals from `BtwSubmissionService::computeTotals`. |
| `status` | `filed` → `accepted` \| `disputed` \| `superseded`. |
| `reference` | Server-generated, unique — `BTW-{YYYY}-{MM}-{ORGSLUG}-{DAY\|WK\|MTH}-{NNN}` (per-org sequence per period-type per month, so resubmissions get `-002`, `-003`, …). |
| `submitted_at/by`, `reviewed_at/by`, `submitter_note`, `inspector_note` | Both sides of the review dialogue. |
| `sale_ids` | JSONB array of the covered sale UUIDs — a Rekenkamer auditor can walk from filing back to source sales row-by-row. |
| `prev_hash`, `current_hash` | Per-org SHA-256 chain, below. |

There is **no `draft` status** — the dry-run role is played by `POST /api/btw-submissions/preview`, which runs the same `computeTotals` and warns about an existing filing for the period without persisting anything.

`computeTotals` (`backend/app/Services/BtwSubmissionService.php`) scopes to `status = 'completed'`, `source IN ('pos','api')` (historical `import` rows excluded), `occurred_at` within the period in AST. Exempt revenue is summed from `sale_items.btw_exempt = true` lines — *not* the old "sale with zero BTW is exempt" proxy, which misclassified every mixed basket (rice + cola). Taxable = total − exempt, clamped at `0.00`.

### Periods — daily / weekly / monthly

`validatePayload` enforces the period shape: `daily` must be a single day, `monthly` must be exactly first-to-last of one calendar month, `weekly` has no shape guard (any past range files as weekly). Belastingdienst's formal cycle is monthly; daily/weekly exist for high-volume or transparency-minded clients — which is also why **only monthly filings ping the inspectors' notification bell** (`BtwFilingSubmitted`); daily/weekly just appear in the review queue. Resubmissions always ping (`BtwFilingResubmitted`) — they follow a dispute the inspector raised.

### Org-wide (OA) vs store-scoped (SM) filings

BTW is legally an organisation-level return, so the consolidated org-wide filing (`store_id` NULL) is the Org Admin's job. A Store Manager can also file — common for single-store Surinamese shops — but `validatePayload` **forces `store_id = $user->store_id`** for store-bound roles, ignoring whatever the client sent. An OA naming a specific store passes through `canAccessStore`. The same split runs through every read: `applyListFilters` pins an SM to their own store's filings, `BtwSubmissionPolicy::view/supersede` re-check it per row.

### Idempotency — one active filing per period

Three migrations tell the story:

1. `2026_05_26_030001` — plain composite UNIQUE on `(organisation_id, period_type, period_start, period_end)`. Blocked double-filing, but also blocked *resubmission*.
2. `2026_05_26_070001` — replaced by a **partial unique index** `btw_subs_active_period_unique … WHERE status <> 'superseded'`. Superseded rows no longer occupy the period, so a period can be resubmitted any number of times.
3. `2026_06_16_000001` — made it **store-aware**: the index now includes `COALESCE(store_id, '0000…0000'::uuid)` (sentinel for NULL, because a plain nullable column would let org-wide duplicates through). Net effect: one active org-wide filing per period, one active filing per store per period, and org-wide + per-store filings for the same period coexist.

On top of the index, `store()` pre-checks for a blocking `filed`/`accepted` row and returns `409 BTW_ALREADY_FILED` with the existing reference — a friendlier failure than the constraint violation.

### The hash chain

`BtwSubmissionService::hashChain` computes `current_hash = sha256(prev_hash . '|' . canonical_json)` over the canonical filing payload (org, store, period, totals, submitter, reference). The chain is **per-organisation** — a taxpayer's filings must form one continuous self-contained ledger; if `prev` were global, org B filing would become a link in org A's sequence and per-taxpayer verification would break the moment anyone else filed. `prev` is the latest `current_hash` for the org ordered by `submitted_at` (UUID PKs aren't monotonic).

Same pattern as the `audit_logs` chain (ch 2), but note: `php artisan audit:verify` covers `audit_logs` only — a `btw:verify-chain` counterpart is mentioned in the migration comments and **does not exist yet**. Until it ships, verification means walking `btw_submissions` per org and recomputing.

### Review loop — accept / dispute / resubmit

```
OA or SM                              tax_inspector
────────                              ─────────────
preview (dry-run)
file → status: filed  ──────────────▶ review queue
                                      ├── accept  → status: accepted   (locked — cannot be superseded)
                                      └── dispute → status: disputed   (inspector_note required, min 5 chars)
                        ◀────────────  taxpayer notified (bell + mail)
correct & resubmit:
POST {id}/supersede
  ├── recompute totals (picks up post-filing voids/refunds)
  ├── original → status: superseded  (frees the partial unique index)
  └── new row  → status: filed  ────▶ inspector notified, re-review
```

Gates in `BtwSubmissionPolicy`: `review` requires `btw.review_submission` **and** `status === 'filed'` (accepted/disputed/superseded rows are done); `supersede` requires `btw.submit`, same org, same store for an SM, and `status ∈ [filed, disputed]` — an accepted filing is the tax authority's record and cannot be replaced. Even the SA goes through `review` so audit attribution stays honest. Every transition writes an `audit_logs` row: `btw.submitted`, `btw.accepted`, `btw.disputed`, `btw.superseded`.

### Endpoints

All under `auth:sanctum` (`backend/routes/api.php:342-358`); static paths registered before the `{btwSubmission}` wildcards:

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/api/btw-submissions` | `btw.view_submissions` | Cross-org roles see everything; OA their org; SM their store. Filters: status, period_type, from/to, year, amount band, `source` (pos/api via `sale_ids`), search. |
| `GET` | `/api/btw-submissions/export` | same | Streamed CSV (UTF-8 BOM for Excel), same filters as index — the CSV always matches the screen. |
| `GET` | `/api/btw-submissions/inspector-dashboard` | same | KPI snapshot: BTW this/last month, pending/disputed counts, 30-day trend, top orgs; cross-org roles also get the >7-days-silent late-filers list. For an OA the same shape scoped to their own org. |
| `POST` | `/api/btw-submissions/preview` | `btw.submit` | Dry-run totals + existing-filing warning. |
| `POST` | `/api/btw-submissions` | `btw.submit` | Files. `409 BTW_ALREADY_FILED` on an active duplicate. |
| `GET` | `/api/btw-submissions/{id}` / `{id}/detail` | policy `view` | Detail adds per-store, per-source (`sales.source` — Josbin POS vs Layer-3 API vs import), per-payment-method, per-BTW-rate breakdowns + the audit-log timeline. |
| `POST` | `/api/btw-submissions/{id}/accept` | policy `review` | Optional note. Notifies taxpayer. |
| `POST` | `/api/btw-submissions/{id}/dispute` | policy `review` | Note required. Notifies taxpayer. |
| `POST` | `/api/btw-submissions/bulk-accept` | per-row `review` | Up to 200 ids, `throttle:30,1`. Rows that aren't `filed` (or aren't reviewable by the caller) are skipped, not errored; each accept still writes its own audit row and notification. |
| `POST` | `/api/btw-submissions/{id}/supersede` | policy `supersede` | The correct-and-resubmit flow above. |

Notification mechanics (queued `database`+`mail`, why an SMTP outage can't block an inspector's action) are in [10 — Jobs & schedules](10-jobs-and-schedules.md); the `tax_inspector` role itself is in [3 — Auth & roles](03-auth-and-roles.md).

---

## Where each piece lives

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

Belastingdienst filing pipeline
├── BtwSubmission (model)           backend/app/Models/BtwSubmission.php
├── BtwSubmissionService            backend/app/Services/BtwSubmissionService.php
│   ├── computeTotals               snapshot totals + sale_ids
│   ├── nextReference               BTW-YYYY-MM-ORGSLUG-…-NNN
│   └── hashChain                   per-org sha256 chain
├── BtwSubmissionController         backend/app/Http/Controllers/Api/BtwSubmissionController.php
├── BtwSubmissionPolicy             backend/app/Policies/BtwSubmissionPolicy.php
├── Notifications                   backend/app/Notifications/BtwFiling{Submitted,Accepted,Disputed,Resubmitted}.php
└── Migrations                      2026_05_26_030001 → 2026_05_26_070001 → 2026_06_16_000001

Pre-BTW discount layer
└── DiscountRuleService::applyRules backend/app/Services/DiscountRuleService.php:33
    (writes applied_discount_srd before BTW sees the cart — compliance ordering)
```

---

→ Next: [6 — Register and Z-Report](06-register-and-z-report.md)
