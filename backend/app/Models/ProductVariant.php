<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;

/**
 * One size/colour/flavour of a parent Product.
 *
 * Variant price + cost are optional — null means "use the parent's".
 * Variant stock is per-variant (org-wide for v1; per-store later if a
 * chain needs it).
 *
 * See migration 2026_06_03_010001 for the design rationale.
 */
class ProductVariant extends Model implements Auditable
{
    use HasUuids, SoftDeletes;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'organisation_id', 'product_id',
        'sku', 'barcode',
        'name_nl', 'name_en', 'sort_order',
        'price', 'cost_price',
        'stock_qty', 'low_stock_threshold',
        'attributes',
        'is_active',
    ];

    protected $casts = [
        'price'               => 'decimal:2',
        'cost_price'          => 'decimal:2',
        'stock_qty'           => 'decimal:3',
        'low_stock_threshold' => 'decimal:3',
        'attributes'          => 'array',
        'is_active'           => 'boolean',
        'sort_order'          => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    /**
     * Effective price — variant override if set, otherwise parent's.
     * Always returns a string so callers can pass it straight into bcmath.
     */
    public function effectivePrice(): string
    {
        return (string) ($this->price ?? $this->product?->price ?? '0.00');
    }

    /**
     * Effective cost — variant override if set, otherwise parent's.
     * Null when neither is set (cost is optional everywhere).
     */
    public function effectiveCost(): ?string
    {
        if ($this->cost_price !== null) return (string) $this->cost_price;
        if ($this->product?->cost_price !== null) return (string) $this->product->cost_price;
        return null;
    }

    /** True when stock is at or below the configured threshold (and threshold > 0). */
    public function isLowStock(): bool
    {
        $threshold = $this->low_stock_threshold ?? $this->product?->low_stock_threshold;
        return $threshold > 0 && (float) $this->stock_qty <= (float) $threshold;
    }

    /** Localised display name based on current app locale. */
    public function getNameAttribute(): string
    {
        return app()->getLocale() === 'en' ? $this->name_en : $this->name_nl;
    }
}
