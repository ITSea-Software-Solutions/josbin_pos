<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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
        'organisation_id', 'store_id', 'role', 'locale',
        'two_factor_secret', 'two_factor_recovery_codes',
        'passkey_credential', 'last_login_at', 'is_active',
    ];

    protected $hidden = [
        'password', 'remember_token',
        'two_factor_secret', 'two_factor_recovery_codes',
        'passkey_credential',
    ];

    /**
     * Never write these into the audit log's new_values. $hidden only hides
     * from JSON — OwenIt audits the raw attributes, which would otherwise
     * persist the bcrypt password hash + 2FA secrets into audit_logs (a WBP-S
     * data-minimisation problem and needless secret exposure).
     */
    protected $auditExclude = [
        'password', 'remember_token',
        'two_factor_secret', 'two_factor_recovery_codes', 'passkey_credential',
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
    // Belastingdienst Suriname tax officer. Cross-organisation read-only
    // access, strictly limited to BTW submissions + their own audit trail.
    // Has no organisation_id (like Super Admin) and is created only by SA.
    public const ROLE_TAX_INSPECTOR      = 'tax_inspector';

    public const ROLES = [
        self::ROLE_SUPER_ADMIN,
        self::ROLE_ORGANISATION_ADMIN,
        self::ROLE_STORE_MANAGER,
        self::ROLE_CASHIER,
        self::ROLE_AUDITOR,
        self::ROLE_API_INTEGRATION,
        self::ROLE_TAX_INSPECTOR,
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
     * The single store this user belongs to. Required at the application
     * layer for cashier + store_manager roles; null for org-scoped roles
     * (super_admin, organisation_admin, auditor, api_integration).
     */
    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
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
     * Roles that operate at the org level and have no single store of their
     * own. Cashier + store_manager are the only roles where users.store_id
     * is required.
     */
    public function isOrgScopedRole(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ORGANISATION_ADMIN,
            self::ROLE_AUDITOR,
            self::ROLE_API_INTEGRATION,
            self::ROLE_TAX_INSPECTOR,
        ], true);
    }

    /**
     * Tax inspector is cross-organisation by design (Belastingdienst regulates
     * every taxpayer on the platform), so canAccessStore must short-circuit
     * the org-match check that applies to other org-scoped roles.
     */
    public function isCrossOrgRole(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_TAX_INSPECTOR,
        ], true);
    }

    /**
     * Can this user act on the given store?
     *
     * Rules:
     *   - super_admin: yes for any store anywhere.
     *   - org-scoped roles (org_admin / auditor / api_integration): yes for
     *     any store within their organisation.
     *   - cashier / store_manager: yes ONLY if users.store_id === $storeId.
     *     They belong to exactly one store; there is no "all stores in org"
     *     fallback.
     */
    public function canAccessStore(string $storeId): bool
    {
        if ($this->isSuperAdmin()) return true;

        $store = Store::find($storeId);
        if (! $store || $store->organisation_id !== $this->organisation_id) return false;

        if ($this->isOrgScopedRole()) return true;

        return $this->store_id === $storeId;
    }

    /**
     * Setting key holding the list of roles the Super Admin has opted into
     * mandatory 2FA for, in addition to the always-on roles below.
     */
    public const TWO_FACTOR_POLICY_KEY = 'two_factor_required_roles';

    /**
     * Roles for which 2FA is always required and cannot be disabled by policy.
     * Tax inspector is government-by-definition (Belastingdienst Suriname) so
     * they carry the same mandatory-2FA treatment as Super Admin.
     */
    public const TWO_FACTOR_ALWAYS_ROLES = [
        self::ROLE_SUPER_ADMIN,
        self::ROLE_TAX_INSPECTOR,
    ];

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
