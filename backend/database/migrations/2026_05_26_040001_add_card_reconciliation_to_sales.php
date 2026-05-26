<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 1 of Suriname payment-method improvements (task #77).
 *
 * Adds optional reconciliation fields on `sales` for `card` + `mixed`
 * payments. None of these are required — the cashier may skip them all and
 * the sale still saves with payment_method='card'. But when filled, they let
 * the OA match the day's card sales against the bank's settlement statement,
 * which is the #1 missing capability in the current MVP.
 *
 * Suriname-specific context:
 *   - card_bank holds the issuing bank from the terminal slip. Common values:
 *     'DSB', 'Hakrinbank', 'Finabank', 'RBC', 'Republic', 'Visa', 'Mastercard',
 *     'Other'. Kept as free varchar (not enum) so new banks / brands don't
 *     require a schema migration.
 *   - card_approval_code = the printed auth code on the slip (4-12 chars
 *     depending on bank — accommodates them all).
 *   - card_terminal_ref = transaction / reference number from the terminal,
 *     used when the bank's settlement file lists transactions by this id.
 *   - card_last_four = last 4 digits of the customer's card (NEVER more —
 *     storing the full PAN would put us in PCI scope, which we avoid by
 *     design). The cashier can copy this from the customer's slip.
 *
 * All fields are bilingual NL/EN at the UI layer; the DB stores raw values.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->string('card_bank',           32)->nullable()->after('card_amount_srd');
            $table->string('card_approval_code',  16)->nullable()->after('card_bank');
            $table->string('card_terminal_ref',   32)->nullable()->after('card_approval_code');
            $table->string('card_last_four',       4)->nullable()->after('card_terminal_ref');
        });

        // Index for daily/Z report breakdown queries that group by bank.
        // Partial index — only rows where the column is populated (i.e. card
        // payments where the cashier filled it). Keeps the index small.
        if (config('database.default') === 'pgsql') {
            \DB::statement('CREATE INDEX sales_card_bank_idx ON sales (card_bank) WHERE card_bank IS NOT NULL');
        }
    }

    public function down(): void
    {
        if (config('database.default') === 'pgsql') {
            \DB::statement('DROP INDEX IF EXISTS sales_card_bank_idx');
        }

        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['card_bank', 'card_approval_code', 'card_terminal_ref', 'card_last_four']);
        });
    }
};
