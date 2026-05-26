<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use OwenIt\Auditing\Contracts\Auditable;

class Sale extends Model implements Auditable
{
    use HasUuids;
    use \OwenIt\Auditing\Auditable;

    protected $fillable = [
        'store_id', 'cashier_id', 'register_session_id', 'customer_id', 'sale_number',
        'subtotal_srd', 'discount_srd', 'btw_srd', 'total_srd',
        'payment_method', 'cash_received_srd', 'change_srd', 'card_amount_srd',
        // Optional card reconciliation fields — captured from the bank's PIN
        // terminal slip so the OA can match daily card sales to the bank
        // settlement statement. See migration `2026_05_26_040001_add_card_
        // reconciliation_to_sales.php` for the design rationale.
        'card_bank', 'card_approval_code', 'card_terminal_ref', 'card_last_four',
        // Phase 2 — bank_transfer / mobile_transfer / foreign_cash. See
        // migration `2026_05_26_050001_extend_payment_methods_for_suriname.php`.
        'payment_provider', 'payment_reference', 'payment_sender_name',
        'payment_confirmed_at', 'payment_confirmed_by',
        'foreign_currency', 'foreign_amount', 'foreign_rate_used',
        // Phase 3 — qr_payment scaffolding. See migration
        // `2026_05_26_060001_add_qr_payment_scaffolding.php`.
        'qr_payload',
        'status', 'source', 'exchange_rate_used',
        'void_reason', 'voided_by', 'voided_at', 'void_approved_by',
        'external_sale_ref', 'occurred_at',
    ];

    protected $casts = [
        'subtotal_srd'       => 'decimal:2',
        'discount_srd'       => 'decimal:2',
        'btw_srd'            => 'decimal:2',
        'total_srd'          => 'decimal:2',
        'cash_received_srd'  => 'decimal:2',
        'change_srd'         => 'decimal:2',
        'card_amount_srd'    => 'decimal:2',
        'exchange_rate_used' => 'decimal:4',
        'voided_at'          => 'datetime',
        'occurred_at'        => 'datetime',
        'payment_confirmed_at' => 'datetime',
        'foreign_amount'       => 'decimal:2',
        'foreign_rate_used'    => 'decimal:4',
    ];

    // ── Payment method constants ──────────────────────────────────────────────
    public const PM_CASH            = 'cash';
    public const PM_CARD            = 'card';
    public const PM_MIXED           = 'mixed';
    public const PM_BANK_TRANSFER   = 'bank_transfer';
    public const PM_MOBILE_TRANSFER = 'mobile_transfer';
    public const PM_FOREIGN_CASH    = 'foreign_cash';
    // Phase 3 — QR / mobile-wallet scaffolding. Lifecycle mirrors transfers
    // (pending → confirmed by OA or by a future PSP webhook).
    public const PM_QR_PAYMENT      = 'qr_payment';

    public const PAYMENT_METHODS = [
        self::PM_CASH, self::PM_CARD, self::PM_MIXED,
        self::PM_BANK_TRANSFER, self::PM_MOBILE_TRANSFER, self::PM_FOREIGN_CASH,
        self::PM_QR_PAYMENT,
    ];

    /** Methods that don't settle the cash drawer the moment the sale is rung. */
    public const PM_PENDING_CONFIRMATION = [
        self::PM_BANK_TRANSFER,
        self::PM_MOBILE_TRANSFER,
        self::PM_QR_PAYMENT,
    ];

    /** Is this sale still waiting for OA to confirm the funds landed? */
    public function isAwaitingPaymentConfirmation(): bool
    {
        return in_array($this->payment_method, self::PM_PENDING_CONFIRMATION, true)
            && $this->payment_confirmed_at === null;
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    public function voidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }

    public function registerSession(): BelongsTo
    {
        return $this->belongsTo(RegisterSession::class);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isVoided(): bool
    {
        return $this->status === 'voided';
    }

    public function isHeld(): bool
    {
        return $this->status === 'held';
    }

    /**
     * Generate the next sale number for a store: POS-YYYY-NNNNN
     *
     * Called inside the sale-creation DB transaction. A per-store/year Postgres
     * advisory lock serialises number allocation so two concurrent terminals
     * cannot generate the same sale_number (which would violate the unique
     * index and fail the second sale). The lock auto-releases at commit.
     */
    public static function nextNumber(string $storeId): string
    {
        $year = now()->format('Y');

        DB::select('SELECT pg_advisory_xact_lock(hashtext(?))', ["sale_number:{$storeId}:{$year}"]);

        $count = static::where('store_id', $storeId)
            ->whereYear('occurred_at', $year)
            ->count() + 1;

        return sprintf('POS-%s-%05d', $year, $count);
    }
}
