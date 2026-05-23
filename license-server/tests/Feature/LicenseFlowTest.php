<?php

namespace Tests\Feature;

use App\Models\License;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LicenseFlowTest extends TestCase
{
    use RefreshDatabase;

    private function makeLicense(array $overrides = []): array
    {
        $key = 'JOSBIN-TEST-TEST-TEST-TEST';

        $license = License::create(array_merge([
            'license_key_hash'   => License::hashKey($key),
            'license_key_prefix' => 'JOSBIN-TEST',
            'organisation_name'  => 'Test Org',
            'tier'               => 'standard',
            'max_stores'         => 2,
            'max_terminals'      => 2,
            'valid_from'         => now()->subMonth()->toDateString(),
            'valid_until'        => now()->addYear()->toDateString(),
            'is_active'          => true,
        ], $overrides));

        return [$key, $license];
    }

    public function test_activation_then_validation_reports_active(): void
    {
        [$key] = $this->makeLicense();

        $activate = $this->postJson('/api/activate', [
            'license_key'   => $key,
            'hardware_mac'  => 'AA:BB:CC:DD:EE:FF',
            'hardware_cpu'  => 'cpu-123',
            'hardware_uuid' => 'uuid-123',
            'hostname'      => 'pos-01',
        ]);

        $activate->assertCreated()->assertJsonPath('status', 'active');
        $installationKey = $activate->json('installation_key');
        $this->assertNotEmpty($installationKey);

        $validate = $this->postJson('/api/validate', [
            'installation_key' => $installationKey,
            'hardware_mac'     => 'AA:BB:CC:DD:EE:FF',
            'hardware_cpu'     => 'cpu-123',
            'hardware_uuid'    => 'uuid-123',
        ]);

        $validate->assertOk()
            ->assertJsonPath('status', 'active')
            ->assertJsonPath('hardware_match', true)
            ->assertJsonPath('max_terminals', 2);
    }

    public function test_re_activation_on_same_hardware_is_idempotent(): void
    {
        [$key] = $this->makeLicense();
        $hw = ['hardware_mac' => 'A', 'hardware_cpu' => 'B', 'hardware_uuid' => 'C'];

        $first  = $this->postJson('/api/activate', array_merge(['license_key' => $key], $hw));
        $second = $this->postJson('/api/activate', array_merge(['license_key' => $key], $hw));

        $this->assertSame(
            $first->json('installation_key'),
            $second->json('installation_key'),
            'Re-activating the same hardware must return the same installation key.'
        );
    }

    public function test_terminal_limit_is_enforced(): void
    {
        [$key, $license] = $this->makeLicense(['max_terminals' => 1]);

        $this->postJson('/api/activate', [
            'license_key' => $key, 'hardware_mac' => 'M1', 'hardware_cpu' => 'C1', 'hardware_uuid' => 'U1',
        ])->assertCreated();

        $this->postJson('/api/activate', [
            'license_key' => $key, 'hardware_mac' => 'M2', 'hardware_cpu' => 'C2', 'hardware_uuid' => 'U2',
        ])->assertStatus(403)->assertJsonPath('error', 'LicenseLimitReached');
    }

    public function test_unknown_installation_key_reports_not_found(): void
    {
        $this->postJson('/api/validate', ['installation_key' => 'inst_does_not_exist'])
            ->assertOk()
            ->assertJsonPath('status', 'not_found');
    }

    public function test_revoked_license_reports_invalid(): void
    {
        [$key, $license] = $this->makeLicense();

        $activate = $this->postJson('/api/activate', [
            'license_key' => $key, 'hardware_mac' => 'M', 'hardware_cpu' => 'C', 'hardware_uuid' => 'U',
        ]);
        $installationKey = $activate->json('installation_key');

        $license->update(['is_active' => false, 'revoked_at' => now(), 'revoked_reason' => 'Non-payment']);

        $this->postJson('/api/validate', ['installation_key' => $installationKey])
            ->assertOk()
            ->assertJsonPath('status', 'invalid');
    }

    public function test_soft_lock_status_for_a_license_three_weeks_past_expiry(): void
    {
        [$key] = $this->makeLicense(['valid_until' => now()->subDays(21)->toDateString()]);

        $activate = $this->postJson('/api/activate', [
            'license_key' => $key, 'hardware_mac' => 'M', 'hardware_cpu' => 'C', 'hardware_uuid' => 'U',
        ]);

        $this->postJson('/api/validate', ['installation_key' => $activate->json('installation_key')])
            ->assertOk()
            ->assertJsonPath('status', 'soft_lock');
    }

    public function test_admin_endpoints_require_the_admin_key(): void
    {
        $this->getJson('/api/admin/licenses')->assertStatus(401);

        $this->withHeader('X-Admin-Key', 'test-admin-key')
            ->getJson('/api/admin/licenses')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_admin_can_issue_a_license_and_receive_the_key_once(): void
    {
        $response = $this->withHeader('X-Admin-Key', 'test-admin-key')->postJson('/api/admin/licenses', [
            'organisation_name' => 'Supermarkt Nickerie',
            'tier'              => 'enterprise',
            'max_stores'        => 5,
            'max_terminals'     => 20,
            'valid_from'        => now()->toDateString(),
            'valid_until'       => now()->addYear()->toDateString(),
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['data', 'license_key'])
            ->assertJsonPath('data.status', 'active');

        // The issued key must actually resolve.
        $this->assertNotNull(License::findByKey($response->json('license_key')));
    }
}
