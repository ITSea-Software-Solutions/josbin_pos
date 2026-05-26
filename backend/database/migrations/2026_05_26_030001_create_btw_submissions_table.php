<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * btw_submissions — formal BTW (Suriname VAT) filings sent to Belastingdienst.
 *
 * One row per filing event. A daily filing covers `period_start == period_end`;
 * a monthly filing covers a full calendar month. Composite unique on
 * (organisation_id, period_type, period_start, period_end) blocks double-filing
 * the same period for the same org — the OA must `dispute → resubmit` flow if
 * a correction is needed (status='superseded' on the original, new row with
 * fresh status='filed').
 *
 * Totals are snapshotted at submission time (not recomputed on read) so the
 * inspector sees exactly what was claimed at the moment of filing, even if
 * sales for that day are later voided/refunded. Voided sales after-the-fact
 * trigger a 'superseded' workflow — never a silent recompute.
 *
 * `sale_ids` is a JSONB array of the sale UUIDs covered by the filing — gives
 * a Rekenkamer auditor full traceability from filing back to source sales.
 *
 * `prev_hash` / `current_hash` continue the immutable audit chain so the
 * submission record is tamper-evident (same pattern as audit_logs).
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::create('btw_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->uuid('organisation_id');
            $table->foreign('organisation_id')->references('id')->on('organisations')->cascadeOnDelete();

            // Nullable: NULL = consolidated org-wide filing across all stores.
            // Set = per-store filing (some orgs file each branch separately if
            // each branch has its own BTW number).
            $table->uuid('store_id')->nullable();
            $table->foreign('store_id')->references('id')->on('stores')->nullOnDelete();

            // 'daily' = period_start == period_end. 'monthly' = first→last of a
            // calendar month. We model both because Belastingdienst's formal
            // filing cycle is monthly but the product decision allows daily
            // submissions for high-volume / transparency-minded clients.
            $table->string('period_type', 16); // 'daily' | 'monthly'
            $table->date('period_start');
            $table->date('period_end');

            // Snapshotted totals at submission time. Never recomputed.
            $table->integer('sales_count')->default(0);
            $table->decimal('total_sales_srd',   12, 2)->default(0);
            $table->decimal('btw_exempt_srd',    12, 2)->default(0); // basisvoedsel + medicijnen
            $table->decimal('btw_taxable_srd',   12, 2)->default(0); // sales × non-zero BTW rate
            $table->decimal('total_btw_srd',     12, 2)->default(0); // BTW collected

            // Workflow status. Belastingdienst's tax_inspector flips filed →
            // accepted (formal acknowledgement) or disputed (with reason). The
            // OA can resubmit a corrected filing which marks the original
            // 'superseded' so the audit trail keeps both.
            $table->string('status', 16)->default('filed'); // filed | accepted | disputed | superseded

            $table->timestampTz('submitted_at');
            $table->uuid('submitted_by'); // the OA/SM who filed
            $table->foreign('submitted_by')->references('id')->on('users')->restrictOnDelete();

            $table->timestampTz('reviewed_at')->nullable();
            $table->uuid('reviewed_by')->nullable(); // the tax_inspector who accepted/disputed
            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();

            // Human-readable filing reference (BTW-2026-05-DEHOOPP-001 etc).
            // Auto-generated server-side at submission time, never user-editable.
            $table->string('reference', 64)->unique();

            // OA's optional note at submission time (e.g. "missing one register
            // close — included in next filing"). Tax inspector's note on
            // accept/dispute lives in inspector_note.
            $table->text('submitter_note')->nullable();
            $table->text('inspector_note')->nullable();

            // Full traceability: the sale UUIDs that rolled up into this
            // filing's totals. Lets a Rekenkamer audit walk back from a filing
            // to the source sales row-by-row.
            $table->jsonb('sale_ids')->default('[]');

            // Tamper-evident hash chain — same pattern as audit_logs.
            // current_hash = sha256(prev_hash || canonical_json_of_this_row).
            // Background command (php artisan btw:verify-chain) walks it.
            $table->text('prev_hash')->nullable();
            $table->text('current_hash')->nullable();

            $table->timestampsTz();

            // Idempotency: one filing per (org, period_type, period_start,
            // period_end). Resubmitting a corrected version must mark the
            // original as 'superseded' first (controller enforces).
            $table->unique(['organisation_id', 'period_type', 'period_start', 'period_end'], 'btw_subs_org_period_unique');

            $table->index(['organisation_id', 'period_start']);
            $table->index(['status', 'period_start']);
            $table->index('submitted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('btw_submissions');
    }
};
