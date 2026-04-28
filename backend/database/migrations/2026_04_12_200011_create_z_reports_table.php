<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('z_reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('closed_by');
            $table->date('report_date');
            $table->decimal('total_sales_srd', 12, 2)->default(0);
            $table->unsignedInteger('transaction_count')->default(0);
            $table->decimal('total_btw_srd', 12, 2)->default(0);
            $table->decimal('cash_total_srd', 12, 2)->default(0);
            $table->decimal('card_total_srd', 12, 2)->default(0);
            $table->decimal('expected_cash_srd', 12, 2)->default(0);
            $table->decimal('actual_cash_srd', 12, 2)->nullable();
            $table->decimal('cash_discrepancy_srd', 12, 2)->nullable();
            $table->text('discrepancy_note')->nullable();
            $table->json('top_products')->nullable();     // snapshot of top 5 products
            $table->json('btw_breakdown')->nullable();    // BTW per rate group
            $table->enum('sync_status', ['pending', 'sent', 'failed'])->default('pending');
            $table->timestampTz('synced_at')->nullable();
            $table->timestampTz('closed_at');
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('closed_by')->references('id')->on('users')->restrictOnDelete();

            $table->unique(['store_id', 'report_date']); // one Z-report per store per day
            $table->index(['store_id', 'report_date']);
            $table->index('sync_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('z_reports');
    }
};
