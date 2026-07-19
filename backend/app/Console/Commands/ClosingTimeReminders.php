<?php

namespace App\Console\Commands;

use App\Models\RegisterSession;
use App\Models\Store;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

/**
 * Closing-time nudge (per store: settings.closing_time). Once the store's
 * configured closing hour has passed and a session is still open, the
 * store's managers get ONE in-app (+mail) notification for that day —
 * deduplicated via a cache flag per store per date.
 */
class ClosingTimeReminders extends Command
{
    protected $signature   = 'registers:closing-reminder';
    protected $description = 'Notify managers when a register is still open past the store closing time';

    public function handle(): int
    {
        $sent = 0;

        Store::where('is_active', true)->get()->each(function (Store $store) use (&$sent) {
            $time = ($store->settings ?? [])['closing_time'] ?? null;
            if (! $time) {
                return;
            }
            if (now()->lt(now()->setTimeFromTimeString($time))) {
                return;
            }

            $openSessions = RegisterSession::with('cashier:id,name')
                ->where('store_id', $store->id)
                ->where('status', 'open')
                ->get();
            if ($openSessions->isEmpty()) {
                return;
            }

            // One nudge per store per day.
            if (! Cache::add("closing-reminder:{$store->id}:" . today()->toDateString(), true, now()->addDay())) {
                return;
            }

            $managers = User::where('organisation_id', $store->organisation_id)
                ->where('is_active', true)
                ->where(function ($q) use ($store) {
                    $q->where('role', User::ROLE_ORGANISATION_ADMIN)
                      ->orWhere(function ($qq) use ($store) {
                          $qq->where('role', User::ROLE_STORE_MANAGER)
                             ->where(fn ($s) => $s->whereNull('store_id')->orWhere('store_id', $store->id));
                      });
                })
                ->get();

            foreach ($openSessions as $session) {
                Notification::send($managers, new \App\Notifications\RegisterStillOpen($store, $session));
            }
            $sent += $managers->count();
        });

        $this->info("Closing reminders sent to {$sent} manager(s).");

        return self::SUCCESS;
    }
}
