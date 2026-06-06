<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organisation;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * WBP-S right-to-erasure (P0-7) + PII audit trail (P0-8).
 *
 *   - OA can redact a customer: PII gone, counters + row kept, audit written.
 *   - Cashier cannot redact (403) — it's a data-controller action.
 *   - Viewing a customer writes a customer.accessed row (read trace).
 */
class CustomerErasureTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $oa;
    private User $cashier;
    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Erasure Org', 'type' => 'retail', 'btw_number' => 'SR-E',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        $this->oa = User::create([
            'name' => 'OA', 'email' => 'oa-e@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->cashier = User::create([
            'name' => 'C', 'email' => 'c-e@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'role' => User::ROLE_CASHIER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->cashier->assignRole(User::ROLE_CASHIER);

        $this->customer = Customer::create([
            'organisation_id' => $this->org->id,
            'name' => 'Jan Pengel', 'phone' => '+597 8881111',
            'email' => 'jan@example.sr', 'id_number' => 'SR-ID-123',
            'total_spend_srd' => '450.00', 'visit_count' => 9,
        ]);
    }

    public function test_oa_can_redact_customer_pii_but_keeps_the_record(): void
    {
        $this->actingAs($this->oa, 'sanctum')
            ->deleteJson("/api/customers/{$this->customer->id}")
            ->assertOk();

        $fresh = Customer::find($this->customer->id);
        $this->assertNotNull($fresh, 'Row must survive so historical sales keep their FK.');

        // PII erased.
        $this->assertNull($fresh->phone);
        $this->assertNull($fresh->email);
        $this->assertNull($fresh->id_number);
        $this->assertStringContainsString('verwijderd', $fresh->name);
        $this->assertFalse((bool) $fresh->is_active);

        // Search hashes nulled so the tombstone isn't discoverable.
        $this->assertNull($fresh->getRawOriginal('name_hash'));
        $this->assertNull($fresh->getRawOriginal('phone_hash'));

        // Aggregate counters preserved for reporting.
        $this->assertEquals('450.00', (string) $fresh->total_spend_srd);
        $this->assertEquals(9, $fresh->visit_count);

        // Hash-chained audit row written.
        $this->assertDatabaseHas('audit_logs', [
            'event'          => 'customer.redacted',
            'auditable_id'   => $this->customer->id,
            'organisation_id'=> $this->org->id,
        ]);
    }

    public function test_cashier_cannot_redact_customer(): void
    {
        $this->actingAs($this->cashier, 'sanctum')
            ->deleteJson("/api/customers/{$this->customer->id}")
            ->assertForbidden();

        // PII intact.
        $this->assertNotNull(Customer::find($this->customer->id)->phone);
    }

    public function test_viewing_a_customer_writes_an_access_audit(): void
    {
        $this->actingAs($this->oa, 'sanctum')
            ->getJson("/api/customers/{$this->customer->id}")
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'event'        => 'customer.accessed',
            'auditable_id' => $this->customer->id,
        ]);
    }
}
