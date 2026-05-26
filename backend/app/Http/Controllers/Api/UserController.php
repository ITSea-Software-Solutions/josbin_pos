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
            ->select(['id', 'name', 'email', 'role', 'locale', 'organisation_id',
                'two_factor_confirmed_at', 'is_active', 'last_login_at', 'created_at'])
            ->with('organisation:id,name', 'stores:id,name')
            ->paginate($request->integer('per_page', 25));

        // Add computed two_factor_enabled + store_ids[] for frontend.
        $users->getCollection()->transform(function (User $u) {
            $u->two_factor_enabled = $u->two_factor_confirmed_at !== null;
            $u->store_ids          = $u->stores->pluck('id')->all();
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
            // Store assignment — only meaningful for cashier / store_manager.
            // Empty = all stores in org (backfill semantics). Other roles
            // (super_admin / org_admin / auditor) ignore the pivot.
            'store_ids'       => ['sometimes', 'array'],
            'store_ids.*'     => ['uuid', 'exists:stores,id'],
        ]);

        // Non-super-admin users always belong to actor's org
        if (! $actor->isSuperAdmin()) {
            $data['organisation_id'] = $actor->organisation_id;
        }

        $storeIds = $data['store_ids'] ?? [];
        unset($data['store_ids']);

        $user = User::create([
            ...$data,
            'is_active' => $data['is_active'] ?? true,
        ]);

        // Sync store assignments — only persist when role can be store-scoped.
        if (! empty($storeIds) && in_array($user->role, [User::ROLE_CASHIER, User::ROLE_STORE_MANAGER], true)) {
            $this->syncUserStores($user, $storeIds, $actor->id);
        }

        return response()->json([
            'data' => $this->formatUser($user->fresh()->load('organisation:id,name', 'stores:id,name')),
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

        $data = $request->validate([
            'name'       => ['sometimes', 'string', 'max:200'],
            'email'      => ['sometimes', 'email', 'max:200', Rule::unique('users', 'email')->ignore($user->id)],
            'password'   => ['sometimes', Password::min(8)->mixedCase()->numbers()],
            'role'       => ['sometimes', Rule::in($manageableRoles)],
            'locale'     => ['sometimes', Rule::in(['nl', 'en'])],
            'is_active'  => ['sometimes', 'boolean'],
            'store_ids'   => ['sometimes', 'array'],
            'store_ids.*' => ['uuid', 'exists:stores,id'],
        ]);

        $storeIds = $data['store_ids'] ?? null;
        unset($data['store_ids']);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        // Sync store assignments (only for store-scoped roles). Pass an
        // empty array intentionally to clear all assignments → grants
        // "all stores in org" via the backfill rule.
        $effectiveRole = $data['role'] ?? $user->role;
        if ($storeIds !== null && in_array($effectiveRole, [User::ROLE_CASHIER, User::ROLE_STORE_MANAGER], true)) {
            $this->syncUserStores($user, $storeIds, $actor->id);
        }

        // If role changed or deactivated — revoke all tokens (force re-login everywhere)
        if (isset($data['role']) || (isset($data['is_active']) && ! $data['is_active'])) {
            $user->tokens()->delete();
        }

        return response()->json(['data' => $this->formatUser($user->fresh()->load('organisation:id,name', 'stores:id,name'))]);
    }

    /**
     * Sync the user_stores pivot and write an audit entry capturing the diff
     * (which stores were added / removed and by whom).
     */
    private function syncUserStores(User $user, array $storeIds, string $actorId): void
    {
        // Verify every store_id belongs to the user's org — refuse cross-org.
        $valid = \App\Models\Store::whereIn('id', $storeIds)
            ->where('organisation_id', $user->organisation_id)
            ->pluck('id')->all();

        $previous = $user->stores()->pluck('stores.id')->all();
        $payload  = collect($valid)->mapWithKeys(fn ($id) => [$id => ['assigned_at' => now(), 'assigned_by' => $actorId]])->all();

        $user->stores()->sync($payload);

        $added   = array_values(array_diff($valid, $previous));
        $removed = array_values(array_diff($previous, $valid));
        if ($added || $removed) {
            \DB::table('audit_logs')->insert([
                'user_id'         => $actorId,
                'organisation_id' => $user->organisation_id,
                'event'           => 'user.stores_assigned',
                'auditable_type'  => 'user',
                'auditable_id'    => $user->id,
                'old_values'      => json_encode(['store_ids' => $previous]),
                'new_values'      => json_encode(['store_ids' => $valid, 'added' => $added, 'removed' => $removed]),
                'ip_address'      => request()->ip(),
                'created_at'      => now(),
            ]);
        }
    }

    /**
     * Add `store_ids` to the user JSON so the dashboard can render the
     * multi-select pre-filled, and so other consumers see the scope.
     */
    private function formatUser(User $user): array
    {
        $arr = $user->toArray();
        $arr['store_ids'] = $user->stores->pluck('id')->all();
        return $arr;
    }

    /** DELETE /api/users/{user} — deactivate, not hard delete */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->authorize('delete', $user);

        // Prevent self-deletion
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Je kunt je eigen account niet verwijderen.'], 422);
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

        $user->forceFill([
            'two_factor_secret'         => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at'   => null,
        ])->save();

        // Force re-login so 2FA re-setup is required
        $user->tokens()->delete();

        return response()->json(['message' => 'Two-factor authentication reset.']);
    }
}
