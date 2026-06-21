<?php

namespace Tests\Feature;

use App\Models\BtwSubmission;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use App\Notifications\BtwFilingAccepted;
use App\Notifications\BtwFilingDisputed;
use App\Notifications\BtwFilingResubmitted;
use App\Notifications\BtwFilingSubmitted;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * The dispute/accept/resubmit loop must notify the right people:
 *   - dispute  → taxpayer (org admins + submitter), NOT other orgs
 *   - accept   → taxpayer
 *   - resubmit → Belastingdienst inspectors
 * Plus the in-app bell endpoints are strictly per-user.
 */
class BtwNotificationTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $orgA;
    private Organisation $orgB;
    private Store $storeA;
    private User $oaA;
    private User $oaB;
    private User $cashierA;
    private User $inspector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->orgA = Organisation::create([
            'name' => 'Alpha Supermarkt', 'type' => 'retail', 'btw_number' => 'BTW-SR-ALPHA',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->orgB = Organisation::create([
            'name' => 'Beta Wholesale', 'type' => 'wholesale', 'btw_number' => 'BTW-SR-BETA',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->storeA = Store::create([
            'organisation_id' => $this->orgA->id, 'name' => 'Alpha Paramaribo',
            'city' => 'Paramaribo', 'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->oaA = $this->makeUser('OA Alpha', 'oa-a@test.sr', $this->orgA->id, User::ROLE_ORGANISATION_ADMIN);
        $this->oaB = $this->makeUser('OA Beta', 'oa-b@test.sr', $this->orgB->id, User::ROLE_ORGANISATION_ADMIN);
        $this->cashierA = $this->makeUser('Cashier A', 'cash-a@test.sr', $this->orgA->id, User::ROLE_CASHIER, $this->storeA->id);
        $this->inspector = $this->makeUser('Inspector', 'inspector@gov.sr', null, User::ROLE_TAX_INSPECTOR);
    }

    private function makeUser(string $name, string $email, ?string $orgId, string $role, ?string $storeId = null): User
    {
        $u = User::create([
            'name' => $name, 'email' => $email, 'password' => bcrypt('pw'),
            'organisation_id' => $orgId, 'store_id' => $storeId,
            'role' => $role, 'locale' => 'nl', 'is_active' => true,
        ]);
        $u->assignRole($role);

        return $u;
    }

    /** Make a sale + file it via the real API, returning the filed submission. */
    private function fileDaily(string $date = '2026-05-20'): BtwSubmission
    {
        $when = Carbon::parse($date, 'America/Paramaribo')->setTime(12, 0);
        $sale = Sale::create([
            'store_id' => $this->storeA->id, 'cashier_id' => $this->cashierA->id,
            'sale_number' => Sale::nextNumber($this->storeA->id),
            'subtotal_srd' => '110.00', 'discount_srd' => '0.00', 'btw_srd' => '10.00',
            'total_srd' => '110.00', 'payment_method' => 'cash', 'status' => 'completed',
            'source' => 'pos', 'occurred_at' => $when,
        ]);
        SaleItem::create([
            'sale_id' => $sale->id, 'product_name_snapshot' => 'Item', 'unit_price_srd' => '110.00',
            'quantity' => 1, 'discount_srd' => '0.00', 'discount_pct' => '0.00', 'btw_rate' => '10',
            'btw_exempt' => false, 'btw_srd' => '10.00', 'line_total_srd' => '110.00',
        ]);

        $res = $this->actingAs($this->oaA, 'sanctum')->postJson('/api/btw-submissions', [
            'period_type' => 'daily', 'period_start' => $date, 'period_end' => $date,
        ])->assertCreated();

        return BtwSubmission::findOrFail($res->json('data.id'));
    }

    public function test_new_filing_notifies_inspectors(): void
    {
        Notification::fake();
        $this->fileDaily();

        Notification::assertSentTo($this->inspector, BtwFilingSubmitted::class);
        // The taxpayer who filed should NOT get the inspector-facing alert.
        Notification::assertNotSentTo($this->oaA, BtwFilingSubmitted::class);
    }

    public function test_dispute_notifies_taxpayer_not_other_orgs(): void
    {
        Notification::fake();
        $sub = $this->fileDaily();

        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$sub->id}/dispute", ['inspector_note' => 'Bedrag klopt niet.'])
            ->assertOk();

        Notification::assertSentTo($this->oaA, BtwFilingDisputed::class);
        Notification::assertNotSentTo($this->oaB, BtwFilingDisputed::class);
        Notification::assertNotSentTo($this->inspector, BtwFilingDisputed::class);
    }

    public function test_accept_notifies_taxpayer(): void
    {
        Notification::fake();
        $sub = $this->fileDaily();

        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$sub->id}/accept")
            ->assertOk();

        Notification::assertSentTo($this->oaA, BtwFilingAccepted::class);
    }

    public function test_resubmit_notifies_inspectors(): void
    {
        Notification::fake();
        $sub = $this->fileDaily();

        // Inspector disputes, OA corrects & resubmits (supersede).
        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/{$sub->id}/dispute", ['inspector_note' => 'Corrigeer aub.'])
            ->assertOk();

        $this->actingAs($this->oaA, 'sanctum')
            ->postJson("/api/btw-submissions/{$sub->id}/supersede", ['submitter_note' => 'Gecorrigeerd.'])
            ->assertCreated();

        Notification::assertSentTo($this->inspector, BtwFilingResubmitted::class);
    }

    public function test_notification_bell_is_scoped_per_user(): void
    {
        // Real (sync-queued) notifications so DB rows exist for the bell.
        $sub = $this->fileDaily();
        $this->oaA->notify(new BtwFilingAccepted($sub));
        $this->oaA->notify(new BtwFilingDisputed($sub, 'reden'));
        $this->oaB->notify(new BtwFilingAccepted($sub));

        // OA-A sees only their two.
        $this->actingAs($this->oaA, 'sanctum')->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonCount(2, 'data');

        // OA-B sees only their one.
        $bId = $this->oaB->notifications()->first()->id;
        $this->actingAs($this->oaB, 'sanctum')->getJson('/api/notifications')
            ->assertJsonPath('unread_count', 1);

        // OA-A cannot mark OA-B's notification read.
        $this->actingAs($this->oaA, 'sanctum')
            ->postJson("/api/notifications/{$bId}/read")
            ->assertNotFound();

        // Mark-one then mark-all for OA-A.
        $aId = $this->oaA->unreadNotifications()->first()->id;
        $this->actingAs($this->oaA, 'sanctum')->postJson("/api/notifications/{$aId}/read")
            ->assertOk()->assertJsonPath('unread_count', 1);
        $this->actingAs($this->oaA, 'sanctum')->postJson('/api/notifications/read-all')
            ->assertOk()->assertJsonPath('unread_count', 0);
    }
}
