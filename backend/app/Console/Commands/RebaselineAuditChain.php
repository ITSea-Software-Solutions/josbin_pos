<?php

namespace App\Console\Commands;

use App\Services\AuditHashService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-time migration tool for the audit hash chain.
 *
 * The row_hash / previous_row_hash columns are computed by AuditHashService::
 * computeHash at INSERT time. When that algorithm changes (e.g. the G-023
 * canonicalisation of created_at + new_values), rows written under the OLD
 * algorithm no longer verify under the NEW one — `audit:verify` then reports a
 * mismatch at the first pre-change row, even though nothing was tampered with.
 *
 * This command recomputes the chain for every organisation in id order using
 * the CURRENT algorithm, so the historical rows verify clean again.
 *
 * ⚠️  Intended for pre-launch / algorithm-migration use only. Re-hashing a
 * live, tamper-evident chain would let a real tampered row be laundered, so
 * this requires --confirm and records itself as a platform audit event.
 *
 *   php artisan audit:rebaseline --all --confirm
 *   php artisan audit:rebaseline --org=<uuid> --confirm
 */
class RebaselineAuditChain extends Command
{
    protected $signature = 'audit:rebaseline {--org= : Organisation UUID} {--all : Rebaseline every organisation} {--confirm : Required to actually write}';

    protected $description = 'Recompute the audit hash chain under the current algorithm (algorithm-migration tool)';

    public function handle(AuditHashService $hasher): int
    {
        if (! $this->option('all') && ! $this->option('org')) {
            $this->error('Provide --org=<uuid> or --all.');
            return self::FAILURE;
        }

        // Distinct chain owners — verifyChain() works per organisation_id, so
        // we rebaseline the same partitions (NULL = platform/system rows).
        // Include EVERY partition (incl. NULL) regardless of whether its rows
        // already have hashes, so rows written hash-less (legacy + OwenIt
        // model-audits before the chaining listener existed) get sealed too.
        $orgIds = $this->option('all')
            ? DB::table('audit_logs')->distinct()->pluck('organisation_id')->all()
            : [$this->option('org')];

        if (! $this->option('confirm')) {
            $this->warn('DRY RUN — re-add --confirm to write. Chains that would be rebaselined:');
        }

        // audit_logs is append-only at the DB level (trigger rejects updates
        // beyond the initial hash stamp). Rebaselining rewrites existing
        // hashes by design, so this break-glass command — and only it —
        // lifts the guard for the duration of the run.
        if ($this->option('confirm')) {
            DB::statement('ALTER TABLE audit_logs DISABLE TRIGGER audit_logs_no_update');
        }

        $totalRows = 0;
        foreach ($orgIds as $orgId) {
            $rows = DB::table('audit_logs')
                ->where(fn ($q) => $orgId === null ? $q->whereNull('organisation_id') : $q->where('organisation_id', $orgId))
                ->orderBy('id')
                ->get(['id', 'organisation_id', 'event', 'auditable_type', 'auditable_id', 'new_values', 'created_at']);

            if ($rows->isEmpty()) {
                continue;
            }

            $label = $orgId ?? 'PLATFORM (null org)';
            $this->line("  {$label}: {$rows->count()} rows");
            $totalRows += $rows->count();

            if (! $this->option('confirm')) {
                continue;
            }

            $prev = null;
            foreach ($rows as $row) {
                $hash = $hasher->computeHash((array) $row, $prev);
                DB::table('audit_logs')->where('id', $row->id)->update([
                    'previous_row_hash' => $prev,
                    'row_hash'          => $hash,
                ]);
                $prev = $hash;
            }
        }

        if (! $this->option('confirm')) {
            $this->info("Dry run complete — {$totalRows} rows across " . count(array_filter($orgIds, fn ($o) => $o !== null || true)) . ' chain(s) would be rebaselined.');
            return self::SUCCESS;
        }

        // Record the rebaseline itself as a platform audit event (chains onto
        // the null-org partition naturally via the creating hook).
        \App\Models\AuditLog::create([
            'user_id'         => null,
            'organisation_id' => null,
            'event'           => 'audit.chain_rebaselined',
            'auditable_type'  => 'system',
            'auditable_id'    => 'system',
            'old_values'      => null,
            'new_values'      => ['rows' => $totalRows, 'reason' => 'computeHash algorithm migration'],
            'ip_address'      => null,
            'created_at'      => now(),
        ]);

        DB::statement('ALTER TABLE audit_logs ENABLE TRIGGER audit_logs_no_update');

        $this->info("Rebaselined {$totalRows} rows. Run `audit:verify --all` to confirm.");
        return self::SUCCESS;
    }
}
