<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RegisterSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'register_id', 'store_id', 'cashier_id',
        'opening_float', 'closing_cash_counted', 'expected_cash', 'discrepancy',
        'status', 'opened_at', 'closed_at', 'closing_note',
        'reopen_requested_at', 'reopen_reason', 'reopen_requested_by',
        'reopen_approved_by', 'reopen_approved_at', 'reopen_denial_reason',
        'cleared_at', 'cleared_by', 'clear_note', 'clear_for_cashier',
    ];

    protected $casts = [
        'opening_float'          => 'decimal:2',
        'closing_cash_counted'   => 'decimal:2',
        'expected_cash'          => 'decimal:2',
        'discrepancy'            => 'decimal:2',
        'opened_at'              => 'datetime',
        'closed_at'              => 'datetime',
        'reopen_requested_at'    => 'datetime',
        'reopen_approved_at'     => 'datetime',
        'cleared_at'             => 'datetime',
    ];

    // ─── Status helpers ───────────────────────────────────────────────────

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function isReopenRequested(): bool
    {
        return $this->status === 'reopen_requested';
    }

    // ─── Relationships ────────────────────────────────────────────────────

    public function register(): BelongsTo
    {
        return $this->belongsTo(Register::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function reopenApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reopen_approved_by');
    }

    public function reopenRequestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reopen_requested_by');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
