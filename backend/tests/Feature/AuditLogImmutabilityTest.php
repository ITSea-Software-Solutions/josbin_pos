<?php

namespace Tests\Feature;

use App\Models\Organisation;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * audit_logs is append-only at the DATABASE level: triggers reject UPDATE,
 * DELETE and TRUNCATE. The single permitted transition is the hash-chain
 * service stamping row_hash / previous_row_hash / organisation_id onto a
 * freshly inserted row — which every audited action below exercises.
 */
class AuditLogImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    private function auditedRow(): object
    {
        $org = Organisation::create([
            'name' => 'Immutable Org', 'type' => 'retail', 'btw_number' => 'SR-IMM',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'starter', 'is_active' => true,
        ]);

        \App\Models\AuditLog::create([
            'user_id' => null, 'organisation_id' => $org->id,
            'event' => 'immutability.probe', 'auditable_type' => 'system', 'auditable_id' => 'system',
            'old_values' => null, 'new_values' => ['k' => 'v'],
            'ip_address' => null, 'created_at' => now(),
        ]);

        return DB::table('audit_logs')->orderByDesc('id')->first();
    }

    public function test_hash_stamping_still_works_with_the_guard_active(): void
    {
        $row = $this->auditedRow();
        $this->assertNotNull($row, 'audited create should insert an audit row');
        $this->assertNotNull($row->row_hash, 'hash chain must stamp the fresh row (allowed transition)');
    }

    public function test_payload_update_is_rejected_by_the_database(): void
    {
        $row = $this->auditedRow();

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('append-only');
        DB::table('audit_logs')->where('id', $row->id)->update(['event' => 'tampered']);
    }

    public function test_delete_is_rejected_by_the_database(): void
    {
        $row = $this->auditedRow();

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('append-only');
        DB::table('audit_logs')->where('id', $row->id)->delete();
    }

    public function test_rewriting_an_existing_hash_is_rejected(): void
    {
        $row = $this->auditedRow();
        $this->assertNotNull($row->row_hash);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('append-only');
        DB::table('audit_logs')->where('id', $row->id)->update(['row_hash' => str_repeat('0', 64)]);
    }
}
