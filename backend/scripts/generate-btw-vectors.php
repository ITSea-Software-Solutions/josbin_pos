<?php

/**
 * Fill the `expected` blocks of tests/Fixtures/btw_vectors.json from the
 * bcmath engine (BtwCalculationService) — the shipped money authority.
 *
 * Run inside the app container (plain PHP, no Laravel boot needed):
 *   php scripts/generate-btw-vectors.php
 *
 * Regenerating is a DELIBERATE contract change: diff the file and re-check
 * canonical cases by hand against the Belastingdienst rules before committing.
 *
 * Wire semantics mirrored here (must match the POS exactly):
 *  - item discount_pct converts to SRD as round2(line_gross * pct / 100)
 *    before entering the engine (the POS sends the SRD amount on the wire);
 *  - a sale-level exemption strips unit prices FIRST, and item pct discounts
 *    then convert against the stripped gross;
 *  - sale_discount_pct stays a percentage (the engine applies it itself).
 */

require __DIR__ . '/../vendor/autoload.php';

use App\Services\BtwCalculationService;

$path = __DIR__ . '/../tests/Fixtures/btw_vectors.json';
$doc  = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
$svc  = new BtwCalculationService();

foreach ($doc['vectors'] as &$vector) {
    $items = array_map(static fn (array $i): array => [
        'unit_price' => $i['unit_price'],
        'quantity'   => $i['quantity'],
        'btw_rate'   => $i['btw_rate'],
        'btw_exempt' => $i['btw_exempt'],
    ], $vector['items']);

    if ($vector['sale_btw_exempt'] ?? false) {
        $items = $svc->stripBtwForExemptSale($items);
    }

    // Convert per-line pct discounts to the SRD amount the POS would send.
    $wireDiscounts = [];
    foreach ($vector['items'] as $idx => $raw) {
        $srd = $raw['discount_srd'] ?? '0.00';
        if (isset($raw['discount_pct'])) {
            $gross = bcmul($items[$idx]['unit_price'], $items[$idx]['quantity'], 4);
            $srd   = $svc->pctToSrd($gross, $raw['discount_pct']);
        }
        $items[$idx]['discount_srd'] = $srd;
        $wireDiscounts[]             = $srd;
    }

    $cart = $svc->calculateCart(
        $items,
        $vector['sale_discount_srd'] ?? '0.00',
        $vector['sale_discount_pct'] ?? '0.00',
    );

    $vector['expected'] = [
        'subtotal'      => $cart['subtotal'],
        'sale_discount' => $cart['sale_discount'],
        'btw_total'     => $cart['btw_total'],
        'total'         => $cart['total'],
        'lines'         => array_map(static fn (array $line, string $wire): array => [
            'discount_srd_wire' => $wire,
            'btw_amount'        => $line['btw_amount'],
            'line_total'        => $line['line_total'],
        ], $cart['items'], $wireDiscounts),
    ];
}
unset($vector);

file_put_contents(
    $path,
    json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
);

echo 'Wrote expected blocks for ' . count($doc['vectors']) . " vectors.\n";
