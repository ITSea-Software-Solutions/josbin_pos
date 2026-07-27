<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * MeController — self-service endpoints for the currently authenticated user.
 *
 * Every endpoint scopes strictly to $request->user(). No user_id is accepted
 * from the request body or path — there is no way for a cashier (or anyone)
 * to peek at another user's data through this controller.
 *
 *   GET    /api/me/sales-summary   → today / week / month aggregates
 *   GET    /api/me/shifts          → recent register sessions
 *   PATCH  /api/me/profile         → update own name / email / locale
 *   POST   /api/me/password        → change own password (current + new)
 */
class MeController extends Controller
{
    /**
     * GET /api/me/sales-summary
     *
     * Aggregates for the calling cashier's own sales:
     *   - Today, this week (Mon→Sun), this month so far
     *   - For each window: count, total SRD, total BTW, average basket
     *   - Top product (by SRD sold) this month
     *
     * Cashier-attribution is by sales.cashier_id, so it stays personal even
     * if the cashier moved between registers/stores in the period.
     */
    public function salesSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        $tz   = 'America/Paramaribo';

        $now   = Carbon::now($tz);
        $today = $now->copy()->startOfDay();
        $week  = $now->copy()->startOfWeek(Carbon::MONDAY);
        $month = $now->copy()->startOfMonth();

        $base = Sale::where('cashier_id', $user->id)->where('status', 'completed');

        $summary = fn (Carbon $since) => (function ($q) {
            $row = $q->selectRaw('COUNT(*) AS n, COALESCE(SUM(total_srd),0) AS total, COALESCE(SUM(btw_srd),0) AS btw')->first();
            $n   = (int) $row->n;
            return [
                'count'      => $n,
                'total_srd'  => number_format((float) $row->total, 2, '.', ''),
                'btw_srd'    => number_format((float) $row->btw, 2, '.', ''),
                'avg_basket' => $n > 0 ? number_format((float) $row->total / $n, 2, '.', '') : '0.00',
            ];
        })((clone $base)->where('occurred_at', '>=', $since));

        // Top product this month, by total SRD sold
        $topProduct = SaleItem::join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.cashier_id', $user->id)
            ->where('sales.status', 'completed')
            ->where('sales.occurred_at', '>=', $month)
            ->whereNotNull('sale_items.product_id')
            ->selectRaw('sale_items.product_name_snapshot AS name, SUM(sale_items.line_total_srd) AS revenue, SUM(sale_items.quantity) AS units')
            ->groupBy('sale_items.product_name_snapshot')
            ->orderByDesc('revenue')
            ->limit(1)
            ->first();

        return response()->json([
            'today' => $summary($today),
            'week'  => $summary($week),
            'month' => $summary($month),
            'top_product_this_month' => $topProduct ? [
                'name'        => $topProduct->name,
                'revenue_srd' => number_format((float) $topProduct->revenue, 2, '.', ''),
                'units'       => (float) $topProduct->units,
            ] : null,
            'generated_at' => $now->toIso8601String(),
        ]);
    }

    /**
     * GET /api/me/shifts
     *
     * The cashier's own recent register sessions (last 30, newest first).
     * Same scoping rule — only sessions where cashier_id == $request->user()->id.
     */
    public function shifts(Request $request): JsonResponse
    {
        $sessions = RegisterSession::where('cashier_id', $request->user()->id)
            ->with('register:id,name,number', 'store:id,name')
            ->orderByDesc('opened_at')
            ->limit(30)
            ->get()
            ->map(fn ($s) => [
                'id'                   => $s->id,
                'store_name'           => $s->store?->name,
                'register_name'        => $s->register?->name ?? ('Kassa ' . $s->register?->number),
                'status'               => $s->status,
                'opened_at'            => $s->opened_at?->toIso8601String(),
                'closed_at'            => $s->closed_at?->toIso8601String(),
                'opening_float'        => $s->opening_float,
                'closing_cash_counted' => $s->closing_cash_counted,
                'expected_cash'        => $s->expected_cash,
                'discrepancy'          => $s->discrepancy,
                'closing_note'         => $s->closing_note,
            ]);

        return response()->json(['data' => $sessions]);
    }

    /**
     * PATCH /api/me/profile
     *
     * Updates the calling user's own name / email / locale. Role,
     * organisation_id, is_active, and is_super_admin can NOT be set here —
     * those require an admin action via UserController.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name'   => ['sometimes', 'string', 'min:2', 'max:120'],
            'email'  => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'locale' => ['sometimes', 'in:nl,en'],
        ]);

        $user->update($data);

        return response()->json([
            'data' => [
                'id'     => $user->id,
                'name'   => $user->name,
                'email'  => $user->email,
                'locale' => $user->locale,
                'role'   => $user->role,
            ],
        ]);
    }

    /**
     * POST /api/me/password
     *
     * Requires the current password to be re-entered. On success, every other
     * Sanctum token the user holds is revoked — so other devices are signed out
     * automatically. The token used for THIS request keeps working.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password'     => ['required', 'confirmed', Password::min(10)->letters()->numbers()],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'message' => __('errors.wrong_current_password'),
                'errors'  => ['current_password' => [__('errors.wrong_current_password')]],
            ], 422);
        }

        $user->update(['password' => Hash::make($data['new_password'])]);

        // Revoke every OTHER token (keep the one used for this request).
        $currentTokenId = $request->user()->currentAccessToken()?->id;
        $user->tokens()->when($currentTokenId, fn ($q) => $q->where('id', '!=', $currentTokenId))->delete();

        return response()->json([
            'message' => __('errors.password_changed'),
        ]);
    }

    /**
     * GET /api/me/activity
     *
     * The current user's own activity feed — audit_logs rows where this user
     * is either the actor (`user_id`) or the target (`auditable_id` matching
     * their UUID). Lets SA / OA / Auditor / API roles see "what have I done
     * recently?" without the operational data they don't own (Performance,
     * Shifts) that ring-up roles get instead.
     */
    public function activity(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        $rows = \DB::table('audit_logs')
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                  ->orWhere(function ($qq) use ($user) {
                      $qq->where('auditable_type', 'user')->where('auditable_id', $user->id);
                  });
            })
            ->orderByDesc('created_at')
            ->limit(min($request->integer('limit', 50), 200))
            ->get([
                'id', 'event', 'auditable_type', 'auditable_id',
                'old_values', 'new_values', 'ip_address', 'created_at',
            ]);

        return response()->json(['data' => $rows]);
    }

    /**
     * GET /api/me/sessions
     *
     * The current user's active Sanctum tokens (= active devices / browser
     * sessions). Each row exposes name, ip, last_used_at, created_at, and a
     * flag for which one is THIS request. UI uses the flag to disable the
     * "Revoke" button on the current session (you can't revoke the one
     * you're using; logout does that).
     */
    public function sessions(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $currentId = $request->user()->currentAccessToken()?->id;

        $sessions = $user->tokens()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'abilities', 'last_used_at', 'expires_at', 'created_at'])
            ->map(fn ($t) => [
                'id'            => $t->id,
                'name'          => $t->name,
                'abilities_count' => is_array($t->abilities) ? count($t->abilities) : 0,
                'last_used_at'  => $t->last_used_at?->toIso8601String(),
                'expires_at'    => $t->expires_at?->toIso8601String(),
                'created_at'    => $t->created_at?->toIso8601String(),
                'is_current'    => $t->id === $currentId,
            ]);

        return response()->json(['data' => $sessions]);
    }

    /**
     * DELETE /api/me/sessions/{tokenId}
     *
     * Revoke one of the user's own tokens. Cannot revoke the current request's
     * own token (returns 422 — "use logout for that").
     */
    public function revokeSession(\Illuminate\Http\Request $request, int $tokenId): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        $currentId = $request->user()->currentAccessToken()?->id;

        if ($tokenId === $currentId) {
            return response()->json([
                'message' => 'Cannot revoke the current session. Use POST /api/auth/logout instead.',
                'code'    => 'CANNOT_REVOKE_SELF',
            ], 422);
        }

        $token = $user->tokens()->where('id', $tokenId)->first();
        if (! $token) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $token->delete();

        \App\Models\AuditLog::create([
            'user_id'         => $user->id,
            'organisation_id' => $user->organisation_id,
            'event'           => 'session.revoked_self',
            'auditable_type'  => 'personal_access_token',
            'auditable_id'    => (string) $tokenId,
            'old_values'      => null,
            'new_values'      => ['name' => $token->name],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        return response()->json(['message' => 'Session revoked.']);
    }
}
