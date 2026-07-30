<?php

namespace Tests\Unit;

use App\Services\BtwCalculationService;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Cross-vector contract test — the backend half.
 *
 * tests/Fixtures/btw_vectors.json is the ONE set of BTW cases both engines
 * must reproduce figure-for-figure; the frontend half is
 * frontend/src/store/__tests__/btwCrossVectors.test.ts. Expected values were
 * generated from this very engine (scripts/generate-btw-vectors.php) and then
 * frozen — so this test pins the engine against silent drift, and the vitest
 * side pins the cart against the engine.
 */
class BtwCrossVectorTest extends TestCase
{
    private static ?array $doc = null;

    private static function doc(): array
    {
        return self::$doc ??= json_decode(
            file_get_contents(__DIR__ . '/../Fixtures/btw_vectors.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }

    public static function vectorProvider(): array
    {
        $cases = [];
        foreach (self::doc()['vectors'] as $vector) {
            $cases[$vector['id'] . ' — ' . $vector['title']] = [$vector];
        }

        return $cases;
    }

    #[DataProvider('vectorProvider')]
    public function test_vector_matches_frozen_expected(array $vector): void
    {
        $svc = new BtwCalculationService();

        $items = array_map(static fn (array $i): array => [
            'unit_price' => $i['unit_price'],
            'quantity'   => $i['quantity'],
            'btw_rate'   => $i['btw_rate'],
            'btw_exempt' => $i['btw_exempt'],
        ], $vector['items']);

        if ($vector['sale_btw_exempt'] ?? false) {
            $items = $svc->stripBtwForExemptSale($items);
        }

        // Same wire semantics the POS uses: pct discounts become SRD amounts
        // (round2 of gross * pct / 100) before the engine sees them.
        foreach ($vector['items'] as $idx => $raw) {
            $srd = $raw['discount_srd'] ?? '0.00';
            if (isset($raw['discount_pct'])) {
                $gross = bcmul($items[$idx]['unit_price'], $items[$idx]['quantity'], 4);
                $srd   = $svc->pctToSrd($gross, $raw['discount_pct']);
            }
            $items[$idx]['discount_srd'] = $srd;

            $this->assertSame(
                $vector['expected']['lines'][$idx]['discount_srd_wire'],
                $srd,
                "{$vector['id']} line {$idx}: wire discount"
            );
        }

        $cart = $svc->calculateCart(
            $items,
            $vector['sale_discount_srd'] ?? '0.00',
            $vector['sale_discount_pct'] ?? '0.00',
        );

        $expected = $vector['expected'];
        $this->assertSame($expected['subtotal'], $cart['subtotal'], "{$vector['id']}: subtotal");
        $this->assertSame($expected['sale_discount'], $cart['sale_discount'], "{$vector['id']}: sale_discount");
        $this->assertSame($expected['btw_total'], $cart['btw_total'], "{$vector['id']}: btw_total");
        $this->assertSame($expected['total'], $cart['total'], "{$vector['id']}: total");

        foreach ($expected['lines'] as $idx => $line) {
            $this->assertSame($line['btw_amount'], $cart['items'][$idx]['btw_amount'], "{$vector['id']} line {$idx}: btw_amount");
            $this->assertSame($line['line_total'], $cart['items'][$idx]['line_total'], "{$vector['id']} line {$idx}: line_total");
        }
    }
}
