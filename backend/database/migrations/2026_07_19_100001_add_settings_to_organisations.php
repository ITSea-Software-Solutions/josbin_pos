<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Organisation-level settings JSON — first tenant: payment_options
 * (wallets / card_banks / transfer_banks / mobile_apps pick-lists shown at
 * the POS). Unset keys fall back to the Suriname defaults in
 * config/josbin_pos.php, so existing organisations change nothing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organisations', function (Blueprint $table) {
            $table->jsonb('settings')->nullable()->after('subscription_tier');
        });
    }

    public function down(): void
    {
        Schema::table('organisations', function (Blueprint $table) {
            $table->dropColumn('settings');
        });
    }
};
