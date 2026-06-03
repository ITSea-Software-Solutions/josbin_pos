<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Snapshot cost + margin on every sale_item at the moment the sale completes.
 *
 * Why a snapshot (not a join back to products.cost_price)?
 *   - Products change cost over time (supplier price hikes, promo periods).
 *   - Without a snapshot, "profit on yesterday's sales" silently changes
 *     every time someone edits today's cost. Belastingdienst + any
 *     reasonable accountant rejects that — historical numbers must be
 *     reproducible from the row itself.
 *   - Same pattern we already use for product_name_snapshot, unit_price_srd
 *     (snapshot of the price at sale time), btw_rate, btw_srd.
 *
 * Variant-aware: if the sale item has a variant_id, we snapshot the variant's
 * effective cost (variant.cost_price → parent.cost_price fallback). For
 * variantless products we snapshot the product's cost. Resolved in
 * SaleController::store, not here.
 *
 * Both columns are nullable because:
 *   - Pre-this-migration sales have nothing to snapshot. They stay NULL
 *     and profit reports show "cost unknown" for those rows.
 *   - New products created without a cost_price keep snapshot NULL too —
 *     OA hadn't decided on cost yet. Caller's job to decide whether to
 *     count those as zero-cost or exclude from profit math.
 *
 * margin_srd = line_total_srd - (cost_snapshot_srd * quantity). Stored
 * (not computed) so the dashboard's aggregations don't have to multiply
 * + sum in SQL on every request.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            // Snapshot of the product/variant cost at sale time. NULL means
            // either pre-migration sale or the product had no cost set.
            $table->decimal('cost_snapshot_srd', 12, 2)->nullable()->after('line_total_srd');

            // Pre-computed line profit so reports SUM() instead of recomputing.
            // line_profit_srd = line_total_srd - (cost_snapshot_srd * quantity).
            // NULL when cost_snapshot_srd is NULL.
            $table->decimal('line_profit_srd', 12, 2)->nullable()->after('cost_snapshot_srd');

            // Helps profit-report queries skip NULL-cost rows fast.
            $table->index(['sale_id', 'cost_snapshot_srd']);
        });

        // Best-effort backfill for existing sale rows in the demo / dev DB
        // so the new Profit tab doesn't show "no data" the moment it ships.
        // Uses the CURRENT product cost (accountant would treat this as a
        // estimate; new sales after this migration get the true snapshot).
        // The pgcrypto-style update is conditional: only touch rows where a
        // current product cost exists.
        DB::statement("
            UPDATE sale_items si
            SET cost_snapshot_srd = p.cost_price,
                line_profit_srd   = si.line_total_srd - (p.cost_price * si.quantity)
            FROM products p
            WHERE si.product_id = p.id
              AND si.cost_snapshot_srd IS NULL
              AND p.cost_price IS NOT NULL
        ");
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropIndex(['sale_id', 'cost_snapshot_srd']);
            $table->dropColumn(['cost_snapshot_srd', 'line_profit_srd']);
        });
    }
};
