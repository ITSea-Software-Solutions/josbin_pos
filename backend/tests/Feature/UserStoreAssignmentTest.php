<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Register;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Verifies the user_stores pivot enforces per-store access for cashier +
 * store_manager while leaving org-scoped roles (SA, OA, auditor) unchanged.
 *
 * Backfill semantics: empty pivot = all stores in the user's organisation
 * (matches the org-scoped behaviour that existed before the pivot).
 */
class UserStoreAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $storeA;
    private Store $storeB;
    private User $manager;
    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Pivot Test Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-PIVOT', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->storeA = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Store A',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->storeB = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Store B',
            'city' => 'Nickerie', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->manager = User::create([
            'name' => 'Mgr', 'email' => 'pivot-mgr@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_STORE_MANAGER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->manager->assignRole(User::ROLE_STORE_MANAGER);

        $this->cashier = User::create([
            'name' => 'Cash', 'email' => 'pivot-cash@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);
    }

    
    public function test_empty_assignment_equals_all_stores_in_org(): void
    {
        // Backfill safety: a cashier with NO rows in user_stores can still
        // access every store in their org. Existing users keep working.
        $this->assertTrue($this->cashier->canAccessStore($this->storeA->id));
        $this->assertTrue($this->cashier->canAccessStore($this->storeB->id));
    }

    
    public function test_explicit_assignment_restricts_access(): void
    {
        $this->cashier->stores()->sync([$this->storeA->id]);
        $this->cashier->refresh();

        $this->assertTrue($this->cashier->canAccessStore($this->storeA->id));
        $this->assertFalse($this->cashier->canAccessStore($this->storeB->id));
    }

    
    public function test_org_scoped_roles_ignore_the_pivot(): void
    {
        // Auditor / org_admin should always see every store in their org,
        // regardless of pivot state.
        $auditor = User::create([
            'name' => 'A', 'email' => 'pivot-aud@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_AUDITOR, 'locale' => 'nl', 'is_active' => true,
        ]);
        $auditor->assignRole(User::ROLE_AUDITOR);

        // Even with an explicit (and contradictory) pivot row, the role
        // wins.
        $auditor->stores()->sync([$this->storeA->id]);
        $this->assertTrue($auditor->canAccessStore($this->storeB->id));
    }

    
    public function test_register_open_returns_403_when_cashier_not_assigned(): void
    {
        $this->cashier->stores()->sync([$this->storeA->id]);

        $registerB = Register::create([
            'store_id' => $this->storeB->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$registerB->id}/open", ['opening_float' => 100]);

        $response->assertStatus(403);
        $response->assertJson(['code' => 'STORE_NOT_ASSIGNED']);
    }

    
    public function test_register_open_succeeds_when_cashier_is_assigned(): void
    {
        $this->cashier->stores()->sync([$this->storeA->id]);

        $registerA = Register::create([
            'store_id' => $this->storeA->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$registerA->id}/open", ['opening_float' => 100]);

        $response->assertStatus(201);
    }

    
    public function test_user_create_endpoint_persists_store_ids(): void
    {
        $sa = User::create([
            'name' => 'SA', 'email' => 'pivot-sa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $sa->assignRole(User::ROLE_SUPER_ADMIN);

        $response = $this->actingAs($sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'New Cashier', 'email' => 'new-cash@test.sr',
                'password' => 'Password123', 'role' => 'cashier', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                'store_ids' => [$this->storeA->id],
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.store_ids', [$this->storeA->id]);

        $this->assertDatabaseHas('user_stores', [
            'store_id' => $this->storeA->id,
        ]);
    }
}
