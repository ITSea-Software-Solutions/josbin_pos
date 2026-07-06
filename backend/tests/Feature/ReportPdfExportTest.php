<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Render-path safety net for every PDF report export.
 *
 * These endpoints render Blade → DomPDF and shipped with ZERO feature
 * coverage, so all four report templates were broken from the initial
 * commit (glued `@else`/`@endif` after a word character never compile —
 * G-031) and `reports/summary.blade.php` additionally read keys that
 * `buildRangeSummary()` doesn't emit. Every request 500'd; nothing caught it.
 *
 * Each test asserts a real 200 + application/pdf + %PDF magic bytes, so a
 * template that doesn't compile or a blade↔controller data-contract drift
 * can never again break silently.
 */
class ReportPdfExportTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private User $orgAdmin;
    private Store $store;
    private Carbon $today;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->manager  = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->orgAdmin = User::where('email', 'orgadmin@dehoop.sr')->firstOrFail();
        $org            = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store    = Store::where('organisation_id', $org->id)->firstOrFail();

        DailyRate::firstOrCreate(['date' => today()->toDateString()], [
            'usd_to_srd' => '38.5000', 'raw_rate' => '37.5000', 'markup_pct' => '2.50',
            'source' => 'manual', 'locked_by' => $this->manager->id, 'locked_at' => now(),
        ]);

        // Fixtures relative to now() in AST, never a hardcoded date (G-021).
        // Three payment methods so the 7-method table renders live data, and
        // a sale_items row so the top-products table's key contract
        // (product_name / quantity / revenue_srd) is exercised, not skipped.
        $this->today = Carbon::now('America/Paramaribo');
        $this->makeSale($this->today->copy()->setTime(9, 15),  '110.00', 'PDF-1', 'cash');
        $this->makeSale($this->today->copy()->setTime(11, 40), '250.00', 'PDF-2', 'card');
        $this->makeSale($this->today->copy()->setTime(14, 5),  '75.50',  'PDF-3', 'qr_payment');
    }

    private function makeSale(Carbon $at, string $total, string $number, string $method): void
    {
        $sale = Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->manager->id,
            'sale_number'        => $number,
            'subtotal_srd'       => $total,
            'discount_srd'       => '0.00',
            'btw_srd'            => '10.00',
            'total_srd'          => $total,
            'payment_method'     => $method,
            'payment_provider'   => $method === 'qr_payment' ? 'MOPE' : null,
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => $at,
        ]);

        SaleItem::create([
            'sale_id'               => $sale->id,
            'product_id'            => null,
            'product_name_snapshot' => 'Testproduct ' . $number,
            'unit_price_srd'        => $total,
            'quantity'              => '1.000',
            'discount_srd'          => '0.00',
            'btw_rate'              => '10.00',
            'btw_exempt'            => false,
            'btw_srd'               => '10.00',
            'line_total_srd'        => $total,
        ]);
    }

    private function assertIsPdf($response): void
    {
        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    // ─── Store-level export (ReportController::export → reports.summary) ──

    public function test_daily_export_returns_a_pdf(): void
    {
        $date = $this->today->toDateString();

        $this->assertIsPdf(
            $this->actingAs($this->manager, 'sanctum')
                ->get("/api/reports/export?type=daily&store_id={$this->store->id}&date={$date}")
        );
    }

    public function test_monthly_export_accepts_year_and_month(): void
    {
        // The POS Reports screen sends ?year&month for the monthly tab —
        // the exact contract of GET /reports/monthly. This pins that the
        // export accepts the same params instead of expecting date_from/to.
        $this->assertIsPdf(
            $this->actingAs($this->manager, 'sanctum')
                ->get("/api/reports/export?type=monthly&store_id={$this->store->id}"
                    . "&year={$this->today->year}&month={$this->today->month}")
        );
    }

    public function test_custom_range_export_returns_a_pdf(): void
    {
        $from = $this->today->copy()->subDays(7)->toDateString();
        $to   = $this->today->toDateString();

        $this->assertIsPdf(
            $this->actingAs($this->manager, 'sanctum')
                ->get("/api/reports/export?type=custom&store_id={$this->store->id}"
                    . "&date_from={$from}&date_to={$to}")
        );
    }

    public function test_btw_type_is_a_validation_error_not_a_500(): void
    {
        // The old code accepted type=btw, passed an empty array to the blade
        // and 500'd. Until the Belastingdienst PDF layout ships (SPOS-209),
        // btw must be rejected cleanly at validation.
        $this->actingAs($this->manager, 'sanctum')
            ->getJson("/api/reports/export?type=btw&store_id={$this->store->id}")
            ->assertStatus(422)
            ->assertJsonValidationErrors(['type']);
    }

    // ─── The other three PDF render paths (same G-031 template bug) ───────

    public function test_rekenkamer_export_returns_a_pdf(): void
    {
        $from = $this->today->copy()->subDays(7)->toDateString();
        $to   = $this->today->toDateString();

        $response = $this->actingAs($this->orgAdmin, 'sanctum')
            ->get("/api/reports/rekenkamer?date_from={$from}&date_to={$to}");

        $this->assertIsPdf($response);
        $response->assertHeader('X-Document-Hash');
    }

    public function test_dashboard_consolidated_export_returns_a_pdf(): void
    {
        $from = $this->today->copy()->subDays(7)->toDateString();
        $to   = $this->today->toDateString();

        $this->assertIsPdf(
            $this->actingAs($this->orgAdmin, 'sanctum')
                ->get("/api/dashboard/reports/consolidated/export?date_from={$from}&date_to={$to}")
        );
    }

    public function test_dashboard_btw_export_returns_a_pdf(): void
    {
        $from = $this->today->copy()->subDays(7)->toDateString();
        $to   = $this->today->toDateString();

        $this->assertIsPdf(
            $this->actingAs($this->orgAdmin, 'sanctum')
                ->get("/api/dashboard/reports/btw/export?date_from={$from}&date_to={$to}")
        );
    }
}
