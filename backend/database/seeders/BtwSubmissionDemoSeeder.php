<?php

namespace Database\Seeders;

use App\Models\BtwSubmission;
use App\Models\Organisation;
use App\Models\User;
use App\Services\BtwSubmissionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Demo BTW filings so the Belastingdienst inspector screens have realistic
 * data: several months of monthly filings per non-government org, backdated so
 * the list shows a proper newest-first spread, with a mix of statuses
 * (filed / accepted / disputed) for the review workflow.
 *
 * Idempotent — skips a period that already has a filing. Goes through
 * BtwSubmissionService so totals + the per-org hash chain are valid.
 */
class BtwSubmissionDemoSeeder extends Seeder
{
    public function run(): void
    {
        $service = app(BtwSubmissionService::class);

        $inspector = User::where('role', User::ROLE_TAX_INSPECTOR)->first();

        $orgs = Organisation::where('is_government', false)->where('is_active', true)->get();
        if ($orgs->isEmpty()) {
            $this->command?->warn('BtwSubmissionDemoSeeder: no orgs found — skipping.');
            return;
        }

        $now = Carbon::now('America/Paramaribo');

        foreach ($orgs as $org) {
            // A submitter from this org (OA preferred, else any active user).
            $submitter = User::where('organisation_id', $org->id)
                ->whereIn('role', [User::ROLE_ORGANISATION_ADMIN, User::ROLE_STORE_MANAGER])
                ->first()
                ?? User::where('organisation_id', $org->id)->first();
            if (! $submitter) {
                continue;
            }

            // Last 6 complete months, oldest first so the hash chain links forward.
            for ($monthsAgo = 6; $monthsAgo >= 1; $monthsAgo--) {
                $start = $now->copy()->subMonths($monthsAgo)->startOfMonth();
                $end   = $start->copy()->endOfMonth();

                $exists = BtwSubmission::where('organisation_id', $org->id)
                    ->where('period_type', 'monthly')
                    ->where('period_start', $start->toDateString())
                    ->where('period_end', $end->toDateString())
                    ->exists();
                if ($exists) {
                    continue;
                }

                $this->createFiling($service, $org, $submitter, $inspector, 'monthly', $start, $end, $monthsAgo);
            }
        }

        $this->command?->info('BtwSubmissionDemoSeeder: demo BTW filings ready.');
    }

    private function createFiling(
        BtwSubmissionService $service,
        Organisation $org,
        User $submitter,
        ?User $inspector,
        string $periodType,
        Carbon $start,
        Carbon $end,
        int $monthsAgo,
    ): void {
        $totals = $service->computeTotals($org->id, null, $start, $end);

        // A filing is submitted a few days into the next month.
        $submittedAt = $end->copy()->addDays(3)->setTime(9, 30);
        $reference   = $service->nextReference($org->id, $periodType, $start);

        $canonical = [
            'organisation_id' => $org->id,
            'store_id'        => null,
            'period_type'     => $periodType,
            'period_start'    => $start->toDateString(),
            'period_end'      => $end->toDateString(),
            'sales_count'     => $totals['sales_count'],
            'total_sales_srd' => $totals['total_sales_srd'],
            'btw_exempt_srd'  => $totals['btw_exempt_srd'],
            'btw_taxable_srd' => $totals['btw_taxable_srd'],
            'total_btw_srd'   => $totals['total_btw_srd'],
            'submitted_at'    => $submittedAt->toIso8601String(),
            'submitted_by'    => $submitter->id,
            'reference'       => $reference,
        ];
        $hash = $service->hashChain($org->id, $canonical);

        // Status spread: the two most recent months stay "filed" (pending the
        // inspector's review); one mid-range month is "disputed"; the rest are
        // "accepted" and carry reviewer attribution.
        $status = match (true) {
            $monthsAgo <= 2          => BtwSubmission::STATUS_FILED,
            $monthsAgo === 4         => BtwSubmission::STATUS_DISPUTED,
            default                  => BtwSubmission::STATUS_ACCEPTED,
        };

        $reviewed = $status !== BtwSubmission::STATUS_FILED && $inspector;

        BtwSubmission::create([
            'organisation_id' => $org->id,
            'store_id'        => null,
            'period_type'     => $periodType,
            'period_start'    => $start->toDateString(),
            'period_end'      => $end->toDateString(),
            'sales_count'     => $totals['sales_count'],
            'total_sales_srd' => $totals['total_sales_srd'],
            'btw_exempt_srd'  => $totals['btw_exempt_srd'],
            'btw_taxable_srd' => $totals['btw_taxable_srd'],
            'total_btw_srd'   => $totals['total_btw_srd'],
            'status'          => $status,
            'submitted_at'    => $submittedAt,
            'submitted_by'    => $submitter->id,
            'reference'       => $reference,
            'submitter_note'  => $monthsAgo === 4 ? 'Eén kassa-einde ontbrak; aangevuld in de volgende periode.' : null,
            'sale_ids'        => $totals['sale_ids'],
            'prev_hash'       => $hash['prev_hash'],
            'current_hash'    => $hash['current_hash'],
            'reviewed_at'     => $reviewed ? $submittedAt->copy()->addDays(2) : null,
            'reviewed_by'     => $reviewed ? $inspector->id : null,
            'inspector_note'  => $status === BtwSubmission::STATUS_DISPUTED
                ? 'Totalen wijken af van de aanvullende Z-rapporten — gaarne corrigeren.'
                : ($status === BtwSubmission::STATUS_ACCEPTED ? 'Geverifieerd en akkoord.' : null),
        ]);
    }
}
