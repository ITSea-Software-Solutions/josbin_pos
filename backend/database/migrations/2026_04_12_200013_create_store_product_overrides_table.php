<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-store price overrides — centralised catalogue with optional branch pricing.
     * e.g. Nickerie branch has higher transport costs → override price for that store only.
     */
    public function up(): void
    {
        Schema::create('store_product_overrides', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('product_id');
            $table->decimal('price_override', 12, 2)->nullable();   // null = use catalogue price
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('product_id')->references('id')->on('products')->cascadeOnDelete();

            $table->unique(['store_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_product_overrides');
    }
};
