<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('organisation_id')->constrained()->cascadeOnDelete();
            $table->date('week_start');
            $table->string('locale', 5)->default('nl');
            $table->text('narrative')->nullable();
            $table->jsonb('stats')->nullable();
            $table->timestamps();

            $table->unique(['organisation_id', 'week_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_summaries');
    }
};
