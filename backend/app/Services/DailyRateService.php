<?php

namespace App\Services;

use App\Models\DailyRate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Single source of truth for "what rate do we use for sales right now?"
 *
 * Was previously inline in LockDailyRate (scheduled command) — that meant if
 * the scheduler hadn't run yet today (fresh demo stack, container outage at
 * 06:00, network drop), the cashier hit "Voltooien" mid-sale and got
 * "Geen dagkoers beschikbaar" — a hard 422 with no recovery path.
 *
 * This service is called inline from SaleController BEFORE the rate check so
 * the four scenarios all resolve gracefully:
 *
 *   1. Today's rate already locked       → return it
 *   2. Today missing, API reachable       → fetch + lock + return it
 *   3. Today missing, API unreachable     → carry forward yesterday's, mark
 *                                           source='fallback_previous', return
 *   4. Today missing, no yesterday either → return null (truly first-day
 *                                           install — the manager has to set
 *                                           one manually via Dashboard →
 *                                           Daily Rate)
 *
 * Audit log records 2/3 distinctly so the OA can see when the system had to
 * improvise. Belastingdienst won't care, but Rekenkamer will.
 */
class DailyRateService
{
    /**
     * Return today's locked rate, attempting to self-heal if missing.
     */
    public function ensureTodayRate(): ?DailyRate
    {
        $today = today()->toDateString();

        // Layer 1 — already locked. Fast path.
        $existing = DailyRate::where('date', $today)->first();
        if ($existing) {
            return $existing;
        }

        // Layer 2 — try the live API.
        $fetched = $this->tryFetchFromApi($today);
        if ($fetched) {
            return $fetched;
        }

        // Layer 3 — carry forward yesterday's locked rate.
        $fallback = $this->tryFallbackToPrevious($today);
        if ($fallback) {
            return $fallback;
        }

        // Layer 4 — truly empty. Caller (SaleController) translates this to a
        // human-readable error pointing at Settings → Daily Rate + vendor support.
        return null;
    }

    /**
     * Attempt to fetch + lock today's rate from ExchangeRate-API.
     * Returns the locked DailyRate on success, null on failure.
     */
    private function tryFetchFromApi(string $today): ?DailyRate
    {
        $apiKey = config('services.exchangerate_api.key');
        // Treat an unset OR shipped-placeholder key as "no key" so we skip a
        // doomed 5s HTTP call (the API answers 403 invalid-key) and fall
        // straight through to carry-forward. A real install replaces this in
        // the server .env: EXCHANGERATE_API_KEY=<real key>.
        $placeholders = ['your_api_key_here', 'your_api_key', 'changeme', 'replace_me'];
        if (! $apiKey || in_array($apiKey, $placeholders, true)) {
            return null;
        }

        try {
            $response = Http::timeout(5)
                ->get("https://v6.exchangerate-api.com/v6/{$apiKey}/latest/USD");

            if (! $response->successful()) {
                throw new \RuntimeException("API HTTP {$response->status()}");
            }

            $data = $response->json();
            if (($data['result'] ?? '') !== 'success') {
                throw new \RuntimeException('API error: ' . ($data['error-type'] ?? 'unknown'));
            }

            $rawRate = (string) ($data['conversion_rates']['SRD'] ?? null);
            if (! $rawRate || (float) $rawRate <= 0) {
                throw new \RuntimeException('SRD not in API response');
            }

            $markupPct = (string) config('services.exchangerate_api.markup_pct', '0.00');
            $finalRate = bcadd($rawRate, bcmul($rawRate, bcdiv($markupPct, '100', 6), 6), 4);

            $rate = DailyRate::updateOrCreate(
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

            Cache::put("daily_rate:{$today}", $finalRate, 86400);
            $this->auditRateEvent('rate.lazy_locked_from_api', $rate);

            return $rate;
        } catch (\Throwable $e) {
            Log::warning('DailyRateService::tryFetchFromApi failed', [
                'date'  => $today,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Carry forward yesterday's rate when API is unreachable. Marked
     * source='fallback_previous' + audit-logged so the OA knows it happened.
     */
    private function tryFallbackToPrevious(string $today): ?DailyRate
    {
        $previous = DailyRate::orderByDesc('date')->first();
        if (! $previous) {
            return null;
        }

        // Source enum only admits 'api' | 'manual' today; LockDailyRate uses
        // 'manual' for the same scenario, so we match. The "this was an
        // automated carry-forward, not a human override" detail lives in
        // api_response.fallback_from + the audit_logs row below.
        $rate = DailyRate::updateOrCreate(
            ['date' => $today],
            [
                'usd_to_srd'   => $previous->usd_to_srd,
                'raw_rate'     => $previous->raw_rate,
                'markup_pct'   => $previous->markup_pct,
                'source'       => 'manual',
                'locked_at'    => now(),
                'api_response' => [
                    'fallback_from' => $previous->date->toDateString(),
                    'kind'          => 'fallback_previous',
                    'reason'        => 'API unreachable on first sale of the day',
                ],
            ]
        );

        Cache::put("daily_rate:{$today}", $previous->usd_to_srd, 86400);
        $this->auditRateEvent('rate.fallback_applied', $rate, [
            'fallback_from' => $previous->date->toDateString(),
            'reason'        => 'API unreachable on first sale of the day',
        ]);

        return $rate;
    }

    /**
     * Write an audit_logs row so the rate self-heal is visible in
     * Dashboard → Audit Log and the Rekenkamer export.
     */
    private function auditRateEvent(string $event, DailyRate $rate, array $extra = []): void
    {
        \App\Models\AuditLog::create([
            'user_id'         => null, // system event — no user attribution
            'organisation_id' => null, // platform-wide rate
            'event'           => $event,
            'auditable_type'  => 'daily_rate',
            'auditable_id'    => $rate->id,
            'old_values'      => null,
            'new_values'      => array_merge([
                'date'       => $rate->date->toDateString(),
                'usd_to_srd' => $rate->usd_to_srd,
                'source'     => $rate->source,
            ], $extra),
            'ip_address'      => request()->ip(),
            'created_at'      => now(),
        ]);
    }
}
