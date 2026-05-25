<?php

namespace App\Http\Controllers\Api;

use App\Events\SaleCompleted as SaleCompletedEvent;
use App\Http\Controllers\Controller;
use App\Jobs\DetectSaleAnomaly;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\BtwCalculationService;
use App\Services\DiscountRuleService;
use App\Services\ReceiptService;
use App\Services\StockMovementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SaleController extends Controller
{
    public function __construct(
        private readonly BtwCalculationService   $btw,
        private readonly ReceiptService          $receipt,
        private readonly StockMovementService    $stock,
        private readonly DiscountRuleService     $discountRules,
    ) {}

    // ─── Create ───────────────────────────────────────────────────────────

    /**
     * POST /api/sales
     * Creates a completed sale inside a DB transaction.
     * Exchange rate is locked to today's daily_rates record (required).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Sale::class);

        $data = $request->validate([
            'store_id'            => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'customer_id'         => ['nullable', 'uuid', 'exists:customers,id'],
            'payment_method'      => ['required', Rule::in(['cash', 'card', 'mixed'])],
            'cash_tendered'       => ['nullable', 'numeric', 'min:0'],
            'card_amount'         => ['nullable', 'numeric', 'min:0'],
            'sale_discount_srd'   => ['nullable', 'numeric', 'min:0'],
            'sale_discount_pct'   => ['nullable', 'numeric', 'min:0', 'max:100'],
            'source'              => ['sometimes', Rule::in(['pos', 'api', 'import'])],
            'external_sale_ref'   => ['nullable', 'string', 'max:100'],
            'occurred_at'         => ['nullable', 'date'],
            'items'               => ['required', 'array', 'min:1'],
            'items.*.product_id'  => ['nullable', 'uuid', 'exists:products,id'],
            'items.*.product_name'=> ['required', 'string', 'max:200'],
            'items.*.unit_price'  => ['required', 'numeric', 'min:0'],
            'items.*.quantity'    => ['required', 'numeric', 'min:0.001'],
            'items.*.btw_rate'    => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.btw_exempt'  => ['sometimes', 'boolean'],
            'items.*.discount_srd'=> ['nullable', 'numeric', 'min:0'],
        ]);

        // Idempotency: if external_sale_ref already exists for this store, return existing
        if (! empty($data['external_sale_ref'])) {
            $existing = Sale::where('store_id', $data['store_id'])
                ->where('external_sale_ref', $data['external_sale_ref'])
                ->first();
            if ($existing) {
                return response()->json(['data' => $existing->load('items')], 200);
            }
        }

        // Get today's locked exchange rate
        $rate = \App\Models\DailyRate::todayRate();
        if (! $rate) {
            return response()->json([
                'message' => 'Geen dagkoers beschikbaar. Vergrendel de wisselkoers voor vandaag.',
                'code'    => 'NO_DAILY_RATE',
            ], 422);
        }

        // Build cart items, applying automatic discount rules before BTW calculation
        $rawItems = collect($data['items'])->map(fn ($item) => [
            'product_id'  => $item['product_id'] ?? null,
            'category_id' => isset($item['product_id'])
                ? \App\Models\Product::where('id', $item['product_id'])->value('category_id')
                : null,
            'unit_price'  => (string) $item['unit_price'],
            'quantity'    => (string) $item['quantity'],
            'btw_rate'    => (string) $item['btw_rate'],
            'btw_exempt'  => (bool)   ($item['btw_exempt'] ?? false),
        ]);

        $orgId    = \App\Models\Store::where('id', $data['store_id'])->value('organisation_id');
        $ruleResult = $this->discountRules->applyRules($orgId, $data['store_id'], $rawItems);

        // Merge auto-discount back into cart items (add to any manual item discount)
        $cartItems = collect($ruleResult['items'])->map(fn ($item, $i) => [
            'unit_price'  => $item['unit_price'],
            'quantity'    => $item['quantity'],
            'btw_rate'    => $item['btw_rate'],
            'btw_exempt'  => $item['btw_exempt'],
            'discount_srd'=> (string) bcadd(
                (string) ($data['items'][$i]['discount_srd'] ?? '0.00'),
                $item['applied_discount_srd'],
                2
            ),
        ])->toArray();

        // Merge cart-level discount from rules with any manually provided discount
        $manualCartDiscountSrd = (string) ($data['sale_discount_srd'] ?? '0');
        $manualCartDiscountPct = (string) ($data['sale_discount_pct'] ?? '0');
        $combinedCartDiscountSrd = bcadd($manualCartDiscountSrd, $ruleResult['cart_discount_srd'], 2);

        $cart = $this->btw->calculateCart(
            $cartItems,
            saleDiscountSrd: $combinedCartDiscountSrd,
            saleDiscountPct: $manualCartDiscountPct,
        );

        $sale = DB::transaction(function () use ($data, $cart, $rate, $request) {
            // Payment amounts — cash tendered, card paid, and change due.
            $cashTendered = isset($data['cash_tendered']) ? (string) $data['cash_tendered'] : null;
            $cardAmount   = isset($data['card_amount'])   ? (string) $data['card_amount']   : null;
            $totalPaid    = bcadd($cashTendered ?? '0', $cardAmount ?? '0', 2);
            $changeDue    = bccomp($totalPaid, (string) $cart['total'], 2) > 0
                ? bcsub($totalPaid, (string) $cart['total'], 2)
                : '0.00';

            // Tie this sale to the cashier's currently open register session so
            // per-session reports (mini Z-Report) reconcile against actual sales.
            $registerSessionId = RegisterSession::where('cashier_id', $request->user()->id)
                ->where('store_id', $data['store_id'])
                ->where('status', 'open')
                ->latest('opened_at')
                ->value('id');

            $sale = Sale::create([
                'store_id'            => $data['store_id'],
                'cashier_id'          => $request->user()->id,
                'register_session_id' => $registerSessionId,
                'customer_id'         => $data['customer_id'] ?? null,
                'sale_number'         => Sale::nextNumber($data['store_id']),
                'subtotal_srd'        => $cart['subtotal'],
                'discount_srd'        => $cart['sale_discount'],
                'btw_srd'             => $cart['btw_total'],
                'total_srd'           => $cart['total'],
                'payment_method'      => $data['payment_method'],
                'cash_received_srd'   => $cashTendered,
                'card_amount_srd'     => $cardAmount,
                'change_srd'          => $changeDue,
                'status'              => 'completed',
                'source'              => $data['source'] ?? 'pos',
                'exchange_rate_used'  => $rate->usd_to_srd,
                'external_sale_ref'   => $data['external_sale_ref'] ?? null,
                'occurred_at'         => $data['occurred_at'] ?? now(),
            ]);

            foreach ($data['items'] as $i => $item) {
                $calc = $cart['items'][$i];
                SaleItem::create([
                    'sale_id'               => $sale->id,
                    'product_id'            => $item['product_id'] ?? null,
                    'product_name_snapshot' => $item['product_name'],
                    'unit_price_srd'        => $item['unit_price'],
                    'quantity'              => $item['quantity'],
                    'discount_srd'          => $calc['line_gross'] !== $calc['line_net']
                        ? bcsub($calc['line_gross'], $calc['line_net'], 2)
                        : '0.00',
                    'discount_pct'          => '0.00',
                    'btw_rate'              => $item['btw_rate'],
                    'btw_exempt'            => $item['btw_exempt'] ?? false,
                    'btw_srd'               => $calc['btw_amount'],
                    'line_total_srd'        => $calc['line_total'],
                ]);
            }

            // Update customer spend if attached
            if ($sale->customer_id) {
                \App\Models\Customer::where('id', $sale->customer_id)->increment('visit_count');
                \App\Models\Customer::where('id', $sale->customer_id)
                    ->increment('total_spend_srd', (float) $cart['total']);
            }

            return $sale;
        });

        // Deduct stock for each sold item — runs in its own queued job to keep POST fast
        \App\Jobs\RecordStockMovements::dispatch($sale->id, $request->user()->id, 'sale');

        // Broadcast to dashboard and POS terminals (queued — does not block response)
        broadcast(new SaleCompletedEvent($sale->load('store')))->toOthers();

        // Fraud & anomaly detection — runs in background queue, never blocks response
        DetectSaleAnomaly::dispatch($sale->id)->onQueue('ai')->delay(now()->addSeconds(5));

        return response()->json(['data' => $sale->load('items')], 201);
    }

    // ─── Show ─────────────────────────────────────────────────────────────

    /** GET /api/sales/{sale} */
    public function show(Request $request, Sale $sale): JsonResponse
    {
        $this->authorize('view', $sale);

        return response()->json(['data' => $sale->load('items', 'customer', 'cashier')]);
    }

    // ─── Void ─────────────────────────────────────────────────────────────

    /**
     * POST /api/sales/{sale}/void
     * Dual-approval: first POST records the void request, second approves it.
     * For non-govt stores a single authorised user can void directly.
     */
    public function void(Request $request, Sale $sale): JsonResponse
    {
        $this->authorize('void', $sale);

        if (! $sale->isCompleted()) {
            return response()->json(['message' => 'Alleen voltooide verkopen kunnen worden geannuleerd.'], 422);
        }

        $data = $request->validate([
            'void_reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);

        // Check if this is a government org — requires second approver
        $store = \App\Models\Store::with('organisation')->find($sale->store_id);
        $needsSecondApproval = $store?->organisation?->is_government ?? false;

        if ($needsSecondApproval && $sale->voided_by === null) {
            // First approver — record the void request, pending second approval
            $sale->update([
                'voided_by'   => $request->user()->id,
                'void_reason' => $data['void_reason'],
                'status'      => 'completed', // still active until second approves
            ]);

            return response()->json([
                'message' => 'Annuleringsverzoek geregistreerd. Wachten op tweede goedkeuring.',
                'code'    => 'VOID_PENDING_APPROVAL',
                'data'    => $sale,
            ]);
        }

        // Segregation of duties: a government void's second approval must be
        // given by a DIFFERENT user than the one who requested it.
        if ($needsSecondApproval && $sale->voided_by === $request->user()->id) {
            return response()->json([
                'message' => 'De tweede goedkeuring moet door een andere gebruiker worden gegeven.',
                'code'    => 'VOID_SAME_APPROVER',
            ], 422);
        }

        // Single approver or second approver for govt.
        // voided_by stays as the requester (the first approver for govt; the
        // acting user for a non-govt single-step void).
        $sale->update([
            'status'              => 'voided',
            'voided_by'           => $sale->voided_by ?? $request->user()->id,
            'voided_at'           => now(),
            'void_reason'         => $data['void_reason'],
            'void_approved_by'    => $needsSecondApproval ? $request->user()->id : null,
        ]);

        // Restore stock for voided items
        \App\Jobs\RecordStockMovements::dispatch($sale->id, $request->user()->id, 'void');

        return response()->json(['data' => $sale->fresh()]);
    }

    // ─── Hold ─────────────────────────────────────────────────────────────

    /**
     * POST /api/sales/hold
     * Saves cart to held_bills table (not a completed sale).
     */
    public function hold(Request $request): JsonResponse
    {
        $this->authorize('hold', Sale::class);

        $data = $request->validate([
            'store_id'   => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'label'      => ['nullable', 'string', 'max:100'],
            'customer_id'=> ['nullable', 'uuid', 'exists:customers,id'],
            'cart_data'  => ['required', 'array'],
            'total_srd'  => ['required', 'numeric', 'min:0'],
        ]);

        $held = \App\Models\HeldBill::create([
            'store_id'    => $data['store_id'],
            'cashier_id'  => $request->user()->id,
            'customer_id' => $data['customer_id'] ?? null,
            'label'       => $data['label'] ?? null,
            'cart_data'   => $data['cart_data'],
            'total_srd'   => $data['total_srd'],
        ]);

        return response()->json(['data' => $this->formatHeldBill($held->load('customer'))], 201);
    }

    /**
     * GET /api/sales/held
     * Returns held bills for a store.
     */
    public function heldList(Request $request): JsonResponse
    {
        $this->authorize('hold', Sale::class);

        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);

        $held = \App\Models\HeldBill::where('store_id', $request->input('store_id'))
            ->where('cashier_id', $request->user()->id)
            ->with('customer')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($h) => $this->formatHeldBill($h));

        return response()->json(['data' => $held]);
    }

    /**
     * Flattens cart_data into the shape the POS frontend expects
     * (items / customer / sale_discount as top-level fields).
     *
     * cart_data is stored as JSON and historical rows are inconsistent: some
     * are a bare array of items, others are an object with {items, ...}.
     * Normalising here keeps the frontend single-shaped.
     */
    private function formatHeldBill(\App\Models\HeldBill $h): array
    {
        $cart = $h->cart_data ?? [];
        $items = is_array($cart) && array_is_list($cart)
            ? $cart                                 // legacy: bare array
            : ($cart['items'] ?? []);               // new: { items, sale_discount }
        $saleDiscount = is_array($cart) && ! array_is_list($cart)
            ? ($cart['sale_discount'] ?? ['type' => 'fixed', 'value' => 0])
            : ['type' => 'fixed', 'value' => 0];

        return [
            'id'            => $h->id,
            'store_id'      => $h->store_id,
            'cashier_id'    => $h->cashier_id,
            'customer'      => $h->customer ? [
                'id'    => $h->customer->id,
                'name'  => $h->customer->name,
                'phone' => $h->customer->phone,
                'email' => $h->customer->email,
            ] : null,
            'label'         => $h->label,
            'items'         => $items,
            'sale_discount' => $saleDiscount,
            'total_srd'     => (string) $h->total_srd,
            'created_at'    => $h->created_at?->toIso8601String(),
        ];
    }

    /**
     * DELETE /api/sales/held/{heldBill}
     * Restores a held bill (deletes the hold so cart can be loaded).
     */
    public function restore(Request $request, \App\Models\HeldBill $heldBill): JsonResponse
    {
        $this->authorize('hold', Sale::class);

        if ($heldBill->cashier_id !== $request->user()->id && ! $request->user()->isAtLeastManager()) {
            abort(403, 'Access denied.');
        }

        $heldBill->load('customer');
        $payload = $this->formatHeldBill($heldBill);
        $heldBill->delete();

        return response()->json(['data' => $payload]);
    }

    // ─── Refund ───────────────────────────────────────────────────────────

    /**
     * POST /api/sales/{sale}/refund
     * Creates a negative sale linked to the original.
     */
    public function refund(Request $request, Sale $sale): JsonResponse
    {
        $this->authorize('refund', $sale);

        if (! $sale->isCompleted()) {
            return response()->json(['message' => 'Alleen voltooide verkopen kunnen worden terugbetaald.'], 422);
        }

        $data = $request->validate([
            'reason'         => ['required', 'string', 'min:5', 'max:500'],
            'items'          => ['required', 'array', 'min:1'],
            'items.*.sale_item_id' => ['required', 'uuid'],
            'items.*.quantity'     => ['required', 'numeric', 'min:0.001'],
        ]);

        $refund = DB::transaction(function () use ($sale, $data, $request) {
            $refundTotal  = '0.00';
            $refundBtw    = '0.00';
            $refundItems  = [];

            foreach ($data['items'] as $refundItem) {
                $original = $sale->items->firstWhere('id', $refundItem['sale_item_id']);
                if (! $original) {
                    abort(422, 'Sale item not found: ' . $refundItem['sale_item_id']);
                }

                $qtyRatio    = bcdiv((string) $refundItem['quantity'], (string) $original->quantity, 6);
                $lineTotal   = bcmul((string) $original->line_total_srd, $qtyRatio, 2);
                $btwAmount   = bcmul((string) $original->btw_srd, $qtyRatio, 2);
                $refundTotal = bcadd($refundTotal, $lineTotal, 2);
                $refundBtw   = bcadd($refundBtw, $btwAmount, 2);

                $refundItems[] = [
                    'original_item_id'      => $original->id,
                    'product_id'            => $original->product_id,
                    'product_name_snapshot' => $original->product_name_snapshot,
                    'unit_price_srd'        => (string) $original->unit_price_srd,
                    'quantity'              => '-' . $refundItem['quantity'],
                    'discount_srd'          => '0.00',
                    'discount_pct'          => '0.00',
                    'btw_rate'              => (string) $original->btw_rate,
                    'btw_exempt'            => $original->btw_exempt,
                    'btw_srd'               => '-' . $btwAmount,
                    'line_total_srd'        => '-' . $lineTotal,
                ];
            }

            $refundSale = Sale::create([
                'store_id'           => $sale->store_id,
                'cashier_id'         => $request->user()->id,
                'customer_id'        => $sale->customer_id,
                'sale_number'        => Sale::nextNumber($sale->store_id),
                'subtotal_srd'       => '-' . $refundTotal,
                'discount_srd'       => '0.00',
                'btw_srd'            => '-' . $refundBtw,
                'total_srd'          => '-' . $refundTotal,
                'payment_method'     => $sale->payment_method,
                'status'             => 'completed',
                'source'             => $sale->source,
                'exchange_rate_used' => $sale->exchange_rate_used,
                'void_reason'        => 'REFUND: ' . $data['reason'],
                'occurred_at'        => now(),
            ]);

            foreach ($refundItems as $ri) {
                SaleItem::create(array_merge($ri, ['sale_id' => $refundSale->id]));
            }

            return $refundSale;
        });

        // Restore stock for refunded items (refund sale has the negative qtys)
        \App\Jobs\RecordStockMovements::dispatch($refund->id, $request->user()->id, 'refund');

        return response()->json(['data' => $refund->load('items')], 201);
    }

    // ─── List ─────────────────────────────────────────────────────────────

    // ─── Receipts ─────────────────────────────────────────────────────────

    /** GET /api/sales/{sale}/receipt/pdf */
    public function receiptPdf(Request $request, Sale $sale): Response
    {
        $this->authorize('view', $sale);

        $locale   = $request->input('locale', $sale->cashier?->locale ?? 'nl');
        $cashData = [
            'cash_tendered' => $request->input('cash_tendered', 0),
            'change'        => $request->input('change', 0),
        ];

        $pdf = $this->receipt->generatePdf($sale, $locale, $cashData);

        return response($pdf, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $sale->sale_number . '.pdf"',
        ]);
    }

    /** POST /api/sales/{sale}/receipt/email */
    public function receiptEmail(Request $request, Sale $sale): JsonResponse
    {
        $this->authorize('view', $sale);

        $data = $request->validate([
            'email'  => ['required', 'email'],
            'locale' => ['nullable', Rule::in(['nl', 'en'])],
        ]);

        $this->receipt->sendEmail($sale, $data['email'], $data['locale'] ?? 'nl');

        return response()->json(['message' => 'Kassabon verstuurd naar ' . $data['email']]);
    }

    /** GET /api/sales */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Sale::class);

        $request->validate([
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date_from' => ['nullable', 'date'],
            'date_to'   => ['nullable', 'date'],
            'status'    => ['nullable', Rule::in(['completed', 'voided', 'held'])],
            'per_page'  => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $sales = Sale::query()
            ->where('store_id', $request->input('store_id'))
            ->when($request->filled('date_from'), fn ($q) => $q->where('occurred_at', '>=', $request->input('date_from')))
            ->when($request->filled('date_to'),   fn ($q) => $q->where('occurred_at', '<=', $request->input('date_to') . ' 23:59:59'))
            ->when($request->filled('status'),    fn ($q) => $q->where('status', $request->input('status')))
            ->with('cashier:id,name')
            ->orderByDesc('occurred_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json($sales);
    }
}
