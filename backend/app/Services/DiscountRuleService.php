<?php

namespace App\Services;

use App\Models\DiscountRule;
use Illuminate\Support\Collection;

/**
 * Evaluates active discount_rules against a cart and returns a discount_srd
 * amount per line item and/or a cart-level discount.
 *
 * Called by BtwCalculationService (or SaleController) before BTW calculation.
 * Rules are applied BEFORE BTW, as required by Belastingdienst Suriname.
 *
 * Input cart item shape:
 *   product_id, category_id, unit_price (SRD), quantity, btw_rate, btw_exempt
 *
 * Output:
 *   items[]           — same items with applied_discount_srd added
 *   cart_discount_srd — total cart-level discount in SRD
 *   applied_rules[]   — names of rules that fired (for receipt display)
 */
class DiscountRuleService
{
    /**
     * Apply discount rules to a cart.
     *
     * @param string     $organisationId
     * @param string     $storeId
     * @param Collection $items   Each item: product_id, category_id, unit_price, quantity
     * @return array  ['items' => [...], 'cart_discount_srd' => '0.00', 'applied_rules' => [...]]
     */
    public function applyRules(string $organisationId, string $storeId, Collection $items): array
    {
        // Load all active rules for this org/store in a single query
        $rules = DiscountRule::where('organisation_id', $organisationId)
            ->active()
            ->forStore($storeId)
            ->orderBy('applies_to') // product → category → cart
            ->get();

        if ($rules->isEmpty()) {
            return [
                'items'            => $items->map(fn ($item) => array_merge($item, ['applied_discount_srd' => '0.00']))->toArray(),
                'cart_discount_srd'=> '0.00',
                'applied_rules'    => [],
            ];
        }

        $productRules  = $rules->where('applies_to', 'product');
        $categoryRules = $rules->where('applies_to', 'category');
        $cartRules     = $rules->where('applies_to', 'cart');

        $appliedRules = [];
        $processedItems = $items->map(function (array $item) use ($productRules, $categoryRules, &$appliedRules) {
            $item['applied_discount_srd'] = '0.00';
            $alreadyDiscounted = false;

            // 1. Product-specific rules (highest priority)
            if ($item['product_id']) {
                $rule = $productRules
                    ->where('applies_to_id', $item['product_id'])
                    ->first();

                if ($rule && (float) $item['quantity'] >= $rule->min_qty) {
                    $discount = $this->computeLineDiscount($rule, $item);
                    if (bccomp($discount, '0.00', 2) > 0) {
                        $item['applied_discount_srd'] = $discount;
                        $appliedRules[] = $rule->name;
                        $alreadyDiscounted = ! $rule->stackable;
                    }
                }
            }

            // 2. Category rules
            if (! $alreadyDiscounted && $item['category_id']) {
                $rule = $categoryRules
                    ->where('applies_to_id', $item['category_id'])
                    ->first();

                if ($rule && (float) $item['quantity'] >= $rule->min_qty) {
                    $discount = $this->computeLineDiscount($rule, $item);
                    if (bccomp($discount, '0.00', 2) > 0) {
                        // Add to any existing discount (for stackable product rules)
                        $item['applied_discount_srd'] = bcadd($item['applied_discount_srd'], $discount, 2);
                        $appliedRules[] = $rule->name;
                    }
                }
            }

            return $item;
        });

        // 3. Cart-level rules — apply to the cart subtotal
        $cartDiscountSrd = '0.00';
        $subtotal = $processedItems->reduce(function (string $carry, array $item) {
            $net = bcsub(
                bcmul((string) $item['unit_price'], (string) $item['quantity'], 4),
                (string) $item['applied_discount_srd'],
                4
            );
            return bcadd($carry, $net, 4);
        }, '0.0000');

        foreach ($cartRules as $cartRule) {
            $discount = $this->computeCartDiscount($cartRule, $subtotal);
            if (bccomp($discount, '0.00', 2) > 0) {
                $cartDiscountSrd = bcadd($cartDiscountSrd, $discount, 2);
                $appliedRules[]  = $cartRule->name;
                if (! $cartRule->stackable) {
                    break;
                }
            }
        }

        return [
            'items'             => $processedItems->toArray(),
            'cart_discount_srd' => $cartDiscountSrd,
            'applied_rules'     => array_unique($appliedRules),
        ];
    }

    // ─── Private helpers ─────────────────────────────────────────────────

    private function computeLineDiscount(DiscountRule $rule, array $item): string
    {
        $lineGross = bcmul((string) $item['unit_price'], (string) $item['quantity'], 4);

        return match ($rule->type) {
            'pct_discount' => $this->applyPct($lineGross, $rule->value, $rule->max_discount_srd),

            'fixed_discount' => $this->clamp(
                bcmul((string) $rule->value, (string) $item['quantity'], 4),
                $lineGross
            ),

            'buy_x_get_y' => $this->computeBuyXGetY($rule, $item),

            default => '0.00',
        };
    }

    private function computeCartDiscount(DiscountRule $rule, string $subtotal): string
    {
        return match ($rule->type) {
            'pct_discount'   => $this->applyPct($subtotal, $rule->value, $rule->max_discount_srd),
            'fixed_discount' => $this->clamp((string) $rule->value, $subtotal),
            default          => '0.00',
        };
    }

    private function applyPct(string $amount, float $pct, ?float $max): string
    {
        $discount = bcmul($amount, bcdiv((string) $pct, '100', 6), 4);
        if ($max !== null) {
            $discount = (bccomp($discount, (string) $max, 4) > 0)
                ? (string) $max
                : $discount;
        }
        return bcmul($discount, '1', 2); // round to 2 decimals
    }

    private function clamp(string $discount, string $max): string
    {
        return (bccomp($discount, $max, 4) > 0) ? $max : bcmul($discount, '1', 2);
    }

    /**
     * Buy X get Y free — for every (min_qty) units, give (value) units free.
     * E.g. min_qty=3, value=1 → buy 3 get 1 free → 4 items, pay 3.
     */
    private function computeBuyXGetY(DiscountRule $rule, array $item): string
    {
        $qty       = (float) $item['quantity'];
        $minQty    = $rule->min_qty;
        $freePerSet= $rule->value;
        $setSize   = $minQty + $freePerSet;

        $sets     = (int) floor($qty / $setSize);
        $freeQty  = $sets * $freePerSet;

        if ($freeQty <= 0) {
            return '0.00';
        }

        return bcmul((string) $item['unit_price'], (string) $freeQty, 2);
    }
}
