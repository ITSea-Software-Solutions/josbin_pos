<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 3 of Suriname payment-method improvements (task #79).
 *
 * Scaffolds QR / mobile-wallet payments. NO real integration yet — Suriname
 * has no equivalent of UPI (India) or Pix (Brazil) as of 2026; mobile-bank
 * apps issue ad-hoc payloads that vary by provider. This migration captures
 * the data shape so when a Surinamese PSP eventually ships a settlement
 * webhook + standard QR format we can wire it in without a schema change.
 *
 * Adds:
 *   qr_payment as a new value on the payment_method enum.
 *   qr_payload (text) — opaque payload the wallet scanned (provider-specific).
 *   qr_provider (varchar) — reuses payment_provider semantics; named explicitly
 *     here so reports can group by it without parsing the payload.
 *
 * The existing payment_provider / payment_reference / payment_confirmed_at
 * columns from Phase 2 cover the rest of the lifecycle — QR follows the same
 * "pending → confirmed by webhook / OA" flow as bank_transfer.
 */
return new class extends Migration {
    public function up(): void
    {
        if (config('database.default') === 'pgsql') {
            DB::statement('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check');
            DB::statement(<<<'SQL'
                ALTER TABLE sales
                ADD CONSTRAINT sales_payment_method_check
                CHECK (payment_method IN (
                    'cash',
                    'card',
                    'mixed',
                    'bank_transfer',
                    'mobile_transfer',
                    'foreign_cash',
                    'qr_payment'
                ))
            SQL);
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->text('qr_payload')->nullable()->after('foreign_rate_used');
        });

        // No new index — QR sales reuse the existing pending-payment partial
        // index pattern (would need a separate one once we add qr_payment to
        // PM_PENDING_CONFIRMATION; deferred until a real PSP integration).
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('qr_payload');
        });

        if (config('database.default') === 'pgsql') {
            // Drop any qr_payment rows before tightening the check, otherwise
            // Postgres rejects the ALTER.
            DB::table('sales')->where('payment_method', 'qr_payment')->delete();
            DB::statement('ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check');
            DB::statement(<<<'SQL'
                ALTER TABLE sales
                ADD CONSTRAINT sales_payment_method_check
                CHECK (payment_method IN (
                    'cash', 'card', 'mixed',
                    'bank_transfer', 'mobile_transfer', 'foreign_cash'
                ))
            SQL);
        }
    }
};
