<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Contracts\Auditable;

/**
 * BtwSubmission — a formal BTW filing to Belastingdienst Suriname.
 *
 * Lifecycle: filed → accepted (by tax_inspector) | disputed | superseded.
 * Once accepted, the row is effectively immutable (controller enforces).
 *
 * See migration `2026_05_26_030001_create_btw_submissions_table.php` for the
 * full schema and the design rationale (snapshot totals, hash chain, etc).
 */
class BtwSubmission extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    public const STATUS_FILED      = 'filed';
    public const STATUS_ACCEPTED   = 'accepted';
    public const STATUS_DISPUTED   = 'disputed';
    public const STATUS_SUPERSEDED = 'superseded';

    public const PERIOD_DAILY   = 'daily';
    public const PERIOD_WEEKLY  = 'weekly';
    public const PERIOD_MONTHLY = 'monthly';

    public const STATUSES = [
        self::STATUS_FILED, self::STATUS_ACCEPTED,
        self::STATUS_DISPUTED, self::STATUS_SUPERSEDED,
    ];

    public const PERIOD_TYPES = [
        self::PERIOD_DAILY, self::PERIOD_WEEKLY, self::PERIOD_MONTHLY,
    ];

    protected $fillable = [
        'organisation_id', 'store_id',
        'period_type', 'period_start', 'period_end',
        'sales_count',
        'total_sales_srd', 'btw_exempt_srd', 'btw_taxable_srd', 'total_btw_srd',
        'status',
        'submitted_at', 'submitted_by',
        'reviewed_at', 'reviewed_by',
        'reference',
        'submitter_note', 'inspector_note',
        'sale_ids',
        'prev_hash', 'current_hash',
    ];

    protected $casts = [
        'period_start'     => 'date',
        'period_end'       => 'date',
        'sales_count'      => 'integer',
        'total_sales_srd'  => 'decimal:2',
        'btw_exempt_srd'   => 'decimal:2',
        'btw_taxable_srd'  => 'decimal:2',
        'total_btw_srd'    => 'decimal:2',
        'submitted_at'     => 'datetime',
        'reviewed_at'      => 'datetime',
        'sale_ids'         => 'array',
    ];

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Human-readable label per status, in NL or EN.
     *
     * @return array{nl:string,en:string}
     */
    public static function statusLabel(string $status): array
    {
        return match ($status) {
            self::STATUS_FILED      => ['nl' => 'Ingediend',  'en' => 'Filed'],
            self::STATUS_ACCEPTED   => ['nl' => 'Geaccepteerd','en' => 'Accepted'],
            self::STATUS_DISPUTED   => ['nl' => 'Betwist',    'en' => 'Disputed'],
            self::STATUS_SUPERSEDED => ['nl' => 'Vervangen',  'en' => 'Superseded'],
            default                 => ['nl' => $status,      'en' => $status],
        };
    }
}
