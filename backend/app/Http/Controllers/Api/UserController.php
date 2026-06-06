<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    /**
     * Role hierarchy — a user may only manage roles strictly below their own.
     * super_admin → can manage all
     * organisation_admin → can manage store_manager, cashier, auditor, api_integration
     * store_manager → can manage cashier (within their org)
     */
    private const MANAGEABLE_ROLES = [
        User::ROLE_SUPER_ADMIN        => User::ROLES,
        User::ROLE_ORGANISATION_ADMIN => [
            User::ROLE_STORE_MANAGER,
            User::ROLE_CASHIER,
            User::ROLE_AUDITOR,
            User::ROLE_API_INTEGRATION,
        ],
        User::ROLE_STORE_MANAGER => [
            User::ROLE_CASHIER,
        ],
    ];

    /** GET /api/users */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $user = $request->user();
        $query = User::query()->orderBy('name');

        // Scope by organisation unless super admin
        if (! $user->isSuperAdmin()) {
            $query->where('organisation_id', $user->organisation_id);
        }

        // Scope to roles the current user can manage
        $manageableRoles = self::MANAGEABLE_ROLES[$user->role] ?? [];
        if (! $user->isSuperAdmin()) {
            $query->whereIn('role', $manageableRoles);
        }

        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }

        if ($request->filled('search')) {
            $term = '%' . $request->input('search') . '%';
            $query->where(fn ($q) => $q->where('name', 'ilike', $term)->orWhere('email', 'ilike', $term));
        }

        $users = $query
            ->select(['id', 'name', 'email', 'role', 'locale', 'organisation_id', 'store_id',
                'two_factor_confirmed_at', 'is_active', 'last_login_at', 'created_at'])
            ->with('organisation:id,name', 'store:id,name')
            ->paginate($request->integer('per_page', 25));

        // Build a one-shot map of organisation_id → active license so the
        // table can render licence type / start / expiry per row without a
        // per-row query (was N+1 when each row hit the licenses table).
        $orgIds = $users->getCollection()->pluck('organisation_id')->filter()->unique();
        $licenses = $orgIds->isNotEmpty()
            ? \App\Models\License::whereIn('organisation_id', $orgIds)
                ->where('is_active', true)
                ->orderByDesc('valid_until')
                ->get()
                ->keyBy('organisation_id')
            : collect();

        // Add computed two_factor_enabled + store_name + org_license for the
        // frontend. store_id is already on the row; store_name comes off the
        // eager-loaded relation. org_license lets the SA users-table show
        // licence tier / start / expiry / status at a glance.
        $users->getCollection()->transform(function (User $u) use ($licenses) {
            $u->two_factor_enabled = $u->two_factor_confirmed_at !== null;
            $u->store_name         = $u->store?->name;

            $lic = $u->organisation_id ? $licenses->get($u->organisation_id) : null;
            $u->org_license = $lic ? [
                'tier'           => $lic->tier,
                'max_stores'     => $lic->max_stores,
                'valid_from'     => $lic->valid_from?->toDateString(),
                'valid_until'    => $lic->valid_until?->toDateString(),
                'renewal_status' => $lic->computeRenewalStatus(),
                'is_active'      => (bool) $lic->is_active,
            ] : null;

            return $u;
        });

        return response()->json($users);
    }

    /** POST /api/users */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $actor = $request->user();
        $manageableRoles = self::MANAGEABLE_ROLES[$actor->role] ?? [];

        $storeScoped = ['cashier', 'store_manager'];
        $isStoreScoped = in_array($request->input('role'), $storeScoped, true);

        $data = $request->validate([
            'name'            => ['required', 'string', 'max:200'],
            'email'           => ['required', 'email', 'max:200', 'unique:users,email'],
            'password'        => ['required', Password::min(8)->mixedCase()->numbers()],
            'role'            => ['required', Rule::in($manageableRoles)],
            'locale'          => ['required', Rule::in(['nl', 'en'])],
            'organisation_id' => $actor->isSuperAdmin()
                ? ['required', 'uuid', 'exists:organisations,id']
                : ['prohibited'],
            'is_active'       => ['sometimes', 'boolean'],
            // Single-store assignment. Required for cashier + store_manager
            // (one user, one store — no floating cashiers, no "all stores"
            // grant). Prohibited for org-scoped roles to keep the data clean.
            'store_id'        => $isStoreScoped
                ? ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]
                : ['prohibited'],
        ]);

        // Non-super-admin users always belong to actor's org
        if (! $actor->isSuperAdmin()) {
            $data['organisation_id'] = $actor->organisation_id;
        }

        $user = User::create([
            ...$data,
            'is_active' => $data['is_active'] ?? true,
        ]);

        // Mirror the role enum to spatie's role table so $user->can(...) works.
        // Without this, every policy check returns false (the user has the role
        // string on the column but no spatie role attached → no permissions
        // resolved → 403 on category.create, product.edit, etc.). The matching
        // spatie role row is created by RolesAndPermissionsSeeder; we just
        // bind the user to it here.
        $user->assignRole($data['role']);

        if (isset($data['store_id'])) {
            $this->logStoreAssignment($actor, $user, null, $data['store_id']);
        }

        return response()->json([
            'data' => $this->formatUser($user->fresh()->load('organisation:id,name', 'store:id,name')),
        ], 201);
    }

    /** GET /api/users/{user} */
    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return response()->json(['data' => $this->formatUser($user->load('organisation:id,name', 'stores:id,name'))]);
    }

    /** PUT /api/users/{user} */
    public function update(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $actor = $request->user();
        $manageableRoles = self::MANAGEABLE_ROLES[$actor->role] ?? [];

        $effectiveRole = $request->input('role', $user->role);
        $isStoreScoped = in_array($effectiveRole, ['cashier', 'store_manager'], true);

        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:200'],
            'email'      => ['sometimes', 'email', 'max:200', Rule::unique('users', 'email')->ignore($user->id)],
            'password'   => ['sometimes', Password::min(8)->mixedCase()->numbers()],
            'role'       => ['sometimes', Rule::in($manageableRoles)],
            'locale'     => ['sometimes', Rule::in(['nl', 'en'])],
            'is_active'  => ['sometimes', 'boolean'],
            'store_id'   => $isStoreScoped
                ? ['sometimes', 'required', 'uuid', new \App\Rules\StoreBelongsToOrg]
                : ['prohibited'],
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        // If the role just flipped from store-scoped to org-scoped, drop the
        // stale store_id so the user doesn't carry a dangling assignment.
        if (isset($data['role']) && ! $isStoreScoped) {
            $data['store_id'] = null;
        }

        $previousStoreId = $user->store_id;
        $previousRole    = $user->role;
        $user->update($data);

        // Keep the spatie role attached in sync with the role enum on the user
        // row. Without syncRoles() a role change would leave the OLD spatie
        // role bound, so $user->can() resolves the wrong perm set. Re-syncing
        // also covers users that were created before the assignRole() fix
        // landed — first edit binds them properly.
        if (isset($data['role']) && $data['role'] !== $previousRole) {
            $user->syncRoles([$data['role']]);
        } elseif ($user->roles()->count() === 0) {
            // Self-healing: legacy user with no spatie role at all. Bind the
            // role enum that's already on the row so future requests work.
            $user->assignRole($user->role);
        }

        if (array_key_exists('store_id', $data) && $data['store_id'] !== $previousStoreId) {
            $this->logStoreAssignment($actor, $user, $previousStoreId, $data['store_id']);
        }

        // If role changed or deactivated — revoke all tokens (force re-login everywhere)
        if (isset($data['role']) || (isset($data['is_active']) && ! $data['is_active'])) {
            $user->tokens()->delete();
        }

        return response()->json(['data' => $this->formatUser($user->fresh()->load('organisation:id,name', 'store:id,name'))]);
    }

    /**
     * Audit the user → store assignment change with the from/to delta.
     */
    private function logStoreAssignment(User $actor, User $target, ?string $from, ?string $to): void
    {
        \App\Models\AuditLog::create([
            'user_id'         => $actor->id,
            'organisation_id' => $target->organisation_id,
            'event'           => 'user.store_assigned',
            'auditable_type'  => 'user',
            'auditable_id'    => $target->id,
            'old_values'      => ['store_id' => $from],
            'new_values'      => ['store_id' => $to],
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
        ]);
    }

    /**
     * Surface store_id on the user payload so the dashboard can show the
     * single-store dropdown pre-filled and the table can render a name.
     */
    private function formatUser(User $user): array
    {
        $arr = $user->toArray();
        $arr['store_id']   = $user->store_id;
        $arr['store_name'] = $user->store?->name;
        return $arr;
    }

    /** DELETE /api/users/{user} — deactivate, not hard delete */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        // Prevent self-deletion
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => __('errors.self_delete_blocked')], 422);
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->json(null, 204);
    }

    /** POST /api/users/{user}/activate */
    public function activate(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $user->update(['is_active' => true]);

        return response()->json(['data' => $user->fresh()]);
    }

    /** POST /api/users/{user}/reset-2fa — super admin or org admin only */
    public function reset2fa(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $actor = $request->user();

        // Step-up: the actor must re-confirm their OWN password. Without this,
        // a hijacked OA session could strip 2FA off every user in the org with
        // a single unauthenticated-feeling click — no re-auth, no trace.
        $request->validate(['current_password' => ['required', 'string']]);
        if (! \Illuminate\Support\Facades\Hash::check($request->input('current_password'), $actor->password)) {
            return response()->json([
                'message' => __('errors.wrong_current_password'),
                'code'    => 'WRONG_PASSWORD',
            ], 422);
        }

        // Never strip 2FA from accounts where it's mandatory by policy
        // (super_admin, tax_inspector, government users) — it's non-bypassable.
        if (in_array($user->role, User::TWO_FACTOR_ALWAYS_ROLES, true) || $user->isGovernmentUser()) {
            return response()->json([
                'message' => __('errors.cannot_reset_mandatory_2fa'),
                'code'    => 'MANDATORY_2FA',
            ], 403);
        }

        $user->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        // Force re-login so 2FA re-setup is required
        $user->tokens()->delete();

        // Audit trail — who reset whose 2FA, for the Rekenkamer export.
        \App\Models\AuditLog::create([
            'user_id'         => $actor->id,
            'organisation_id' => $actor->organisation_id,
            'event'           => 'user.two_factor_reset',
            'auditable_type'  => \App\Models\User::class,
            'auditable_id'    => $user->id,
            'old_values'      => null,
            'new_values'      => ['target_user' => $user->email, 'reset_by' => $actor->email],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        return response()->json(['message' => 'Two-factor authentication reset.']);
    }
}
