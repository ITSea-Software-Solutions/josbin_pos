<?php

namespace App\Console\Commands;

use App\Services\DailyRateService;
use Illuminate\Console\Command;

/**
 * rates:ensure-today
 *
 * Idempotent safety-net command: makes sure a daily_rate row exists for today.
 * Used in three contexts:
 *
 *   1. Scheduled every 30 min (defense in depth — recovers if the 06:00
 *      rates:lock run failed because the API was down or the scheduler was
 *      restarting at that exact moment).
 *
 *   2. Called from the app container's entrypoint so a freshly-booted
 *      container is never "online but unable to sell."
 *
 *   3. Manual rescue: `docker exec josbin_demo_app php artisan rates:ensure-today`
 *      when an OA realises mid-morning that something's off.
 *
 * Does NOT overwrite an existing rate — if today's row is already there
 * (whether the OA set it manually or the morning fetch ran), this is a no-op.
 *
 * Output is one line so the scheduler log stays readable.
 */
class EnsureTodayRate extends Command
{
    protected $signature   = 'rates:ensure-today';
    protected $description = "Make sure today's USD→SRD rate exists; auto-fetch or fall back to yesterday if not";

    public function handle(DailyRateService $service): int
    {
        $rate = $service->ensureTodayRate();

        if (! $rate) {
            $this->warn('No rate could be established (no API key and no historical rate to carry forward). POS will block sales until the Org Admin sets one manually.');
            return self::FAILURE;
        }

        $kind = $rate->source === 'manual'
            ? (data_get($rate->api_response, 'kind') === 'fallback_previous' ? 'fallback-from-' . data_get($rate->api_response, 'fallback_from', '?') : 'manual')
            : $rate->source;

        $this->info("Today's rate ready: SRD {$rate->usd_to_srd}/USD (source: {$kind})");
        return self::SUCCESS;
    }
}
