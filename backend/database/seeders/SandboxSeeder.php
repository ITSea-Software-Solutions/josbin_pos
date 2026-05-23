<?php

namespace Database\Seeders;

use App\Models\ApiIntegration;
use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Database\Seeder;

/**
 * SandboxSeeder — seeds an isolated environment for third-party integrators
 * to test the Layer 3 Open Integration API (/v1/*) without touching
 * production data.
 *
 * Run on a SEPARATE sandbox deployment (its own database) with:
 *
 *     JOSBIN_POS_SANDBOX=true  php artisan db:seed --class=SandboxSeeder
 *
 * It creates a dedicated organisation, store, a catalogue of Surinamese
 * products and a fixed, publishable API key + webhook secret so the values
 * can be documented for integrators.
 *
 * NOT included in the default DatabaseSeeder — it must be invoked explicitly.
 */
class SandboxSeeder extends Seeder
{
    /** Fixed, publishable sandbox credentials — safe because the sandbox is isolated. */
    public const SANDBOX_API_KEY     = 'sk_sandbox_josbin_pos_demo_2026';
    public const SANDBOX_WEBHOOK_SECRET = 'whsec_sandbox_josbin_pos_demo_2026';

    public function run(): void
    {
        if (! config('josbin_pos.sandbox')) {
            $this->command?->warn(
                'JOSBIN_POS_SANDBOX is not set to true — refusing to seed sandbox data into a non-sandbox environment.'
            );
            $this->command?->warn('Set JOSBIN_POS_SANDBOX=true in this deployment\'s .env and retry.');

            return;
        }

        // ── Organisation ──────────────────────────────────────────────────────
        $org = Organisation::firstOrCreate(
            ['name' => 'Josbin POS Sandbox'],
            [
                'type'              => 'retail',
                'btw_number'        => 'BTW-SR-SANDBOX',
                'currency'          => 'SRD',
                'locale'            => 'nl',
                'is_government'     => false,
                'subscription_tier' => 'standard',
            ]
        );

        // ── Store ─────────────────────────────────────────────────────────────
        $store = Store::firstOrCreate(
            ['name' => 'Sandbox Store — Paramaribo', 'organisation_id' => $org->id],
            [
                'address'          => 'Sandbox Teststraat 1',
                'city'             => 'Paramaribo',
                'default_btw_rate' => 10.00,
                'receipt_header'   => "Josbin POS Sandbox\nTeststraat 1, Paramaribo",
                'receipt_footer'   => 'Sandbox — geen echte verkopen.',
                'is_active'        => true,
                'pos_type'         => 'external',
            ]
        );

        // ── Categories ────────────────────────────────────────────────────────
        $categoryDefs = [
            ['name_nl' => 'Droog',   'name_en' => 'Dry Goods',  'icon' => '🛒', 'sort_order' => 1],
            ['name_nl' => 'Dranken', 'name_en' => 'Beverages',  'icon' => '🥤', 'sort_order' => 2],
            ['name_nl' => 'Vlees',   'name_en' => 'Meat',       'icon' => '🥩', 'sort_order' => 3],
            ['name_nl' => 'Brood',   'name_en' => 'Bread',      'icon' => '🍞', 'sort_order' => 4],
        ];

        $categories = [];
        foreach ($categoryDefs as $def) {
            $categories[$def['name_nl']] = Category::firstOrCreate(
                ['organisation_id' => $org->id, 'name_nl' => $def['name_nl']],
                array_merge($def, ['organisation_id' => $org->id, 'is_active' => true]),
            );
        }

        // ── Products — Surinamese supermarket goods, mixed BTW rates ───────────
        $products = [
            ['name_nl' => 'Rijst (5 kg)',         'name_en' => 'Rice (5 kg)',          'cat' => 'Droog',   'price' => 38.50, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000011'],
            ['name_nl' => 'Bloem (1 kg)',         'name_en' => 'Flour (1 kg)',         'cat' => 'Droog',   'price' => 6.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000012'],
            ['name_nl' => 'Suiker (1 kg)',        'name_en' => 'Sugar (1 kg)',         'cat' => 'Droog',   'price' => 5.25,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000013'],
            ['name_nl' => 'Spaghetti (500 g)',    'name_en' => 'Spaghetti (500 g)',    'cat' => 'Droog',   'price' => 8.75,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000014'],
            ['name_nl' => 'Tomatenpuree (140 g)', 'name_en' => 'Tomato Paste (140 g)', 'cat' => 'Droog',   'price' => 3.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000015'],
            ['name_nl' => 'Coca-Cola (1.5 L)',    'name_en' => 'Coca-Cola (1.5 L)',    'cat' => 'Dranken', 'price' => 7.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000021'],
            ['name_nl' => 'Parbo Bier (330 ml)',  'name_en' => 'Parbo Beer (330 ml)',  'cat' => 'Dranken', 'price' => 4.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000022'],
            ['name_nl' => 'Water (1.5 L)',        'name_en' => 'Water (1.5 L)',        'cat' => 'Dranken', 'price' => 2.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000023'],
            ['name_nl' => 'Sinaasappelsap (1 L)', 'name_en' => 'Orange Juice (1 L)',   'cat' => 'Dranken', 'price' => 9.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000024'],
            ['name_nl' => 'Kipfilet (1 kg)',      'name_en' => 'Chicken Breast (1 kg)','cat' => 'Vlees',   'price' => 32.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000031'],
            ['name_nl' => 'Rundergehakt (500 g)', 'name_en' => 'Minced Beef (500 g)',  'cat' => 'Vlees',   'price' => 28.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000032'],
            ['name_nl' => 'Wittebrood (400 g)',   'name_en' => 'White Bread (400 g)',  'cat' => 'Brood',   'price' => 5.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000041'],
            ['name_nl' => 'Volkoren Brood',       'name_en' => 'Whole Wheat Bread',    'cat' => 'Brood',   'price' => 6.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '9990000000042'],
            ['name_nl' => 'Crackers (200 g)',     'name_en' => 'Crackers (200 g)',     'cat' => 'Brood',   'price' => 5.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9990000000043'],
        ];

        foreach ($products as $p) {
            Product::firstOrCreate(
                ['organisation_id' => $org->id, 'barcode' => $p['barcode']],
                [
                    'organisation_id' => $org->id,
                    'category_id'     => $categories[$p['cat']]->id,
                    'name_nl'         => $p['name_nl'],
                    'name_en'         => $p['name_en'],
                    'barcode'         => $p['barcode'],
                    'price'           => $p['price'],
                    'btw_rate'        => $p['btw_rate'],
                    'btw_exempt'      => $p['btw_exempt'],
                    'stock_qty'       => 500,
                    'is_active'       => true,
                ]
            );
        }

        // ── API integration — fixed, publishable sandbox key ──────────────────
        ApiIntegration::updateOrCreate(
            ['api_key_hash' => hash('sha256', self::SANDBOX_API_KEY)],
            [
                'store_id'       => $store->id,
                'pos_system'     => 'Sandbox Test Integration',
                'webhook_url'    => null,
                'webhook_events' => ['sale.created', 'shift.closed', 'refund.issued'],
                'webhook_secret' => self::SANDBOX_WEBHOOK_SECRET,
                'is_active'      => true,
            ]
        );

        $this->command?->info('Sandbox environment seeded.');
        $this->command?->info('  Store ID         : '.$store->id);
        $this->command?->info('  API key          : '.self::SANDBOX_API_KEY);
        $this->command?->info('  Webhook secret   : '.self::SANDBOX_WEBHOOK_SECRET);
        $this->command?->info('  Products seeded  : '.count($products));
        $this->command?->info('Send the API key as the  X-API-Key  header to the /v1/* endpoints.');
    }
}
