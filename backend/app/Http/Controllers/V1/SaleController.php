<?php

namespace App\Http\Controllers\V1;

use App\Http\Controllers\Controller;
use App\Jobs\DispatchWebhook;
use App\Models\ApiIntegration;
use App\Models\DailyRate;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\BtwCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Layer 3 — Open Integration API
 *
 * Allows third-party POS systems to push sales to Josbin POS.
 * Authentication: X-API-Key header → ValidateApiKey middleware.
 * All monetary values in SRD. BTW re-calculated server-side using provided btw_rate.
 * Idempotent: duplicate sale_ref for the same store is silently ignored (200, not 201).
 */
class SaleController extends Controller
{
    public function __construct(private readonly BtwCalculationService $btw) {}

    /**
     * POST /v1/sales
     *
     * Submit a single sale from a third-party POS system.
     * If sale_ref already exists for this store, returns the existing record (idempotent).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var ApiIntegration $integration */
        $integration = $request->attributes->get('api_integration');
        $store       = $integration->store;
        $orgId       = $store->organisation_id;

        $data = $request->validate([
            'sale_ref'           => ['required', 'string', 'max:100'],
            'occurred_at'        => ['required', 'date'],
            'payment_method'     => ['required', Rule::in(['cash', 'card', 'mixed'])],
            'items'              => ['required', 'array', 'min:1'],
            'items.*.product_name' => ['required', 'string', 'max:200'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.quantity'   => ['required', 'numeric', 'min:0.001'],
            'items.*.btw_rate'   => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.btw_exempt' => ['sometimes', 'boolean'],
            'items.*.discount_srd' => ['nullable', 'numeric', 'min:0'],
        ]);

        // Idempotency: return existing if already processed
        $existing = Sale::where('store_id', $store->id)
            ->where('external_sale_ref', $data['sale_ref'])
            ->first();
        if ($existing) {
            return response()->json($this->formatSale($existing), 200);
        }

        // Lock today's exchange rate (informational — stored on sale for audit)
        $occurredDate = now()->parse($data['occurred_at'])->toDateString();
        $rate = DailyRate::where('date', $occurredDate)->first();

        DB::beginTransaction();
        try {
            // Calculate totals
            $subtotal    = '0.00';
            $totalBtw    = '0.00';
            $totalDisc   = '0.00';
            $itemRecords = [];

            foreach ($data['items'] as $item) {
                $qty     = (string) $item['quantity'];
                $price   = (string) $item['unit_price'];
                $btwRate = (string) $item['btw_rate'];
                $exempt  = $item['btw_exempt'] ?? false;
                $discSrd = (string) ($item['discount_srd'] ?? '0');

                $calc = $this->btw->calculateLineItem(
                    unitPrice: $price,
                    quantity: $qty,
                    btwRate: $btwRate,
                    btwExempt: $exempt,
                    discountSrd: $discSrd,
                );

                $subtotal  = bcadd($subtotal, $calc['line_total'], 2);
                $totalBtw  = bcadd($totalBtw, $calc['btw_amount'], 2);
                // discount = line_gross - line_net
                $itemDisc  = bcsub($calc['line_gross'], $calc['line_net'], 2);
                $totalDisc = bcadd($totalDisc, $itemDisc, 2);

                $itemRecords[] = [
                    'product_name_snapshot' => $item['product_name'],
                    'unit_price_srd'        => $price,
                    'quantity'              => $qty,
                    'btw_rate'              => $btwRate,
                    'btw_exempt'            => $exempt,
                    'discount_srd'          => $discSrd,
                    'discount_pct'          => '0.00',
                    'btw_srd'               => $calc['btw_amount'],
                    'line_total_srd'        => $calc['line_total'],
                ];
            }

            $sale = Sale::create([
                'store_id'           => $store->id,
                'cashier_id'         => null, // external POS — no cashier
                'sale_number'        => Sale::nextNumber($store->id),
                'payment_method'     => $data['payment_method'],
                'subtotal_srd'       => $subtotal,
                'discount_srd'       => $totalDisc,
                'btw_srd'            => $totalBtw,
                'total_srd'          => $subtotal,
                'status'             => 'completed',
                'source'             => 'api',
                'external_sale_ref'  => $data['sale_ref'],
                'exchange_rate_used' => $rate?->usd_to_srd ?? null,
                'occurred_at'        => $data['occurred_at'],
            ]);

            foreach ($itemRecords as $ir) {
                SaleItem::create(['sale_id' => $sale->id, ...$ir]);
            }

            DB::commit();

            // Dispatch webhook to any other integrations listening to sale.created
            DispatchWebhook::dispatchIfActive($orgId, 'sale.created', $this->formatSale($sale));

        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'error'   => 'ServerError',
                'message' => 'Sale creation failed: ' . $e->getMessage(),
            ], 422);
        }

        return response()->json($this->formatSale($sale), 201);
    }

    /**
     * POST /v1/sales/batch
     *
     * Submit multiple sales at once (offline catch-up).
     * Each item is idempotent by sale_ref. Failed items are reported but don't fail the batch.
     * Returns: { created, skipped, failed, errors[] }
     */
    public function batch(Request $request): JsonResponse
    {
        /** @var ApiIntegration $integration */
        $integration = $request->attributes->get('api_integration');

        $request->validate([
            'sales'   => ['required', 'array', 'max:500'],
            'sales.*' => ['array'],
        ]);

        $created = 0;
        $skipped = 0;
        $errors  = [];

        foreach ($request->input('sales', []) as $index => $saleData) {
            try {
                $req = Request::create('/v1/sales', 'POST', $saleData);
                $req->attributes->set('api_integration', $integration);
                $response = app()->call([$this, 'store'], ['request' => $req]);

                if ($response->getStatusCode() === 201) {
                    $created++;
                } else {
                    $skipped++; // idempotent duplicate
                }
            } catch (\Throwable $e) {
                $errors[] = [
                    'index'     => $index,
                    'sale_ref'  => $saleData['sale_ref'] ?? null,
                    'message'   => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'created' => $created,
            'skipped' => $skipped,
            'failed'  => count($errors),
            'errors'  => $errors,
        ]);
    }

    private function formatSale(Sale $sale): array
    {
        return [
            'id'              => $sale->id,
            'sale_ref'        => $sale->external_sale_ref,
            'store_id'        => $sale->store_id,
            'occurred_at'     => $sale->occurred_at,
            'payment_method'  => $sale->payment_method,
            'subtotal_srd'    => $sale->subtotal_srd,
            'discount_srd'    => $sale->discount_srd,
            'btw_srd'         => $sale->btw_srd,
            'total_srd'       => $sale->total_srd,
            'status'          => $sale->status,
            'created_at'      => $sale->created_at,
        ];
    }
}
