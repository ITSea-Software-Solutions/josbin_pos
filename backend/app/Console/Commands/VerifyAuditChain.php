<?php

namespace App\Console\Commands;

use App\Services\AuditHashService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * php artisan audit:verify [--org=uuid] [--all]
 *
 * Verifies the SHA-256 hash chain for audit logs.
 * Used by:
 *  - Manual compliance checks before Rekenkamer submissions
 *  - Automated nightly CI job
 *  - Post-incident forensic analysis
 */
class VerifyAuditChain extends Command
{
    protected $signature = 'audit:verify
                            {--org= : Verify a specific organisation UUID}
                            {--all  : Verify all organisations (may take a while on large datasets)}';

    protected $description = 'Verify the SHA-256 hash chain integrity of the audit log';

    public function __construct(private readonly AuditHashService $hasher)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if (! $this->option('org') && ! $this->option('all')) {
            $this->error('Provide --org=uuid or --all');
            return self::FAILURE;
        }

        $orgIds = $this->option('all')
            ? DB::table('audit_logs')->whereNotNull('organisation_id')->distinct()->pluck('organisation_id')
            : collect([$this->option('org')]);

        $allValid = true;

        foreach ($orgIds as $orgId) {
            $orgName = DB::table('organisations')->where('id', $orgId)->value('name') ?? $orgId;
            $this->info("Verifying chain for: {$orgName}");

            $result = $this->hasher->verifyChain($orgId);

            if ($result['valid']) {
                $this->line("  <fg=green>✓ VALID</> — {$result['checked']} rows verified");
            } else {
                $allValid = false;
                $this->line("  <fg=red>✗ BROKEN</> — {$result['message']}");
                $this->line("  <fg=red>  Broken at row ID: {$result['broken_at_id']}</>");

                // Log the integrity failure to the system audit trail
                DB::table('audit_logs')->insert([
                    'user_id'         => null,
                    'organisation_id' => $orgId,
                    'event'           => 'audit_chain_integrity_failure',
                    'auditable_type'  => 'audit_log',
                    'auditable_id'    => $result['broken_at_id'],
                    'old_values'      => null,
                    'new_values'      => json_encode($result),
                    'ip_address'      => '127.0.0.1',
                    'created_at'      => now(),
                ]);
            }
        }

        if ($allValid) {
            $this->newLine();
            $this->info('All audit chains are intact.');
            return self::SUCCESS;
        }

        $this->newLine();
        $this->error('One or more audit chains have integrity failures. Investigate immediately.');
        return self::FAILURE;
    }
}
