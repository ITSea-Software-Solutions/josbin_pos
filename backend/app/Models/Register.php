<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Register extends Model
{
    use HasUuids;

    protected $fillable = ['store_id', 'name', 'number', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(RegisterSession::class);
    }

    public function openSession(): HasOne
    {
        return $this->hasOne(RegisterSession::class)
            ->whereIn('status', ['open', 'reopen_requested', 'reopen_approved']);
    }

    /**
     * Sessions on this register that were closed today, newest first.
     * (Avoid HasOne::latestOfMany — Eloquent tie-breaks with MAX(id),
     * and our ids are UUIDs which Postgres can't aggregate.)
     */
    public function closedTodaySessions(): HasMany
    {
        return $this->hasMany(RegisterSession::class)
            ->where('status', 'closed')
            ->whereDate('closed_at', today())
            ->orderByDesc('closed_at');
    }
}
