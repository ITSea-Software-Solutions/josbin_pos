<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Schema-hardening batch from the 2026-07-19 database audit:
 *
 *  1. Covering indexes for 21 FK columns that had none — Postgres does not
 *     auto-index FK columns, so per-bank/per-user/per-store lookups and
 *     ON DELETE checks on these were sequential scans.
 *  2. Financial history must survive parent deletion: z_reports,
 *     register_sessions and cash_movements cascaded away when their store /
 *     register / user row was hard-deleted. Sales were already RESTRICT —
 *     these now match. (App flows soft-delete stores, so this is a safety
 *     net, not a behaviour change.)
 *  3. audit_logs becomes append-only AT THE DATABASE LEVEL: triggers reject
 *     UPDATE, DELETE and TRUNCATE, matching the audit-trail guarantees in
 *     the security documentation. Application code only ever inserts.
 */
return new class extends Migration
{
    /** FK columns → index, grouped per table. */
    private const FK_INDEXES = [
        'role_has_permissions'    => ['role_id'],
        'products'                => ['category_id'],
        'daily_rates'             => ['locked_by'],
        'sales'                   => ['customer_id', 'payment_confirmed_by', 'void_approved_by', 'voided_by'],
        'held_bills'              => ['cashier_id', 'customer_id'],
        'z_reports'               => ['closed_by'],
        'store_product_overrides' => ['product_id'],
        'stock_movements'         => ['organisation_id'],
        'discount_rules'          => ['store_id'],
        'register_sessions'       => ['cleared_by', 'reopen_approved_by', 'reopen_requested_by'],
        'btw_submissions'         => ['reviewed_by', 'store_id', 'submitted_by'],
        'cash_movements'          => ['store_id', 'user_id'],
    ];

    /** table → [constraint, column, referenced table] to retarget CASCADE → RESTRICT. */
    private const RESTRICT_FKS = [
        ['z_reports',         'z_reports_store_id_foreign',                 'store_id',            'stores'],
        ['register_sessions', 'register_sessions_cashier_id_foreign',       'cashier_id',          'users'],
        ['register_sessions', 'register_sessions_register_id_foreign',      'register_id',         'registers'],
        ['register_sessions', 'register_sessions_store_id_foreign',         'store_id',            'stores'],
        ['cash_movements',    'cash_movements_register_session_id_foreign', 'register_session_id', 'register_sessions'],
        ['cash_movements',    'cash_movements_store_id_foreign',            'store_id',            'stores'],
        ['cash_movements',    'cash_movements_user_id_foreign',             'user_id',             'users'],
    ];

    public function up(): void
    {
        foreach (self::FK_INDEXES as $table => $columns) {
            Schema::table($table, function (Blueprint $t) use ($columns) {
                foreach ($columns as $col) {
                    $t->index($col);
                }
            });
        }

        foreach (self::RESTRICT_FKS as [$table, $constraint, $column, $refTable]) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$constraint}");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} FOREIGN KEY ({$column}) REFERENCES {$refTable} (id) ON DELETE RESTRICT");
        }

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    -- The ONE legitimate update: the hash-chain service stamps
                    -- row_hash / previous_row_hash / organisation_id onto a
                    -- freshly inserted row (row_hash still NULL) without
                    -- touching any payload column. Everything else is tampering.
                    IF OLD.row_hash IS NULL
                       AND (to_jsonb(OLD) - 'row_hash' - 'previous_row_hash' - 'organisation_id')
                         = (to_jsonb(NEW) - 'row_hash' - 'previous_row_hash' - 'organisation_id')
                    THEN
                        RETURN NEW;
                    END IF;
                    RAISE EXCEPTION 'audit_logs is append-only: UPDATE beyond initial hash stamping is not allowed';
                END IF;
                RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
            CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
            CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
                FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();
        SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            DROP TRIGGER IF EXISTS audit_logs_no_update   ON audit_logs;
            DROP TRIGGER IF EXISTS audit_logs_no_delete   ON audit_logs;
            DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
            DROP FUNCTION IF EXISTS audit_logs_block_mutation();
        SQL);

        foreach (self::RESTRICT_FKS as [$table, $constraint, $column, $refTable]) {
            DB::statement("ALTER TABLE {$table} DROP CONSTRAINT {$constraint}");
            DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$constraint} FOREIGN KEY ({$column}) REFERENCES {$refTable} (id) ON DELETE CASCADE");
        }

        foreach (self::FK_INDEXES as $table => $columns) {
            Schema::table($table, function (Blueprint $t) use ($columns) {
                foreach ($columns as $col) {
                    $t->dropIndex([$col]);
                }
            });
        }
    }
};
