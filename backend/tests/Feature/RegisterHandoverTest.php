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
 * Self-service shift handover (org policy, default OFF).
 *
 * Default: a register closed today is sealed — the next shift needs a
 * manager (the strict model). With the policy ON, the incoming cashier
 * opens a NEW session with their own float; the closed session stays
 * closed and counted. 10-counter × 3-shift stores run this way (the
 * lade-wissel model) — without it a manager taps "reopen" ~20×/day.
 */
class RegisterHandoverTest extends TestCase
{
    use RefreshDatabase;

    private User $cashierA;
    private User $cashierB;
    private Organisation $org;
    private Register $register;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();
        Bus::fake();
        $this->seed(DatabaseSeeder::class);

        $this->cashierA = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->org      = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        // The base seeder ships no registers — create one on cashier A's
        // own store, the same way the till would have it in production.
        $store          = Store::findOrFail($this->cashierA->store_id);
        $this->register = Register::create([
            'store_id'  => $store->id,
            'number'    => 1,
            'name'      => 'Kassa 1',
            'is_active' => true,
        ]);

        // Second cashier for the incoming shift, same store.
        $this->cashierB = User::factory()->create([
            'organisation_id' => $this->org->id,
            'store_id'        => $store->id,
            'role'            => 'cashier',
        ]);
        $this->cashierB->assignRole('cashier');

        // Shift 1 already happened: opened and closed TODAY, drawer counted.
        RegisterSession::create([
            'register_id'          => $this->register->id,
            'store_id'             => $store->id,
            'cashier_id'           => $this->cashierA->id,
            'opening_float'        => '200.00',
            'status'               => 'closed',
            'opened_at'            => now()->subHours(8),
            'closed_at'            => now()->subMinutes(10),
            'closing_cash_counted' => '200.00',
            'expected_cash'        => '200.00',
        ]);
    }

    private function openAs(User $u)
    {
        return $this->actingAs($u, 'sanctum')->postJson(
            "/api/registers/{$this->register->id}/open",
            ['opening_float' => 150.00],
        );
    }

    public function test_default_policy_blocks_next_shift_without_manager(): void
    {
        $this->openAs($this->cashierB)
            ->assertStatus(409)
            ->assertJsonPath('code', 'REGISTER_CLOSED_FOR_DAY');
    }

    public function test_policy_on_lets_next_shift_open_a_fresh_session(): void
    {
        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);

        $res = $this->openAs($this->cashierB);
        $res->assertStatus(201);

        // A NEW session for cashier B with their own float — and shift 1's
        // closed, counted session is untouched.
        $sessions = RegisterSession::where('register_id', $this->register->id)
            ->orderBy('opened_at')->get();
        $this->assertCount(2, $sessions);
        $this->assertSame('closed', $sessions[0]->status);
        $this->assertSame('200.00', (string) $sessions[0]->closing_cash_counted);
        $this->assertSame('open', $sessions[1]->status);
        $this->assertSame($this->cashierB->id, $sessions[1]->cashier_id);
        $this->assertSame('150.00', (string) $sessions[1]->opening_float);
    }

    public function test_policy_on_still_blocks_opening_over_a_live_session(): void
    {
        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);

        $this->openAs($this->cashierB)->assertStatus(201);

        // A third cashier cannot open while B's session is live — handover
        // relaxes the closed-today seal, never the one-session-at-a-time rule.
        $cashierC = User::factory()->create([
            'organisation_id' => $this->org->id,
            'store_id'        => $this->register->store_id,
            'role'            => 'cashier',
        ]);
        $cashierC->assignRole('cashier');

        $this->openAs($cashierC)
            ->assertStatus(409)
            ->assertJsonPath('code', 'REGISTER_ALREADY_OPEN');
    }

    public function test_registers_index_exposes_the_policy_flag(): void
    {
        $this->actingAs($this->cashierA, 'sanctum')
            ->getJson('/api/registers?store_id='.$this->register->store_id)
            ->assertOk()
            ->assertJsonPath('self_service_handover', false);

        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);

        $this->actingAs($this->cashierA, 'sanctum')
            ->getJson('/api/registers?store_id='.$this->register->store_id)
            ->assertOk()
            ->assertJsonPath('self_service_handover', true);
    }

    public function test_manager_can_force_close_anothers_open_session_with_attribution(): void
    {
        // Cashier B opens a live session…
        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);
        $this->openAs($this->cashierB)->assertStatus(201);
        $session = RegisterSession::where('register_id', $this->register->id)
            ->where('status', 'open')->firstOrFail();

        // …and the manager closes it from the dashboard with a count.
        $manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $manager->forceFill(['store_id' => $this->register->store_id])->save();

        $this->actingAs($manager, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/close", [
                'closing_cash_counted' => 150.00,
                'closing_note'         => 'cashier went home sick',
            ])
            ->assertOk();

        $session->refresh();
        $this->assertSame('closed', $session->status);
        // The note names the closer — the count is the manager's statement.
        $this->assertStringContainsString('closed by', $session->closing_note);
        $this->assertStringContainsString($manager->name, $session->closing_note);
        $this->assertStringContainsString('cashier went home sick', $session->closing_note);
    }

    public function test_a_cashier_reopening_their_own_live_session_just_resumes_it(): void
    {
        // The cashier closed the app / logged out / the till restarted
        // mid-shift. Coming back to the gate must return them to their own
        // session, not tell them the register is "already open" by someone
        // who is in fact themselves. Also makes the call idempotent, so a
        // duplicated open request cannot surface as a 409.
        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);
        $first = $this->openAs($this->cashierB)->assertStatus(201);
        $sessionId = $first->json('data.id');

        $again = $this->openAs($this->cashierB)->assertOk();

        $this->assertSame($sessionId, $again->json('data.id'), 'must be the same session, not a new one');
        $this->assertTrue($again->json('resumed'));
        $this->assertSame(
            1,
            RegisterSession::where('register_id', $this->register->id)->where('status', 'open')->count(),
            'resuming must not create a second open session',
        );
    }

    public function test_another_cashier_is_still_blocked_by_a_live_session(): void
    {
        $this->org->update(['settings' => array_merge($this->org->settings ?? [], [
            'register_policy' => ['self_service_handover' => true],
        ])]);
        $this->openAs($this->cashierB)->assertStatus(201);

        // Resuming is for the session's OWNER only — it must never become a
        // way for one cashier to walk into another's open drawer.
        $this->openAs($this->cashierA)
            ->assertStatus(409)
            ->assertJsonPath('code', 'REGISTER_ALREADY_OPEN');
    }
}
