<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * License Management API
 *
 * GET  /api/licenses          — list licenses for the current organisation (or all for super admin)
 * POST /api/licenses/{id}/renew — submit renewal request (creates audit entry + marks pending)
 */
class LicenseController extends Controller
{
    /**
     * GET /api/licenses
     *
     * Super admin sees all. Org admins see their own org's licenses.
     */
    public function index(Request $request): JsonResponse
    {
        $user  = $request->user();
        $query = DB::table('licenses')
            ->join('organisations', 'licenses.organisation_id', '=', 'organisations.id')
            ->select([
                'licenses.id',
                'licenses.organisation_id',
                'organisations.name as organisation_name',
                'licenses.tier',
                'licenses.max_stores',
                'licenses.max_terminals',
                'licenses.valid_from',
                'licenses.valid_until',
                'licenses.is_active',
                'licenses.last_validated_at',
                'licenses.grace_period_ends_at',
                'licenses.renewal_status',
                'licenses.created_at',
            ])
            ->orderBy('licenses.valid_until');

        if ($user->role !== 'super_admin') {
            $query->where('licenses.organisation_id', $user->organisation_id);
        }

        $licenses = $query->get()->map(function ($lic) {
            $daysLeft = now()->diffInDays(now()->parse($lic->valid_until), false);
            return [
                'id'                  => $lic->id,
                'organisation_id'     => $lic->organisation_id,
                'organisation_name'   => $lic->organisation_name,
                'tier'                => $lic->tier,
                'max_stores'          => $lic->max_stores,
                'max_terminals'       => $lic->max_terminals,
                'valid_from'          => $lic->valid_from,
                'valid_until'         => $lic->valid_until,
                'days_remaining'      => $daysLeft,
                'is_active'           => (bool) $lic->is_active,
                'last_validated_at'   => $lic->last_validated_at,
                'grace_period_ends_at'=> $lic->grace_period_ends_at,
                'renewal_status'      => $lic->renewal_status,
                'urgency'             => $this->urgency($daysLeft, $lic->renewal_status),
            ];
        });

        return response()->json(['data' => $licenses]);
    }

    /**
     * POST /api/licenses/{id}/renew
     *
     * Submit a renewal request. In production this would call the license server.
     * Here it logs the request to the audit trail and marks the license as renewal_pending.
     */
    public function renew(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $license = DB::table('licenses')->where('id', $id)->first();

        if (! $license) {
            return response()->json(['message' => 'License not found.'], 404);
        }

        // Non-super-admins can only renew their own org's licenses
        if ($user->role !== 'super_admin' && $license->organisation_id !== $user->organisation_id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $request->validate([
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        // Log the renewal request to audit trail
        DB::table('audit_logs')->insert([
            'user_id'         => $user->id,
            'organisation_id' => $license->organisation_id,
            'event'           => 'license_renewal_requested',
            'auditable_type'  => 'license',
            'auditable_id'    => $license->id,
            'old_values'      => json_encode(['renewal_status' => $license->renewal_status]),
            'new_values'      => json_encode([
                'renewal_status' => 'renewal_pending',
                'notes'          => $request->input('notes'),
                'requested_by'   => $user->name,
            ]),
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        DB::table('licenses')->where('id', $id)->update([
            'renewal_status' => 'renewal_pending',
            'updated_at'     => now(),
        ]);

        return response()->json([
            'message'    => 'Renewal request submitted. You will be contacted within 1 business day.',
            'license_id' => $id,
        ]);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private function urgency(int $daysLeft, ?string $renewalStatus): string
    {
        if ($renewalStatus === 'soft_lock' || $renewalStatus === 'hard_lock') {
            return 'critical';
        }
        if ($renewalStatus === 'grace' || $daysLeft < 0) {
            return 'critical';
        }
        if ($renewalStatus === 'warning_14' || $daysLeft <= 14) {
            return 'high';
        }
        if ($renewalStatus === 'warning_30' || $daysLeft <= 30) {
            return 'medium';
        }
        return 'ok';
    }
}
