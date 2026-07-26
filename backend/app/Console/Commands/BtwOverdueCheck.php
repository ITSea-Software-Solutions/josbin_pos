<?php

namespace App\Console\Commands;

use App\Models\BtwFilingReminder;
use App\Models\User;
use App\Notifications\BtwFilingOverdue;
use App\Services\BtwOverdueService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

/**
 * Daily BTW late-filing nudge. For each active store past its
 * btw_filing_period_days without a covering filing, the store's managers get
 * ONE in-app (+ mail) reminder per day (deduped via a cache flag per store per
 * date), and the nudge is logged as an `auto` reminder so it shows up in the
 * inspector's reminder history.
 */
class BtwOverdueCheck extends Command
{
    protected $signature   = 'btw:overdue-check';
    protected $description = 'Notify stores whose BTW filing is overdue and log the nudge';

    public function handle(BtwOverdueService $service): int
    {
        $sent = 0;

        foreach ($service->overdueStores() as $row) {
            $store = $row['store'];

            // One automatic nudge per store per day.
            if (! Cache::add("btw-overdue:{$store->id}:" . today()->toDateString(), true, now()->addDay())) {
                continue;
            }

            $managers = User::query()
                ->where('organisation_id', $store->organisation_id)
                ->where('is_active', true)
                ->where(function ($q) use ($store) {
                    $q->where('role', User::ROLE_ORGANISATION_ADMIN)
                      ->orWhere(function ($qq) use ($store) {
                          $qq->where('role', User::ROLE_STORE_MANAGER)
                             ->where(fn ($s) => $s->whereNull('store_id')->orWhere('store_id', $store->id));
                      });
                })
                ->get();

            if ($managers->isNotEmpty()) {
                Notification::send(
                    $managers,
                    new BtwFilingOverdue($store, $row['days_overdue'], BtwFilingReminder::SOURCE_AUTO)
                );
            }

            BtwFilingReminder::create([
                'store_id'        => $store->id,
                'organisation_id' => $store->organisation_id,
                'source'          => BtwFilingReminder::SOURCE_AUTO,
                'sent_by'         => null,
                'days_overdue'    => $row['days_overdue'],
            ]);

            $sent++;
        }

        $this->info("BTW overdue nudges sent for {$sent} store(s).");

        return self::SUCCESS;
    }
}
