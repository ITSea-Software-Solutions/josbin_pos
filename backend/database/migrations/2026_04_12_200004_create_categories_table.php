<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organisation_id');
            $table->string('name_nl');
            $table->string('name_en');
            $table->string('icon')->nullable();   // emoji or icon class
            $table->string('color')->nullable();  // hex color for UI
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();

            $table->foreign('organisation_id')
                ->references('id')
                ->on('organisations')
                ->cascadeOnDelete();

            $table->index(['organisation_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
