<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Encrypt existing plaintext api_integrations.webhook_secret values, now that
 * the model casts the column as 'encrypted'.
 *
 * Two steps:
 *   1. Widen the column — a 64-char hex secret becomes a ~200+ char Laravel
 *      ciphertext payload, which overflows the original varchar(64).
 *   2. Encrypt existing plaintext rows in place.
 *
 * Idempotent: a value that already decrypts cleanly is left untouched.
 * Reads/writes via the query builder so the Eloquent cast does NOT fire
 * (reading a plaintext row through the cast would throw DecryptException).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Widen to TEXT so ciphertext fits.
        DB::statement('ALTER TABLE api_integrations ALTER COLUMN webhook_secret TYPE text');

        // 2. Encrypt existing plaintext rows.
        DB::table('api_integrations')
            ->whereNotNull('webhook_secret')
            ->orderBy('id')
            ->each(function ($row) {
                try {
                    Crypt::decryptString($row->webhook_secret);
                    return; // already encrypted
                } catch (\Throwable $e) {
                    // plaintext — encrypt in place
                }

                DB::table('api_integrations')
                    ->where('id', $row->id)
                    ->update(['webhook_secret' => Crypt::encryptString($row->webhook_secret)]);
            });
    }

    public function down(): void
    {
        // Decrypt back to plaintext so the column is readable without the cast.
        DB::table('api_integrations')
            ->whereNotNull('webhook_secret')
            ->orderBy('id')
            ->each(function ($row) {
                try {
                    $plain = Crypt::decryptString($row->webhook_secret);
                } catch (\Throwable $e) {
                    return; // already plaintext
                }
                DB::table('api_integrations')
                    ->where('id', $row->id)
                    ->update(['webhook_secret' => $plain]);
            });

        // Restore the original narrow column (64-char hex secrets fit exactly).
        DB::statement('ALTER TABLE api_integrations ALTER COLUMN webhook_secret TYPE varchar(64)');
    }
};
