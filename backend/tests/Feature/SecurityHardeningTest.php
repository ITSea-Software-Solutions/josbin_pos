<?php

namespace Tests\Feature;

use App\Models\ApiIntegration;
use App\Models\Category;
use App\Models\DailyRate;
use App\Models\Customer;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Security-hardening regressions (audit batch 3):
 *   - P0-6  customer_id from another org is rejected on sale create
 *   - P1-S1 webhook_secret encrypted at rest, decrypts transparently
 */
class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $orgA;
    private Organisation $orgB;
    private Store $storeA;
    private User $cashierA;
    private Customer $customerB;
    private Product $productA;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->orgA = Organisation::create([
            'name' => 'Org A', 'type' => 'retail', 'btw_number' => 'SR-A',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $this->orgB = Organisation::create([
            'name' => 'Org B', 'type' => 'retail', 'btw_number' => 'SR-B',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        $this->storeA = Store::create([
            'organisation_id' => $this->orgA->id, 'name' => 'A-Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );

        $this->cashierA = User::create([
            'name' => 'Cashier A', 'email' => 'ca@a.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->orgA->id, 'store_id' => $this->storeA->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashierA->assignRole(User::ROLE_CASHIER);

        // A customer that belongs to Org B — must NOT be attachable by Org A.
        $this->customerB = Customer::create([
            'organisation_id' => $this->orgB->id,
            'name' => 'Geheim Klant B', 'phone' => '+597000000', 'email' => 'b@b.sr',
        ]);

        $cat = Category::create([
            'organisation_id' => $this->orgA->id, 'name_nl' => 'Cat', 'name_en' => 'Cat', 'is_active' => true,
        ]);
        $this->productA = Product::create([
            'organisation_id' => $this->orgA->id, 'category_id' => $cat->id,
            'name_nl' => 'Brood', 'name_en' => 'Bread', 'price' => '10.00',
            'btw_rate' => '10.00', 'btw_exempt' => false, 'stock_qty' => 100, 'is_active' => true,
        ]);

        $register = Register::create(['store_id' => $this->storeA->id, 'number' => 1, 'name' => 'K1', 'is_active' => true]);
        RegisterSession::create([
            'register_id' => $register->id, 'store_id' => $this->storeA->id,
            'cashier_id' => $this->cashierA->id, 'opening_float_srd' => 0, 'opened_at' => now(),
        ]);
    }

    private function salePayload(?string $customerId): array
    {
        return [
            'store_id'       => $this->storeA->id,
            'customer_id'    => $customerId,
            'payment_method' => 'cash',
            'cash_tendered'  => '11.00',
            'items'          => [[
                'product_id'   => $this->productA->id,
                'product_name' => 'Brood',
                'unit_price'   => '10.00',
                'quantity'     => '1',
                'btw_rate'     => '10.00',
                'btw_exempt'   => false,
            ]],
        ];
    }

    public function test_cannot_attach_customer_from_another_org(): void
    {
        $resp = $this->actingAs($this->cashierA, 'sanctum')
            ->postJson('/api/sales', $this->salePayload($this->customerB->id));

        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors('customer_id');
        // And no sale leaked through.
        $this->assertDatabaseCount('sales', 0);
    }

    public function test_can_attach_customer_from_own_org(): void
    {
        $ownCustomer = Customer::create([
            'organisation_id' => $this->orgA->id, 'name' => 'Klant A', 'phone' => '+597111',
        ]);

        $this->actingAs($this->cashierA, 'sanctum')
            ->postJson('/api/sales', $this->salePayload($ownCustomer->id))
            ->assertStatus(201);
    }

    public function test_receipt_pdf_refuses_broad_token_in_query_string(): void
    {
        // Build a sale directly so no actingAs/Bearer auth state lingers and
        // the ?token= path is exercised in true isolation.
        $sale = \App\Models\Sale::create([
            'store_id' => $this->storeA->id, 'cashier_id' => $this->cashierA->id,
            'sale_number' => 'TST-RCPT-1',
            'subtotal_srd' => '9.09', 'discount_srd' => '0.00',
            'btw_srd' => '0.91', 'total_srd' => '10.00',
            'payment_method' => 'cash', 'cash_received_srd' => '10.00', 'change_srd' => '0.00',
            'status' => 'completed', 'source' => 'pos',
            'exchange_rate_used' => '37.50', 'occurred_at' => now(),
        ]);
        \App\Models\SaleItem::create([
            'sale_id' => $sale->id, 'product_id' => $this->productA->id,
            'product_name_snapshot' => 'Brood', 'unit_price_srd' => '10.00',
            'quantity' => '1', 'discount_srd' => '0.00', 'discount_pct' => '0.00',
            'btw_rate' => '10.00', 'btw_exempt' => false,
            'btw_srd' => '0.91', 'line_total_srd' => '10.00',
        ]);

        // A full/wildcard token in the URL query string is refused — it would
        // otherwise leak into access logs, history and Referer headers. With no
        // valid auth, authorize('view') rejects → 403.
        $broad = $this->cashierA->createToken('session', ['*'])->plainTextToken;
        $this->getJson("/api/sales/{$sale->id}/receipt/pdf?token={$broad}")
            ->assertStatus(403);

        // The SAME token via the Authorization header still works (it doesn't
        // travel in the URL) — the in-app PDF view depends on this.
        $this->withHeader('Authorization', "Bearer {$broad}")
            ->get("/api/sales/{$sale->id}/receipt/pdf")
            ->assertOk();
    }

    // ─── P1-S7: 2FA middleware actually enforced on requests ────────────────

    public function test_super_admin_token_without_2fa_verified_is_blocked(): void
    {
        $sa = User::create([
            'name' => 'SA', 'email' => 'sa@x.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->orgA->id, 'role' => User::ROLE_SUPER_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $sa->assignRole(User::ROLE_SUPER_ADMIN);

        $url = '/api/products/pos?store_id=' . $this->storeA->id;

        // Full wildcard token, but NO literal 2fa_verified ability — this is
        // exactly the gap P1-S7 closes: a stolen full token that skipped the
        // 2FA challenge must NOT be honoured. The middleware rejects before the
        // controller runs.
        $token = $sa->createToken('t', ['*'])->plainTextToken;
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson($url)
            ->assertStatus(403)
            ->assertJsonPath('code', 'TWO_FACTOR_REQUIRED');

        // The positive path — a 2fa_verified SA token clearing the middleware
        // and reaching a controller — is proven by
        // test_reset2fa_blocks_mandatory_2fa_roles (which reaches the
        // reset-2fa controller's MANDATORY_2FA branch with exactly such a token).
    }

    public function test_non_2fa_user_passes_through_middleware(): void
    {
        // Cashier in a non-government org doesn't require 2FA → never blocked.
        $token = $this->cashierA->createToken('t', ['*'])->plainTextToken;
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/products/pos?store_id=' . $this->storeA->id)
            ->assertOk();
    }

    // ─── P1-S3: reset-2fa step-up + mandatory-role block ────────────────────

    public function test_reset2fa_requires_actor_password(): void
    {
        [$oa, $target] = $this->makeOaAndCashier();

        // No password → 422 validation.
        $this->actingAs($oa, 'sanctum')
            ->postJson("/api/users/{$target->id}/reset-2fa", [])
            ->assertStatus(422);

        // Wrong password → 422 WRONG_PASSWORD.
        $this->actingAs($oa, 'sanctum')
            ->postJson("/api/users/{$target->id}/reset-2fa", ['current_password' => 'nope'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'WRONG_PASSWORD');
    }

    public function test_reset2fa_blocks_mandatory_2fa_roles(): void
    {
        // Actor must be able to authorize('update') the target, so use a
        // super_admin actor (who can manage anyone) resetting another SA.
        $actor = User::create([
            'name' => 'SA-actor', 'email' => 'sa-actor@x.sr', 'password' => bcrypt('SApw1234'),
            'organisation_id' => $this->orgA->id, 'role' => User::ROLE_SUPER_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $actor->assignRole(User::ROLE_SUPER_ADMIN);

        $target = User::create([
            'name' => 'SA-target', 'email' => 'sa-target@x.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->orgA->id, 'role' => User::ROLE_SUPER_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $target->assignRole(User::ROLE_SUPER_ADMIN);

        // Real token WITH 2fa_verified so the SA actor clears the 2FA gate.
        $token = $actor->createToken('t', ['*', '2fa_verified'])->plainTextToken;
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson("/api/users/{$target->id}/reset-2fa", ['current_password' => 'SApw1234'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'MANDATORY_2FA');
    }

    public function test_reset2fa_succeeds_with_password_and_audits(): void
    {
        [$oa, $target] = $this->makeOaAndCashier();

        $this->actingAs($oa, 'sanctum')
            ->postJson("/api/users/{$target->id}/reset-2fa", ['current_password' => 'OApw1234'])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'event'        => 'user.two_factor_reset',
            'auditable_id' => $target->id,
        ]);
    }

    /** @return array{0: User, 1: User} OA actor + a cashier target in org A. */
    private function makeOaAndCashier(): array
    {
        $oa = User::create([
            'name' => 'OA', 'email' => 'oa-sec@x.sr', 'password' => bcrypt('OApw1234'),
            'organisation_id' => $this->orgA->id, 'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $target = User::create([
            'name' => 'Target', 'email' => 'target@x.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->orgA->id, 'store_id' => $this->storeA->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $target->assignRole(User::ROLE_CASHIER);

        return [$oa, $target];
    }

    public function test_webhook_secret_is_encrypted_at_rest(): void
    {
        $integration = ApiIntegration::create([
            'store_id'    => $this->storeA->id,
            'pos_system'  => 'TestPOS',
            'api_key_hash'=> hash('sha256', 'k'),
            'webhook_url' => 'https://example.test/hook',
            'webhook_events' => ['sale.created'],
            'webhook_secret' => 'plain-secret-value-123',
            'is_active'   => true,
        ]);

        // Raw column is ciphertext, not the plaintext.
        $raw = DB::table('api_integrations')->where('id', $integration->id)->value('webhook_secret');
        $this->assertNotEquals('plain-secret-value-123', $raw);
        // But it decrypts back to the original (used for HMAC signing).
        $this->assertEquals('plain-secret-value-123', Crypt::decryptString($raw));
        // And the model accessor returns the plaintext transparently.
        $this->assertEquals('plain-secret-value-123', $integration->fresh()->webhook_secret);
    }
}
