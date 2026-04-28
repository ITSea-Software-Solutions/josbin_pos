<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Laravel's default users table uses bigint id.
     * Josbin POS uses UUID on all main tables.
     * We recreate the users table with uuid primary key before any FK references.
     */
    public function up(): void
    {
        // Drop tables that depend on users.id (created by earlier vendor migrations)
        DB::statement('ALTER TABLE personal_access_tokens DROP CONSTRAINT IF EXISTS personal_access_tokens_tokenable_id_foreign');
        DB::statement('ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_foreign');

        // Recreate users table with uuid primary key
        DB::statement('ALTER TABLE users DROP CONSTRAINT users_pkey');
        DB::statement('ALTER TABLE users ALTER COLUMN id DROP DEFAULT');
        DB::statement('ALTER TABLE users ALTER COLUMN id TYPE uuid USING (gen_random_uuid())');
        DB::statement("ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()");
        DB::statement('ALTER TABLE users ADD PRIMARY KEY (id)');

        // Fix personal_access_tokens tokenable_id type if it exists
        DB::statement('ALTER TABLE personal_access_tokens ALTER COLUMN tokenable_id TYPE text');
    }

    public function down(): void
    {
        // Not safely reversible — would lose existing data
    }
};
