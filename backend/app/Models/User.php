<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use OwenIt\Auditing\Contracts\Auditable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements Auditable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasUuids, HasApiTokens, HasRoles;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'name', 'email', 'password',
        'organisation_id', 'role', 'locale',
        'two_factor_secret', 'two_factor_recovery_codes',
        'passkey_credential', 'last_login_at', 'is_active',
    ];

    protected $hidden = [
        'password', 'remember_token',
        'two_factor_secret', 'two_factor_recovery_codes',
        'passkey_credential',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at'            => 'datetime',
            'last_login_at'                => 'datetime',
            'password'                     => 'hashed',
            'is_active'                    => 'boolean',
            'two_factor_confirmed_at'      => 'datetime',
            'passkey_credential'           => 'array',
        ];
    }

    // ── Role constants ────────────────────────────────────────────────────────

    public const ROLE_SUPER_ADMIN        = 'super_admin';
    public const ROLE_ORGANISATION_ADMIN = 'organisation_admin';
    public const ROLE_STORE_MANAGER      = 'store_manager';
    public const ROLE_CASHIER            = 'cashier';
    public const ROLE_AUDITOR            = 'auditor';
    public const ROLE_API_INTEGRATION    = 'api_integration';

    public const ROLES = [
        self::ROLE_SUPER_ADMIN,
        self::ROLE_ORGANISATION_ADMIN,
        self::ROLE_STORE_MANAGER,
        self::ROLE_CASHIER,
        self::ROLE_AUDITOR,
        self::ROLE_API_INTEGRATION,
    ];

    // ── Relationships ─────────────────────────────────────────────────────────

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'cashier_id');
    }

    /**
     * Stores this user is explicitly assigned to. Empty = all stores in the
     * user's organisation (backfill semantics — see canAccessStore()).
     */
    public function stores(): BelongsToMany
    {
        return $this->belongsToMany(Store::class, 'user_stores')
            ->withPivot('assigned_at', 'assigned_by');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function isAtLeastManager(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ORGANISATION_ADMIN,
            self::ROLE_STORE_MANAGER,
        ]);
    }

    public function isGovernmentUser(): bool
    {
        return $this->organisation?->is_government ?? false;
    }

    /**
     * Roles that operate at the org level and ignore the user_stores pivot.
     * Cashier + store_manager are the only roles where the pivot matters.
     */
    public function isOrgScopedRole(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ORGANISATION_ADMIN,
            self::ROLE_AUDITOR,
            self::ROLE_API_INTEGRATION,
        ], true);
    }

    /**
     * Can this user act on the given store?
     *
     * Rules:
     *   - super_admin: yes for any store anywhere.
     *   - org-scoped roles (org_admin / auditor / api_integration): yes for
     *     any store within their organisation.
     *   - cashier / store_manager: yes for stores in their org AND either
     *     (a) they have an empty user_stores assignment (= all in org), or
     *     (b) the pivot includes this store_id.
     *
     * The empty-assignment fallback preserves backward compatibility with
     * users created before the pivot existed.
     */
    public function canAccessStore(string $storeId): bool
    {
        if ($this->isSuperAdmin()) return true;

        // Reject anything outside the user's own org first — cheap check.
        $store = Store::find($storeId);
        if (! $store || $store->organisation_id !== $this->organisation_id) return false;

        if ($this->isOrgScopedRole()) return true;

        $assigned = $this->stores()->pluck('stores.id');
        return $assigned->isEmpty() || $assigned->contains($storeId);
    }

    /**
     * Setting key holding the list of roles the Super Admin has opted into
     * mandatory 2FA for, in addition to the always-on roles below.
     */
    public const TWO_FACTOR_POLICY_KEY = 'two_factor_required_roles';

    /** Roles for which 2FA is always required and cannot be disabled by policy. */
    public const TWO_FACTOR_ALWAYS_ROLES = [self::ROLE_SUPER_ADMIN];

    /**
     * 2FA is mandatory and non-bypassable for Super Admin and government
     * accounts. The Super Admin may additionally require it for other roles
     * via the two_factor_required_roles policy setting.
     */
    public function requires2FA(): bool
    {
        if (in_array($this->role, self::TWO_FACTOR_ALWAYS_ROLES, true) || $this->isGovernmentUser()) {
            return true;
        }

        $policyRoles = AppSetting::get(self::TWO_FACTOR_POLICY_KEY, []);

        return is_array($policyRoles) && in_array($this->role, $policyRoles, true);
    }
}
