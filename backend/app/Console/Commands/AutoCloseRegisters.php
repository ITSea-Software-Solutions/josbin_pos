<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\RegisterSession;
use App\Models\Store;
use Illuminate\Console\Command;

/**
 * Nightly opt-in auto-close (per store: settings.auto_close_enabled +
 * settings.auto_close_time). Any session still open past the store's cutoff
 * is sealed as SYSTEM-CLOSED — status closed, expected cash computed, but
 * no cash counted — so the next morning starts unblocked and the manager
 * gets a reconciliation task instead of a stuck till.
 *
 * Runs every 15 minutes (routes/console.php); each store is only affected
 * once its own configured time has passed. Fully audited.
 */
class AutoCloseRegisters extends Command
{
    protected $signature   = 'registers:auto-close';
    protected $description = 'Close still-open register sessions for stores that opted into nightly auto-close';

    public function handle(): int
    {
        $closed = 0;

        Store::where('is_active', true)->get()->each(function (Store $store) use (&$closed) {
            $settings = $store->settings ?? [];
            if (! ($settings['auto_close_enabled'] ?? false)) {
                return;
            }

            $time   = $settings['auto_close_time'] ?? '23:59';
            $cutoff = now()->setTimeFromTimeString($time);
            if (now()->lt($cutoff)) {
                return; // this store's cutoff hasn't passed yet today
            }

            RegisterSession::where('store_id', $store->id)
                ->where('status', 'open')
                ->where('opened_at', '<', $cutoff)
                ->get()
                ->each(function (RegisterSession $session) use ($store, &$closed) {
                    $expected = $session->computeExpectedCash();

                    $session->update([
                        'status'        => 'closed',
                        'closed_at'     => now(),
                        'expected_cash' => $expected,
                        'system_closed' => true,
                        'closing_note'  => 'system-closed: cash not counted (nightly auto-close)',
                    ]);

                    AuditLog::create([
                        'user_id'         => null,
                        'organisation_id' => $store->organisation_id,
                        'event'           => 'register.auto_closed',
                        'auditable_type'  => 'RegisterSession',
                        'auditable_id'    => $session->id,
                        'old_values'      => null,
                        'new_values'      => [
                            'store'         => $store->name,
                            'cashier_id'    => $session->cashier_id,
                            'opened_at'     => (string) $session->opened_at,
                            'expected_cash' => $expected,
                            'reason'        => 'store auto-close policy',
                        ],
                        'ip_address'      => null,
                        'created_at'      => now(),
                    ]);

                    $closed++;
                });
        });

        $this->info("Auto-closed {$closed} session(s).");

        return self::SUCCESS;
    }
}
