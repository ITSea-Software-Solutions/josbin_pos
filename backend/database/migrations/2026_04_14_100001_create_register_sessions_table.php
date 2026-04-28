<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('register_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('register_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('store_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('cashier_id')->constrained('users')->cascadeOnDelete();

            // Cash management
            $table->decimal('opening_float', 12, 2)->default(0);   // cash put in at open
            $table->decimal('closing_cash_counted', 12, 2)->nullable(); // counted at close
            $table->decimal('expected_cash', 12, 2)->nullable();    // computed: float + cash sales
            $table->decimal('discrepancy', 12, 2)->nullable();      // expected - counted

            // Session status
            // open | closed | reopen_requested | reopen_approved
            $table->string('status', 20)->default('open')->index();

            // Timestamps
            $table->timestampTz('opened_at');
            $table->timestampTz('closed_at')->nullable();
            $table->string('closing_note')->nullable();             // cashier note on close

            // Re-open workflow
            $table->timestampTz('reopen_requested_at')->nullable();
            $table->string('reopen_reason')->nullable();            // cashier's reason
            $table->foreignUuid('reopen_requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('reopen_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('reopen_approved_at')->nullable();
            $table->string('reopen_denial_reason')->nullable();

            $table->timestamps();

            // A cashier can only have one open session per register per day
            $table->index(['register_id', 'status']);
            $table->index(['cashier_id', 'status']);
            $table->index(['store_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('register_sessions');
    }
};
