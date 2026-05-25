<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-store stock levels — industry-standard inventory split.
 *
 * Before this migration, products.stock_qty was a single column shared across
 * every store in an organisation. For multi-store chains this meant two
 * cashiers at two different branches could oversell from the same counter.
 *
 * After: product_stocks holds the per-(product, store) running quantity.
 * products.stock_qty is kept as the "default initial stock" used to seed a
 * new store's row when it first sells the product.
 *
 * Backfill strategy: for every (product, store) pair where the store's
 * organisation owns the product, create a product_stocks row initialised
 * to products.stock_qty. Single-store organisations land in exactly the
 * same state as before; multi-store orgs get one row per (product, store)
 * with the same starting number, which is the safest default.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_stocks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('product_id');
            $table->uuid('store_id');
            $table->decimal('stock_qty', 10, 3)->default(0);
            $table->decimal('low_stock_threshold', 10, 3)->default(0);
            $table->timestampsTz();

            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();

            $table->unique(['product_id', 'store_id'], 'product_stocks_product_store_unique');
            $table->index(['store_id', 'stock_qty'], 'product_stocks_store_qty_idx'); // for low-stock query
        });

        // Backfill: one row per (product, store) within the same organisation.
        // Uses UUID v7 via gen_random_uuid() — same generator as the rest of the schema.
        DB::statement('
            INSERT INTO product_stocks (id, product_id, store_id, stock_qty, low_stock_threshold, created_at, updated_at)
            SELECT
                gen_random_uuid(),
                p.id,
                s.id,
                COALESCE(p.stock_qty, 0),
                COALESCE(p.low_stock_threshold, 0),
                NOW(),
                NOW()
            FROM products p
            JOIN stores s ON s.organisation_id = p.organisation_id
            ON CONFLICT (product_id, store_id) DO NOTHING
        ');
    }

    public function down(): void
    {
        Schema::dropIfExists('product_stocks');
    }
};
