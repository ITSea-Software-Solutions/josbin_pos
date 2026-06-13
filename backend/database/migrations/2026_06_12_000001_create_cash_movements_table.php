<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Manual cash drawer movements during a shift — "pay-in" (cash added to the
 * drawer, e.g. a change top-up) and "pay-out" (cash removed, e.g. paying a
 * supplier or a delivery driver out of the till). These adjust the register's
 * expected cash at Z-Report time so the reconciliation stays honest.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('register_session_id')->constrained('register_sessions')->cascadeOnDelete();
            $table->foreignUuid('store_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();

            // 'in'  = cash added to the drawer (increases expected cash)
            // 'out' = cash removed from the drawer (decreases expected cash)
            $table->string('direction', 3);
            $table->decimal('amount', 12, 2);   // always positive; direction carries the sign
            $table->string('reason', 255);

            $table->timestampTz('created_at');

            $table->index(['register_session_id', 'created_at']);
        });

        // amount must be > 0 — the direction column carries the sign, never the value.
        DB::statement('ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_amount_positive CHECK (amount > 0)');
        DB::statement("ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_direction_valid CHECK (direction IN ('in','out'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_movements');
    }
};
