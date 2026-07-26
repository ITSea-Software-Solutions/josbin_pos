<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use OwenIt\Auditing\Contracts\Auditable;

class Store extends Model implements Auditable
{
    use HasUuids, SoftDeletes;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'organisation_id', 'name', 'address', 'city',
        'default_btw_rate', 'btw_filing_period_days',
        'receipt_header', 'receipt_footer',
        'receipt_logo_path', 'is_active', 'pos_type', 'settings',
        'last_activity_at',
    ];

    protected $casts = [
        'is_active'              => 'boolean',
        'default_btw_rate'       => 'decimal:2',
        'btw_filing_period_days' => 'integer',
        'settings'               => 'array',
        'last_activity_at'       => 'datetime',
    ];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    public function zReports(): HasMany
    {
        return $this->hasMany(ZReport::class);
    }

    public function heldBills(): HasMany
    {
        return $this->hasMany(HeldBill::class);
    }

    public function apiIntegrations(): HasMany
    {
        return $this->hasMany(ApiIntegration::class);
    }

    public function registers(): HasMany
    {
        return $this->hasMany(Register::class);
    }

    public function btwFilingReminders(): HasMany
    {
        return $this->hasMany(BtwFilingReminder::class);
    }

    public function btwInspectionCases(): HasMany
    {
        return $this->hasMany(BtwInspectionCase::class);
    }
}
