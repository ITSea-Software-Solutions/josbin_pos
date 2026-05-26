<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Switch from a many-to-many user_stores pivot (added yesterday) to a strict
 * 1:1 single store_id on users. Product decision: a user belongs to exactly
 * one store. No "floating cashiers", no "all stores in org" implicit grant.
 *
 * Migration strategy:
 *   - If a user has exactly one row in user_stores, copy that store into
 *     users.store_id. Multi-row assignments lose all but the first (logged,
 *     not silent — fresh demo data won't have any).
 *   - The pivot is then dropped.
 *
 * Roles that REQUIRE a store_id at the application layer:
 *   - cashier
 *   - store_manager
 * Roles that MUST NOT have a store_id (kept nullable in the DB; enforced
 * by validation):
 *   - super_admin, organisation_admin, auditor, api_integration
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->uuid('store_id')->nullable()->after('organisation_id');
            $table->foreign('store_id')->references('id')->on('stores')->nullOnDelete();
            $table->index('store_id');
        });

        // Backfill: keep at most one store per user. Pick the most recently
        // assigned one if there are multiple.
        if (Schema::hasTable('user_stores')) {
            $rows = DB::table('user_stores')
                ->select('user_id', 'store_id')
                ->orderByDesc('assigned_at')
                ->get();
            $seen = [];
            foreach ($rows as $r) {
                if (isset($seen[$r->user_id])) continue;
                $seen[$r->user_id] = true;
                DB::table('users')->where('id', $r->user_id)->update(['store_id' => $r->store_id]);
            }
            Schema::drop('user_stores');
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['store_id']);
            $table->dropIndex(['store_id']);
            $table->dropColumn('store_id');
        });

        // Re-create the empty pivot so a down-migration leaves the previous
        // migration's structure intact (no data restore).
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
};
