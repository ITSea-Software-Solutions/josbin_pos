<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * After a register session is closed, the system locks the register for
 * the day (formal Z-Report semantics — see RegisterController::open).
 * A manager can clear that lock for the next shift via a new endpoint;
 * the clear is recorded inline on the session row so the audit trail
 * stays as `closed → cleared_for_next_shift` rather than mutating
 * the original close.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('register_sessions', function (Blueprint $table) {
            $table->timestampTz('cleared_at')->nullable()->after('reopen_denial_reason');
            $table->uuid('cleared_by')->nullable()->after('cleared_at');
            $table->string('clear_note', 500)->nullable()->after('cleared_by');
            $table->string('clear_for_cashier', 200)->nullable()->after('clear_note');

            $table->foreign('cleared_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['register_id', 'cleared_at']);
        });
    }

    public function down(): void
    {
        Schema::table('register_sessions', function (Blueprint $table) {
            $table->dropForeign(['cleared_by']);
            $table->dropIndex(['register_id', 'cleared_at']);
            $table->dropColumn(['cleared_at', 'cleared_by', 'clear_note', 'clear_for_cashier']);
        });
    }
};
