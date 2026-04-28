<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyRate extends Model
{
    use HasUuids;

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
