<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 of Suriname payment-method improvements (task #78).
 *
 * Adds three new payment methods that Surinamese retailers actually accept
 * beyond cash + card:
 *
 *   bank_transfer    — B2B / government invoiced sales. Customer pays to your
 *                      bank account; OA confirms once funds land.
 *   mobile_transfer  — DSB Mobiel / Hakrinbank Online / etc. Same lifecycle
 *                      as bank_transfer (pending → confirmed by OA).
 *   foreign_cash     — USD / EUR accepted at till. Customer pays in foreign
 *                      currency; we lock the day's USD→SRD rate and store
 *                      both amounts. Cash is in the drawer immediately — no
 *                      pending state.
 *
 * Schema additions on `sales`:
 *   payment_provider     varchar(64)  bank name for bank_transfer / app name
 *                                     for mobile_transfer / null for others
 *   payment_reference    varchar(64)  sender's payment ref / TX ID
 *   payment_sender_name  varchar(120) optional payer name (B2B invoicing)
 *   payment_confirmed_at timestamptz  set when OA confirms transfer landed
 *   payment_confirmed_by uuid         OA who confirmed (FK users)
 *   foreign_currency     char(3)      'USD' / 'EUR' (extensible)
 *   foreign_amount       decimal(12,2) amount in that currency
 *   foreign_rate_used    decimal(10,4) locked rate at time of sale
 *
 * The Postgres CHECK constraint on `payment_method` gets dropped + recreated
 * to include the three new values. Sales already in flight stay valid.
 */
return new class extends Migration {
    public function up(): void
    {
        // Drop the enum CHECK constraint so we can add new values.
        if (config('database.default') === 'pgsql') {
            DB::statement('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check');
        }

        Schema::table('sales', function (Blueprint $table) {
            // Re-add as varchar with a fresh CHECK that includes the new values.
            // Done in raw SQL below since Schema::change() doesn't recreate the
            // constraint atomically on Postgres.
            $table->string('payment_provider',    64)->nullable()->after('card_last_four');
            $table->string('payment_reference',   64)->nullable()->after('payment_provider');
            $table->string('payment_sender_name',120)->nullable()->after('payment_reference');
            $table->timestampTz('payment_confirmed_at')->nullable()->after('payment_sender_name');
            $table->uuid('payment_confirmed_by')->nullable()->after('payment_confirmed_at');
            $table->foreign('payment_confirmed_by')->references('id')->on('users')->nullOnDelete();

            $table->char('foreign_currency', 3)->nullable()->after('payment_confirmed_by');
            $table->decimal('foreign_amount', 12, 2)->nullable()->after('foreign_currency');
            $table->decimal('foreign_rate_used', 10, 4)->nullable()->after('foreign_amount');
        });

        // Re-add the CHECK with the expanded enum set.
        if (config('database.default') === 'pgsql') {
            DB::statement(<<<'SQL'
                ALTER TABLE sales
                ADD CONSTRAINT sales_payment_method_check
                CHECK (payment_method IN (
                    'cash',
                    'card',
                    'mixed',
                    'bank_transfer',
                    'mobile_transfer',
                    'foreign_cash'
                ))
            SQL);

            // Partial index for the OA's "pending payments" screen — only rows
            // that are bank_transfer / mobile_transfer AND not yet confirmed.
            // Tiny + fast since most sales are cash/card and confirmed ones
            // age out of relevance.
            DB::statement(<<<'SQL'
                CREATE INDEX sales_pending_payment_idx ON sales (payment_method, occurred_at)
                WHERE payment_method IN ('bank_transfer', 'mobile_transfer')
                  AND payment_confirmed_at IS NULL
            SQL);
        }
    }

    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS sales_pending_payment_idx');
            DB::statement('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check');
            // Reject any rows that would violate the tighter CHECK we're about
            // to re-add — those payments need to be voided / moved before we
            // can shrink the enum back.
            DB::table('sales')->whereIn('payment_method', ['bank_transfer','mobile_transfer','foreign_cash'])->delete();
            DB::statement(<<<'SQL'
                ALTER TABLE sales
                ADD CONSTRAINT sales_payment_method_check
                CHECK (payment_method IN ('cash', 'card', 'mixed'))
            SQL);
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['payment_confirmed_by']);
            $table->dropColumn([
                'payment_provider', 'payment_reference', 'payment_sender_name',
                'payment_confirmed_at', 'payment_confirmed_by',
                'foreign_currency', 'foreign_amount', 'foreign_rate_used',
            ]);
        });
    }
};
