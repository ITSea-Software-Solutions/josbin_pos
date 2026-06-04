<?php

namespace Database\Seeders;

use App\Models\ApiIntegration;
use App\Models\Customer;
use App\Models\DiscountRule;
use App\Models\HeldBill;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\StockMovement;
use App\Models\Store;
use App\Models\User;
use App\Models\ZReport;
use App\Services\BtwCalculationService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * DemoSeeder — fills every screen with realistic data so a fresh demo
 * environment has registers to open, sales to report on, customers to look up,
 * held bills, Z-Reports, discount rules and API keys.
 *
 * Idempotent: safe to re-run. Existing rows are reused; only missing data is
 * created. The historical 30-day window is anchored to "today" each run, so
 * a re-run after a few days will fill in the new gap.
 *
 * Run:   php artisan db:seed --class=DemoSeeder
 */
class DemoSeeder extends Seeder
{
    private BtwCalculationService $btw;

    public function run(): void
    {
        $this->btw = app(BtwCalculationService::class);

        $stores = Store::with('organisation')->get();
        if ($stores->isEmpty()) {
            $this->command->error('No stores found — run `php artisan db:seed` (DatabaseSeeder) first.');
            return;
        }

        $cashier  = User::where('email', 'kassa@dehoop.sr')->first();
        $manager  = User::where('email', 'manager@dehoop.sr')->first();
        if (! $cashier || ! $manager) {
            $this->command->error('Demo users missing — run the base DatabaseSeeder first.');
            return;
        }

        $this->ensureOrgAdmin($stores->first()->organisation_id);
        $this->ensureTodaysExchangeRate();
        // Backfill cost prices first — the profit/margin report (and the
        // cost snapshot stamped on each seeded sale item) is meaningless
        // without them, and a fresh import leaves cost_price null.
        $this->ensureProductCosts();

        foreach ($stores as $store) {
            $this->command->info("Seeding demo data for store: {$store->name}");
            $this->seedRegisters($store);
            $this->seedProductStocks($store);
            $this->seedCustomers($store->organisation_id);
            $this->seedDiscountRules($store);
            $this->seedApiIntegrations($store);
            $this->seedHistoricalSales($store, $cashier, $manager);
            $this->seedHeldBills($store, $cashier);
        }

        $this->command->info('DemoSeeder complete.');
    }

    /**
     * Org Admin is the HQ catalogue owner (CSV/Excel import, push-to-POS,
     * org-wide reports). Demo creds: orgadmin@dehoop.sr / OrgAdmin@2026.
     */
    private function ensureOrgAdmin(string $organisationId): void
    {
        $oa = User::firstOrCreate(
            ['email' => 'orgadmin@dehoop.sr'],
            [
                'name'            => 'Sandra Codrington',
                'password'        => Hash::make('OrgAdmin@2026'),
                'organisation_id' => $organisationId,
                'role'            => User::ROLE_ORGANISATION_ADMIN,
                'locale'          => 'nl',
                'is_active'       => true,
            ],
        );
        if (! $oa->hasRole(User::ROLE_ORGANISATION_ADMIN)) {
            $oa->assignRole(User::ROLE_ORGANISATION_ADMIN);
        }
    }

    /**
     * SaleController refuses any sale if there is no DailyRate locked for today
     * (frontend shows generic "Server error"). Make sure demo always has one
     * so a freshly-seeded demo is immediately usable for selling.
     */
    private function ensureTodaysExchangeRate(): void
    {
        \App\Models\DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            [
                'usd_to_srd' => '37.50',
                'raw_rate'   => '37.50',
                'markup_pct' => 0,
                'source'     => 'manual',
                'locked_at'  => Carbon::now('America/Paramaribo'),
            ],
        );
    }

    /**
     * Backfill a believable cost_price on every product that lacks one.
     * Cost is a deterministic 55–72% of the sale price (derived from a hash
     * of the product id, so re-runs are stable and a handful of products
     * land near-margin to make the "loss-makers" / low-margin views realistic).
     * Never overwrites a cost an admin already set.
     */
    private function ensureProductCosts(): void
    {
        $count = 0;
        Product::whereNull('cost_price')->where('price', '>', 0)->chunkById(200, function ($products) use (&$count) {
            foreach ($products as $p) {
                // 55–72% margin band, stable per product id.
                $pct  = 55 + (hexdec(substr(md5($p->id), 0, 2)) % 18); // 55..72
                $cost = bcdiv(bcmul((string) $p->price, (string) $pct, 4), '100', 2);
                $p->forceFill(['cost_price' => $cost])->saveQuietly();
                $count++;
            }
        });
        $this->command->info("  cost_price backfilled on {$count} products");
    }

    // ── Registers + today's open session ─────────────────────────────────────

    private function seedRegisters(Store $store): void
    {
        for ($i = 1; $i <= 2; $i++) {
            Register::firstOrCreate(
                ['store_id' => $store->id, 'number' => $i],
                ['name' => "Kassa $i", 'is_active' => true],
            );
        }
    }

    /**
     * Per-store stock rows so the Stock screen + store filter show real
     * numbers (not the catalogue fallback). A few products per store are
     * deliberately seeded at/below threshold so the low-stock alert and the
     * red badges have something to display.
     */
    private function seedProductStocks(Store $store): void
    {
        $products = Product::where('organisation_id', $store->organisation_id)
            ->where('is_active', true)
            ->get();

        $i = 0;
        foreach ($products as $p) {
            $i++;
            // Every ~9th product is low/out of stock for the alert demo.
            $low       = ($i % 9 === 0);
            $threshold = 10;
            $qty       = $low ? random_int(0, 8) : random_int(25, 220);

            ProductStock::firstOrCreate(
                ['product_id' => $p->id, 'store_id' => $store->id],
                ['stock_qty' => $qty, 'low_stock_threshold' => $threshold],
            );
        }
    }

    // ── Customers (realistic Suriname names) ─────────────────────────────────

    private function seedCustomers(string $organisationId): void
    {
        if (Customer::where('organisation_id', $organisationId)->count() >= 40) {
            return;
        }

        $first  = ['Rashied','Sharmila','Anand','Devika','Sunil','Anita','Ramnarine','Soeshil',
                   'Carmen','Donovan','Marlon','Sandra','Theo','Wilhelmina','Roy','Jurgen',
                   'Joko','Wati','Sutarto','Sariem','Bambang','Indra','Yanti',
                   'Jan','Marieke','Hans','Wouter','Lisette','Patrick','Mireille'];
        $last   = ['Jankipersad','Alibaks','Soemardi','Wongsosemito','Pawironadi','Doerga',
                   'Mungra','Bhagwandien','Codrington','Wittenberg','Renfurm','Kromodiwirjo',
                   'Sastrowidjojo','Ramautar','Tjon','Ngo','Pinas','Boldewijn','Adipi',
                   'van Dijk','de Vries','Pinas','Vermeulen','Klaverveen'];

        $existing = Customer::where('organisation_id', $organisationId)->count();
        $toCreate = max(0, 40 - $existing);
        for ($i = 0; $i < $toCreate; $i++) {
            Customer::create([
                'organisation_id' => $organisationId,
                'name'  => $first[array_rand($first)] . ' ' . $last[array_rand($last)],
                'phone' => '+597 ' . random_int(7000000, 8999999),
                'email' => 'klant' . random_int(1000, 9999) . '@example.sr',
                'total_spend_srd' => 0,
                'visit_count'     => 0,
            ]);
        }
    }

    // ── Discount rules ───────────────────────────────────────────────────────

    private function seedDiscountRules(Store $store): void
    {
        if (DiscountRule::where('store_id', $store->id)->count() > 0) {
            return;
        }
        $rules = [
            ['name' => '10% korting op alles',  'applies_to' => 'cart',     'type' => 'pct_discount',   'value' => 10, 'is_active' => true],
            ['name' => 'SRD 5 vaste korting',   'applies_to' => 'cart',     'type' => 'fixed_discount', 'value' => 5,  'is_active' => false],
            ['name' => 'Vlees -15%',            'applies_to' => 'category', 'type' => 'pct_discount',   'value' => 15, 'is_active' => true],
            ['name' => 'Koop 3 betaal 2',       'applies_to' => 'cart',     'type' => 'pct_discount',   'value' => 33, 'min_qty' => 3, 'is_active' => true],
            ['name' => 'Seniorenkorting 5%',    'applies_to' => 'cart',     'type' => 'pct_discount',   'value' => 5,  'is_active' => true],
            ['name' => 'Weekendactie SRD 10',   'applies_to' => 'cart',     'type' => 'fixed_discount', 'value' => 10, 'is_active' => false],
        ];
        foreach ($rules as $r) {
            DiscountRule::create(array_merge([
                'organisation_id' => $store->organisation_id,
                'store_id'        => $store->id,
                'stackable'       => false,
                'min_qty'         => $r['min_qty'] ?? 1,
                'valid_from'      => null,
                'valid_to'        => null,
            ], $r));
        }
    }

    // ── API integration keys ─────────────────────────────────────────────────

    private function seedApiIntegrations(Store $store): void
    {
        if (ApiIntegration::where('store_id', $store->id)->count() > 0) {
            return;
        }
        $samples = [
            ['pos_system' => 'Square',  'webhook_url' => 'https://hooks.example.com/square',  'events' => ['sale.created']],
            ['pos_system' => 'Shopify', 'webhook_url' => 'https://hooks.example.com/shopify', 'events' => ['sale.created','refund.issued']],
            ['pos_system' => 'Custom',  'webhook_url' => null,                                 'events' => []],
        ];
        foreach ($samples as $s) {
            ApiIntegration::create([
                'store_id'        => $store->id,
                'pos_system'      => $s['pos_system'],
                'api_key_hash'    => hash('sha256', 'demo_' . Str::random(40)),
                'webhook_url'     => $s['webhook_url'],
                'webhook_events'  => $s['events'],
                'webhook_secret'  => Str::random(48),
                'is_active'       => true,
                'settings'        => [],
            ]);
        }
    }

    // ── Historical sales + register sessions + Z-Reports + stock movements ──

    private function seedHistoricalSales(Store $store, User $cashier, User $manager): void
    {
        $registers = Register::where('store_id', $store->id)->get();
        if ($registers->isEmpty()) return;

        $products = Product::where('organisation_id', $store->organisation_id)
            ->where('is_active', true)
            ->get();
        if ($products->isEmpty()) return;

        $customers = Customer::where('organisation_id', $store->organisation_id)->get();

        // Past 30 days closed sessions + sales + Z-Reports + today's open session.
        for ($daysAgo = 30; $daysAgo >= 0; $daysAgo--) {
            $date = Carbon::today('America/Paramaribo')->subDays($daysAgo);

            // Skip if we already seeded sales for this date
            if (Sale::where('store_id', $store->id)
                    ->whereDate('occurred_at', $date)
                    ->exists()) {
                continue;
            }

            $register = $registers->first();
            $session  = $this->openSession($register, $store, $cashier, $date);

            $saleCount = $daysAgo === 0 ? 3 : random_int(5, 12);
            $cashTotal = '0.00';
            $cardTotal = '0.00';
            $btwTotal  = '0.00';

            for ($i = 0; $i < $saleCount; $i++) {
                // Most sales land in trading hours (08–19). Every ~4th sale
                // is pushed into the late-evening AST window (21:00–23:45) so
                // the BTW/daily reports have transactions that fall on the
                // wrong calendar day under UTC — the exact case the AST
                // timezone fix corrects. These are the rows to eyeball when
                // validating that a 23:30 AST sale counts on its own day.
                $hour = ($i % 4 === 3)
                    ? random_int(21, 23)   // late-evening boundary sales
                    : random_int(8, 19);   // normal trading hours

                $sale = $this->createSale(
                    store:    $store,
                    cashier:  $cashier,
                    session:  $session,
                    products: $products,
                    customer: $customers->random(),
                    occurredAt: $date->copy()->setTime($hour, random_int(0, 59)),
                );
                if ($sale->payment_method === 'cash') {
                    $cashTotal = bcadd($cashTotal, (string) $sale->total_srd, 2);
                } elseif ($sale->payment_method === 'card') {
                    $cardTotal = bcadd($cardTotal, (string) $sale->total_srd, 2);
                } else { // mixed
                    $cashTotal = bcadd($cashTotal, (string) bcdiv((string) $sale->total_srd, '2', 2), 2);
                    $cardTotal = bcadd($cardTotal, (string) bcsub((string) $sale->total_srd, (string) bcdiv((string) $sale->total_srd, '2', 2), 2), 2);
                }
                $btwTotal = bcadd($btwTotal, (string) $sale->btw_srd, 2);
            }

            if ($daysAgo === 0) {
                // Today — leave the session open so the cashier can use it
                continue;
            }

            // Close session + write Z-Report for historical days
            $expectedCash = bcadd((string) $session->opening_float, $cashTotal, 2);
            $countedCash  = (random_int(1, 10) === 1)
                ? bcadd($expectedCash, '2.50', 2)   // rare small discrepancy
                : $expectedCash;
            $discrepancy  = bcsub($countedCash, $expectedCash, 2);

            $session->update([
                'closing_cash_counted' => $countedCash,
                'expected_cash'        => $expectedCash,
                'discrepancy'          => $discrepancy,
                'status'               => 'closed',
                'closed_at'            => $date->copy()->setTime(20, 0),
            ]);

            ZReport::create([
                'store_id'             => $store->id,
                'closed_by'            => $manager->id,
                'report_date'          => $date->toDateString(),
                'total_sales_srd'      => bcadd($cashTotal, $cardTotal, 2),
                'transaction_count'    => $saleCount,
                'total_btw_srd'        => $btwTotal,
                'cash_total_srd'       => $cashTotal,
                'card_total_srd'       => $cardTotal,
                'expected_cash_srd'    => $expectedCash,
                'actual_cash_srd'      => $countedCash,
                'cash_discrepancy_srd' => $discrepancy,
                'discrepancy_note'     => bccomp($discrepancy, '0', 2) !== 0 ? 'Telverschil — kleine afronding' : null,
                'top_products'         => [],
                'btw_breakdown'        => ['10.00' => $btwTotal],
                'sync_status'          => random_int(1, 5) === 1 ? 'pending' : 'sent',
                'synced_at'            => random_int(1, 5) === 1 ? null : $date->copy()->setTime(20, 5),
                'closed_at'            => $date->copy()->setTime(20, 0),
            ]);
        }
    }

    private function openSession(Register $register, Store $store, User $cashier, Carbon $date): RegisterSession
    {
        return RegisterSession::create([
            'register_id'   => $register->id,
            'store_id'      => $store->id,
            'cashier_id'    => $cashier->id,
            'opening_float' => '200.00',
            'status'        => 'open',
            'opened_at'     => $date->copy()->setTime(8, 0),
        ]);
    }

    private function createSale(
        Store $store,
        User $cashier,
        RegisterSession $session,
        $products,
        ?Customer $customer,
        Carbon $occurredAt,
    ): Sale {
        $itemCount = random_int(1, 5);
        $cartItems = [];
        for ($i = 0; $i < $itemCount; $i++) {
            $product = $products->random();
            $cartItems[] = [
                'unit_price'  => (string) $product->price,
                'quantity'    => (string) random_int(1, 3),
                'btw_rate'    => (string) $product->btw_rate,
                'btw_exempt'  => (bool)   $product->btw_exempt,
                'discount_srd' => '0.00',
                '_product_id' => $product->id,
                '_name'       => $product->name_nl ?? $product->name_en,
                // Snapshot the cost at "sale" time, mirroring SaleController.
                '_cost'       => $product->cost_price !== null ? (string) $product->cost_price : null,
            ];
        }

        $cart = $this->btw->calculateCart($cartItems);
        $paymentMethod = ['cash','cash','cash','card','mixed'][random_int(0, 4)];
        $cashTendered  = $paymentMethod === 'card' ? null : bcadd((string) $cart['total'], '0', 2);
        $cardAmount    = $paymentMethod === 'cash' ? null : ($paymentMethod === 'card' ? (string) $cart['total'] : (string) bcdiv((string) $cart['total'], '2', 2));

        return DB::transaction(function () use ($store, $cashier, $session, $cart, $cartItems, $paymentMethod, $cashTendered, $cardAmount, $customer, $occurredAt) {
            $sale = Sale::create([
                'store_id'            => $store->id,
                'cashier_id'          => $cashier->id,
                'register_session_id' => $session->id,
                'customer_id'         => $customer?->id,
                'sale_number'         => Sale::nextNumber($store->id),
                'subtotal_srd'        => $cart['subtotal'],
                'discount_srd'        => $cart['sale_discount'],
                'btw_srd'             => $cart['btw_total'],
                'total_srd'           => $cart['total'],
                'payment_method'      => $paymentMethod,
                'cash_received_srd'   => $cashTendered,
                'card_amount_srd'     => $cardAmount,
                'change_srd'          => '0.00',
                'status'              => 'completed',
                'source'              => 'pos',
                'exchange_rate_used'  => '37.50',
                'occurred_at'         => $occurredAt,
            ]);

            foreach ($cartItems as $i => $item) {
                $calc = $cart['items'][$i];

                // line_profit = line_total - (cost * qty). NULL when cost
                // unknown, so the profit report can SUM() without a CASE —
                // identical shape to SaleController.
                $lineProfit = $item['_cost'] !== null
                    ? bcsub((string) $calc['line_total'], bcmul((string) $item['_cost'], (string) $item['quantity'], 2), 2)
                    : null;

                SaleItem::create([
                    'sale_id'               => $sale->id,
                    'product_id'            => $item['_product_id'],
                    'product_name_snapshot' => $item['_name'],
                    'unit_price_srd'        => $item['unit_price'],
                    'quantity'              => $item['quantity'],
                    'discount_srd'          => '0.00',
                    'discount_pct'          => '0.00',
                    'btw_rate'              => $item['btw_rate'],
                    'btw_exempt'            => $item['btw_exempt'],
                    'btw_srd'               => $calc['btw_amount'],
                    'line_total_srd'        => $calc['line_total'],
                    'cost_snapshot_srd'     => $item['_cost'],
                    'line_profit_srd'       => $lineProfit,
                ]);

                // Decrement the per-store stock row (created by
                // seedProductStocks) so the Stock screen reflects this sale,
                // and record the movement against the resulting balance.
                $stock = ProductStock::where('product_id', $item['_product_id'])
                    ->where('store_id', $store->id)
                    ->first();
                $qtyAfter = $stock
                    ? (float) $stock->stock_qty - (float) $item['quantity']
                    : -(float) $item['quantity'];
                if ($stock) {
                    $stock->update(['stock_qty' => $qtyAfter]);
                }

                StockMovement::create([
                    'product_id'      => $item['_product_id'],
                    'store_id'        => $store->id,
                    'organisation_id' => $store->organisation_id,
                    'qty_change'      => -(float) $item['quantity'],
                    'qty_after'       => $qtyAfter,
                    'reason'          => 'sale',
                    'sale_id'         => $sale->id,
                    'user_id'         => $cashier->id,
                    'created_at'      => $occurredAt,
                ]);
            }

            if ($customer) {
                Customer::where('id', $customer->id)->increment('visit_count');
                Customer::where('id', $customer->id)->increment('total_spend_srd', (float) $cart['total']);
            }

            return $sale;
        });
    }

    // ── Held bills (today, ready to be picked up) ────────────────────────────

    private function seedHeldBills(Store $store, User $cashier): void
    {
        if (HeldBill::where('store_id', $store->id)->count() >= 5) {
            return;
        }
        $products = Product::where('organisation_id', $store->organisation_id)
            ->where('is_active', true)
            ->take(20)
            ->get();
        if ($products->isEmpty()) return;

        $labels = ['Mevr. Pinas','Tafel 3','Zonder naam','Klant balie','Hr. Tjon','Avondbestelling'];
        foreach ($labels as $label) {
            $items = [];
            $total = '0.00';
            for ($i = 0; $i < random_int(2, 5); $i++) {
                $p = $products->random();
                $qty = random_int(1, 3);
                $line = bcmul((string) $p->price, (string) $qty, 2);
                $total = bcadd($total, $line, 2);
                $items[] = [
                    'product_id'  => $p->id,
                    'name'        => $p->name_nl ?? $p->name_en,
                    'unit_price'  => (string) $p->price,
                    'quantity'    => $qty,
                    'btw_rate'    => (string) $p->btw_rate,
                ];
            }
            HeldBill::create([
                'store_id'    => $store->id,
                'cashier_id'  => $cashier->id,
                'customer_id' => null,
                'label'       => $label,
                'cart_data'   => ['items' => $items],
                'total_srd'   => $total,
            ]);
        }
    }
}
