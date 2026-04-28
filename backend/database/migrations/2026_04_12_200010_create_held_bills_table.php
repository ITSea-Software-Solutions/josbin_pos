<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('held_bills', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('cashier_id');
            $table->uuid('customer_id')->nullable();
            $table->string('label')->nullable();        // optional cashier label e.g. "Table 4"
            $table->json('cart_data');                  // full cart state (items, discounts, overrides)
            $table->decimal('total_srd', 12, 2)->default(0); // for display in open bills list
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('cashier_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();

            $table->index(['store_id', 'cashier_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('held_bills');
    }
};
