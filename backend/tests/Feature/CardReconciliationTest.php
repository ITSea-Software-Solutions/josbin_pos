<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Phase 1 of payment-method improvements (task #77).
 *
 * Covers the card reconciliation fields on `sales`:
 *   - all four fields accepted on POST /api/sales
 *   - all four optional — sale saves without them
 *   - card_last_four enforces 4-digit numeric
 *   - reconciliation fields ignored / nulled on cash-only sales
 *   - persisted correctly + queryable
 */
class CardReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;
    private User $cashier;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Recon Test Org', 'type' => 'retail',
            'btw_number' => 'BTW-SR-RECON', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'Recon Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);
        $register = Register::create([
            'store_id' => $this->store->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);

        $this->cashier = User::create([
            'name' => 'Cash', 'email' => 'recon-cash@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $org->id,
            'store_id' => $this->store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);

        RegisterSession::create([
            'register_id' => $register->id, 'store_id' => $this->store->id,
            'cashier_id' => $this->cashier->id, 'opening_float' => '100.00',
            'status' => 'open', 'opened_at' => now(),
        ]);

        // Today's daily rate (sales require one)
        DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );

        $category = Category::create([
            'organisation_id' => $org->id, 'name_nl' => 'Test', 'name_en' => 'Test',
            'is_active' => true, 'sort_order' => 1,
        ]);
        $this->product = Product::create([
            'organisation_id' => $org->id, 'category_id' => $category->id,
            'name_nl' => 'Test Item', 'name_en' => 'Test Item',
            'barcode' => '9990000000001', 'price' => '10.00',
            'btw_rate' => '10', 'btw_exempt' => false,
            'stock_qty' => 100, 'is_active' => true,
        ]);
    }

    private function salePayload(string $method, array $extra = []): array
    {
        return array_merge([
            'store_id'       => $this->store->id,
            'payment_method' => $method,
            'items'          => [[
                'product_id'   => $this->product->id,
                'product_name' => 'Test Item',
                'unit_price'   => '10.00',
                'quantity'     => 1,
                'btw_rate'     => 10,
                'btw_exempt'   => false,
            ]],
        ], $extra);
    }

    public function test_card_sale_persists_all_reconciliation_fields(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('card', [
                'card_amount'        => '10.00',
                'card_bank'          => 'DSB',
                'card_approval_code' => 'A12345',
                'card_terminal_ref'  => 'TRM-2026-05-26-001',
                'card_last_four'     => '4242',
            ]));

        $response->assertCreated();
        $response->assertJsonPath('data.card_bank', 'DSB');
        $response->assertJsonPath('data.card_approval_code', 'A12345');
        $response->assertJsonPath('data.card_terminal_ref', 'TRM-2026-05-26-001');
        $response->assertJsonPath('data.card_last_four', '4242');

        $this->assertDatabaseHas('sales', [
            'card_bank'          => 'DSB',
            'card_approval_code' => 'A12345',
            'card_last_four'     => '4242',
        ]);
    }

    public function test_card_sale_without_reconciliation_still_completes(): void
    {
        // All four reconciliation fields skipped — sale should still save.
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('card', [
                'card_amount' => '10.00',
            ]));

        $response->assertCreated();
        $response->assertJsonPath('data.card_bank', null);
        $response->assertJsonPath('data.card_approval_code', null);
        $response->assertJsonPath('data.card_last_four', null);
    }

    public function test_card_last_four_must_be_4_digits(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('card', [
                'card_amount'    => '10.00',
                'card_last_four' => '12',   // too short
            ]));
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['card_last_four']);

        $response2 = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('card', [
                'card_amount'    => '10.00',
                'card_last_four' => 'ABCD',  // non-numeric
            ]));
        $response2->assertStatus(422);
        $response2->assertJsonValidationErrors(['card_last_four']);
    }

    public function test_reconciliation_fields_nulled_on_cash_sale_even_if_sent(): void
    {
        // A misbehaving integrator sends bank metadata on a cash sale —
        // controller silently nulls it (vs rejecting) so the API stays
        // permissive but the DB row never carries misleading info.
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('cash', [
                'cash_tendered'      => '20.00',
                'card_bank'          => 'DSB',   // should be ignored
                'card_approval_code' => 'A1',    // should be ignored
            ]));

        $response->assertCreated();
        $response->assertJsonPath('data.card_bank', null);
        $response->assertJsonPath('data.card_approval_code', null);
        $response->assertJsonPath('data.payment_method', 'cash');
    }

    public function test_mixed_sale_persists_reconciliation_for_card_portion(): void
    {
        // Mixed = part cash + part card. Bank fields apply to the card portion.
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->salePayload('mixed', [
                'cash_tendered'      => '3.00',
                'card_amount'        => '7.00',
                'card_bank'          => 'Hakrinbank',
                'card_approval_code' => 'H99887',
                'card_last_four'     => '0001',
            ]));

        $response->assertCreated();
        $response->assertJsonPath('data.card_bank', 'Hakrinbank');
        $response->assertJsonPath('data.card_approval_code', 'H99887');
        $response->assertJsonPath('data.card_last_four', '0001');
    }
}
