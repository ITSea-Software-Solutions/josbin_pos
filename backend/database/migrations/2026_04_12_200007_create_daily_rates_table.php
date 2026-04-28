<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_rates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date')->unique();            // one rate per day
            $table->decimal('usd_to_srd', 10, 4);     // final rate used for transactions
            $table->decimal('raw_rate', 10, 4);        // rate from API before markup
            $table->decimal('markup_pct', 5, 2)->default(0);
            $table->enum('source', ['api', 'manual'])->default('api');
            $table->uuid('locked_by')->nullable();     // user who locked / manually set
            $table->timestampTz('locked_at')->nullable();
            $table->json('api_response')->nullable();  // raw API response for audit
            $table->timestampsTz();

            $table->foreign('locked_by')
                ->references('id')
                ->on('users')
                ->nullOnDelete();

            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_rates');
    }
};
