<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * License activations — one row per physical Josbin POS installation
 * (back-office server / terminal) bound to a license.
 *
 * Hardware fingerprint = SHA-256(mac + cpu id + installation uuid).
 * The count of active activations is checked against licenses.max_terminals.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('license_activations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('license_id');

            // Per-installation token — the POS sends this on every /api/validate call.
            $table->string('installation_key')->unique();

            // Hardware fingerprint components (MAC + CPU ID + installation UUID).
            $table->string('hardware_mac')->nullable();
            $table->string('hardware_cpu')->nullable();
            $table->string('hardware_uuid')->nullable();
            $table->string('hardware_fingerprint')->nullable();

            $table->string('hostname')->nullable();
            $table->string('last_ip')->nullable();
            $table->timestampTz('last_validated_at')->nullable();
            $table->timestampTz('activated_at');

            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->foreign('license_id')->references('id')->on('licenses')->cascadeOnDelete();
            $table->index(['license_id', 'is_active']);
            $table->index('hardware_fingerprint');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('license_activations');
    }
};
