<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\User;
use App\Services\AuditHashService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Batch A — the whole audit log must be verifiable, not just the subset of
 * rows our AuditLog model wrote:
 *   - OwenIt model-audits (Product/User updates) are sealed into the chain on
 *     insert (no more silent NULL-hash gaps).
 *   - A NULL-hash row is flagged by the verifier (no vacuous pass).
 *   - The platform (org NULL) partition is a real linked chain.
 *   - User password / secrets never land in audit new_values.
 */
class AuditChainCompletenessTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;

    protected function setUp(): void
    {
        parent::setUp();

        // OwenIt skips auditing under `php artisan` (incl. PHPUnit) unless this
        // is on. Production runs auditing in the web context, so enable it here
        // to exercise the same OwenIt → Audited-listener → sealRow path.
        config(['audit.console' => true]);

        $this->org = Organisation::create([
            'name' => 'Chain Org', 'type' => 'retail', 'btw_number' => 'SR-CHAIN',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
    }

    public function test_owenit_model_audit_is_hash_chained_on_insert(): void
    {
        $cat = Category::create(['organisation_id' => $this->org->id, 'name_nl' => 'C', 'name_en' => 'C', 'is_active' => true]);
        $product = Product::create([
            'organisation_id' => $this->org->id, 'category_id' => $cat->id,
            'name_nl' => 'Rijst', 'name_en' => 'Rice', 'price' => '5.00',
            'btw_rate' => '10', 'btw_exempt' => false, 'stock_qty' => 100,
        ]);

        // OwenIt writes a 'created' audit; updating writes an 'updated' audit.
        $product->update(['price' => '6.00']);

        // Every audit_logs row for this org must carry a hash (none skipped).
        $nullHash = DB::table('audit_logs')
            ->where('organisation_id', $this->org->id)
            ->whereNull('row_hash')
            ->count();
        $this->assertSame(0, $nullHash, 'OwenIt model-audits must be sealed into the chain, not left hash-less.');

        $result = app(AuditHashService::class)->verifyChain($this->org->id);
        $this->assertTrue($result['valid'], 'Chain incl. model-audits must verify: ' . ($result['message'] ?? ''));
        // At least the model-audit(s) for this product are attributed to the
        // org's chain (not dumped into the platform partition).
        $this->assertGreaterThanOrEqual(1, $result['checked']);
    }

    public function test_verifier_flags_a_hashless_row_instead_of_passing(): void
    {
        // Simulate a rogue/legacy raw insert that bypassed the model
        // (audit_logs.id is an auto-increment bigint — let the DB assign it).
        DB::table('audit_logs')->insert([
            'organisation_id' => $this->org->id,
            'event'           => 'rogue.raw_insert',
            'auditable_type'  => 'system',
            'auditable_id'    => 'x',
            'old_values'      => null,
            'new_values'      => json_encode(['x' => 1]),
            'ip_address'      => null,
            'row_hash'        => null,
            'previous_row_hash' => null,
            'created_at'      => now(),
        ]);

        $result = app(AuditHashService::class)->verifyChain($this->org->id);
        $this->assertFalse($result['valid'], 'A NULL-hash row must be reported, not silently skipped.');
    }

    public function test_password_and_secrets_never_enter_audit_values(): void
    {
        $u = User::create([
            'name' => 'Audit U', 'email' => 'audit-u@test.sr', 'password' => bcrypt('secret-pw'),
            'organisation_id' => $this->org->id, 'role' => User::ROLE_CASHIER,
            'store_id' => null, 'locale' => 'nl', 'is_active' => true,
        ]);
        $u->update(['name' => 'Renamed']);

        $values = DB::table('audit_logs')
            ->where('auditable_type', 'like', '%User')
            ->pluck('new_values')
            ->implode(' ') . DB::table('audit_logs')->where('auditable_type', 'like', '%User')->pluck('old_values')->implode(' ');

        $this->assertStringNotContainsString('$2y$', $values, 'bcrypt hash must never be written to the audit log.');
        $this->assertStringNotContainsString('password', $values, 'password field must be excluded from audit values.');
    }

    public function test_platform_partition_is_a_linked_chain(): void
    {
        // Two platform (null-org) events must chain to each other, not both be genesis.
        AuditLog::create(['user_id' => null, 'organisation_id' => null, 'event' => 'sys.a', 'auditable_type' => 'system', 'auditable_id' => 'a', 'old_values' => null, 'new_values' => ['n' => 1], 'ip_address' => null, 'created_at' => now()]);
        AuditLog::create(['user_id' => null, 'organisation_id' => null, 'event' => 'sys.b', 'auditable_type' => 'system', 'auditable_id' => 'b', 'old_values' => null, 'new_values' => ['n' => 2], 'ip_address' => null, 'created_at' => now()]);

        $rows = DB::table('audit_logs')->whereNull('organisation_id')->orderBy('id')->get();
        $this->assertGreaterThanOrEqual(2, $rows->count());
        $second = $rows->last();
        $this->assertNotNull($second->previous_row_hash, 'Second platform row must link to the first (not a genesis block).');

        $this->assertTrue(app(AuditHashService::class)->verifyChain(null)['valid']);
    }
}
