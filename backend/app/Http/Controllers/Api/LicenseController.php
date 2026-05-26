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
            // Whole days only — Carbon 3 returns a float by default which
            // surfaced as "364.7965745746412 days left" in the UI.
            $daysLeft = (int) floor(
                now()->startOfDay()->diffInDays(now()->parse($lic->valid_until)->startOfDay(), false)
            );
            // Human-readable reference for SA to share with the client.
            // The hash itself is one-way; this is a deterministic short
            // identifier they can quote in an email or WhatsApp message.
            $reference = 'JBN-' . strtoupper(substr(str_replace('-', '', $lic->id), 0, 4) . '-'
                                            . substr(str_replace('-', '', $lic->id), 4, 4) . '-'
                                            . substr(str_replace('-', '', $lic->id), 8, 4));
            return [
                'id'                  => $lic->id,
                'reference'           => $reference,
                'organisation_id'     => $lic->organisation_id,
                'organisation_name'   => $lic->organisation_name,
                'tier'                => $lic->tier,
                'max_stores'          => $lic->max_stores,
                'max_terminals'       => $lic->max_terminals,
                'valid_from'          => $lic->valid_from,
                'valid_until'         => $lic->valid_until,
                'days_remaining'      => $daysLeft,
                'is_active'           => (bool) $lic->is_active,
                'issued_at'           => $lic->created_at,
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

    /**
     * POST /api/licenses
     *
     * Super Admin issues a new license for an organisation. Two paths exist:
     *   1) **License Server** (external, for on-prem IonCube deliveries) — issues
     *      a real `JBN-…` key bound to hardware. Customer activates via the
     *      activation screen on their POS install.
     *   2) **This endpoint** (in-dashboard, for SaaS / dev / internal orgs) —
     *      mints a license row directly. The `license_key_hash` is a random
     *      SHA-256 placeholder so the unique constraint is satisfied without
     *      a real key. Hardware fields stay null until / unless a customer
     *      ever runs the activation flow against this license.
     *
     * See dashboard_manual/16-license-operations.md for which path to use when.
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'organisation_id' => ['required', 'uuid', 'exists:organisations,id'],
            'tier'            => ['required', \Illuminate\Validation\Rule::in(['standard', 'professional', 'enterprise'])],
            'max_stores'      => ['required', 'integer', 'min:1', 'max:200'],
            'max_terminals'   => ['required', 'integer', 'min:1', 'max:2000'],
            'valid_from'      => ['required', 'date'],
            'valid_until'     => ['required', 'date', 'after:valid_from'],
        ]);

        $id   = (string) \Illuminate\Support\Str::uuid();
        $hash = hash('sha256', $id . '|' . $data['organisation_id'] . '|' . microtime(true));

        DB::table('licenses')->insert([
            'id'                => $id,
            'organisation_id'   => $data['organisation_id'],
            'license_key_hash'  => $hash,
            'tier'              => $data['tier'],
            'max_stores'        => $data['max_stores'],
            'max_terminals'     => $data['max_terminals'],
            'valid_from'        => $data['valid_from'],
            'valid_until'       => $data['valid_until'],
            'is_active'         => true,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $this->auditLicense($request->user(), $id, $data['organisation_id'], 'license.issued', $data);

        return response()->json(['data' => ['id' => $id] + $data + ['is_active' => true]], 201);
    }

    /**
     * PATCH /api/licenses/{id}
     *
     * Super Admin updates a license — typically to extend `valid_until`
     * (renewal), bump limits, or change tier (upgrade). Hardware-binding
     * fields are deliberately NOT editable here — they're set by the
     * customer-side activation flow.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $license = DB::table('licenses')->where('id', $id)->first();
        abort_if(! $license, 404, 'License not found.');

        $data = $request->validate([
            'tier'          => ['sometimes', \Illuminate\Validation\Rule::in(['standard', 'professional', 'enterprise'])],
            'max_stores'    => ['sometimes', 'integer', 'min:1', 'max:200'],
            'max_terminals' => ['sometimes', 'integer', 'min:1', 'max:2000'],
            'valid_from'    => ['sometimes', 'date'],
            'valid_until'   => ['sometimes', 'date'],
            'is_active'     => ['sometimes', 'boolean'],
        ]);

        if (empty($data)) {
            return response()->json(['message' => 'Nothing to update.'], 422);
        }

        DB::table('licenses')->where('id', $id)->update($data + ['updated_at' => now(), 'renewal_status' => null]);

        $this->auditLicense($request->user(), $id, $license->organisation_id, 'license.updated', $data);

        return response()->json(['data' => array_merge((array) $license, $data)]);
    }

    /**
     * DELETE /api/licenses/{id}
     *
     * Soft-cancel — sets is_active=false. We never hard-delete a licence row
     * because the audit chain references it.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $license = DB::table('licenses')->where('id', $id)->first();
        abort_if(! $license, 404, 'License not found.');

        DB::table('licenses')->where('id', $id)->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);

        $this->auditLicense($request->user(), $id, $license->organisation_id, 'license.revoked', []);

        return response()->json(null, 204);
    }

    private function auditLicense(\App\Models\User $user, string $licenseId, string $orgId, string $event, array $payload): void
    {
        DB::table('audit_logs')->insert([
            'user_id'         => $user->id,
            'organisation_id' => $orgId,
            'event'           => $event,
            'auditable_type'  => 'license',
            'auditable_id'    => $licenseId,
            'old_values'      => null,
            'new_values'      => $payload ? json_encode($payload) : null,
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
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
