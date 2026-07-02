<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * external_sale_ref was created with a GLOBAL unique constraint and the Layer-3
 * (Open Integration API) idempotency lookup scoped only by `store_id`. Two
 * DIFFERENT api integrations reusing the same `sale_ref` for the same store
 * collided: the retrying integrator got back ANOTHER vendor's sale, silently
 * losing a transaction and corrupting BTW.
 *
 * Fix: idempotency is per-integration. We
 *   1. add nullable `api_integration_id` on sales (FK), stamped on API-sourced
 *      creates so every sale records which integration produced it,
 *   2. drop the global unique on `external_sale_ref`,
 *   3. add a composite PARTIAL unique on (api_integration_id, external_sale_ref)
 *      WHERE external_sale_ref IS NOT NULL — so a retry from the SAME integration
 *      is idempotent, and a different integration's same ref does NOT collide.
 *
 * POS-sourced sales (api_integration_id NULL, external_sale_ref NULL) are
 * excluded by the partial predicate, so they never contend on this index.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->uuid('api_integration_id')->nullable()->after('external_sale_ref');
            $table->foreign('api_integration_id')->references('id')->on('api_integrations')->nullOnDelete();
        });

        Schema::table('sales', function (Blueprint $table) {
            // Drop the global unique — idempotency is now per-integration.
            $table->dropUnique('sales_external_sale_ref_unique');
        });

        // Composite partial unique: one external_sale_ref per api_integration.
        // Partial (WHERE … IS NOT NULL) so native POS rows — where both columns
        // are null — are excluded and never contend.
        \DB::statement(
            'CREATE UNIQUE INDEX sales_integration_external_ref_unique '
            . 'ON sales (api_integration_id, external_sale_ref) '
            . 'WHERE external_sale_ref IS NOT NULL'
        );
    }

    public function down(): void
    {
        \DB::statement('DROP INDEX IF EXISTS sales_integration_external_ref_unique');

        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['api_integration_id']);
            $table->dropColumn('api_integration_id');
            $table->unique('external_sale_ref', 'sales_external_sale_ref_unique');
        });
    }
};
