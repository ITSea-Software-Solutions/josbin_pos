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
 * Per-store wallet QR upload (Mopé / Uni5Pay+) — the static merchant QR the
 * POS shows full-screen during a qr_payment so the customer can scan from
 * the screen. Stored under settings['wallet_qrs'][provider].
 */
class StoreWalletQrTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;
    private Store $otherStore;
    private User $sm;
    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        Storage::fake('public');

        $org = Organisation::create([
            'name' => 'QR Img Org', 'type' => 'retail', 'btw_number' => 'SR-QRIMG',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'Wallet Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->otherStore = Store::create([
            'organisation_id' => $org->id, 'name' => 'Other Store',
            'city' => 'Nickerie', 'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->sm = User::create([
            'name' => 'SM', 'email' => 'qrimg-sm@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $this->store->id,
            'role' => User::ROLE_STORE_MANAGER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sm->assignRole(User::ROLE_STORE_MANAGER);
        $this->cashier = User::create([
            'name' => 'C', 'email' => 'qrimg-c@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $this->store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);
    }

    public function test_store_manager_uploads_wallet_qr_for_own_store(): void
    {
        $resp = $this->actingAs($this->sm, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Mopé',
            'image'    => UploadedFile::fake()->image('mope-qr.png', 600, 600),
        ]);
        $resp->assertOk();
        $path = $resp->json('data.wallet_qr_path');
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);

        $this->store->refresh();
        $this->assertSame($path, $this->store->settings['wallet_qrs']['Mopé']);
    }

    public function test_upload_replaces_previous_qr_for_same_provider(): void
    {
        $first = $this->actingAs($this->sm, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Uni5Pay+', 'image' => UploadedFile::fake()->image('a.png'),
        ])->json('data.wallet_qr_path');

        $second = $this->actingAs($this->sm, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Uni5Pay+', 'image' => UploadedFile::fake()->image('b.jpg'),
        ])->json('data.wallet_qr_path');

        Storage::disk('public')->assertExists($second);
        if ($first !== $second) {
            Storage::disk('public')->assertMissing($first);
        }
        $this->store->refresh();
        $this->assertSame($second, $this->store->settings['wallet_qrs']['Uni5Pay+']);
    }

    public function test_delete_removes_qr_and_setting(): void
    {
        $path = $this->actingAs($this->sm, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Mopé', 'image' => UploadedFile::fake()->image('m.png'),
        ])->json('data.wallet_qr_path');

        $this->actingAs($this->sm, 'sanctum')
            ->deleteJson("/api/stores/{$this->store->id}/wallet-qr?provider=Mopé")
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->store->refresh();
        $this->assertArrayNotHasKey('Mopé', $this->store->settings['wallet_qrs'] ?? []);
    }

    public function test_cashier_cannot_upload(): void
    {
        $this->actingAs($this->cashier, 'sanctum')->post("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Mopé', 'image' => UploadedFile::fake()->image('m.png'),
        ])->assertForbidden();
    }

    public function test_unknown_provider_rejected(): void
    {
        $this->actingAs($this->sm, 'sanctum')->postJson("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'PayPal', 'image' => UploadedFile::fake()->image('m.png'),
        ])->assertStatus(422);
    }

    public function test_svg_rejected(): void
    {
        // SVG can carry scripts and /storage serves same-origin — raster only.
        $this->actingAs($this->sm, 'sanctum')->postJson("/api/stores/{$this->store->id}/wallet-qr", [
            'provider' => 'Mopé',
            'image'    => UploadedFile::fake()->createWithContent('evil.svg', '<svg onload="alert(1)"/>'),
        ])->assertStatus(422);
    }
}
