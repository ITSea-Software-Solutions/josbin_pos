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
            'store_id' => ['required', 'uuid', 'exists:stores,id'],
            'name'     => ['required', 'string', 'max:100'],
        ]);

        $nextNumber = Register::where('store_id', $data['store_id'])->max('number') + 1;

        $register = Register::create([
            'store_id'  => $data['store_id'],
            'name'      => $data['name'],
            'number'    => $nextNumber,
            'is_active' => true,
        ]);

        $this->logRegisterActivity($request->user(), $register, 'register.created');

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
    public function destroyRegister(Register $register): JsonResponse
    {
        abort_unless(request()->user()->isAtLeastManager(), 403);
        abort_if($register->openSession()->exists(), 409, 'Cannot deactivate a register with an open session.');

        $register->update(['is_active' => false]);

        $this->logRegisterActivity(request()->user(), $register, 'register.deactivated');

        return response()->json(null, 204);
    }

    // ─── List registers for a store ──────────────────────────────────────

    /**
     * GET /api/registers?store_id=
     * Returns all registers for a store with their current session status.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate(['store_id' => ['required', 'uuid', 'exists:stores,id']]);

        $registers = Register::where('store_id', $request->store_id)
            ->where('is_active', true)
            ->with(['openSession.cashier:id,name,email'])
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

        // Calculate expected cash: opening float + all cash sales in this session
        $cashSales = Sale::where('register_session_id', $session->id)
            ->where('status', 'completed')
            ->whereIn('payment_method', ['cash', 'mixed'])
            ->sum('cash_received_srd');

        // For mixed payments, only the cash portion counts toward drawer
        $cashChange = Sale::where('register_session_id', $session->id)
            ->where('status', 'completed')
            ->whereIn('payment_method', ['cash', 'mixed'])
            ->sum('change_srd');

        $expectedCash = bcadd(
            (string) $session->opening_float,
            bcsub((string) $cashSales, (string) $cashChange, 2),
            2
        );

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
        $request->validate(['store_id' => ['required', 'uuid']]);

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
     */
    public function sessionReport(RegisterSession $session): JsonResponse
    {
        $user = request()->user();

        abort_unless(
            $session->cashier_id === $user->id || $user->isAtLeastManager(),
            403
        );

        $sales = Sale::where('register_session_id', $session->id)
            ->where('status', 'completed')
            ->selectRaw('
                COUNT(*) as transaction_count,
                SUM(total_srd) as total_sales,
                SUM(btw_srd) as total_btw,
                SUM(CASE WHEN payment_method = \'cash\'  THEN total_srd ELSE 0 END) as cash_total,
                SUM(CASE WHEN payment_method = \'card\'  THEN total_srd ELSE 0 END) as card_total,
                SUM(CASE WHEN payment_method = \'mixed\' THEN total_srd ELSE 0 END) as mixed_total
            ')
            ->first();

        $voidCount = Sale::where('register_session_id', $session->id)
            ->where('status', 'voided')
            ->count();

        return response()->json([
            'data' => [
                'session'           => $this->formatSession($session->load('cashier:id,name', 'register:id,name,number')),
                'transaction_count' => (int) ($sales->transaction_count ?? 0),
                'void_count'        => $voidCount,
                'total_sales'       => number_format((float) ($sales->total_sales ?? 0), 2, '.', ''),
                'total_btw'         => number_format((float) ($sales->total_btw ?? 0), 2, '.', ''),
                'payment_breakdown' => [
                    'cash'  => number_format((float) ($sales->cash_total ?? 0), 2, '.', ''),
                    'card'  => number_format((float) ($sales->card_total ?? 0), 2, '.', ''),
                    'mixed' => number_format((float) ($sales->mixed_total ?? 0), 2, '.', ''),
                ],
                'opening_float'        => number_format((float) $session->opening_float, 2, '.', ''),
                'expected_cash'        => $session->expected_cash ? number_format((float) $session->expected_cash, 2, '.', '') : null,
                'closing_cash_counted' => $session->closing_cash_counted ? number_format((float) $session->closing_cash_counted, 2, '.', '') : null,
                'discrepancy'          => $session->discrepancy ? number_format((float) $session->discrepancy, 2, '.', '') : null,
            ],
        ]);
    }

    // ─── Manager: list all sessions for a store today ─────────────────────

    /**
     * GET /api/registers/sessions?store_id=&date=
     */
    public function sessions(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $request->validate([
            'store_id' => ['required', 'uuid'],
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
            'new_values'      => $properties ? json_encode($properties) : null,
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
        ]);
    }

    private function formatRegister(Register $r): array
    {
        $session = $r->openSession;
        return [
            'id'      => $r->id,
            'name'    => $r->name,
            'number'  => $r->number,
            'status'  => $session ? $session->status : 'closed',
            'session' => $session ? $this->formatSession($session) : null,
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
