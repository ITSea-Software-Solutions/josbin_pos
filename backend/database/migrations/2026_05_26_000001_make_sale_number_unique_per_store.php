<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * sale_number was created with a GLOBAL unique constraint but
 * Sale::nextNumber() always allocates per-store (POS-YYYY-NNNNN scoped
 * to one store). Two stores opening on the same day both want
 * POS-2026-00001 — second store crashes with a unique violation on its
 * first sale. The intent is "unique within a store" so swap the index.
 *
 * Caught by tests/Feature/SaleRefundTest::manager_cannot_refund_another_orgs_sale,
 * which is the first multi-store scenario exercised end-to-end.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique('sales_sale_number_unique');
            $table->unique(['store_id', 'sale_number'], 'sales_store_sale_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropUnique('sales_store_sale_number_unique');
            $table->unique('sale_number', 'sales_sale_number_unique');
        });
    }
};
