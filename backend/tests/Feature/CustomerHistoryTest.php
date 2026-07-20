<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Customer detail view — purchase history + statement export.
 *
 *   GET /api/customers/{customer}/history    (paginated JSON)
 *   GET /api/customers/{customer}/statement  (?from&to&format=pdf|csv&locale)
 *
 * Pins:
 *   - org scoping: a customer from another organisation is a 404 (P0-6
 *     pattern — never a 403 that confirms existence)
 *   - role gate mirrors the customers screen (customers.view; tax inspector
 *     has no customer access → 403)
 *   - statement totals are bcmath-exact against seeded DECIMAL strings,
 *     refunds (negative completed rows) netted correctly
 *   - PDF renders (200 + application/pdf + %PDF magic bytes — the G-031
 *     "blade compiles" safety net every PDF export needs)
 *
 * Auth uses REAL Sanctum tokens (createToken → withToken), not actingAs —
 * the session.timeout middleware breaks on TransientToken.
 */
class CustomerHistoryTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private string $managerToken;
    private Store $store;
    private Customer $customer;
    private Customer $otherOrgCustomer;
    private Carbon $now;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->manager      = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->managerToken = $this->manager->createToken('phpunit')->plainTextToken;

        $org         = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store = Store::where('organisation_id', $org->id)->firstOrFail();

        $this->customer = Customer::create([
            'organisation_id' => $org->id,
            'name'            => 'Ravi Bhagwandas',
            'phone'           => '+597 8123456',
        ]);

        // A customer in a DIFFERENT organisation — must be a 404 for De Hoop staff.
        $orgB = Organisation::create([
            'name'              => 'Toko Nickerie',
            'type'              => 'retail',
            'btw_number'        => 'BTW-SR-999999',
            'currency'          => 'SRD',
            'locale'            => 'nl',
            'is_government'     => false,
            'subscription_tier' => 'standard',
        ]);
        $this->otherOrgCustomer = Customer::create([
            'organisation_id' => $orgB->id,
            'name'            => 'Iemand Anders',
        ]);

        // Fixtures relative to now() in AST, never hardcoded dates (G-021).
        $this->now = Carbon::now('America/Paramaribo');

        // In default 90-day statement window (completed):
        $this->makeSale('HIST-1', $this->now->copy()->subDays(10), '100.00', '9.09',  'cash');
        $this->makeSale('HIST-2', $this->now->copy()->subDays(5),  '200.00', '18.18', 'card');
        $this->makeSale('HIST-3', $this->now->copy()->subDays(2),  '50.00',  '4.55',  'cash');
        // Refund = negative completed row with "REFUND:" void_reason (SaleRefundTest).
        $this->makeSale('HIST-4', $this->now->copy()->subDay(),    '-25.00', '-2.27', 'cash', 'completed', 'REFUND: retour defect product');
        // Voided — visible in history (with status), excluded from statement totals.
        $this->makeSale('HIST-V', $this->now->copy()->subDays(3),  '60.00',  '5.45',  'cash', 'voided', 'Test annulering');
        // Outside the default 90-day window — statement must exclude it.
        $this->makeSale('HIST-OLD', $this->now->copy()->subDays(100), '999.99', '90.91', 'cash');
    }

    private function makeSale(
        string $number,
        Carbon $at,
        string $total,
        string $btw,
        string $method,
        string $status = 'completed',
        ?string $voidReason = null,
    ): Sale {
        return Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->manager->id,
            'customer_id'        => $this->customer->id,
            'sale_number'        => $number,
            'subtotal_srd'       => $total,
            'discount_srd'       => '0.00',
            'btw_srd'            => $btw,
            'total_srd'          => $total,
            'payment_method'     => $method,
            'status'             => $status,
            'void_reason'        => $voidReason,
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => $at,
        ]);
    }

    // ─── History ──────────────────────────────────────────────────────────

    public function test_history_returns_own_org_customer_sales_and_paginates(): void
    {
        $response = $this->withToken($this->managerToken)
            ->getJson("/api/customers/{$this->customer->id}/history?per_page=2");

        $response->assertOk()
            ->assertJsonPath('total', 6)          // 5 completed (incl. refund + old) + 1 voided
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('last_page', 3)
            ->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [[
                'id', 'sale_number', 'occurred_at', 'store_name', 'total_srd',
                'btw_srd', 'discount_srd', 'payment_method', 'status', 'is_refund',
            ]]]);

        // Newest first — the refund row (1 day ago) leads, flagged as refund.
        $first = $response->json('data.0');
        $this->assertSame('HIST-4', $first['sale_number']);
        $this->assertTrue($first['is_refund']);
        $this->assertSame('-25.00', $first['total_srd']);
        $this->assertSame('completed', $first['status']);
        $this->assertSame($this->store->name, $first['store_name']);

        // Voided sale is present with its status. Desc order → page 2 row 1
        // is HIST-V (3 days ago), row 2 is HIST-2 (5 days ago).
        $page2 = $this->withToken($this->managerToken)
            ->getJson("/api/customers/{$this->customer->id}/history?per_page=2&page=2");
        $page2->assertOk();
        $this->assertSame('HIST-V', $page2->json('data.0.sale_number'));
        $this->assertSame('voided', $page2->json('data.0.status'));
        $this->assertFalse($page2->json('data.0.is_refund'));
    }

    public function test_history_cross_org_customer_is_404(): void
    {
        $this->withToken($this->managerToken)
            ->getJson("/api/customers/{$this->otherOrgCustomer->id}/history")
            ->assertNotFound();
    }

    public function test_statement_cross_org_customer_is_404(): void
    {
        $this->withToken($this->managerToken)
            ->getJson("/api/customers/{$this->otherOrgCustomer->id}/statement")
            ->assertNotFound();
    }

    // ─── Statement ────────────────────────────────────────────────────────

    public function test_statement_pdf_returns_a_pdf(): void
    {
        $response = $this->withToken($this->managerToken)
            ->get("/api/customers/{$this->customer->id}/statement?format=pdf");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_statement_csv_returns_totals_matching_seeded_sales(): void
    {
        $response = $this->withToken($this->managerToken)
            ->get("/api/customers/{$this->customer->id}/statement?format=csv");

        $response->assertOk();
        $this->assertStringStartsWith('text/csv', $response->headers->get('Content-Type'));

        $csv = $response->streamedContent();

        // Default window = last 90 AST days → HIST-1..4 only.
        // bcmath-exact: gross 100+200+50 = 350.00, refunds -25.00,
        // BTW 9.09+18.18+4.55-2.27 = 29.55, net 350.00-25.00 = 325.00.
        // fputcsv encloses fields containing spaces — labels arrive quoted.
        $this->assertStringContainsString('Klantoverzicht,"Ravi Bhagwandas"', $csv);
        $this->assertStringContainsString('"Aantal transacties",4', $csv);
        $this->assertStringContainsString('"Verkopen (SRD)",350.00', $csv);
        $this->assertStringContainsString('"Retouren (SRD)",-25.00', $csv);
        $this->assertStringContainsString('"Totaal BTW (SRD)",29.55', $csv);
        $this->assertStringContainsString('"Netto totaal (SRD)",325.00', $csv);

        // Outside-window and voided sales must not appear.
        $this->assertStringNotContainsString('999.99', $csv);
        $this->assertStringNotContainsString('HIST-V', $csv);
    }

    public function test_statement_respects_explicit_date_range(): void
    {
        $from = $this->now->copy()->subDays(120)->toDateString();
        $to   = $this->now->toDateString();

        $csv = $this->withToken($this->managerToken)
            ->get("/api/customers/{$this->customer->id}/statement?format=csv&from={$from}&to={$to}")
            ->assertOk()
            ->streamedContent();

        // 100-day-old sale now included: net 325.00 + 999.99 = 1324.99.
        $this->assertStringContainsString('HIST-OLD', $csv);
        $this->assertStringContainsString('"Aantal transacties",5', $csv);
        $this->assertStringContainsString('"Netto totaal (SRD)",1324.99', $csv);
    }

    public function test_statement_supports_english_locale(): void
    {
        $csv = $this->withToken($this->managerToken)
            ->get("/api/customers/{$this->customer->id}/statement?format=csv&locale=en")
            ->assertOk()
            ->streamedContent();

        $this->assertStringContainsString('Customer statement', $csv);
        $this->assertStringContainsString('"Net total (SRD)",325.00', $csv);
    }

    // ─── Role gate ────────────────────────────────────────────────────────

    public function test_role_without_customer_access_gets_403(): void
    {
        // Tax inspector has no customers.view (RolesAndPermissionsSeeder) —
        // 2fa_verified ability included because EnsureTwoFactor checks the
        // abilities array explicitly for their role.
        $inspector = User::where('email', 'belastingdienst@gov.sr')->firstOrFail();
        $token     = $inspector->createToken('phpunit', ['*', '2fa_verified'])->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/customers/{$this->customer->id}/history")
            ->assertForbidden();

        $this->withToken($token)
            ->getJson("/api/customers/{$this->customer->id}/statement")
            ->assertForbidden();
    }

    // ─── Aggregates on show ───────────────────────────────────────────────

    public function test_customer_show_includes_last_visit_at_aggregate(): void
    {
        $response = $this->withToken($this->managerToken)
            ->getJson("/api/customers/{$this->customer->id}");

        $response->assertOk()
            ->assertJsonStructure(['data' => ['id', 'name', 'total_spend_srd', 'visit_count', 'last_visit_at']]);

        // Newest sale is the refund row, 1 day ago.
        $lastVisit = $response->json('data.last_visit_at');
        $this->assertNotNull($lastVisit);
        $this->assertSame(
            $this->now->copy()->subDay()->toDateString(),
            Carbon::parse($lastVisit)->setTimezone('America/Paramaribo')->toDateString(),
        );
    }
}
