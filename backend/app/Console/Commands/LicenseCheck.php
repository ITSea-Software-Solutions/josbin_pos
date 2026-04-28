<?php

namespace App\Console\Commands;

use App\Services\LicenseService;
use Illuminate\Console\Command;

/**
 * Scheduled license validation command.
 * Runs at 00:05 AST daily (after exchange rate fetch at 06:00 AST).
 *
 * Schedule (bootstrap/app.php or routes/console.php):
 *   Schedule::command('license:check')->dailyAt('00:05')->timezone('America/Paramaribo');
 */
class LicenseCheck extends Command
{
    protected $signature   = 'license:check {--force : Bypass cache and validate immediately}';
    protected $description = 'Validate the Josbin POS installation license with the license server';

    public function handle(LicenseService $license): int
    {
        $this->info('[Josbin POS] Checking license...');

        try {
            $status = $this->option('force')
                ? $license->forceCheck()
                : $license->getStatus();

            match ($status) {
                'active'      => $this->info("[Josbin POS] License valid. Status: {$status}"),
                'warning_30'  => $this->warn('[Josbin POS] License expires in ~30 days. Renewal recommended.'),
                'warning_14'  => $this->warn('[Josbin POS] License expires in ~14 days. Renew immediately.'),
                'grace'       => $this->warn('[Josbin POS] License in grace period. New sales still allowed. Renew now.'),
                'soft_lock'   => $this->error('[Josbin POS] SOFT LOCK — new sales blocked. License overdue.'),
                'hard_lock'   => $this->error('[Josbin POS] HARD LOCK — all operations blocked. Contact Josbin POS.'),
                default       => $this->error("[Josbin POS] Unexpected license status: {$status}"),
            };

            $this->line("Status: {$status} | Checked at: " . now()->toDateTimeString());
            return self::SUCCESS;

        } catch (\Exception $e) {
            $this->error('[Josbin POS] License check failed: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}
