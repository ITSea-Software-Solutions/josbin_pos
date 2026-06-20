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
 * Store Manager BTW filing is store-scoped:
 *   - SM files / previews / sees ONLY their own store
 *   - OA files org-wide (store_id null) covering every store
 *   - per-store + org-wide filings for one period coexist; same store+period
 *     twice is rejected
 *   - SM cannot supersede or view another store's / the org-wide filing
 */
class BtwStoreScopeTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $storeA;
    private Store $storeB;
    private User $oa;
    private User $smA;
    private User $smB;
    private User $cashierA;
    private User $cashierB;
    private string $day = '2026-05-20';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Alpha Supermarkt', 'type' => 'retail', 'btw_number' => 'BTW-SR-ALPHA',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->storeA = $this->makeStore('Alpha Paramaribo');
        $this->storeB = $this->makeStore('Alpha Nickerie');

        $this->oa  = $this->makeUser('OA', 'oa@a.sr', User::ROLE_ORGANISATION_ADMIN);
        $this->smA = $this->makeUser('SM A', 'sma@a.sr', User::ROLE_STORE_MANAGER, $this->storeA->id);
        $this->smB = $this->makeUser('SM B', 'smb@a.sr', User::ROLE_STORE_MANAGER, $this->storeB->id);
        $this->cashierA = $this->makeUser('Cash A', 'ca@a.sr', User::ROLE_CASHIER, $this->storeA->id);
        $this->cashierB = $this->makeUser('Cash B', 'cb@a.sr', User::ROLE_CASHIER, $this->storeB->id);

        // Store A: 110 / 10 BTW.  Store B: 220 / 20 BTW.  Same day.
        $this->makeSale($this->storeA, $this->cashierA, '110.00', '10.00');
        $this->makeSale($this->storeB, $this->cashierB, '220.00', '20.00');
    }

    private function makeStore(string $name): Store
    {
        return Store::create([
            'organisation_id' => $this->org->id, 'name' => $name, 'city' => 'X',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
    }

    private function makeUser(string $name, string $email, string $role, ?string $storeId = null): User
    {
        $u = User::create([
            'name' => $name, 'email' => $email, 'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'store_id' => $storeId,
            'role' => $role, 'locale' => 'nl', 'is_active' => true,
        ]);
        $u->assignRole($role);

        return $u;
    }

    private function makeSale(Store $store, User $cashier, string $total, string $btw): void
    {
        $when = Carbon::parse($this->day, 'America/Paramaribo')->setTime(12, 0);
        $sale = Sale::create([
            'store_id' => $store->id, 'cashier_id' => $cashier->id,
            'sale_number' => Sale::nextNumber($store->id),
            'subtotal_srd' => $total, 'discount_srd' => '0.00', 'btw_srd' => $btw,
            'total_srd' => $total, 'payment_method' => 'cash', 'status' => 'completed',
            'source' => 'pos', 'occurred_at' => $when,
        ]);
        SaleItem::create([
            'sale_id' => $sale->id, 'product_name_snapshot' => 'Item', 'unit_price_srd' => $total,
            'quantity' => 1, 'discount_srd' => '0.00', 'discount_pct' => '0.00', 'btw_rate' => '10',
            'btw_exempt' => false, 'btw_srd' => $btw, 'line_total_srd' => $total,
        ]);
    }

    private function dailyPayload(array $over = []): array
    {
        return array_merge([
            'period_type' => 'daily', 'period_start' => $this->day, 'period_end' => $this->day,
        ], $over);
    }

    public function test_sm_preview_is_scoped_to_their_store(): void
    {
        $this->actingAs($this->smA, 'sanctum')
            ->postJson('/api/btw-submissions/preview', $this->dailyPayload())
            ->assertOk()
            ->assertJsonPath('totals.total_sales_srd', '110.00')   // only store A
            ->assertJsonPath('totals.total_btw_srd', '10.00');
    }

    public function test_oa_preview_is_org_wide(): void
    {
        $this->actingAs($this->oa, 'sanctum')
            ->postJson('/api/btw-submissions/preview', $this->dailyPayload())
            ->assertOk()
            ->assertJsonPath('totals.total_sales_srd', '330.00')   // A + B
            ->assertJsonPath('totals.total_btw_srd', '30.00');
    }

    public function test_sm_filing_forces_their_store_even_if_another_is_sent(): void
    {
        // SM A tries to file for store B — must be ignored and forced to A.
        $res = $this->actingAs($this->smA, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload(['store_id' => $this->storeB->id]))
            ->assertCreated();

        $this->assertSame($this->storeA->id, $res->json('data.store_id'));
        $this->assertSame('110.00', $res->json('data.total_sales_srd'));
    }

    public function test_per_store_and_org_wide_filings_coexist_for_a_period(): void
    {
        $this->actingAs($this->smA, 'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();
        $this->actingAs($this->smB, 'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();
        $this->actingAs($this->oa,  'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();

        // store A, store B, and org-wide all exist for the same day.
        $this->assertSame(1, BtwSubmission::where('store_id', $this->storeA->id)->count());
        $this->assertSame(1, BtwSubmission::where('store_id', $this->storeB->id)->count());
        $this->assertSame(1, BtwSubmission::whereNull('store_id')->count());

        // Same store + same period again → 409.
        $this->actingAs($this->smA, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload())
            ->assertStatus(409);
    }

    public function test_sm_list_shows_only_their_store(): void
    {
        $this->actingAs($this->smA, 'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();
        $this->actingAs($this->smB, 'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();
        $this->actingAs($this->oa,  'sanctum')->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated();

        // SM A sees only their one store-A filing.
        $smList = $this->actingAs($this->smA, 'sanctum')->getJson('/api/btw-submissions')->assertOk();
        $this->assertCount(1, $smList->json('data'));
        $this->assertSame($this->storeA->id, $smList->json('data.0.store_id'));

        // OA sees all three.
        $oaList = $this->actingAs($this->oa, 'sanctum')->getJson('/api/btw-submissions')->assertOk();
        $this->assertCount(3, $oaList->json('data'));
    }

    public function test_sm_cannot_supersede_org_wide_or_other_store_filing(): void
    {
        $orgWide = $this->actingAs($this->oa, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated()->json('data.id');
        $storeBFiling = $this->actingAs($this->smB, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated()->json('data.id');

        $this->actingAs($this->smA, 'sanctum')
            ->postJson("/api/btw-submissions/{$orgWide}/supersede")->assertForbidden();
        $this->actingAs($this->smA, 'sanctum')
            ->postJson("/api/btw-submissions/{$storeBFiling}/supersede")->assertForbidden();
    }

    public function test_sm_cannot_view_other_store_filing_detail(): void
    {
        $storeBFiling = $this->actingAs($this->smB, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload())->assertCreated()->json('data.id');

        $this->actingAs($this->smA, 'sanctum')
            ->getJson("/api/btw-submissions/{$storeBFiling}")->assertForbidden();
    }

    public function test_sm_without_store_assignment_cannot_file(): void
    {
        $orphan = $this->makeUser('Orphan SM', 'orphan@a.sr', User::ROLE_STORE_MANAGER, null);

        $this->actingAs($orphan, 'sanctum')
            ->postJson('/api/btw-submissions', $this->dailyPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('store_id');
    }
}
