<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Register;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Verifies the strict 1:1 users.store_id model:
 *   - cashier + store_manager are pinned to exactly one store; no implicit
 *     "all stores in org" fallback.
 *   - org-scoped roles (super_admin, organisation_admin, auditor,
 *     api_integration) ignore store_id and can act on any store in their org.
 *
 * Product decision: a user belongs to exactly one store. The previous many-
 * to-many user_stores pivot was removed because real-world Surinamese
 * supermarkets staff cashiers per-store; the multi-store fallback was a
 * theoretical convenience that masked data-entry mistakes.
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

    public function test_cashier_without_store_id_cannot_access_any_store(): void
    {
        // No "all stores" fallback any more. A cashier missing a store_id
        // is a data-entry error and must be blocked from every store rather
        // than silently granted org-wide access.
        $this->assertFalse($this->cashier->canAccessStore($this->storeA->id));
        $this->assertFalse($this->cashier->canAccessStore($this->storeB->id));
    }

    public function test_assigned_store_grants_access_to_only_that_store(): void
    {
        $this->cashier->store_id = $this->storeA->id;
        $this->cashier->save();
        $this->cashier->refresh();

        $this->assertTrue($this->cashier->canAccessStore($this->storeA->id));
        $this->assertFalse($this->cashier->canAccessStore($this->storeB->id));
    }

    public function test_org_scoped_roles_can_access_any_store_in_org(): void
    {
        // Auditor / OA / API ignore store_id entirely. They operate at the
        // org level and need to see every store for compliance / management
        // / integration purposes.
        $auditor = User::create([
            'name' => 'A', 'email' => 'pivot-aud@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_AUDITOR, 'locale' => 'nl', 'is_active' => true,
        ]);
        $auditor->assignRole(User::ROLE_AUDITOR);

        // Even with a (technically allowed but ignored) store_id, the role
        // grants access to the other store in the same org.
        $auditor->store_id = $this->storeA->id;
        $auditor->save();
        $this->assertTrue($auditor->canAccessStore($this->storeA->id));
        $this->assertTrue($auditor->canAccessStore($this->storeB->id));
    }

    public function test_register_open_returns_403_when_cashier_not_assigned(): void
    {
        // Cashier is pinned to store A but tries to open a register in B.
        $this->cashier->store_id = $this->storeA->id;
        $this->cashier->save();

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
        $this->cashier->store_id = $this->storeA->id;
        $this->cashier->save();

        $registerA = Register::create([
            'store_id' => $this->storeA->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$registerA->id}/open", ['opening_float' => 100]);

        $response->assertStatus(201);
    }

    public function test_user_create_endpoint_persists_store_id(): void
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
                'store_id' => $this->storeA->id,
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.store_id', $this->storeA->id);

        $this->assertDatabaseHas('users', [
            'email'    => 'new-cash@test.sr',
            'store_id' => $this->storeA->id,
        ]);
    }

    public function test_user_create_rejects_cashier_without_store_id(): void
    {
        // Cashier + store_manager require a store_id — backend must 422.
        $sa = User::create([
            'name' => 'SA', 'email' => 'pivot-sa2@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $sa->assignRole(User::ROLE_SUPER_ADMIN);

        $response = $this->actingAs($sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Missing Store', 'email' => 'no-store@test.sr',
                'password' => 'Password123', 'role' => 'cashier', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                // store_id deliberately omitted
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['store_id']);
    }

    public function test_user_create_rejects_store_id_for_org_scoped_role(): void
    {
        // Auditor (and other org-scoped roles) must NOT carry a store_id —
        // it's a data-shape error to set one. Backend rejects with 422.
        $sa = User::create([
            'name' => 'SA', 'email' => 'pivot-sa3@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $sa->assignRole(User::ROLE_SUPER_ADMIN);

        $response = $this->actingAs($sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Bad Auditor', 'email' => 'bad-aud@test.sr',
                'password' => 'Password123', 'role' => 'auditor', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                'store_id' => $this->storeA->id,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['store_id']);
    }
}
