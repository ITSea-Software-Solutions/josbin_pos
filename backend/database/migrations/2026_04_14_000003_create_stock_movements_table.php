<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * stock_movements — append-only ledger of every inventory change.
 *
 * Every sale, void, refund, manual adjustment, or import that changes
 * a product's stock_qty must insert a row here. stock_qty on the products
 * table is the running total — this table is the audit trail behind it.
 *
 * reason values:
 *   sale          — deducted when a sale is completed
 *   void          — restored when an entire sale is voided
 *   refund        — restored when sale items are refunded
 *   adjustment    — manual stock correction by manager
 *   import        — bulk import from CSV
 *   initial       — stock set at product creation
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('product_id');
            $table->uuid('store_id');
            $table->uuid('organisation_id');

            // Signed quantity change: negative for sale/void(negative), positive for refund/adjustment
            $table->decimal('qty_change', 10, 3);

            // Resulting stock after this movement (snapshot — avoids recomputing the full ledger)
            $table->decimal('qty_after', 10, 3);

            $table->string('reason', 30);           // enum above

            // FK to sales.id — sales uses uuid v7, see _change_stock_movements_sale_id_to_uuid migration
            $table->bigInteger('sale_id')->unsigned()->nullable();
            $table->uuid('user_id')->nullable();    // who triggered it (null = system/queue)

            $table->text('notes')->nullable();      // required for 'adjustment' reason

            $table->timestampTz('created_at');      // AST

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();

            // Indexes for stock history queries
            $table->index(['product_id', 'created_at'], 'stock_product_date_idx');
            $table->index(['store_id', 'created_at'],   'stock_store_date_idx');
            $table->index(['sale_id'],                  'stock_sale_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
