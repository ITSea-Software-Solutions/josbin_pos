<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sale_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('sale_id');
            $table->uuid('product_id')->nullable();    // nullable: product may be deleted
            $table->string('product_name_snapshot');   // name at time of sale (immutable record)
            $table->decimal('unit_price_srd', 12, 2);  // price at time of sale
            $table->decimal('quantity', 10, 3);        // supports decimals (e.g. 0.5 kg)
            $table->decimal('discount_srd', 12, 2)->default(0);
            $table->decimal('discount_pct', 5, 2)->default(0);
            $table->decimal('btw_rate', 5, 2)->default(0);
            $table->boolean('btw_exempt')->default(false);
            $table->decimal('btw_srd', 12, 2)->default(0);
            $table->decimal('line_total_srd', 12, 2);  // after discount, before BTW (taxable base)
            $table->timestampsTz();

            $table->foreign('sale_id')->references('id')->on('sales')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->nullOnDelete();

            $table->index('sale_id');
            $table->index(['product_id', 'created_at']); // for top products report
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
