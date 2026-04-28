<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organisation_id');

            // WBP-S compliance: personal data encrypted at application layer
            // Raw DB values are unreadable ciphertext (AES-256 via Laravel Crypt)
            $table->text('name');           // encrypted
            $table->text('phone')->nullable();  // encrypted
            $table->text('email')->nullable();  // encrypted
            $table->text('id_number')->nullable();  // encrypted — national ID / KvK

            // Hashed versions for searching (SHA-256 HMAC — not reversible, for lookup only)
            $table->string('name_hash')->nullable();
            $table->string('phone_hash')->nullable();

            // Aggregate fields — not encrypted (no PII)
            $table->decimal('total_spend_srd', 12, 2)->default(0);
            $table->unsignedInteger('visit_count')->default(0);

            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('organisation_id')
                ->references('id')
                ->on('organisations')
                ->cascadeOnDelete();

            $table->index('organisation_id');
            $table->index('name_hash');
            $table->index('phone_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
