<?php

namespace App\Http\Controllers\Api;

use App\Events\SaleCompleted as SaleCompletedEvent;
use App\Http\Controllers\Controller;
use App\Jobs\DetectSaleAnomaly;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\BtwCalculationService;
use App\Services\DailyRateService;
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
        private readonly DailyRateService        $dailyRate,
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
            'customer_id'         => ['nullable', 'uuid', new \App\Rules\CustomerBelongsToOrg],
            'payment_method'      => ['required', Rule::in(\App\Models\Sale::PAYMENT_METHODS)],
            'cash_tendered'       => ['nullable', 'numeric', 'min:0'],
            'card_amount'         => ['nullable', 'numeric', 'min:0'],
            // Card reconciliation fields — optional, all four nullable so the
            // cashier can skip them and the sale still completes. They become
            // relevant when payment_method is 'card' or 'mixed'; ignored
            // silently on pure cash sales (we don't reject — keeps the API
            // forgiving for non-Suriname integrators).
            'card_bank'           => ['nullable', 'string', 'max:32'],
            'card_approval_code'  => ['nullable', 'string', 'max:16'],
            'card_terminal_ref'   => ['nullable', 'string', 'max:32'],
            'card_last_four'      => ['nullable', 'string', 'size:4', 'regex:/^[0-9]{4}$/'],
            // Phase 2 payment methods — bank_transfer / mobile_transfer /
            // foreign_cash. Same forgiving-fields pattern: only persisted when
            // relevant; silently ignored otherwise.
            //   - provider: bank name (transfer) OR app name (mobile)
            //   - reference: sender's payment ref / TX ID
            //   - sender_name: payer name (B2B / govt invoicing)
            //   - foreign_*: USD/EUR + amount + locked rate at sale time
            'payment_provider'    => ['nullable', 'string', 'max:64'],
            'payment_reference'   => ['nullable', 'string', 'max:64'],
            'payment_sender_name' => ['nullable', 'string', 'max:120'],
            'foreign_currency'    => ['nullable', 'string', 'size:3', Rule::in(['USD', 'EUR'])],
            'foreign_amount'      => ['nullable', 'numeric', 'min:0'],
            // Phase 3 — QR / mobile-wallet. Opaque payload the wallet scanned;
            // we don't parse it (provider-specific format) but store it for
            // future webhook matching.
            'qr_payload'          => ['nullable', 'string', 'max:1024'],
            'sale_discount_srd'   => ['nullable', 'numeric', 'min:0'],
            'sale_discount_pct'   => ['nullable', 'numeric', 'min:0', 'max:100'],
            'source'              => ['sometimes', Rule::in(['pos', 'api', 'import'])],
            'external_sale_ref'   => ['nullable', 'string', 'max:100'],
            'occurred_at'         => ['nullable', 'date'],
            'items'               => ['required', 'array', 'min:1'],
            'items.*.product_id'  => ['nullable', 'uuid', 'exists:products,id'],
            // Variant chosen at the till (e.g. "Bruine Bonen — 1kg"). Optional
            // — products with no variants leave this null. When set, the
            // controller snapshots variant_name + decrements variant stock
            // alongside the parent.
            'items.*.variant_id'  => ['nullable', 'uuid', 'exists:product_variants,id'],
            'items.*.product_name'=> ['required', 'string', 'max:200'],
            'items.*.variant_name'=> ['nullable', 'string', 'max:200'],
            'items.*.unit_price'  => ['required', 'numeric', 'min:0'],
            'items.*.quantity'    => ['required', 'numeric', 'min:0.001'],
            'items.*.btw_rate'    => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.btw_exempt'  => ['sometimes', 'boolean'],
            'items.*.discount_srd'=> ['nullable', 'numeric', 'min:0'],
        ]);

        // Per-method required-field enforcement. These can't go in the rule
        // array above because they cross-reference payment_method.
        $method = $data['payment_method'];
        if (in_array($method, [\App\Models\Sale::PM_BANK_TRANSFER, \App\Models\Sale::PM_MOBILE_TRANSFER], true)) {
            // bank_transfer needs the bank name; mobile_transfer needs the app
            // name. Both go in payment_provider. Reference is also required —
            // without it there's no way to match the inbound credit later.
            if (empty($data['payment_provider'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'payment_provider' => $method === \App\Models\Sale::PM_BANK_TRANSFER
                        ? 'Bank name is required for bank-transfer payments.'
                        : 'App / provider name is required for mobile-transfer payments.',
                ]);
            }
            if (empty($data['payment_reference'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'payment_reference' => 'A sender reference / transaction ID is required so the OA can confirm the funds when they land.',
                ]);
            }
        }
        if ($method === \App\Models\Sale::PM_FOREIGN_CASH) {
            // Must declare currency AND amount; rate is locked server-side.
            if (empty($data['foreign_currency']) || ! isset($data['foreign_amount'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'foreign_currency' => 'Currency and amount are both required for foreign-cash payments.',
                ]);
            }
        }
        if ($method === \App\Models\Sale::PM_QR_PAYMENT) {
            // Provider is required so reports can group by wallet. The QR
            // payload itself is optional — many wallets give the cashier only
            // a reference number to type in, no scannable code.
            if (empty($data['payment_provider'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'payment_provider' => 'Wallet / provider name is required for QR payments.',
                ]);
            }
        }

        // Idempotency: if external_sale_ref already exists for this store, return existing
        if (! empty($data['external_sale_ref'])) {
            $existing = Sale::where('store_id', $data['store_id'])
                ->where('external_sale_ref', $data['external_sale_ref'])
                ->first();
            if ($existing) {
                return response()->json(['data' => $existing->load('items')], 200);
            }
        }

        // Get today's locked exchange rate — self-heals via DailyRateService:
        //   1. row already there → instant
        //   2. row missing, API up → fetches + locks + uses
        //   3. API down → carries yesterday's rate forward, marks fallback,
        //      audit-logs it
        //   4. truly empty (first-ever sale on a fresh install) → null, we
        //      surface the actionable error below
        $rate = $this->dailyRate->ensureTodayRate();
        if (! $rate) {
            // Message is locale-aware via SetLocale middleware reading the
            // frontend's Accept-Language header (or the logged-in user's
            // saved locale). Same key in lang/nl/errors.php + lang/en/errors.php.
            $vendor = config('josbin_pos.vendor');
            return response()->json([
                'message' => __('errors.no_daily_rate', [
                    'vendor' => $vendor['name']  ?? 'Josbin',
                    'email'  => $vendor['email'] ?? '',
                ]),
                'code'    => 'NO_DAILY_RATE',
                'support' => [
                    'name'  => $vendor['name']  ?? null,
                    'email' => $vendor['email'] ?? null,
                    'phone' => $vendor['phone'] ?? null,
                ],
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

        // Compliance (C6): a BTW-charging receipt must carry the
        // organisation's Belastingdienst registration number. If this basket
        // charges BTW but the org has none on file, refuse — issuing a
        // BTW receipt without a registration number is non-compliant. Sales
        // with no BTW (fully exempt baskets) are unaffected.
        if (bccomp((string) $cart['btw_total'], '0', 2) > 0) {
            $org = \App\Models\Store::find($data['store_id'])?->organisation;
            if ($org && blank($org->btw_number)) {
                return response()->json([
                    'message' => __('errors.missing_btw_number'),
                    'code'    => 'MISSING_BTW_NUMBER',
                ], 422);
            }
        }

        // Oversell policy is per-organisation (default OFF = allow + track
        // negative). Resolve it once so both the variant guard and the
        // product-stock ledger below enforce the same rule.
        $blockOversell = (bool) \App\Models\Organisation::query()
            ->where('id', $request->user()->organisation_id)
            ->value('block_oversell');

        $sale = DB::transaction(function () use ($data, $cart, $rate, $request, $blockOversell) {
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
                // Reconciliation fields — only persisted when this sale
                // involves a card. Strip otherwise so a `cash` sale never
                // accidentally carries leftover bank metadata from a
                // forgetful integrator.
                'card_bank'           => in_array($data['payment_method'], ['card', 'mixed'], true) ? ($data['card_bank'] ?? null) : null,
                'card_approval_code'  => in_array($data['payment_method'], ['card', 'mixed'], true) ? ($data['card_approval_code'] ?? null) : null,
                'card_terminal_ref'   => in_array($data['payment_method'], ['card', 'mixed'], true) ? ($data['card_terminal_ref'] ?? null) : null,
                'card_last_four'      => in_array($data['payment_method'], ['card', 'mixed'], true) ? ($data['card_last_four'] ?? null) : null,
                // Phase 2/3 — transfer + foreign + QR fields. Same forgiving
                // pattern as card_*: silently nulled when not applicable.
                // qr_payment also uses payment_provider + payment_reference
                // alongside the QR-specific qr_payload.
                'payment_provider'    => in_array($data['payment_method'], [\App\Models\Sale::PM_BANK_TRANSFER, \App\Models\Sale::PM_MOBILE_TRANSFER, \App\Models\Sale::PM_QR_PAYMENT], true) ? ($data['payment_provider'] ?? null) : null,
                'payment_reference'   => in_array($data['payment_method'], [\App\Models\Sale::PM_BANK_TRANSFER, \App\Models\Sale::PM_MOBILE_TRANSFER, \App\Models\Sale::PM_QR_PAYMENT], true) ? ($data['payment_reference'] ?? null) : null,
                'payment_sender_name' => in_array($data['payment_method'], [\App\Models\Sale::PM_BANK_TRANSFER, \App\Models\Sale::PM_MOBILE_TRANSFER], true) ? ($data['payment_sender_name'] ?? null) : null,
                'foreign_currency'    => $data['payment_method'] === \App\Models\Sale::PM_FOREIGN_CASH ? ($data['foreign_currency'] ?? null) : null,
                'foreign_amount'      => $data['payment_method'] === \App\Models\Sale::PM_FOREIGN_CASH ? ($data['foreign_amount'] ?? null) : null,
                // Foreign cash locks the day's rate at sale time — same rate
                // we already pull for the SRD column on every receipt.
                'foreign_rate_used'   => $data['payment_method'] === \App\Models\Sale::PM_FOREIGN_CASH ? $rate->usd_to_srd : null,
                'qr_payload'          => $data['payment_method'] === \App\Models\Sale::PM_QR_PAYMENT ? ($data['qr_payload'] ?? null) : null,
                'change_srd'          => $changeDue,
                'status'              => 'completed',
                'source'              => $data['source'] ?? 'pos',
                'exchange_rate_used'  => $rate->usd_to_srd,
                'external_sale_ref'   => $data['external_sale_ref'] ?? null,
                'occurred_at'         => $data['occurred_at'] ?? now(),
            ]);

            foreach ($data['items'] as $i => $item) {
                $calc = $cart['items'][$i];

                // Decrement variant stock here (parent product stock is
                // handled by StockMovementService::recordSale below — that
                // works at the per-store product_stocks table). Variant
                // stock is org-wide on the variant row for v1; per-store
                // variant stock is a phase-3 migration when a chain needs it.
                //
                // Lock the row with SELECT … FOR UPDATE, then write the new
                // value explicitly. The previous `->lockForUpdate()->decrement()`
                // never actually locked — FOR UPDATE is only honoured on a
                // SELECT, so the decrement UPDATE ran lock-free and two
                // concurrent sales of the last unit could both succeed and
                // drive stock negative. We reuse the locked row for the cost
                // snapshot below so there's no second fetch.
                $variant = null;
                if (! empty($item['variant_id'])) {
                    $variant = \App\Models\ProductVariant::where('id', $item['variant_id'])
                        ->lockForUpdate()
                        ->first();
                    if ($variant) {
                        $newVariantQty = bcsub((string) $variant->stock_qty, (string) $item['quantity'], 3);
                        if ($blockOversell && bccomp($newVariantQty, '0', 3) < 0) {
                            throw new \App\Exceptions\InsufficientStockException(
                                productName: trim(($item['product_name'] ?? '').' '.($item['variant_name'] ?? ''))
                                    ?: ($variant->name_nl ?? (string) $variant->id),
                                available: (float) $variant->stock_qty,
                                requested: (float) $item['quantity'],
                            );
                        }
                        $variant->update(['stock_qty' => $newVariantQty]);
                    }
                }

                // Snapshot cost at sale time — variant's effective cost (its
                // own override, else parent's) when a variant was chosen,
                // otherwise the product's cost. NULL when nothing is set.
                // line_profit = line_total - (cost * qty). Both NULL if cost
                // is unknown, so reports can SUM() without a CASE.
                $costSnap = null;
                if ($variant) {
                    $costSnap = $variant->effectiveCost();
                } elseif (! empty($item['product_id'])) {
                    $costSnap = \App\Models\Product::where('id', $item['product_id'])->value('cost_price');
                }
                $lineProfit = $costSnap !== null
                    ? bcsub((string) $calc['line_total'], bcmul((string) $costSnap, (string) $item['quantity'], 2), 2)
                    : null;

                SaleItem::create([
                    'sale_id'               => $sale->id,
                    'product_id'            => $item['product_id'] ?? null,
                    // Variant attribution — set when the cashier picked a
                    // specific size/colour/flavour. variant_name_snapshot is
                    // independent of product_name_snapshot so the receipt
                    // can show "Bruine Bonen" on one line and "1kg" beneath.
                    'variant_id'            => $item['variant_id'] ?? null,
                    'variant_name_snapshot' => $item['variant_name'] ?? null,
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
                    'cost_snapshot_srd'     => $costSnap,
                    'line_profit_srd'       => $lineProfit,
                ]);
            }

            // Update customer spend if attached. Pass the bcmath STRING (not a
            // float cast) so Postgres does exact DECIMAL arithmetic — every
            // other money value is DECIMAL/bcmath, and a float cast here made
            // the lifetime-spend column drift from SUM(sales.total_srd). (D2)
            if ($sale->customer_id) {
                \App\Models\Customer::where('id', $sale->customer_id)->increment('visit_count');
                \App\Models\Customer::where('id', $sale->customer_id)
                    ->increment('total_spend_srd', $cart['total']);
            }

            // Decrement per-store product stock + write the movement ledger
            // INSIDE this transaction. Previously this was an async queued job
            // dispatched after commit — if the queue was down or the job failed
            // (3 tries then just logged), the sale committed but stock was never
            // decremented → real oversell. Now a strict-mode oversell throws
            // here and rolls the entire sale back; a queue outage can no longer
            // desync sale and stock.
            $this->stock->recordSale($sale, $request->user()->id, $blockOversell);

            return $sale;
        });

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
            return response()->json(['message' => __('errors.void_only_completed')], 422);
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
                'message' => __('errors.void_requires_second_approval'),
                'code'    => 'VOID_PENDING_APPROVAL',
                'data'    => $sale,
            ]);
        }

        // Segregation of duties: a government void's second approval must be
        // given by a DIFFERENT user than the one who requested it.
        if ($needsSecondApproval && $sale->voided_by === $request->user()->id) {
            return response()->json([
                'message' => __('errors.second_approver_must_differ'),
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
            'customer_id'=> ['nullable', 'uuid', new \App\Rules\CustomerBelongsToOrg],
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
            return response()->json(['message' => __('errors.refund_only_completed')], 422);
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
                    // Carry variant attribution onto the refund line so stock
                    // restoration routes back to the variant row (CR-1) and the
                    // refund receipt shows the same size/flavour as the original.
                    'variant_id'            => $original->variant_id,
                    'variant_name_snapshot' => $original->variant_name_snapshot,
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

    // ─── Blind return (no original sale) ──────────────────────────────────

    /**
     * POST /api/sales/blind-return
     *
     * A return with NO original sale on record — the customer brings goods back
     * without a receipt the till can find. Because this creates money-out from
     * nothing, it is manager-gated (cashiers lack `sales.refund`), requires a
     * reason, and is written to the immutable audit trail with full attribution.
     *
     * Mechanically it is a negative Sale (mirrors refund()): negative totals/BTW,
     * void_reason 'BLIND RETURN: …', items at negative quantity. Stock for any
     * catalogue-linked line is restored; free-text lines (no product_id) refund
     * money only.
     */
    public function blindReturn(Request $request): JsonResponse
    {
        // Manager+ only — sales.refund is granted to SM/OA/SA, never cashiers.
        abort_unless($request->user()->can('sales.refund'), 403);

        $data = $request->validate([
            'store_id'             => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'payment_method'       => ['required', Rule::in([\App\Models\Sale::PM_CASH, \App\Models\Sale::PM_CARD, \App\Models\Sale::PM_BANK_TRANSFER, \App\Models\Sale::PM_MOBILE_TRANSFER])],
            'reason'               => ['required', 'string', 'min:5', 'max:500'],
            'customer_id'          => ['nullable', 'uuid', new \App\Rules\CustomerBelongsToOrg],
            'items'                => ['required', 'array', 'min:1'],
            'items.*.product_id'   => ['nullable', 'uuid', Rule::exists('products', 'id')->where('organisation_id', $request->user()->organisation_id)],
            'items.*.product_name' => ['required', 'string', 'max:200'],
            'items.*.unit_price'   => ['required', 'numeric', 'min:0'],
            'items.*.quantity'     => ['required', 'numeric', 'gt:0'],
            'items.*.btw_rate'     => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.btw_exempt'   => ['sometimes', 'boolean'],
        ]);

        abort_unless($request->user()->canAccessStore($data['store_id']), 403);

        // Lock the day's rate (same gate as a sale — keeps every money row auditable).
        $rate = $this->dailyRate->ensureTodayRate();
        if (! $rate) {
            return response()->json(['message' => __('errors.no_daily_rate', ['vendor' => 'Josbin', 'email' => '']), 'code' => 'NO_DAILY_RATE'], 422);
        }

        $return = DB::transaction(function () use ($data, $request, $rate) {
            $subtotal = '0.00';
            $btwTotal = '0.00';
            $lines    = [];

            foreach ($data['items'] as $item) {
                $exempt    = (bool) ($item['btw_exempt'] ?? false);
                $lineGross = bcmul((string) $item['unit_price'], (string) $item['quantity'], 2);
                $lineBtw   = $exempt ? '0.00' : $this->btw->extractBtw($lineGross, (string) $item['btw_rate']);

                $subtotal = bcadd($subtotal, $lineGross, 2);
                $btwTotal = bcadd($btwTotal, $lineBtw, 2);

                $lines[] = [
                    'product_id'            => $item['product_id'] ?? null,
                    'product_name_snapshot' => $item['product_name'],
                    'unit_price_srd'        => (string) $item['unit_price'],
                    'quantity'              => '-' . $item['quantity'],   // negative = returned
                    'discount_srd'          => '0.00',
                    'discount_pct'          => '0.00',
                    'btw_rate'              => (string) $item['btw_rate'],
                    'btw_exempt'            => $exempt,
                    'btw_srd'               => '-' . $lineBtw,
                    'line_total_srd'        => '-' . $lineGross,
                ];
            }

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
                'subtotal_srd'        => '-' . $subtotal,
                'discount_srd'        => '0.00',
                'btw_srd'             => '-' . $btwTotal,
                'total_srd'           => '-' . $subtotal,
                'payment_method'      => $data['payment_method'],
                'status'              => 'completed',
                'source'              => 'pos',
                'exchange_rate_used'  => $rate->usd_to_srd,
                'void_reason'         => 'BLIND RETURN: ' . $data['reason'],
                'occurred_at'         => now(),
            ]);

            foreach ($lines as $l) {
                SaleItem::create(array_merge($l, ['sale_id' => $sale->id]));
            }

            // Heavyweight audit — money out with no original sale is exactly the
            // event the Rekenkamer trail exists for. Manager id + reason + total.
            \App\Models\AuditLog::create([
                'user_id'         => $request->user()->id,
                'organisation_id' => $request->user()->organisation_id,
                'event'           => 'sale.blind_return',
                'auditable_type'  => 'sale',
                'auditable_id'    => $sale->id,
                'old_values'      => null,
                'new_values'      => [
                    'reason'         => $data['reason'],
                    'total_srd'      => '-' . $subtotal,
                    'btw_srd'        => '-' . $btwTotal,
                    'payment_method' => $data['payment_method'],
                    'line_count'     => count($lines),
                ],
                'ip_address'      => $request->ip(),
                'created_at'      => now(),
            ]);

            return $sale;
        });

        // Returned catalogue goods go back on the shelf (negative qtys → restore).
        \App\Jobs\RecordStockMovements::dispatch($return->id, $request->user()->id, 'refund');

        return response()->json(['data' => $return->load('items')], 201);
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

    /**
     * GET /api/sales/{sale}/receipt/html
     *
     * Same receipt as the PDF, rendered as HTML. The POS browser-print
     * fallback fetches this and prints it from a hidden iframe — reliable,
     * unlike printing a PDF blob (which renders blank in Chrome).
     */
    public function receiptHtml(Request $request, Sale $sale): Response
    {
        $this->authorize('view', $sale);

        $locale   = $request->input('locale', $sale->cashier?->locale ?? 'nl');
        $cashData = [
            'cash_tendered' => $request->input('cash_tendered', 0),
            'change'        => $request->input('change', 0),
        ];

        return response(
            $this->receipt->generateHtml($sale, $locale, $cashData),
            200,
            ['Content-Type' => 'text/html; charset=UTF-8']
        );
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

        return response()->json(['message' => __('errors.receipt_emailed', ['email' => $data['email']])]);
    }

    /**
     * GET /api/sales/pending-payments
     *
     * Lists bank_transfer / mobile_transfer sales that the OA hasn't yet
     * confirmed funds for. Scoped by org for OA/SM; SA sees all orgs.
     * Powered by the partial index `sales_pending_payment_idx`.
     */
    public function pendingPaymentsQueue(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Sale::class);

        $user = $request->user();
        $query = Sale::query()
            ->whereIn('payment_method', Sale::PM_PENDING_CONFIRMATION)
            ->whereNull('payment_confirmed_at')
            ->where('status', 'completed')
            ->with('store:id,name,organisation_id', 'cashier:id,name', 'customer:id,name')
            ->orderByDesc('occurred_at');

        // Non-super-admin: scope to own org via the store relation.
        if (! $user->isSuperAdmin()) {
            $query->whereHas('store', fn ($q) => $q->where('organisation_id', $user->organisation_id));
        }

        if ($request->filled('store_id')) {
            $query->where('store_id', $request->input('store_id'));
        }

        return response()->json($query->paginate($request->integer('per_page', 50)));
    }

    /**
     * POST /api/sales/{sale}/confirm-payment
     *
     * OA marks a bank_transfer / mobile_transfer sale as funded once they
     * verify the credit landed in the bank account. Audit-logged.
     */
    public function confirmPayment(Request $request, Sale $sale): JsonResponse
    {
        $this->authorize('confirmPayment', $sale);

        if (! in_array($sale->payment_method, Sale::PM_PENDING_CONFIRMATION, true)) {
            return response()->json([
                'message' => 'Only bank_transfer and mobile_transfer sales can be confirmed.',
                'code'    => 'CONFIRM_NOT_APPLICABLE',
            ], 422);
        }
        if ($sale->payment_confirmed_at !== null) {
            return response()->json([
                'message' => 'This payment is already confirmed.',
                'code'    => 'ALREADY_CONFIRMED',
                'confirmed_at' => $sale->payment_confirmed_at->toIso8601String(),
            ], 409);
        }

        $note = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ])['note'] ?? null;

        $sale->update([
            'payment_confirmed_at' => now(),
            'payment_confirmed_by' => $request->user()->id,
        ]);

        \App\Models\AuditLog::create([
            'user_id'         => $request->user()->id,
            'organisation_id' => $sale->store->organisation_id,
            'event'           => 'sale.payment_confirmed',
            'auditable_type'  => 'sale',
            'auditable_id'    => $sale->id,
            'old_values'      => ['payment_confirmed_at' => null],
            'new_values'      => [
                'payment_confirmed_at' => now()->toIso8601String(),
                'method'    => $sale->payment_method,
                'provider'  => $sale->payment_provider,
                'reference' => $sale->payment_reference,
                'note'      => $note,
            ],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        return response()->json([
            'data' => $sale->fresh()->load('store:id,name', 'cashier:id,name'),
        ]);
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
