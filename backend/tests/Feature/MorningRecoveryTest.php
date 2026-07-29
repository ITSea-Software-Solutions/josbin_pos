<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Morning-recovery batch: yesterday-status endpoint, nightly auto-close
 * (opt-in per store), and next-morning reconciliation.
 */
class MorningRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Register $register;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
        Bus::fake();
        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $org           = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $org->id)->firstOrFail();
        $this->register = Register::create([
            'store_id' => $this->store->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);
    }

    private function openYesterday(): RegisterSession
    {
        return RegisterSession::create([
            'register_id' => $this->register->id,
            'store_id'    => $this->store->id,
            'cashier_id'  => $this->cashier->id,
            'opening_float' => '100.00',
            'status'      => 'open',
            'opened_at'   => now()->subDay()->setTime(9, 0),
        ]);
    }

    public function test_yesterday_status_flags_a_stale_session_for_the_cashier_without_cash_figures(): void
    {
        $this->openYesterday();

        $res = $this->actingAs($this->cashier, 'sanctum')
            ->getJson("/api/registers/yesterday-status?store_id={$this->store->id}")
            ->assertOk();

        $res->assertJsonPath('data.stale_sessions.0.cashier_name', $this->cashier->name);
        // Cash expectations are manager-only information.
        $this->assertNull($res->json('data.stale_sessions.0.expected_cash'));
    }

    public function test_manager_sees_expected_cash_on_the_stale_session(): void
    {
        $this->openYesterday();

        $this->actingAs($this->manager, 'sanctum')
            ->getJson("/api/registers/yesterday-status?store_id={$this->store->id}")
            ->assertOk()
            // opening float 100, no sales → expected 100.00
            ->assertJsonPath('data.stale_sessions.0.expected_cash', '100.00');
    }

    public function test_auto_close_only_runs_for_opted_in_stores_and_seals_as_system_closed(): void
    {
        $session = $this->openYesterday();

        // Not opted in → nothing happens.
        $this->artisan('registers:auto-close')->assertExitCode(0);
        $this->assertSame('open', $session->fresh()->status);

        // Opt in with a cutoff already passed today.
        $this->store->update(['settings' => array_merge($this->store->settings ?? [], [
            'auto_close_enabled' => true,
            'auto_close_time'    => '00:01',
        ])]);

        $this->artisan('registers:auto-close')->assertExitCode(0);
        $session->refresh();
        $this->assertSame('closed', $session->status);
        $this->assertTrue($session->system_closed);
        $this->assertNull($session->closing_cash_counted);        // not counted by design
        $this->assertSame('100.00', $session->expected_cash);      // but expected computed
        $this->assertTrue($session->needsReconciliation());
        $this->assertDatabaseHas('audit_logs', ['event' => 'register.auto_closed']);
    }

    public function test_manager_reconciles_a_system_closed_session(): void
    {
        $session = $this->openYesterday();
        $this->store->update(['settings' => array_merge($this->store->settings ?? [], [
            'auto_close_enabled' => true, 'auto_close_time' => '00:01',
        ])]);
        $this->artisan('registers:auto-close')->assertExitCode(0);

        // A mismatch without a note is rejected.
        $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/reconcile", ['counted_cash' => 95])
            ->assertStatus(422);

        // With a note it succeeds and records who + the discrepancy.
        $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/reconcile", [
                'counted_cash' => 95, 'note' => 'SRD 5 short — logged',
            ])
            ->assertOk();

        $session->refresh();
        $this->assertSame('95.00', $session->closing_cash_counted);
        $this->assertSame('-5.00', $session->discrepancy);
        $this->assertSame($this->manager->id, $session->reconciled_by);
        $this->assertNotNull($session->reconciled_at);
        $this->assertFalse($session->needsReconciliation());
        $this->assertDatabaseHas('audit_logs', ['event' => 'register.reconciled']);
    }

    public function test_cashier_cannot_reconcile(): void
    {
        $session = $this->openYesterday();
        $this->store->update(['settings' => array_merge($this->store->settings ?? [], [
            'auto_close_enabled' => true, 'auto_close_time' => '00:01',
        ])]);
        $this->artisan('registers:auto-close')->assertExitCode(0);

        $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/reconcile", ['counted_cash' => 100])
            ->assertForbidden();
    }

    public function test_store_settings_accept_the_end_of_day_knobs(): void
    {
        $this->actingAs($this->manager, 'sanctum')
            ->putJson("/api/stores/{$this->store->id}", [
                'settings' => [
                    'closing_time'       => '20:30',
                    'auto_close_enabled' => true,
                    'auto_close_time'    => '23:45',
                    'manager_name'       => 'Anita',
                    'manager_phone'      => '+597 123456',
                ],
            ])->assertOk();

        $s = $this->store->fresh()->settings;
        $this->assertSame('20:30', $s['closing_time']);
        $this->assertTrue($s['auto_close_enabled']);
        $this->assertSame('23:45', $s['auto_close_time']);
        $this->assertSame('+597 123456', $s['manager_phone']);
    }
    /**
     * The nightly auto-close must seal a session left open on a PREVIOUS day
     * even when it runs at an ordinary hour.
     *
     * It used to return early whenever now() was before tonight's cutoff. The
     * job runs every fifteen minutes, so with the default 23:59 cutoff the
     * 23:45 run was too early and the 00:00 run saw a cutoff that had already
     * rolled to the next night. The one-minute window was never sampled and
     * forgotten sessions stayed open indefinitely — which is exactly what was
     * found in the field.
     */
    public function test_auto_close_seals_a_previous_day_session_when_run_at_midday(): void
    {
        $this->store->update(['settings' => array_merge($this->store->settings ?? [], [
            'auto_close_enabled' => true,
            'auto_close_time'    => '23:59',
        ])]);

        $session = RegisterSession::create([
            'register_id'    => $this->register->id,
            'store_id'       => $this->store->id,
            'cashier_id'     => $this->cashier->id,
            'opening_float'  => 100,
            'status'         => 'open',
            'opened_at'      => now()->subDay()->setTime(11, 24),
        ]);

        // Midday — nowhere near the 23:59 cutoff.
        $this->travelTo(now()->setTime(12, 0));
        $this->artisan('registers:auto-close')->assertSuccessful();

        $this->assertSame('closed', $session->fresh()->status,
            'a session left open since yesterday was not sealed');
    }

}
