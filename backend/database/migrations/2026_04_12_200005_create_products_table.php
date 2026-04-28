<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organisation_id');
            $table->uuid('category_id')->nullable();
            $table->string('name_nl');
            $table->string('name_en');
            $table->string('barcode')->nullable();
            $table->decimal('price', 12, 2);                // SRD
            $table->decimal('btw_rate', 5, 2)->default(10.00);
            $table->boolean('btw_exempt')->default(false);
            $table->decimal('stock_qty', 10, 3)->default(0);
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->foreign('organisation_id')
                ->references('id')
                ->on('organisations')
                ->cascadeOnDelete();

            $table->foreign('category_id')
                ->references('id')
                ->on('categories')
                ->nullOnDelete();

            // Barcode lookup must be fast (< 100ms per SPOS-203)
            $table->index(['organisation_id', 'barcode']);
            $table->index(['organisation_id', 'category_id', 'is_active']);
        });

        // pgvector column for AI semantic search embeddings (1536 dims = OpenAI text-embedding-3-small)
        // Cannot add via Blueprint — use raw SQL
        DB::statement('ALTER TABLE products ADD COLUMN embedding vector(1536)');

        // IVFFlat index for approximate nearest-neighbour search
        // Created after data is loaded (empty table index is useless)
        // We create it here as a placeholder; production: recreate after initial import
        DB::statement('CREATE INDEX products_embedding_idx ON products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)');
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
