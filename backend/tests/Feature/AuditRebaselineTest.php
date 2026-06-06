<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Organisation;
use App\Services\AuditHashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * audit:rebaseline recomputes the hash chain under the current algorithm,
 * fixing the verify failure that an algorithm change (G-023) creates for rows
 * written under the old one — without it being a way to launder real tampering
 * (the command is gated + self-audited).
 */
class AuditRebaselineTest extends TestCase
{
    use RefreshDatabase;

    public function test_rebaseline_repairs_an_algorithm_version_break(): void
    {
        $org = Organisation::create([
            'name' => 'Chain Org', 'type' => 'retail', 'btw_number' => 'SR-C',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        // Three correctly-chained rows under the current algorithm.
        foreach (['a', 'b', 'c'] as $e) {
            AuditLog::create([
                'user_id' => null, 'organisation_id' => $org->id,
                'event' => "event.$e", 'auditable_type' => 'system', 'auditable_id' => 'system',
                'old_values' => null, 'new_values' => ['k' => $e],
                'ip_address' => null, 'created_at' => now(),
            ]);
        }

        $hasher = app(AuditHashService::class);
        $this->assertTrue($hasher->verifyChain($org->id)['valid'], 'Pre-condition: chain valid.');

        // Simulate an old-algorithm hash on the genesis row (what G-023 left
        // behind on pre-fix rows): a stored hash the current algorithm won't
        // reproduce → verify breaks.
        $genesisId = DB::table('audit_logs')->where('organisation_id', $org->id)->orderBy('id')->value('id');
        DB::table('audit_logs')->where('id', $genesisId)->update(['row_hash' => str_repeat('0', 64)]);
        $this->assertFalse($hasher->verifyChain($org->id)['valid'], 'Chain should now read as broken.');

        // Rebaseline → chain verifies clean again.
        $this->artisan('audit:rebaseline', ['--all' => true, '--confirm' => true])
            ->assertExitCode(0);

        $this->assertTrue($hasher->verifyChain($org->id)['valid'], 'Chain repaired by rebaseline.');

        // The rebaseline recorded itself (provenance).
        $this->assertDatabaseHas('audit_logs', ['event' => 'audit.chain_rebaselined']);
    }

    public function test_dry_run_changes_nothing(): void
    {
        $org = Organisation::create([
            'name' => 'DryRun Org', 'type' => 'retail', 'btw_number' => 'SR-D',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        AuditLog::create([
            'user_id' => null, 'organisation_id' => $org->id,
            'event' => 'event.x', 'auditable_type' => 'system', 'auditable_id' => 'system',
            'old_values' => null, 'new_values' => ['k' => 'x'],
            'ip_address' => null, 'created_at' => now(),
        ]);
        $before = DB::table('audit_logs')->where('organisation_id', $org->id)->value('row_hash');

        $this->artisan('audit:rebaseline', ['--all' => true])->assertExitCode(0); // no --confirm

        $after = DB::table('audit_logs')->where('organisation_id', $org->id)->value('row_hash');
        $this->assertSame($before, $after, 'Dry run must not alter any hashes.');
        $this->assertDatabaseMissing('audit_logs', ['event' => 'audit.chain_rebaselined']);
    }
}
