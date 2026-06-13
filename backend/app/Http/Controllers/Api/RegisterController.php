<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * RegisterController
 *
 * Manages physical cash register open/close lifecycle per cashier session.
 * Rules:
 *  - One open session per register at a time.
 *  - Once closed, re-open requires store manager approval.
 *  - Every state change is auditable via the audit_logs table.
 */
class RegisterController extends Controller
{
    // ─── Create a register ───────────────────────────────────────────────

    /**
     * POST /api/registers
     * Store manager creates a new physical register terminal.
     */
    public function createRegister(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $data = $request->validate([
            'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'name'     => ['required', 'string', 'max:100'],
            'note'     => ['nullable', 'string', 'max:500'],
        ]);

        $nextNumber = Register::where('store_id', $data['store_id'])->max('number') + 1;

        $register = Register::create([
            'store_id'  => $data['store_id'],
            'name'      => $data['name'],
            'number'    => $nextNumber,
            'is_active' => true,
        ]);

        $this->logRegisterActivity($request->user(), $register, 'register.created', array_filter([
            'name' => $register->name,
            'note' => $data['note'] ?? null,
        ]));

        return response()->json(['data' => $this->formatRegister($register)], 201);
    }

    // ─── Update a register ───────────────────────────────────────────────

    /**
     * PUT /api/registers/{register}
     * Rename a register or toggle active status.
     */
    public function updateRegister(Request $request, Register $register): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $data = $request->validate([
            'name'      => ['sometimes', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $register->update($data);

        $this->logRegisterActivity($request->user(), $register, 'register.updated', $data);

        return response()->json(['data' => $this->formatRegister($register->fresh()->load('openSession.cashier:id,name'))]);
    }

    // ─── Deactivate a register ───────────────────────────────────────────

    /**
     * DELETE /api/registers/{register}
     * Deactivates a register (soft delete — sets is_active = false).
     */
    public function destroyRegister(Request $request, Register $register): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);
        abort_if($register->openSession()->exists(), 409, 'Cannot deactivate a register with an open session.');

        $data = $request->validate([
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $register->update(['is_active' => false]);

        $this->logRegisterActivity($request->user(), $register, 'register.deactivated', array_filter([
            'name' => $register->name,
            'note' => $data['note'] ?? null,
        ]));

        return response()->json(null, 204);
    }

    // ─── List registers for a store ──────────────────────────────────────

    /**
     * GET /api/registers?store_id=
     * Returns all registers for a store with their current session status.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);

        $registers = Register::where('store_id', $request->store_id)
            ->where('is_active', true)
            ->with([
                'openSession.cashier:id,name,email',
                'closedTodaySessions' => fn ($q) => $q->with('cashier:id,name')->limit(1),
            ])
            ->orderBy('number')
            ->get()
            ->map(fn ($r) => $this->formatRegister($r));

        return response()->json(['data' => $registers]);
    }

    // ─── Open a register session ──────────────────────────────────────────

    /**
     * POST /api/registers/{register}/open
     * Cashier opens their register for the day with an opening float.
     */
    public function open(Request $request, Register $register): JsonResponse
    {
        $user = $request->user();

        // Cashier / Store Manager must be assigned to this store.
        // Empty assignment = all stores in org (backfill).
        if (! $user->canAccessStore($register->store_id)) {
            return response()->json([
                'message' => 'U bent niet toegewezen aan deze vestiging. (You are not assigned to this store.)',
                'code'    => 'STORE_NOT_ASSIGNED',
            ], 403);
        }

        $request->validate([
            'opening_float' => ['required', 'numeric', 'min:0'],
        ]);

        // Block if another session is already open on this register
        $existing = RegisterSession::where('register_id', $register->id)
            ->whereIn('status', ['open', 'reopen_requested'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => __('register.already_open'),
                'code'    => 'REGISTER_ALREADY_OPEN',
                'session' => $this->formatSession($existing->load('cashier:id,name')),
            ], 409);
        }

        // Z-Report semantics: a register that was already closed today cannot
        // be re-opened without manager involvement. The books are sealed.
        // Managers (and above) can force a new session — typically for a
        // shift handover where the previous cashier already left.
        if (! $user->isAtLeastManager()) {
            $closedToday = RegisterSession::where('register_id', $register->id)
                ->where('status', 'closed')
                ->whereDate('closed_at', today())
                ->whereNull('cleared_at')
                ->latest('closed_at')
                ->with('cashier:id,name')
                ->first();

            if ($closedToday) {
                return response()->json([
                    'message' => __('errors.register_already_closed_today'),
                    'code'    => 'REGISTER_CLOSED_FOR_DAY',
                    'closed_today' => [
                        'session_id'   => $closedToday->id,
                        'cashier_id'   => $closedToday->cashier_id,
                        'cashier_name' => $closedToday->cashier?->name,
                        'closed_at'    => $closedToday->closed_at?->setTimezone('America/Paramaribo')->toIso8601String(),
                    ],
                ], 409);
            }
        }

        // Check this cashier doesn't have another open session at this store today
        $cashierOpen = RegisterSession::where('cashier_id', $user->id)
            ->where('store_id', $register->store_id)
            ->whereDate('opened_at', today())
            ->whereIn('status', ['open', 'reopen_requested'])
            ->first();

        if ($cashierOpen) {
            return response()->json([
                'message' => __('register.cashier_already_has_open'),
                'code'    => 'CASHIER_ALREADY_HAS_OPEN_SESSION',
            ], 409);
        }

        $session = RegisterSession::create([
            'register_id'    => $register->id,
            'store_id'       => $register->store_id,
            'cashier_id'     => $user->id,
            'opening_float'  => $request->opening_float,
            'status'         => 'open',
            'opened_at'      => now(),
        ]);

        $this->logRegisterActivity($user, $session, 'register.opened', ['register' => $register->name, 'opening_float' => $request->opening_float]);

        return response()->json(['data' => $this->formatSession($session->load('cashier:id,name'))], 201);
    }

    // ─── Close a register session ─────────────────────────────────────────

    /**
     * POST /api/registers/sessions/{session}/close
     * Cashier closes their register, counts cash, records discrepancy.
     */
    public function close(Request $request, RegisterSession $session): JsonResponse
    {
        $user = $request->user();

        // Only the cashier who opened it (or a manager) can close it
        abort_unless(
            $session->cashier_id === $user->id || $user->isAtLeastManager(),
            403
        );

        abort_if($session->isClosed(), 409, 'Register is already closed.');

        $request->validate([
            'closing_cash_counted' => ['required', 'numeric', 'min:0'],
            'closing_note'         => ['nullable', 'string', 'max:500'],
        ]);

        $expectedCash = $this->computeExpectedCash($session);

        $discrepancy = bcsub(
            (string) $request->closing_cash_counted,
            $expectedCash,
            2
        );

        $session->update([
            'status'               => 'closed',
            'closing_cash_counted' => $request->closing_cash_counted,
            'expected_cash'        => $expectedCash,
            'discrepancy'          => $discrepancy,
            'closed_at'            => now(),
            'closing_note'         => $request->closing_note,
        ]);

        $this->logRegisterActivity($user, $session, 'register.closed', [
                'expected_cash'  => $expectedCash,
                'counted_cash'   => $request->closing_cash_counted,
                'discrepancy'    => $discrepancy,
            ]);

        return response()->json(['data' => $this->formatSession($session->fresh()->load('cashier:id,name'))]);
    }

    // ─── Cash drawer: manual pay-in / pay-out ─────────────────────────────

    /**
     * POST /api/registers/sessions/{session}/cash-movements
     *
     * Records a manual drawer movement on an OPEN session:
     *   direction 'in'  — cash added (change top-up, owner float)
     *   direction 'out' — cash removed (supplier paid from till, etc.)
     *
     * These adjust the session's expected cash so the Z-Report reconciliation
     * accounts for money that entered/left the drawer outside of sales.
     */
    public function recordCashMovement(Request $request, RegisterSession $session): JsonResponse
    {
        $user = $request->user();

        // Only the cashier on this session (or a manager) can move its cash.
        abort_unless(
            $session->cashier_id === $user->id || $user->isAtLeastManager(),
            403
        );

        abort_if($session->isClosed(), 409, __('errors.register_already_closed'));

        $data = $request->validate([
            'direction' => ['required', \Illuminate\Validation\Rule::in([\App\Models\CashMovement::DIR_IN, \App\Models\CashMovement::DIR_OUT])],
            'amount'    => ['required', 'numeric', 'gt:0'],
            'reason'    => ['required', 'string', 'min:2', 'max:255'],
        ]);

        $movement = \App\Models\CashMovement::create([
            'register_session_id' => $session->id,
            'store_id'            => $session->store_id,
            'user_id'             => $user->id,
            'direction'           => $data['direction'],
            'amount'              => number_format((float) $data['amount'], 2, '.', ''),
            'reason'              => $data['reason'],
            'created_at'          => now(),
        ]);

        $this->logRegisterActivity($user, $session, 'register.cash_movement', [
            'direction' => $movement->direction,
            'amount'    => (string) $movement->amount,
            'reason'    => $movement->reason,
        ]);

        return response()->json([
            'data' => [
                'id'        => $movement->id,
                'direction' => $movement->direction,
                'amount'    => number_format((float) $movement->amount, 2, '.', ''),
                'reason'    => $movement->reason,
                'created_at'=> $movement->created_at?->toIso8601String(),
                // Echo the running expected cash so the UI can update immediately.
                'expected_cash' => number_format((float) $this->computeExpectedCash($session), 2, '.', ''),
            ],
        ], 201);
    }

    // ─── Manager: reopen register for next shift ──────────────────────────

    /**
     * POST /api/registers/{register}/clear-closed-today
     *
     * Manager action: a register that was closed for the day (formal Z-Report
     * lock — see open() above) gets cleared so the next shift can open a new
     * session on the same till. The previous closed sessions stay closed —
     * we don't mutate their status — we just mark them `cleared_at` so the
     * `open()` block ignores them. This keeps the audit trail honest:
     * close-events are immutable, manager-initiated clears are a separate
     * recorded action.
     *
     * Required reason. Optional "for cashier" hint (handover context).
     */
    public function clearClosedToday(Request $request, Register $register): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAtLeastManager(), 403);

        $data = $request->validate([
            'reason'      => ['required', 'string', 'min:3', 'max:500'],
            'for_cashier' => ['nullable', 'string', 'max:200'],
        ]);

        $sessions = RegisterSession::where('register_id', $register->id)
            ->where('status', 'closed')
            ->whereDate('closed_at', today())
            ->whereNull('cleared_at')
            ->get();

        if ($sessions->isEmpty()) {
            return response()->json([
                'message' => 'Geen gesloten sessie van vandaag om te heropenen. (No closed-today session to reopen.)',
                'code'    => 'NOTHING_TO_CLEAR',
            ], 409);
        }

        foreach ($sessions as $session) {
            $session->update([
                'cleared_at'        => now(),
                'cleared_by'        => $user->id,
                'clear_note'        => $data['reason'],
                'clear_for_cashier' => $data['for_cashier'] ?? null,
            ]);
            $this->logRegisterActivity($user, $session, 'register.cleared_for_next_shift', array_filter([
                'register'    => $register->name,
                'reason'      => $data['reason'],
                'for_cashier' => $data['for_cashier'] ?? null,
            ]));
        }

        return response()->json([
            'data' => $this->formatRegister(
                $register->fresh()->load(['openSession.cashier:id,name,email', 'closedTodaySessions'])
            ),
            'cleared_count' => $sessions->count(),
        ]);
    }

    // ─── Request re-open ──────────────────────────────────────────────────

    /**
     * POST /api/registers/sessions/{session}/request-reopen
     * Cashier requests manager approval to re-open a closed register.
     */
    public function requestReopen(Request $request, RegisterSession $session): JsonResponse
    {
        $user = $request->user();

        abort_unless($session->cashier_id === $user->id, 403);
        abort_unless($session->isClosed(), 409, 'Only closed sessions can be re-opened.');

        $request->validate([
            'reopen_reason' => ['required', 'string', 'max:500'],
        ]);

        $session->update([
            'status'               => 'reopen_requested',
            'reopen_requested_at'  => now(),
            'reopen_reason'        => $request->reopen_reason,
            'reopen_requested_by'  => $user->id,
        ]);

        $this->logRegisterActivity($user, $session, 'register.reopen_requested', ['reason' => $request->reopen_reason]);

        return response()->json(['data' => $this->formatSession($session->fresh())]);
    }

    // ─── Approve or deny re-open ──────────────────────────────────────────

    /**
     * POST /api/registers/sessions/{session}/approve-reopen
     * Store manager approves or denies a re-open request.
     */
    public function approveReopen(Request $request, RegisterSession $session): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->isAtLeastManager(), 403);
        abort_unless($session->isReopenRequested(), 409, 'No pending re-open request.');

        $request->validate([
            'approved'      => ['required', 'boolean'],
            'denial_reason' => ['required_if:approved,false', 'nullable', 'string', 'max:500'],
        ]);

        if ($request->approved) {
            $session->update([
                'status'              => 'open',
                'reopen_approved_by'  => $user->id,
                'reopen_approved_at'  => now(),
                'reopen_denial_reason'=> null,
                // Reset cash close fields so cashier re-counts at next close
                'closing_cash_counted'=> null,
                'expected_cash'       => null,
                'discrepancy'         => null,
                'closed_at'           => null,
                'closing_note'        => null,
            ]);
            $event = 'register.reopen_approved';
        } else {
            $session->update([
                'status'               => 'closed',
                'reopen_denial_reason' => $request->denial_reason,
            ]);
            $event = 'register.reopen_denied';
        }

        $this->logRegisterActivity($user, $session, $event, [
                'approved'      => $request->approved,
                'denial_reason' => $request->denial_reason,
            ]);

        return response()->json(['data' => $this->formatSession($session->fresh()->load('cashier:id,name'))]);
    }

    // ─── Get current session for logged-in cashier ────────────────────────

    /**
     * GET /api/registers/my-session?store_id=
     * POS app calls this on boot to check if cashier has an open session.
     */
    public function mySession(Request $request): JsonResponse
    {
        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);

        $session = RegisterSession::where('cashier_id', $request->user()->id)
            ->where('store_id', $request->store_id)
            ->whereIn('status', ['open', 'reopen_requested'])
            ->with('register:id,name,number')
            ->latest('opened_at')
            ->first();

        return response()->json(['data' => $session ? $this->formatSession($session) : null]);
    }

    // ─── Session report (mini Z-Report per cashier) ───────────────────────

    /**
     * GET /api/registers/sessions/{session}/report
     *
     * Industry-standard Z-Report shape: separates gross / discounts / refunds /
     * net, surfaces BTW for Belastingdienst filings, and exposes the cash-drawer
     * math so a discrepancy can be traced. Refunds are stored as negative-total
     * sale rows (see SaleController::refund), so we split positive vs negative
     * with a CASE expression rather than two queries.
     */
    public function sessionReport(RegisterSession $session): JsonResponse
    {
        $user = request()->user();

        abort_unless(
            $session->cashier_id === $user->id || $user->isAtLeastManager(),
            403
        );

        $agg = Sale::where('register_session_id', $session->id)
            ->where('status', 'completed')
            ->selectRaw("
                COUNT(CASE WHEN total_srd >= 0 THEN 1 END)                                   as sale_count,
                COUNT(CASE WHEN total_srd <  0 THEN 1 END)                                   as refund_count,
                COALESCE(SUM(CASE WHEN total_srd >= 0 THEN total_srd     END), 0)            as gross_sales,
                COALESCE(SUM(CASE WHEN total_srd <  0 THEN total_srd     END), 0)            as refunds_total,
                COALESCE(SUM(CASE WHEN total_srd >= 0 THEN discount_srd  END), 0)            as discounts_total,
                COALESCE(SUM(btw_srd), 0)                                                    as btw_total,
                COALESCE(SUM(total_srd), 0)                                                  as net_sales,
                COALESCE(SUM(CASE WHEN payment_method = 'cash'  THEN total_srd END), 0)      as cash_net,
                COALESCE(SUM(CASE WHEN payment_method = 'card'  THEN total_srd END), 0)      as card_net,
                COALESCE(SUM(CASE WHEN payment_method = 'mixed' THEN total_srd END), 0)      as mixed_net,
                COALESCE(SUM(
                  CASE WHEN total_srd >= 0 AND payment_method IN ('cash','mixed')
                       THEN COALESCE(cash_received_srd, 0) - COALESCE(change_srd, 0)
                  END
                ), 0)                                                                        as cash_in,
                COALESCE(SUM(
                  CASE WHEN total_srd <  0 AND payment_method IN ('cash','mixed')
                       THEN ABS(total_srd)
                  END
                ), 0)                                                                        as cash_out
            ")
            ->first();

        $voids = Sale::where('register_session_id', $session->id)
            ->where('status', 'voided')
            ->selectRaw('COUNT(*) as void_count, COALESCE(SUM(ABS(total_srd)), 0) as void_total')
            ->first();

        $itemsAgg = \App\Models\SaleItem::whereIn('sale_id',
                Sale::where('register_session_id', $session->id)->where('status', 'completed')->pluck('id'))
            ->selectRaw('COALESCE(SUM(ABS(quantity)), 0) as units')
            ->first();

        $fmt = fn ($v) => number_format((float) $v, 2, '.', '');

        $openingFloat = (string) $session->opening_float;
        $cashIn       = (string) ($agg->cash_in  ?? 0);
        $cashOut      = (string) ($agg->cash_out ?? 0);

        // Manual drawer movements (pay-in / pay-out) split out so the Z-Report
        // shows them as their own line, then folded into expected cash.
        $movements = \App\Models\CashMovement::where('register_session_id', $session->id)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount END), 0) as pay_in,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount END), 0) as pay_out
            ")
            ->first();
        $payIn  = (string) ($movements->pay_in  ?? 0);
        $payOut = (string) ($movements->pay_out ?? 0);

        $expectedLive = bcadd(
            bcadd($openingFloat, bcsub($cashIn, $cashOut, 2), 2),
            bcsub($payIn, $payOut, 2),
            2,
        );
        // Use the persisted expected_cash after close (snapshot at close-time);
        // before close, compute live so the cashier sees the running expected.
        $expectedCash = $session->expected_cash !== null
            ? number_format((float) $session->expected_cash, 2, '.', '')
            : $fmt($expectedLive);

        return response()->json([
            'data' => [
                'session'              => $this->formatSession($session->load('cashier:id,name', 'register:id,name,number')),
                'transaction_count'    => (int) ($agg->sale_count ?? 0),
                'refund_count'         => (int) ($agg->refund_count ?? 0),
                'void_count'           => (int) ($voids->void_count ?? 0),
                'void_total'           => $fmt($voids->void_total ?? 0),
                'items_sold'           => $fmt($itemsAgg->units ?? 0),
                'gross_sales'          => $fmt($agg->gross_sales ?? 0),
                'discounts_total'      => $fmt($agg->discounts_total ?? 0),
                'refunds_total'        => $fmt(abs((float) ($agg->refunds_total ?? 0))),
                'net_sales'            => $fmt($agg->net_sales ?? 0),
                'total_sales'          => $fmt($agg->net_sales ?? 0),  // back-compat alias
                'total_btw'            => $fmt($agg->btw_total ?? 0),
                'payment_breakdown'    => [
                    'cash'  => $fmt($agg->cash_net  ?? 0),
                    'card'  => $fmt($agg->card_net  ?? 0),
                    'mixed' => $fmt($agg->mixed_net ?? 0),
                ],
                'cash_drawer'          => [
                    'opening_float' => $fmt($openingFloat),
                    'cash_in'       => $fmt($cashIn),
                    'cash_out'      => $fmt($cashOut),
                    'pay_in'        => $fmt($payIn),   // manual drawer top-ups
                    'pay_out'       => $fmt($payOut),  // manual payouts from till
                    'expected'      => $fmt($expectedLive),
                ],
                'opening_float'        => $fmt($openingFloat),
                'expected_cash'        => $expectedCash,
                'closing_cash_counted' => $session->closing_cash_counted ? $fmt($session->closing_cash_counted) : null,
                'discrepancy'          => $session->discrepancy ? $fmt($session->discrepancy) : null,
            ],
        ]);
    }

    /**
     * Cash drawer = opening + cash IN (positive cash/mixed sales) − cash OUT
     * (negative-total refund rows with cash/mixed method). cash_received_srd
     * and change_srd are null on refund rows so they don't fall into cash IN.
     */
    private function computeExpectedCash(RegisterSession $session): string
    {
        $row = Sale::where('register_session_id', $session->id)
            ->where('status', 'completed')
            ->whereIn('payment_method', ['cash', 'mixed'])
            ->selectRaw('
                COALESCE(SUM(CASE WHEN total_srd >= 0 THEN COALESCE(cash_received_srd,0) - COALESCE(change_srd,0) END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN total_srd <  0 THEN ABS(total_srd) END), 0)                                          as cash_out
            ')
            ->first();

        $salesNet = bcsub((string) ($row->cash_in ?? 0), (string) ($row->cash_out ?? 0), 2);

        return bcadd(
            bcadd((string) $session->opening_float, $salesNet, 2),
            $this->manualCashNet($session),
            2,
        );
    }

    /**
     * Net of manual drawer movements for a session: SUM(pay-in) − SUM(pay-out).
     * A positive result means the cashier added more than they removed.
     */
    private function manualCashNet(RegisterSession $session): string
    {
        $row = \App\Models\CashMovement::where('register_session_id', $session->id)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount END), 0) as pay_in,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount END), 0) as pay_out
            ")
            ->first();

        return bcsub((string) ($row->pay_in ?? 0), (string) ($row->pay_out ?? 0), 2);
    }

    // ─── Manager: list all sessions for a store today ─────────────────────

    /**
     * GET /api/registers/sessions?store_id=&date=
     */
    public function sessions(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $request->validate([
            'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'date'     => ['nullable', 'date_format:Y-m-d'],
        ]);

        $date = $request->input('date', today()->toDateString());

        $sessions = RegisterSession::where('store_id', $request->store_id)
            ->whereDate('opened_at', $date)
            ->with(['cashier:id,name,email', 'register:id,name,number'])
            ->orderBy('opened_at')
            ->get()
            ->map(fn ($s) => $this->formatSession($s));

        return response()->json(['data' => $sessions]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────

    /**
     * Write one row to audit_logs for a register-related event.
     *
     * Replaces the spatie/activitylog `activity()` builder, which isn't
     * installed in this project — that package would create a parallel
     * activity_log table next to our canonical audit_logs and split
     * the trail across two stores. This keeps everything in audit_logs.
     */
    private function logRegisterActivity(User $causer, Model $subject, string $event, array $properties = []): void
    {
        AuditLog::create([
            'user_id'         => $causer->id,
            'organisation_id' => $causer->organisation_id,
            'event'           => $event,
            'auditable_type'  => class_basename($subject),
            'auditable_id'    => $subject->id,
            'old_values'      => null,
            // Pass the array straight through. The 'array' cast on new_values
            // serialises it once; pre-`json_encode`ing here would double-encode
            // the column and desync the audit hash chain (insert hashes empty,
            // verify hashes the decoded payload → register.* rows break).
            'new_values'      => $properties ?: null,
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
        ]);
    }

    private function formatRegister(Register $r): array
    {
        $session = $r->openSession;
        $closedToday = $r->closedTodaySessions->first();

        return [
            'id'      => $r->id,
            'name'    => $r->name,
            'number'  => $r->number,
            'status'  => $session ? $session->status : ($closedToday ? 'closed_today' : 'available'),
            'session' => $session ? $this->formatSession($session) : null,
            'closed_today' => $closedToday ? [
                'session_id'    => $closedToday->id,
                'cashier_id'    => $closedToday->cashier_id,
                'cashier_name'  => $closedToday->cashier?->name,
                'closed_at'     => $closedToday->closed_at?->setTimezone('America/Paramaribo')->toIso8601String(),
            ] : null,
        ];
    }

    private function formatSession(RegisterSession $s): array
    {
        return [
            'id'                   => $s->id,
            'register_id'          => $s->register_id,
            'register_name'        => $s->register?->name,
            'register_number'      => $s->register?->number,
            'cashier_id'           => $s->cashier_id,
            'cashier_name'         => $s->cashier?->name,
            'cashier_email'        => $s->cashier?->email,
            'status'               => $s->status,
            'opening_float'        => number_format((float) $s->opening_float, 2, '.', ''),
            'expected_cash'        => $s->expected_cash        ? number_format((float) $s->expected_cash, 2, '.', '') : null,
            'closing_cash_counted' => $s->closing_cash_counted ? number_format((float) $s->closing_cash_counted, 2, '.', '') : null,
            'discrepancy'          => $s->discrepancy          ? number_format((float) $s->discrepancy, 2, '.', '') : null,
            'opened_at'            => $s->opened_at?->setTimezone('America/Paramaribo')->toIso8601String(),
            'closed_at'            => $s->closed_at?->setTimezone('America/Paramaribo')->toIso8601String(),
            'closing_note'         => $s->closing_note,
            'reopen_requested_at'  => $s->reopen_requested_at?->setTimezone('America/Paramaribo')->toIso8601String(),
            'reopen_reason'        => $s->reopen_reason,
            'reopen_approved_by'   => $s->reopenApprovedBy?->name,
            'reopen_approved_at'   => $s->reopen_approved_at?->setTimezone('America/Paramaribo')->toIso8601String(),
            'reopen_denial_reason' => $s->reopen_denial_reason,
        ];
    }
}
