<?php

namespace Tests\Feature;

use App\Models\BtwSubmission;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use App\Services\AuditHashService;
use App\Services\BtwSubmissionService;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Batch 2 — compliance correctness.
 *
 *  P1-C1  BTW exempt revenue is split from sale_items.btw_exempt, not the
 *         sale-level "btw_srd == 0" proxy. A mixed basket (one exempt + one
 *         taxable line) must report only the exempt line as exempt.
 *  P0-4   The BTW submission hash chain is per-organisation: org B filing a
 *         return must NOT become a link in org A's chain.
 *  P0-10  Audit-log writes that previously used raw DB::table()->insert()
 *         (login, BTW submit/accept) now go through AuditLog::create, so the
 *         per-org SHA-256 chain stays continuous and verifyChain() passes.
 */
class ComplianceIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $orgA;
    private Organisation $orgB;
    private Store $storeA;
    private Store $storeB;
    private User $oaA;
    private User $oaB;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->orgA = Organisation::create([
            'name' => 'Alpha Supermarkt', 'type' => 'retail',
            'btw_number' => 'BTW-SR-ALPHA', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->orgB = Organisation::create([
            'name' => 'Beta Wholesale', 'type' => 'wholesale',
            'btw_number' => 'BTW-SR-BETA', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $this->storeA = Store::create([
            'organisation_id' => $this->orgA->id, 'name' => 'Alpha Paramaribo',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->storeB = Store::create([
            'organisation_id' => $this->orgB->id, 'name' => 'Beta Nickerie',
            'city' => 'Nickerie', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->oaA = User::create([
            'name' => 'OA Alpha', 'email' => 'oa-a@compliance.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->orgA->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oaA->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->oaB = User::create([
            'name' => 'OA Beta', 'email' => 'oa-b@compliance.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->orgB->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oaB->assignRole(User::ROLE_ORGANISATION_ADMIN);
    }

    /** Make a sale with explicit line items so the exempt split has data. */
    private function makeSaleWithItems(Store $store, array $lines, Carbon $when): Sale
    {
        $subtotal = '0.00';
        $btw      = '0.00';
        foreach ($lines as $l) {
            $subtotal = bcadd($subtotal, $l['line_total'], 2);
            $btw      = bcadd($btw, $l['btw'], 2);
        }

        $sale = Sale::create([
            'store_id' => $store->id, 'cashier_id' => $this->oaA->id,
            'sale_number' => Sale::nextNumber($store->id),
            'subtotal_srd' => $subtotal, 'discount_srd' => '0.00',
            'btw_srd' => $btw, 'total_srd' => $subtotal,
            'payment_method' => 'cash', 'status' => 'completed',
            'source' => 'pos', 'occurred_at' => $when,
        ]);

        foreach ($lines as $l) {
            SaleItem::create([
                'sale_id' => $sale->id,
                'product_name_snapshot' => $l['name'],
                'unit_price_srd' => $l['line_total'], 'quantity' => 1,
                'discount_srd' => '0.00', 'discount_pct' => '0.00',
                'btw_rate' => $l['exempt'] ? '0' : '10',
                'btw_exempt' => $l['exempt'],
                'btw_srd' => $l['btw'], 'line_total_srd' => $l['line_total'],
            ]);
        }

        return $sale;
    }

    // ── P1-C1 ────────────────────────────────────────────────────────────────

    public function test_mixed_basket_reports_only_exempt_line_as_exempt(): void
    {
        $when = Carbon::now('America/Paramaribo')->startOfMonth()->setTime(10, 0);

        // ONE sale, TWO lines: SRD 40 exempt rice + SRD 22 taxable cola
        // (btw 2.00). Sale-level btw_srd = 2.00 (> 0), so the OLD proxy would
        // have classified the WHOLE 62.00 as taxable and exempt as 0.
        $this->makeSaleWithItems($this->storeA, [
            ['name' => 'Rijst', 'line_total' => '40.00', 'btw' => '0.00', 'exempt' => true],
            ['name' => 'Cola',  'line_total' => '22.00', 'btw' => '2.00', 'exempt' => false],
        ], $when);

        $totals = app(BtwSubmissionService::class)->computeTotals(
            $this->orgA->id, null,
            $when->copy()->startOfDay(), $when->copy()->endOfDay(),
        );

        $this->assertSame('62.00', $totals['total_sales_srd']);
        $this->assertSame('40.00', $totals['btw_exempt_srd'], 'Only the exempt rice line counts as exempt.');
        $this->assertSame('22.00', $totals['btw_taxable_srd'], 'The taxable cola line is taxable, not the whole sale.');
        $this->assertSame('2.00',  $totals['total_btw_srd']);
    }

    // ── P0-4 ─────────────────────────────────────────────────────────────────

    public function test_btw_hash_chain_is_per_organisation(): void
    {
        $day = Carbon::now('America/Paramaribo')->startOfMonth();
        $this->makeSaleWithItems($this->storeA, [['name' => 'X', 'line_total' => '100.00', 'btw' => '9.09', 'exempt' => false]], $day->copy()->setTime(9, 0));
        $this->makeSaleWithItems($this->storeB, [['name' => 'Y', 'line_total' => '200.00', 'btw' => '18.18', 'exempt' => false]], $day->copy()->setTime(9, 0));

        $period = ['period_type' => 'daily', 'period_start' => $day->toDateString(), 'period_end' => $day->toDateString()];

        // Org A files first
        $a1 = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', $period);
        $a1->assertCreated();
        $a1Hash = BtwSubmission::find($a1->json('data.id'))->current_hash;

        // Org B files — must NOT chain off org A
        $b1 = $this->actingAs($this->oaB, 'sanctum')->postJson('/api/btw-submissions', $period);
        $b1->assertCreated();
        $b1Row = BtwSubmission::find($b1->json('data.id'));

        // Org B's first filing is the GENESIS of org B's chain → prev_hash null,
        // and crucially NOT equal to org A's hash.
        $this->assertNull($b1Row->prev_hash, 'Org B genesis filing has no previous hash.');
        $this->assertNotSame($a1Hash, $b1Row->prev_hash);

        // A second org-A filing (different period) chains to A's first, not B's.
        $day2 = $day->copy()->addDay();
        $this->makeSaleWithItems($this->storeA, [['name' => 'Z', 'line_total' => '50.00', 'btw' => '4.55', 'exempt' => false]], $day2->copy()->setTime(9, 0));
        $a2 = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => $day2->toDateString(), 'period_end' => $day2->toDateString(),
        ]);
        $a2->assertCreated();
        $this->assertSame($a1Hash, BtwSubmission::find($a2->json('data.id'))->prev_hash,
            "Org A's second filing chains to org A's first, not org B's.");
    }

    // ── P0-10 ──────────────────────────────────────────────────────────────────

    public function test_audit_chain_stays_valid_through_login_and_btw_submit(): void
    {
        $hasher = app(AuditHashService::class);

        // A login writes an audit row via AuditLog::create (was a raw insert).
        $this->postJson('/api/auth/login', [
            'email' => 'oa-a@compliance.sr', 'password' => 'pw', 'device_name' => 'test',
        ])->assertOk();

        // A BTW filing writes another (also previously raw).
        $day = Carbon::now('America/Paramaribo')->startOfMonth();
        $this->makeSaleWithItems($this->storeA, [['name' => 'X', 'line_total' => '100.00', 'btw' => '9.09', 'exempt' => false]], $day->copy()->setTime(9, 0));
        $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => $day->toDateString(), 'period_end' => $day->toDateString(),
        ])->assertCreated();

        // The org's SHA-256 audit chain must verify clean — no NULL-hash gaps.
        $result = $hasher->verifyChain($this->orgA->id);
        $this->assertTrue($result['valid'], 'Audit chain broken: ' . ($result['message'] ?? ''));
        $this->assertGreaterThanOrEqual(2, $result['checked']);
    }

    // ── P1-C5: locked daily-rate immutability ─────────────────────────────────

    public function test_locked_daily_rate_cannot_be_overwritten_except_via_override(): void
    {
        $rate = \App\Models\DailyRate::create([
            'date' => '2026-02-15', 'usd_to_srd' => '37.5000', 'raw_rate' => '37.5000',
            'markup_pct' => '0.00', 'source' => 'api', 'locked_at' => Carbon::now(),
        ]);

        // A plain programmatic overwrite of a locked rate is refused.
        try {
            $rate->update(['usd_to_srd' => '99.0000']);
            $this->fail('Expected the locked-rate guard to throw.');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('locked', strtolower($e->getMessage()));
        }
        $this->assertSame('37.5000', \App\Models\DailyRate::find($rate->id)->usd_to_srd);

        // The authorised override path succeeds.
        \App\Models\DailyRate::withoutLockGuard(fn () => $rate->update(['usd_to_srd' => '40.0000']));
        $this->assertSame('40.0000', \App\Models\DailyRate::find($rate->id)->usd_to_srd);
    }

    // ── P1-C6: BTW receipt requires a registration number ─────────────────────

    public function test_btw_sale_blocked_when_org_has_no_btw_number(): void
    {
        $org = Organisation::create([
            'name' => 'No-Number Shop', 'type' => 'retail', 'btw_number' => null,
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $store = Store::create([
            'organisation_id' => $org->id, 'name' => 'NN Main', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $cashier = User::create([
            'name' => 'NN Cashier', 'email' => 'nn@compliance.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $cashier->assignRole(User::ROLE_CASHIER);

        $payload = [
            'store_id' => $store->id, 'payment_method' => 'cash', 'cash_tendered' => '11.00',
            'items' => [[
                'product_name' => 'Cola', 'unit_price' => '10.00', 'quantity' => '1',
                'btw_rate' => '10.00', 'btw_exempt' => false,
            ]],
        ];

        // BTW basket + no number on file → refused.
        $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', $payload)
            ->assertStatus(422)
            ->assertJsonPath('code', 'MISSING_BTW_NUMBER');

        // Set the number → the same sale now completes.
        $org->update(['btw_number' => 'BTW-SR-NN']);
        $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', $payload)
            ->assertStatus(201);
    }

    public function test_fully_exempt_sale_allowed_without_btw_number(): void
    {
        $org = Organisation::create([
            'name' => 'Exempt Shop', 'type' => 'retail', 'btw_number' => null,
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $store = Store::create([
            'organisation_id' => $org->id, 'name' => 'EX Main', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $cashier = User::create([
            'name' => 'EX Cashier', 'email' => 'ex@compliance.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $cashier->assignRole(User::ROLE_CASHIER);

        // A fully BTW-exempt basket (rice/medicine) charges no BTW, so the
        // registration-number rule does not apply — sale must complete.
        $this->actingAs($cashier, 'sanctum')->postJson('/api/sales', [
            'store_id' => $store->id, 'payment_method' => 'cash', 'cash_tendered' => '10.00',
            'items' => [[
                'product_name' => 'Rijst', 'unit_price' => '10.00', 'quantity' => '1',
                'btw_rate' => '0', 'btw_exempt' => true,
            ]],
        ])->assertStatus(201);
    }
}
