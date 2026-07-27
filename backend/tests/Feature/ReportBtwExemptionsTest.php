<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * GET /api/reports/btw-exemptions — the "why did these sales carry no BTW"
 * report. Created through the real POST /sales flow so the rows carry
 * exactly what the till stamped: reason, net total, forgone BTW.
 */
class ReportBtwExemptionsTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
        Bus::fake();
        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $org           = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $org->id)->firstOrFail();

        DailyRate::create([
            'date' => today()->toDateString(), 'usd_to_srd' => '38.5000',
            'raw_rate' => '37.5000', 'markup_pct' => '2.50', 'source' => 'manual',
            'locked_by' => $this->manager->id, 'locked_at' => now(),
        ]);

        $product = Product::where('organisation_id', $org->id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();

        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'          => $this->store->id,
            'payment_method'    => 'cash',
            'cash_tendered'     => 50.00,
            'btw_exempt'        => true,
            'btw_exempt_reason' => 'Ministerie van Onderwijs — schoolinkoop PO-2026-114',
            'items'             => [[
                'product_id' => $product->id, 'product_name' => $product->name_nl,
                'unit_price' => '11.00', 'quantity' => 1, 'btw_rate' => '10', 'btw_exempt' => false,
            ]],
        ])->assertStatus(201);
    }

    public function test_manager_sees_exempt_sale_with_reason_and_forgone_btw(): void
    {
        $res = $this->actingAs($this->manager, 'sanctum')->getJson(
            '/api/reports/btw-exemptions?date_from='.today()->toDateString().'&date_to='.today()->toDateString()
        );

        $res->assertOk()
            ->assertJsonPath('summary.count', 1)
            ->assertJsonPath('summary.exempt_turnover_srd', '10.00')
            ->assertJsonPath('summary.btw_forgone_srd', '1.00')
            ->assertJsonPath('rows.0.reason', 'Ministerie van Onderwijs — schoolinkoop PO-2026-114')
            ->assertJsonPath('rows.0.total_srd', '10.00')
            ->assertJsonPath('rows.0.btw_forgone_srd', '1.00');

        $this->assertNotNull($res->json('rows.0.cashier'));
    }

    public function test_report_is_paginated_and_summary_covers_the_whole_range(): void
    {
        // Two more exempt sales → 3 total; page size 2 → 2 pages. The summary
        // must count ALL 3 even when the page shows only 2.
        $product = \App\Models\Product::where('organisation_id', $this->store->organisation_id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();
        foreach ([1, 2] as $i) {
            $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
                'store_id'          => $this->store->id,
                'payment_method'    => 'cash',
                'cash_tendered'     => 50.00,
                'btw_exempt'        => true,
                'btw_exempt_reason' => "Ministerie van Onderwijs — vervolgorder {$i}",
                'items'             => [[
                    'product_id' => $product->id, 'product_name' => $product->name_nl,
                    'unit_price' => '11.00', 'quantity' => 1, 'btw_rate' => '10', 'btw_exempt' => false,
                ]],
            ])->assertStatus(201);
        }

        $res = $this->actingAs($this->manager, 'sanctum')->getJson(
            '/api/reports/btw-exemptions?per_page=2&page=1'
            .'&date_from='.today()->toDateString().'&date_to='.today()->toDateString()
        );

        $res->assertOk()
            ->assertJsonPath('pagination.total', 3)
            ->assertJsonPath('pagination.last_page', 2)
            ->assertJsonCount(2, 'rows')
            // Whole-range aggregates, not page-of-2 sums:
            ->assertJsonPath('summary.count', 3)
            ->assertJsonPath('summary.exempt_turnover_srd', '30.00')
            ->assertJsonPath('summary.btw_forgone_srd', '3.00');

        $page2 = $this->actingAs($this->manager, 'sanctum')->getJson(
            '/api/reports/btw-exemptions?per_page=2&page=2'
            .'&date_from='.today()->toDateString().'&date_to='.today()->toDateString()
        );
        $page2->assertOk()->assertJsonCount(1, 'rows');
    }

    public function test_cashier_cannot_open_the_exemptions_report(): void
    {
        $this->actingAs($this->cashier, 'sanctum')->getJson(
            '/api/reports/btw-exemptions?date_from='.today()->toDateString().'&date_to='.today()->toDateString()
        )->assertStatus(403);
    }
}
