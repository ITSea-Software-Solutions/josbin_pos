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
        'system_closed', 'reconciled_at', 'reconciled_by',
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
        'system_closed'          => 'boolean',
        'reconciled_at'          => 'datetime',
    ];

    /** System-closed by the nightly auto-close and still waiting for a
     *  manager to count the drawer. */
    public function needsReconciliation(): bool
    {
        return $this->system_closed && $this->reconciled_at === null;
    }

    /**
     * Expected cash in the drawer right now: opening float + net cash from
     * completed sales (cash + the cash leg of mixed; refunds subtract) + net
     * manual pay-in/pay-out. Lives on the model so both the close endpoint
     * and the nightly auto-close command share ONE definition.
     */
    public function computeExpectedCash(): string
    {
        $row = Sale::where('register_session_id', $this->id)
            ->where('status', 'completed')
            ->whereIn('payment_method', ['cash', 'mixed'])
            ->selectRaw('
                COALESCE(SUM(CASE WHEN total_srd >= 0 THEN COALESCE(cash_received_srd,0) - COALESCE(change_srd,0) END), 0) as cash_in,
                COALESCE(SUM(CASE WHEN total_srd <  0 THEN ABS(total_srd) END), 0)                                          as cash_out
            ')
            ->first();

        $salesNet = bcsub((string) ($row->cash_in ?? 0), (string) ($row->cash_out ?? 0), 2);

        $movements = CashMovement::where('register_session_id', $this->id)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN direction = 'in'  THEN amount END), 0) as paid_in,
                COALESCE(SUM(CASE WHEN direction = 'out' THEN amount END), 0) as paid_out
            ")
            ->first();
        $manualNet = bcsub((string) ($movements->paid_in ?? 0), (string) ($movements->paid_out ?? 0), 2);

        return bcadd(bcadd((string) $this->opening_float, $salesNet, 2), $manualNet, 2);
    }

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
