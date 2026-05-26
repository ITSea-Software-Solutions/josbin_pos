<?php

namespace Tests\Feature;

use App\Models\License;
use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Verifies the licence gate around POST /api/organisations/{org}/stores.
 *
 * Business rule: a store is a licensed asset. The OA cannot create one
 * unless their org has an active, in-date licence and they are below the
 * tier's max_stores cap. Until the SA issues a licence, store creation is
 * blocked outright — previously the loophole "no licence = allowed" let an
 * OA quietly bypass the cap.
 *
 * Each test mirrors one of the three structured error codes the controller
 * returns so the frontend can switch on them and show specific guidance.
 */
class LicenseStoreCreationGateTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $orgAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Licence Gate Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-LIC', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $this->orgAdmin = User::create([
            'name'            => 'OA',
            'email'           => 'oa@licence-gate.test',
            'password'        => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role'            => User::ROLE_ORGANISATION_ADMIN,
            'locale'          => 'nl',
            'is_active'       => true,
        ]);
        $this->orgAdmin->assignRole(User::ROLE_ORGANISATION_ADMIN);
    }

    /** @return array<string, mixed> */
    private function payload(string $name = 'New Store'): array
    {
        return [
            'name'             => $name,
            'address'          => 'Domineestraat 12',
            'city'             => 'Paramaribo',
            'default_btw_rate' => 10,
            'pos_type'         => 'native',
        ];
    }

    public function test_blocks_with_license_required_when_no_active_license(): void
    {
        $response = $this->actingAs($this->orgAdmin, 'sanctum')
            ->postJson("/api/organisations/{$this->org->id}/stores", $this->payload());

        $response->assertStatus(422)->assertJson(['code' => 'LICENSE_REQUIRED']);
        $this->assertEquals(0, Store::where('organisation_id', $this->org->id)->count());
    }

    public function test_blocks_with_license_expired_when_in_soft_lock(): void
    {
        License::create([
            'organisation_id'  => $this->org->id,
            'license_key_hash' => License::hashKey('expired-' . uniqid()),
            'tier'             => 'professional',
            'max_stores'       => 5,
            'max_terminals'    => 10,
            // Soft lock: expired between 14 and 44 days ago.
            'valid_from'       => now()->subDays(400)->toDateString(),
            'valid_until'      => now()->subDays(30)->toDateString(),
            'is_active'        => true,
            'renewal_status'   => 'soft_lock',
        ]);

        $response = $this->actingAs($this->orgAdmin, 'sanctum')
            ->postJson("/api/organisations/{$this->org->id}/stores", $this->payload());

        $response->assertStatus(422)
            ->assertJsonPath('code', 'LICENSE_EXPIRED')
            ->assertJsonPath('renewal_status', 'soft_lock');
        $this->assertEquals(0, Store::where('organisation_id', $this->org->id)->count());
    }

    public function test_blocks_with_license_store_limit_reached_at_max(): void
    {
        License::create([
            'organisation_id'  => $this->org->id,
            'license_key_hash' => License::hashKey('atlimit-' . uniqid()),
            'tier'             => 'standard',
            'max_stores'       => 2,
            'max_terminals'    => 4,
            'valid_from'       => now()->subDays(10)->toDateString(),
            'valid_until'      => now()->addYear()->toDateString(),
            'is_active'        => true,
            'renewal_status'   => 'active',
        ]);

        // Saturate the limit
        for ($i = 1; $i <= 2; $i++) {
            Store::create([
                'organisation_id' => $this->org->id,
                'name'            => "Existing $i",
                'city'            => 'Paramaribo',
                'default_btw_rate'=> 10,
                'is_active'       => true,
                'pos_type'        => 'native',
            ]);
        }

        $response = $this->actingAs($this->orgAdmin, 'sanctum')
            ->postJson("/api/organisations/{$this->org->id}/stores", $this->payload('Third'));

        $response->assertStatus(422)
            ->assertJson([
                'code'    => 'LICENSE_STORE_LIMIT_REACHED',
                'limit'   => 2,
                'current' => 2,
            ]);
        $this->assertEquals(2, Store::where('organisation_id', $this->org->id)->count());
    }

    public function test_allows_store_creation_when_license_active_and_under_limit(): void
    {
        License::create([
            'organisation_id'  => $this->org->id,
            'license_key_hash' => License::hashKey('ok-' . uniqid()),
            'tier'             => 'professional',
            'max_stores'       => 5,
            'max_terminals'    => 10,
            'valid_from'       => now()->subDays(5)->toDateString(),
            'valid_until'      => now()->addYear()->toDateString(),
            'is_active'        => true,
            'renewal_status'   => 'active',
        ]);

        $response = $this->actingAs($this->orgAdmin, 'sanctum')
            ->postJson("/api/organisations/{$this->org->id}/stores", $this->payload('First Store'));

        $response->assertStatus(201)->assertJsonPath('data.name', 'First Store');
        $this->assertEquals(1, Store::where('organisation_id', $this->org->id)->count());
    }
}
