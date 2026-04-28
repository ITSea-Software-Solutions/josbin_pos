<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organisations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->enum('type', ['retail', 'govt', 'wholesale'])->default('retail');
            $table->string('btw_number')->nullable();
            $table->string('currency', 3)->default('SRD');
            $table->enum('locale', ['nl', 'en'])->default('nl');
            $table->boolean('is_government')->default(false);
            $table->string('subscription_tier')->default('standard');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organisations');
    }
};
