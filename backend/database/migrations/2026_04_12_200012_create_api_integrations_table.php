<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_integrations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('store_id');
            $table->string('pos_system');              // name of third-party POS
            $table->string('api_key_hash');            // hashed API key (never stored plain)
            $table->string('webhook_url')->nullable();
            $table->json('webhook_events')->nullable(); // ['sale.created', 'shift.closed', ...]
            $table->timestampTz('last_ping_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('settings')->nullable();
            $table->timestampsTz();

            $table->foreign('store_id')->references('id')->on('stores')->cascadeOnDelete();
            $table->index('store_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_integrations');
    }
};
