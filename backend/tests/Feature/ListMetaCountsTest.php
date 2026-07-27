<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The list endpoints that ship whole-set aggregates next to a page. The
 * users 500 on the droplet proved these paths were untested: the aggregate
 * clone inherited the base query's ORDER BY, which Postgres rejects with
 * count(*) — reorder() strips it. These tests exist so that class of
 * regression fails in CI, not in production.
 */
class ListMetaCountsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_users_index_returns_page_plus_whole_set_counts(): void
    {
        $oa = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();

        $res = $this->actingAs($oa, 'sanctum')->getJson('/api/users?per_page=2');

        $res->assertOk();
        $this->assertIsInt($res->json('meta_counts.total'));
        $this->assertGreaterThanOrEqual(count($res->json('data')), $res->json('meta_counts.total'));
        $this->assertArrayHasKey('active', $res->json('meta_counts'));
        $this->assertArrayHasKey('with_two_factor', $res->json('meta_counts'));
    }

    public function test_z_reports_index_returns_status_counts(): void
    {
        $oa = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();

        $res = $this->actingAs($oa, 'sanctum')->getJson('/api/dashboard/z-reports?per_page=5');

        $res->assertOk();
        foreach (['synced', 'pending', 'failed'] as $k) {
            $this->assertArrayHasKey($k, $res->json('meta_counts'));
        }
    }

    public function test_per_page_is_clamped_to_200(): void
    {
        $oa = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();

        $res = $this->actingAs($oa, 'sanctum')->getJson('/api/users?per_page=999999');

        $res->assertOk();
        $this->assertLessThanOrEqual(200, (int) $res->json('per_page'));
    }
}
