<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Morning-recovery batch: sessions the nightly auto-close job sealed without
 * a cash count carry system_closed=true and wait for a manager to reconcile
 * (count the drawer next morning). reconciled_* record who did and when.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('register_sessions', function (Blueprint $table) {
            $table->boolean('system_closed')->default(false)->after('closing_note');
            $table->timestampTz('reconciled_at')->nullable()->after('system_closed');
            $table->foreignUuid('reconciled_by')->nullable()->after('reconciled_at')
                ->constrained('users')->nullOnDelete();
            $table->index('reconciled_by');
            // Stale-session scans: open sessions by age.
            $table->index(['status', 'opened_at']);
        });
    }

    public function down(): void
    {
        Schema::table('register_sessions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reconciled_by');
            $table->dropIndex(['status', 'opened_at']);
            $table->dropColumn(['system_closed', 'reconciled_at']);
        });
    }
};
