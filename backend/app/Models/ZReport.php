<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Contracts\Auditable;

class ZReport extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    protected $table = 'z_reports';

    protected $fillable = [
        'store_id', 'closed_by', 'report_date',
        'total_sales_srd', 'transaction_count', 'total_btw_srd',
        'cash_total_srd', 'card_total_srd',
        'expected_cash_srd', 'actual_cash_srd', 'cash_discrepancy_srd',
        'discrepancy_note', 'top_products', 'btw_breakdown',
        'sync_status', 'synced_at', 'closed_at',
    ];

    protected $casts = [
        'report_date'          => 'date',
        'total_sales_srd'      => 'decimal:2',
        'total_btw_srd'        => 'decimal:2',
        'cash_total_srd'       => 'decimal:2',
        'card_total_srd'       => 'decimal:2',
        'expected_cash_srd'    => 'decimal:2',
        'actual_cash_srd'      => 'decimal:2',
        'cash_discrepancy_srd' => 'decimal:2',
        'top_products'         => 'array',
        'btw_breakdown'        => 'array',
        'closed_at'            => 'datetime',
        'synced_at'            => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function isSent(): bool
    {
        return $this->sync_status === 'sent';
    }
}
