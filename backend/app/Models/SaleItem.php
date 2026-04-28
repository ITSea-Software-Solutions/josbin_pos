<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SaleItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'sale_id', 'product_id', 'product_name_snapshot',
        'unit_price_srd', 'quantity',
        'discount_srd', 'discount_pct',
        'btw_rate', 'btw_exempt', 'btw_srd', 'line_total_srd',
    ];

    protected $casts = [
        'unit_price_srd' => 'decimal:2',
        'quantity'       => 'decimal:3',
        'discount_srd'   => 'decimal:2',
        'discount_pct'   => 'decimal:2',
        'btw_rate'       => 'decimal:2',
        'btw_srd'        => 'decimal:2',
        'line_total_srd' => 'decimal:2',
        'btw_exempt'     => 'boolean',
    ];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
