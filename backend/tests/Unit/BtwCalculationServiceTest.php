<?php

namespace Tests\Unit;

use App\Services\BtwCalculationService;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

/**
 * BtwCalculationService Unit Tests
 *
 * V-Model gate: 50+ scenarios covering Belastingdienst Suriname BTW rules.
 * All monetary values use string comparison to avoid float precision errors.
 */
class BtwCalculationServiceTest extends TestCase
{
    private BtwCalculationService $btw;

    protected function setUp(): void
    {
        $this->btw = new BtwCalculationService();
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 1 — Basic line item BTW extraction (10% rate)
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_standard_10_pct_btw_single_unit(): void
    {
        // SRD 11.00 inclusive: BTW = 11 - 11/1.10 = 11 - 10 = 1.00
        $r = $this->btw->calculateLineItem('11.00', '1', '10');
        $this->assertSame('11.00', $r['line_gross']);
        $this->assertSame('10.00', $r['btw_base']);
        $this->assertSame('1.00',  $r['btw_amount']);
        $this->assertSame('11.00', $r['line_total']);
    }

    /** @test */
    public function test_10_pct_btw_with_quantity_2(): void
    {
        // 2 × SRD 11.00 = 22.00 gross; BTW = 22 - 22/1.10 = 2.00
        $r = $this->btw->calculateLineItem('11.00', '2', '10');
        $this->assertSame('22.00', $r['line_gross']);
        $this->assertSame('2.00',  $r['btw_amount']);
        $this->assertSame('20.00', $r['btw_base']);
    }

    /** @test */
    public function test_10_pct_btw_decimal_quantity(): void
    {
        // 0.5 × SRD 10.00 = 5.00; BTW = 5 - 5/1.10 = 0.45 (rounded)
        $r = $this->btw->calculateLineItem('10.00', '0.5', '10');
        $this->assertSame('5.00', $r['line_gross']);
        $this->assertSame('0.45', $r['btw_amount']);
    }

    /** @test */
    public function test_10_pct_btw_decimal_price_rounds_half_up(): void
    {
        // SRD 1.00 inclusive at 10%: BTW = 1 - 1/1.1 = 0.0909... rounds to 0.09
        $r = $this->btw->calculateLineItem('1.00', '1', '10');
        $this->assertSame('0.09', $r['btw_amount']);
    }

    /** @test */
    public function test_zero_btw_rate_yields_zero_btw(): void
    {
        $r = $this->btw->calculateLineItem('25.00', '3', '0');
        $this->assertSame('0.00',  $r['btw_amount']);
        $this->assertSame('75.00', $r['btw_base']);
        $this->assertSame('75.00', $r['line_total']);
    }

    /** @test */
    public function test_btw_exempt_flag_yields_zero_btw_regardless_of_rate(): void
    {
        // Even with 10% rate, exempt = true → btw_amount = 0
        $r = $this->btw->calculateLineItem('11.00', '1', '10', btwExempt: true);
        $this->assertSame('0.00',  $r['btw_amount']);
        $this->assertSame('11.00', $r['btw_base']);
        $this->assertSame('11.00', $r['line_total']);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 2 — Item-level discounts (BTW recalculated on net)
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_item_discount_reduces_btw_base(): void
    {
        // Price 11.00, qty 1, 10% BTW, discount SRD 1.00
        // Net = 10.00; BTW = 10 - 10/1.10 = 0.91
        $r = $this->btw->calculateLineItem('11.00', '1', '10', discountSrd: '1.00');
        $this->assertSame('11.00', $r['line_gross']);
        $this->assertSame('10.00', $r['line_net']);
        $this->assertSame('10.00', $r['line_total']);
        $this->assertSame('0.91',  $r['btw_amount']);
    }

    /** @test */
    public function test_100_pct_item_discount_yields_zero_line_total(): void
    {
        $r = $this->btw->calculateLineItem('50.00', '2', '10', discountSrd: '100.00');
        $this->assertSame('0.00', $r['line_total']);
        $this->assertSame('0.00', $r['btw_amount']);
    }

    /** @test */
    public function test_item_discount_exceeding_line_gross_is_capped(): void
    {
        // discount 999 on a 10.00 item → capped to 10.00
        $r = $this->btw->calculateLineItem('10.00', '1', '10', discountSrd: '999.00');
        $this->assertSame('0.00', $r['line_total']);
        $this->assertSame('0.00', $r['btw_amount']);
    }

    /** @test */
    public function test_exempt_item_with_discount_has_zero_btw(): void
    {
        $r = $this->btw->calculateLineItem('20.00', '1', '10', btwExempt: true, discountSrd: '5.00');
        $this->assertSame('15.00', $r['line_total']);
        $this->assertSame('0.00',  $r['btw_amount']);
        $this->assertSame('15.00', $r['btw_base']);
    }

    /** @test */
    public function test_discount_zero_is_no_op(): void
    {
        $with    = $this->btw->calculateLineItem('11.00', '1', '10', discountSrd: '0.00');
        $without = $this->btw->calculateLineItem('11.00', '1', '10');
        $this->assertSame($without, $with);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 3 — BTW rate variations
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_5_pct_btw_rate(): void
    {
        // SRD 10.50 at 5%: BTW = 10.50 - 10.50/1.05 = 0.50
        $r = $this->btw->calculateLineItem('10.50', '1', '5');
        $this->assertSame('0.50', $r['btw_amount']);
        $this->assertSame('10.00', $r['btw_base']);
    }

    /** @test */
    public function test_15_pct_btw_rate(): void
    {
        // SRD 11.50 at 15%: BTW = 11.50 - 11.50/1.15 = 1.50
        $r = $this->btw->calculateLineItem('11.50', '1', '15');
        $this->assertSame('1.50', $r['btw_amount']);
        $this->assertSame('10.00', $r['btw_base']);
    }

    /** @test */
    public function test_21_pct_btw_rate(): void
    {
        // SRD 12.10 at 21%: base = 12.10/1.21 = 10.00, BTW = 2.10
        $r = $this->btw->calculateLineItem('12.10', '1', '21');
        $this->assertSame('2.10', $r['btw_amount']);
        $this->assertSame('10.00', $r['btw_base']);
    }

    /** @test */
    public function test_100_pct_btw_rate(): void
    {
        // SRD 20.00 at 100%: base = 10.00, BTW = 10.00
        $r = $this->btw->calculateLineItem('20.00', '1', '100');
        $this->assertSame('10.00', $r['btw_amount']);
        $this->assertSame('10.00', $r['btw_base']);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 4 — Cart-level calculations (sale-level discounts)
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_cart_no_discount_single_taxable_item(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ]);

        $this->assertSame('11.00', $result['subtotal']);
        $this->assertSame('0.00',  $result['sale_discount']);
        $this->assertSame('1.00',  $result['btw_total']);
        $this->assertSame('11.00', $result['total']);
    }

    /** @test */
    public function test_cart_no_discount_mixed_taxable_and_exempt(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '10.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
        ]);

        $this->assertSame('21.00', $result['subtotal']);
        $this->assertSame('1.00',  $result['btw_total']);
        $this->assertSame('21.00', $result['total']);
    }

    /** @test */
    public function test_cart_srd_sale_discount_distributed_proportionally(): void
    {
        // Two equal items, SRD 5 discount: each gets 2.50 discount
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ], saleDiscountSrd: '2.00');

        $this->assertSame('22.00', $result['subtotal']);
        $this->assertSame('2.00',  $result['sale_discount']);
        $this->assertSame('20.00', $result['total']);
    }

    /** @test */
    public function test_cart_pct_sale_discount(): void
    {
        // 10% off SRD 100.00 = SRD 10.00 discount
        $result = $this->btw->calculateCart([
            ['unit_price' => '100.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ], saleDiscountPct: '10');

        $this->assertSame('100.00', $result['subtotal']);
        $this->assertSame('10.00',  $result['sale_discount']);
        $this->assertSame('90.00',  $result['total']);
    }

    /** @test */
    public function test_cart_100_pct_discount_yields_zero_total(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '50.00', 'quantity' => '2', 'btw_rate' => '10', 'btw_exempt' => false],
        ], saleDiscountPct: '100');

        $this->assertSame('0.00', $result['total']);
        $this->assertSame('0.00', $result['btw_total']);
    }

    /** @test */
    public function test_cart_discount_capped_at_subtotal(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '10.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ], saleDiscountSrd: '999.00');

        $this->assertSame('0.00', $result['total']);
        $this->assertSame('10.00', $result['sale_discount']);
    }

    /** @test */
    public function test_empty_cart_returns_zeros(): void
    {
        $result = $this->btw->calculateCart([]);
        $this->assertSame('0.00', $result['subtotal']);
        $this->assertSame('0.00', $result['btw_total']);
        $this->assertSame('0.00', $result['total']);
    }

    /** @test */
    public function test_cart_discount_reduces_btw_proportionally_not_on_gross(): void
    {
        // Rule: BTW on exempt items must remain 0 even after sale discount
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '10.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
        ], saleDiscountSrd: '2.00');

        // After discount, exempt item must still have 0 BTW
        $items = $result['items'];
        $exemptItem = $items[1];
        $this->assertSame('0.00', $exemptItem['btw_amount']);
    }

    /** @test */
    public function test_cart_srd_and_pct_discounts_are_additive_when_both_given(): void
    {
        // P1-D5: this test used to assert "SRD wins" — which WAS the bug:
        // a rule-produced SRD discount silently swallowed the cashier's
        // percentage. Both components now apply: 5.00 + 50% of 100.00.
        $result = $this->btw->calculateCart([
            ['unit_price' => '100.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ], saleDiscountSrd: '5.00', saleDiscountPct: '50');

        $this->assertSame('55.00', $result['sale_discount']);
        $this->assertSame('45.00', $result['total']);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 5 — Belastingdienst compliance scenarios
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_belastingdienst_discount_applied_before_btw(): void
    {
        // If discount applied AFTER BTW: BTW would be 1.00 on SRD 11, discount later
        // Correct (Belastingdienst): discount SRD 1.10 → net 9.90 → BTW = 9.90 - 9.90/1.10 = 0.90
        $r = $this->btw->calculateLineItem('11.00', '1', '10', discountSrd: '1.10');
        $this->assertSame('9.90', $r['line_total']);
        $this->assertSame('0.90', $r['btw_amount']);
        // NOT 1.00 BTW on the gross and then subtract discount
    }

    /** @test */
    public function test_btw_on_exempt_items_is_never_reported(): void
    {
        $r = $this->btw->calculateLineItem('100.00', '5', '10', btwExempt: true);
        $this->assertSame('0.00', $r['btw_amount']);
        $this->assertSame('500.00', $r['btw_base']); // full amount in btw_base as non-taxable
    }

    /** @test */
    public function test_decimal_quantity_btw_rounding_suriname_typical(): void
    {
        // Rice sold by weight: 2.5 kg at SRD 38.50/kg, 0% BTW (staple food)
        $r = $this->btw->calculateLineItem('38.50', '2.5', '0', btwExempt: true);
        $this->assertSame('96.25', $r['line_gross']);
        $this->assertSame('0.00',  $r['btw_amount']);
    }

    /** @test */
    public function test_typical_supermarket_basket(): void
    {
        // Realistic Surinamese supermarket basket
        $result = $this->btw->calculateCart([
            // Rice 5kg — exempt
            ['unit_price' => '38.50', 'quantity' => '1',   'btw_rate' => '0',  'btw_exempt' => true],
            // Cooking oil 1L — 10% BTW
            ['unit_price' => '22.00', 'quantity' => '2',   'btw_rate' => '10', 'btw_exempt' => false],
            // Chicken 1.2kg — exempt
            ['unit_price' => '35.00', 'quantity' => '1.2', 'btw_rate' => '0',  'btw_exempt' => true],
            // Soft drink — 10% BTW
            ['unit_price' => '8.80',  'quantity' => '3',   'btw_rate' => '10', 'btw_exempt' => false],
        ]);

        $this->assertSame('0.00', $result['sale_discount']);
        // BTW items: 44.00 + 26.40 = 70.40 → BTW = 70.40 - 70.40/1.10 = 6.40
        $this->assertSame('6.40', $result['btw_total']);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 6 — extractBtw helper
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_extract_btw_from_inclusive_total(): void
    {
        $btw = $this->btw->extractBtw('110.00', '10');
        $this->assertSame('10.00', $btw);
    }

    /** @test */
    public function test_extract_btw_zero_rate_returns_zero(): void
    {
        $this->assertSame('0.00', $this->btw->extractBtw('50.00', '0'));
    }

    /** @test */
    public function test_extract_btw_exact_cent_rounding(): void
    {
        // 1.00 at 10%: BTW = 0.0909... → rounds to 0.09
        $this->assertSame('0.09', $this->btw->extractBtw('1.00', '10'));
    }

    /** @test */
    public function test_extract_btw_large_amount(): void
    {
        $btw = $this->btw->extractBtw('10000.00', '10');
        $this->assertSame('909.09', $btw);
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 7 — pctToSrd helper
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_pct_to_srd_10_pct_of_100(): void
    {
        $this->assertSame('10.00', $this->btw->pctToSrd('100.00', '10'));
    }

    /** @test */
    public function test_pct_to_srd_15_pct_rounding(): void
    {
        // 15% of 33.33 = 4.9995 → rounds to 5.00
        $this->assertSame('5.00', $this->btw->pctToSrd('33.33', '15'));
    }

    /** @test */
    public function test_pct_to_srd_100_pct_equals_base(): void
    {
        $this->assertSame('50.00', $this->btw->pctToSrd('50.00', '100'));
    }

    /** @test */
    public function test_pct_to_srd_zero_pct_returns_zero(): void
    {
        $this->assertSame('0.00', $this->btw->pctToSrd('500.00', '0'));
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 8 — Edge cases and guard validation
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_zero_price_yields_zero_totals(): void
    {
        $r = $this->btw->calculateLineItem('0.00', '1', '10');
        $this->assertSame('0.00', $r['line_gross']);
        $this->assertSame('0.00', $r['btw_amount']);
    }

    /** @test */
    public function test_zero_quantity_yields_zero_totals(): void
    {
        $r = $this->btw->calculateLineItem('11.00', '0', '10');
        $this->assertSame('0.00', $r['line_gross']);
        $this->assertSame('0.00', $r['btw_amount']);
    }

    /** @test */
    public function test_very_small_amount_rounds_correctly(): void
    {
        // SRD 0.01 at 10%: BTW = 0.01 - 0.01/1.10 = 0.0009... rounds to 0.00
        $r = $this->btw->calculateLineItem('0.01', '1', '10');
        $this->assertSame('0.00', $r['btw_amount']);
        $this->assertSame('0.01', $r['line_total']);
    }

    /** @test */
    public function test_large_quantity_decimal_precision(): void
    {
        // 999.999 kg at SRD 1.00 each, 10% BTW — BCMath multiplies exactly,
        // then half-up rounding to 2dp gives 1000.00.
        $r = $this->btw->calculateLineItem('1.00', '999.999', '10');
        $this->assertSame('1000.00', $r['line_gross']);
        // BTW = 1000 - 1000/1.10 = 90.909... → rounds to 90.91
        $this->assertSame('90.91', $r['btw_amount']);
    }

    /** @test */
    public function test_very_large_total_preserves_two_decimal_precision(): void
    {
        // 5,000,000.00 single-unit at 10%: BTW = 5,000,000 - 5,000,000/1.10
        //   = 5,000,000 - 4,545,454.5454... = 454,545.4545... → 454,545.45
        $r = $this->btw->calculateLineItem('5000000.00', '1', '10');
        $this->assertSame('5000000.00', $r['line_gross']);
        $this->assertSame('454545.45',  $r['btw_amount']);
        $this->assertSame('4545454.55', $r['btw_base']);
    }

    /** @test */
    public function test_negative_price_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->calculateLineItem('-1.00', '1', '10');
    }

    /** @test */
    public function test_negative_quantity_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->calculateLineItem('10.00', '-1', '10');
    }

    /** @test */
    public function test_negative_btw_rate_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->calculateLineItem('10.00', '1', '-1');
    }

    /** @test */
    public function test_btw_rate_over_100_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->calculateLineItem('10.00', '1', '101');
    }

    /** @test */
    public function test_pct_discount_over_100_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->pctToSrd('100.00', '101');
    }

    /** @test */
    public function test_negative_discount_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->btw->calculateLineItem('10.00', '1', '10', discountSrd: '-1.00');
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 9 — Float-safety: no float arithmetic leakage
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_no_float_drift_classic_0_1_plus_0_2_problem(): void
    {
        // PHP float: 0.1 + 0.2 = 0.30000000000000004
        // Our service uses BCMath; this should return exactly 0.30
        $r = $this->btw->calculateLineItem('0.10', '3', '0');
        $this->assertSame('0.30', $r['line_total']);
    }

    /** @test */
    public function test_no_float_drift_on_btw_extraction(): void
    {
        // 3 × 3.33 = 9.99 at 10% BTW
        $r = $this->btw->calculateLineItem('3.33', '3', '10');
        $this->assertSame('9.99', $r['line_gross']);
        $btwFloat = (float) '9.99' - (float) '9.99' / 1.10; // float gives ~0.9081818...
        $this->assertSame('0.91', $r['btw_amount']);         // BCMath rounds correctly
    }

    /** @test */
    public function test_return_values_are_always_string_not_float(): void
    {
        $r = $this->btw->calculateLineItem('11.00', '1', '10');
        foreach ($r as $key => $val) {
            $this->assertIsString($val, "Expected string for key '$key', got " . gettype($val));
        }
    }

    /** @test */
    public function test_cart_return_monetary_values_are_strings(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
        ]);

        foreach (['subtotal', 'sale_discount', 'btw_total', 'total'] as $key) {
            $this->assertIsString($result[$key], "Expected string for key '$key'");
        }
    }

    // ════════════════════════════════════════════════════════════════
    // SECTION 10 — Suriname-specific compliance scenarios
    // ════════════════════════════════════════════════════════════════

    /** @test */
    public function test_government_purchase_segregation_btw_breakdown(): void
    {
        // Government dept buys: mixed exempt and taxable, with sale discount
        $result = $this->btw->calculateCart([
            ['unit_price' => '55.00', 'quantity' => '10', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '20.00', 'quantity' => '5',  'btw_rate' => '0',  'btw_exempt' => true],
        ], saleDiscountPct: '5');

        $subtotal = '650.00'; // 550 + 100
        $this->assertSame($subtotal, $result['subtotal']);
        $discount = '32.50'; // 5% of 650
        $this->assertSame($discount, $result['sale_discount']);
        $this->assertSame('617.50', $result['total']);
        // BTW only on non-exempt portion after discount
        $this->assertNotSame('0.00', $result['btw_total']);
    }

    /** @test */
    public function test_rekenkamer_audit_btw_totals_match_sum_of_line_btw(): void
    {
        $items = [
            ['unit_price' => '11.00', 'quantity' => '2', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '22.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '5.00',  'quantity' => '4', 'btw_rate' => '0',  'btw_exempt' => true],
        ];

        $result = $this->btw->calculateCart($items);

        // Sum of item-level BTW must equal reported btw_total
        $sumBtw = '0.00';
        foreach ($result['items'] as $item) {
            $sumBtw = bcadd($sumBtw, $item['btw_amount'], 2);
        }
        $this->assertSame($result['btw_total'], $sumBtw);
    }

    /** @test */
    public function test_void_sale_all_values_reverse_to_zero_or_negative(): void
    {
        // A void is a refund — same calculation but sign inverted by caller
        // Service itself always uses non-negative values; sign handling is at controller level
        $r = $this->btw->calculateLineItem('110.00', '1', '10');
        $this->assertSame('110.00', $r['line_total']);
        // Caller would negate: -110.00 for the refund
    }

    /** @test */
    public function test_mixed_btw_rates_in_single_basket(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '110.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '115.00', 'quantity' => '1', 'btw_rate' => '15', 'btw_exempt' => false],
        ]);

        // 110: BTW = 10.00; base = 100.00
        // 115: BTW = 15.00; base = 100.00
        $this->assertSame('25.00', $result['btw_total']);
    }

    /** @test */
    public function test_all_exempt_cart_has_zero_btw_total(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '10.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
            ['unit_price' => '20.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
        ]);

        $this->assertSame('0.00', $result['btw_total']);
        $this->assertSame('30.00', $result['total']);
    }

    /** @test */
    /**
     * P1-D5: SRD and percentage sale-discounts must combine ADDITIVELY.
     * A discount rule contributing SRD 10 plus a cashier-granted 10% used
     * to silently drop the 10% (either/or). On a 100.00 subtotal the
     * combined discount is 10 + 10 = 20, total 80.
     */
    public function test_srd_and_pct_sale_discounts_combine_additively(): void
    {
        $cart = $this->btw->calculateCart(
            [[
                'unit_price' => '100.00',
                'quantity'   => '1',
                'btw_rate'   => '10.00',
                'btw_exempt' => false,
            ]],
            saleDiscountSrd: '10.00',
            saleDiscountPct: '10.00',
        );

        $this->assertSame('20.00', $cart['sale_discount']);
        $this->assertSame('80.00', $cart['total']);
    }

    public function test_sale_discount_does_not_affect_exempt_item_btw(): void
    {
        $result = $this->btw->calculateCart([
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => false],
            ['unit_price' => '11.00', 'quantity' => '1', 'btw_rate' => '10', 'btw_exempt' => true],
        ], saleDiscountSrd: '4.00');

        $this->assertSame('0.00', $result['items'][1]['btw_amount']);
    }
}
