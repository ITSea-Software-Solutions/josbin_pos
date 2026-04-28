<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Spatie permission tables default to bigint morph key.
     * We changed model_morph_key to 'model_uuid' so it accepts UUID strings.
     */
    public function up(): void
    {
        // config/permission.php already sets model_morph_key = 'model_uuid', so spatie's
        // own migration creates the tables with model_uuid from the start.
        // This migration only needs to run the ALTER if the old model_id column is still
        // present (e.g. on databases initialised before the config was updated).

        // spatie creates model_morph_key as unsignedBigInteger regardless of the column name.
        // We need it to be UUID type. Check the actual data type of the column.
        $morphColType = DB::selectOne(
            "SELECT data_type FROM information_schema.columns
             WHERE table_name = 'model_has_permissions' AND column_name = ?",
            [config('permission.column_names.model_morph_key', 'model_uuid')]
        );

        $needsFix = $morphColType && ! in_array($morphColType->data_type, ['uuid', 'character varying'], true);

        if (! $needsFix) {
            // Already uuid — nothing to do (handles re-runs and already-fixed DBs).
            return;
        }

        // Cast morph key column from bigint → uuid on both pivot tables.
        DB::statement('ALTER TABLE model_has_permissions DROP CONSTRAINT IF EXISTS model_has_permissions_pkey');
        DB::statement('DROP INDEX IF EXISTS model_has_permissions_model_id_model_type_index');
        DB::statement('ALTER TABLE model_has_permissions DROP COLUMN IF EXISTS model_id');
        DB::statement('ALTER TABLE model_has_permissions ALTER COLUMN model_uuid TYPE uuid USING model_uuid::text::uuid');
        DB::statement('ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_uuid, model_type)');
        DB::statement('CREATE INDEX IF NOT EXISTS model_has_permissions_model_uuid_model_type_index ON model_has_permissions (model_uuid, model_type)');

        DB::statement('ALTER TABLE model_has_roles DROP CONSTRAINT IF EXISTS model_has_roles_pkey');
        DB::statement('DROP INDEX IF EXISTS model_has_roles_model_id_model_type_index');
        DB::statement('ALTER TABLE model_has_roles DROP COLUMN IF EXISTS model_id');
        DB::statement('ALTER TABLE model_has_roles ALTER COLUMN model_uuid TYPE uuid USING model_uuid::text::uuid');
        DB::statement('ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_uuid, model_type)');
        DB::statement('CREATE INDEX IF NOT EXISTS model_has_roles_model_uuid_model_type_index ON model_has_roles (model_uuid, model_type)');
    }

    public function down(): void
    {
        // Not safely reversible
    }
};
