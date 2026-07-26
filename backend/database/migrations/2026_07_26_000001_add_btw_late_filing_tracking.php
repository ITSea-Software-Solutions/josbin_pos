<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * BTW late-filing tracking (feature BTW-FILING-16).
 *
 *  - stores.btw_filing_period_days: how long a store has to file its BTW
 *    return before it's flagged overdue. Inspector-settable (default 30).
 *  - btw_filing_reminders: log of every nudge (auto daily + inspector manual)
 *    — this is the "reminder history" an inspection case is built from.
 *  - btw_inspection_cases: the escalation opened once a store has ignored
 *    >= 3 inspector reminders. In-system enforcement record only.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->unsignedSmallInteger('btw_filing_period_days')->default(30);
        });

        Schema::create('btw_filing_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('organisation_id');
            $table->string('source');                    // auto | inspector
            $table->uuid('sent_by')->nullable();         // null for automatic nudges
            $table->unsignedInteger('days_overdue')->default(0);
            $table->text('note')->nullable();
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();
            $table->foreign('sent_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['store_id', 'source', 'created_at']);
        });

        Schema::create('btw_inspection_cases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->uuid('organisation_id');
            $table->uuid('opened_by');
            $table->unsignedInteger('days_overdue');
            $table->unsignedInteger('reminder_count');
            $table->text('reason')->nullable();
            $table->string('status')->default('open');   // open | closed
            $table->uuid('resolved_by')->nullable();
            $table->timestampTz('resolved_at')->nullable();
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();
            $table->foreign('opened_by')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('resolved_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['store_id', 'status']);
        });

        // At most one OPEN inspection case per store (Postgres partial unique index).
        DB::statement(
            "CREATE UNIQUE INDEX btw_inspection_cases_one_open_per_store ON btw_inspection_cases (store_id) WHERE status = 'open'"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('btw_inspection_cases');
        Schema::dropIfExists('btw_filing_reminders');
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('btw_filing_period_days');
        });
    }
};
