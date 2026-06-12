<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Services\LicenseService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * EnsureLicenseValid middleware — the lock must short-circuit BEFORE the
 * controller runs. The bug this guards: the middleware called $next() first
 * and returned 402 afterwards, so under soft-lock the sale was actually created
 * (stock decremented, sale_number burned) and the 402 was cosmetic.
 */
class LicenseEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private Store $store;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
        Bus::fake();
        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $org           = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $org->id)->firstOrFail();
        $this->product = Product::where('organisation_id', $org->id)->where('btw_exempt', false)->firstOrFail();

        DailyRate::firstOrCreate(['date' => today()->toDateString()], [
            'usd_to_srd' => '38.5000', 'raw_rate' => '37.5000', 'markup_pct' => '2.50',
            'source' => 'manual', 'locked_by' => $this->cashier->id, 'locked_at' => now(),
        ]);
    }

    private function forceStatus(string $status): void
    {
        $this->partialMock(LicenseService::class, function ($m) use ($status) {
            $m->shouldReceive('getStatus')->andReturn($status);
        });
    }

    private function salePayload(): array
    {
        return [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 50.00,
            'items'          => [[
                'product_id'   => $this->product->id,
                'product_name' => $this->product->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ];
    }

    public function test_soft_lock_blocks_the_sale_before_it_is_created(): void
    {
        $this->forceStatus('soft_lock');

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload())
            ->assertStatus(402)
            ->assertJsonPath('code', 'LICENSE_SOFT_LOCK');

        // The whole point: the sale must NOT have been written.
        $this->assertDatabaseCount('sales', 0);
    }

    public function test_active_licence_lets_the_sale_through(): void
    {
        $this->forceStatus('active');

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload())
            ->assertStatus(201);

        $this->assertDatabaseCount('sales', 1);
    }

    public function test_hard_lock_blocks_normal_routes_but_allows_data_export(): void
    {
        $this->forceStatus('hard_lock');

        // Normal route blocked.
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/products/pos?store_id=' . $this->store->id)
            ->assertStatus(402)
            ->assertJsonPath('code', 'LICENSE_HARD_LOCK');

        // Exempt routes stay reachable so the client never loses access to
        // their account / data-export surface (api/auth/me is hard-lock-exempt).
        $this->actingAs($this->cashier, 'sanctum')
            ->getJson('/api/auth/me')
            ->assertStatus(200);
    }
}
