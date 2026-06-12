<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\ProductVariant;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use App\Services\StockMovementService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * CR-1 — variant lines must never double-decrement stock.
 *
 * A product with variants tracks its stock on the VARIANT row (org-wide in v1);
 * the parent product_stocks row must stay untouched for that line. Previously a
 * variant sale decremented BOTH the variant row (SaleController) AND the parent
 * product_stocks (StockMovementService::recordSale) — the same physical unit
 * counted twice. Void / refund must mirror the asymmetry: restore the variant
 * row, never the parent product_stocks.
 */
class SalesVariantFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Product $product;
    private ProductVariant $variant;

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

        $this->product = Product::where('organisation_id', $org->id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();

        $this->variant = ProductVariant::create([
            'organisation_id'     => $org->id,
            'product_id'          => $this->product->id,
            'sku'                 => 'VAR-1KG',
            'name_nl'             => '1kg',
            'name_en'             => '1kg',
            'sort_order'          => 1,
            'price'               => '11.00',
            'cost_price'          => '6.00',
            'stock_qty'           => '20.000',
            'low_stock_threshold' => '0.000',
            'is_active'           => true,
        ]);

        // Known per-store baseline for the parent so we can prove it never moves.
        ProductStock::create([
            'product_id'          => $this->product->id,
            'store_id'            => $this->store->id,
            'stock_qty'           => '50.000',
            'low_stock_threshold' => '0.000',
        ]);

        DailyRate::create([
            'date' => today()->toDateString(), 'usd_to_srd' => '38.5000',
            'raw_rate' => '37.5000', 'markup_pct' => '2.50', 'source' => 'manual',
            'locked_by' => $this->cashier->id, 'locked_at' => now(),
        ]);
    }

    private function sellVariant(float $qty = 3): Sale
    {
        $res = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'cash_tendered'  => 100.00,
            'items'          => [[
                'product_id'   => $this->product->id,
                'variant_id'   => $this->variant->id,
                'product_name' => $this->product->name_nl,
                'variant_name' => $this->variant->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => $qty,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ]);
        $res->assertStatus(201);

        return Sale::findOrFail($res->json('data.id'));
    }

    private function parentStock(): string
    {
        return (string) ProductStock::where('product_id', $this->product->id)
            ->where('store_id', $this->store->id)->value('stock_qty');
    }

    public function test_variant_sale_decrements_only_the_variant_not_the_parent(): void
    {
        $this->sellVariant(3);

        // Variant row dropped by 3; parent product_stocks untouched (no double-count).
        $this->assertSame('17.000', (string) $this->variant->fresh()->stock_qty);
        $this->assertSame('50.000', $this->parentStock());

        // Variant lines write no parent stock-movement ledger row (symmetric with
        // the decrement side — variant stock has no per-store ledger in v1).
        $this->assertDatabaseMissing('stock_movements', [
            'product_id' => $this->product->id,
            'store_id'   => $this->store->id,
            'reason'     => 'sale',
        ]);
    }

    public function test_void_restores_the_variant_and_leaves_the_parent_alone(): void
    {
        $sale = $this->sellVariant(3);
        $this->assertSame('17.000', (string) $this->variant->fresh()->stock_qty);

        // The void path runs through the same service the job calls.
        app(StockMovementService::class)->recordVoidOrRefund($sale, 'void', $this->cashier->id);

        $this->assertSame('20.000', (string) $this->variant->fresh()->stock_qty);
        $this->assertSame('50.000', $this->parentStock());
    }

    public function test_refund_carries_variant_id_so_stock_routes_back_to_the_variant(): void
    {
        $sale = $this->sellVariant(3);
        $saleItem = $sale->items()->firstOrFail();

        $res = $this->actingAs($this->manager, 'sanctum')->postJson("/api/sales/{$sale->id}/refund", [
            'reason' => 'Klant retour — verkeerde maat',
            'items'  => [[
                'sale_item_id' => $saleItem->id,
                'quantity'     => 3,
            ]],
        ]);
        $res->assertStatus(201);

        // The refund line must carry the variant attribution forward, so the
        // (async) restore job routes the quantity back to the variant row.
        $refundSale = Sale::findOrFail($res->json('data.id'));
        $refundItem = $refundSale->items()->firstOrFail();
        $this->assertSame($this->variant->id, $refundItem->variant_id);
        $this->assertSame('1kg', $refundItem->variant_name_snapshot);

        // And running that restore brings the variant back without touching the parent.
        app(StockMovementService::class)->recordVoidOrRefund($refundSale, 'refund', $this->cashier->id);
        $this->assertSame('20.000', (string) $this->variant->fresh()->stock_qty);
        $this->assertSame('50.000', $this->parentStock());
    }
}
