<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A customer organisation's Josbin POS license.
 *
 * Renewal enforcement timeline (matches the POS application):
 *   30d before expiry  → warning_30  (yellow banner, POS normal)
 *   14d before expiry  → warning_14  (amber banner, POS normal)
 *   expired, ≤14d      → grace       (red banner, full operation)
 *   expired, 14–44d    → soft_lock   (new sales blocked, data still available)
 *   expired, >44d      → hard_lock   (login blocked, data export only)
 *   revoked / inactive → invalid
 */
class License extends Model
{
    use HasUuids;

    protected $fillable = [
        'license_key_hash', 'license_key_prefix',
        'organisation_name', 'contact_email',
        'tier', 'max_stores', 'max_terminals',
        'valid_from', 'valid_until',
        'is_active', 'revoked_at', 'revoked_reason', 'notes',
    ];

    protected $casts = [
        'valid_from'    => 'date',
        'valid_until'   => 'date',
        'is_active'     => 'boolean',
        'revoked_at'    => 'datetime',
        'max_stores'    => 'integer',
        'max_terminals' => 'integer',
    ];

    protected $hidden = ['license_key_hash'];

    public function activations(): HasMany
    {
        return $this->hasMany(LicenseActivation::class);
    }

    // ─── Key helpers ───────────────────────────────────────────────────────

    public static function hashKey(string $licenseKey): string
    {
        return hash('sha256', trim($licenseKey));
    }

    public static function findByKey(string $licenseKey): ?self
    {
        return static::where('license_key_hash', static::hashKey($licenseKey))->first();
    }

    // ─── Status ────────────────────────────────────────────────────────────

    /**
     * Resolve the current renewal status string returned to the POS.
     */
    public function computeStatus(): string
    {
        if (! $this->is_active || $this->revoked_at !== null) {
            return 'invalid';
        }

        $until = $this->valid_until->copy()->endOfDay();
        $now   = now();

        if ($now->lte($until)) {
            $daysLeft = (int) $now->diffInDays($until, false);

            if ($daysLeft <= 14) return 'warning_14';
            if ($daysLeft <= 30) return 'warning_30';

            return 'active';
        }

        // Expired — walk the post-expiry timeline.
        if ($now->lte($until->copy()->addDays(14))) return 'grace';
        if ($now->lte($until->copy()->addDays(44))) return 'soft_lock';

        return 'hard_lock';
    }

    /** Number of installations currently bound to this license. */
    public function activeActivationCount(): int
    {
        return $this->activations()->where('is_active', true)->count();
    }

    public function terminalLimitReached(): bool
    {
        return $this->activeActivationCount() >= $this->max_terminals;
    }
}
