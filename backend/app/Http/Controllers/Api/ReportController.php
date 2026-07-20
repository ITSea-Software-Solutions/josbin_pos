<?php

namespace App\Http\Controllers\Api;

use App\Events\ZReportSubmitted;
use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\ZReport;
use App\Support\AstDates;
use App\Support\ReportCache;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    // ─── Daily Report ─────────────────────────────────────────────────────

    /** GET /api/reports/daily */
    public function daily(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.daily'), 403);

        $request->validate([
            'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date'     => ['nullable', 'date_format:Y-m-d'],
        ]);

        $date    = $request->input('date', today()->toDateString());
        $storeId = $request->input('store_id');

        // Cached (PERF): 60 s for today, 15 min for past days. The key is
        // shared with xReport() — identical underlying aggregation.
        $data = ReportCache::remember(
            $request->user(), 'reports.daily',
            ['store_id' => $storeId, 'date' => $date], $date,
            fn () => $this->buildDailySummary($storeId, $date),
        );

        return response()->json(['data' => $data]);
    }

    // ─── Monthly Report ───────────────────────────────────────────────────

    /** GET /api/reports/monthly */
    public function monthly(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.monthly'), 403);

        $request->validate([
            'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'year'     => ['required', 'integer', 'min:2020'],
            'month'    => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $from = Carbon::create($request->integer('year'), $request->integer('month'), 1)
            ->startOfMonth()->toDateString();
        $to   = Carbon::create($request->integer('year'), $request->integer('month'), 1)
            ->endOfMonth()->toDateString();

        $storeId = $request->input('store_id');
        $period  = $request->integer('year') . '-' . str_pad($request->integer('month'), 2, '0', STR_PAD_LEFT);

        // Cached (PERF): a past month never touches today → 15 min TTL; the
        // current month ends on/after today → 60 s TTL.
        $data = ReportCache::remember(
            $request->user(), 'reports.monthly',
            ['store_id' => $storeId, 'from' => $from, 'to' => $to], $to,
            function () use ($storeId, $from, $to, $period) {
                $data = $this->buildRangeSummary($storeId, $from, $to);
                $data['period'] = $period;

                return $data;
            },
        );

        return response()->json(['data' => $data]);
    }

    // ─── Custom Range ─────────────────────────────────────────────────────

    /** GET /api/reports/custom */
    public function custom(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.custom'), 403);

        $request->validate([
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        $storeId = $request->input('store_id');
        $from    = $request->input('date_from');
        $to      = $request->input('date_to');

        // Cached (PERF): 60 s when the range includes today, 15 min when past.
        $data = ReportCache::remember(
            $request->user(), 'reports.custom',
            ['store_id' => $storeId, 'from' => $from, 'to' => $to], $to,
            fn () => $this->buildRangeSummary($storeId, $from, $to),
        );

        return response()->json(['data' => $data]);
    }

    // ─── Top Products ─────────────────────────────────────────────────────

    /** GET /api/reports/top-products */
    public function topProducts(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.top_products'), 403);

        $request->validate([
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
            'limit'     => ['nullable', 'integer', 'min:5', 'max:50'],
        ]);

        $limit    = $request->integer('limit', 10);
        $storeId  = $request->input('store_id');
        $dateFrom = $request->input('date_from', today()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', today()->toDateString());

        // Cached (PERF) — keyed on the RESOLVED defaults so "no params" and
        // an explicit month-to-date request share one entry.
        $products = ReportCache::remember(
            $request->user(), 'reports.top-products',
            ['store_id' => $storeId, 'from' => $dateFrom, 'to' => $dateTo, 'limit' => $limit], $dateTo,
            fn () => DB::table('sale_items')
                ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                ->where('sales.store_id', $storeId)
                ->where('sales.status', 'completed')
                ->where('sales.occurred_at', '>=', AstDates::dayStart($dateFrom))
                ->where('sales.occurred_at', '<', AstDates::dayAfter($dateTo))
                ->groupBy('sale_items.product_name_snapshot')
                ->select([
                    'sale_items.product_name_snapshot as product_name',
                    DB::raw('SUM(sale_items.quantity) as total_qty'),
                    DB::raw('SUM(sale_items.line_total_srd) as total_revenue'),
                    DB::raw('COUNT(DISTINCT sales.id) as sale_count'),
                ])
                ->orderByDesc('total_revenue')
                ->limit($limit)
                ->get(),
        );

        return response()->json([
            'store_id'   => $storeId,
            'date_from'  => $dateFrom,
            'date_to'    => $dateTo,
            'products'   => $products,
        ]);
    }

    // ─── X-Report (mid-day snapshot) ──────────────────────────────────────

    /** GET /api/reports/x-report */
    public function xReport(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.x_report'), 403);

        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);

        $storeId = $request->input('store_id');
        $today   = today()->toDateString();

        // Same aggregation as the daily report — deliberately SHARES the
        // "reports.daily" cache entry (60 s TTL). generated_at is stamped
        // per-request below, outside the cache, so the printed snapshot
        // timestamp stays honest.
        $summary = ReportCache::remember(
            $request->user(), 'reports.daily',
            ['store_id' => $storeId, 'date' => $today], $today,
            fn () => $this->buildDailySummary($storeId, $today),
        );
        $summary['type'] = 'X-Report';
        $summary['generated_at'] = now()->setTimezone('America/Paramaribo')->toIso8601String();
        $summary['note'] = 'Dit is een tussentijds overzicht. De kassalade is NIET afgesloten.';

        return response()->json(['data' => $summary]);
    }

    // ─── Z-Report (end of day / register close) ───────────────────────────

    /** POST /api/reports/z-report */
    public function zReport(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('z_report.close'), 403);

        $request->validate([
            'store_id'              => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'actual_cash_srd'       => ['required', 'numeric', 'min:0'],
            'discrepancy_note'      => ['nullable', 'string', 'max:500'],
        ]);

        $storeId    = $request->input('store_id');

        // Store Manager must be assigned to the store they're closing.
        abort_unless($request->user()->canAccessStore($storeId), 403, 'Store not assigned to user.');
        $reportDate = today()->toDateString();

        // Check not already closed today
        $existing = ZReport::where('store_id', $storeId)
            ->where('report_date', $reportDate)
            ->first();
        if ($existing) {
            return response()->json([
                'message'  => __('errors.register_day_already_closed'),
                'code'     => 'ALREADY_CLOSED',
                'z_report' => $existing,
            ], 409);
        }

        $summary = $this->buildDailySummary($storeId, $reportDate);
        $cashExpected = (float) ($summary['cash_total_srd'] ?? 0);
        $cashActual   = (float) $request->input('actual_cash_srd');
        $discrepancy  = round($cashActual - $cashExpected, 2);

        $zReport = ZReport::create([
            'store_id'             => $storeId,
            'closed_by'            => $request->user()->id,
            'report_date'          => $reportDate,
            'total_sales_srd'      => $summary['total_sales_srd'],
            'transaction_count'    => $summary['transaction_count'],
            'total_btw_srd'        => $summary['total_btw_srd'],
            'cash_total_srd'       => $summary['cash_total_srd'] ?? 0,
            'card_total_srd'       => $summary['card_total_srd'] ?? 0,
            'mixed_total_srd'           => $summary['mixed_total_srd'] ?? 0,
            'bank_transfer_total_srd'   => $summary['bank_transfer_total_srd'] ?? 0,
            'mobile_transfer_total_srd' => $summary['mobile_transfer_total_srd'] ?? 0,
            'foreign_cash_total_srd'    => $summary['foreign_cash_total_srd'] ?? 0,
            'qr_payment_total_srd'      => $summary['qr_payment_total_srd'] ?? 0,
            'expected_cash_srd'    => $cashExpected,
            'actual_cash_srd'      => $cashActual,
            'cash_discrepancy_srd' => $discrepancy,
            'discrepancy_note'     => $discrepancy != 0 ? $request->input('discrepancy_note') : null,
            'top_products'         => $summary['top_products'] ?? [],
            'btw_breakdown'        => $summary['btw_breakdown'] ?? [],
            'sync_status'          => 'pending',
            'closed_at'            => now(),
        ]);

        return response()->json([
            'data'    => $zReport,
            'summary' => $summary,
        ], 201);
    }

    /**
     * POST /api/reports/z-report/{zReport}/submit
     *
     * Manual "Submit to Headquarters" — sync option C. Pushes a closed
     * Z-Report to the cloud Super Admin Dashboard, marks it sent, and
     * broadcasts ZReportSubmitted so the dashboard store card updates live.
     */
    public function submitZReport(Request $request, ZReport $zReport): JsonResponse
    {
        abort_unless($request->user()?->can('z_report.submit'), 403);

        if ($zReport->sync_status === 'sent') {
            return response()->json([
                'message' => __('errors.z_report_already_sent'),
                'code'    => 'ALREADY_SENT',
                'data'    => $zReport,
            ], 409);
        }

        $zReport->update([
            'sync_status' => 'sent',
            'synced_at'   => now(),
        ]);

        // Broadcast to the org channel so the Super Admin Dashboard updates live.
        ZReportSubmitted::dispatch($zReport->fresh('store'));

        return response()->json(['data' => $zReport->fresh()]);
    }

    /** GET /api/reports/z-report/history */
    public function zReportHistory(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('z_report.view_history'), 403);

        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);

        $history = ZReport::where('store_id', $request->input('store_id'))
            ->orderByDesc('report_date')
            ->take(7)
            ->get();

        return response()->json(['data' => $history]);
    }

    // ─── BTW Report (Belastingdienst format) ──────────────────────────────

    /** GET /api/reports/btw */
    public function btwReport(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.btw'), 403);

        $request->validate([
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d'],
        ]);

        $storeId  = $request->input('store_id');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        // Cached (PERF): BTW filings are usually run over closed past periods
        // → 15 min TTL; a range touching today falls back to 60 s.
        $payload = ReportCache::remember(
            $request->user(), 'reports.btw',
            ['store_id' => $storeId, 'from' => $dateFrom, 'to' => $dateTo], $dateTo,
            function () use ($storeId, $dateFrom, $dateTo) {
                $breakdown = DB::table('sale_items')
                    ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                    ->where('sales.store_id', $storeId)
                    ->where('sales.status', 'completed')
                    ->where('sales.occurred_at', '>=', AstDates::dayStart($dateFrom))
                    ->where('sales.occurred_at', '<', AstDates::dayAfter($dateTo))
                    ->groupBy('sale_items.btw_rate', 'sale_items.btw_exempt')
                    ->select([
                        'sale_items.btw_rate',
                        'sale_items.btw_exempt',
                        DB::raw('SUM(sale_items.line_total_srd) as gross_incl_btw'),
                        DB::raw('SUM(sale_items.btw_srd) as btw_amount'),
                        DB::raw('SUM(sale_items.line_total_srd) - SUM(sale_items.btw_srd) as net_excl_btw'),
                    ])
                    ->orderBy('sale_items.btw_exempt')
                    ->orderBy('sale_items.btw_rate')
                    ->get();

                return [
                    'store_id'    => $storeId,
                    'date_from'   => $dateFrom,
                    'date_to'     => $dateTo,
                    'breakdown'   => $breakdown,
                    'total_btw'   => number_format($breakdown->sum('btw_amount'), 2, '.', ''),
                    'format'      => 'Belastingdienst Suriname',
                ];
            },
        );

        return response()->json($payload);
    }

    // ─── PDF export ───────────────────────────────────────────────────────

    /** GET /api/reports/export */
    public function export(Request $request): Response
    {
        abort_unless($request->user()?->can('reports.export'), 403);

        // Each type takes the SAME params as its JSON sibling endpoint:
        // daily → ?date, monthly → ?year&month, custom → ?date_from&date_to.
        // 'btw' is intentionally absent — the Belastingdienst PDF layout is
        // the SPOS-209 expansion; until it ships, /reports/btw (JSON) and the
        // dashboard's /dashboard/reports/btw/export cover that need.
        $request->validate([
            'type'      => ['required', Rule::in(['daily', 'monthly', 'custom'])],
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date'      => ['nullable', 'date_format:Y-m-d'],
            'year'      => ['required_if:type,monthly', 'integer', 'min:2020'],
            'month'     => ['required_if:type,monthly', 'integer', 'min:1', 'max:12'],
            'date_from' => ['required_if:type,custom', 'date_format:Y-m-d'],
            'date_to'   => ['required_if:type,custom', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'locale'    => ['nullable', Rule::in(['nl', 'en'])],
        ]);

        $locale   = $request->input('locale', 'nl');
        $storeId  = $request->input('store_id');
        $type     = $request->input('type');

        $data = match ($type) {
            'daily'   => $this->buildDailySummary($storeId, $request->input('date', today()->toDateString())),
            'monthly' => $this->buildRangeSummary(
                $storeId,
                Carbon::create($request->integer('year'), $request->integer('month'), 1)->startOfMonth()->toDateString(),
                Carbon::create($request->integer('year'), $request->integer('month'), 1)->endOfMonth()->toDateString(),
            ),
            'custom'  => $this->buildRangeSummary($storeId, $request->input('date_from'), $request->input('date_to')),
        };

        $pdf = Pdf::loadView('reports.summary', [
            'data'   => $data,
            'type'   => $type,
            'locale' => $locale,
        ])->setPaper('A4', 'portrait');

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="report-' . $type . '-' . now()->format('Y-m-d') . '.pdf"',
        ]);
    }

    // ─── Shared helpers ───────────────────────────────────────────────────

    private function buildDailySummary(string $storeId, string $date): array
    {
        return $this->buildRangeSummary($storeId, $date, $date);
    }

    private function buildRangeSummary(string $storeId, string $from, string $to): array
    {
        $sales = Sale::query()
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(discount_srd) as total_discounts,
                AVG(total_srd) as avg_basket,
                SUM(CASE WHEN payment_method = \'cash\' THEN total_srd ELSE 0 END) as cash_total,
                SUM(CASE WHEN payment_method = \'card\' THEN total_srd ELSE 0 END) as card_total,
                SUM(CASE WHEN payment_method = \'mixed\' THEN total_srd ELSE 0 END) as mixed_total,
                SUM(CASE WHEN payment_method = \'bank_transfer\'   THEN total_srd ELSE 0 END) as bank_transfer_total,
                SUM(CASE WHEN payment_method = \'mobile_transfer\' THEN total_srd ELSE 0 END) as mobile_transfer_total,
                SUM(CASE WHEN payment_method = \'foreign_cash\'    THEN total_srd ELSE 0 END) as foreign_cash_total,
                SUM(CASE WHEN payment_method = \'qr_payment\'      THEN total_srd ELSE 0 END) as qr_payment_total
            ')
            ->first();

        // Phase 1 + 2 reconciliation breakdown — group card sales by issuing
        // bank AND transfer/mobile sales by provider so the OA can tick each
        // bucket against the matching bank settlement statement. NULL bank
        // = "cashier skipped the recon panel" (a real, actionable signal).
        $bankBreakdown = Sale::query()
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->whereIn('payment_method', ['card', 'mixed', 'bank_transfer', 'mobile_transfer', 'qr_payment'])
            ->selectRaw('
                payment_method,
                COALESCE(card_bank, payment_provider) as provider,
                COUNT(*) as tx_count,
                SUM(CASE
                    WHEN payment_method = \'mixed\' THEN COALESCE(card_amount_srd, 0)
                    ELSE total_srd
                END) as provider_total
            ')
            ->groupBy('payment_method', DB::raw('COALESCE(card_bank, payment_provider)'))
            ->orderByDesc('provider_total')
            ->get()
            ->map(fn ($row) => [
                'payment_method' => $row->payment_method,
                'provider'       => $row->provider,  // null = cashier skipped recon
                'tx_count'       => (int) $row->tx_count,
                'total_srd'      => number_format((float) $row->provider_total, 2, '.', ''),
            ])
            ->toArray();

        $voidCount = Sale::where('store_id', $storeId)
            ->where('status', 'voided')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->count();

        // BTW breakdown
        $btwBreakdown = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.store_id', $storeId)
            ->where('sales.status', 'completed')
            ->where('sales.occurred_at', '>=', AstDates::dayStart($from))
            ->where('sales.occurred_at', '<', AstDates::dayAfter($to))
            ->groupBy('sale_items.btw_rate', 'sale_items.btw_exempt')
            ->select([
                'sale_items.btw_rate',
                'sale_items.btw_exempt',
                DB::raw('SUM(sale_items.btw_srd) as btw_total'),
                DB::raw('SUM(sale_items.line_total_srd) - SUM(sale_items.btw_srd) as net_base'),
            ])
            ->get()
            ->toArray();

        // Top 5 products
        $top5 = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.store_id', $storeId)
            ->where('sales.status', 'completed')
            ->where('sales.occurred_at', '>=', AstDates::dayStart($from))
            ->where('sales.occurred_at', '<', AstDates::dayAfter($to))
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

        // Field names match the frontend ReportSummary interface exactly
        return [
            'store_id'          => $storeId,
            'date_from'         => $from,
            'date_to'           => $to,
            'transaction_count' => (int) ($sales->transaction_count ?? 0),
            'void_count'        => $voidCount,
            'total_sales_srd'   => number_format((float) ($sales->total_sales ?? 0), 2, '.', ''),
            'total_btw_srd'     => number_format((float) ($sales->total_btw ?? 0), 2, '.', ''),
            'total_discount_srd'=> number_format((float) ($sales->total_discounts ?? 0), 2, '.', ''),
            'avg_basket_srd'    => number_format((float) ($sales->avg_basket ?? 0), 2, '.', ''),
            'cash_total_srd'    => number_format((float) ($sales->cash_total ?? 0), 2, '.', ''),
            'card_total_srd'    => number_format((float) ($sales->card_total ?? 0), 2, '.', ''),
            'mixed_total_srd'   => number_format((float) ($sales->mixed_total ?? 0), 2, '.', ''),
            // Phase 2/3 method totals (always present; 0.00 when unused).
            'bank_transfer_total_srd'   => number_format((float) ($sales->bank_transfer_total   ?? 0), 2, '.', ''),
            'mobile_transfer_total_srd' => number_format((float) ($sales->mobile_transfer_total ?? 0), 2, '.', ''),
            'foreign_cash_total_srd'    => number_format((float) ($sales->foreign_cash_total    ?? 0), 2, '.', ''),
            'qr_payment_total_srd'      => number_format((float) ($sales->qr_payment_total      ?? 0), 2, '.', ''),
            // Reconciliation rows for bank statement matching. Each row pairs
            // a payment_method with the provider/bank (or null = skipped).
            'bank_breakdown'    => $bankBreakdown,
            'btw_breakdown'     => array_map(fn ($row) => (array) $row + [
                'base_srd' => number_format((float) ($row->net_base ?? 0), 2, '.', ''),
                'btw_srd'  => number_format((float) ($row->btw_total ?? 0), 2, '.', ''),
                'rate'     => (string) ($row->btw_rate ?? '0'),
                'exempt'   => (bool) ($row->btw_exempt ?? false),
            ], $btwBreakdown),
            'top_products'      => array_map(fn ($row) => [
                'product_name' => $row->name,
                'quantity'     => number_format((float) $row->qty, 3, '.', ''),
                'revenue_srd'  => number_format((float) $row->revenue, 2, '.', ''),
            ], $top5),
        ];
    }

    // ─── Profit Report (cross-store) ──────────────────────────────────────
    //
    // GET /api/reports/profit?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&store_id=…
    //
    // Aggregates revenue / cost / profit / margin% for the requested period:
    //   - Top-line totals for the whole org (or single store if filtered)
    //   - Per-store breakdown for chains
    //   - Top 10 products by profit (NOT by revenue — different ranking)
    //   - Per-day series for the trend chart
    //   - Loss-makers count (sales sold below cost — accidental discount,
    //     mispriced item, etc.)
    //
    // Visibility: requires products.view_cost — OA + SA + SM. Cashier +
    // Auditor + tax_inspector + API integration get 403. Belastingdienst
    // doesn't audit profit (that's a different agency); for our auditor
    // role the BTW + Rekenkamer reports cover their need.
    public function profit(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('products.view_cost'), 403);

        $data = $request->validate([
            'date_from' => ['required', 'date'],
            'date_to'   => ['required', 'date', 'after_or_equal:date_from'],
            'store_id'  => ['nullable', 'uuid', 'exists:stores,id'],
        ]);

        $orgId    = $request->user()->organisation_id;
        $isSuper  = $request->user()->role === 'super_admin';
        $dateFrom = $data['date_from'];
        $dateTo   = $data['date_to'];
        $storeId  = $data['store_id'] ?? null;

        // Cached (PERF) — five aggregation queries over sale_items. The key's
        // visibility scope already separates SA (platform-wide) from org
        // callers, so the $isSuper/$orgId branch below can never leak across
        // tenants. `date` validation accepts more than Y-m-d, so normalise
        // the TTL date. 60 s when the range touches today, 15 min when past.
        $payload = ReportCache::remember(
            $request->user(), 'reports.profit',
            ['store_id' => $storeId ?? 'all', 'from' => $dateFrom, 'to' => $dateTo],
            Carbon::parse($dateTo)->toDateString(),
            fn () => $this->buildProfitData($orgId, $isSuper, $dateFrom, $dateTo, $storeId),
        );

        return response()->json(['data' => $payload]);
    }

    /** Heavy lifting for profit() — extracted so the cache wrapper stays readable. */
    private function buildProfitData(?string $orgId, bool $isSuper, string $dateFrom, string $dateTo, ?string $storeId): array
    {
        // Base query — completed sales in this org (SA bypass), date range,
        // optional single-store filter. Joined to sale_items for line-level
        // profit roll-up.
        $base = DB::table('sale_items as si')
            ->join('sales as s', 's.id', '=', 'si.sale_id')
            ->join('stores as st', 'st.id', '=', 's.store_id')
            ->where('s.occurred_at', '>=', AstDates::dayStart($dateFrom))
            ->where('s.occurred_at', '<', AstDates::dayAfter($dateTo))
            ->where('s.status', 'completed')
            ->when(! $isSuper, fn ($q) => $q->where('st.organisation_id', $orgId))
            ->when($storeId,   fn ($q) => $q->where('s.store_id', $storeId));

        // Top-line totals
        $totals = (clone $base)
            ->selectRaw('
                COALESCE(SUM(si.line_total_srd),       0) as revenue,
                COALESCE(SUM(si.cost_snapshot_srd * si.quantity), 0) as cost,
                COALESCE(SUM(si.line_profit_srd),      0) as profit,
                COUNT(DISTINCT s.id) as transactions,
                SUM(CASE WHEN si.cost_snapshot_srd IS NULL THEN 1 ELSE 0 END) as items_without_cost
            ')
            ->first();

        $marginPct = $totals && (float) $totals->revenue > 0
            ? number_format(((float) $totals->profit / (float) $totals->revenue) * 100, 2, '.', '')
            : null;

        // Per-store breakdown (multi-store orgs)
        $perStore = (clone $base)
            ->groupBy('s.store_id', 'st.name', 'st.city')
            ->selectRaw('
                s.store_id, st.name as store_name, st.city,
                COALESCE(SUM(si.line_total_srd),  0) as revenue,
                COALESCE(SUM(si.cost_snapshot_srd * si.quantity), 0) as cost,
                COALESCE(SUM(si.line_profit_srd), 0) as profit,
                COUNT(DISTINCT s.id) as transactions
            ')
            ->orderByDesc('profit')
            ->get()
            ->map(fn ($r) => [
                'store_id'      => $r->store_id,
                'store_name'    => $r->store_name,
                'city'          => $r->city,
                'revenue_srd'   => number_format((float) $r->revenue, 2, '.', ''),
                'cost_srd'      => number_format((float) $r->cost,    2, '.', ''),
                'profit_srd'    => number_format((float) $r->profit,  2, '.', ''),
                'margin_pct'    => (float) $r->revenue > 0
                    ? number_format(((float) $r->profit / (float) $r->revenue) * 100, 2, '.', '')
                    : null,
                'transactions'  => (int) $r->transactions,
            ]);

        // Top 10 products by PROFIT (different from top by revenue —
        // high-volume low-margin SKU drops; low-volume high-margin rises).
        // Falls back to product_name_snapshot when product was deleted.
        $topByProfit = (clone $base)
            ->whereNotNull('si.cost_snapshot_srd')
            ->groupBy('si.product_name_snapshot')
            ->selectRaw('
                si.product_name_snapshot as name,
                COALESCE(SUM(si.quantity),        0) as qty,
                COALESCE(SUM(si.line_total_srd),  0) as revenue,
                COALESCE(SUM(si.line_profit_srd), 0) as profit
            ')
            ->orderByDesc('profit')
            ->limit(10)
            ->get()
            ->map(fn ($r) => [
                'name'        => $r->name,
                'qty'         => number_format((float) $r->qty, 3, '.', ''),
                'revenue_srd' => number_format((float) $r->revenue, 2, '.', ''),
                'profit_srd'  => number_format((float) $r->profit,  2, '.', ''),
                'margin_pct'  => (float) $r->revenue > 0
                    ? number_format(((float) $r->profit / (float) $r->revenue) * 100, 2, '.', '')
                    : null,
            ]);

        // Per-day trend
        $daily = (clone $base)
            ->groupBy(DB::raw("DATE(s.occurred_at AT TIME ZONE 'America/Paramaribo')"))
            ->selectRaw("
                DATE(s.occurred_at AT TIME ZONE 'America/Paramaribo') as date,
                COALESCE(SUM(si.line_total_srd),  0) as revenue,
                COALESCE(SUM(si.line_profit_srd), 0) as profit
            ")
            ->orderBy('date')
            ->get()
            ->map(fn ($r) => [
                'date'        => (string) $r->date,
                'revenue_srd' => number_format((float) $r->revenue, 2, '.', ''),
                'profit_srd'  => number_format((float) $r->profit,  2, '.', ''),
            ]);

        // Loss-making sales — anything where the WHOLE sale's profit is
        // negative. Catches accidental over-discount + mispriced products.
        $lossMakers = DB::table('sales as s')
            ->join('sale_items as si', 'si.sale_id', '=', 's.id')
            ->join('stores as st',     'st.id',      '=', 's.store_id')
            ->where('s.occurred_at', '>=', AstDates::dayStart($dateFrom))
            ->where('s.occurred_at', '<', AstDates::dayAfter($dateTo))
            ->where('s.status', 'completed')
            ->when(! $isSuper, fn ($q) => $q->where('st.organisation_id', $orgId))
            ->when($storeId,   fn ($q) => $q->where('s.store_id', $storeId))
            ->whereNotNull('si.cost_snapshot_srd')
            ->groupBy('s.id', 's.sale_number', 's.occurred_at', 'st.name')
            ->havingRaw('SUM(si.line_profit_srd) < 0')
            ->selectRaw('
                s.id, s.sale_number, s.occurred_at, st.name as store_name,
                SUM(si.line_total_srd)  as revenue,
                SUM(si.line_profit_srd) as profit
            ')
            ->orderBy('profit')
            ->limit(20)
            ->get()
            ->map(fn ($r) => [
                'sale_id'     => $r->id,
                'sale_number' => $r->sale_number,
                'occurred_at' => $r->occurred_at,
                'store_name'  => $r->store_name,
                'revenue_srd' => number_format((float) $r->revenue, 2, '.', ''),
                'profit_srd'  => number_format((float) $r->profit,  2, '.', ''),
            ]);

        return [
            'date_from'          => $dateFrom,
            'date_to'            => $dateTo,
            'store_id'           => $storeId,
            'revenue_srd'        => number_format((float) ($totals?->revenue ?? 0), 2, '.', ''),
            'cost_srd'           => number_format((float) ($totals?->cost    ?? 0), 2, '.', ''),
            'profit_srd'         => number_format((float) ($totals?->profit  ?? 0), 2, '.', ''),
            'margin_pct'         => $marginPct,
            'transactions'       => (int) ($totals?->transactions ?? 0),
            'items_without_cost' => (int) ($totals?->items_without_cost ?? 0),
            'per_store'          => $perStore,
            'top_products_by_profit' => $topByProfit,
            'daily'              => $daily,
            'loss_makers'        => $lossMakers,
        ];
    }
}
