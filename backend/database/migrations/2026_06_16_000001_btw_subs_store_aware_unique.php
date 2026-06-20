<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Make the active-period uniqueness store-aware.
 *
 * Before: one active (non-superseded) filing per (org, period_type, period).
 * That blocked per-store filings — two stores couldn't file the same period,
 * and an Org Admin's org-wide return collided with any store's filing.
 *
 * After: uniqueness includes store_id, with a sentinel UUID standing in for
 * NULL (org-wide) so two org-wide filings for one period still collide (a
 * plain nullable column would let NULLs duplicate). Net effect:
 *   - one org-wide (store_id NULL) active filing per period   ✅
 *   - one filing per store per period                          ✅
 *   - org-wide + per-store filings for the same period coexist ✅
 */
return new class extends Migration
{
    private string $sentinel = '00000000-0000-0000-0000-000000000000';

    public function up(): void
    {
        DB::statement('DROP INDEX IF EXISTS btw_subs_active_period_unique');
        DB::statement("
            CREATE UNIQUE INDEX btw_subs_active_period_unique
            ON btw_submissions (
                organisation_id, period_type, period_start, period_end,
                COALESCE(store_id, '{$this->sentinel}'::uuid)
            )
            WHERE status <> 'superseded'
        ");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS btw_subs_active_period_unique');
        DB::statement("
            CREATE UNIQUE INDEX btw_subs_active_period_unique
            ON btw_submissions (organisation_id, period_type, period_start, period_end)
            WHERE status <> 'superseded'
        ");
    }
};
