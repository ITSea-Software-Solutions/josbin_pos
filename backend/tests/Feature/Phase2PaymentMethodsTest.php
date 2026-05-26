<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 2 (task #78) — bank_transfer / mobile_transfer / foreign_cash.
 */
class Phase2PaymentMethodsTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;
    private User $cashier;
    private User $oa;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Phase2 Org', 'type' => 'retail',
            'btw_number' => 'BTW-SR-P2', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'P2 Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);
        $register = Register::create([
            'store_id' => $this->store->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);

        $this->cashier = User::create([
            'name' => 'Cash', 'email' => 'p2-cash@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $org->id,
            'store_id' => $this->store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);

        $this->oa = User::create([
            'name' => 'OA', 'email' => 'p2-oa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        RegisterSession::create([
            'register_id' => $register->id, 'store_id' => $this->store->id,
            'cashier_id' => $this->cashier->id, 'opening_float' => '100.00',
            'status' => 'open', 'opened_at' => now(),
        ]);

        DailyRate::firstOrCreate(
            ['date' => \Illuminate\Support\Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );

        $category = Category::create([
            'organisation_id' => $org->id, 'name_nl' => 'T', 'name_en' => 'T',
            'is_active' => true, 'sort_order' => 1,
        ]);
        $this->product = Product::create([
            'organisation_id' => $org->id, 'category_id' => $category->id,
            'name_nl' => 'Item', 'name_en' => 'Item',
            'barcode' => '8990000000001', 'price' => '50.00',
            'btw_rate' => '10', 'btw_exempt' => false,
            'stock_qty' => 100, 'is_active' => true,
        ]);
    }

    private function basePayload(string $method, array $extra = []): array
    {
        return array_merge([
            'store_id'       => $this->store->id,
            'payment_method' => $method,
            'items'          => [[
                'product_id'   => $this->product->id,
                'product_name' => 'Item',
                'unit_price'   => '50.00',
                'quantity'     => 1,
                'btw_rate'     => 10,
                'btw_exempt'   => false,
            ]],
        ], $extra);
    }

    // ── bank_transfer ────────────────────────────────────────────────────────

    public function test_bank_transfer_requires_provider_and_reference(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('bank_transfer'));
        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors(['payment_provider']);
    }

    public function test_bank_transfer_persists_and_starts_unconfirmed(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('bank_transfer', [
                'payment_provider'    => 'DSB',
                'payment_reference'   => 'REF-2026-05-26-001',
                'payment_sender_name' => 'Ministerie van Financiën',
            ]));
        $resp->assertCreated();
        $resp->assertJsonPath('data.payment_method', 'bank_transfer');
        $resp->assertJsonPath('data.payment_provider', 'DSB');
        $resp->assertJsonPath('data.payment_reference', 'REF-2026-05-26-001');
        $resp->assertJsonPath('data.payment_confirmed_at', null);
    }

    // ── mobile_transfer ─────────────────────────────────────────────────────

    public function test_mobile_transfer_persists(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('mobile_transfer', [
                'payment_provider'  => 'DSB Mobiel',
                'payment_reference' => 'TX-99887766',
            ]));
        $resp->assertCreated();
        $resp->assertJsonPath('data.payment_method', 'mobile_transfer');
        $resp->assertJsonPath('data.payment_provider', 'DSB Mobiel');
    }

    // ── foreign_cash ────────────────────────────────────────────────────────

    public function test_foreign_cash_requires_currency_and_amount(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('foreign_cash', [
                'foreign_currency' => 'USD',
                // amount missing
            ]));
        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors(['foreign_currency']);
    }

    public function test_foreign_cash_locks_todays_rate(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('foreign_cash', [
                'foreign_currency' => 'USD',
                'foreign_amount'   => '10.00',
            ]));
        $resp->assertCreated();
        $resp->assertJsonPath('data.foreign_currency', 'USD');
        $resp->assertJsonPath('data.foreign_amount', '10.00');
        $resp->assertJsonPath('data.foreign_rate_used', '37.5000');
    }

    public function test_foreign_cash_only_accepts_USD_or_EUR(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/sales', $this->basePayload('foreign_cash', [
                'foreign_currency' => 'GBP',
                'foreign_amount'   => '10.00',
            ]));
        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors(['foreign_currency']);
    }

    // ── pending payments queue + confirm flow ───────────────────────────────

    public function test_pending_queue_includes_unconfirmed_transfers_only(): void
    {
        // One bank_transfer (unconfirmed) + one cash sale (shouldn't appear).
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('bank_transfer', [
            'payment_provider' => 'Hakrinbank', 'payment_reference' => 'XYZ',
        ]))->assertCreated();
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('cash', [
            'cash_tendered' => '50.00',
        ]))->assertCreated();

        $queue = $this->actingAs($this->oa, 'sanctum')->getJson('/api/sales/pending-payments');
        $queue->assertOk();
        $methods = collect($queue->json('data'))->pluck('payment_method')->unique()->values();
        $this->assertEquals(['bank_transfer'], $methods->toArray());
    }

    public function test_oa_can_confirm_a_pending_transfer(): void
    {
        $created = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('bank_transfer', [
            'payment_provider' => 'DSB', 'payment_reference' => 'REF',
        ]));
        $id = $created->json('data.id');

        $confirm = $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/sales/{$id}/confirm-payment", ['note' => 'Verified against bank statement.']);
        $confirm->assertOk();
        $this->assertNotNull($confirm->json('data.payment_confirmed_at'));

        // Audit log written
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'sale.payment_confirmed',
            'auditable_id' => $id,
        ]);

        // Queue no longer shows it
        $queue = $this->actingAs($this->oa, 'sanctum')->getJson('/api/sales/pending-payments');
        $queue->assertOk();
        $this->assertEmpty($queue->json('data'));
    }

    public function test_confirming_twice_returns_409(): void
    {
        $id = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('bank_transfer', [
            'payment_provider' => 'DSB', 'payment_reference' => 'REF',
        ]))->json('data.id');

        $this->actingAs($this->oa, 'sanctum')->postJson("/api/sales/{$id}/confirm-payment")->assertOk();
        $second = $this->actingAs($this->oa, 'sanctum')->postJson("/api/sales/{$id}/confirm-payment");
        $second->assertStatus(409);
        $second->assertJsonPath('code', 'ALREADY_CONFIRMED');
    }

    public function test_cashier_cannot_confirm_payment(): void
    {
        $id = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('bank_transfer', [
            'payment_provider' => 'DSB', 'payment_reference' => 'REF',
        ]))->json('data.id');

        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson("/api/sales/{$id}/confirm-payment");
        $resp->assertForbidden();
    }

    public function test_confirming_a_cash_sale_is_rejected(): void
    {
        $id = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->basePayload('cash', [
            'cash_tendered' => '50.00',
        ]))->json('data.id');

        $resp = $this->actingAs($this->oa, 'sanctum')->postJson("/api/sales/{$id}/confirm-payment");
        $resp->assertStatus(422);
        $resp->assertJsonPath('code', 'CONFIRM_NOT_APPLICABLE');
    }
}
