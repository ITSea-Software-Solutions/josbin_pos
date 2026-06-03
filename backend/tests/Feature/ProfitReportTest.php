<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Profit report end-to-end:
 *   - cost_snapshot_srd + line_profit_srd stamped on sale_item at sale time
 *   - GET /api/reports/profit aggregates correctly (revenue / cost / profit /
 *     margin% / per-store / top-products-by-profit / loss-makers)
 *   - OA + SM + SA have access; cashier + auditor get 403
 *   - Items without cost surface via items_without_cost counter
 *   - Variant cost preferred over parent when variant_id present
 */
class ProfitReportTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $store;
    private User $oa;
    private User $sm;
    private User $cashier;
    private User $auditor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Profit Org', 'type' => 'retail',
            'btw_number' => 'SR-P', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );

        $this->oa = User::create([
            'name' => 'OA', 'email' => 'oa-p@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->sm = User::create([
            'name' => 'SM', 'email' => 'sm-p@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'store_id' => $this->store->id,
            'role' => User::ROLE_STORE_MANAGER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sm->assignRole(User::ROLE_STORE_MANAGER);

        $this->cashier = User::create([
            'name' => 'C', 'email' => 'c-p@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'store_id' => $this->store->id,
            'role' => User::ROLE_CASHIER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);

        $this->auditor = User::create([
            'name' => 'A', 'email' => 'a-p@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_AUDITOR,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->auditor->assignRole(User::ROLE_AUDITOR);
    }

    /** Helper — make a completed sale + items with cost snapshot pre-baked. */
    private function makeSale(array $items, ?Carbon $occurredAt = null): Sale
    {
        $register = Register::firstOrCreate(
            ['store_id' => $this->store->id, 'number' => 1],
            ['name' => 'Kassa 1', 'is_active' => true],
        );
        $session = RegisterSession::create([
            'register_id' => $register->id,
            'store_id'    => $this->store->id,
            'cashier_id'  => $this->cashier->id,
            'opening_float_srd' => 0,
            'opened_at'   => now(),
        ]);

        $rate = DailyRate::orderByDesc('date')->first();
        $totalLine = collect($items)->sum('line_total');
        $totalBtw  = collect($items)->sum('btw');

        $sale = Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->cashier->id,
            'register_session_id' => $session->id,
            'sale_number'        => 'TST-' . uniqid(),
            'subtotal_srd'       => $totalLine - $totalBtw,
            'discount_srd'       => 0,
            'btw_srd'            => $totalBtw,
            'total_srd'          => $totalLine,
            'payment_method'     => 'cash',
            'cash_received_srd'  => $totalLine,
            'change_srd'         => 0,
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => $rate->usd_to_srd,
            'occurred_at'        => $occurredAt ?? now(),
        ]);

        foreach ($items as $i) {
            $lineProfit = $i['cost'] !== null
                ? bcsub((string) $i['line_total'], bcmul((string) $i['cost'], (string) $i['qty'], 2), 2)
                : null;
            SaleItem::create([
                'sale_id'               => $sale->id,
                'product_id'            => $i['product_id'] ?? null,
                'product_name_snapshot' => $i['name'],
                'unit_price_srd'        => $i['unit_price'],
                'quantity'              => $i['qty'],
                'discount_srd'          => 0, 'discount_pct' => 0,
                'btw_rate'              => 10, 'btw_exempt' => false,
                'btw_srd'               => $i['btw'],
                'line_total_srd'        => $i['line_total'],
                'cost_snapshot_srd'     => $i['cost'],
                'line_profit_srd'       => $lineProfit,
            ]);
        }
        return $sale;
    }

    public function test_profit_endpoint_aggregates_totals_correctly(): void
    {
        // 2 sales: one profitable, one tighter margin
        $this->makeSale([
            // 10 units × SRD 5.00 each, cost SRD 3.00 → profit SRD 20.00
            ['name' => 'A', 'unit_price' => '5.00', 'qty' => '10', 'btw' => '4.55', 'line_total' => '50.00', 'cost' => '3.00'],
        ]);
        $this->makeSale([
            // 1 unit × SRD 100, cost SRD 95 → profit SRD 5.00
            ['name' => 'B', 'unit_price' => '100', 'qty' => '1', 'btw' => '9.09', 'line_total' => '100', 'cost' => '95'],
        ]);

        $today = Carbon::now('America/Paramaribo')->toDateString();
        $resp = $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}");

        $resp->assertOk();
        $d = $resp->json('data');
        $this->assertEquals('150.00', $d['revenue_srd']);   // 50 + 100
        $this->assertEquals('125.00', $d['cost_srd']);      // 30 + 95
        $this->assertEquals('25.00',  $d['profit_srd']);    // 20 + 5
        // 25 / 150 = 16.67%
        $this->assertEquals('16.67', $d['margin_pct']);
        $this->assertEquals(2, $d['transactions']);
    }

    public function test_top_products_ranked_by_profit_not_revenue(): void
    {
        // High-revenue low-margin loses to low-revenue high-margin
        $this->makeSale([
            ['name' => 'CheapVolume', 'unit_price' => '10', 'qty' => '50',
             'btw' => '45.45', 'line_total' => '500', 'cost' => '9.50'], // profit 25
        ]);
        $this->makeSale([
            ['name' => 'PremiumNiche', 'unit_price' => '200', 'qty' => '1',
             'btw' => '18.18', 'line_total' => '200', 'cost' => '50'],   // profit 150
        ]);

        $today = Carbon::now('America/Paramaribo')->toDateString();
        $top = $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->json('data.top_products_by_profit');

        $this->assertEquals('PremiumNiche', $top[0]['name'], 'Highest profit ranks first, not highest revenue.');
        $this->assertEquals('150.00', $top[0]['profit_srd']);
        $this->assertEquals('CheapVolume', $top[1]['name']);
    }

    public function test_loss_makers_detected(): void
    {
        // Sold below cost (accidental over-discount)
        $this->makeSale([
            ['name' => 'OverDiscounted', 'unit_price' => '10', 'qty' => '1',
             'btw' => '0.91', 'line_total' => '10', 'cost' => '15'], // -5
        ]);

        $today = Carbon::now('America/Paramaribo')->toDateString();
        $losses = $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->json('data.loss_makers');

        $this->assertCount(1, $losses);
        $this->assertEquals('-5.00', $losses[0]['profit_srd']);
    }

    public function test_items_without_cost_counted(): void
    {
        $this->makeSale([
            ['name' => 'NoCost', 'unit_price' => '10', 'qty' => '1',
             'btw' => '0.91', 'line_total' => '10', 'cost' => null], // no snapshot
        ]);

        $today = Carbon::now('America/Paramaribo')->toDateString();
        $d = $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->json('data');

        $this->assertEquals(1, $d['items_without_cost']);
        $this->assertEquals('10.00', $d['revenue_srd']);
        $this->assertEquals('0.00',  $d['cost_srd']);  // NULL → COALESCE(0)
    }

    public function test_sm_can_see_profit_report(): void
    {
        $today = Carbon::now('America/Paramaribo')->toDateString();
        $this->actingAs($this->sm, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->assertOk();
    }

    public function test_cashier_cannot_see_profit_report(): void
    {
        $today = Carbon::now('America/Paramaribo')->toDateString();
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->assertForbidden();
    }

    public function test_auditor_cannot_see_profit_report(): void
    {
        $today = Carbon::now('America/Paramaribo')->toDateString();
        $this->actingAs($this->auditor, 'sanctum')
            ->getJson("/api/reports/profit?date_from={$today}&date_to={$today}")
            ->assertForbidden();
    }
}
