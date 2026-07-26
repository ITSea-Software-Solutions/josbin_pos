<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A BTW late-filing reminder sent to a store — either the daily automatic
 * nudge (source=auto, from btw:overdue-check) or one a tax inspector sends
 * manually from the dashboard (source=inspector). The inspector reminders
 * logged since a store's last filing are what unlock escalation to an
 * inspection case.
 */
class BtwFilingReminder extends Model
{
    use HasUuids;

    public const SOURCE_AUTO      = 'auto';
    public const SOURCE_INSPECTOR = 'inspector';

    protected $fillable = [
        'store_id', 'organisation_id', 'source', 'sent_by', 'days_overdue', 'note',
    ];

    protected $casts = [
        'days_overdue' => 'integer',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
