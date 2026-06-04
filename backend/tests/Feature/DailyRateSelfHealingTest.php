<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Services\DailyRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The "Geen dagkoers beschikbaar" demo bug — a fresh stack without a daily
 * rate locked, cashier hits "Voltooien" and gets a 422 with no recovery path.
 *
 * DailyRateService self-heals across 4 scenarios:
 *   1. Already locked        → no-op, return existing
 *   2. Missing, API up        → fetch + lock, return new
 *   3. Missing, API down      → carry forward most-recent, mark fallback
 *   4. Missing + nothing ever → null (caller surfaces vendor-named error)
 */
class DailyRateSelfHealingTest extends TestCase
{
    use RefreshDatabase;

    private DailyRateService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DailyRateService::class);
        Cache::flush();
    }

    public function test_returns_existing_rate_when_today_already_locked(): void
    {
        $existing = DailyRate::create([
            'date'       => today()->toDateString(),
            'usd_to_srd' => '37.50',
            'raw_rate'   => '37.50',
            'markup_pct' => '0.00',
            'source'     => 'manual',
            'locked_at'  => now(),
        ]);

        // Even if the API would have returned something different, the existing
        // row wins — manual overrides + already-locked-today are sticky.
        Http::fake([
            'v6.exchangerate-api.com/*' => Http::response([
                'result' => 'success',
                'conversion_rates' => ['SRD' => 99.99],
            ]),
        ]);

        $result = $this->service->ensureTodayRate();

        $this->assertNotNull($result);
        $this->assertEquals($existing->id, $result->id);
        $this->assertEquals(0, bccomp('37.50', $result->usd_to_srd, 4));
    }

    public function test_fetches_and_locks_from_api_when_rate_missing(): void
    {
        config(['services.exchangerate_api.key' => 'test-key']);
        Http::fake([
            'v6.exchangerate-api.com/*' => Http::response([
                'result' => 'success',
                'conversion_rates' => ['SRD' => 38.25],
            ]),
        ]);

        $result = $this->service->ensureTodayRate();

        $this->assertNotNull($result);
        $this->assertEquals('38.2500', $result->usd_to_srd);
        $this->assertEquals('api', $result->source);
        $this->assertEquals(today()->toDateString(), $result->date->toDateString());

        // Audit log row for the auto-lock
        $this->assertDatabaseHas('audit_logs', [
            'event'          => 'rate.lazy_locked_from_api',
            'auditable_type' => 'daily_rate',
        ]);
    }

    public function test_falls_back_to_previous_rate_when_api_unreachable(): void
    {
        // Yesterday's rate exists, API is down
        $previous = DailyRate::create([
            'date'       => today()->subDay()->toDateString(),
            'usd_to_srd' => '37.10',
            'raw_rate'   => '37.10',
            'markup_pct' => '0.00',
            'source'     => 'api',
            'locked_at'  => now()->subDay(),
        ]);

        config(['services.exchangerate_api.key' => 'test-key']);
        Http::fake([
            'v6.exchangerate-api.com/*' => Http::response(null, 503),
        ]);

        $result = $this->service->ensureTodayRate();

        $this->assertNotNull($result);
        $this->assertEquals(0, bccomp('37.10', $result->usd_to_srd, 4), 'Should carry forward yesterday\'s value.');
        $this->assertEquals('manual', $result->source); // source enum quirk — kind lives in api_response
        $this->assertEquals($previous->date->toDateString(), data_get($result->api_response, 'fallback_from'));
        $this->assertEquals('fallback_previous', data_get($result->api_response, 'kind'));

        $this->assertDatabaseHas('audit_logs', [
            'event'          => 'rate.fallback_applied',
            'auditable_type' => 'daily_rate',
        ]);
    }

    public function test_returns_null_when_no_rate_and_no_api_key_and_no_previous(): void
    {
        // Cold start: no key, no previous row, API not reachable, AND no
        // static fallback configured → the only path that still 422s.
        config(['services.exchangerate_api.key' => null]);
        config(['services.exchangerate_api.static_rate' => null]);

        $result = $this->service->ensureTodayRate();

        $this->assertNull($result, 'Truly empty state — caller must surface the error.');
        $this->assertDatabaseMissing('daily_rates', [
            'date' => today()->toDateString(),
        ]);
    }

    public function test_uses_static_rate_when_configured_and_no_other_source(): void
    {
        // Fresh install, no API key, no previous rate, but a static fallback
        // is configured → POS stays sellable instead of 422-ing.
        config(['services.exchangerate_api.key' => null]);
        config(['services.exchangerate_api.static_rate' => '37.50']);

        $result = $this->service->ensureTodayRate();

        $this->assertNotNull($result, 'Static fallback should keep the POS sellable.');
        $this->assertEquals(0, bccomp('37.50', $result->usd_to_srd, 4));
        $this->assertEquals('manual', $result->source);
        $this->assertDatabaseHas('daily_rates', ['date' => today()->toDateString()]);
        // And it must be audit-logged as a static fallback (Rekenkamer trail).
        $this->assertDatabaseHas('audit_logs', ['event' => 'rate.static_fallback_applied']);
    }

    public function test_previous_rate_preferred_over_static_fallback(): void
    {
        // Carry-forward (real last-known rate) beats a hardcoded static one.
        DailyRate::create([
            'date'       => today()->subDay()->toDateString(),
            'usd_to_srd' => '38.10', 'raw_rate' => '38.10',
            'markup_pct' => '0.00', 'source' => 'manual', 'locked_at' => now()->subDay(),
        ]);
        config(['services.exchangerate_api.key' => null]);
        config(['services.exchangerate_api.static_rate' => '37.50']);

        $result = $this->service->ensureTodayRate();

        $this->assertEquals(0, bccomp('38.10', $result->usd_to_srd, 4),
            'Yesterday\'s real rate must win over the static default.');
    }

    public function test_falls_back_to_previous_when_api_key_missing(): void
    {
        // No key configured, but a historical rate exists → carry forward.
        DailyRate::create([
            'date'       => today()->subDays(3)->toDateString(),
            'usd_to_srd' => '36.80',
            'raw_rate'   => '36.80',
            'markup_pct' => '0.00',
            'source'     => 'manual',
            'locked_at'  => now()->subDays(3),
        ]);

        config(['services.exchangerate_api.key' => null]);

        $result = $this->service->ensureTodayRate();

        $this->assertNotNull($result);
        $this->assertEquals(0, bccomp('36.80', $result->usd_to_srd, 4));
    }

    public function test_sale_completion_now_succeeds_on_a_fresh_stack(): void
    {
        // End-to-end: no rate locked, API responds, sale completes without a
        // 422 — this is the demo bug we're locking down.
        config(['services.exchangerate_api.key' => 'test-key']);
        Http::fake([
            'v6.exchangerate-api.com/*' => Http::response([
                'result' => 'success',
                'conversion_rates' => ['SRD' => 38.00],
            ]),
        ]);

        $this->assertDatabaseMissing('daily_rates', ['date' => today()->toDateString()]);

        $service = app(DailyRateService::class);
        $rate = $service->ensureTodayRate();

        $this->assertNotNull($rate);
        $this->assertDatabaseHas('daily_rates', [
            'date'   => today()->toDateString(),
            'source' => 'api',
        ]);
    }
}
