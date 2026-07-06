<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Z-Reports historically persisted only cash_total_srd + card_total_srd, so
 * the 7-day history and the record submitted to HQ silently dropped mixed /
 * bank_transfer / mobile_transfer / foreign_cash / qr_payment revenue — on a
 * QR-heavy day (Mopé / Uni5Pay+) the persisted breakdown no longer summed to
 * total_sales_srd. Adds the five missing method totals; existing rows default
 * to 0.00 (historically accurate: the methods post-date those closes or the
 * data can be rebuilt from sales if ever needed).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('z_reports', function (Blueprint $table) {
            $table->decimal('mixed_total_srd', 12, 2)->default(0)->after('card_total_srd');
            $table->decimal('bank_transfer_total_srd', 12, 2)->default(0)->after('mixed_total_srd');
            $table->decimal('mobile_transfer_total_srd', 12, 2)->default(0)->after('bank_transfer_total_srd');
            $table->decimal('foreign_cash_total_srd', 12, 2)->default(0)->after('mobile_transfer_total_srd');
            $table->decimal('qr_payment_total_srd', 12, 2)->default(0)->after('foreign_cash_total_srd');
        });
    }

    public function down(): void
    {
        Schema::table('z_reports', function (Blueprint $table) {
            $table->dropColumn([
                'mixed_total_srd', 'bank_transfer_total_srd', 'mobile_transfer_total_srd',
                'foreign_cash_total_srd', 'qr_payment_total_srd',
            ]);
        });
    }
};
