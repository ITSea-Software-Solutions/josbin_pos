<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Platform-wide key/value settings store.
 *
 * Used for policy settings the Super Admin configures at runtime that are not
 * tied to a single organisation or store — e.g. which roles must use 2FA.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->jsonb('value')->nullable();
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
