<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-organisation oversell policy.
 *
 *   block_oversell = false (default)
 *     → a sale always completes; stock may go negative (e.g. −2 means two
 *       more units were sold than the system had on record). The stock
 *       ledger stays mathematically consistent (Σ qty_change == qty_after)
 *       and the negative surfaces a wrong count to the manager. This is
 *       standard supermarket-POS behaviour — a cashier scanning physical
 *       goods is never blocked mid-customer.
 *
 *   block_oversell = true
 *     → a sale that would drive stock below zero is rejected with a 422
 *       (InsufficientStockException) and the whole sale transaction rolls
 *       back. Stock can never go negative. Suited to government stores or
 *       high-value controlled goods.
 *
 * We deliberately do NOT add a DB CHECK (stock_qty >= 0): the default
 * policy allows negative, so the invariant is enforced at the application
 * layer only when an org opts into strict mode.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organisations', function (Blueprint $table) {
            $table->boolean('block_oversell')->default(false)->after('is_government');
        });
    }

    public function down(): void
    {
        Schema::table('organisations', function (Blueprint $table) {
            $table->dropColumn('block_oversell');
        });
    }
};
