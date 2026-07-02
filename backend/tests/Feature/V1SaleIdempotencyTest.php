<?php

namespace Tests\Feature;

use App\Models\ApiIntegration;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Layer-3 (Open Integration API) sale idempotency is scoped to the ORIGINATING
 * api_integration, not the store. Two different integrations reusing the same
 * sale_ref for the same store must NOT collide — the earlier bug scoped the
 * duplicate lookup by store_id only (backed by a GLOBAL unique on
 * external_sale_ref), so the retrying integrator got back another vendor's
 * sale, silently losing a transaction and corrupting BTW.
 */
class V1SaleIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Org A', 'type' => 'retail', 'btw_number' => 'SR-A',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'A-Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'external',
        ]);

        DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );
    }

    /** Registers an api integration on the shared store; returns [integration, rawKey]. */
    private function makeIntegration(string $rawKey, string $posSystem): ApiIntegration
    {
        return ApiIntegration::create([
            'store_id'    => $this->store->id,
            'pos_system'  => $posSystem,
            'api_key_hash'=> hash('sha256', $rawKey),
            'is_active'   => true,
        ]);
    }

    private function salePayload(string $ref): array
    {
        return [
            'sale_ref'       => $ref,
            'occurred_at'    => Carbon::now('America/Paramaribo')->toIso8601String(),
            'payment_method' => 'cash',
            'items'          => [
                ['product_name' => 'Rijst 1kg', 'unit_price' => 25.00, 'quantity' => 2, 'btw_rate' => 10],
            ],
        ];
    }

    public function test_same_integration_same_ref_is_idempotent(): void
    {
        $this->makeIntegration('key-vendor-1', 'VendorOnePOS');

        $first = $this->withHeader('X-API-Key', 'key-vendor-1')
            ->postJson('/api/v1/sales', $this->salePayload('SHARED-REF-001'));
        $first->assertStatus(201);

        $second = $this->withHeader('X-API-Key', 'key-vendor-1')
            ->postJson('/api/v1/sales', $this->salePayload('SHARED-REF-001'));
        // Retry returns the SAME sale (200, not a new 201).
        $second->assertStatus(200);
        $this->assertEquals($first->json('id'), $second->json('id'));

        // Exactly one sale persisted for this integration + ref.
        $this->assertEquals(1, Sale::where('external_sale_ref', 'SHARED-REF-001')->count());
    }

    public function test_two_integrations_same_ref_same_store_do_not_collide(): void
    {
        $int1 = $this->makeIntegration('key-vendor-1', 'VendorOnePOS');
        $int2 = $this->makeIntegration('key-vendor-2', 'VendorTwoPOS');

        $r1 = $this->withHeader('X-API-Key', 'key-vendor-1')
            ->postJson('/api/v1/sales', $this->salePayload('SHARED-REF-001'));
        $r1->assertStatus(201);

        // Second vendor, SAME ref, SAME store — must create its OWN distinct sale,
        // NOT return vendor 1's sale.
        $r2 = $this->withHeader('X-API-Key', 'key-vendor-2')
            ->postJson('/api/v1/sales', $this->salePayload('SHARED-REF-001'));
        $r2->assertStatus(201);

        $this->assertNotEquals($r1->json('id'), $r2->json('id'));

        // Two distinct sales, correctly attributed to their originating integrations.
        $this->assertEquals(2, Sale::where('external_sale_ref', 'SHARED-REF-001')->count());
        $this->assertEquals($int1->id, Sale::find($r1->json('id'))->api_integration_id);
        $this->assertEquals($int2->id, Sale::find($r2->json('id'))->api_integration_id);
    }
}
