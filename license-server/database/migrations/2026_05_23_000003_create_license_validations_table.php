<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * License validations — an append-only log of every /api/validate call.
 * Gives the developer company an audit trail of where and when each
 * installation phoned home, and what status it was told.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('license_validations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('license_id')->nullable();
            $table->uuid('activation_id')->nullable();
            $table->string('installation_key_prefix')->nullable(); // first chars only — never the full key
            $table->string('status_returned');
            $table->boolean('hardware_match')->nullable();
            $table->string('ip')->nullable();
            $table->string('hostname')->nullable();
            $table->timestampTz('created_at')->nullable();

            $table->index('license_id');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('license_validations');
    }
};
