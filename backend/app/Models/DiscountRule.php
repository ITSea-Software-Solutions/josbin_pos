<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscountRule extends Model
{
    use HasUuids;

    protected $table = 'discount_rules';

    protected $fillable = [
        'organisation_id',
        'store_id',
        'name',
        'applies_to',
        'applies_to_id',
        'type',
        'value',
        'min_qty',
        'max_discount_srd',
        'stackable',
        'is_active',
        'valid_from',
        'valid_to',
        'created_by',
    ];

    protected $casts = [
        'value'            => 'float',
        'min_qty'          => 'float',
        'max_discount_srd' => 'float',
        'stackable'        => 'boolean',
        'is_active'        => 'boolean',
        'valid_from'       => 'datetime',
        'valid_to'         => 'datetime',
    ];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Scope: rules currently active (within date window and is_active=true).
     */
    public function scopeActive($query)
    {
        return $query
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->whereNull('valid_from')
                ->orWhere('valid_from', '<=', now())
            )
            ->where(fn ($q) => $q
                ->whereNull('valid_to')
                ->orWhere('valid_to', '>=', now())
            );
    }

    /**
     * Scope: rules that apply to a specific store (or org-wide rules if store_id is null).
     */
    public function scopeForStore($query, string $storeId)
    {
        return $query->where(fn ($q) => $q
            ->whereNull('store_id')
            ->orWhere('store_id', $storeId)
        );
    }
}
