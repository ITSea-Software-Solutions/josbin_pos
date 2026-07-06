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
 * Phase 3 (task #79) — qr_payment scaffolding.
 */
class QrPaymentScaffoldingTest extends TestCase
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
            'name' => 'QR Org', 'type' => 'retail', 'btw_number' => 'BTW-SR-QR',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'QR Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);
        $register = Register::create([
            'store_id' => $this->store->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);
        $this->cashier = User::create([
            'name' => 'C', 'email' => 'qr-c@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $this->store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);
        $this->oa = User::create([
            'name' => 'O', 'email' => 'qr-o@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id,
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
        $cat = Category::create([
            'organisation_id' => $org->id, 'name_nl' => 'T', 'name_en' => 'T',
            'is_active' => true, 'sort_order' => 1,
        ]);
        $this->product = Product::create([
            'organisation_id' => $org->id, 'category_id' => $cat->id,
            'name_nl' => 'I', 'name_en' => 'I', 'barcode' => '7770000000001',
            'price' => '20.00', 'btw_rate' => '10', 'btw_exempt' => false,
            'stock_qty' => 100, 'is_active' => true,
        ]);
    }

    private function payload(array $extra = []): array
    {
        return array_merge([
            'store_id' => $this->store->id,
            'payment_method' => 'qr_payment',
            'items' => [[
                'product_id' => $this->product->id, 'product_name' => 'I',
                'unit_price' => '20.00', 'quantity' => 1, 'btw_rate' => 10, 'btw_exempt' => false,
            ]],
        ], $extra);
    }

    public function test_qr_payment_requires_provider(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload());
        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors(['payment_provider']);
    }

    public function test_qr_payment_persists_and_starts_pending(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_provider' => 'DSB QR',
            'payment_reference' => 'QR-2026-001',
            'qr_payload' => 'eyJwc3AiOiJEU0JfUVIiLCJyZWYiOiJRUi0yMDI2In0=',
        ]));
        $resp->assertCreated();
        $resp->assertJsonPath('data.payment_method', 'qr_payment');
        $resp->assertJsonPath('data.payment_provider', 'DSB QR');
        $resp->assertJsonPath('data.payment_confirmed_at', null);
        $resp->assertJsonPath('data.qr_payload', 'eyJwc3AiOiJEU0JfUVIiLCJyZWYiOiJRUi0yMDI2In0=');
    }

    public function test_qr_appears_in_pending_payments_queue(): void
    {
        $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_provider' => 'DSB QR', 'payment_reference' => 'QR-A',
        ]))->assertCreated();

        $queue = $this->actingAs($this->oa, 'sanctum')->getJson('/api/sales/pending-payments');
        $queue->assertOk();
        $methods = collect($queue->json('data'))->pluck('payment_method')->unique()->values();
        $this->assertContains('qr_payment', $methods->toArray());
    }

    public function test_qr_payment_confirmed_at_sale_when_cashier_attests(): void
    {
        // Mopé / Uni5Pay+ notify the merchant device instantly at the till.
        // payment_confirmed=true = cashier saw "payment received" → the sale
        // completes confirmed and skips the OA pending queue.
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_provider'  => 'Mopé',
            'payment_reference' => 'MP-2026-000123',
            'payment_confirmed' => true,
        ]));
        $resp->assertCreated();
        $resp->assertJsonPath('data.payment_method', 'qr_payment');
        $resp->assertJsonPath('data.payment_provider', 'Mopé');

        $sale = Sale::find($resp->json('data.id'));
        $this->assertNotNull($sale->payment_confirmed_at);
        $this->assertSame($this->cashier->id, $sale->payment_confirmed_by);
        $this->assertFalse($sale->isAwaitingPaymentConfirmation());

        // ...and therefore it must NOT appear in the OA pending queue.
        $queue = $this->actingAs($this->oa, 'sanctum')->getJson('/api/sales/pending-payments');
        $queue->assertOk();
        $this->assertNotContains($sale->id, collect($queue->json('data'))->pluck('id')->toArray());
    }

    public function test_payment_confirmed_flag_is_ignored_for_bank_transfer(): void
    {
        // Instant confirmation is a QR-wallet property. A bank transfer takes
        // hours/days to land, so the flag must not bypass the OA flow.
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_method'    => 'bank_transfer',
            'payment_provider'  => 'DSB',
            'payment_reference' => 'REF-1',
            'payment_confirmed' => true,
        ]));
        $resp->assertCreated();
        $sale = Sale::find($resp->json('data.id'));
        $this->assertNull($sale->payment_confirmed_at);
        $this->assertTrue($sale->isAwaitingPaymentConfirmation());
    }

    public function test_refund_is_blocked_while_payment_unconfirmed(): void
    {
        // Money must never leave the drawer for funds that were never
        // confirmed in — unconfirmed QR/transfer sales can't be refunded.
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_provider' => 'Mopé', 'payment_reference' => 'MP-R1',
        ]));
        $resp->assertCreated();
        $saleId = $resp->json('data.id');

        $refund = $this->actingAs($this->oa, 'sanctum')->postJson("/api/sales/{$saleId}/refund", [
            'reason' => 'klant retour — test',
            'items'  => [['sale_item_id' => Sale::find($saleId)->items()->first()->id, 'quantity' => 1]],
        ]);
        $refund->assertStatus(422);
    }

    public function test_refund_of_confirmed_qr_sale_does_not_reenter_pending_queue(): void
    {
        $resp = $this->actingAs($this->cashier, 'sanctum')->postJson('/api/sales', $this->payload([
            'payment_provider' => 'Mopé', 'payment_reference' => 'MP-R2', 'payment_confirmed' => true,
        ]));
        $resp->assertCreated();
        $saleId = $resp->json('data.id');

        $refund = $this->actingAs($this->oa, 'sanctum')->postJson("/api/sales/{$saleId}/refund", [
            'reason' => 'klant retour — test',
            'items'  => [['sale_item_id' => Sale::find($saleId)->items()->first()->id, 'quantity' => 1]],
        ]);
        $refund->assertCreated();

        // The negative refund row must be stamped confirmed — a refund is
        // money OUT; there is nothing for the OA to "confirm landed".
        $queue = $this->actingAs($this->oa, 'sanctum')->getJson('/api/sales/pending-payments');
        $queue->assertOk();
        $this->assertCount(0, $queue->json('data'));
    }

    public function test_webhook_is_disabled_by_default(): void
    {
        $resp = $this->postJson('/api/qr-payments/webhook', [
            'psp' => 'DSB_QR', 'reference' => 'QR-1', 'status' => 'succeeded',
        ]);
        $resp->assertStatus(503);
        $resp->assertJsonPath('code', 'QR_WEBHOOKS_DISABLED');
    }

    public function test_webhook_acks_when_enabled_via_config(): void
    {
        config(['josbin_pos.qr_webhooks_enabled' => true]);

        $resp = $this->postJson('/api/qr-payments/webhook', [
            'psp' => 'DSB_QR', 'reference' => 'QR-1', 'status' => 'succeeded',
            'amount_srd' => '20.00',
        ]);
        $resp->assertStatus(202);
        $resp->assertJsonPath('received', true);
    }
}
