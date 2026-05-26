<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Task #80 — make the (org, period_type, period_start, period_end) uniqueness
 * on `btw_submissions` exclude `superseded` rows so resubmissions can land.
 *
 * Original migration (`2026_05_26_030001_create_btw_submissions_table.php`)
 * defined a plain UNIQUE constraint covering every status, which meant a
 * second filing for the same period (even after the first is marked
 * 'superseded') hit a uniqueness violation.
 *
 * Replace with a partial unique INDEX that only enforces uniqueness on
 * non-superseded rows. Postgres-only — fine, since the rest of the stack is
 * Postgres-only anyway.
 */
return new class extends Migration {
    public function up(): void
    {
        if (config('database.default') !== 'pgsql') {
            return;
        }

        // The original Schema::unique() created a named UNIQUE constraint
        // (not an INDEX). Drop it before creating the partial index.
        DB::statement('ALTER TABLE btw_submissions DROP CONSTRAINT IF EXISTS btw_subs_org_period_unique');

        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX btw_subs_active_period_unique
            ON btw_submissions (organisation_id, period_type, period_start, period_end)
            WHERE status <> 'superseded'
        SQL);
    }

    public function down(): void
    {
        if (config('database.default') !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS btw_subs_active_period_unique');

        // Restore the broad UNIQUE (will fail if any duplicates exist after
        // resubmissions — caller's job to clean up first).
        DB::statement('ALTER TABLE btw_submissions ADD CONSTRAINT btw_subs_org_period_unique UNIQUE (organisation_id, period_type, period_start, period_end)');
    }
};
