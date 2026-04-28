<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add a dedicated webhook_secret to api_integrations.
 *
 * Separate from api_key_hash (which authenticates inbound API calls).
 * webhook_secret is used to sign outbound webhook payloads:
 *   X-JosbinPOS-Signature: sha256=HMAC-SHA256(body, webhook_secret)
 *
 * Existing rows get a randomly generated secret on migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_integrations', function (Blueprint $table) {
            $table->string('webhook_secret', 64)->nullable()->after('webhook_events');
        });

        // Backfill existing rows with a random secret
        \Illuminate\Support\Facades\DB::table('api_integrations')
            ->whereNull('webhook_secret')
            ->get(['id'])
            ->each(function ($row) {
                \Illuminate\Support\Facades\DB::table('api_integrations')
                    ->where('id', $row->id)
                    ->update(['webhook_secret' => bin2hex(random_bytes(32))]);
            });
    }

    public function down(): void
    {
        Schema::table('api_integrations', function (Blueprint $table) {
            $table->dropColumn('webhook_secret');
        });
    }
};
