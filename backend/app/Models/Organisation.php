<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;

class Organisation extends Model implements Auditable
{
    use HasUuids, SoftDeletes;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'name', 'type', 'btw_number', 'currency', 'locale',
        'is_government', 'block_oversell', 'subscription_tier', 'is_active',
        'settings',
    ];

    protected $casts = [
        'is_government'  => 'boolean',
        'block_oversell' => 'boolean',
        'is_active'      => 'boolean',
        'settings'       => 'array',
    ];

    /** Serialized alongside the model so POS + dashboard always see the
     *  effective pick-lists without a second request. */
    protected $appends = ['payment_options'];

    /**
     * Effective payment pick-lists: organisation override per key, falling
     * back to the Suriname defaults in config/josbin_pos.php. NB: callers
     * using a partial select must include `settings` or overrides are
     * silently ignored (accessor then serves pure defaults).
     */
    public function getPaymentOptionsAttribute(): array
    {
        $defaults  = config('josbin_pos.payment_options', []);
        $overrides = $this->settings['payment_options'] ?? [];

        $effective = [];
        foreach ($defaults as $key => $defaultList) {
            $custom = $overrides[$key] ?? null;
            $effective[$key] = (is_array($custom) && $custom !== []) ? array_values($custom) : $defaultList;
        }

        return $effective;
    }

    public function stores(): HasMany
    {
        return $this->hasMany(Store::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function licenses(): HasMany
    {
        return $this->hasMany(License::class);
    }
}
