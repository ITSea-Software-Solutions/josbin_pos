<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Organisation-configurable payment pick-lists (wallets / card banks /
 * transfer banks / mobile apps). Unset or empty lists fall back to the
 * Suriname defaults in config/josbin_pos.php; overriding them is how a
 * Guyana/Trinidad deployment swaps in its own wallets without a release.
 */
class OrgPaymentOptionsTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $store;
    private User $oa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');

        $this->org = Organisation::create([
            'name' => 'PayOpt Org', 'type' => 'retail', 'btw_number' => 'SR-PAYOPT',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'PayOpt Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->oa = User::create([
            'name' => 'OA', 'email' => 'payopt-oa@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);
    }

    public function test_defaults_served_when_nothing_configured(): void
    {
        $res = $this->actingAs($this->oa, 'sanctum')->getJson("/api/stores/{$this->store->id}")->assertOk();

        $po = $res->json('data.payment_options');
        $this->assertSame(config('josbin_pos.payment_options.wallets'), $po['wallets']);
        $this->assertSame(config('josbin_pos.payment_options.card_banks'), $po['card_banks']);
    }

    public function test_oa_overrides_wallets_and_pos_payload_reflects_it(): void
    {
        $this->actingAs($this->oa, 'sanctum')->putJson("/api/organisations/{$this->org->id}", [
            'payment_options' => [
                'wallets'    => ['MMG', 'Caripay', 'Kanoo'],
                'card_banks' => ['Republic', 'GBTI', 'Demerara Bank', 'Visa', 'Mastercard'],
            ],
        ])->assertOk();

        $po = $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/stores/{$this->store->id}")->json('data.payment_options');

        $this->assertSame(['MMG', 'Caripay', 'Kanoo'], $po['wallets']);
        $this->assertSame(['Republic', 'GBTI', 'Demerara Bank', 'Visa', 'Mastercard'], $po['card_banks']);
        // Untouched keys keep the defaults.
        $this->assertSame(config('josbin_pos.payment_options.transfer_banks'), $po['transfer_banks']);
    }

    public function test_empty_list_means_defaults_and_other_is_never_stored(): void
    {
        $this->actingAs($this->oa, 'sanctum')->putJson("/api/organisations/{$this->org->id}", [
            'payment_options' => ['wallets' => ['MMG']],
        ])->assertOk();

        // Reset back to defaults by sending an empty list; "Other" (a
        // POS-side chip) is stripped rather than stored.
        $this->actingAs($this->oa, 'sanctum')->putJson("/api/organisations/{$this->org->id}", [
            'payment_options' => ['wallets' => [], 'card_banks' => ['DSB', 'Other']],
        ])->assertOk();

        $this->org->refresh();
        $this->assertSame([], $this->org->settings['payment_options']['wallets']);
        $this->assertSame(['DSB'], $this->org->settings['payment_options']['card_banks']);
        $this->assertSame(config('josbin_pos.payment_options.wallets'), $this->org->payment_options['wallets']);
    }

    public function test_wallet_qr_upload_follows_configured_list(): void
    {
        $this->actingAs($this->oa, 'sanctum')->putJson("/api/organisations/{$this->org->id}", [
            'payment_options' => ['wallets' => ['MMG']],
        ])->assertOk();

        // Configured provider accepted — slug derived from the name.
        $this->actingAs($this->oa, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'MMG', 'image' => UploadedFile::fake()->image('mmg.png'),
        ])->assertOk()->assertJsonPath('data.wallet_qr_path', "wallet-qrs/{$this->store->id}/mmg.png");

        // A provider outside the configured list is rejected.
        $this->actingAs($this->oa, 'sanctum')->postJson("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Mopé', 'image' => UploadedFile::fake()->image('m.png'),
        ])->assertStatus(422);

        // Removing the wallet from the config later still allows DELETING
        // its stored QR (cleanup must never be blocked by config changes).
        $this->actingAs($this->oa, 'sanctum')->putJson("/api/organisations/{$this->org->id}", [
            'payment_options' => ['wallets' => ['Caripay']],
        ])->assertOk();
        $this->actingAs($this->oa, 'sanctum')
            ->deleteJson("/api/stores/{$this->store->id}/wallet-qr?provider=MMG")
            ->assertOk();
        $this->assertArrayNotHasKey('MMG', $this->store->fresh()->settings['wallet_qrs'] ?? []);
    }
}
