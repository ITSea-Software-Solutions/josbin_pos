<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * user_stores pivot — restricts a user to specific stores within their org.
 *
 * Backfill semantics: an EMPTY pivot for a user means "all stores in the
 * user's organisation". This matches the org-scoped behaviour that already
 * existed in the codebase, so existing users (cashiers, managers) keep
 * working without re-assignment. Going forward an OA / SA can tighten
 * access by ticking specific stores in the user-edit form.
 *
 * Roles that ignore the pivot entirely (always org-wide):
 *   - super_admin    (cross-org)
 *   - organisation_admin (org-wide)
 *   - auditor        (read-only, org-wide)
 *   - api_integration (machine)
 *
 * Roles where the pivot bites:
 *   - cashier        (POS login picks store + register-open)
 *   - store_manager  (refund approval, Z-Report close, dashboard scoping)
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('user_stores', function (Blueprint $table) {
            $table->uuid('user_id');
            $table->uuid('store_id');
            $table->timestampTz('assigned_at')->useCurrent();
            $table->uuid('assigned_by')->nullable();

            $table->primary(['user_id', 'store_id']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->foreign('assigned_by')->references('id')->on('users')->nullOnDelete();

            $table->index('store_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_stores');
    }
};
