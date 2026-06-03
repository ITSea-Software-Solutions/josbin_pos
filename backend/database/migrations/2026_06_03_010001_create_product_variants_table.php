<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Product variants — Stage 2 of the catalogue upgrade.
 *
 * A "parent" product (in `products`) can have N variants, each with its own
 * SKU, barcode, stock, and optional price/cost override. Examples:
 *   • Bruine Bonen 500g / 1kg / 5kg
 *   • Coca-Cola 500ml / 1.5L / 2L
 *   • T-shirt rood S / M / L / XL
 *
 * Design decisions:
 *
 *   1. Variants are stored in their own table, NOT as products with a parent_id.
 *      Reasons:
 *      - Variants share the parent's name, brand, category, BTW. Less drift.
 *      - The POS grid still sees ONE tile per parent (cleaner UI).
 *      - Sale-items can reference variant_id when a variant was chosen,
 *        OR product_id alone if the product has no variants.
 *      - Reporting "top product" remains parent-level by default.
 *
 *   2. Variant price + cost are OPTIONAL.
 *      - If null → use parent's. So you can have variants that share pricing
 *        (e.g. all sizes are SRD 5) without typing the same price thrice.
 *      - If set → variant overrides parent. Same per-store override pattern
 *        as existing product price overrides — phase 3 if needed.
 *
 *   3. Variant stock is REQUIRED (default 0).
 *      - Each size/color has its own count — the whole point of variants.
 *      - Same low_stock_threshold pattern as the parent product.
 *      - Per-store variant stock follows in a later migration if a chain
 *        needs it; for v1 the stock is org-wide on the variant.
 *
 *   4. `attributes` JSONB column for flexible variant metadata.
 *      - e.g. {"size": "1kg", "color": "red", "flavor": "vanilla"}
 *      - Used for the dashboard variant grid + future filter UI.
 *      - Not indexed yet — add a GIN index if filtering becomes hot.
 *
 *   5. SKU + barcode are unique per organisation among non-null values
 *      (partial unique indexes — same pattern as products).
 *
 * The sale_items table gets a nullable variant_id FK so historical sales
 * pre-this-migration keep working (variant_id=null means "no variant —
 * parent product sold as-is").
 */
return new class extends Migration {
    public function up(): void
    {
        // ── product_variants ────────────────────────────────────────────────
        Schema::create('product_variants', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organisation_id');
            $table->uuid('product_id');

            // Identifiers — unique per org via partial indexes below
            $table->string('sku', 80)->nullable();
            $table->string('barcode', 30)->nullable();

            // Display
            $table->string('name_nl', 200);
            $table->string('name_en', 200);
            $table->integer('sort_order')->default(0);

            // Pricing — null = inherit from parent
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('cost_price', 12, 2)->nullable();

            // Stock (org-wide for v1; per-store comes later if needed)
            $table->decimal('stock_qty', 10, 3)->default(0);
            $table->decimal('low_stock_threshold', 10, 3)->nullable();

            // Flexible metadata: {"size": "1kg", "color": "red", …}
            $table->jsonb('attributes')->nullable();

            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('organisation_id')->references('id')->on('organisations')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');

            $table->index(['product_id', 'sort_order']);
            $table->index(['organisation_id', 'is_active']);
        });

        // Partial unique indexes on sku + barcode (per-org, only among non-null)
        DB::statement("
            CREATE UNIQUE INDEX product_variants_org_sku_unique
            ON product_variants (organisation_id, sku)
            WHERE sku IS NOT NULL
        ");
        DB::statement("
            CREATE UNIQUE INDEX product_variants_org_barcode_unique
            ON product_variants (organisation_id, barcode)
            WHERE barcode IS NOT NULL
        ");

        // ── sale_items.variant_id ───────────────────────────────────────────
        Schema::table('sale_items', function (Blueprint $table) {
            // Nullable: pre-existing sale rows + sales of parents with no
            // variants both leave this null. Set only when the cashier
            // picked a specific variant at checkout.
            $table->uuid('variant_id')->nullable()->after('product_id');
            $table->string('variant_name_snapshot', 200)->nullable()->after('product_name_snapshot');

            $table->foreign('variant_id')->references('id')->on('product_variants')->onDelete('set null');
            $table->index('variant_id');
        });
    }

    public function down(): void
    {
        Schema::table('sale_items', function (Blueprint $table) {
            $table->dropForeign(['variant_id']);
            $table->dropIndex(['variant_id']);
            $table->dropColumn(['variant_id', 'variant_name_snapshot']);
        });

        DB::statement('DROP INDEX IF EXISTS product_variants_org_sku_unique');
        DB::statement('DROP INDEX IF EXISTS product_variants_org_barcode_unique');
        Schema::dropIfExists('product_variants');
    }
};
