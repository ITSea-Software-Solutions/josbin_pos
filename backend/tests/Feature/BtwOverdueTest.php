<?php

namespace Tests\Feature;

use App\Models\BtwFilingReminder;
use App\Models\BtwInspectionCase;
use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use App\Notifications\BtwFilingOverdue;
use App\Notifications\BtwInspectionCaseOpened;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * BTW late-filing oversight (feature BTW-FILING-16):
 *   - inspector sees stores overdue on their filing, by how many days
 *   - inspector sets a store's filing period
 *   - reminders notify the store, are logged, and unlock escalation at >= 3
 *   - escalation opens one inspection case + notifies the inspectors' queue
 *   - only tax_inspector / SA can use any of it
 */
class BtwOverdueTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $store;
    private User $oa;
    private User $inspector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Alpha Supermarkt', 'type' => 'retail', 'btw_number' => 'BTW-SR-ALPHA',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        // A store that has never filed and was created 40 days ago → overdue at a 7-day cadence.
        $this->store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Alpha Paramaribo', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'btw_filing_period_days' => 7, 'is_active' => true, 'pos_type' => 'native',
        ]);
        Store::whereKey($this->store->id)->update(['created_at' => now()->subDays(40)]);
        $this->store->refresh();

        $this->oa        = $this->makeUser('OA', 'oa@a.sr', $this->org->id, User::ROLE_ORGANISATION_ADMIN);
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

    public function test_inspector_sees_overdue_store(): void
    {
        $res = $this->actingAs($this->inspector, 'sanctum')
            ->getJson('/api/btw-submissions/overdue')
            ->assertOk()
            ->assertJsonPath('escalation_threshold', 3);

        $row = collect($res->json('data'))->firstWhere('store_id', $this->store->id);

        $this->assertNotNull($row, 'the overdue store is listed');
        $this->assertSame(7, $row['period_days']);
        $this->assertGreaterThan(0, $row['days_overdue']);
        $this->assertSame(0, $row['reminder_count']);
        $this->assertFalse($row['can_escalate']);
    }

    public function test_non_inspector_is_forbidden(): void
    {
        $this->actingAs($this->oa, 'sanctum')
            ->getJson('/api/btw-submissions/overdue')
            ->assertForbidden();
    }

    public function test_inspector_sets_filing_period(): void
    {
        $this->actingAs($this->inspector, 'sanctum')
            ->patchJson("/api/btw-submissions/overdue/{$this->store->id}/period", ['btw_filing_period_days' => 30])
            ->assertOk()
            ->assertJsonPath('btw_filing_period_days', 30);

        $this->assertSame(30, $this->store->fresh()->btw_filing_period_days);
    }

    public function test_reminders_notify_store_and_unlock_escalation(): void
    {
        Notification::fake();

        // Escalation is blocked until there are >= 3 reminders.
        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/overdue/{$this->store->id}/escalate")
            ->assertStatus(422);

        for ($i = 1; $i <= 3; $i++) {
            $this->actingAs($this->inspector, 'sanctum')
                ->postJson("/api/btw-submissions/overdue/{$this->store->id}/remind")
                ->assertOk()
                ->assertJsonPath('reminder_count', $i);
        }

        $this->assertSame(3, BtwFilingReminder::where('store_id', $this->store->id)
            ->where('source', BtwFilingReminder::SOURCE_INSPECTOR)->count());
        Notification::assertSentTo($this->oa, BtwFilingOverdue::class);

        // Now escalation is allowed → one inspection case + inspector queue notified.
        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/overdue/{$this->store->id}/escalate", ['reason' => 'Ignored 3 reminders'])
            ->assertCreated();

        $case = BtwInspectionCase::where('store_id', $this->store->id)->first();
        $this->assertNotNull($case);
        $this->assertSame(BtwInspectionCase::STATUS_OPEN, $case->status);
        $this->assertSame(3, $case->reminder_count);
        Notification::assertSentTo($this->inspector, BtwInspectionCaseOpened::class);

        // A second open case for the same store is rejected.
        $this->actingAs($this->inspector, 'sanctum')
            ->postJson("/api/btw-submissions/overdue/{$this->store->id}/escalate")
            ->assertStatus(422);
    }
}
