<?php

namespace App\Console\Commands;

use App\Models\Organisation;
use App\Models\Store;
use App\Services\AiService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Weekly AI Sales Summary — runs every Monday at 08:00 AST.
 *
 * For each active organisation, generates a plain-language summary in the
 * organisation's preferred language (Dutch or English), comparing:
 *   - This week vs last week (revenue, transaction count, avg basket)
 *   - Top 5 products
 *   - Void rate
 *   - Payment method split
 *
 * The summary is stored in the `ai_summaries` table and optionally emailed
 * to all store managers and organisation admins.
 *
 * Falls back gracefully when OpenAI key is not configured
 * (still stores the raw stats, just without the narrative).
 */
class GenerateWeeklyAiSummary extends Command
{
    protected $signature = 'ai:weekly-summary
                            {--org= : Specific organisation UUID}
                            {--dry-run : Print output without saving}';

    protected $description = 'Generate weekly AI sales summary for all organisations';

    public function handle(AiService $ai): int
    {
        $orgs = Organisation::query()
            ->where('is_active', true)
            ->when($this->option('org'), fn ($q) => $q->where('id', $this->option('org')))
            ->get();

        foreach ($orgs as $org) {
            $this->processOrg($org, $ai);
        }

        $this->info('Weekly AI summaries generated for ' . $orgs->count() . ' organisations.');
        return self::SUCCESS;
    }

    private function processOrg(Organisation $org, AiService $ai): void
    {
        $locale   = $org->locale ?? 'nl';
        $now      = now()->setTimezone('America/Paramaribo');
        $thisFrom = $now->copy()->startOfWeek()->subDays(7)->toDateString(); // last Mon
        $thisTo   = $now->copy()->startOfWeek()->subDay()->toDateString();   // last Sun
        $prevFrom = $now->copy()->startOfWeek()->subDays(14)->toDateString();
        $prevTo   = $now->copy()->startOfWeek()->subDays(8)->toDateString();

        $storeIds = Store::where('organisation_id', $org->id)
            ->where('is_active', true)
            ->pluck('id');

        if ($storeIds->isEmpty()) return;

        $thisWeek = $this->fetchStats($storeIds->all(), $thisFrom, $thisTo);
        $lastWeek = $this->fetchStats($storeIds->all(), $prevFrom, $prevTo);
        $top5     = $this->fetchTopProducts($storeIds->all(), $thisFrom, $thisTo);

        $stats = [
            'organisation'  => $org->name,
            'period'        => ['from' => $thisFrom, 'to' => $thisTo],
            'this_week'     => $thisWeek,
            'last_week'     => $lastWeek,
            'top_products'  => $top5,
            'revenue_change_pct' => $lastWeek['total_srd'] > 0
                ? round(($thisWeek['total_srd'] - $lastWeek['total_srd']) / $lastWeek['total_srd'] * 100, 1)
                : null,
            'transaction_change_pct' => $lastWeek['count'] > 0
                ? round(($thisWeek['count'] - $lastWeek['count']) / $lastWeek['count'] * 100, 1)
                : null,
        ];

        $narrative = $ai->isConfigured()
            ? $this->generateNarrative($ai, $stats, $locale)
            : $this->buildFallbackNarrative($stats, $locale);

        $summary = [
            'stats'     => $stats,
            'narrative' => $narrative,
            'locale'    => $locale,
            'generated_at' => $now->toIso8601String(),
        ];

        if ($this->option('dry-run')) {
            $this->line("\n=== {$org->name} ===");
            $this->line($narrative ?? '(no narrative)');
            $this->line(json_encode($stats, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return;
        }

        // Store in database
        DB::table('ai_summaries')->updateOrInsert(
            ['organisation_id' => $org->id, 'week_start' => $thisFrom],
            [
                'narrative'   => $narrative,
                'stats'       => json_encode($stats, JSON_UNESCAPED_UNICODE),
                'locale'      => $locale,
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        );

        Log::info('[AiSummary] Generated summary', ['org' => $org->name, 'week' => $thisFrom]);
    }

    private function fetchStats(array $storeIds, string $from, string $to): array
    {
        $row = DB::table('sales')
            ->whereIn('store_id', $storeIds)
            ->where('status', 'completed')
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to])
            ->selectRaw('
                COUNT(*) as count,
                COALESCE(SUM(total_srd), 0) as total_srd,
                COALESCE(AVG(total_srd), 0) as avg_basket,
                COALESCE(SUM(btw_srd), 0) as total_btw,
                SUM(CASE WHEN payment_method = \'cash\' THEN 1 ELSE 0 END) as cash_count,
                SUM(CASE WHEN payment_method = \'card\' THEN 1 ELSE 0 END) as card_count
            ')
            ->first();

        $voids = DB::table('sales')
            ->whereIn('store_id', $storeIds)
            ->where('status', 'voided')
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to])
            ->count();

        return [
            'count'      => (int)   ($row->count ?? 0),
            'total_srd'  => (float) ($row->total_srd ?? 0),
            'avg_basket' => (float) ($row->avg_basket ?? 0),
            'total_btw'  => (float) ($row->total_btw ?? 0),
            'void_count' => $voids,
            'cash_count' => (int)   ($row->cash_count ?? 0),
            'card_count' => (int)   ($row->card_count ?? 0),
        ];
    }

    private function fetchTopProducts(array $storeIds, string $from, string $to): array
    {
        return DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereIn('sales.store_id', $storeIds)
            ->where('sales.status', 'completed')
            ->whereBetween(DB::raw("DATE(sales.occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to])
            ->groupBy('sale_items.product_name_snapshot')
            ->select([
                'sale_items.product_name_snapshot as name',
                DB::raw('SUM(sale_items.quantity) as qty'),
                DB::raw('SUM(sale_items.line_total_srd) as revenue'),
            ])
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->toArray();
    }

    private function generateNarrative(AiService $ai, array $stats, string $locale): ?string
    {
        $lang = $locale === 'nl' ? 'Dutch' : 'English';
        $s    = $stats['this_week'];
        $prev = $stats['last_week'];
        $chg  = $stats['revenue_change_pct'];
        $top  = array_slice((array) $stats['top_products'], 0, 3);

        $topNames = implode(', ', array_map(fn ($p) => ((object) $p)->name, $top));

        $systemPrompt = "You are a helpful retail analyst assistant for Josbin POS in Suriname. " .
            "Generate a concise Monday morning sales summary in {$lang}. " .
            "Use a friendly, professional tone. 3-4 sentences. Include key metrics naturally. " .
            "All amounts in SRD (Surinamese Dollar). Dates in format dd-mm-yyyy.";

        $userMessage = sprintf(
            "Weekly summary for %s (%s to %s):\n" .
            "This week: SRD %.2f revenue, %d transactions, avg basket SRD %.2f, %d voids\n" .
            "Last week: SRD %.2f revenue, %d transactions\n" .
            "Revenue change: %s%%\n" .
            "Top products: %s\n" .
            "Payment: %d cash / %d card",
            $stats['organisation'],
            $stats['period']['from'],
            $stats['period']['to'],
            $s['total_srd'], $s['count'], $s['avg_basket'], $s['void_count'],
            $prev['total_srd'], $prev['count'],
            $chg !== null ? ($chg >= 0 ? '+' . $chg : (string) $chg) : 'N/A',
            $topNames ?: 'N/A',
            $s['cash_count'], $s['card_count'],
        );

        return $ai->complete($systemPrompt, $userMessage, 400);
    }

    private function buildFallbackNarrative(array $stats, string $locale): string
    {
        $s   = $stats['this_week'];
        $chg = $stats['revenue_change_pct'];
        $nl  = $locale === 'nl';

        if ($nl) {
            $trend = $chg === null ? '' : ($chg >= 0
                ? sprintf(' Dit is %.1f%% hoger dan vorige week.', $chg)
                : sprintf(' Dit is %.1f%% lager dan vorige week.', abs($chg)));
            return sprintf(
                'Weekoverzicht %s – %s: SRD %.2f omzet in %d transacties (gemiddeld SRD %.2f per bon).%s %d annuleringen geregistreerd.',
                $stats['period']['from'], $stats['period']['to'],
                $s['total_srd'], $s['count'], $s['avg_basket'],
                $trend,
                $s['void_count'],
            );
        } else {
            $trend = $chg === null ? '' : ($chg >= 0
                ? sprintf(' This is %.1f%% higher than last week.', $chg)
                : sprintf(' This is %.1f%% lower than last week.', abs($chg)));
            return sprintf(
                'Weekly summary %s – %s: SRD %.2f revenue across %d transactions (avg SRD %.2f per sale).%s %d voids recorded.',
                $stats['period']['from'], $stats['period']['to'],
                $s['total_srd'], $s['count'], $s['avg_basket'],
                $trend,
                $s['void_count'],
            );
        }
    }
}
