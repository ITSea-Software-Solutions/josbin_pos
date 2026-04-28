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
        'barcode', 'price', 'btw_rate', 'btw_exempt',
        'stock_qty', 'low_stock_threshold', 'image_path', 'is_active',
    ];

    protected $casts = [
        'price'               => 'decimal:2',
        'btw_rate'            => 'decimal:2',
        'stock_qty'           => 'decimal:3',
        'low_stock_threshold' => 'decimal:3',
        'btw_exempt'          => 'boolean',
        'is_active'           => 'boolean',
    ];

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
