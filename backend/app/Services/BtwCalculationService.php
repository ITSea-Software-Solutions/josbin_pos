<?php

namespace App\Services;

use InvalidArgumentException;

/**
 * BtwCalculationService
 *
 * All monetary values use BCMath (string-based DECIMAL arithmetic) — no float.
 * Scale is 4 decimal places for intermediate calculations, rounded to 2 for display.
 *
 * Suriname BTW rules:
 * - BTW is inclusive in the listed price (tax-inclusive pricing).
 * - BTW-exempt products: btw_amount = 0, btw_base = full price.
 * - Discounts are applied BEFORE BTW extraction (Belastingdienst requirement).
 * - Sale-level discounts are distributed proportionally across line items.
 * - Final rounding: BTW per line item rounds HALF_UP to 2 decimal places.
 */
class BtwCalculationService
{
    private const SCALE = 4;
    private const ROUND_HALF_UP = PHP_ROUND_HALF_UP;

    // ─── Line item calculation ─────────────────────────────────────────────

    /**
     * Calculate BTW for a single line item (after any item-level discount).
     *
     * @param  string $unitPrice  Unit price in SRD (inclusive of BTW)
     * @param  string $quantity   Quantity (supports decimal, e.g. 1.5 kg)
     * @param  string $btwRate    BTW rate as percentage string (e.g. "10", "0")
     * @param  bool   $btwExempt  True = product is BTW-exempt (fresh food, medicine)
     * @param  string $discountSrd  Item-level discount in SRD (default "0.00")
     * @return array{
     *   line_gross: string,
     *   line_net: string,
     *   btw_base: string,
     *   btw_amount: string,
     *   line_total: string,
     * }
     */
    public function calculateLineItem(
        string $unitPrice,
        string $quantity,
        string $btwRate,
        bool   $btwExempt = false,
        string $discountSrd = '0.00',
    ): array {
        $this->assertNonNegative($unitPrice, 'unitPrice');
        $this->assertNonNegative($quantity, 'quantity');
        $this->assertNonNegative($discountSrd, 'discountSrd');
        $this->assertValidRate($btwRate);

        $scale = self::SCALE;

        // Gross line amount before discount
        $lineGross = bcmul($unitPrice, $quantity, $scale);

        // Apply item-level discount (cannot exceed line gross)
        $discount = min(
            (float) $discountSrd,
            (float) $lineGross,
        );
        $discountSrd = number_format($discount, $scale, '.', '');
        $lineNet = bcsub($lineGross, $discountSrd, $scale);

        // Extract BTW from net amount (tax-inclusive method)
        if ($btwExempt || bccomp($btwRate, '0', $scale) === 0) {
            $btwAmount = '0.00';
            $btwBase   = $this->round2($lineNet);
        } else {
            // BTW = lineNet - lineNet / (1 + rate/100)
            $divisor   = bcadd('1', bcdiv($btwRate, '100', $scale), $scale);
            $taxExcl   = bcdiv($lineNet, $divisor, $scale);
            $btwAmount = $this->round2(bcsub($lineNet, $taxExcl, $scale));
            $btwBase   = $this->round2($taxExcl);
        }

        $lineTotal = $this->round2($lineNet);

        return [
            'line_gross'  => $this->round2($lineGross),
            'line_net'    => $this->round2($lineNet),
            'btw_base'    => $btwBase,
            'btw_amount'  => $btwAmount,
            'line_total'  => $lineTotal,
        ];
    }

    // ─── Cart-level calculation ───────────────────────────────────────────

    /**
     * Calculate BTW for an entire cart, including an optional sale-level discount.
     *
     * @param  array $items Each item: [unit_price, quantity, btw_rate, btw_exempt, discount_srd?]
     * @param  string $saleDiscountSrd  Sale-level discount in SRD (applied proportionally)
     * @param  string $saleDiscountPct  Sale-level discount as % (used if saleDiscountSrd is 0)
     * @return array{
     *   subtotal: string,
     *   sale_discount: string,
     *   btw_total: string,
     *   total: string,
     *   items: array,
     * }
     */
    public function calculateCart(
        array  $items,
        string $saleDiscountSrd = '0.00',
        string $saleDiscountPct = '0.00',
    ): array {
        $scale = self::SCALE;

        if (empty($items)) {
            return [
                'subtotal'      => '0.00',
                'sale_discount' => '0.00',
                'btw_total'     => '0.00',
                'total'         => '0.00',
                'items'         => [],
            ];
        }

        // Step 1: calculate each line before sale discount
        $lineResults = [];
        $subtotal    = '0.0000';
        foreach ($items as $item) {
            $result     = $this->calculateLineItem(
                unitPrice:   (string) ($item['unit_price'] ?? '0'),
                quantity:    (string) ($item['quantity'] ?? '1'),
                btwRate:     (string) ($item['btw_rate'] ?? '10'),
                btwExempt:   (bool)   ($item['btw_exempt'] ?? false),
                discountSrd: (string) ($item['discount_srd'] ?? '0.00'),
            );
            $lineResults[] = $result;
            $subtotal = bcadd($subtotal, $result['line_total'], $scale);
        }

        // Step 2: resolve sale-level discount amount
        $saleDiscount = '0.0000';
        if (bccomp($saleDiscountSrd, '0', $scale) > 0) {
            $saleDiscount = bcmul($saleDiscountSrd, '1', $scale);
        } elseif (bccomp($saleDiscountPct, '0', $scale) > 0) {
            $saleDiscount = bcdiv(bcmul($subtotal, $saleDiscountPct, $scale), '100', $scale);
        }
        // Cap discount at subtotal
        if (bccomp($saleDiscount, $subtotal, $scale) > 0) {
            $saleDiscount = $subtotal;
        }

        // Step 3: distribute sale discount proportionally across items, recalculate BTW
        $adjustedItems = [];
        $btwTotal      = '0.0000';
        $remainingDisc = $saleDiscount;
        $lastIndex     = count($lineResults) - 1;

        foreach ($lineResults as $i => $line) {
            if (bccomp($subtotal, '0', $scale) === 0) {
                $itemDisc = '0.0000';
            } elseif ($i === $lastIndex) {
                $itemDisc = $remainingDisc; // absorb rounding on last item
            } else {
                $weight   = bcdiv($line['line_total'], $subtotal, $scale);
                $itemDisc = bcmul($saleDiscount, $weight, $scale);
                $remainingDisc = bcsub($remainingDisc, $itemDisc, $scale);
            }

            $item    = $items[$i];
            $adjLine = $this->calculateLineItem(
                unitPrice:   (string) ($item['unit_price'] ?? '0'),
                quantity:    (string) ($item['quantity'] ?? '1'),
                btwRate:     (string) ($item['btw_rate'] ?? '10'),
                btwExempt:   (bool)   ($item['btw_exempt'] ?? false),
                discountSrd: $this->round4(
                    bcadd((string) ($item['discount_srd'] ?? '0.00'), $itemDisc, $scale)
                ),
            );

            $btwTotal        = bcadd($btwTotal, $adjLine['btw_amount'], $scale);
            $adjustedItems[] = $adjLine;
        }

        $total = bcsub($subtotal, $saleDiscount, $scale);

        return [
            'subtotal'      => $this->round2($subtotal),
            'sale_discount' => $this->round2($saleDiscount),
            'btw_total'     => $this->round2($btwTotal),
            'total'         => $this->round2($total),
            'items'         => $adjustedItems,
        ];
    }

    // ─── Percentage discount helpers ──────────────────────────────────────

    /**
     * Convert a percentage discount to an SRD amount.
     */
    public function pctToSrd(string $baseAmount, string $pct): string
    {
        $this->assertNonNegative($baseAmount, 'baseAmount');
        $this->assertNonNegative($pct, 'pct');

        if (bccomp($pct, '100', self::SCALE) > 0) {
            throw new InvalidArgumentException('Discount percentage cannot exceed 100.');
        }

        return $this->round2(bcdiv(bcmul($baseAmount, $pct, self::SCALE), '100', self::SCALE));
    }

    /**
     * Given a tax-inclusive total and a BTW rate, extract the BTW amount.
     * Useful for standalone receipt line reconstruction.
     */
    public function extractBtw(string $inclusiveAmount, string $btwRate): string
    {
        $this->assertNonNegative($inclusiveAmount, 'inclusiveAmount');
        $this->assertValidRate($btwRate);

        if (bccomp($btwRate, '0', self::SCALE) === 0) {
            return '0.00';
        }

        $divisor = bcadd('1', bcdiv($btwRate, '100', self::SCALE), self::SCALE);
        $taxExcl = bcdiv($inclusiveAmount, $divisor, self::SCALE);

        return $this->round2(bcsub($inclusiveAmount, $taxExcl, self::SCALE));
    }

    // ─── Rounding ─────────────────────────────────────────────────────────

    private function round2(string $value): string
    {
        return number_format(round((float) $value, 2, self::ROUND_HALF_UP), 2, '.', '');
    }

    private function round4(string $value): string
    {
        return number_format(round((float) $value, 4, self::ROUND_HALF_UP), 4, '.', '');
    }

    // ─── Guards ───────────────────────────────────────────────────────────

    private function assertNonNegative(string $value, string $field): void
    {
        if (bccomp($value, '0', self::SCALE) < 0) {
            throw new InvalidArgumentException("$field must be non-negative, got: $value");
        }
    }

    private function assertValidRate(string $rate): void
    {
        if (bccomp($rate, '0', self::SCALE) < 0 || bccomp($rate, '100', self::SCALE) > 0) {
            throw new InvalidArgumentException("BTW rate must be between 0 and 100, got: $rate");
        }
    }
}
