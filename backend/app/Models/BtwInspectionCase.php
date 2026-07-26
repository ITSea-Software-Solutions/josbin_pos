<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Contracts\Auditable;

/**
 * A "physical inspection required" case opened by a tax inspector once a store
 * has ignored >= 3 BTW late-filing reminders. In-system only — it lands in the
 * inspectors' queue (bell + dashboard); nothing is dispatched externally.
 * History is append-only: status only ever moves open -> closed.
 */
class BtwInspectionCase extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    public const STATUS_OPEN   = 'open';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'store_id', 'organisation_id', 'opened_by',
        'days_overdue', 'reminder_count', 'reason',
        'status', 'resolved_by', 'resolved_at',
    ];

    protected $casts = [
        'days_overdue'   => 'integer',
        'reminder_count' => 'integer',
        'resolved_at'    => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function organisation(): BelongsTo
    {
        return $this->belongsTo(Organisation::class);
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
