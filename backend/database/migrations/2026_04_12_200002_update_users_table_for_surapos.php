<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Convert id to UUID (drop & recreate — migration order ensures users table exists)
            $table->uuid('organisation_id')->nullable()->after('id');
            $table->enum('role', [
                'super_admin',
                'organisation_admin',
                'store_manager',
                'cashier',
                'auditor',
                'api_integration',
            ])->default('cashier')->after('email');
            $table->enum('locale', ['nl', 'en'])->default('nl')->after('role');
            $table->json('passkey_credential')->nullable()->after('remember_token');
            $table->timestampTz('last_login_at')->nullable()->after('passkey_credential');
            $table->boolean('is_active')->default(true)->after('last_login_at');
            // bcrypt cost 12 is set via config — column is already in users table

            $table->foreign('organisation_id')
                ->references('id')
                ->on('organisations')
                ->nullOnDelete();

            $table->index('organisation_id');
            $table->index('role');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['organisation_id']);
            $table->dropColumn([
                'organisation_id', 'role', 'locale',
                'passkey_credential', 'last_login_at', 'is_active',
            ]);
        });
    }
};
