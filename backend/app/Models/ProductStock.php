<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-(product, store) running stock quantity.
 *
 * Source of truth for "how much of product X is on hand at store Y".
 * Every stock_movement adjusts the matching product_stocks row inside the
 * same transaction (see StockMovementService::record).
 *
 * If no row exists yet for a (product, store) pair, the service creates one
 * using products.stock_qty as the initial value — so newly added stores
 * automatically inherit the catalogue's default stock without any explicit
 * setup.
 */
class ProductStock extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id',
        'store_id',
        'stock_qty',
        'low_stock_threshold',
    ];

    protected $casts = [
        'stock_qty'           => 'decimal:3',
        'low_stock_threshold' => 'decimal:3',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
