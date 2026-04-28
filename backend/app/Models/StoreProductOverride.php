<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StoreProductOverride extends Model
{
    use HasUuids;

    protected $fillable = ['store_id', 'product_id', 'price_override', 'is_active'];

    protected $casts = [
        'price_override' => 'decimal:2',
        'is_active'      => 'boolean',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
