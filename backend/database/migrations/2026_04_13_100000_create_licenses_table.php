<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('licenses', function (Blueprint $table) {
            $table->uuid('id')->primary()->default(\Illuminate\Support\Facades\DB::raw('gen_random_uuid()'));
            $table->uuid('organisation_id')->index();
            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();

            // License key (stored hashed, compared with HMAC)
            $table->string('license_key_hash', 64)->unique(); // SHA-256 hex

            // Hardware fingerprint this license is bound to
            $table->string('hardware_mac',  64)->nullable();
            $table->string('hardware_cpu',  64)->nullable();
            $table->string('hardware_uuid', 64)->nullable();

            // Tier limits
            $table->string('tier', 30)->default('standard'); // standard | professional | enterprise
            $table->unsignedSmallInteger('max_stores')->default(1);
            $table->unsignedSmallInteger('max_terminals')->default(2);

            // Validity
            $table->date('valid_from');
            $table->date('valid_until');
            $table->boolean('is_active')->default(true);

            // Last successful validation from license server
            $table->timestamp('last_validated_at')->nullable();
            $table->string('last_validated_ip', 45)->nullable();

            // Grace period tracking
            // After license server is unreachable, we allow 72h of offline operation
            $table->timestamp('grace_period_ends_at')->nullable();
            $table->string('grace_reason', 255)->nullable();

            // Renewal status (drives dashboard banners)
            // null | warning_30 | warning_14 | grace | soft_lock | hard_lock
            $table->string('renewal_status', 20)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('licenses');
    }
};
