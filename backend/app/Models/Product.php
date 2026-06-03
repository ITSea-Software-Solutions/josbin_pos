<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;

class Product extends Model implements Auditable
{
    use HasUuids, SoftDeletes;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'organisation_id', 'category_id', 'name_nl', 'name_en',
        'barcode', 'sku', 'price', 'cost_price', 'btw_rate', 'btw_exempt',
        'stock_qty', 'low_stock_threshold', 'image_path',
        'brand', 'supplier', 'unit', 'description_nl', 'description_en',
        'is_active',
    ];

    protected $casts = [
        'price'               => 'decimal:2',
        'cost_price'          => 'decimal:2',
        'btw_rate'            => 'decimal:2',
        'stock_qty'           => 'decimal:3',
        'low_stock_threshold' => 'decimal:3',
        'btw_exempt'          => 'boolean',
        'is_active'           => 'boolean',
    ];

    /** Valid unit codes — keep in sync with the migration CHECK constraint
     *  and the dashboard form dropdown. */
    public const UNITS = ['each', 'kg', 'g', 'l', 'ml', 'pak'];

    /**
     * Profit margin in SRD per unit (price - cost). Null when cost is unset.
     * Cheap to compute; not stored to avoid drift when either field changes.
     */
    public function margin(): ?string
    {
        if ($this->cost_price === null) {
            return null;
        }
        return bcsub((string) $this->price, (string) $this->cost_price, 2);
    }

    /** Margin as percent of price ("33.33" means 33.33%). Null when no cost. */
    public function marginPct(): ?string
    {
        if ($this->cost_price === null || bccomp((string) $this->price, '0', 4) === 0) {
            return null;
        }
        $diff = bcsub((string) $this->price, (string) $this->cost_price, 4);
        return bcmul(bcdiv($diff, (string) $this->price, 6), '100', 2);
    }

    /** True when stock is at or below the configured threshold (and threshold > 0). */
    public function isLowStock(): bool
    {
        return $this->low_stock_threshold > 0
            && (float) $this->stock_qty <= (float) $this->low_stock_threshold;
    }

    /** Embedding is a raw vector — excluded from default select (large). */
    protected $hidden = ['embedding'];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function saleItems(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function storeOverrides(): HasMany
    {
        return $this->hasMany(StoreProductOverride::class);
    }

    public function storeStocks(): HasMany
    {
        return $this->hasMany(ProductStock::class);
    }

    /** Variants of this product (size / colour / flavour). Order: sort_order. */
    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('sort_order');
    }

    /** Convenience: true when at least one ACTIVE variant exists. POS uses
     *  this to decide whether to open the variant picker on tap. */
    public function hasVariants(): bool
    {
        return $this->variants()->where('is_active', true)->exists();
    }

    /**
     * Per-store running stock for this product.
     * If $storeId is null, returns the org-wide aggregate (sum across stores)
     * — useful for org-level catalogue views where no specific branch is selected.
     */
    public function stockForStore(?string $storeId): string
    {
        if (! $storeId) {
            return (string) $this->storeStocks()->sum('stock_qty');
        }

        $row = $this->storeStocks()->where('store_id', $storeId)->first();

        // No row yet means the store hasn't seen movement — fall back to the
        // catalogue default. StockMovementService will create the row on first sale.
        return (string) ($row?->stock_qty ?? $this->stock_qty);
    }

    /** Same shape as stockForStore(), but for the low-stock threshold. */
    public function lowStockThresholdForStore(?string $storeId): string
    {
        if (! $storeId) {
            return (string) $this->low_stock_threshold;
        }

        $row = $this->storeStocks()->where('store_id', $storeId)->first();

        return (string) ($row?->low_stock_threshold ?? $this->low_stock_threshold ?? 0);
    }

    /** Return the localised name based on current app locale. */
    public function getNameAttribute(): string
    {
        $locale = app()->getLocale();

        return $locale === 'en' ? $this->name_en : $this->name_nl;
    }

    /**
     * Get the effective price for a specific store
     * (applies per-store override if one exists).
     */
    public function priceForStore(?string $storeId): string
    {
        if (! $storeId) {
            return (string) $this->price;
        }

        $override = $this->storeOverrides()
            ->where('store_id', $storeId)
            ->first();

        return (string) ($override?->price_override ?? $this->price);
    }

    /** Scope: active products for an organisation, ordered for POS grid. */
    public function scopeForPOS($query, string $organisationId, ?string $categoryId = null)
    {
        $query->where('organisation_id', $organisationId)
              ->where('is_active', true);

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }

        return $query->orderBy('name_nl');
    }
}
