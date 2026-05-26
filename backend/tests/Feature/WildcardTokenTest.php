<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Task #74 — session tokens carry the '*' wildcard ability so they never go
 * stale on permission / role / seeder changes. The user's CURRENT permissions
 * are read at request time via policies + spatie gates.
 *
 * Verifies:
 *   - Login issues a token with abilities = ['*']
 *   - Permission changes propagate without re-login (the bug we kept hitting)
 *   - Pre-auth 2FA tokens stay narrowly scoped (only their one ability)
 */
class WildcardTokenTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $oa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'WildcardToken Org', 'type' => 'retail',
            'btw_number' => 'BTW-SR-W', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->oa = User::create([
            'name' => 'OA', 'email' => 'wildcard-oa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);
    }

    public function test_login_issues_wildcard_token(): void
    {
        $resp = $this->postJson('/api/auth/login', [
            'email'    => 'wildcard-oa@test.sr',
            'password' => 'pw',
            'device_name' => 'test',
        ]);
        $resp->assertOk();
        $rawToken = $resp->json('token');
        $this->assertNotEmpty($rawToken);

        // Decode the token and check the abilities
        $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($rawToken);
        $this->assertNotNull($tokenModel);
        $this->assertEquals(['*'], $tokenModel->abilities);
    }

    public function test_permission_change_propagates_without_relogin(): void
    {
        // OA has 'categories.manage' by default. Login + verify it works.
        $tokenStr = $this->postJson('/api/auth/login', [
            'email' => 'wildcard-oa@test.sr', 'password' => 'pw', 'device_name' => 'test',
        ])->json('token');

        $this->withHeader('Authorization', "Bearer $tokenStr")
            ->postJson('/api/categories', ['name_nl' => 'A', 'name_en' => 'A'])
            ->assertCreated();

        // Now revoke the permission from the role at runtime — bug scenario:
        // before #74 this would not affect existing tokens because they had
        // a snapshot. After #74 the policy re-evaluates and immediately denies.
        $role = \Spatie\Permission\Models\Role::where('name', User::ROLE_ORGANISATION_ADMIN)->first();
        $role->revokePermissionTo('categories.manage');
        // Clear the spatie permission cache so the next request sees fresh state.
        app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        // The user model in memory also has a cached permission set per the
        // spatie trait — refresh it explicitly so the next request rebuilds.
        $this->oa->unsetRelation('roles')->unsetRelation('permissions')->load('roles', 'permissions');

        // Same token; permission gone; should 403 now.
        $resp = $this->withHeader('Authorization', "Bearer $tokenStr")
            ->postJson('/api/categories', ['name_nl' => 'B', 'name_en' => 'B']);
        $resp->assertForbidden();
    }

    public function test_pre_auth_2fa_tokens_stay_narrow(): void
    {
        // Set up a user that REQUIRES 2FA so login returns a setup_token.
        // Easiest: use the super_admin (mandatory 2FA via TWO_FACTOR_ALWAYS_ROLES).
        $sa = User::create([
            'name' => 'SA', 'email' => 'wildcard-sa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => null,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $sa->assignRole(User::ROLE_SUPER_ADMIN);

        $resp = $this->postJson('/api/auth/login', [
            'email' => 'wildcard-sa@test.sr', 'password' => 'pw', 'device_name' => 'test',
        ]);
        $resp->assertOk();
        $resp->assertJsonPath('two_factor_setup_required', true);

        $setupToken = $resp->json('setup_token');
        $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($setupToken);
        $this->assertNotNull($tokenModel);
        // CRITICAL: setup tokens must be narrowly scoped — NOT the wildcard.
        $this->assertEquals(['two_factor_setup'], $tokenModel->abilities);
        $this->assertNotContains('*', $tokenModel->abilities);
    }
}
