<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Extend products with standard-POS fields the Surinamese client demo expects.
 *
 * Adds:
 *   - sku                — internal code, distinct from barcode. Lots of
 *                          products share or lack a barcode; SKU is what
 *                          staff use to search + manage. Unique per org.
 *   - cost_price         — bought-at price. Needed for margin reports and
 *                          Belastingdienst-friendly. OA-only at the API
 *                          layer (see ProductController::stripCostPrice).
 *   - brand              — Surinamese shops carry multiple brands of the
 *                          same product (3 brands of Bruine Bonen at De
 *                          Hoop) — needs to be distinguishable.
 *   - supplier           — "Call Yu Pi when this drops below 20" — used
 *                          on reorder reports.
 *   - unit               — each / kg / g / l / ml / pak. Critical for
 *                          weighed goods + bulk + receipts.
 *   - description_nl/en  — Long-form for the dashboard product detail
 *                          (ingredients, allergens, marketing copy).
 *
 * Nothing required (all nullable / defaulted) so existing demo products
 * keep working without a backfill. SKU has a partial unique index so
 * null + null is fine but non-null duplicates per org are blocked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('sku', 80)->nullable()->after('barcode');
            $table->decimal('cost_price', 12, 2)->nullable()->after('price');
            $table->string('brand', 120)->nullable()->after('image_path');
            $table->string('supplier', 120)->nullable()->after('brand');
            $table->string('unit', 16)->default('each')->after('supplier');
            $table->text('description_nl')->nullable()->after('unit');
            $table->text('description_en')->nullable()->after('description_nl');
        });

        // Partial unique index — SKU is unique per organisation among rows
        // that HAVE a sku. Multiple products with NULL sku are allowed
        // (legacy + lazy-typers). Same pattern as our barcode uniqueness.
        DB::statement("
            CREATE UNIQUE INDEX products_org_sku_unique
            ON products (organisation_id, sku)
            WHERE sku IS NOT NULL
        ");

        // CHECK constraint on unit to keep the column tidy. Same set the
        // frontend dropdown exposes; new values added later must be added
        // to both this constraint AND the form options.
        DB::statement("
            ALTER TABLE products
            ADD CONSTRAINT products_unit_check
            CHECK (unit IN ('each','kg','g','l','ml','pak'))
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check');
        DB::statement('DROP INDEX IF EXISTS products_org_sku_unique');
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'sku', 'cost_price', 'brand', 'supplier', 'unit',
                'description_nl', 'description_en',
            ]);
        });
    }
};
