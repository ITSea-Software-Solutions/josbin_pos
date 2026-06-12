<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * PERF-1 safety net — report date windows must bucket sales by their AST
 * calendar day, not the UTC day.
 *
 * The two sales below straddle midnight in AST but fall on the SAME UTC day:
 *   - 2026-06-10 23:30 AST  ==  2026-06-11 02:30 UTC
 *   - 2026-06-11 00:30 AST  ==  2026-06-11 03:30 UTC
 *
 * A correct AST report puts the first on the 10th and the second on the 11th.
 * This pins that behaviour so the whereDate → indexable-range refactor cannot
 * silently shift a sale across a tax-period boundary (the G-022 / G-023 class
 * of bug, on the report side this time).
 */
class ReportDateBoundaryTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $org           = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $org->id)->firstOrFail();

        DailyRate::firstOrCreate(['date' => today()->toDateString()], [
            'usd_to_srd' => '38.5000', 'raw_rate' => '37.5000', 'markup_pct' => '2.50',
            'source' => 'manual', 'locked_by' => $this->manager->id, 'locked_at' => now(),
        ]);

        $this->makeSale('2026-06-10 23:30:00', '100.00', 'POS-B1');  // late 10th AST
        $this->makeSale('2026-06-11 00:30:00', '250.00', 'POS-B2');  // early 11th AST
    }

    private function makeSale(string $astTime, string $total, string $number): void
    {
        Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->manager->id,
            'sale_number'        => $number,
            'subtotal_srd'       => $total,
            'discount_srd'       => '0.00',
            'btw_srd'            => '0.00',
            'total_srd'          => $total,
            'payment_method'     => 'cash',
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => Carbon::parse($astTime, 'America/Paramaribo'),
        ]);
    }

    private function report(string $from, string $to): array
    {
        return $this->actingAs($this->manager, 'sanctum')
            ->getJson("/api/reports/custom?store_id={$this->store->id}&date_from={$from}&date_to={$to}")
            ->assertOk()
            ->json('data');
    }

    public function test_sale_buckets_into_its_ast_day_not_the_utc_day(): void
    {
        // 10th: only the 23:30 AST sale (SRD 100).
        $tenth = $this->report('2026-06-10', '2026-06-10');
        $this->assertSame(1, $tenth['transaction_count']);
        $this->assertSame('100.00', $tenth['total_sales_srd']);

        // 11th: only the 00:30 AST sale (SRD 250).
        $eleventh = $this->report('2026-06-11', '2026-06-11');
        $this->assertSame(1, $eleventh['transaction_count']);
        $this->assertSame('250.00', $eleventh['total_sales_srd']);

        // Range spanning both: both sales (SRD 350).
        $both = $this->report('2026-06-10', '2026-06-11');
        $this->assertSame(2, $both['transaction_count']);
        $this->assertSame('350.00', $both['total_sales_srd']);
    }
}
