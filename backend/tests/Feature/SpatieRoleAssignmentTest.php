<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regression coverage for the bug that bit the demo:
 *   - SA creates an OA via UI
 *   - OA logs in
 *   - OA opens Catalogue, clicks "+ Add category"
 *   - Backend → "This action is unauthorized." (403)
 *
 * Root cause: UserController::store() wrote the role enum to users.role but
 * never called $user->assignRole(). The spatie permission tables stayed
 * empty for that user, so every Policy → can() check failed.
 *
 * These tests lock in the fix:
 *   1. POST /api/users with role X attaches the matching spatie role
 *   2. The new user can immediately use perm-gated endpoints
 *   3. PUT /api/users/{id} with a role change re-syncs the spatie role
 *   4. update() self-heals legacy users that pre-date the fix
 */
class SpatieRoleAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Spatie Test Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-SP', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'name' => 'SA', 'email' => 'sa-spatie@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => null,
            'role' => User::ROLE_SUPER_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->superAdmin->assignRole(User::ROLE_SUPER_ADMIN);
    }

    public function test_creating_a_user_attaches_the_spatie_role(): void
    {
        $this->actingAs($this->superAdmin, 'sanctum')
            ->postJson('/api/users', [
                'name'            => 'Sandra Codrington',
                'email'           => 'sandra-spatie@dehoop.sr',
                'password'        => 'Test1234',
                'role'            => User::ROLE_ORGANISATION_ADMIN,
                'locale'          => 'nl',
                'organisation_id' => $this->org->id,
            ])
            ->assertCreated();

        $created = User::where('email', 'sandra-spatie@dehoop.sr')->first();
        $this->assertNotNull($created);
        $this->assertTrue($created->hasRole(User::ROLE_ORGANISATION_ADMIN));
        $this->assertTrue($created->can('categories.manage'),
            'New OA should resolve the categories.manage permission via spatie.');
        $this->assertTrue($created->can('products.create'));
    }

    public function test_new_org_admin_can_actually_create_a_category(): void
    {
        // End-to-end regression for the demo bug.
        $this->actingAs($this->superAdmin, 'sanctum')->postJson('/api/users', [
            'name' => 'Sandra', 'email' => 'sandra-cat@dehoop.sr',
            'password' => 'Test1234',
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl',
            'organisation_id' => $this->org->id,
        ])->assertCreated();

        $oa = User::where('email', 'sandra-cat@dehoop.sr')->first();

        // OA now creates a category — pre-fix this returned 403
        $this->actingAs($oa, 'sanctum')->postJson('/api/categories', [
            'name_nl' => 'Zuivel',
            'name_en' => 'Dairy',
            'sort_order' => 1,
        ])->assertCreated();
    }

    public function test_role_change_resyncs_the_spatie_role(): void
    {
        $store = Store::create([
            'organisation_id' => $this->org->id,
            'name' => 'Store', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);

        $target = User::create([
            'name' => 'T', 'email' => 't-promote@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'store_id' => $store->id,
            'role' => User::ROLE_CASHIER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $target->assignRole(User::ROLE_CASHIER);

        $this->assertTrue($target->hasRole(User::ROLE_CASHIER));
        $this->assertFalse($target->can('categories.manage'),
            'Cashier should not have categories.manage.');

        // Promote cashier → store_manager via API
        $this->actingAs($this->superAdmin, 'sanctum')
            ->putJson("/api/users/{$target->id}", [
                'role' => User::ROLE_STORE_MANAGER,
                'store_id' => $store->id,
            ])->assertOk();

        $target->refresh()->load('roles');
        $this->assertTrue($target->hasRole(User::ROLE_STORE_MANAGER));
        $this->assertFalse($target->hasRole(User::ROLE_CASHIER),
            'Cashier role should have been removed when promoting to SM.');
        $this->assertTrue($target->can('categories.manage'),
            'Newly-promoted SM should resolve categories.manage.');
    }

    public function test_legacy_user_with_no_spatie_role_self_heals_on_first_update(): void
    {
        // Simulate the broken state from the demo: role enum on the row,
        // but NO spatie row in model_has_roles.
        $legacy = User::create([
            'name' => 'Legacy', 'email' => 'legacy-spatie@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        // Deliberately skip assignRole() — replicate pre-fix state.

        $this->assertCount(0, $legacy->roles, 'Pre-condition: legacy user has no spatie role.');
        $this->assertFalse($legacy->can('categories.manage'));

        // SA edits the legacy user with a harmless change → should self-heal
        $this->actingAs($this->superAdmin, 'sanctum')
            ->putJson("/api/users/{$legacy->id}", ['name' => 'Legacy Updated'])
            ->assertOk();

        $legacy->refresh()->load('roles');
        $this->assertTrue($legacy->hasRole(User::ROLE_ORGANISATION_ADMIN),
            'Self-heal should attach the role matching the users.role enum.');
        $this->assertTrue($legacy->can('categories.manage'));
    }
}
