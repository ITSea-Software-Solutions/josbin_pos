<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use App\Models\ZReport;
use App\Support\AstDates;
use App\Support\ReportCache;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * DashboardController
 *
 * Serves the Super Admin Dashboard overview data.
 * All queries aggregate today's figures in AST (America/Paramaribo).
 * Super Admin sees all organisations; Organisation Admin sees only their org.
 */
class DashboardController extends Controller
{
    /** GET /api/dashboard/summary — platform-wide overview */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $isSuperAdmin = $user->role === 'super_admin';

        $today = now()->timezone('America/Paramaribo')->toDateString();

        // Cached (PERF): today-anchored → 60 s TTL, matching the dashboard's
        // poll cadence. The caller scope in the key keeps the SA platform view
        // and each org admin's org view in separate entries.
        $payload = ReportCache::remember(
            $user, 'dashboard.summary', ['date' => $today], $today,
            fn () => $this->buildSummaryData($user, $isSuperAdmin, $today),
        );

        return response()->json(['data' => $payload]);
    }

    /** Heavy lifting for summary() — extracted so the cache wrapper stays readable. */
    private function buildSummaryData(\App\Models\User $user, bool $isSuperAdmin, string $today): array
    {
        $orgQuery = Organisation::query()->where('is_active', true);
        if (! $isSuperAdmin) {
            $orgQuery->where('id', $user->organisation_id);
        }

        $orgs = $orgQuery->with('stores')->get();

        // Aggregate today's sales per store using a single efficient query
        $storeTodaySales = Sale::query()
            ->whereIn('store_id', $orgs->flatMap(fn ($o) => $o->stores->pluck('id')))
            ->where('occurred_at', '>=', AstDates::dayStart($today))
            ->where('occurred_at', '<', AstDates::dayAfter($today))
            ->where('status', 'completed')
            ->select(
                'store_id',
                DB::raw('SUM(total_srd) as today_revenue_srd'),
                DB::raw('COUNT(*) as today_transaction_count'),
                DB::raw('AVG(total_srd) as today_avg_basket_srd'),
                DB::raw('SUM(btw_srd) as today_btw_srd'),
            )
            ->groupBy('store_id')
            ->get()
            ->keyBy('store_id');

        // Latest Z-Report per store
        $latestZReports = ZReport::query()
            ->whereIn('store_id', $orgs->flatMap(fn ($o) => $o->stores->pluck('id')))
            ->select('store_id', 'sync_status', 'synced_at', 'report_date')
            ->orderByDesc('report_date')
            ->get()
            ->unique('store_id')
            ->keyBy('store_id');

        // Store online detection: last API call within 5 minutes
        $fiveMinutesAgo = now()->subMinutes(5)->toIso8601String();

        // Build org array
        $orgData = $orgs->map(function (Organisation $org) use ($storeTodaySales, $latestZReports, $fiveMinutesAgo) {
            $stores = $org->stores->map(function (Store $store) use ($storeTodaySales, $latestZReports, $fiveMinutesAgo) {
                $sales = $storeTodaySales->get($store->id);
                $zr    = $latestZReports->get($store->id);

                return [
                    'store_id'              => $store->id,
                    'store_name'            => $store->name,
                    'city'                  => $store->city,
                    'organisation_id'       => $store->organisation_id,
                    'organisation_name'     => $store->organisation?->name ?? '',
                    'is_online'             => $store->last_activity_at
                        ? $store->last_activity_at->gt(now()->subMinutes(5))
                        : false,
                    'last_seen_at'          => $store->last_activity_at?->toIso8601String(),
                    'today_revenue_srd'     => number_format((float) ($sales?->today_revenue_srd ?? '0'), 2, '.', ''),
                    'today_transaction_count' => (int) ($sales?->today_transaction_count ?? 0),
                    'today_avg_basket_srd'  => number_format((float) ($sales?->today_avg_basket_srd ?? '0'), 2, '.', ''),
                    'today_btw_srd'         => number_format((float) ($sales?->today_btw_srd ?? '0'), 2, '.', ''),
                    'top_product_name'      => null, // populated by separate query if needed
                    'sync_status'           => $zr?->sync_status ?? 'never',
                    'last_z_report_date'    => $zr?->report_date?->toDateString(),
                    'last_sync_at'          => $zr?->synced_at?->toIso8601String(),
                ];
            });

            $orgRevenue = $stores->sum(fn ($s) => (float) $s['today_revenue_srd']);
            $orgBtw     = $stores->sum(fn ($s) => (float) $s['today_btw_srd']);
            $onlineCount = $stores->filter(fn ($s) => $s['is_online'])->count();

            return [
                'organisation_id'       => $org->id,
                'organisation_name'     => $org->name,
                'type'                  => $org->type,
                'store_count'           => $stores->count(),
                'online_stores'         => $onlineCount,
                'today_revenue_srd'     => number_format($orgRevenue, 2, '.', ''),
                'today_transaction_count' => $stores->sum(fn ($s) => $s['today_transaction_count']),
                'today_btw_srd'         => number_format($orgBtw, 2, '.', ''),
                'stores'                => $stores->values(),
            ];
        });

        // Platform totals
        $totalRevenue = $orgData->sum(fn ($o) => (float) $o['today_revenue_srd']);
        $totalTrans   = $orgData->sum(fn ($o) => $o['today_transaction_count']);
        $totalBtw     = $orgData->sum(fn ($o) => (float) $o['today_btw_srd']);
        $totalOnline  = $orgData->sum(fn ($o) => $o['online_stores']);
        $totalStores  = $orgData->sum(fn ($o) => $o['store_count']);

        return [
            'total_organisations'  => $orgData->count(),
            'total_stores'         => $totalStores,
            'online_stores'        => $totalOnline,
            'today_revenue_srd'    => number_format($totalRevenue, 2, '.', ''),
            'today_transactions'   => $totalTrans,
            'today_btw_srd'        => number_format($totalBtw, 2, '.', ''),
            'orgs'                 => $orgData->values(),
        ];
    }

    /**
     * GET /api/dashboard/reports/consolidated
     *
     * Cross-store aggregated report for the Super Admin Dashboard.
     * Super admin sees all orgs. Org admin sees their org only.
     * Accepts: date_from, date_to (Y-m-d), org_id (optional filter)
     */
    public function consolidatedReport(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'org_id'    => ['nullable', 'uuid'],
            'store_id'  => ['nullable', 'uuid'],
        ]);

        $from    = $request->input('date_from');
        $to      = $request->input('date_to');
        $orgId   = $request->input('org_id');
        $storeId = $request->input('store_id');

        // Cached (PERF): the heaviest dashboard query — three aggregations
        // across every in-scope store. 60 s when the range touches today,
        // 15 min for past ranges. Key scope = caller's visibility, so an SA's
        // platform-wide payload can never be served to an org admin with the
        // same query string (store resolution happens inside the closure).
        $payload = ReportCache::remember(
            $user, 'dashboard.consolidated',
            ['from' => $from, 'to' => $to, 'org_id' => $orgId ?? 'all', 'store_id' => $storeId ?? 'all'], $to,
            fn () => $this->buildConsolidatedData($user, $from, $to, $orgId, $storeId),
        );

        return response()->json($payload);
    }

    /** Heavy lifting for consolidatedReport() — extracted for the cache wrapper. */
    private function buildConsolidatedData(\App\Models\User $user, string $from, string $to, ?string $orgId, ?string $storeId): array
    {
        // Resolve which store IDs to aggregate
        if ($user->isSuperAdmin()) {
            $orgQuery = Organisation::query()->where('is_active', true);
            if ($orgId) $orgQuery->where('id', $orgId);
            $storeIds = $orgQuery->with('stores:id,organisation_id')->get()
                ->flatMap(fn ($o) => $o->stores->pluck('id'));
        } else {
            $storeIds = Store::where('organisation_id', $user->organisation_id)
                ->where('is_active', true)
                ->pluck('id');
        }

        // Optional drill-down: filter to single store, but only if it belongs
        // to the in-scope set. Silently ignore foreign store_id to prevent
        // cross-tenant snooping via guessed UUIDs.
        if ($storeId && $storeIds->contains($storeId)) {
            $storeIds = collect([$storeId]);
        }

        // One aggregation query across all stores
        $totals = Sale::query()
            ->whereIn('store_id', $storeIds)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(discount_srd) as total_discounts,
                AVG(total_srd) as avg_basket,
                SUM(CASE WHEN payment_method = \'cash\'  THEN total_srd ELSE 0 END) as cash_total,
                SUM(CASE WHEN payment_method = \'card\'  THEN total_srd ELSE 0 END) as card_total,
                SUM(CASE WHEN payment_method = \'mixed\' THEN total_srd ELSE 0 END) as mixed_total,
                SUM(CASE WHEN payment_method = \'bank_transfer\'   THEN total_srd ELSE 0 END) as bank_transfer_total,
                SUM(CASE WHEN payment_method = \'mobile_transfer\' THEN total_srd ELSE 0 END) as mobile_transfer_total,
                SUM(CASE WHEN payment_method = \'foreign_cash\'    THEN total_srd ELSE 0 END) as foreign_cash_total,
                SUM(CASE WHEN payment_method = \'qr_payment\'      THEN total_srd ELSE 0 END) as qr_payment_total
            ')
            ->first();

        // Per-store breakdown
        $perStore = Sale::query()
            ->whereIn('store_id', $storeIds)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->select('store_id',
                DB::raw('COUNT(*) as transaction_count'),
                DB::raw('SUM(total_srd) as total_sales'),
                DB::raw('SUM(btw_srd) as total_btw'),
            )
            ->groupBy('store_id')
            ->with('store:id,name,city,organisation_id')
            ->get()
            ->map(fn ($row) => [
                'store_id'          => $row->store_id,
                'store_name'        => $row->store?->name ?? $row->store_id,
                'city'              => $row->store?->city,
                'organisation_id'   => $row->store?->organisation_id,
                'transaction_count' => (int) $row->transaction_count,
                'total_sales'       => number_format((float) $row->total_sales, 2, '.', ''),
                'total_btw'         => number_format((float) $row->total_btw, 2, '.', ''),
            ]);

        // Top 10 products cross-store
        $topProducts = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereIn('sales.store_id', $storeIds)
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
            ->limit(10)
            ->get();

        return [
            'date_from'         => $from,
            'date_to'           => $to,
            'transaction_count' => (int) ($totals->transaction_count ?? 0),
            'total_sales'       => number_format((float) ($totals->total_sales ?? 0), 2, '.', ''),
            'total_btw'         => number_format((float) ($totals->total_btw ?? 0), 2, '.', ''),
            'total_discounts'   => number_format((float) ($totals->total_discounts ?? 0), 2, '.', ''),
            'avg_basket'        => number_format((float) ($totals->avg_basket ?? 0), 2, '.', ''),
            'payment_breakdown' => [
                'cash'  => number_format((float) ($totals->cash_total ?? 0), 2, '.', ''),
                'card'  => number_format((float) ($totals->card_total ?? 0), 2, '.', ''),
                'mixed' => number_format((float) ($totals->mixed_total ?? 0), 2, '.', ''),
                'bank_transfer'   => number_format((float) ($totals->bank_transfer_total ?? 0), 2, '.', ''),
                'mobile_transfer' => number_format((float) ($totals->mobile_transfer_total ?? 0), 2, '.', ''),
                'foreign_cash'    => number_format((float) ($totals->foreign_cash_total ?? 0), 2, '.', ''),
                'qr_payment'      => number_format((float) ($totals->qr_payment_total ?? 0), 2, '.', ''),
            ],
            'per_store'         => $perStore->values(),
            'top_products'      => $topProducts,
        ];
    }

    /**
     * GET /api/dashboard/reports/btw
     *
     * Consolidated BTW report in Belastingdienst Suriname format.
     * Aggregates across all stores in scope, grouped by BTW rate.
     */
    public function consolidatedBtwReport(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'org_id'    => ['nullable', 'uuid'],
            'store_id'  => ['nullable', 'uuid'],
        ]);

        $from    = $request->input('date_from');
        $to      = $request->input('date_to');
        $orgId   = $request->input('org_id');
        $storeId = $request->input('store_id');

        // Cached (PERF): BTW consolidation is normally run for closed past
        // periods → 15 min TTL; ranges touching today get 60 s. Caller scope
        // in the key prevents SA/org-admin payload sharing.
        $payload = ReportCache::remember(
            $user, 'dashboard.btw',
            ['from' => $from, 'to' => $to, 'org_id' => $orgId ?? 'all', 'store_id' => $storeId ?? 'all'], $to,
            function () use ($user, $from, $to, $orgId, $storeId) {
                if ($user->isSuperAdmin()) {
                    $orgQuery = Organisation::query()->where('is_active', true);
                    if ($orgId) $orgQuery->where('id', $orgId);
                    $storeIds = $orgQuery->with('stores:id,organisation_id')->get()
                        ->flatMap(fn ($o) => $o->stores->pluck('id'));
                } else {
                    $storeIds = Store::where('organisation_id', $user->organisation_id)
                        ->where('is_active', true)
                        ->pluck('id');
                }

                if ($storeId && $storeIds->contains($storeId)) {
                    $storeIds = collect([$storeId]);
                }

                $breakdown = DB::table('sale_items')
                    ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
                    ->whereIn('sales.store_id', $storeIds)
                    ->where('sales.status', 'completed')
                    ->where('sales.occurred_at', '>=', AstDates::dayStart($from))
                    ->where('sales.occurred_at', '<', AstDates::dayAfter($to))
                    ->groupBy('sale_items.btw_rate', 'sale_items.btw_exempt')
                    ->select([
                        'sale_items.btw_rate',
                        'sale_items.btw_exempt',
                        DB::raw('SUM(sale_items.line_total_srd) as gross_incl_btw'),
                        DB::raw('SUM(sale_items.btw_srd) as btw_amount'),
                        DB::raw('SUM(sale_items.line_total_srd) - SUM(sale_items.btw_srd) as net_excl_btw'),
                        DB::raw('COUNT(DISTINCT sales.id) as sale_count'),
                    ])
                    ->orderBy('sale_items.btw_exempt')
                    ->orderBy('sale_items.btw_rate')
                    ->get();

                return [
                    'date_from'    => $from,
                    'date_to'      => $to,
                    'breakdown'    => $breakdown,
                    'total_btw'    => number_format($breakdown->sum('btw_amount'), 2, '.', ''),
                    'total_gross'  => number_format($breakdown->sum('gross_incl_btw'), 2, '.', ''),
                    'format'       => 'Belastingdienst Suriname',
                ];
            },
        );

        return response()->json($payload);
    }

    /**
     * GET /api/dashboard/z-reports
     *
     * Cross-store Z-Report history for the dashboard Z-Report screen.
     * Shows last N reports per store with sync status.
     */
    public function zReports(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'date_from'   => ['nullable', 'date_format:Y-m-d'],
            'date_to'     => ['nullable', 'date_format:Y-m-d'],
            'sync_status' => ['nullable', 'string'],
            'per_page'    => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $query = ZReport::query()
            ->with(['store:id,name,city,organisation_id', 'closedBy:id,name'])
            ->orderByDesc('report_date');

        if (! $user->isSuperAdmin()) {
            $storeIds = Store::where('organisation_id', $user->organisation_id)->pluck('id');
            $query->whereIn('store_id', $storeIds);
        }

        if ($request->filled('date_from')) {
            $query->where('report_date', '>=', $request->input('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->where('report_date', '<=', $request->input('date_to'));
        }
        if ($request->filled('sync_status')) {
            $query->where('sync_status', $request->input('sync_status'));
        }

        $reports = $query->paginate($request->integer('per_page', 30));

        return response()->json($reports);
    }

    /**
     * GET /api/dashboard/stores/{store} — single-store live detail.
     *
     * Returns everything a store-detail dashboard needs to render without
     * fan-out fetches:
     *   - basic + contact metadata (address, BTW number, manager name)
     *   - today's KPIs + delta vs yesterday
     *   - hourly sales for today (chart)
     *   - last 7 days daily revenue (trend chart)
     *   - top 5 products today (not just one)
     *   - active register sessions (who's on shift right now)
     *   - recent 10 completed sales
     *   - low-stock product count for this store
     *   - awaiting-confirmation sale count + amount
     *   - sync status + last Z-report metadata
     *
     * Refreshed every 60 s on the dashboard + live-incremented via Reverb
     * on SaleCompleted broadcasts.
     */
    public function storeDetail(Request $request, Store $store): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'super_admin' && $store->organisation_id !== $user->organisation_id) {
            abort(403);
        }

        $tz        = 'America/Paramaribo';
        $today     = now()->timezone($tz)->toDateString();
        $yesterday = now()->timezone($tz)->subDay()->toDateString();
        $sevenAgo  = now()->timezone($tz)->subDays(6)->toDateString();

        // Cached (PERF): ~12 queries per render, polled every 60 s per store
        // card the dashboard has open — the 60 s TTL matches that cadence, so
        // N concurrent viewers cost one render per store per minute. Reverb
        // broadcasts still live-increment the tiles between refreshes.
        $payload = ReportCache::remember(
            $user, 'dashboard.store-detail',
            ['store_id' => $store->id, 'date' => $today], $today,
            fn () => $this->buildStoreDetailData($store, $today, $yesterday, $sevenAgo, $tz),
        );

        return response()->json(['data' => $payload]);
    }

    /** Heavy lifting for storeDetail() — extracted so the cache wrapper stays readable. */
    private function buildStoreDetailData(Store $store, string $today, string $yesterday, string $sevenAgo, string $tz): array
    {
        // ─── Today + yesterday KPIs (delta % computed below) ────────────────
        $kpiToday     = $this->storeKpis($store->id, $today, $today);
        $kpiYesterday = $this->storeKpis($store->id, $yesterday, $yesterday);

        // ─── Hourly sales today (chart data) ────────────────────────────────
        $hourly = DB::table('sales')
            ->where('store_id', $store->id)
            ->where('occurred_at', '>=', AstDates::dayStart($today))
            ->where('occurred_at', '<', AstDates::dayAfter($today))
            ->where('status', 'completed')
            ->selectRaw("EXTRACT(HOUR FROM occurred_at AT TIME ZONE 'America/Paramaribo')::int as hour,
                         COUNT(*) as count, COALESCE(SUM(total_srd),0)::numeric(12,2) as revenue")
            ->groupBy('hour')
            ->orderBy('hour')
            ->get()
            ->keyBy('hour');
        $hourlySales = collect(range(0, 23))->map(fn ($h) => [
            'hour'    => $h,
            'count'   => (int)   ($hourly[$h]?->count   ?? 0),
            'revenue' => (string)($hourly[$h]?->revenue ?? '0.00'),
        ])->values();

        // ─── Last 7 days revenue (trend chart) ──────────────────────────────
        $daily = DB::table('sales')
            ->where('store_id', $store->id)
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$sevenAgo, $today])
            ->where('status', 'completed')
            ->selectRaw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo') as date,
                         COUNT(*) as count, COALESCE(SUM(total_srd),0)::numeric(12,2) as revenue")
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->keyBy(fn ($r) => (string) $r->date);
        $dailySales = collect(range(0, 6))->map(function ($d) use ($daily, $tz) {
            $date = now()->timezone($tz)->subDays(6 - $d)->toDateString();
            return [
                'date'    => $date,
                'count'   => (int)   ($daily[$date]?->count   ?? 0),
                'revenue' => (string)($daily[$date]?->revenue ?? '0.00'),
            ];
        })->values();

        // ─── Top 5 products today (not just one) ────────────────────────────
        $topProducts = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.store_id', $store->id)
            ->where('sales.occurred_at', '>=', AstDates::dayStart($today))
            ->where('sales.occurred_at', '<', AstDates::dayAfter($today))
            ->where('sales.status', 'completed')
            ->selectRaw('sale_items.product_name_snapshot as name,
                         SUM(sale_items.quantity) as qty,
                         SUM(sale_items.line_total_srd) as revenue')
            ->groupBy('sale_items.product_name_snapshot')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'name'    => $r->name,
                'qty'     => (string) $r->qty,
                'revenue' => number_format((float) $r->revenue, 2, '.', ''),
            ]);

        // ─── Active register sessions (cashiers on shift right now) ─────────
        $activeSessions = DB::table('register_sessions')
            ->join('registers', 'registers.id', '=', 'register_sessions.register_id')
            ->leftJoin('users', 'users.id', '=', 'register_sessions.opened_by')
            ->where('registers.store_id', $store->id)
            ->whereNull('register_sessions.closed_at')
            ->select(
                'register_sessions.id as session_id',
                'registers.name as register_name',
                'register_sessions.opened_at',
                'register_sessions.opening_float_srd',
                'users.name as cashier_name'
            )
            ->orderBy('register_sessions.opened_at')
            ->get();

        // ─── Recent 10 completed sales ──────────────────────────────────────
        $recentSales = Sale::query()
            ->where('store_id', $store->id)
            ->where('status', 'completed')
            ->orderByDesc('occurred_at')
            ->limit(10)
            ->with('cashier:id,name')
            ->get(['id', 'sale_number', 'cashier_id', 'total_srd', 'payment_method', 'occurred_at'])
            ->map(fn ($s) => [
                'id'             => $s->id,
                'sale_number'    => $s->sale_number,
                'cashier_name'   => $s->cashier?->name,
                'total_srd'      => (string) $s->total_srd,
                'payment_method' => $s->payment_method,
                'occurred_at'    => $s->occurred_at?->toIso8601String(),
            ]);

        // ─── Low-stock count + awaiting-confirmation count for this store ───
        $lowStockCount = (int) DB::table('product_stocks')
            ->where('store_id', $store->id)
            ->where('low_stock_threshold', '>', 0)
            ->whereRaw('stock_qty <= low_stock_threshold')
            ->count();
        $pendingPayments = Sale::query()
            ->where('store_id', $store->id)
            ->where('status', 'completed')
            ->whereNotNull('awaiting_confirmation_at')
            ->whereNull('confirmed_at')
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(total_srd),0)::numeric(12,2) as total')
            ->first();

        $latestZReport = ZReport::where('store_id', $store->id)->orderByDesc('report_date')->first();

        // ─── Store metadata: manager + address + BTW number ─────────────────
        $manager = DB::table('users')
            ->where('store_id', $store->id)
            ->where('role', 'store_manager')
            ->where('is_active', true)
            ->orderBy('created_at')
            ->value('name');

        $registerCount = (int) DB::table('registers')->where('store_id', $store->id)->where('is_active', true)->count();

        return [
                // ── Identity + metadata ─────────────────────────────────────
                'store_id'                => $store->id,
                'store_name'              => $store->name,
                'city'                    => $store->city,
                'address'                 => $store->address,
                'btw_number'              => $store->btw_number,
                'organisation_id'         => $store->organisation_id,
                'organisation_name'       => $store->organisation?->name,
                'manager_name'            => $manager,
                'register_count'          => $registerCount,
                'is_online'               => $store->last_activity_at?->gt(now()->subMinutes(5)) ?? false,
                'last_seen_at'            => $store->last_activity_at?->toIso8601String(),

                // ── Today KPIs (kept for backwards-compat with old screen) ──
                'today_revenue_srd'       => $kpiToday['revenue'],
                'today_transaction_count' => $kpiToday['count'],
                'today_avg_basket_srd'    => $kpiToday['avg_basket'],
                'today_btw_srd'           => $kpiToday['btw'],

                // ── Delta vs yesterday (% — null if yesterday was zero) ─────
                'delta_revenue_pct'       => self::pctDelta($kpiToday['revenue'], $kpiYesterday['revenue']),
                'delta_transactions_pct'  => self::pctDelta($kpiToday['count'], $kpiYesterday['count']),

                // ── Charts ──────────────────────────────────────────────────
                'hourly_sales_today'      => $hourlySales,
                'daily_sales_last_7'      => $dailySales,

                // ── Top products + active sessions + recent sales ───────────
                'top_products_today'      => $topProducts,
                'top_product_name'        => $topProducts->first()['name'] ?? null,  // backwards-compat
                'active_sessions'         => $activeSessions,
                'recent_sales'            => $recentSales,

                // ── Operational alerts ──────────────────────────────────────
                'low_stock_count'         => $lowStockCount,
                'pending_payments_count'  => (int) ($pendingPayments?->count ?? 0),
                'pending_payments_total'  => number_format((float) ($pendingPayments?->total ?? '0'), 2, '.', ''),

                // ── Sync + Z-Report ─────────────────────────────────────────
                'sync_status'             => $latestZReport?->sync_status ?? 'never',
                'last_z_report_date'      => $latestZReport?->report_date?->toDateString(),
                'last_sync_at'            => $latestZReport?->synced_at?->toIso8601String(),
        ];
    }

    /** Aggregate revenue/count/btw/avg-basket for a store over a date range. */
    private function storeKpis(string $storeId, string $from, string $to): array
    {
        $row = Sale::query()
            ->where('store_id', $storeId)
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to])
            ->where('status', 'completed')
            ->selectRaw('
                COALESCE(SUM(total_srd), 0) as revenue,
                COUNT(*) as count,
                COALESCE(AVG(total_srd), 0) as avg_basket,
                COALESCE(SUM(btw_srd), 0) as btw
            ')
            ->first();

        return [
            'revenue'    => number_format((float) ($row?->revenue ?? 0), 2, '.', ''),
            'count'      => (int) ($row?->count ?? 0),
            'avg_basket' => number_format((float) ($row?->avg_basket ?? 0), 2, '.', ''),
            'btw'        => number_format((float) ($row?->btw ?? 0), 2, '.', ''),
        ];
    }

    /** Percentage delta as a signed numeric string, e.g. "+12.5" or "-3.2".
     *  Returns null if base is zero (no meaningful comparison). */
    private static function pctDelta(string|int $now, string|int $base): ?string
    {
        $b = (float) $base;
        if ($b == 0.0) return null;
        $pct = (((float) $now - $b) / $b) * 100;
        return ($pct >= 0 ? '+' : '') . number_format($pct, 1, '.', '');
    }

    /**
     * GET /api/dashboard/reports/consolidated/export
     *
     * PDF export of the consolidated cross-store report.
     */
    public function exportConsolidated(Request $request): Response
    {
        $user = $request->user();

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'org_id'    => ['nullable', 'uuid'],
            'store_id'  => ['nullable', 'uuid'],
            'locale'    => ['nullable', 'in:nl,en'],
        ]);

        // Reuse the same data-gathering logic as consolidatedReport()
        $from    = $request->input('date_from');
        $to      = $request->input('date_to');
        $orgId   = $request->input('org_id');
        $storeId = $request->input('store_id');

        if ($user->isSuperAdmin()) {
            $orgQuery = Organisation::query()->where('is_active', true);
            if ($orgId) $orgQuery->where('id', $orgId);
            $storeIds = $orgQuery->with('stores:id,organisation_id')->get()
                ->flatMap(fn ($o) => $o->stores->pluck('id'));
        } else {
            $storeIds = Store::where('organisation_id', $user->organisation_id)
                ->where('is_active', true)->pluck('id');
        }

        if ($storeId && $storeIds->contains($storeId)) {
            $storeIds = collect([$storeId]);
        }

        $totals = Sale::query()
            ->whereIn('store_id', $storeIds)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(discount_srd) as total_discounts,
                AVG(total_srd) as avg_basket,
                SUM(CASE WHEN payment_method = \'cash\'  THEN total_srd ELSE 0 END) as cash_total,
                SUM(CASE WHEN payment_method = \'card\'  THEN total_srd ELSE 0 END) as card_total,
                SUM(CASE WHEN payment_method = \'mixed\' THEN total_srd ELSE 0 END) as mixed_total,
                SUM(CASE WHEN payment_method = \'bank_transfer\'   THEN total_srd ELSE 0 END) as bank_transfer_total,
                SUM(CASE WHEN payment_method = \'mobile_transfer\' THEN total_srd ELSE 0 END) as mobile_transfer_total,
                SUM(CASE WHEN payment_method = \'foreign_cash\'    THEN total_srd ELSE 0 END) as foreign_cash_total,
                SUM(CASE WHEN payment_method = \'qr_payment\'      THEN total_srd ELSE 0 END) as qr_payment_total
            ')
            ->first();

        $perStore = Sale::query()
            ->whereIn('store_id', $storeIds)
            ->where('status', 'completed')
            ->where('occurred_at', '>=', AstDates::dayStart($from))
            ->where('occurred_at', '<', AstDates::dayAfter($to))
            ->select('store_id',
                DB::raw('COUNT(*) as transaction_count'),
                DB::raw('SUM(total_srd) as total_sales'),
                DB::raw('SUM(btw_srd) as total_btw'),
            )
            ->groupBy('store_id')
            ->with('store:id,name,city')
            ->get()
            ->map(fn ($row) => [
                'store_name'        => $row->store?->name ?? $row->store_id,
                'city'              => $row->store?->city,
                'transaction_count' => (int) $row->transaction_count,
                'total_sales'       => number_format((float) $row->total_sales, 2, '.', ''),
                'total_btw'         => number_format((float) $row->total_btw, 2, '.', ''),
            ]);

        $data = [
            'type'              => 'consolidated',
            'date_from'         => $from,
            'date_to'           => $to,
            'transaction_count' => (int) ($totals->transaction_count ?? 0),
            'total_sales'       => number_format((float) ($totals->total_sales ?? 0), 2, '.', ''),
            'total_btw'         => number_format((float) ($totals->total_btw ?? 0), 2, '.', ''),
            'total_discounts'   => number_format((float) ($totals->total_discounts ?? 0), 2, '.', ''),
            'avg_basket'        => number_format((float) ($totals->avg_basket ?? 0), 2, '.', ''),
            'payment_breakdown' => [
                'cash'  => number_format((float) ($totals->cash_total ?? 0), 2, '.', ''),
                'card'  => number_format((float) ($totals->card_total ?? 0), 2, '.', ''),
                'mixed' => number_format((float) ($totals->mixed_total ?? 0), 2, '.', ''),
                'bank_transfer'   => number_format((float) ($totals->bank_transfer_total ?? 0), 2, '.', ''),
                'mobile_transfer' => number_format((float) ($totals->mobile_transfer_total ?? 0), 2, '.', ''),
                'foreign_cash'    => number_format((float) ($totals->foreign_cash_total ?? 0), 2, '.', ''),
                'qr_payment'      => number_format((float) ($totals->qr_payment_total ?? 0), 2, '.', ''),
            ],
            'per_store'         => $perStore->values(),
        ];

        $pdf = Pdf::loadView('reports.consolidated', [
            'data'   => $data,
            'locale' => $request->input('locale', 'nl'),
        ])->setPaper('A4', 'portrait');

        $filename = 'geconsolideerd-rapport-' . $from . '-' . $to . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * GET /api/dashboard/reports/btw/export
     *
     * PDF export of the consolidated BTW report (Belastingdienst Suriname format).
     */
    public function exportBtw(Request $request): Response
    {
        $user = $request->user();

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'org_id'    => ['nullable', 'uuid'],
            'store_id'  => ['nullable', 'uuid'],
            'locale'    => ['nullable', 'in:nl,en'],
        ]);

        $from    = $request->input('date_from');
        $to      = $request->input('date_to');
        $orgId   = $request->input('org_id');
        $storeId = $request->input('store_id');

        if ($user->isSuperAdmin()) {
            $orgQuery = Organisation::query()->where('is_active', true);
            if ($orgId) $orgQuery->where('id', $orgId);
            $storeIds = $orgQuery->with('stores:id,organisation_id')->get()
                ->flatMap(fn ($o) => $o->stores->pluck('id'));
        } else {
            $storeIds = Store::where('organisation_id', $user->organisation_id)
                ->where('is_active', true)->pluck('id');
        }

        if ($storeId && $storeIds->contains($storeId)) {
            $storeIds = collect([$storeId]);
        }

        $breakdown = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->whereIn('sales.store_id', $storeIds)
            ->where('sales.status', 'completed')
            ->where('sales.occurred_at', '>=', AstDates::dayStart($from))
            ->where('sales.occurred_at', '<', AstDates::dayAfter($to))
            ->groupBy('sale_items.btw_rate', 'sale_items.btw_exempt')
            ->select([
                'sale_items.btw_rate',
                'sale_items.btw_exempt',
                DB::raw('SUM(sale_items.line_total_srd) as gross_incl_btw'),
                DB::raw('SUM(sale_items.btw_srd) as btw_amount'),
                DB::raw('SUM(sale_items.line_total_srd) - SUM(sale_items.btw_srd) as net_excl_btw'),
                DB::raw('COUNT(DISTINCT sales.id) as sale_count'),
            ])
            ->orderBy('sale_items.btw_exempt')
            ->orderBy('sale_items.btw_rate')
            ->get();

        $data = [
            'type'        => 'btw',
            'date_from'   => $from,
            'date_to'     => $to,
            'breakdown'   => $breakdown,
            'total_btw'   => number_format($breakdown->sum('btw_amount'), 2, '.', ''),
            'total_gross' => number_format($breakdown->sum('gross_incl_btw'), 2, '.', ''),
        ];

        $pdf = Pdf::loadView('reports.btw_consolidated', [
            'data'   => $data,
            'locale' => $request->input('locale', 'nl'),
        ])->setPaper('A4', 'portrait');

        $filename = 'btw-rapport-belastingdienst-' . $from . '-' . $to . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * GET /api/dashboard/platform-overview
     *
     * Super Admin's vendor-level pulse across every tenant on the platform.
     * Unlike `summary` (which is org-scoped and gives a manager their store
     * cards), this answers questions an SA actually asks daily:
     *
     *   - How many orgs are healthy / expiring soon / locked?
     *   - How many active vs deactivated orgs?
     *   - What's the network-wide revenue today / week / month?
     *   - How many POS terminals have rung sales in the last 24h?
     *   - Which orgs have BTW filings pending review by tax inspector?
     *   - What's the next licence expiring?
     */
    public function platformOverview(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden — super admin only.'], 403);
        }

        $tz = config('josbin_pos.timezone', 'America/Paramaribo');
        $now = \Illuminate\Support\Carbon::now($tz);

        // Cached (PERF): today-anchored vendor pulse → 60 s TTL. SA-only
        // (checked above), scope "platform". generated_at inside the payload
        // is the computation time — under caching it honestly reports the
        // age of the numbers.
        $payload = ReportCache::remember(
            $user, 'dashboard.platform-overview',
            ['date' => $now->toDateString()], $now->toDateString(),
            fn () => $this->buildPlatformOverviewData($now, $tz),
        );

        return response()->json(['data' => $payload]);
    }

    /** Heavy lifting for platformOverview() — extracted for the cache wrapper. */
    private function buildPlatformOverviewData(\Illuminate\Support\Carbon $now, string $tz): array
    {
        // ── Org licence health buckets ───────────────────────────────────────
        $orgs = \App\Models\Organisation::query()
            ->select(['id', 'name', 'is_active'])
            ->withMax('licenses', 'valid_until')
            ->get();

        $licenseStatusBuckets = [
            'no_license'   => 0,
            'active'       => 0,
            'expiring_30'  => 0,
            'expiring_14'  => 0,
            'grace'        => 0,
            'soft_lock'    => 0,
            'hard_lock'    => 0,
        ];

        foreach ($orgs as $org) {
            $expiresAt = $org->licenses_max_valid_until;
            if (! $expiresAt) {
                $licenseStatusBuckets['no_license']++;
                continue;
            }
            $exp = \Illuminate\Support\Carbon::parse($expiresAt, $tz);
            $daysLeft = (int) floor($now->copy()->startOfDay()->diffInDays($exp, false));
            if ($daysLeft >= 30)      $licenseStatusBuckets['active']++;
            elseif ($daysLeft >= 14)  $licenseStatusBuckets['expiring_30']++;
            elseif ($daysLeft >= 0)   $licenseStatusBuckets['expiring_14']++;
            elseif ($daysLeft >= -14) $licenseStatusBuckets['grace']++;
            elseif ($daysLeft >= -44) $licenseStatusBuckets['soft_lock']++;
            else                      $licenseStatusBuckets['hard_lock']++;
        }

        // ── Network-wide revenue (today / week / month) ──────────────────────
        $todayStart = $now->copy()->startOfDay();
        $weekStart  = $now->copy()->subDays(6)->startOfDay();
        $monthStart = $now->copy()->startOfMonth();

        $revenue = \DB::table('sales')
            ->where('status', 'completed')
            ->selectRaw('
                SUM(CASE WHEN occurred_at >= ? THEN total_srd ELSE 0 END) as today,
                SUM(CASE WHEN occurred_at >= ? THEN total_srd ELSE 0 END) as week,
                SUM(CASE WHEN occurred_at >= ? THEN total_srd ELSE 0 END) as month,
                COUNT(CASE WHEN occurred_at >= ? THEN 1 ELSE NULL END) as tx_today
            ', [$todayStart, $weekStart, $monthStart, $todayStart])
            ->first();

        // ── Terminal activity — distinct registers that rang sales in 24h ────
        $activeRegisters = \DB::table('sales')
            ->where('occurred_at', '>=', $now->copy()->subHours(24))
            ->whereNotNull('register_session_id')
            ->distinct('register_session_id')
            ->count('register_session_id');

        $totalRegisters = \DB::table('registers')->where('is_active', true)->count();

        // ── BTW filings queue — pending review by tax inspector ──────────────
        $pendingFilings = \DB::table('btw_submissions')
            ->where('status', \App\Models\BtwSubmission::STATUS_FILED)
            ->count();

        // ── Next licence expiring (gives SA a heads-up) ──────────────────────
        $nextExpiring = \App\Models\License::query()
            ->where('valid_until', '>=', $now->copy()->subDays(14)->toDateString()) // include those just into grace
            ->where('is_active', true)
            ->with('organisation:id,name')
            ->orderBy('valid_until')
            ->limit(5)
            ->get(['id', 'organisation_id', 'tier', 'valid_until', 'is_active']);

        // ── Recent SA actions for audit transparency ─────────────────────────
        $recentSaActions = \DB::table('audit_logs')
            ->whereIn('event', ['license.issued', 'license.renewed', 'organisation.created', 'user.created'])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'event', 'user_id', 'auditable_type', 'auditable_id', 'created_at']);

        return [
            'generated_at'      => $now->toIso8601String(),
            'orgs' => [
                'total'    => $orgs->count(),
                'active'   => $orgs->where('is_active', true)->count(),
                'inactive' => $orgs->where('is_active', false)->count(),
                'license_health' => $licenseStatusBuckets,
            ],
            'revenue_srd' => [
                'today' => number_format((float) ($revenue->today ?? 0), 2, '.', ''),
                'week'  => number_format((float) ($revenue->week  ?? 0), 2, '.', ''),
                'month' => number_format((float) ($revenue->month ?? 0), 2, '.', ''),
            ],
            'transactions_today' => (int) ($revenue->tx_today ?? 0),
            'terminals' => [
                'active_24h' => $activeRegisters,
                'total'      => $totalRegisters,
            ],
            'btw' => [
                'filings_pending_inspector_review' => $pendingFilings,
            ],
            'next_expiring_licenses' => $nextExpiring,
            'recent_sa_actions'      => $recentSaActions,
        ];
    }
}
