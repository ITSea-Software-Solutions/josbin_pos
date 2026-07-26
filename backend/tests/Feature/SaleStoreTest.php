<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * POST /api/sales — happy path, idempotency, validation, cross-org isolation,
 * and per-store stock decrement (via the RecordStockMovements job).
 *
 * Auth: Sanctum personal access tokens — actingAs($user, 'sanctum').
 * Async jobs and broadcast events are faked so the assertions test ONLY the
 * controller's contract (status code, body shape, DB writes) — not Reverb,
 * not Redis, not OpenAI.
 */
class SaleStoreTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Organisation $org;
    private Product $rice;      // BTW-exempt staple
    private Product $cola;      // 10% BTW

    protected function setUp(): void
    {
        parent::setUp();

        // Stop async broadcasts and queued jobs from running for real
        Event::fake();
        Bus::fake();

        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->org     = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $this->org->id)->firstOrFail();

        // Pick two seeded products: one exempt (rice), one taxed (cola)
        $this->rice = Product::where('organisation_id', $this->org->id)
            ->where('btw_exempt', true)->orderBy('name_nl')->firstOrFail();
        $this->cola = Product::where('organisation_id', $this->org->id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();

        // Sales require today's locked exchange rate — without it the controller
        // short-circuits to 422 NO_DAILY_RATE before any business logic runs.
        DailyRate::create([
            'date'        => today()->toDateString(),
            'usd_to_srd'  => '38.5000',
            'raw_rate'    => '37.5000',
            'markup_pct'  => '2.50',
            'source'      => 'manual',
            'locked_by'   => $this->manager->id,
            'locked_at'   => now(),
        ]);
    }

    // ─── Happy path ──────────────────────────────────────────────────────────

    public function test_cashier_can_create_a_completed_sale(): void
    {
        $payload = [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 50.00,
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ];

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('data.store_id', $this->store->id);
        $response->assertJsonPath('data.status', 'completed');
        $response->assertJsonPath('data.payment_method', 'cash');
        $response->assertJsonPath('data.total_srd', '11.00');
        $response->assertJsonPath('data.btw_srd', '1.00');
        $response->assertJsonPath('data.subtotal_srd', '11.00');
        $response->assertJsonPath('data.change_srd', '39.00'); // 50.00 − 11.00

        // Sale row + sale_item row persisted
        $this->assertDatabaseCount('sales', 1);
        $this->assertDatabaseCount('sale_items', 1);

        $sale = Sale::first();
        $this->assertSame($this->cashier->id, $sale->cashier_id);
        $this->assertSame('11.00', (string) $sale->total_srd);
        $this->assertSame('1.00',  (string) $sale->btw_srd);
        $this->assertNotNull($sale->sale_number);
        $this->assertStringStartsWith('POS-', $sale->sale_number);
    }

    public function test_receipt_html_endpoint_renders_the_receipt(): void
    {
        // Create a sale, then fetch its receipt as HTML (the POS browser-print
        // path). Must be a real HTML document carrying the sale's data — the
        // PDF-blob print was rendering blank, the HTML path is the fix.
        $created = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 50.00,
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ])->assertStatus(201);

        $saleId = $created->json('data.id');
        $saleNumber = $created->json('data.sale_number');

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->get("/api/sales/{$saleId}/receipt/html?locale=nl&cash_tendered=50&change=39");

        $res->assertOk();
        $this->assertStringContainsString('text/html', $res->headers->get('Content-Type'));
        $res->assertSee('<!DOCTYPE html>', false);
        $res->assertSee($saleNumber, false);   // the receipt carries real data
        $res->assertSee('Totaal', false);      // not a blank document
    }

    public function test_mixed_cart_btw_total_matches_btw_engine(): void
    {
        // 2× Cola (taxed) + 3× Rice (exempt) — only Cola contributes BTW
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 200.00,
            'items'          => [
                [
                    'product_id'   => $this->cola->id,
                    'product_name' => $this->cola->name_nl,
                    'unit_price'   => '11.00',
                    'quantity'     => 2,
                    'btw_rate'     => '10',
                    'btw_exempt'   => false,
                ],
                [
                    'product_id'   => $this->rice->id,
                    'product_name' => $this->rice->name_nl,
                    'unit_price'   => '20.00',
                    'quantity'     => 3,
                    'btw_rate'     => '0',
                    'btw_exempt'   => true,
                ],
            ],
        ]);

        $response->assertStatus(201);

        // BTW only on the 2× Cola: 22 - 22/1.10 = 2.00. Rice exempt = 0.
        $response->assertJsonPath('data.btw_srd', '2.00');
        $response->assertJsonPath('data.subtotal_srd', '82.00'); // 22 + 60
        $response->assertJsonPath('data.total_srd', '82.00');
    }

    // ─── Idempotency via external_sale_ref ───────────────────────────────────

    public function test_repeating_same_external_sale_ref_returns_existing_sale(): void
    {
        $payload = [
            'store_id'          => $this->store->id,
            'payment_method'    => 'cash',
            'cash_tendered'     => 20.00,
            'external_sale_ref' => 'ext-pos-2026-0001',
            'source'            => 'api',
            'items' => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ];

        $first = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $payload);
        $first->assertStatus(201);
        $firstId = $first->json('data.id');

        // Second POST with the SAME external_sale_ref must NOT create a new sale
        $second = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $payload);
        $second->assertStatus(200); // existing record returned, not 201
        $this->assertSame($firstId, $second->json('data.id'));

        // Only one sale persisted
        $this->assertDatabaseCount('sales', 1);
    }

    // ─── Validation (422) ────────────────────────────────────────────────────

    public function test_missing_items_returns_422(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            // no items
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
    }

    public function test_invalid_payment_method_returns_422(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'crypto', // not in [cash, card, mixed]
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
            ]],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['payment_method']);
    }

    public function test_negative_unit_price_returns_422(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '-5.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
            ]],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items.0.unit_price']);
    }

    public function test_btw_rate_over_100_returns_422(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '10.00',
                'quantity'     => 1,
                'btw_rate'     => '150',
            ]],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items.0.btw_rate']);
    }

    // ─── Cross-org store isolation (StoreBelongsToOrg rule) ──────────────────

    public function test_cashier_cannot_post_sale_against_another_orgs_store(): void
    {
        // Create a second organisation + store the seeded cashier does NOT belong to
        $otherOrg = Organisation::create([
            'name'              => 'Concurrent Supermarkt',
            'type'              => 'retail',
            'btw_number'        => 'BTW-SR-999999',
            'currency'          => 'SRD',
            'locale'            => 'nl',
            'is_government'     => false,
            'subscription_tier' => 'standard',
        ]);
        $otherStore = Store::create([
            'organisation_id'  => $otherOrg->id,
            'name'             => 'Other Store',
            'address'          => 'Elsewhere',
            'city'             => 'Nickerie',
            'default_btw_rate' => 10.00,
            'is_active'        => true,
            'pos_type'         => 'native',
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $otherStore->id,
            'payment_method' => 'cash',
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
            ]],
        ]);

        // StoreBelongsToOrg returns a 422 with a store_id validation error message.
        // (Laravel's validator turns failed Rule objects into 422 responses; the
        // task brief calls this "403 for cross-org store_id" — same effect: the
        // call is rejected with a validation error pointing at store_id rather
        // than letting the cashier reach another org's store.)
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['store_id']);

        // Nothing persisted
        $this->assertDatabaseCount('sales', 0);
    }

    // ─── Auth required ───────────────────────────────────────────────────────

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 1,
                'btw_rate'     => '10',
            ]],
        ]);

        $response->assertStatus(401);
    }

    // ─── Stock decrement happens IN the sale transaction ─────────────────────

    public function test_sale_decrements_per_store_stock(): void
    {
        // Seeders create products but the product_stocks backfill in the
        // initial migration runs BEFORE any products exist (migration order),
        // so there are no rows yet. StockMovementService::record auto-creates
        // a per-store row on first sale using the product's default stock_qty
        // — seed a row here explicitly so we can assert against a known value.
        ProductStock::create([
            'product_id'          => $this->cola->id,
            'store_id'            => $this->store->id,
            'stock_qty'           => '50.000',
            'low_stock_threshold' => '0.000',
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 25.00,
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 2,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ]);

        $response->assertStatus(201);

        // Stock is now decremented INSIDE the sale transaction — no queued job,
        // no manual replay. A queue outage can no longer leave a committed sale
        // with un-decremented stock. The 'sale' reason is NOT dispatched async
        // anymore (void/refund still are).
        Bus::assertNotDispatched(\App\Jobs\RecordStockMovements::class);

        $after = ProductStock::where('product_id', $this->cola->id)
            ->where('store_id', $this->store->id)
            ->firstOrFail();

        // Started at 50.000, sold 2 → 48.000 (no double-count)
        $this->assertSame('48.000', (string) $after->stock_qty);

        // The movement ledger row was written too, in the same transaction.
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->cola->id,
            'store_id'   => $this->store->id,
            'reason'     => 'sale',
            'qty_change' => '-2.000',
        ]);
    }

    // ─── Sale-level BTW exemption (vrijstelling) ─────────────────────────────

    private function exemptPayload(array $overrides = []): array
    {
        return array_merge([
            'store_id'          => $this->store->id,
            'payment_method'    => 'cash',
            'cash_tendered'     => 50.00,
            'btw_exempt'        => true,
            'btw_exempt_reason' => 'Ministerie van Financiën — vrijstelling overheidsinkoop',
            'items'             => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 2,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ], $overrides);
    }

    public function test_exempt_sale_charges_net_price_and_zero_btw(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->exemptPayload());

        // 2 × 11.00 inclusive @10% → 2 × 10.00 net. The buyer does not pay the tax.
        $response->assertStatus(201)
            ->assertJsonPath('data.total_srd', '20.00')
            ->assertJsonPath('data.btw_srd', '0.00')
            ->assertJsonPath('data.btw_exempt', true);

        $sale = Sale::first();
        $this->assertTrue((bool) $sale->btw_exempt);
        $this->assertSame('Ministerie van Financiën — vrijstelling overheidsinkoop', $sale->btw_exempt_reason);
        // The state would have received 2.00 on 22.00 inclusive at 10% —
        // stored at sale time so the exemptions report survives price changes.
        $this->assertSame('2.00', (string) $sale->btw_exempt_forgone_srd);

        // Line snapshots are zero-rate exempt — the shape reports already bucket.
        $item = $sale->items()->first();
        $this->assertTrue((bool) $item->btw_exempt);
        $this->assertSame('0.00', (string) $item->btw_rate);
        $this->assertSame('0.00', (string) $item->btw_srd);
        $this->assertSame('10.00', (string) $item->unit_price_srd);
    }

    public function test_exempt_sale_without_reason_is_rejected(): void
    {
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->exemptPayload(['btw_exempt_reason' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['btw_exempt_reason']);

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->exemptPayload(['btw_exempt_reason' => 'kort']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['btw_exempt_reason']);

        $this->assertDatabaseCount('sales', 0);
    }

    public function test_exempt_sale_works_without_org_btw_number(): void
    {
        // C6 blocks BTW-charging sales when the org has no registration
        // number — a fully exempt sale charges no BTW, so it must pass.
        $this->org->forceFill(['btw_number' => null])->save();

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->exemptPayload())
            ->assertStatus(201)
            ->assertJsonPath('data.btw_srd', '0.00');
    }

    public function test_non_exempt_sale_ignores_stray_reason(): void
    {
        $payload = $this->exemptPayload([
            'btw_exempt'        => false,
            'btw_exempt_reason' => 'should not be stored',
        ]);

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $payload)
            ->assertStatus(201)
            ->assertJsonPath('data.btw_exempt', false)
            ->assertJsonPath('data.total_srd', '22.00')
            ->assertJsonPath('data.btw_srd', '2.00');

        $this->assertNull(Sale::first()->btw_exempt_reason);
    }
}
