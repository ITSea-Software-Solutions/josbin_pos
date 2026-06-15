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
 * POST /api/sales/blind-return — return with no original sale.
 *
 * Manager-gated (cashiers lack sales.refund). Creates a negative Sale with BTW
 * extracted from the returned lines, restores stock for catalogue goods, and
 * writes a sale.blind_return audit row.
 */
class BlindReturnTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Product $product;

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
        $this->product = Product::where('organisation_id', $org->id)->where('btw_exempt', false)->firstOrFail();

        DailyRate::firstOrCreate(['date' => today()->toDateString()], [
            'usd_to_srd' => '38.5000', 'raw_rate' => '37.5000', 'markup_pct' => '2.50',
            'source' => 'manual', 'locked_by' => $this->manager->id, 'locked_at' => now(),
        ]);
    }

    private function payload(): array
    {
        return [
            'store_id'       => $this->store->id,
            'payment_method' => 'cash',
            'reason'         => 'Klant bracht artikel terug zonder bon',
            'items'          => [[
                'product_id'   => $this->product->id,
                'product_name' => $this->product->name_nl,
                'unit_price'   => '11.00',
                'quantity'     => 2,
                'btw_rate'     => '10',
                'btw_exempt'   => false,
            ]],
        ];
    }

    public function test_cashier_cannot_blind_return(): void
    {
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales/blind-return', $this->payload())
            ->assertStatus(403);

        $this->assertDatabaseCount('sales', 0);
    }

    public function test_manager_blind_return_creates_negative_sale_with_correct_btw(): void
    {
        ProductStock::create([
            'product_id' => $this->product->id, 'store_id' => $this->store->id,
            'stock_qty' => '30.000', 'low_stock_threshold' => '0.000',
        ]);

        $res = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/sales/blind-return', $this->payload())
            ->assertStatus(201);

        // 2 × 11.00 = 22.00 returned; BTW extracted at 10% from 22.00 = 2.00.
        $res->assertJsonPath('data.total_srd', '-22.00')
            ->assertJsonPath('data.btw_srd', '-2.00')
            ->assertJsonPath('data.status', 'completed');

        $sale = Sale::findOrFail($res->json('data.id'));
        $this->assertStringStartsWith('BLIND RETURN:', $sale->void_reason);
        $this->assertSame('-2.00', (string) $sale->items()->first()->btw_srd);

        // Audited.
        $this->assertDatabaseHas('audit_logs', [
            'event'        => 'sale.blind_return',
            'auditable_id' => $sale->id,
        ]);

        // Stock restoration job dispatched (returned goods go back).
        Bus::assertDispatched(\App\Jobs\RecordStockMovements::class);
    }

    public function test_validation_rejects_empty_reason_and_zero_quantity(): void
    {
        $bad = $this->payload();
        $bad['reason'] = 'no';                 // too short
        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/sales/blind-return', $bad)
            ->assertStatus(422);

        $bad2 = $this->payload();
        $bad2['items'][0]['quantity'] = 0;
        $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/sales/blind-return', $bad2)
            ->assertStatus(422);
    }
}
