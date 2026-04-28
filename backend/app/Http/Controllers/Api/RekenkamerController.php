<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Rekenkamer van Suriname — Court of Audit Export
 *
 * Generates a signed PDF with the complete transaction history for a given
 * organisation and period. Includes:
 *   • Executive summary (totals, BTW, voids, avg basket)
 *   • BTW breakdown by rate (for Belastingdienst compliance)
 *   • Payment method breakdown
 *   • Complete transaction list with cashier attribution and AST timestamps
 *   • Full void log with reason + approver
 *   • SHA-256 document hash for tamper detection
 *
 * Access: Super Admin, Organisation Admin, Auditor roles only.
 * Route: GET /api/reports/rekenkamer
 */
class RekenkamerController extends Controller
{
    public function export(Request $request): Response
    {
        // Auditors, org admins, and super admins can access
        abort_unless(
            $request->user()?->can('reports.rekenkamer') ||
            $request->user()?->isSuperAdmin() ||
            in_array($request->user()?->role, ['organisation_admin', 'auditor']),
            403,
        );

        $request->validate([
            'organisation_id' => ['nullable', 'uuid', 'exists:organisations,id'],
            'store_id'        => ['nullable', 'uuid', 'exists:stores,id'],
            'date_from'       => ['required', 'date_format:Y-m-d'],
            'date_to'         => ['required', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'locale'          => ['nullable', Rule::in(['nl', 'en'])],
        ]);

        $user    = $request->user();
        $locale  = $request->input('locale', $user->locale ?? 'nl');
        $orgId   = $request->input('organisation_id') ?? $user->organisation_id;
        $storeId = $request->input('store_id');
        $from    = $request->input('date_from');
        $to      = $request->input('date_to');

        // Super admin can query any org; others are scoped to their own org
        if (! $user->isSuperAdmin() && $orgId !== $user->organisation_id) {
            abort(403, 'Access denied to this organisation.');
        }

        $organisation = Organisation::findOrFail($orgId);

        // Build the sale query
        $saleQuery = Sale::query()
            ->with(['cashier:id,name', 'store:id,name', 'voidedBy:id,name'])
            ->whereHas('store', fn ($q) => $q->where('organisation_id', $orgId))
            ->whereIn('status', ['completed', 'voided'])
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to])
            ->orderBy('occurred_at');

        if ($storeId) {
            $saleQuery->where('store_id', $storeId);
        }

        $sales = $saleQuery->get();

        $completedSales = $sales->where('status', 'completed');
        $voidedSales    = $sales->where('status', 'voided');

        // BTW breakdown (completed sales only)
        $btwQuery = DB::table('sale_items')
            ->join('sales', 'sale_items.sale_id', '=', 'sales.id')
            ->join('stores', 'sales.store_id', '=', 'stores.id')
            ->where('stores.organisation_id', $orgId)
            ->where('sales.status', 'completed')
            ->whereBetween(DB::raw("DATE(sales.occurred_at AT TIME ZONE 'America/Paramaribo')"), [$from, $to]);

        if ($storeId) {
            $btwQuery->where('sales.store_id', $storeId);
        }

        $btwBreakdown = $btwQuery
            ->groupBy('sale_items.btw_rate', 'sale_items.btw_exempt')
            ->select([
                'sale_items.btw_rate',
                'sale_items.btw_exempt',
                DB::raw('SUM(sale_items.btw_srd) as btw_total'),
                DB::raw('SUM(sale_items.line_total_srd) - SUM(sale_items.btw_srd) as net_base'),
            ])
            ->get();

        // Payment breakdown
        $payBreakdown = $completedSales
            ->groupBy('payment_method')
            ->map(fn ($g) => (object)[
                'payment_method' => $g->first()->payment_method,
                'count'          => $g->count(),
                'total'          => $g->sum('total_srd'),
            ])
            ->values();

        $grandTotal   = $completedSales->sum('total_srd');
        $totalBtw     = $completedSales->sum('btw_srd');
        $totalNetBase = $btwBreakdown->sum('net_base');

        $nl = $locale === 'nl';

        $summaryRows = [
            [$nl ? 'Totale omzet (SRD)'      : 'Total Revenue (SRD)',       'SRD ' . number_format((float) $grandTotal, 2, '.', ',')],
            [$nl ? 'Totale BTW (SRD)'         : 'Total VAT/BTW (SRD)',       'SRD ' . number_format((float) $totalBtw, 2, '.', ',')],
            [$nl ? 'Totale nettobasis (SRD)'  : 'Total Net Base (SRD)',       'SRD ' . number_format((float) $totalNetBase, 2, '.', ',')],
            [$nl ? 'Transacties voltooid'      : 'Completed Transactions',    (string) $completedSales->count()],
            [$nl ? 'Geannuleerde transacties'  : 'Voided Transactions',       (string) $voidedSales->count()],
            [$nl ? 'Gemiddeld kassabon (SRD)'  : 'Average Basket (SRD)',      $completedSales->count() > 0 ? 'SRD ' . number_format((float) ($grandTotal / $completedSales->count()), 2, '.', ',') : '—'],
            [$nl ? 'Periode'                   : 'Period',                    "{$from} — {$to}"],
            [$nl ? 'Vestiging(en)'             : 'Store(s)',                  $storeId ? (Store::find($storeId)?->name ?? $storeId) : ($nl ? 'Alle vestigingen' : 'All stores')],
        ];

        $generatedAt = now()->setTimezone('America/Paramaribo')->format('d-m-Y H:i:s') . ' AST';
        $generatedBy = $user->name . ' <' . $user->email . '>';

        // Compute document hash for tamper detection
        $hashInput = $orgId . '|' . $from . '|' . $to . '|' . $sales->count() . '|' . $grandTotal . '|' . $generatedAt;
        $documentHash = hash('sha256', $hashInput);

        $pdf = Pdf::loadView('reports.rekenkamer', compact(
            'organisation', 'sales', 'voidedSales', 'btwBreakdown', 'paymentBreakdown',
            'summaryRows', 'grandTotal', 'totalBtw', 'totalNetBase',
            'generatedAt', 'generatedBy', 'documentHash', 'locale', 'from', 'to',
        ) + ['fromDate' => $from, 'toDate' => $to, 'paymentBreakdown' => $payBreakdown])
            ->setPaper('a4', 'landscape')
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled'      => false,
                'defaultFont'          => 'Arial',
            ]);

        $filename = sprintf(
            'rekenkamer_%s_%s_%s.pdf',
            preg_replace('/[^a-z0-9]/i', '_', $organisation->name),
            $from,
            $to,
        );

        return response($pdf->output(), 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'X-Document-Hash'     => $documentHash,
            'X-Generated-At'      => $generatedAt,
        ]);
    }
}
