<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Licenses — one row per customer organisation's Josbin POS license.
 *
 * The plain license key is shown to the developer company exactly once at
 * issuance; only its SHA-256 hash is stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('licenses', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('license_key_hash')->unique();
            $table->string('license_key_prefix');          // e.g. JOSBIN-AB12 — for display only

            $table->string('organisation_name');
            $table->string('contact_email')->nullable();

            $table->string('tier')->default('standard');   // basic | standard | enterprise
            $table->unsignedInteger('max_stores')->default(1);
            $table->unsignedInteger('max_terminals')->default(3);

            $table->date('valid_from');
            $table->date('valid_until');

            $table->boolean('is_active')->default(true);
            $table->timestampTz('revoked_at')->nullable();
            $table->string('revoked_reason')->nullable();

            $table->text('notes')->nullable();
            $table->timestampsTz();

            $table->index('is_active');
            $table->index('valid_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('licenses');
    }
};
