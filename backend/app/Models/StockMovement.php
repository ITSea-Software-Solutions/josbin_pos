<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only stock movement ledger.
 *
 * Every change to stock_qty must go through StockMovementService::record()
 * which atomically updates the product stock and inserts this row.
 *
 * Updating and deleting are blocked via Eloquent hooks.
 */
class StockMovement extends Model
{
    public $timestamps = false;

    protected $table = 'stock_movements';

    const REASONS = ['sale', 'void', 'refund', 'adjustment', 'import', 'initial'];

    protected $fillable = [
        'product_id',
        'store_id',
        'organisation_id',
        'qty_change',
        'qty_after',
        'reason',
        'sale_id',
        'user_id',
        'notes',
        'created_at',
    ];

    protected $casts = [
        'qty_change' => 'float',
        'qty_after'  => 'float',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (StockMovement $m) {
            if (! $m->created_at) {
                $m->created_at = now();
            }
        });

        // Append-only — block updates and deletes
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
