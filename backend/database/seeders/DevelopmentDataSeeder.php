<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DevelopmentDataSeeder extends Seeder
{
    public function run(): void
    {
        // ── Organisation ─────────────────────────────────────────────────────
        $org = Organisation::firstOrCreate(
            ['name' => 'Supermarkt De Hoop'],
            [
                'type'              => 'retail',
                'btw_number'        => 'BTW-SR-123456',
                'currency'          => 'SRD',
                'locale'            => 'nl',
                'is_government'     => false,
                'subscription_tier' => 'standard',
            ]
        );

        // ── Store ─────────────────────────────────────────────────────────────
        $store = Store::firstOrCreate(
            ['name' => 'De Hoop — Paramaribo', 'organisation_id' => $org->id],
            [
                'address'          => 'Domineestraat 34',
                'city'             => 'Paramaribo',
                'default_btw_rate' => 10.00,
                'receipt_header'   => "Supermarkt De Hoop\nDomineestraat 34, Paramaribo\nTel: +597 123 456\nBTW: BTW-SR-123456",
                'receipt_footer'   => "Bedankt voor uw bezoek!\nBewaar uw bon voor retourzending.",
                'is_active'        => true,
                'pos_type'         => 'native',
            ]
        );

        // ── Users ─────────────────────────────────────────────────────────────
        $manager = User::firstOrCreate(
            ['email' => 'manager@dehoop.sr'],
            [
                'name'            => 'Rashied Alibaks',
                'password'        => Hash::make('Manager@2026'),
                'organisation_id' => $org->id,
                'role'            => User::ROLE_STORE_MANAGER,
                'locale'          => 'nl',
                'is_active'       => true,
            ]
        );
        $manager->assignRole(User::ROLE_STORE_MANAGER);

        $cashier = User::firstOrCreate(
            ['email' => 'kassa@dehoop.sr'],
            [
                'name'            => 'Sharmila Jankipersad',
                'password'        => Hash::make('Cashier@2026'),
                'organisation_id' => $org->id,
                'role'            => User::ROLE_CASHIER,
                'locale'          => 'nl',
                'is_active'       => true,
            ]
        );
        $cashier->assignRole(User::ROLE_CASHIER);

        // ── Categories ────────────────────────────────────────────────────────
        $categories = [
            ['name_nl' => 'Droog',       'name_en' => 'Dry Goods',    'icon' => '🛒', 'sort_order' => 1],
            ['name_nl' => 'Dranken',     'name_en' => 'Beverages',    'icon' => '🥤', 'sort_order' => 2],
            ['name_nl' => 'Vlees',       'name_en' => 'Meat',         'icon' => '🥩', 'sort_order' => 3],
            ['name_nl' => 'Vis',         'name_en' => 'Fish',         'icon' => '🐟', 'sort_order' => 4],
            ['name_nl' => 'Groenten',    'name_en' => 'Vegetables',   'icon' => '🥦', 'sort_order' => 5],
            ['name_nl' => 'Zuivel',      'name_en' => 'Dairy',        'icon' => '🥛', 'sort_order' => 6],
            ['name_nl' => 'Snacks',      'name_en' => 'Snacks',       'icon' => '🍪', 'sort_order' => 7],
            ['name_nl' => 'Huishoud',    'name_en' => 'Household',    'icon' => '🧴', 'sort_order' => 8],
            ['name_nl' => 'Brood',       'name_en' => 'Bread',        'icon' => '🍞', 'sort_order' => 9],
            ['name_nl' => 'Diepvries',   'name_en' => 'Frozen',       'icon' => '🧊', 'sort_order' => 10],
        ];

        $catModels = [];
        foreach ($categories as $cat) {
            $catModels[$cat['name_nl']] = Category::firstOrCreate(
                ['organisation_id' => $org->id, 'name_nl' => $cat['name_nl']],
                array_merge($cat, ['organisation_id' => $org->id, 'is_active' => true])
            );
        }

        // ── Products (50 Surinamese supermarket products) ─────────────────────
        $products = [
            // Droog — 10% BTW
            ['name_nl' => 'Rijst (5 kg)',          'name_en' => 'Rice (5 kg)',           'cat' => 'Droog',    'price' => 38.50, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400072002'],
            ['name_nl' => 'Spaghetti (500 g)',      'name_en' => 'Spaghetti (500 g)',     'cat' => 'Droog',    'price' => 8.75,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8000300310427'],
            ['name_nl' => 'Bloem (1 kg)',           'name_en' => 'Flour (1 kg)',          'cat' => 'Droog',    'price' => 6.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8714400016208'],
            ['name_nl' => 'Suiker (1 kg)',          'name_en' => 'Sugar (1 kg)',          'cat' => 'Droog',    'price' => 5.25,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8719326012014'],
            ['name_nl' => 'Zonnebloemolie (1 L)',   'name_en' => 'Sunflower Oil (1 L)',   'cat' => 'Droog',    'price' => 12.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8720181014107'],
            ['name_nl' => 'Tomatenpuree (140 g)',   'name_en' => 'Tomato Paste (140 g)', 'cat' => 'Droog',    'price' => 3.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8712566034987'],

            // Dranken — 10% BTW
            ['name_nl' => 'Coca-Cola (1.5 L)',      'name_en' => 'Coca-Cola (1.5 L)',     'cat' => 'Dranken',  'price' => 7.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '5449000000996'],
            ['name_nl' => 'Parbo Bier (330 ml)',    'name_en' => 'Parbo Beer (330 ml)',   'cat' => 'Dranken',  'price' => 4.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8714400033205'],
            ['name_nl' => 'Sinaasappelsap (1 L)',   'name_en' => 'Orange Juice (1 L)',    'cat' => 'Dranken',  'price' => 9.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8714400054026'],
            ['name_nl' => 'Water (1.5 L)',          'name_en' => 'Water (1.5 L)',         'cat' => 'Dranken',  'price' => 2.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8714777055032'],
            ['name_nl' => 'Energie Drank (250 ml)', 'name_en' => 'Energy Drink (250 ml)','cat' => 'Dranken',  'price' => 6.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '9002490100070'],

            // Vlees — 0% BTW (basic food)
            ['name_nl' => 'Kipfilet (1 kg)',        'name_en' => 'Chicken Breast (1 kg)','cat' => 'Vlees',    'price' => 32.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8712566098004'],
            ['name_nl' => 'Rundergehakt (500 g)',   'name_en' => 'Minced Beef (500 g)',  'cat' => 'Vlees',    'price' => 28.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8712566011009'],
            ['name_nl' => 'Varkensribben (1 kg)',   'name_en' => 'Pork Ribs (1 kg)',     'cat' => 'Vlees',    'price' => 35.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8712566022006'],

            // Vis — 0% BTW
            ['name_nl' => 'Snapper (1 kg)',         'name_en' => 'Red Snapper (1 kg)',   'cat' => 'Vis',      'price' => 45.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8712566045001'],
            ['name_nl' => 'Garnalen (500 g)',        'name_en' => 'Shrimp (500 g)',       'cat' => 'Vis',      'price' => 38.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8712566046001'],

            // Groenten — 0% BTW
            ['name_nl' => 'Tomaten (500 g)',         'name_en' => 'Tomatoes (500 g)',     'cat' => 'Groenten', 'price' => 5.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000001'],
            ['name_nl' => 'Komkommer',              'name_en' => 'Cucumber',             'cat' => 'Groenten', 'price' => 3.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000002'],
            ['name_nl' => 'Uien (1 kg)',            'name_en' => 'Onions (1 kg)',        'cat' => 'Groenten', 'price' => 6.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000003'],
            ['name_nl' => 'Aardappelen (2 kg)',     'name_en' => 'Potatoes (2 kg)',      'cat' => 'Groenten', 'price' => 10.50, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000004'],
            ['name_nl' => 'Madame Jeanette (250 g)','name_en' => 'Madame Jeanette (250 g)','cat' => 'Groenten','price' => 4.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000005'],

            // Zuivel — 0% BTW (basic foods)
            ['name_nl' => 'Melk Volvette (1 L)',    'name_en' => 'Full Fat Milk (1 L)',  'cat' => 'Zuivel',   'price' => 7.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8719326008901'],
            ['name_nl' => 'Eieren (10 stuks)',      'name_en' => 'Eggs (10 pcs)',        'cat' => 'Zuivel',   'price' => 9.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000010'],
            ['name_nl' => 'Boter (250 g)',          'name_en' => 'Butter (250 g)',       'cat' => 'Zuivel',   'price' => 11.00, 'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8714400033786'],
            ['name_nl' => 'Kaas Gouda (250 g)',     'name_en' => 'Gouda Cheese (250 g)','cat' => 'Zuivel',   'price' => 18.00, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8719326009007'],
            ['name_nl' => 'Yoghurt Naturel (500 g)','name_en' => 'Natural Yogurt (500 g)','cat' => 'Zuivel', 'price' => 8.50,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '8714400010008'],

            // Snacks — 10% BTW
            ['name_nl' => 'Doritos (150 g)',        'name_en' => 'Doritos (150 g)',      'cat' => 'Snacks',   'price' => 6.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '7613034954435'],
            ['name_nl' => 'Pinda\'s (250 g)',       'name_en' => 'Peanuts (250 g)',      'cat' => 'Snacks',   'price' => 5.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400073009'],
            ['name_nl' => 'Chocolade Reep (100 g)', 'name_en' => 'Chocolate Bar (100 g)','cat' => 'Snacks',  'price' => 7.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '7622210101129'],
            ['name_nl' => 'Koekjes (200 g)',        'name_en' => 'Biscuits (200 g)',     'cat' => 'Snacks',   'price' => 5.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400024007'],

            // Huishoud — 10% BTW
            ['name_nl' => 'Afwasmiddel (500 ml)',   'name_en' => 'Dish Soap (500 ml)',   'cat' => 'Huishoud', 'price' => 8.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8718951026070'],
            ['name_nl' => 'Toiletpapier (4 rollen)','name_en' => 'Toilet Paper (4 rolls)','cat' => 'Huishoud','price' => 9.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400073207'],
            ['name_nl' => 'Wasmiddel (1 kg)',       'name_en' => 'Laundry Powder (1 kg)','cat' => 'Huishoud','price' => 15.00, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8718114540041'],
            ['name_nl' => 'Shampoo (250 ml)',       'name_en' => 'Shampoo (250 ml)',     'cat' => 'Huishoud', 'price' => 12.00, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8714100120576'],
            ['name_nl' => 'Tandpasta (75 ml)',      'name_en' => 'Toothpaste (75 ml)',   'cat' => 'Huishoud', 'price' => 6.00,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8718951156500'],

            // Brood — 0% BTW
            ['name_nl' => 'Wittebrood (400 g)',     'name_en' => 'White Bread (400 g)',  'cat' => 'Brood',    'price' => 5.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000020'],
            ['name_nl' => 'Volkoren Brood (400 g)', 'name_en' => 'Whole Wheat Bread (400 g)','cat' => 'Brood','price' => 6.00,  'btw_rate' => 0,  'btw_exempt' => true,  'barcode' => '2000001000021'],
            ['name_nl' => 'Crackers (200 g)',       'name_en' => 'Crackers (200 g)',     'cat' => 'Brood',    'price' => 5.50,  'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400013011'],

            // Diepvries — 10% BTW
            ['name_nl' => 'Friet (1 kg)',           'name_en' => 'French Fries (1 kg)', 'cat' => 'Diepvries','price' => 14.00, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '8710400048506'],
            ['name_nl' => 'Kipnuggets (500 g)',     'name_en' => 'Chicken Nuggets (500 g)','cat' => 'Diepvries','price' => 22.00,'btw_rate' => 10,'btw_exempt' => false, 'barcode' => '8712566077009'],
            ['name_nl' => 'Pizza Margherita',       'name_en' => 'Margherita Pizza',    'cat' => 'Diepvries','price' => 18.50, 'btw_rate' => 10, 'btw_exempt' => false, 'barcode' => '4008400231396'],
        ];

        foreach ($products as $p) {
            Product::firstOrCreate(
                ['organisation_id' => $org->id, 'barcode' => $p['barcode']],
                [
                    'organisation_id' => $org->id,
                    'category_id'     => $catModels[$p['cat']]->id,
                    'name_nl'         => $p['name_nl'],
                    'name_en'         => $p['name_en'],
                    'barcode'         => $p['barcode'],
                    'price'           => $p['price'],
                    'btw_rate'        => $p['btw_rate'],
                    'btw_exempt'      => $p['btw_exempt'],
                    'stock_qty'       => rand(10, 200),
                    'is_active'       => true,
                ]
            );
        }

        // ── Walk-in customer ──────────────────────────────────────────────────
        Customer::firstOrCreate(
            ['organisation_id' => $org->id, 'name_hash' => hash_hmac('sha256', 'loopklant', config('app.key'))],
            [
                'organisation_id' => $org->id,
                'name'            => 'Loopklant',
                'is_active'       => true,
            ]
        );
    }
}
