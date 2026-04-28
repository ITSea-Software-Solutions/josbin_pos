<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * discount_rules — configurable automatic discounts applied at checkout.
 *
 * Evaluation order (applied sequentially, not stacked unless stackable=true):
 *   1. Product-specific rules   (applies_to = 'product', applies_to_id = product UUID)
 *   2. Category rules           (applies_to = 'category', applies_to_id = category UUID)
 *   3. Cart-level rules         (applies_to = 'cart', applies_to_id = null)
 *
 * Rule types:
 *   pct_discount   — reduce price by X percent (e.g. 10 = 10%)
 *   fixed_discount — reduce price by fixed SRD amount per unit
 *   buy_x_get_y    — buy min_qty, get free_qty free (free_qty stored in value as integer)
 *
 * Rules are only active when: is_active=true AND now() is within [valid_from, valid_to].
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discount_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organisation_id');
            $table->uuid('store_id')->nullable();    // null = applies to all stores in org

            $table->string('name', 200);             // human-readable label
            $table->string('applies_to', 20);        // 'product' | 'category' | 'cart'
            $table->uuid('applies_to_id')->nullable();// product_id or category_id; null for cart

            $table->string('type', 30);              // 'pct_discount' | 'fixed_discount' | 'buy_x_get_y'
            $table->decimal('value', 10, 2);         // pct: 10.00 → 10%, fixed: 5.00 → SRD 5.00, bxgy: free qty
            $table->decimal('min_qty', 10, 3)->default(1.000); // minimum quantity to trigger
            $table->decimal('max_discount_srd', 10, 2)->nullable(); // cap for pct rules

            $table->boolean('stackable')->default(false); // can combine with other rules?
            $table->boolean('is_active')->default(true);

            $table->timestampTz('valid_from')->nullable();
            $table->timestampTz('valid_to')->nullable();

            $table->uuid('created_by')->nullable();
            $table->timestampsTz();

            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();
            $table->foreign('store_id')->references('id')->on('stores')->nullOnDelete();

            $table->index(['organisation_id', 'is_active', 'applies_to'], 'discount_org_active_idx');
            $table->index(['applies_to_id'], 'discount_applies_to_id_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_rules');
    }
};
