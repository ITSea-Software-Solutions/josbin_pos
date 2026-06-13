<?php

namespace Tests\Feature;

use App\Models\CashMovement;
use App\Models\Organisation;
use App\Models\Register;
use App\Models\RegisterSession;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Manual cash drawer movements (pay-in / pay-out) and their effect on the
 * register's expected cash at Z-Report time.
 */
class CashMovementTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private RegisterSession $session;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Cash Org', 'type' => 'retail', 'btw_number' => 'SR-CASH',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $store = Store::create([
            'organisation_id' => $org->id, 'name' => 'S', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $this->cashier = User::create([
            'name' => 'Kassa', 'email' => 'kassa-cash@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $store->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);

        $register = Register::create([
            'store_id' => $store->id, 'name' => 'Kassa 1', 'number' => 1, 'is_active' => true,
        ]);
        $this->session = RegisterSession::create([
            'register_id' => $register->id, 'store_id' => $store->id, 'cashier_id' => $this->cashier->id,
            'opening_float' => '500.00', 'status' => 'open', 'opened_at' => now(),
        ]);
    }

    private function move(string $direction, string $amount, string $reason = 'Test')
    {
        return $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$this->session->id}/cash-movements", [
                'direction' => $direction, 'amount' => $amount, 'reason' => $reason,
            ]);
    }

    public function test_pay_in_and_pay_out_adjust_expected_cash(): void
    {
        // Opening float 500. Pay in 150 (owner top-up), pay out 80 (supplier).
        $this->move('in', '150.00', 'Wisselgeld bijgevuld')->assertStatus(201);
        $this->move('out', '80.00', 'Leverancier betaald')
            ->assertStatus(201)
            // Echoed running expected = 500 + 150 − 80 = 570.
            ->assertJsonPath('data.expected_cash', '570.00');

        $this->assertDatabaseCount('cash_movements', 2);

        // The Z-Report surfaces the same numbers.
        $report = $this->actingAs($this->cashier, 'sanctum')
            ->getJson("/api/registers/sessions/{$this->session->id}/report")
            ->assertOk()->json('data.cash_drawer');

        $this->assertSame('500.00', $report['opening_float']);
        $this->assertSame('150.00', $report['pay_in']);
        $this->assertSame('80.00', $report['pay_out']);
        $this->assertSame('570.00', $report['expected']);
    }

    public function test_amount_must_be_positive_and_reason_required(): void
    {
        $this->move('in', '0', 'x')->assertStatus(422);
        $this->move('out', '-5', 'x')->assertStatus(422);
        $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/registers/sessions/{$this->session->id}/cash-movements", ['direction' => 'in', 'amount' => '10'])
            ->assertStatus(422); // reason missing
    }

    public function test_cannot_move_cash_on_a_closed_session(): void
    {
        $this->session->update(['status' => 'closed', 'closed_at' => now()]);
        $this->move('in', '10.00', 'late')->assertStatus(409);
    }

    public function test_movement_is_audited(): void
    {
        $this->move('out', '25.00', 'Bezorger fooi')->assertStatus(201);

        $this->assertDatabaseHas('audit_logs', [
            'event'        => 'register.cash_movement',
            'auditable_id' => $this->session->id,
        ]);
    }
}
