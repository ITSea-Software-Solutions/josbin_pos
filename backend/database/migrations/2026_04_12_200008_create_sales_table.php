<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('cashier_id');
            $table->uuid('customer_id')->nullable();
            $table->string('sale_number')->unique();   // e.g. POS-2026-00001
            $table->decimal('subtotal_srd', 12, 2);    // sum of line totals before sale discount
            $table->decimal('discount_srd', 12, 2)->default(0);  // sale-level discount
            $table->decimal('btw_srd', 12, 2)->default(0);
            $table->decimal('total_srd', 12, 2);
            $table->enum('payment_method', ['cash', 'card', 'mixed'])->default('cash');
            $table->decimal('cash_received_srd', 12, 2)->nullable();
            $table->decimal('change_srd', 12, 2)->nullable();
            $table->decimal('card_amount_srd', 12, 2)->nullable();
            $table->enum('status', ['completed', 'voided', 'held'])->default('completed');
            $table->enum('source', ['pos', 'api', 'import'])->default('pos');
            $table->decimal('exchange_rate_used', 10, 4)->nullable(); // USD→SRD rate on day of sale
            $table->text('void_reason')->nullable();
            $table->uuid('voided_by')->nullable();
            $table->timestampTz('voided_at')->nullable();
            $table->uuid('void_approved_by')->nullable();  // second approver for govt accounts
            $table->string('external_sale_ref')->nullable()->unique(); // for API imports (idempotency)
            $table->timestampTz('occurred_at');            // AST — when sale actually happened
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->restrictOnDelete();
            $table->foreign('cashier_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('customer_id')->references('id')->on('customers')->nullOnDelete();
            $table->foreign('voided_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('void_approved_by')->references('id')->on('users')->nullOnDelete();

            // Indexes for report queries — date range + store is the most common pattern
            $table->index(['store_id', 'occurred_at']);
            $table->index(['store_id', 'status', 'occurred_at']);
            $table->index(['cashier_id', 'occurred_at']);
            $table->index('occurred_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
