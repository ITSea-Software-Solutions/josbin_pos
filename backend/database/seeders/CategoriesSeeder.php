<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Organisation;
use Illuminate\Database\Seeder;

/**
 * CategoriesSeeder — common Suriname retail categories.
 *
 * Idempotent: existing categories (matched by organisation + name_nl) are
 * left alone. Only missing ones are inserted. Stores can still add/edit
 * categories via Dashboard → Catalogue → Categories tab; this seeder only
 * sets a sensible starter set so new orgs aren't staring at an empty grid.
 *
 * Runs against every organisation. Wired into DatabaseSeeder.
 */
class CategoriesSeeder extends Seeder
{
    public function run(): void
    {
        $categories = self::defaults();

        foreach (Organisation::all() as $org) {
            foreach ($categories as $i => $cat) {
                Category::firstOrCreate(
                    [
                        'organisation_id' => $org->id,
                        'name_nl'         => $cat['name_nl'],
                    ],
                    [
                        'name_en'    => $cat['name_en'],
                        'icon'       => $cat['icon'],
                        'color'      => $cat['color'] ?? null,
                        'sort_order' => $i + 1,
                        'is_active'  => true,
                    ],
                );
            }
        }
    }

    /**
     * Common Suriname supermarket / convenience store categories.
     * Order roughly mirrors how products are arranged on shelves.
     */
    public static function defaults(): array
    {
        return [
            // Food — fresh
            ['name_nl' => 'Brood',         'name_en' => 'Bread',           'icon' => '🍞', 'color' => '#D4A574'],
            ['name_nl' => 'Bakkerij',      'name_en' => 'Bakery',          'icon' => '🧁', 'color' => '#E8B894'],
            ['name_nl' => 'Zuivel',        'name_en' => 'Dairy',           'icon' => '🥛', 'color' => '#F5F5DC'],
            ['name_nl' => 'Vlees',         'name_en' => 'Meat',            'icon' => '🥩', 'color' => '#C44569'],
            ['name_nl' => 'Vis',           'name_en' => 'Fish',            'icon' => '🐟', 'color' => '#6BCBEF'],
            ['name_nl' => 'Kip',           'name_en' => 'Poultry',         'icon' => '🍗', 'color' => '#E67E22'],
            ['name_nl' => 'Groenten',      'name_en' => 'Vegetables',      'icon' => '🥦', 'color' => '#27AE60'],
            ['name_nl' => 'Fruit',         'name_en' => 'Fruit',           'icon' => '🍎', 'color' => '#E74C3C'],
            ['name_nl' => 'Diepvries',     'name_en' => 'Frozen',          'icon' => '🧊', 'color' => '#3498DB'],

            // Food — pantry / dry
            ['name_nl' => 'Droog',         'name_en' => 'Dry Goods',       'icon' => '🛒', 'color' => '#95A5A6'],
            ['name_nl' => 'Rijst & Pasta', 'name_en' => 'Rice & Pasta',    'icon' => '🍚', 'color' => '#F4D03F'],
            ['name_nl' => 'Granen',        'name_en' => 'Cereals',         'icon' => '🌾', 'color' => '#D4AC0D'],
            ['name_nl' => 'Sauzen',        'name_en' => 'Sauces',          'icon' => '🥫', 'color' => '#C0392B'],
            ['name_nl' => 'Kruiden',       'name_en' => 'Herbs & Spices',  'icon' => '🧂', 'color' => '#8E44AD'],
            ['name_nl' => 'Conserven',     'name_en' => 'Canned Goods',    'icon' => '🥫', 'color' => '#7F8C8D'],

            // Beverages
            ['name_nl' => 'Dranken',       'name_en' => 'Beverages',       'icon' => '🥤', 'color' => '#3498DB'],
            ['name_nl' => 'Frisdrank',     'name_en' => 'Soft Drinks',     'icon' => '🥤', 'color' => '#2980B9'],
            ['name_nl' => 'Sap',           'name_en' => 'Juice',           'icon' => '🧃', 'color' => '#F39C12'],
            ['name_nl' => 'Water',         'name_en' => 'Water',           'icon' => '💧', 'color' => '#85C1E9'],
            ['name_nl' => 'Koffie & Thee', 'name_en' => 'Coffee & Tea',    'icon' => '☕', 'color' => '#6E2C00'],
            ['name_nl' => 'Bier',          'name_en' => 'Beer',            'icon' => '🍺', 'color' => '#D68910'],
            ['name_nl' => 'Wijn & Sterk',  'name_en' => 'Wine & Spirits',  'icon' => '🍷', 'color' => '#922B21'],

            // Snacks & treats
            ['name_nl' => 'Snacks',        'name_en' => 'Snacks',          'icon' => '🍪', 'color' => '#F4A261'],
            ['name_nl' => 'Snoep',         'name_en' => 'Candy',           'icon' => '🍬', 'color' => '#E91E63'],
            ['name_nl' => 'Chips',         'name_en' => 'Chips',           'icon' => '🥨', 'color' => '#FF9F43'],
            ['name_nl' => 'IJs',           'name_en' => 'Ice Cream',       'icon' => '🍦', 'color' => '#A1C4FD'],

            // Tobacco (regulated — separate so age check / BTW handled)
            ['name_nl' => 'Tabak',         'name_en' => 'Tobacco',         'icon' => '🚬', 'color' => '#4A4A4A'],

            // Household
            ['name_nl' => 'Huishoud',      'name_en' => 'Household',       'icon' => '🧴', 'color' => '#1ABC9C'],
            ['name_nl' => 'Schoonmaak',    'name_en' => 'Cleaning',        'icon' => '🧽', 'color' => '#16A085'],
            ['name_nl' => 'Wasmiddel',     'name_en' => 'Laundry',         'icon' => '🧺', 'color' => '#48C9B0'],
            ['name_nl' => 'Papierwaren',   'name_en' => 'Paper Goods',     'icon' => '🧻', 'color' => '#BDC3C7'],

            // Personal care
            ['name_nl' => 'Hygiëne',       'name_en' => 'Hygiene',         'icon' => '🧼', 'color' => '#5DADE2'],
            ['name_nl' => 'Cosmetica',     'name_en' => 'Cosmetics',       'icon' => '💄', 'color' => '#EC7063'],
            ['name_nl' => 'Verzorging',    'name_en' => 'Personal Care',   'icon' => '🪥', 'color' => '#52BE80'],
            ['name_nl' => 'Gezondheid',    'name_en' => 'Health',          'icon' => '💊', 'color' => '#58D68D'],

            // Family
            ['name_nl' => 'Baby',          'name_en' => 'Baby',            'icon' => '🍼', 'color' => '#FAD7A0'],
            ['name_nl' => 'Huisdier',      'name_en' => 'Pet',             'icon' => '🐾', 'color' => '#A569BD'],

            // Misc
            ['name_nl' => 'School & Kantoor', 'name_en' => 'School & Office', 'icon' => '✏️', 'color' => '#F1948A'],
            ['name_nl' => 'Hardware',      'name_en' => 'Hardware',        'icon' => '🔧', 'color' => '#566573'],
            ['name_nl' => 'Elektronica',   'name_en' => 'Electronics',     'icon' => '🔌', 'color' => '#5499C7'],
            ['name_nl' => 'Cadeau',        'name_en' => 'Gift',            'icon' => '🎁', 'color' => '#E59866'],
            ['name_nl' => 'Overig',        'name_en' => 'Other',           'icon' => '📦', 'color' => '#85929E'],
        ];
    }
}
