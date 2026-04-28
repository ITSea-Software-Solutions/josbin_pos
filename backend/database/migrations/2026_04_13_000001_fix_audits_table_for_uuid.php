<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The owen-it/laravel-auditing migration creates user_id and auditable_id
     * as bigint. All our models use UUID PKs, so both columns must become text
     * (nullable uuid-as-text) to store uuid values from any auditable model.
     */
    public function up(): void
    {
        // Drop the existing index on auditable
        DB::statement('DROP INDEX IF EXISTS audits_auditable_type_auditable_id_index');
        DB::statement('DROP INDEX IF EXISTS audits_user_id_user_type_index');

        // Change auditable_id from bigint to text (holds uuid strings)
        DB::statement('ALTER TABLE audits ALTER COLUMN auditable_id TYPE text USING auditable_id::text');

        // Change user_id from bigint to text (nullable – system events have no user)
        DB::statement('ALTER TABLE audits ALTER COLUMN user_id TYPE text USING user_id::text');

        // Recreate indexes
        DB::statement('CREATE INDEX audits_auditable_type_auditable_id_index ON audits (auditable_type, auditable_id)');
        DB::statement('CREATE INDEX audits_user_id_user_type_index ON audits (user_id, user_type)');
    }

    public function down(): void
    {
        // Not safely reversible once uuid data is written
    }
};
