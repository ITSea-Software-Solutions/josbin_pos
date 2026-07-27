<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The tax inspector's audit-log window (previously: nav showed the screen,
 * the controller 403'd, the page sat empty — the promise and the gate
 * disagreed).
 *
 * Mandate-shaped scope: BTW-filing events across ALL organisations, plus
 * the inspector's own actions. Never an organisation's operational logs —
 * a supermarket's product edits are none of the Belastingdienst's business
 * (WBP-S data minimization).
 */
class AuditLogInspectorScopeTest extends TestCase
{
    use RefreshDatabase;

    private User $inspector;
    private Organisation $org;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->inspector = User::where('email', 'belastingdienst@gov.sr')->firstOrFail();
        $this->org       = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();

        // One BTW-filing event (another org's) and one operational event
        // (same org) — the inspector must see the first, never the second.
        DB::table('audit_logs')->insert([
            [
                'user_id'         => null,
                'organisation_id' => $this->org->id,
                'event'           => 'created',
                'auditable_type'  => 'btw_submission',
                'auditable_id'    => (string) \Illuminate\Support\Str::uuid(),
                'new_values'      => json_encode(['status' => 'submitted']),
                'created_at'      => now(),
            ],
            [
                'user_id'         => null,
                'organisation_id' => $this->org->id,
                'event'           => 'updated',
                'auditable_type'  => 'product',
                'auditable_id'    => (string) \Illuminate\Support\Str::uuid(),
                'new_values'      => json_encode(['price' => '9.99']),
                'created_at'      => now(),
            ],
        ]);
    }

    public function test_inspector_can_open_the_audit_log(): void
    {
        $this->actingAs($this->inspector, 'sanctum')
            ->getJson('/api/audit-log')
            ->assertOk();
    }

    public function test_inspector_sees_btw_filing_events_across_orgs_only(): void
    {
        $res = $this->actingAs($this->inspector, 'sanctum')
            ->getJson('/api/audit-log?per_page=100');

        $types = collect($res->json('data'))->pluck('model_type')->unique()->values()->all();

        $this->assertContains('btw_submission', $types);
        // Operational logs of an organisation never reach the inspector.
        $this->assertNotContains('product', $types);
    }

    public function test_auditor_scope_is_unchanged_by_the_inspector_branch(): void
    {
        $auditor = User::factory()->create([
            'organisation_id' => $this->org->id,
            'role'            => 'auditor',
        ]);
        $auditor->assignRole('auditor');

        $res = $this->actingAs($auditor, 'sanctum')->getJson('/api/audit-log?per_page=100');
        $res->assertOk();

        // The org's own auditor DOES see operational events — their mandate
        // is the whole organisation, unlike the Belastingdienst's.
        $types = collect($res->json('data'))->pluck('model_type')->unique()->values()->all();
        $this->assertContains('product', $types);
    }
}
