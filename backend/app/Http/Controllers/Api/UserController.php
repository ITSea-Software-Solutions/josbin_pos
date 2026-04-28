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
            ->with('organisation:id,name')
            ->paginate($request->integer('per_page', 25));

        // Add computed two_factor_enabled boolean for frontend convenience
        $users->getCollection()->transform(function (User $u) {
            $u->two_factor_enabled = $u->two_factor_confirmed_at !== null;
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
        ]);

        // Non-super-admin users always belong to actor's org
        if (! $actor->isSuperAdmin()) {
            $data['organisation_id'] = $actor->organisation_id;
        }

        $user = User::create([
            ...$data,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'data' => $user->makeVisible([])->load('organisation:id,name'),
        ], 201);
    }

    /** GET /api/users/{user} */
    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorize('view', $user);

        return response()->json(['data' => $user->load('organisation:id,name')]);
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
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        // If role changed or deactivated — revoke all tokens (force re-login everywhere)
        if (isset($data['role']) || (isset($data['is_active']) && ! $data['is_active'])) {
            $user->tokens()->delete();
        }

        return response()->json(['data' => $user->fresh()->load('organisation:id,name')]);
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
