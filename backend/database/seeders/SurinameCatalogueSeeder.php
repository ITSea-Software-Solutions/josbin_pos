<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * The catalogue a Surinamese shop actually sells.
 *
 * The old demo list was generic supermarket filler — "Chocolate Bar", "Energy
 * Drink", "RAM DDR5" — which demos badly here: a shopkeeper in Paramaribo
 * scanning the grid sees nothing they recognise and concludes the system was
 * built for somewhere else. These are real lines from real shops: Parbo and
 * Djogo, Fernandes syrup, A1 rice from Nickerie, bakkeljauw, pom, roti, bara,
 * Madame Jeanette, cassave, tayerblad.
 *
 * Prices are July 2026 SRD, in the range a Paramaribo shop actually charges.
 * They are demo figures, not a price list — a real store imports its own.
 *
 * ── On images ────────────────────────────────────────────────────────────
 * `image_url` is left null here on purpose, and the till falls back to the
 * drawn category glyph.
 *
 * Photographs of branded Surinamese goods — Parbo, Fernandes, Djogo — are not
 * available under any licence we can pass on to a client. Wikimedia Commons
 * has a Parbo Bier category, but it holds historical brewery interiors, not
 * product shots. Taking them from the brands' own sites would put trademarked
 * packaging into a demo that travels to supermarkets and ministries, and the
 * exposure would land on the client, not on us.
 *
 * Two routes that DO work, both already supported:
 *   1. The shop photographs its own shelf. Product form → image upload, or
 *      the bulk CSV/XLSX import with an image column. Genuinely theirs.
 *   2. Ask the distributor. Suriname importers hand out official product
 *      renders for exactly this purpose, and that comes with permission.
 *
 * Until one of those happens, the glyphs read correctly — the categories below
 * are named so that ProductGlyph's matcher resolves each line to the right
 * drawing (bier→beer mug, vis→fish, groente→produce, rijst→grain sack).
 */
class SurinameCatalogueSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Organisation::all() as $org) {
            $categories = Category::where('organisation_id', $org->id)
                ->get()
                ->keyBy(fn ($c) => mb_strtolower($c->name_nl));

            // An organisation with none of the retail categories is not a shop
            // — the vendor's own org, a ministry, a tenant mid-setup. Skip it
            // rather than pushing a supermarket catalogue into it.
            //
            // The distinction matters, and the first run got it wrong: the
            // guard below is meant to catch a MISSPELLED category, which is a
            // bug in this file. A tenant that simply is not a supermarket is
            // not a bug, and failing the whole seed on one was the actual
            // error. Some-but-not-all still throws.
            $needed = collect($this->lines())->pluck('category')
                ->map(fn ($c) => mb_strtolower($c))->unique();
            if ($needed->intersect($categories->keys())->isEmpty()) {
                $this->command?->info("  skipped {$org->name} — no retail categories, not a shop");
                continue;
            }

            foreach ($this->lines() as $line) {
                $cat = $categories[mb_strtolower($line['category'])] ?? null;
                if (! $cat) {
                    // Loud on purpose. A null category_id here is invisible
                    // afterwards: the product just quietly gets the fallback
                    // glyph and appears under no category filter, and nobody
                    // finds out until a shopkeeper cannot find their rice.
                    // Reached only when the org HAS retail categories but not
                    // this one — i.e. the name in lines() is wrong.
                    throw new \RuntimeException(
                        "SurinameCatalogueSeeder: organisation '{$org->name}' has retail categories "
                        . "but not '{$line['category']}' — the name in lines() is wrong. "
                        . 'Available: ' . $categories->keys()->implode(', ')
                    );
                }

                Product::updateOrCreate(
                    ['organisation_id' => $org->id, 'barcode' => $line['barcode']],
                    [
                        'category_id' => $cat->id,
                        'name_nl'     => $line['nl'],
                        'name_en'     => $line['en'],
                        'price'       => $line['price'],
                        'cost_price'  => round($line['price'] * 0.72, 2),
                        'btw_rate'    => $line['exempt'] ? '0.00' : '10.00',
                        'btw_exempt'  => $line['exempt'],
                        // products.unit carries a CHECK constraint (each|kg|g|l|ml|pak), so the
                        // Dutch words a shopkeeper would say — stuk, zak — are not valid
                        // here. 'each' is the neutral default the schema expects; the
                        // human-readable size already lives in the product name.
                        'unit'        => $line['unit'] ?? 'each',
                        'is_active'   => true,
                    ]
                );
            }
        }
    }

    /**
     * @return list<array{barcode:string,nl:string,en:string,category:string,price:float,exempt:bool,unit?:string}>
     */
    private function lines(): array
    {
        // BTW-exempt marks basic foodstuffs — the Belastingdienst exemption
        // covers staples, so rice, bread, flour, sugar, fresh fish, fresh
        // vegetables and cooking oil carry 0% while beer, soft drinks,
        // cigarettes and household goods carry the standard 10%.
        return [
            // ── Bier & sterke drank ─────────────────────────────────────────
            ['barcode' => '8712000000011', 'nl' => 'Parbo Bier 1 L (djogo)',      'en' => 'Parbo Beer 1 L (djogo)',       'category' => 'Bier',      'price' => 32.50, 'exempt' => false],
            ['barcode' => '8712000000028', 'nl' => 'Parbo Bier 33 cl',            'en' => 'Parbo Beer 33 cl',             'category' => 'Bier',      'price' => 14.00, 'exempt' => false],
            ['barcode' => '8712000000035', 'nl' => 'Parbo Chiller 33 cl',         'en' => 'Parbo Chiller 33 cl',          'category' => 'Bier',      'price' => 15.00, 'exempt' => false],
            ['barcode' => '8712000000042', 'nl' => 'Borgoe 5 Jaar rum 75 cl',     'en' => 'Borgoe 5 Year rum 75 cl',      'category' => 'Bier',      'price' => 185.00, 'exempt' => false],
            ['barcode' => '8712000000059', 'nl' => 'Mariënburg rum 90% 75 cl',    'en' => 'Marienburg rum 90% 75 cl',     'category' => 'Bier',      'price' => 210.00, 'exempt' => false],

            // ── Frisdrank & sap ─────────────────────────────────────────────
            ['barcode' => '8712000000110', 'nl' => 'Fernandes Rood 1,5 L',        'en' => 'Fernandes Red 1.5 L',          'category' => 'Dranken',   'price' => 22.00, 'exempt' => false],
            ['barcode' => '8712000000127', 'nl' => 'Fernandes Groen 1,5 L',       'en' => 'Fernandes Green 1.5 L',        'category' => 'Dranken',   'price' => 22.00, 'exempt' => false],
            ['barcode' => '8712000000134', 'nl' => 'Fernandes Ananas 1,5 L',      'en' => 'Fernandes Pineapple 1.5 L',    'category' => 'Dranken',   'price' => 22.00, 'exempt' => false],
            ['barcode' => '8712000000141', 'nl' => 'Fernandes siroop Rood 1 L',   'en' => 'Fernandes syrup Red 1 L',      'category' => 'Dranken',   'price' => 28.50, 'exempt' => false],
            ['barcode' => '8712000000158', 'nl' => 'Sisi Orange 1,5 L',           'en' => 'Sisi Orange 1.5 L',            'category' => 'Dranken',   'price' => 21.00, 'exempt' => false],
            ['barcode' => '8712000000165', 'nl' => 'Sorbet markusa 1 L',          'en' => 'Passion-fruit sorbet 1 L',     'category' => 'Dranken',   'price' => 26.00, 'exempt' => false],
            ['barcode' => '8712000000172', 'nl' => 'Kokoswater 33 cl',            'en' => 'Coconut water 33 cl',          'category' => 'Dranken',   'price' => 15.00, 'exempt' => false],

            // ── Rijst & droge waren (basisvoedsel — BTW-vrij) ───────────────
            ['barcode' => '8712000000210', 'nl' => 'A1 Rijst Nickerie 5 kg',      'en' => 'A1 Rice Nickerie 5 kg',        'category' => 'Rijst & Pasta',     'price' => 78.00, 'exempt' => true, 'unit' => 'pak'],
            ['barcode' => '8712000000227', 'nl' => 'Witte rijst los per kg',      'en' => 'White rice loose per kg',      'category' => 'Rijst & Pasta',     'price' => 16.50, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000234', 'nl' => 'Bruine bonen 500 g',          'en' => 'Brown beans 500 g',            'category' => 'Rijst & Pasta',     'price' => 18.00, 'exempt' => true],
            ['barcode' => '8712000000241', 'nl' => 'Zwarte ogen bonen 500 g',     'en' => 'Black-eyed peas 500 g',        'category' => 'Rijst & Pasta',     'price' => 17.50, 'exempt' => true],
            ['barcode' => '8712000000258', 'nl' => 'Bloem 1 kg',                  'en' => 'Flour 1 kg',                   'category' => 'Rijst & Pasta',     'price' => 14.00, 'exempt' => true],
            ['barcode' => '8712000000265', 'nl' => 'Bakolie 1 L',                 'en' => 'Cooking oil 1 L',              'category' => 'Rijst & Pasta',     'price' => 32.00, 'exempt' => true],
            ['barcode' => '8712000000272', 'nl' => 'Kokosmelk 400 ml',            'en' => 'Coconut milk 400 ml',          'category' => 'Rijst & Pasta',     'price' => 12.50, 'exempt' => false],

            // ── Vlees & gevogelte ───────────────────────────────────────────
            ['barcode' => '8712000000310', 'nl' => 'Kipfilet per kg',             'en' => 'Chicken breast per kg',        'category' => 'Vlees',     'price' => 68.00, 'exempt' => false, 'unit' => 'kg'],
            ['barcode' => '8712000000327', 'nl' => 'Hele kip bevroren',           'en' => 'Whole chicken frozen',         'category' => 'Vlees',     'price' => 95.00, 'exempt' => false],
            ['barcode' => '8712000000334', 'nl' => 'Varkensribben per kg',        'en' => 'Pork ribs per kg',             'category' => 'Vlees',     'price' => 82.00, 'exempt' => false, 'unit' => 'kg'],
            ['barcode' => '8712000000341', 'nl' => 'Gehakt rundvlees 500 g',      'en' => 'Minced beef 500 g',            'category' => 'Vlees',     'price' => 55.00, 'exempt' => false],
            ['barcode' => '8712000000358', 'nl' => 'Bakkeljauw (gezouten kabeljauw) 250 g', 'en' => 'Bakkeljauw (salt cod) 250 g', 'category' => 'Vlees', 'price' => 48.00, 'exempt' => false],

            // ── Vis (verse vis is BTW-vrij) ─────────────────────────────────
            ['barcode' => '8712000000410', 'nl' => 'Kwikwi per kg',               'en' => 'Kwikwi fish per kg',           'category' => 'Vis',       'price' => 62.00, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000427', 'nl' => 'Bang bang vis per kg',        'en' => 'Bang bang fish per kg',        'category' => 'Vis',       'price' => 58.00, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000434', 'nl' => 'Rode snapper per kg',         'en' => 'Red snapper per kg',           'category' => 'Vis',       'price' => 90.00, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000441', 'nl' => 'Garnalen (sasa) 500 g',       'en' => 'Shrimp (sasa) 500 g',          'category' => 'Vis',       'price' => 75.00, 'exempt' => true],

            // ── Groente & fruit (vers — BTW-vrij) ───────────────────────────
            ['barcode' => '8712000000510', 'nl' => 'Madame Jeanette peper 250 g', 'en' => 'Madame Jeanette pepper 250 g', 'category' => 'Groenten',   'price' => 12.00, 'exempt' => true],
            ['barcode' => '8712000000527', 'nl' => 'Cassave (maniok) per kg',     'en' => 'Cassava per kg',               'category' => 'Groenten',   'price' => 11.00, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000534', 'nl' => 'Tayerblad bundel',            'en' => 'Taro leaf bundle',             'category' => 'Groenten',   'price' => 9.00,  'exempt' => true],
            ['barcode' => '8712000000541', 'nl' => 'Antroewa 500 g',              'en' => 'Antroewa (bitter eggplant) 500 g', 'category' => 'Groenten', 'price' => 10.50, 'exempt' => true],
            ['barcode' => '8712000000558', 'nl' => 'Sopropo 500 g',               'en' => 'Bitter gourd 500 g',           'category' => 'Groenten',   'price' => 13.00, 'exempt' => true],
            ['barcode' => '8712000000565', 'nl' => 'Bakbanaan per kg',            'en' => 'Plantain per kg',              'category' => 'Groenten',   'price' => 14.00, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000572', 'nl' => 'Napi per kg',                 'en' => 'Napi (yam) per kg',            'category' => 'Groenten',   'price' => 15.50, 'exempt' => true, 'unit' => 'kg'],
            ['barcode' => '8712000000589', 'nl' => 'Markusa (passievrucht) 6 st', 'en' => 'Passion fruit 6 pcs',          'category' => 'Fruit',     'price' => 18.00, 'exempt' => true],
            ['barcode' => '8712000000596', 'nl' => 'Awara vrucht per kg',         'en' => 'Awara fruit per kg',           'category' => 'Fruit',     'price' => 22.00, 'exempt' => true, 'unit' => 'kg'],

            // ── Brood & gebak ───────────────────────────────────────────────
            ['barcode' => '8712000000610', 'nl' => 'Punt brood',                  'en' => 'Punt bread',                   'category' => 'Brood',     'price' => 7.50,  'exempt' => true],
            ['barcode' => '8712000000627', 'nl' => 'Roti (2 stuks)',              'en' => 'Roti (2 pcs)',                 'category' => 'Brood',     'price' => 16.00, 'exempt' => true],
            ['barcode' => '8712000000634', 'nl' => 'Bara (4 stuks)',              'en' => 'Bara (4 pcs)',                 'category' => 'Brood',     'price' => 12.00, 'exempt' => true],
            ['barcode' => '8712000000641', 'nl' => 'Fiadu cake per stuk',         'en' => 'Fiadu cake per piece',         'category' => 'Brood',     'price' => 25.00, 'exempt' => false],
            ['barcode' => '8712000000658', 'nl' => 'Pom (bak, 1 kg)',             'en' => 'Pom (tray, 1 kg)',             'category' => 'Brood',     'price' => 95.00, 'exempt' => false],

            // ── Snacks ──────────────────────────────────────────────────────
            ['barcode' => '8712000000710', 'nl' => 'Bojo cake per stuk',          'en' => 'Bojo cake per piece',          'category' => 'Snacks',    'price' => 20.00, 'exempt' => false],
            ['barcode' => '8712000000727', 'nl' => 'Pinda (gezouten) 200 g',      'en' => 'Peanuts (salted) 200 g',       'category' => 'Snacks',    'price' => 13.50, 'exempt' => false],
            ['barcode' => '8712000000734', 'nl' => 'Cassave chips 150 g',         'en' => 'Cassava chips 150 g',          'category' => 'Snacks',    'price' => 15.00, 'exempt' => false],

            // ── Huishoudelijk ───────────────────────────────────────────────
            ['barcode' => '8712000000810', 'nl' => 'Blauw zeep (blauwsteen)',     'en' => 'Blue soap bar',                'category' => 'Huishoud', 'price' => 8.50,  'exempt' => false],
            ['barcode' => '8712000000827', 'nl' => 'Chloor 1 L',                  'en' => 'Bleach 1 L',                   'category' => 'Huishoud', 'price' => 17.00, 'exempt' => false],
            ['barcode' => '8712000000834', 'nl' => 'Muskietenspiraal 10 st',      'en' => 'Mosquito coils 10 pcs',        'category' => 'Huishoud', 'price' => 14.00, 'exempt' => false],
            ['barcode' => '8712000000841', 'nl' => 'Houtskool 3 kg',              'en' => 'Charcoal 3 kg',                'category' => 'Huishoud', 'price' => 35.00, 'exempt' => false],
        ];
    }
}
