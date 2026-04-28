<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stores the installed license record for this Josbin POS installation.
 * There should typically be only one active license per installation.
 *
 * Renewal enforcement:
 * - 30d before expiry  → renewal_status = 'warning_30'  (yellow banner)
 * - 14d before expiry  → renewal_status = 'warning_14'  (amber banner)
 * - Expired + ≤14d     → renewal_status = 'grace'       (red banner, full operation)
 * - Grace +14d elapsed → renewal_status = 'soft_lock'   (new sales blocked)
 * - Soft +30d elapsed  → renewal_status = 'hard_lock'   (login blocked, data export only)
 */
class License extends Model
{
    use HasUuids;

    protected $fillable = [
        'organisation_id',
        'license_key_hash',
        'hardware_mac',
        'hardware_cpu',
        'hardware_uuid',
        'tier',
        'max_stores',
        'max_terminals',
        'valid_from',
        'valid_until',
        'is_active',
        'last_validated_at',
        'last_validated_ip',
        'grace_period_ends_at',
        'grace_reason',
        'renewal_status',
    ];

    protected $casts = [
        'valid_from'           => 'date',
        'valid_until'          => 'date',
        'is_active'            => 'boolean',
        'last_validated_at'    => 'datetime',
        'grace_period_ends_at' => 'datetime',
        'max_stores'           => 'integer',
        'max_terminals'        => 'integer',
    ];

    // ─── Relationships ─────────────────────────────────────────────────────

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    // ─── Status helpers ────────────────────────────────────────────────────

    public function isExpired(): bool
    {
        return $this->valid_until->isPast();
    }

    public function daysUntilExpiry(): int
    {
        return (int) now()->diffInDays($this->valid_until, false);
    }

    /** True during the 14-day post-expiry grace period. POS still operates. */
    public function isInGracePeriod(): bool
    {
        if (! $this->isExpired()) return false;
        $graceLine = $this->valid_until->addDays(14);
        return now()->lte($graceLine);
    }

    /** True when 14–44 days past expiry. New sales are blocked. */
    public function isSoftLocked(): bool
    {
        if (! $this->isExpired()) return false;
        $softLine = $this->valid_until->addDays(14);
        $hardLine = $this->valid_until->addDays(44);
        return now()->between($softLine, $hardLine);
    }

    /** True when >44 days past expiry. Login blocked. Data export remains 90 days. */
    public function isHardLocked(): bool
    {
        if (! $this->isExpired()) return false;
        return now()->gt($this->valid_until->addDays(44));
    }

    /** Data export tools are available for 90 days after hard lock. */
    public function isDataExportAvailable(): bool
    {
        return now()->lte($this->valid_until->addDays(134)); // 44 + 90
    }

    public function computeRenewalStatus(): string
    {
        if ($this->isHardLocked())      return 'hard_lock';
        if ($this->isSoftLocked())      return 'soft_lock';
        if ($this->isInGracePeriod())   return 'grace';
        $days = $this->daysUntilExpiry();
        if ($days <= 14)                return 'warning_14';
        if ($days <= 30)                return 'warning_30';
        return 'active';
    }

    /** Grace mode when license server is temporarily unreachable */
    public function isInOfflineGrace(): bool
    {
        if (! $this->grace_period_ends_at) return false;
        return now()->lte($this->grace_period_ends_at);
    }

    // ─── Hash helper ───────────────────────────────────────────────────────

    public static function hashKey(string $licenseKey): string
    {
        return hash('sha256', $licenseKey);
    }

    public static function findByKey(string $licenseKey): ?self
    {
        return self::where('license_key_hash', self::hashKey($licenseKey))
            ->where('is_active', true)
            ->first();
    }
}
