#!/usr/bin/env php
<?php

/**
 * Josbin POS Load Test Seeder
 *
 * Creates the test accounts, store, and products required by pos_concurrent.js.
 * Run from the backend directory: php ../tests/load/seed_load_test.php
 *
 * WARNING: Only run against a staging/test environment. Never production.
 *
 * Outputs the environment variables needed by k6:
 *   k6 run \
 *     --env BASE_URL=http://localhost \
 *     --env STORE_ID=<uuid> \
 *     --env PRODUCT_IDS=<uuid1,uuid2,...> \
 *     tests/load/pos_concurrent.js
 */

require __DIR__ . '/../../backend/vendor/autoload.php';

$app = require_once __DIR__ . '/../../backend/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

echo "⚡ Josbin POS Load Test Seeder\n";
echo str_repeat('─', 50) . "\n";

// ── Organisation & Store ──────────────────────────────────────────────────────

$orgId = DB::table('organisations')->insertGetId([
    'id'              => Str::uuid(),
    'name'            => 'Load Test Organisation',
    'type'            => 'retail',
    'btw_number'      => 'LT-000000',
    'currency'        => 'SRD',
    'locale'          => 'nl',
    'is_government'   => false,
    'created_at'      => now(),
    'updated_at'      => now(),
]);

$storeUuid = (string) Str::uuid();
DB::table('stores')->insert([
    'id'              => $storeUuid,
    'organisation_id' => $orgId,
    'name'            => 'Load Test Store',
    'address'         => 'Paramaribo',
    'city'            => 'Paramaribo',
    'default_btw_rate'=> 10,
    'is_active'       => true,
    'created_at'      => now(),
    'updated_at'      => now(),
]);

echo "  ✓ Organisation & store created (store: {$storeUuid})\n";

// ── 20 Test Products ─────────────────────────────────────────────────────────

$productUuids = [];
$products = [
    ['Rijst 5kg',     12.50], ['Suiker 1kg',    4.50],  ['Olie 1L',      8.00],
    ['Bloem 1kg',      5.00], ['Boter 250g',    6.50],  ['Melk 1L',      9.00],
    ['Eieren 12st',    7.50], ['Brood',          4.00],  ['Cornflakes',  15.00],
    ['Cola 1.5L',      6.00], ['Water 1.5L',    2.50],  ['Bier 6-pack', 18.00],
    ['Shampoo',       12.00], ['Tandpasta',      8.50],  ['Zeep',         3.50],
    ['Batterijen AA',  9.00], ['Afwasmiddel',    7.00],  ['Chips 200g',   5.50],
    ['Koekjes 250g',   6.00], ['Chocolade',      8.00],
];

foreach ($products as [$name, $price]) {
    $uuid = (string) Str::uuid();
    DB::table('products')->insert([
        'id'              => $uuid,
        'organisation_id' => $orgId,
        'name_nl'         => $name,
        'name_en'         => $name,
        'barcode'         => 'LT' . random_int(1000000, 9999999),
        'price'           => $price,
        'btw_rate'        => 10,
        'btw_exempt'      => false,
        'stock_qty'       => 9999, // effectively unlimited for load test
        'is_active'       => true,
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);
    $productUuids[] = $uuid;
}

echo "  ✓ 20 products created\n";

// ── 10 Cashier Accounts ───────────────────────────────────────────────────────

for ($i = 1; $i <= 10; $i++) {
    $userUuid = (string) Str::uuid();
    DB::table('users')->insert([
        'id'              => $userUuid,
        'organisation_id' => $orgId,
        'name'            => "Load Test Cashier {$i}",
        'email'           => "loadtest_cashier_{$i}@josbin_pos.test",
        'password'        => Hash::make('LoadTest123!'),
        'role'            => 'cashier',
        'locale'          => 'nl',
        'is_active'       => true,
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    // Assign model_has_roles for spatie/permission
    $roleId = DB::table('roles')->where('name', 'cashier')->value('id');
    if ($roleId) {
        DB::table('model_has_roles')->insert([
            'role_id'    => $roleId,
            'model_type' => 'App\\Models\\User',
            'model_id'   => $userUuid,
        ]);
    }
}

echo "  ✓ 10 cashier accounts created\n";

// ── Daily rate (required for sales) ──────────────────────────────────────────

$rateExists = DB::table('daily_rates')->where('date', now()->toDateString())->exists();
if (! $rateExists) {
    DB::table('daily_rates')->insert([
        'date'        => now()->toDateString(),
        'usd_to_srd'  => 36.50,
        'raw_rate'    => 36.50,
        'markup_pct'  => 0,
        'source'      => 'manual',
        'created_at'  => now(),
        'updated_at'  => now(),
    ]);
    echo "  ✓ Daily rate seeded (USD/SRD = 36.50)\n";
}

echo "\n";
echo str_repeat('─', 50) . "\n";
echo "  Run the load test with:\n\n";
echo "  k6 run \\\n";
echo "    --env BASE_URL=http://localhost \\\n";
echo "    --env STORE_ID={$storeUuid} \\\n";
echo "    --env PRODUCT_IDS=" . implode(',', $productUuids) . " \\\n";
echo "    tests/load/pos_concurrent.js\n\n";
