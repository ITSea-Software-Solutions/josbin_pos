<?php

namespace App\Services;

use App\Models\BtwSubmission;
use App\Models\Sale;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Computes the snapshot totals for a BTW submission and assembles the
 * canonical payload that gets persisted + hashed.
 *
 * Sales scope:
 *   - status = 'completed' only (voids/refunds are excluded — they'll show
 *     up as a NEGATIVE entry in the next period's filing via the refund row,
 *     same as paper-world accounting)
 *   - source = 'pos' OR 'api' (excludes 'import' = historical backfills)
 *   - occurred_at within [period_start 00:00, period_end 23:59:59.999] AST
 *
 * BTW calc:
 *   - total_sales_srd = sum of total_srd
 *   - btw_exempt_srd  = sum of total_srd where the sale's btw_srd == 0
 *     (we don't track per-product exempt on the sale row, but a sale with
 *     zero BTW is by definition entirely exempt — this is a useful proxy)
 *   - btw_taxable_srd = total_sales_srd - btw_exempt_srd
 *   - total_btw_srd   = sum of btw_srd
 */
class BtwSubmissionService
{
    /**
     * Compute period totals WITHOUT persisting — used by the preview endpoint
     * so the OA can confirm the numbers before clicking Submit.
     *
     * @return array{
     *   sales_count:int,
     *   total_sales_srd:string,
     *   btw_exempt_srd:string,
     *   btw_taxable_srd:string,
     *   total_btw_srd:string,
     *   sale_ids:array<int,string>,
     * }
     */
    public function computeTotals(string $organisationId, ?string $storeId, Carbon $start, Carbon $end): array
    {
        $query = Sale::query()
            ->where('status', 'completed')
            ->whereIn('source', ['pos', 'api'])
            ->whereBetween('occurred_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()]);

        // Org scope: join through stores since sales.store_id is the link.
        $query->whereHas('store', function ($q) use ($organisationId) {
            $q->where('organisation_id', $organisationId);
        });

        if ($storeId !== null) {
            $query->where('store_id', $storeId);
        }

        $sales = $query->orderBy('occurred_at')->get(['id', 'total_srd', 'btw_srd']);

        $totalSales  = '0.00';
        $totalBtw    = '0.00';
        $saleIds     = [];

        foreach ($sales as $sale) {
            $totalSales = bcadd($totalSales, (string) $sale->total_srd, 2);
            $totalBtw   = bcadd($totalBtw,   (string) $sale->btw_srd,   2);
            $saleIds[]  = $sale->id;
        }

        // Exempt revenue must come from the LINE ITEMS, not a sale-level
        // proxy. The old heuristic — "btw_srd == 0 ⇒ the whole sale is
        // exempt" — misclassified every MIXED basket: a sale with one exempt
        // line (rice) and one taxable line (cola) has btw_srd > 0, so its
        // exempt portion was silently counted as taxable. Belastingdienst
        // needs the exempt split (basisvoedsel / medicijnen) reported
        // separately, so sum the genuinely-exempt lines directly. This also
        // matches how the consolidated BTW report already groups by
        // sale_items.btw_exempt.
        $btwExempt = '0.00';
        if (! empty($saleIds)) {
            $exemptRaw = DB::table('sale_items')
                ->whereIn('sale_id', $saleIds)
                ->where('btw_exempt', true)
                ->sum('line_total_srd');
            $btwExempt = bcadd((string) ($exemptRaw ?? '0'), '0', 2);
        }

        // Taxable = everything that isn't exempt. Clamp at 0 so a rounding
        // wobble (exempt items summing a cent above the sale totals on a
        // discounted basket) can never produce a negative taxable figure.
        $btwTaxable = bcsub($totalSales, $btwExempt, 2);
        if (bccomp($btwTaxable, '0', 2) < 0) {
            $btwTaxable = '0.00';
        }

        return [
            'sales_count'      => count($saleIds),
            'total_sales_srd'  => $totalSales,
            'btw_exempt_srd'   => $btwExempt,
            'btw_taxable_srd'  => $btwTaxable,
            'total_btw_srd'    => $totalBtw,
            'sale_ids'         => $saleIds,
        ];
    }

    /**
     * Build a human-readable filing reference.
     * Pattern: BTW-{YYYY}-{MM}-{ORGSLUG}-{DAILY|MTH}-{NNN}
     * where NNN is the per-org sequence within this period type+month, so
     * resubmissions get -002, -003 etc.
     */
    public function nextReference(string $organisationId, string $periodType, Carbon $start): string
    {
        $orgSlug = strtoupper(substr(preg_replace('/[^A-Z0-9]/i', '',
            \App\Models\Organisation::where('id', $organisationId)->value('name') ?? 'ORG'), 0, 8));

        $tag = match ($periodType) {
            BtwSubmission::PERIOD_MONTHLY => 'MTH',
            BtwSubmission::PERIOD_WEEKLY  => 'WK',
            default                       => 'DAY',
        };

        $count = BtwSubmission::where('organisation_id', $organisationId)
            ->where('period_type', $periodType)
            ->whereYear('period_start', $start->year)
            ->whereMonth('period_start', $start->month)
            ->count();

        return sprintf(
            'BTW-%04d-%02d-%s-%s-%03d',
            $start->year, $start->month, $orgSlug, $tag, $count + 1,
        );
    }

    /**
     * Compute the prev_hash → current_hash for the audit chain. Same shape
     * as the audit_logs hash chain (sha256 of canonical JSON).
     *
     * The chain is PER-ORGANISATION. A taxpayer's filings must form one
     * continuous, self-contained chain — if `prev` were the last submission
     * across ALL orgs, org B filing a return would become a link in org A's
     * sequence, so `verify-chain` for a single taxpayer would break the
     * moment another org filed, and `prev_hash` would prove nothing about
     * that taxpayer's continuity.
     *
     * Ordered by `submitted_at` (with `created_at` as a tiebreaker) since the
     * UUID PK is not monotonic. Two filings by the SAME org in the same
     * millisecond is not a real scenario — one OA files one return at a time
     * — so the global same-millisecond race the audit flagged is gone once
     * the chain is org-scoped.
     *
     * @return array{prev_hash:?string,current_hash:string}
     */
    public function hashChain(string $organisationId, array $canonicalRow): array
    {
        $prev = BtwSubmission::query()
            ->where('organisation_id', $organisationId)
            ->orderByDesc('submitted_at')
            ->orderByDesc('created_at')
            ->value('current_hash');

        $payload = json_encode($canonicalRow, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $current = hash('sha256', ($prev ?? '') . '|' . $payload);

        return ['prev_hash' => $prev, 'current_hash' => $current];
    }
}
