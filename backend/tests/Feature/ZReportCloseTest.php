<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use App\Models\ZReport;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * POST /api/reports/z-report
 *
 * Z-Report = end-of-day register close. Permission gate is z_report.close —
 * cashier role does NOT have it (per RolesAndPermissionsSeeder), so a cashier
 * POST must return 403. Manager+ has it.
 *
 * One Z-Report per (store, report_date) is enforced by a unique index on
 * z_reports (store_id, report_date) AND by an early check in the controller
 * that returns 409 ALREADY_CLOSED rather than letting Postgres throw a
 * 23505 unique violation.
 */
class ZReportCloseTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Organisation $org;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Bus::fake();

        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->org     = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $this->org->id)->firstOrFail();

        DailyRate::create([
            'date'        => today()->toDateString(),
            'usd_to_srd'  => '38.5000',
            'raw_rate'    => '37.5000',
            'markup_pct'  => '2.50',
            'source'      => 'manual',
            'locked_by'   => $this->manager->id,
            'locked_at'   => now(),
        ]);
    }

    // ─── Permission gate: cashier 403, manager 201 ───────────────────────────

    public function test_cashier_cannot_close_z_report(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id'        => $this->store->id,
                'actual_cash_srd' => 100.00,
            ]);

        $response->assertStatus(403);
        $this->assertDatabaseCount('z_reports', 0);
    }

    public function test_manager_can_close_z_report(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id'        => $this->store->id,
                'actual_cash_srd' => 0.00,
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.store_id', $this->store->id);
        // report_date casts to date but Eloquent serialises Carbon as full ISO
        // — assert the date prefix matches today (AST).
        $this->assertStringStartsWith(today()->toDateString(), $response->json('data.report_date'));
        $response->assertJsonPath('data.sync_status', 'pending');

        $this->assertDatabaseCount('z_reports', 1);

        $z = ZReport::first();
        $this->assertSame($this->manager->id, $z->closed_by);
        $this->assertNotNull($z->closed_at);
    }

    // ─── One-per-store-per-day uniqueness ────────────────────────────────────

    public function test_second_close_same_day_returns_409_already_closed(): void
    {
        // First close — manager, succeeds
        $first = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id'        => $this->store->id,
                'actual_cash_srd' => 0.00,
            ]);
        $first->assertStatus(201);

        // Second close — same store, same day, should return 409
        $second = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id'         => $this->store->id,
                'actual_cash_srd'  => 0.00,
                'discrepancy_note' => 'Probeer opnieuw sluiten.',
            ]);

        $second->assertStatus(409);
        $second->assertJsonPath('code', 'ALREADY_CLOSED');

        // Still only one Z-Report row
        $this->assertDatabaseCount('z_reports', 1);
    }

    // ─── Validation ──────────────────────────────────────────────────────────

    public function test_missing_actual_cash_returns_422(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id' => $this->store->id,
                // no actual_cash_srd
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['actual_cash_srd']);
    }

    public function test_negative_actual_cash_returns_422(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson('/api/reports/z-report', [
                'store_id'        => $this->store->id,
                'actual_cash_srd' => -10.00,
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['actual_cash_srd']);
    }
}
