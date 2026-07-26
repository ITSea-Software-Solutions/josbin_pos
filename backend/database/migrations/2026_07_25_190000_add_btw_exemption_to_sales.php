<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sale-level BTW exemption (vrijstelling) — government departments and other
 * exempt buyers pay the price WITHOUT the BTW component. The reason is
 * mandatory: Belastingdienst will ask why a sale carried no BTW, so the
 * answer must live on the sale itself, not in someone's memory.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->boolean('btw_exempt')->default(false)->after('btw_srd');
            $table->string('btw_exempt_reason', 500)->nullable()->after('btw_exempt');
            // What the BTW WOULD have been without the exemption — computed
            // from the same cart at sale time, so the exemptions report can
            // state the forgone amount even after product prices change.
            $table->decimal('btw_exempt_forgone_srd', 12, 2)->nullable()->after('btw_exempt_reason');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn(['btw_exempt', 'btw_exempt_reason', 'btw_exempt_forgone_srd']);
        });
    }
};
