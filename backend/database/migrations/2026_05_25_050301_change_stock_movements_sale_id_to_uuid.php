<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * stock_movements.sale_id was created as bigInteger but sales.id is uuid.
 * Every real production sale would fail to record a stock movement
 * (PDOException: invalid input syntax for type bigint).
 *
 * Drop and re-add as uuid with the correct foreign key to sales.id.
 * sale_id is nullable, and the only rows in the table today have NULL there
 * (DemoSeeder workaround), so no data is lost.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex('stock_sale_idx');
            $table->dropColumn('sale_id');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->uuid('sale_id')->nullable()->after('reason');
            $table->foreign('sale_id')->references('id')->on('sales')->nullOnDelete();
            $table->index('sale_id', 'stock_sale_idx');
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['sale_id']);
            $table->dropIndex('stock_sale_idx');
            $table->dropColumn('sale_id');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->bigInteger('sale_id')->unsigned()->nullable()->after('reason');
            $table->index('sale_id', 'stock_sale_idx');
        });
    }
};
