<?php

namespace App\Console\Commands;

use App\Models\DailyRate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * rates:lock
 *
 * Fetches today's USD→SRD rate from ExchangeRate-API and locks it in the
 * daily_rates table. Scheduled at 06:00 AST (America/Paramaribo).
 *
 * If a rate for today already exists (manually set or previously fetched),
 * this command does NOT overwrite it — manual overrides are preserved.
 *
 * ExchangeRate-API: https://www.exchangerate-api.com
 * NOTE: Frankfurter (ECB) does NOT support SRD — never use it.
 */
class LockDailyRate extends Command
{
    protected $signature   = 'rates:lock {--force : Overwrite even if rate already exists}';
    protected $description = 'Fetch and lock the daily USD→SRD exchange rate from ExchangeRate-API';

    public function handle(): int
    {
        $today = today()->toDateString();

        if (! $this->option('force')) {
            $existing = DailyRate::where('date', $today)->first();
            if ($existing) {
                $this->info("Rate for {$today} already locked: SRD {$existing->usd_to_srd}/USD (source: {$existing->source})");
                return self::SUCCESS;
            }
        }

        $apiKey = config('services.exchangerate_api.key');
        if (! $apiKey) {
            $this->error('EXCHANGERATE_API_KEY is not set. Cannot fetch live rate.');
            $this->fallbackToYesterday($today);
            return self::FAILURE;
        }

        try {
            $response = Http::timeout(10)
                ->get("https://v6.exchangerate-api.com/v6/{$apiKey}/latest/USD");

            if (! $response->successful()) {
                throw new \RuntimeException("API returned HTTP " . $response->status());
            }

            $data = $response->json();

            if (($data['result'] ?? '') !== 'success') {
                throw new \RuntimeException("API error: " . ($data['error-type'] ?? 'unknown'));
            }

            $rawRate = (string) ($data['conversion_rates']['SRD'] ?? null);
            if (! $rawRate || (float) $rawRate <= 0) {
                throw new \RuntimeException("SRD not found in API response.");
            }

            $markupPct = (string) config('services.exchangerate_api.markup_pct', '0.00');
            $markup    = bcmul($rawRate, bcdiv($markupPct, '100', 6), 6);
            $finalRate = bcadd($rawRate, $markup, 4);

            DailyRate::updateOrCreate(
                ['date' => $today],
                [
                    'usd_to_srd'   => $finalRate,
                    'raw_rate'     => $rawRate,
                    'markup_pct'   => $markupPct,
                    'source'       => 'api',
                    'locked_at'    => now(),
                    'api_response' => $data,
                ]
            );

            // Cache for 24h so API controllers skip DB lookups
            Cache::put('daily_rate:' . $today, $finalRate, 86400);

            $this->info("Rate locked for {$today}: SRD {$finalRate}/USD (raw: {$rawRate}, markup: {$markupPct}%)");

        } catch (\Throwable $e) {
            $this->error("Failed to fetch rate: " . $e->getMessage());
            Log::error('rates:lock failed', ['error' => $e->getMessage()]);
            $this->fallbackToYesterday($today);
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /**
     * If API is unreachable, carry forward yesterday's rate with a warning.
     */
    private function fallbackToYesterday(string $today): void
    {
        $yesterday = today()->subDay()->toDateString();
        $prev = DailyRate::where('date', $yesterday)->first();

        if (! $prev) {
            $this->warn("No fallback rate available. POS will block sales until a rate is set manually.");
            return;
        }

        DailyRate::updateOrCreate(
            ['date' => $today],
            [
                'usd_to_srd'   => $prev->usd_to_srd,
                'raw_rate'     => $prev->raw_rate,
                'markup_pct'   => $prev->markup_pct,
                'source'       => 'manual',
                'locked_at'    => now(),
                'api_response' => ['fallback_from' => $yesterday],
            ]
        );

        Cache::put('daily_rate:' . $today, $prev->usd_to_srd, 86400);

        $this->warn("Used yesterday's rate as fallback: SRD {$prev->usd_to_srd}/USD. Check API connectivity.");
    }
}
