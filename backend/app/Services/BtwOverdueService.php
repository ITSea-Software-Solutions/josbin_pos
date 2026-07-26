<?php

namespace App\Services;

use App\Models\BtwFilingReminder;
use App\Models\BtwInspectionCase;
use App\Models\BtwSubmission;
use App\Models\Store;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Works out which active stores are overdue on their BTW filing and by how
 * long. Shared by the btw:overdue-check command (daily nudge) and the
 * inspector dashboard's overdue list so both use the exact same definition of
 * "overdue".
 */
class BtwOverdueService
{
    /**
     * One row per overdue store (empty rows for on-time stores are dropped).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function overdueStores(?string $organisationId = null): Collection
    {
        return Store::query()
            ->where('is_active', true)
            ->when($organisationId, fn ($q) => $q->where('organisation_id', $organisationId))
            ->with('organisation:id,name')
            ->get()
            ->map(function (Store $store) {
                $period     = $store->btw_filing_period_days ?: 30;
                $lastFiling = $this->lastFilingFor($store);
                $daysSince  = $this->daysSinceLastFiling($store, $lastFiling);

                if ($daysSince <= $period) {
                    return null;
                }

                return [
                    'store'                  => $store,
                    'organisation'           => $store->organisation,
                    'period_days'            => $period,
                    'last_filing_period_end' => $lastFiling?->period_end?->toDateString(),
                    'days_since_last_filing' => $daysSince,
                    'days_overdue'           => $daysSince - $period,
                    'inspector_reminders'    => $this->inspectorReminderCount($store, $lastFiling),
                    'open_case'              => BtwInspectionCase::query()
                        ->where('store_id', $store->id)
                        ->where('status', BtwInspectionCase::STATUS_OPEN)
                        ->first(),
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * Whole days since the store's last covering filing (its period_end), or
     * since the store was created if it has never filed. AST day boundaries.
     */
    public function daysSinceLastFiling(Store $store, ?BtwSubmission $lastFiling): int
    {
        $tz    = config('josbin_pos.timezone', 'America/Paramaribo');
        $today = Carbon::now($tz)->startOfDay();
        $since = $lastFiling
            ? $lastFiling->period_end->copy()->startOfDay()
            : $store->created_at->copy()->setTimezone($tz)->startOfDay();

        return (int) $since->diffInDays($today);
    }

    /**
     * Count of inspector-sent reminders since the store's last filing (or all
     * of them if the store has never filed). Resets naturally once they file.
     */
    public function inspectorReminderCount(Store $store, ?BtwSubmission $lastFiling): int
    {
        return BtwFilingReminder::query()
            ->where('store_id', $store->id)
            ->where('source', BtwFilingReminder::SOURCE_INSPECTOR)
            ->when($lastFiling, fn ($q) => $q->where('created_at', '>', $lastFiling->submitted_at ?? $lastFiling->created_at))
            ->count();
    }

    /**
     * The most recent non-superseded filing that covers this store — its own
     * per-store filing or an org-wide consolidated one (store_id null).
     */
    public function lastFilingFor(Store $store): ?BtwSubmission
    {
        return BtwSubmission::query()
            ->where('status', '!=', BtwSubmission::STATUS_SUPERSEDED)
            ->where(function ($q) use ($store) {
                $q->where('store_id', $store->id)
                  ->orWhere(fn ($qq) => $qq->where('organisation_id', $store->organisation_id)->whereNull('store_id'));
            })
            ->orderByDesc('period_end')
            ->first();
    }
}
