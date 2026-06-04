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
 * Oversell policy — organisations.block_oversell.
 *
 *   OFF (default): a sale always completes; stock may go negative so the
 *   ledger stays honest (Σ qty_change == qty_after) and surfaces wrong counts.
 *
 *   ON: a sale that would drive stock below zero is rejected (422) and the
 *   WHOLE sale transaction rolls back — no sale row, no stock change.
 *
 * Also pins the P0-1 guarantee: stock is decremented inside the sale
 * transaction, so the assertions hold WITHOUT running any queued job.
 */
class OversellPolicyTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private Store $store;
    private Organisation $org;
    private Product $cola;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Bus::fake();

        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->org     = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $this->org->id)->firstOrFail();
        $this->cola    = Product::where('organisation_id', $this->org->id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();

        DailyRate::create([
            'date'       => today()->toDateString(),
            'usd_to_srd' => '38.5000',
            'raw_rate'   => '37.5000',
            'markup_pct' => '2.50',
            'source'     => 'manual',
            'locked_by'  => $this->cashier->id,
            'locked_at'  => now(),
        ]);
    }

    private function seedStock(string $qty): void
    {
        ProductStock::updateOrCreate(
            ['product_id' => $this->cola->id, 'store_id' => $this->store->id],
            ['stock_qty' => $qty, 'low_stock_threshold' => '0.000'],
        );
    }

    private function sellPayload(int $qty): array
    {
        return [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 1000.00,
            'items'          => [[
                'product_id'   => $this->cola->id,
                'product_name' => $this->cola->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => $qty,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ];
    }

    // ─── Default policy: allow + track negative ──────────────────────────────

    public function test_oversell_allowed_by_default_and_stock_goes_negative(): void
    {
        $this->org->update(['block_oversell' => false]);
        $this->seedStock('3.000');

        // Sell 5 when only 3 are on record
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->sellPayload(5));

        $resp->assertStatus(201);

        $stock = ProductStock::where('product_id', $this->cola->id)
            ->where('store_id', $this->store->id)->firstOrFail();

        // 3 − 5 = −2 (honest running balance, not clamped to 0)
        $this->assertSame('-2.000', (string) $stock->stock_qty);

        // Ledger consistency: qty_after on the movement equals current stock
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $this->cola->id,
            'reason'     => 'sale',
            'qty_change' => '-5.000',
            'qty_after'  => '-2.000',
        ]);
    }

    // ─── Strict policy: block + roll back ────────────────────────────────────

    public function test_oversell_blocked_when_org_opts_into_strict_mode(): void
    {
        $this->org->update(['block_oversell' => true]);
        $this->seedStock('3.000');

        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->sellPayload(5));

        $resp->assertStatus(422);
        $resp->assertJsonPath('code', 'INSUFFICIENT_STOCK');

        // Whole sale rolled back — nothing persisted
        $this->assertDatabaseCount('sales', 0);
        $this->assertDatabaseCount('sale_items', 0);

        // Stock untouched
        $stock = ProductStock::where('product_id', $this->cola->id)
            ->where('store_id', $this->store->id)->firstOrFail();
        $this->assertSame('3.000', (string) $stock->stock_qty);
    }

    public function test_strict_mode_allows_sale_up_to_available_stock(): void
    {
        $this->org->update(['block_oversell' => true]);
        $this->seedStock('5.000');

        // Sell exactly 5 — lands on zero, allowed
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->sellPayload(5));

        $resp->assertStatus(201);

        $stock = ProductStock::where('product_id', $this->cola->id)
            ->where('store_id', $this->store->id)->firstOrFail();
        $this->assertSame('0.000', (string) $stock->stock_qty);
    }
}
