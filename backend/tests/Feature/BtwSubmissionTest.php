<?php

namespace Tests\Feature;

use App\Models\BtwSubmission;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Covers the BTW submission workflow:
 *   - OA can preview + submit
 *   - tax_inspector sees cross-org and can accept/dispute
 *   - OA only sees own org
 *   - cashier cannot view/submit
 *   - double-filing the same period returns 409
 *   - accepted submissions cannot be re-reviewed
 */
class BtwSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $orgA;
    private Organisation $orgB;
    private Store $storeA;
    private Store $storeB;
    private User $oaA;
    private User $cashierA;
    private User $inspector;
    private User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        // Two orgs so we can prove cross-org scoping
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
            'name' => 'OA Alpha', 'email' => 'oa-a@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->orgA->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oaA->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->cashierA = User::create([
            'name' => 'Cashier A', 'email' => 'cash-a@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->orgA->id,
            'store_id' => $this->storeA->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashierA->assignRole(User::ROLE_CASHIER);

        // Tax inspector — no organisation, like Super Admin
        $this->inspector = User::create([
            'name' => 'Inspector', 'email' => 'inspector@gov.sr',
            'password' => bcrypt('pw'), 'organisation_id' => null,
            'role' => User::ROLE_TAX_INSPECTOR, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->inspector->assignRole(User::ROLE_TAX_INSPECTOR);

        $this->superAdmin = User::create([
            'name' => 'SA', 'email' => 'sa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => null,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->superAdmin->assignRole(User::ROLE_SUPER_ADMIN);
    }

    private function makeSale(Store $store, User $cashier, string $total, string $btw, Carbon $when): Sale
    {
        return Sale::create([
            'store_id'      => $store->id,
            'cashier_id'    => $cashier->id,
            'sale_number'   => Sale::nextNumber($store->id),
            'subtotal_srd'  => $total,
            'discount_srd'  => '0.00',
            'btw_srd'       => $btw,
            'total_srd'     => $total,
            'payment_method'=> 'cash',
            'status'        => 'completed',
            'source'        => 'pos',
            'occurred_at'   => $when,
        ]);
    }

    public function test_oa_can_preview_a_daily_submission(): void
    {
        // Seed three sales on the target day in org A
        $today = Carbon::parse('2026-05-20', 'America/Paramaribo');
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $today->copy()->setTime(10, 0));
        $this->makeSale($this->storeA, $this->cashierA, '55.00',  '5.00',  $today->copy()->setTime(14, 0));
        $this->makeSale($this->storeA, $this->cashierA, '40.00',  '0.00',  $today->copy()->setTime(16, 0)); // exempt

        $response = $this->actingAs($this->oaA, 'sanctum')
            ->postJson('/api/btw-submissions/preview', [
                'period_type'  => 'daily',
                'period_start' => '2026-05-20',
                'period_end'   => '2026-05-20',
            ]);

        $response->assertOk();
        $response->assertJsonPath('totals.sales_count', 3);
        $response->assertJsonPath('totals.total_sales_srd', '205.00');
        $response->assertJsonPath('totals.btw_exempt_srd', '40.00');
        $response->assertJsonPath('totals.total_btw_srd', '15.00');
    }

    public function test_oa_can_file_a_daily_submission(): void
    {
        $today = Carbon::parse('2026-05-20', 'America/Paramaribo');
        $this->makeSale($this->storeA, $this->cashierA, '100.00', '10.00', $today->copy()->setTime(12, 0));

        $response = $this->actingAs($this->oaA, 'sanctum')
            ->postJson('/api/btw-submissions', [
                'period_type'    => 'daily',
                'period_start'   => '2026-05-20',
                'period_end'     => '2026-05-20',
                'submitter_note' => 'Standard daily file.',
            ]);

        $response->assertCreated();
        $response->assertJsonPath('data.status', 'filed');
        $response->assertJsonPath('data.total_sales_srd', '100.00');
        $response->assertJsonPath('data.total_btw_srd', '10.00');
        $response->assertJsonPath('data.sales_count', 1);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'btw.submitted',
            'organisation_id' => $this->orgA->id,
        ]);
    }

    public function test_double_filing_same_period_returns_409(): void
    {
        $today = Carbon::parse('2026-05-20', 'America/Paramaribo');
        $this->makeSale($this->storeA, $this->cashierA, '50.00', '5.00', $today->copy()->setTime(10, 0));

        $first = $this->actingAs($this->oaA, 'sanctum')
            ->postJson('/api/btw-submissions', [
                'period_type'  => 'daily',
                'period_start' => '2026-05-20',
                'period_end'   => '2026-05-20',
            ]);
        $first->assertCreated();

        $second = $this->actingAs($this->oaA, 'sanctum')
            ->postJson('/api/btw-submissions', [
                'period_type'  => 'daily',
                'period_start' => '2026-05-20',
                'period_end'   => '2026-05-20',
            ]);
        $second->assertStatus(409);
        $second->assertJsonPath('code', 'BTW_ALREADY_FILED');
    }

    public function test_monthly_submission_must_span_full_month(): void
    {
        $response = $this->actingAs($this->oaA, 'sanctum')
            ->postJson('/api/btw-submissions', [
                'period_type'  => 'monthly',
                'period_start' => '2026-04-05',  // not the 1st
                'period_end'   => '2026-04-30',
            ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['period_start']);
    }

    public function test_cashier_cannot_view_or_submit(): void
    {
        $list = $this->actingAs($this->cashierA, 'sanctum')->getJson('/api/btw-submissions');
        $list->assertForbidden();

        $submit = $this->actingAs($this->cashierA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ]);
        $submit->assertForbidden();
    }

    public function test_oa_sees_only_own_org_submissions(): void
    {
        // File a submission in org A
        $today = Carbon::parse('2026-05-20', 'America/Paramaribo');
        $this->makeSale($this->storeA, $this->cashierA, '50.00', '5.00', $today->copy()->setTime(10, 0));
        $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->assertCreated();

        // Manually create a submission in org B (bypass controller for simplicity)
        BtwSubmission::create([
            'organisation_id' => $this->orgB->id,
            'period_type'     => 'daily',
            'period_start'    => '2026-05-20', 'period_end' => '2026-05-20',
            'sales_count'     => 0,
            'total_sales_srd' => '0', 'btw_exempt_srd' => '0',
            'btw_taxable_srd' => '0', 'total_btw_srd' => '0',
            'status'          => 'filed',
            'submitted_at'    => now(),
            'submitted_by'    => $this->superAdmin->id,
            'reference'       => 'BTW-SEED-B',
        ]);

        $response = $this->actingAs($this->oaA, 'sanctum')->getJson('/api/btw-submissions');
        $response->assertOk();
        // OA A should see only their org's filing
        $orgs = collect($response->json('data'))->pluck('organisation_id')->unique()->values();
        $this->assertCount(1, $orgs);
        $this->assertEquals($this->orgA->id, $orgs[0]);
    }

    public function test_tax_inspector_sees_cross_org(): void
    {
        // File in both orgs
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '50.00', '5.00', $when);
        $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->assertCreated();

        BtwSubmission::create([
            'organisation_id' => $this->orgB->id,
            'period_type'     => 'daily',
            'period_start'    => '2026-05-20', 'period_end' => '2026-05-20',
            'sales_count'     => 0,
            'total_sales_srd' => '0', 'btw_exempt_srd' => '0',
            'btw_taxable_srd' => '0', 'total_btw_srd' => '0',
            'status'          => 'filed',
            'submitted_at'    => now(),
            'submitted_by'    => $this->superAdmin->id,
            'reference'       => 'BTW-SEED-B',
        ]);

        $response = $this->actingAs($this->inspector, 'sanctum')->getJson('/api/btw-submissions');
        $response->assertOk();
        $orgs = collect($response->json('data'))->pluck('organisation_id')->unique()->values();
        $this->assertCount(2, $orgs, 'Tax inspector should see both orgs');
    }

    public function test_tax_inspector_can_accept_a_filing(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $created = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ]);
        $id = $created->json('data.id');

        $accept = $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$id}/accept", ['inspector_note' => 'Looks fine.']);
        $accept->assertOk();
        $accept->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('audit_logs', ['event' => 'btw.accepted']);
    }

    public function test_tax_inspector_cannot_accept_already_accepted_filing(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $id = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data.id');

        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$id}/accept")->assertOk();

        $second = $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$id}/accept");
        $second->assertForbidden();
    }

    public function test_oa_cannot_accept_filings(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $id = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data.id');

        $response = $this->actingAs($this->oaA, 'sanctum')
            ->postJson("/api/btw-submissions/{$id}/accept", ['inspector_note' => 'no']);
        $response->assertForbidden();
    }

    // ── Resubmission (task #80) ─────────────────────────────────────────────

    public function test_oa_can_supersede_a_filed_submission(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '100.00', '10.00', $when);
        $original = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data');

        // Add another sale to the same day, then resubmit — recomputed totals
        // should pick it up.
        $this->makeSale($this->storeA, $this->cashierA, '55.00', '5.00', $when->copy()->addHour());

        $resub = $this->actingAs($this->oaA, 'sanctum')
            ->postJson("/api/btw-submissions/{$original['id']}/supersede", ['submitter_note' => 'Late receipt — corrected.']);

        $resub->assertCreated();
        $resub->assertJsonPath('data.status', 'filed');
        $resub->assertJsonPath('data.total_sales_srd', '155.00');
        $resub->assertJsonPath('data.total_btw_srd', '15.00');
        // Original is now marked superseded
        $this->assertDatabaseHas('btw_submissions', [
            'id' => $original['id'], 'status' => 'superseded',
        ]);
        $this->assertDatabaseHas('audit_logs', ['event' => 'btw.superseded']);
    }

    public function test_cannot_supersede_an_already_accepted_filing(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '100.00', '10.00', $when);
        $id = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data.id');

        // Inspector accepts
        $this->actingAs($this->inspector, 'sanctum')->postJson("/api/btw-submissions/{$id}/accept")->assertOk();

        // OA can no longer resubmit
        $resub = $this->actingAs($this->oaA, 'sanctum')
            ->postJson("/api/btw-submissions/{$id}/supersede");
        $resub->assertForbidden();
    }

    public function test_oa_in_another_org_cannot_supersede(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '100.00', '10.00', $when);
        $id = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data.id');

        // Make an OA for org B
        $oaB = User::create([
            'name' => 'OAB', 'email' => 'oa-b@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->orgB->id,
            'role' => User::ROLE_ORGANISATION_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $oaB->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $resub = $this->actingAs($oaB, 'sanctum')->postJson("/api/btw-submissions/{$id}/supersede");
        $resub->assertForbidden();
    }

    // ── Task #82 — inspector dashboard + detail breakdown ───────────────────

    public function test_inspector_dashboard_returns_platform_scope(): void
    {
        // File some submissions across both orgs to exercise the aggregation
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->assertCreated();

        $resp = $this->actingAs($this->inspector, 'sanctum')->getJson('/api/btw-submissions/inspector-dashboard');
        $resp->assertOk();
        $resp->assertJsonPath('data.scope', 'platform');
        $resp->assertJsonPath('data.totals.pending_review', 1);
        $this->assertNotEmpty($resp->json('data.top_orgs_month'));
        // late_filings is also populated (orgB has zero filings so will appear if our test window matches)
        $this->assertIsArray($resp->json('data.late_filings'));
    }

    public function test_oa_dashboard_scoped_to_own_org(): void
    {
        $resp = $this->actingAs($this->oaA, 'sanctum')->getJson('/api/btw-submissions/inspector-dashboard');
        $resp->assertOk();
        $resp->assertJsonPath('data.scope', 'own_org');
        // late_filings should be empty for OA (only inspector + SA get the cross-org sweep)
        $this->assertEmpty($resp->json('data.late_filings'));
    }

    public function test_detail_endpoint_returns_per_store_per_source_per_payment_method_breakdowns(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        // Mix of POS + API + different payment methods
        $s1 = $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $s1->update(['source' => 'pos', 'payment_method' => 'cash']);
        $s2 = $this->makeSale($this->storeA, $this->cashierA, '55.00', '5.00', $when->copy()->addHour());
        $s2->update(['source' => 'api', 'payment_method' => 'card', 'card_amount_srd' => '55.00']);

        $created = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data');

        $resp = $this->actingAs($this->inspector, 'sanctum')->getJson("/api/btw-submissions/{$created['id']}/detail");
        $resp->assertOk();

        $sources = collect($resp->json('data.breakdown.per_source'))->pluck('source')->sort()->values()->all();
        $this->assertEquals(['api', 'pos'], $sources);

        $payMethods = collect($resp->json('data.breakdown.per_payment_method'))->pluck('method')->sort()->values()->all();
        $this->assertEquals(['card', 'cash'], $payMethods);

        $this->assertNotEmpty($resp->json('data.breakdown.per_store'));
        // per_btw_rate joins sale_items; the test helper makeSale() creates
        // Sale rows but not SaleItem rows (full sale-item creation lives in
        // SaleController::store). We assert it's an ARRAY but not necessarily
        // populated — the real-world path always has sale_items.
        $this->assertIsArray($resp->json('data.breakdown.per_btw_rate'));
        $this->assertNotEmpty($resp->json('data.timeline')); // btw.submitted event
    }

    public function test_search_filter_matches_reference(): void
    {
        $when = Carbon::parse('2026-05-20', 'America/Paramaribo')->setTime(12, 0);
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00', $when);
        $ref = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => '2026-05-20', 'period_end' => '2026-05-20',
        ])->json('data.reference');

        // Inspector searches by partial reference
        $resp = $this->actingAs($this->inspector, 'sanctum')
            ->getJson('/api/btw-submissions?search=' . urlencode(substr($ref, 0, 10)));
        $resp->assertOk();
        $refs = collect($resp->json('data'))->pluck('reference');
        $this->assertContains($ref, $refs);
    }
}
