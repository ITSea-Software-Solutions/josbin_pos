<?php

namespace App\Http\Controllers\Api;

use App\Events\ZReportSubmitted;
use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\ZReport;
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
            'store_id' => ['required', 'uuid'],
            'date'     => ['nullable', 'date_format:Y-m-d'],
        ]);

        $date = $request->input('date', today()->toDateString());
        return response()->json(['data' => $this->buildDailySummary($request->input('store_id'), $date)]);
    }

    // ─── Monthly Report ───────────────────────────────────────────────────

    /** GET /api/reports/monthly */
    public function monthly(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.monthly'), 403);

        $request->validate([
            'store_id' => ['required', 'uuid'],
            'year'     => ['required', 'integer', 'min:2020'],
            'month'    => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $from = Carbon::create($request->integer('year'), $request->integer('month'), 1)
            ->startOfMonth()->toDateString();
        $to   = Carbon::create($request->integer('year'), $request->integer('month'), 1)
            ->endOfMonth()->toDateString();

        $data = $this->buildRangeSummary($request->input('store_id'), $from, $to);
        $data['period'] = $request->integer('year') . '-' . str_pad($request->integer('month'), 2, '0', STR_PAD_LEFT);

        return response()->json(['data' => $data]);
    }

    // ─── Custom Range ─────────────────────────────────────────────────────

    /** GET /api/reports/custom */
    public function custom(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.custom'), 403);

        $request->validate([
            'store_id'  => ['required', 'uuid'],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        return response()->json(['data' =>
            $this->buildRangeSummary($request->input('store_id'), $request->input('date_from'), $request->input('date_to'))
        ]);
    }

    // ─── Top Products ─────────────────────────────────────────────────────

    /** GET /api/reports/top-products */
    public function topProducts(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('reports.top_products'), 403);

        $request->validate([
            'store_id'  => ['required', 'uuid'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
            'limit'     => ['nullable', 'integer', 'min:5', 'max:50'],
        ]);

        $limit    = $request->integer('limit', 10);
        $storeId  = $request->input('store_id');
        $dateFrom = $request->input('date_from', today()->startOfMonth()->toDateString());
        $dateTo   = $request->input('date_to', today()->toDateString());

        $products = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.store_id', $storeId)
            ->where('sales.status', 'completed')
            ->whereDate('sales.occurred_at', '>=', $dateFrom)
            ->whereDate('sales.occurred_at', '<=', $dateTo)
            ->groupBy('sale_items.product_name_snapshot')
            ->select([
                'sale_items.product_name_snapshot as product_name',
                DB::raw('SUM(sale_items.quantity) as total_qty'),
                DB::raw('SUM(sale_items.line_total_srd) as total_revenue'),
                DB::raw('COUNT(DISTINCT sales.id) as sale_count'),
            ])
            ->orderByDesc('total_revenue')
            ->limit($limit)
            ->get();

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

        $request->validate(['store_id' => ['required', 'uuid']]);

        $storeId = $request->input('store_id');
        $today   = today()->toDateString();
        $summary = $this->buildDailySummary($storeId, $today);
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
            'store_id'              => ['required', 'uuid'],
            'actual_cash_srd'       => ['required', 'numeric', 'min:0'],
            'discrepancy_note'      => ['nullable', 'string', 'max:500'],
        ]);

        $storeId    = $request->input('store_id');
        $reportDate = today()->toDateString();

        // Check not already closed today
        $existing = ZReport::where('store_id', $storeId)
            ->where('report_date', $reportDate)
            ->first();
        if ($existing) {
            return response()->json([
                'message'  => 'De kas voor vandaag is al gesloten.',
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
                'message' => 'Dit Z-rapport is al verzonden naar het hoofdkantoor.',
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

        $request->validate(['store_id' => ['required', 'uuid']]);

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
            'store_id'  => ['required', 'uuid'],
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d'],
        ]);

        $storeId  = $request->input('store_id');
        $dateFrom = $request->input('date_from');
        $dateTo   = $request->input('date_to');

        $breakdown = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.store_id', $storeId)
            ->where('sales.status', 'completed')
            ->whereDate('sales.occurred_at', '>=', $dateFrom)
            ->whereDate('sales.occurred_at', '<=', $dateTo)
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

        $totalBtw = $breakdown->sum('btw_amount');

        return response()->json([
            'store_id'    => $storeId,
            'date_from'   => $dateFrom,
            'date_to'     => $dateTo,
            'breakdown'   => $breakdown,
            'total_btw'   => number_format($totalBtw, 2, '.', ''),
            'format'      => 'Belastingdienst Suriname',
        ]);
    }

    // ─── PDF export ───────────────────────────────────────────────────────

    /** GET /api/reports/export */
    public function export(Request $request): Response
    {
        abort_unless($request->user()?->can('reports.export'), 403);

        $request->validate([
            'type'      => ['required', Rule::in(['daily', 'monthly', 'custom', 'btw'])],
            'store_id'  => ['required', 'uuid'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to'   => ['nullable', 'date_format:Y-m-d'],
            'date'      => ['nullable', 'date_format:Y-m-d'],
            'locale'    => ['nullable', Rule::in(['nl', 'en'])],
        ]);

        $locale   = $request->input('locale', 'nl');
        $storeId  = $request->input('store_id');
        $type     = $request->input('type');

        $data = match ($type) {
            'daily'   => $this->buildDailySummary($storeId, $request->input('date', today()->toDateString())),
            'monthly','custom' => $this->buildRangeSummary($storeId, $request->input('date_from'), $request->input('date_to')),
            'btw'     => [], // placeholder — full BTW PDF in SPOS-209 expansion
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
            ->whereDate('occurred_at', '>=', $from)
            ->whereDate('occurred_at', '<=', $to)
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(discount_srd) as total_discounts,
                AVG(total_srd) as avg_basket,
                SUM(CASE WHEN payment_method = \'cash\' THEN total_srd ELSE 0 END) as cash_total,
                SUM(CASE WHEN payment_method = \'card\' THEN total_srd ELSE 0 END) as card_total,
                SUM(CASE WHEN payment_method = \'mixed\' THEN total_srd ELSE 0 END) as mixed_total
            ')
            ->first();

        $voidCount = Sale::where('store_id', $storeId)
            ->where('status', 'voided')
            ->whereDate('occurred_at', '>=', $from)
            ->whereDate('occurred_at', '<=', $to)
            ->count();

        // BTW breakdown
        $btwBreakdown = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->where('sales.store_id', $storeId)
            ->where('sales.status', 'completed')
            ->whereDate('sales.occurred_at', '>=', $from)
            ->whereDate('sales.occurred_at', '<=', $to)
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
            ->whereDate('sales.occurred_at', '>=', $from)
            ->whereDate('sales.occurred_at', '<=', $to)
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
}
