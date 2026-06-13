<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use OwenIt\Auditing\Contracts\Auditable;

/**
 * A manual cash drawer movement during a shift.
 *
 *   direction 'in'  — cash put INTO the drawer (change top-up, owner float)
 *   direction 'out' — cash taken OUT (supplier paid from till, driver tip)
 *
 * Append-only: a movement is a fact about the drawer at a moment, never edited.
 * It feeds the register's expected-cash math at Z-Report time.
 */
class CashMovement extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    public const DIR_IN  = 'in';
    public const DIR_OUT = 'out';

    /** created_at is set explicitly; there is no updated_at on an immutable row. */
    public $timestamps = false;

    protected $fillable = [
        'register_session_id', 'store_id', 'user_id',
        'direction', 'amount', 'reason', 'created_at',
    ];

    protected $casts = [
        'amount'     => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(RegisterSession::class, 'register_session_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
