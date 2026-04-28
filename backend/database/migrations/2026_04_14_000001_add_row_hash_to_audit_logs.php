<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add SHA-256 hash chain to audits.
 *
 * Each row stores a hash of (its own data + the previous row's hash),
 * forming an unbreakable chain. Any deletion or modification of a row
 * breaks the chain from that point forward — detectable by the
 * `php artisan audit:verify` command.
 *
 * previous_row_hash: the row_hash of the immediately preceding row for
 *   the same organisation_id (NULL for the first row per org).
 * row_hash: SHA-256(org_id|event|auditable_type|auditable_id|new_values|created_at|previous_row_hash)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            // organisation_id is not part of spatie's default audits table —
            // add it here so we can scope the hash chain per org.
            if (! Schema::hasColumn('audit_logs', 'organisation_id')) {
                $table->uuid('organisation_id')->nullable()->after('tags');
                $table->index('organisation_id', 'audit_logs_organisation_id_index');
            }

            $table->string('previous_row_hash', 64)->nullable()->after('updated_at');
            $table->string('row_hash', 64)->nullable()->after('previous_row_hash');

            // Index for fast chain traversal per organisation
            $table->index(['organisation_id', 'created_at'], 'audit_chain_idx');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_chain_idx');
            $table->dropIndex('audit_logs_organisation_id_index');
            $table->dropColumn(['previous_row_hash', 'row_hash', 'organisation_id']);
        });
    }
};
