<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Platform-wide security policy — currently the per-role 2FA enforcement
 * setting. Only the Super Admin may view or change it.
 */
class SecurityPolicyController extends Controller
{
    /**
     * Roles the Super Admin can opt into mandatory 2FA. Super Admin is always
     * on; api_integration is a machine account (API-key auth, no TOTP).
     */
    private const CONFIGURABLE_ROLES = [
        User::ROLE_ORGANISATION_ADMIN,
        User::ROLE_STORE_MANAGER,
        User::ROLE_CASHIER,
        User::ROLE_AUDITOR,
    ];

    /** GET /api/settings/two-factor-policy */
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        return response()->json([
            'data' => [
                'always_roles'              => User::TWO_FACTOR_ALWAYS_ROLES,
                'configurable_roles'        => self::CONFIGURABLE_ROLES,
                'two_factor_required_roles' => $this->currentPolicy(),
                // Government accounts are always required regardless of role.
                'government_always_required' => true,
            ],
        ]);
    }

    /** PUT /api/settings/two-factor-policy */
    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);

        $data = $request->validate([
            'two_factor_required_roles'   => ['present', 'array'],
            'two_factor_required_roles.*' => ['string', Rule::in(self::CONFIGURABLE_ROLES)],
        ]);

        // Normalise: unique, re-indexed, only configurable roles.
        $roles = array_values(array_unique($data['two_factor_required_roles']));

        AppSetting::set(User::TWO_FACTOR_POLICY_KEY, $roles);

        return response()->json([
            'data' => [
                'always_roles'              => User::TWO_FACTOR_ALWAYS_ROLES,
                'configurable_roles'        => self::CONFIGURABLE_ROLES,
                'two_factor_required_roles' => $roles,
                'government_always_required' => true,
            ],
        ]);
    }

    /** @return array<int,string> */
    private function currentPolicy(): array
    {
        $value = AppSetting::get(User::TWO_FACTOR_POLICY_KEY, []);

        if (! is_array($value)) {
            return [];
        }

        // Drop any stale roles that are no longer configurable.
        return array_values(array_intersect($value, self::CONFIGURABLE_ROLES));
    }
}
