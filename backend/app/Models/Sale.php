<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use OwenIt\Auditing\Contracts\Auditable;

class Sale extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'store_id', 'cashier_id', 'register_session_id', 'customer_id', 'sale_number',
        'subtotal_srd', 'discount_srd', 'btw_srd', 'total_srd',
        'payment_method', 'cash_received_srd', 'change_srd', 'card_amount_srd',
        'status', 'source', 'exchange_rate_used',
        'void_reason', 'voided_by', 'voided_at', 'void_approved_by',
        'external_sale_ref', 'occurred_at',
    ];

    protected $casts = [
        'subtotal_srd'       => 'decimal:2',
        'discount_srd'       => 'decimal:2',
        'btw_srd'            => 'decimal:2',
        'total_srd'          => 'decimal:2',
        'cash_received_srd'  => 'decimal:2',
        'change_srd'         => 'decimal:2',
        'card_amount_srd'    => 'decimal:2',
        'exchange_rate_used' => 'decimal:4',
        'voided_at'          => 'datetime',
        'occurred_at'        => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function registerSession(): BelongsTo
    {
        return $this->belongsTo(RegisterSession::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isVoided(): bool
    {
        return $this->status === 'voided';
    }

    public function isHeld(): bool
    {
        return $this->status === 'held';
    }

    /** Generate next sale number for a store: POS-YYYY-NNNNN */
    public static function nextNumber(string $storeId): string
    {
        $year  = now()->format('Y');
        $count = static::where('store_id', $storeId)
            ->whereYear('occurred_at', $year)
            ->count() + 1;

        return sprintf('POS-%s-%05d', $year, $count);
    }
}
