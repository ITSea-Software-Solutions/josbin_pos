<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `stores.settings` is one JSON column shared by features that write to it
 * through their OWN endpoints — wallet QR uploads, the receipt footer stamp,
 * the per-store BTW number, closing times.
 *
 * PUT /stores/{id} used to REPLACE that column, so a form owning four keys
 * erased every key it did not know about. In the field: a wallet QR uploaded
 * a minute earlier vanished the moment the receipt header was edited. An
 * update must merge — what it does not mention, it does not touch.
 */
class StoreSettingsMergeTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Merge Org', 'type' => 'retail', 'btw_number' => 'SR-MERGE',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'Merge Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
            'settings' => [
                'wallet_qrs'         => ['mope' => 'qr/mope.png', 'uni5pay' => 'qr/uni5.png'],
                'receipt_stamp_path' => 'stamps/shop.png',
                'receipt_btw_number' => 'BTW-1234',
                'closing_time'       => '21:00',
            ],
        ]);

        $this->admin = User::create([
            'name' => 'OA', 'email' => 'merge-oa@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->admin->assignRole(User::ROLE_ORGANISATION_ADMIN);
    }

    public function test_updating_the_receipt_header_does_not_erase_the_wallet_qr(): void
    {
        // Exactly what the settings form sends: the keys it owns, nothing else.
        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/stores/{$this->store->id}", [
                'receipt_header' => 'Supermarkt De Hoop — Paramaribo',
                'settings' => [
                    'receipt_btw_number' => 'BTW-1234',
                    'closing_time'       => '22:00',
                ],
            ])
            ->assertOk();

        $settings = $this->store->fresh()->settings;

        // The keys the form never mentioned must still be there. This is the
        // whole point of the test.
        $this->assertSame(
            ['mope' => 'qr/mope.png', 'uni5pay' => 'qr/uni5.png'],
            $settings['wallet_qrs'],
            'wallet QRs were erased by an unrelated update',
        );
        $this->assertSame('stamps/shop.png', $settings['receipt_stamp_path']);

        // …and the keys it did send are applied.
        $this->assertSame('22:00', $settings['closing_time']);
        $this->assertSame('Supermarkt De Hoop — Paramaribo', $this->store->fresh()->receipt_header);
    }

    public function test_an_update_with_no_settings_key_leaves_settings_untouched(): void
    {
        $before = $this->store->settings;

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/stores/{$this->store->id}", ['city' => 'Nickerie'])
            ->assertOk();

        $this->assertSame($before, $this->store->fresh()->settings);
        $this->assertSame('Nickerie', $this->store->fresh()->city);
    }

    public function test_a_store_with_no_settings_yet_accepts_its_first_keys(): void
    {
        $blank = Store::create([
            'organisation_id' => $this->store->organisation_id, 'name' => 'Blank Store',
            'city' => 'Albina', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native', 'settings' => null,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/stores/{$blank->id}", [
                'settings' => ['closing_time' => '20:00'],
            ])
            ->assertOk();

        $this->assertSame('20:00', $blank->fresh()->settings['closing_time']);
    }
}
