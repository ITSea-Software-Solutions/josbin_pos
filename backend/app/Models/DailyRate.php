<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyRate extends Model
{
    use HasUuids;

    /**
     * When true, the locked-rate guard below is skipped for the current
     * operation. Only the two authorised rate-setters flip this: the manual
     * override (ExchangeRateController) and the scheduled lock command
     * (LockDailyRate --force). Everything else must respect the lock so a
     * locked, sale-referenced rate can't be silently overwritten — the
     * Rekenkamer reconciles sales.exchange_rate_used against this row.
     */
    public static bool $bypassLockGuard = false;

    protected static function booted(): void
    {
        static::updating(function (DailyRate $rate) {
            if (static::$bypassLockGuard) {
                return;
            }
            $wasLocked   = $rate->getOriginal('locked_at') !== null;
            $rateChanged = $rate->isDirty(['usd_to_srd', 'raw_rate', 'markup_pct']);
            if ($wasLocked && $rateChanged) {
                throw new \RuntimeException(
                    'A locked daily rate cannot be overwritten. Use the manual override (Dashboard → Daily Rate).'
                );
            }
        });
    }

    /** Run $callback with the lock guard temporarily disabled. */
    public static function withoutLockGuard(callable $callback): mixed
    {
        $previous = static::$bypassLockGuard;
        static::$bypassLockGuard = true;
        try {
            return $callback();
        } finally {
            static::$bypassLockGuard = $previous;
        }
    }

    protected $fillable = [
        'date', 'usd_to_srd', 'raw_rate', 'markup_pct',
        'source', 'locked_by', 'locked_at', 'api_response',
    ];

    protected $casts = [
        'date'        => 'date',
        'usd_to_srd'  => 'decimal:4',
        'raw_rate'    => 'decimal:4',
        'markup_pct'  => 'decimal:2',
        'locked_at'   => 'datetime',
        'api_response' => 'array',
    ];

    public function lockedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locked_by');
    }

    /** Get today's rate or most recent rate as fallback. */
    public static function todayRate(): ?self
    {
        return static::whereDate('date', today()->toDateString())->first()
            ?? static::orderByDesc('date')->first();
    }

    public function isLocked(): bool
    {
        return $this->locked_at !== null;
    }
}
