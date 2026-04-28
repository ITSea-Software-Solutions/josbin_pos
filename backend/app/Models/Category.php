<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasUuids;

    protected $fillable = [
        'organisation_id', 'name_nl', 'name_en',
        'icon', 'color', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /** Return the localised name based on current app locale. */
    public function getNameAttribute(): string
    {
        $locale = app()->getLocale();

        return $locale === 'en' ? $this->name_en : $this->name_nl;
    }
}
