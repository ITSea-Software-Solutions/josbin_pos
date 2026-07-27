<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OwenIt\Auditing\Models\Audit;

class AuditLogController extends Controller
{
    /**
     * GET /api/audit-log
     *
     * Returns paginated, filterable audit trail.
     * Super Admin sees everything; Org Admin sees only their organisation.
     */
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        // Only admins / auditors can view audit log
        if (! in_array($actor->role, [
            User::ROLE_SUPER_ADMIN,
            User::ROLE_ORGANISATION_ADMIN,
            User::ROLE_AUDITOR,
            User::ROLE_TAX_INSPECTOR,
        ], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = Audit::query()
            ->with('user:id,name,email,role')
            ->orderByDesc('created_at');

        // Scope by organisation unless super admin.
        //
        // Match on the row's organisation_id OR the acting user belonging to
        // this org. The user_id fan-out alone (the previous behaviour) hid two
        // legitimate classes of event from the OA:
        //   1. System events with user_id = null but the org tagged
        //      (e.g. customer.redacted, BTW filings) — now visible.
        //   2. Super-Admin actions performed ON this org's data (user_id is the
        //      SA, not an org user, but organisation_id is the org) — now visible.
        // The OR keeps everything the old filter showed (e.g. Product edits,
        // which carry the org user's id but no organisation_id of their own).
        if ($actor->role === User::ROLE_TAX_INSPECTOR) {
            // Belastingdienst mandate: the life of every BTW filing, all
            // organisations — plus the inspector's own actions. Never the
            // org's operational logs (products, users, sales edits).
            $query->where(function ($q) use ($actor) {
                $q->where('auditable_type', 'btw_submission')
                  ->orWhere('user_id', (string) $actor->id);
            });
        } elseif (! $actor->isSuperAdmin()) {
            $orgUserIds = User::where('organisation_id', $actor->organisation_id)
                ->pluck('id')
                ->map(fn ($id) => (string) $id);

            $query->where(function ($q) use ($actor, $orgUserIds) {
                $q->where('organisation_id', $actor->organisation_id)
                  ->orWhereIn('user_id', $orgUserIds);
            });
        }

        // Filters
        if ($request->filled('event')) {
            $query->where('event', $request->input('event'));
        }

        if ($request->filled('auditable_type')) {
            $short = $request->input('auditable_type'); // e.g. "Sale", "Product"
            $query->where('auditable_type', 'like', '%' . $short);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        // Indexable, AST-correct day bounds (see App\Support\AstDates) instead of
        // whereDate(), which wraps created_at in DATE() and can't use the index.
        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', \App\Support\AstDates::dayStart($request->input('date_from')));
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<', \App\Support\AstDates::dayAfter($request->input('date_to')));
        }

        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('event', 'ilike', "%{$term}%")
                  ->orWhere('auditable_type', 'ilike', "%{$term}%")
                  ->orWhere('new_values', 'ilike', "%{$term}%");
            });
        }

        $perPage = min($request->integer('per_page', 50), 200);
        $audits  = $query->paginate($perPage);

        // Transform for clean API response
        $audits->getCollection()->transform(function (Audit $audit) {
            $modelShort = class_basename($audit->auditable_type);

            return [
                'id'             => $audit->id,
                'event'          => $audit->event,
                'model_type'     => $modelShort,
                'model_id'       => $audit->auditable_id,
                'user'           => $audit->user ? [
                    'id'    => $audit->user->id,
                    'name'  => $audit->user->name,
                    'email' => $audit->user->email,
                    'role'  => $audit->user->role,
                ] : null,
                'old_values'     => $audit->old_values,
                'new_values'     => $audit->new_values,
                'ip_address'     => $audit->ip_address,
                'created_at'     => $audit->created_at,
            ];
        });

        return response()->json($audits);
    }

    /**
     * GET /api/audit-log/summary
     *
     * Returns event counts for the last 30 days — used for the dashboard stats bar.
     */
    public function summary(Request $request): JsonResponse
    {
        $actor = $request->user();

        $query = Audit::query()->where('created_at', '>=', now()->subDays(30));

        if ($actor->role === User::ROLE_TAX_INSPECTOR) {
            $query->where(function ($q) use ($actor) {
                $q->where('auditable_type', 'btw_submission')
                  ->orWhere('user_id', (string) $actor->id);
            });
        } elseif (! $actor->isSuperAdmin()) {
            $orgUserIds = User::where('organisation_id', $actor->organisation_id)
                ->pluck('id')
                ->map(fn ($id) => (string) $id);
            $query->whereIn('user_id', $orgUserIds);
        }

        $byEvent = (clone $query)
            ->selectRaw('event, count(*) as count')
            ->groupBy('event')
            ->orderByDesc('count')
            ->get()
            ->pluck('count', 'event');

        $byModel = (clone $query)
            ->selectRaw('auditable_type, count(*) as count')
            ->groupBy('auditable_type')
            ->get()
            ->mapWithKeys(fn ($row) => [class_basename($row->auditable_type) => (int) $row->count]);

        return response()->json([
            'total_30d'  => $query->count(),
            'by_event'   => $byEvent,
            'by_model'   => $byModel,
        ]);
    }
}
