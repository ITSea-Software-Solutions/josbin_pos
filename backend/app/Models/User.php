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
     * 2FA is mandatory and non-bypassable for Super Admin and government accounts.
     */
    public function requires2FA(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN || $this->isGovernmentUser();
    }
}
