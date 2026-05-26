<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Register lifecycle: open → record sales/refunds → close → reopen lock.
 *
 * Critical correctness: at close-time RegisterController::computeExpectedCash
 * must subtract cash refunds (negative-total cash/mixed sale rows) from cash
 * IN — the bug fixed in commit 5bbc664. This test seeds a register session
 * with TWO cash sales and ONE refund and asserts the expected_cash, counted
 * cash, and discrepancy come out exactly right.
 */
class RegisterLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Organisation $org;
    private Register $register;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Bus::fake();

        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->org     = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $this->org->id)->firstOrFail();

        // Manager creates a register up-front (the only register on the store)
        $this->register = Register::create([
            'store_id'  => $this->store->id,
            'name'      => 'Kassa 1',
            'number'    => 1,
            'is_active' => true,
        ]);

        DailyRate::create([
            'date'        => today()->toDateString(),
            'usd_to_srd'  => '38.5000',
            'raw_rate'    => '37.5000',
            'markup_pct'  => '2.50',
            'source'      => 'manual',
            'locked_by'   => $this->manager->id,
            'locked_at'   => now(),
        ]);
    }

    // ─── Open + close (basic happy path, no sales) ───────────────────────────

    public function test_cashier_can_open_register_with_opening_float(): void
    {
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/open", [
                'opening_float' => 100.00,
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.status', 'open');
        $response->assertJsonPath('data.opening_float', '100.00');

        $this->assertDatabaseHas('register_sessions', [
            'register_id' => $this->register->id,
            'cashier_id'  => $this->cashier->id,
            'status'      => 'open',
        ]);
    }

    public function test_close_with_no_sales_yields_expected_cash_equals_opening_float(): void
    {
        $session = RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '100.00',
            'status'        => 'open',
            'opened_at'     => now(),
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/close", [
                'closing_cash_counted' => 100.00,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'closed');
        $response->assertJsonPath('data.expected_cash', '100.00');
        $response->assertJsonPath('data.discrepancy', '0.00');
    }

    // ─── The 5bbc664 fix: cash sales AND a cash refund both affect expected_cash ──

    public function test_expected_cash_subtracts_cash_refund_total(): void
    {
        // Open session with SRD 100 float
        $session = RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '100.00',
            'status'        => 'open',
            'opened_at'     => now(),
        ]);

        // Two cash sales: customer pays exact (no change) on the first, hands
        // 60 SRD for a 50.00 sale (10.00 change) on the second.
        $this->buildCashSale(session: $session, total: '50.00', cashReceived: '50.00', change: '0.00');
        $this->buildCashSale(session: $session, total: '50.00', cashReceived: '60.00', change: '10.00');

        // One cash REFUND of 20.00 — stored as a negative-total sale row, with
        // cash_received_srd and change_srd left null (refund money goes OUT of
        // the drawer, not in).
        $this->buildCashRefund(session: $session, total: '-20.00');

        // Expected cash drawer at close:
        //   100 (float) + (50 + 50) (cash IN, net of change) − 20 (cash OUT) = 180.00
        // Without the 5bbc664 fix the formula would only sum cash_received - change
        // and ignore the refund, yielding 200.00 — wrong by 20 SRD.

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/close", [
                'closing_cash_counted' => 180.00,
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.expected_cash', '180.00');
        $response->assertJsonPath('data.discrepancy', '0.00');
    }

    public function test_expected_cash_flags_shortage_as_negative_discrepancy(): void
    {
        $session = RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '50.00',
            'status'        => 'open',
            'opened_at'     => now(),
        ]);

        // SRD 30 cash sale → expected = 80.00
        $this->buildCashSale(session: $session, total: '30.00', cashReceived: '30.00', change: '0.00');

        // Cashier only counts 75.00 → SRD 5.00 short
        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$session->id}/close", [
                'closing_cash_counted'  => 75.00,
                'closing_note'          => 'Onderstaand 5 SRD — gemeld.',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.expected_cash', '80.00');
        $response->assertJsonPath('data.discrepancy',   '-5.00');
    }

    // ─── Z-Report lock: cashier blocked from re-opening same day ────────────

    public function test_cashier_cannot_reopen_a_register_that_was_closed_today(): void
    {
        // Create a closed-today session — simulating a finished shift
        RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '50.00',
            'expected_cash' => '50.00',
            'closing_cash_counted' => '50.00',
            'discrepancy'   => '0.00',
            'status'        => 'closed',
            'opened_at'     => now()->subHours(6),
            'closed_at'     => now()->subMinutes(10),
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/open", [
                'opening_float' => 100.00,
            ]);

        $response->assertStatus(409);
        $response->assertJsonPath('code', 'REGISTER_CLOSED_FOR_DAY');

        // No new open session created
        $openCount = RegisterSession::where('register_id', $this->register->id)
            ->where('status', 'open')->count();
        $this->assertSame(0, $openCount);
    }

    // ─── Manager clears lock for the next shift + audit-log entry ───────────

    public function test_manager_can_clear_closed_today_lock_and_audit_logs_event(): void
    {
        $closedSession = RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '50.00',
            'expected_cash' => '50.00',
            'closing_cash_counted' => '50.00',
            'discrepancy'   => '0.00',
            'status'        => 'closed',
            'opened_at'     => now()->subHours(6),
            'closed_at'     => now()->subMinutes(10),
        ]);

        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/clear-closed-today", [
                'reason'      => 'Volgende ploeg neemt over — kassa vrij gemaakt.',
                'for_cashier' => 'Anand (avondploeg)',
            ]);

        $response->assertStatus(200);
        $response->assertJsonPath('cleared_count', 1);

        // The session row stays status=closed (audit-honest), but cleared_at is set
        $closedSession->refresh();
        $this->assertSame('closed', $closedSession->status);
        $this->assertNotNull($closedSession->cleared_at);
        $this->assertSame($this->manager->id, $closedSession->cleared_by);

        // Audit log row recorded with event register.cleared_for_next_shift
        $this->assertDatabaseHas('audit_logs', [
            'user_id'         => $this->manager->id,
            'organisation_id' => $this->manager->organisation_id,
            'event'           => 'register.cleared_for_next_shift',
            'auditable_type'  => 'RegisterSession',
            'auditable_id'    => $closedSession->id,
        ]);

        // And the cashier can now re-open the register (lock cleared)
        $reopen = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/open", [
                'opening_float' => 80.00,
            ]);
        $reopen->assertStatus(201);
        $reopen->assertJsonPath('data.status', 'open');
    }

    public function test_clear_closed_today_returns_409_when_nothing_to_clear(): void
    {
        // No closed-today sessions exist on this register
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/clear-closed-today", [
                'reason' => 'Probeer leeg te wissen.',
            ]);

        $response->assertStatus(409);
        $response->assertJsonPath('code', 'NOTHING_TO_CLEAR');
    }

    public function test_cashier_cannot_clear_closed_today_only_managers(): void
    {
        RegisterSession::create([
            'register_id'   => $this->register->id,
            'store_id'      => $this->store->id,
            'cashier_id'    => $this->cashier->id,
            'opening_float' => '50.00',
            'status'        => 'closed',
            'opened_at'     => now()->subHours(6),
            'closed_at'     => now()->subMinutes(10),
        ]);

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/{$this->register->id}/clear-closed-today", [
                'reason' => 'Cashier should not be allowed.',
            ]);

        $response->assertStatus(403);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /**
     * Insert a completed cash sale tied to a register_session.
     * Matches the structure SaleController::store would build.
     */
    private function buildCashSale(
        RegisterSession $session,
        string $total,
        string $cashReceived,
        string $change,
    ): Sale {
        return Sale::create([
            'store_id'            => $session->store_id,
            'cashier_id'          => $session->cashier_id,
            'register_session_id' => $session->id,
            'sale_number'         => Sale::nextNumber($session->store_id),
            'subtotal_srd'        => $total,
            'discount_srd'        => '0.00',
            'btw_srd'             => '0.00', // not under test here
            'total_srd'           => $total,
            'payment_method'      => 'cash',
            'cash_received_srd'   => $cashReceived,
            'card_amount_srd'     => null,
            'change_srd'          => $change,
            'status'              => 'completed',
            'source'              => 'pos',
            'exchange_rate_used'  => '38.5000',
            'occurred_at'         => now(),
        ]);
    }

    /**
     * Insert a refund row (negative total, null cash/change — money goes OUT).
     */
    private function buildCashRefund(RegisterSession $session, string $total): Sale
    {
        return Sale::create([
            'store_id'            => $session->store_id,
            'cashier_id'          => $session->cashier_id,
            'register_session_id' => $session->id,
            'sale_number'         => Sale::nextNumber($session->store_id),
            'subtotal_srd'        => $total,
            'discount_srd'        => '0.00',
            'btw_srd'             => '0.00',
            'total_srd'           => $total,
            'payment_method'      => 'cash',
            'cash_received_srd'   => null,
            'card_amount_srd'     => null,
            'change_srd'          => null,
            'status'              => 'completed',
            'source'              => 'pos',
            'exchange_rate_used'  => '38.5000',
            'occurred_at'         => now(),
            'void_reason'         => 'REFUND: test refund',
        ]);
    }
}
