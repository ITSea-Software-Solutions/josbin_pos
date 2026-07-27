<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Exports are period documents, not archive dumps. These guards keep a
 * mistyped year (2020→2026) from building an unbounded in-memory payload.
 */
class ExportGuardrailsTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $org = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store = Store::findOrFail($this->manager->store_id ?? $org->stores()->value('id'));
    }

    public function test_rekenkamer_export_refuses_ranges_over_a_year(): void
    {
        $oa = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();
        $this->actingAs($oa, 'sanctum')
            ->getJson('/api/reports/rekenkamer?date_from=2020-01-01&date_to=2026-01-01')
            ->assertStatus(422);
    }

    public function test_rekenkamer_export_accepts_a_normal_period(): void
    {
        $oa = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();
        $this->actingAs($oa, 'sanctum')
            ->getJson('/api/reports/rekenkamer?date_from=' . today()->subDays(30)->toDateString()
                . '&date_to=' . today()->toDateString())
            ->assertOk();
    }

    public function test_sync_export_refuses_ranges_over_ninety_two_days(): void
    {
        $this->actingAs($this->manager, 'sanctum')
            ->getJson('/api/sync/export?store_id=' . $this->store->id
                . '&from_date=2025-01-01&to_date=2025-12-31')
            ->assertStatus(422);
    }

    public function test_customer_statement_refuses_ranges_over_a_year(): void
    {
        $customer = \App\Models\Customer::where('organisation_id', $this->store->organisation_id)->first();
        if (! $customer) {
            $this->markTestSkipped('no seeded customer');
        }

        $this->actingAs($this->manager, 'sanctum')
            ->get('/api/customers/' . $customer->id . '/statement?from=2020-01-01&to=2026-01-01')
            ->assertStatus(422);
    }
}
