<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Passkey (WebAuthn) credentials for dashboard sign-in — laravel/passkeys.
 *
 * Own migration instead of the published vendor one: the vendor stub is
 * dated 2024 (sorts before our users table exists) and assumes bigint user
 * ids; users.id is a UUID here. Cascade on user delete is intentional —
 * a credential has no meaning without its user (unlike financial rows,
 * which RESTRICT).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('passkeys', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('credential_id')->unique();
            $table->jsonb('credential');
            $table->timestampTz('last_used_at')->nullable();
            $table->timestampsTz();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('passkeys');
    }
};
