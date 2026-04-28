<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Models\ApiIntegration;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Layer 3 — Open Integration API Report endpoints.
 *
 * Third-party POS systems can pull their own store's sales data.
 * Scoped strictly to the integration's store — no cross-store access.
 */
class ReportController extends Controller
{
    /**
     * GET /v1/reports/sales
     *
     * Returns completed sales for the integration's store within a date range.
     * Max range: 31 days per request.
     */
    public function sales(Request $request): JsonResponse
    {
        /** @var ApiIntegration $integration */
        $integration = $request->attributes->get('api_integration');
        $storeId     = $integration->store_id;

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'per_page'  => ['nullable', 'integer', 'min:10', 'max:200'],
        ]);

        $from   = $request->input('date_from');
        $to     = $request->input('date_to');

        // Enforce 31-day max range
        if (now()->parse($from)->diffInDays(now()->parse($to)) > 31) {
            return response()->json([
                'error'   => 'InvalidRange',
                'message' => 'Maximum date range is 31 days.',
            ], 422);
        }

        $sales = Sale::query()
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->whereDate('occurred_at', '>=', $from)
            ->whereDate('occurred_at', '<=', $to)
            ->with('items:id,sale_id,product_name_snapshot,unit_price_srd,quantity,btw_rate,btw_srd,line_total_srd')
            ->orderBy('occurred_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json($sales);
    }

    /**
     * GET /v1/reports/summary
     *
     * Aggregated totals for the integration's store within a date range.
     */
    public function summary(Request $request): JsonResponse
    {
        /** @var ApiIntegration $integration */
        $integration = $request->attributes->get('api_integration');
        $storeId     = $integration->store_id;

        $request->validate([
            'date_from' => ['required', 'date_format:Y-m-d'],
            'date_to'   => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
        ]);

        $from = $request->input('date_from');
        $to   = $request->input('date_to');

        $totals = Sale::query()
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->whereDate('occurred_at', '>=', $from)
            ->whereDate('occurred_at', '<=', $to)
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(discount_srd) as total_discounts,
                AVG(total_srd) as avg_basket
            ')
            ->first();

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
            ->get();

        return response()->json([
            'store_id'          => $storeId,
            'date_from'         => $from,
            'date_to'           => $to,
            'transaction_count' => (int) ($totals->transaction_count ?? 0),
            'total_sales'       => number_format((float) ($totals->total_sales ?? 0), 2, '.', ''),
            'total_btw'         => number_format((float) ($totals->total_btw ?? 0), 2, '.', ''),
            'total_discounts'   => number_format((float) ($totals->total_discounts ?? 0), 2, '.', ''),
            'avg_basket'        => number_format((float) ($totals->avg_basket ?? 0), 2, '.', ''),
            'btw_breakdown'     => $btwBreakdown,
        ]);
    }
}
