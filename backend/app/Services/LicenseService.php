<?php

namespace App\Services;

use App\Models\License;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * LicenseService
 *
 * Validates the Josbin POS license with the central license server.
 * Cache strategy:
 * - Redis key `license:status` — the resolved status string (active/soft_lock/etc.)
 * - Redis key `license:checked_at` — timestamp of last successful server check
 * - 24-hour cache TTL; on cache miss, re-validates with license server
 * - If license server is unreachable, 72-hour offline grace period starts
 */
class LicenseService
{
    private const CACHE_KEY        = 'license:status';
    private const CHECKED_AT_KEY   = 'license:checked_at';
    private const CACHE_TTL        = 86400;  // 24 hours
    private const OFFLINE_GRACE    = 259200; // 72 hours

    public function __construct(
        private readonly string $licenseServerUrl,
        private readonly string $installationKey,
    ) {}

    /**
     * Returns the current license status string.
     * Cached for 24 hours; re-validates with license server on cache miss.
     *
     * In local/development environments or when no installation key is configured,
     * returns 'active' immediately so the license check never blocks development.
     */
    public function getStatus(): string
    {
        // No installation key = dev/unactivated install — never block
        if (empty($this->installationKey) || app()->isLocal()) {
            return 'active';
        }

        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            return $this->validateWithServer();
        });
    }

    /**
     * Force a fresh validation with the license server, bypassing cache.
     * Called by `license:check` artisan command on schedule.
     */
    public function forceCheck(): string
    {
        Cache::forget(self::CACHE_KEY);
        $status = $this->validateWithServer();
        Cache::put(self::CACHE_KEY, $status, self::CACHE_TTL);
        return $status;
    }

    /**
     * Called from EnsureLicenseValid middleware.
     * Returns true if the installation may continue operating.
     */
    public function isOperational(): bool
    {
        $status = $this->getStatus();
        // hard_lock blocks everything; invalid blocks everything
        return ! in_array($status, ['hard_lock', 'invalid', 'not_found'], true);
    }

    /**
     * True if new sales can be created (not soft or hard locked).
     */
    public function canCreateSales(): bool
    {
        $status = $this->getStatus();
        return ! in_array($status, ['soft_lock', 'hard_lock', 'invalid', 'not_found'], true);
    }

    // ─── Server validation ───────────────────────────────────────────────

    private function validateWithServer(): string
    {
        try {
            $response = Http::timeout(10)
                ->withToken($this->installationKey)
                ->post("{$this->licenseServerUrl}/api/validate", [
                    'installation_key' => $this->installationKey,
                    'hostname'         => gethostname(),
                    'ip'               => request()->ip(),
                ]);

            if ($response->successful()) {
                $payload = $response->json();
                $status  = $payload['status'] ?? 'invalid';

                // Update local DB record with latest data
                $this->syncLocalRecord($payload);

                // Clear offline grace — server is reachable
                Cache::forget('license:offline_grace_ends');
                Cache::put(self::CHECKED_AT_KEY, now()->toIso8601String(), self::CACHE_TTL * 7);

                Log::info('[License] Validated with server', ['status' => $status]);
                return $status;
            }

            Log::warning('[License] Server returned non-200', ['status' => $response->status()]);
            return $this->offlineFallback();

        } catch (\Exception $e) {
            Log::warning('[License] Server unreachable', ['error' => $e->getMessage()]);
            return $this->offlineFallback();
        }
    }

    /**
     * When license server is unreachable, allow operation for 72 hours.
     * After 72 hours, falls back to local DB record status.
     */
    private function offlineFallback(): string
    {
        $graceEnds = Cache::get('license:offline_grace_ends');

        if (! $graceEnds) {
            // First unreachable event — start the 72-hour grace window
            $endsAt = now()->addSeconds(self::OFFLINE_GRACE)->toIso8601String();
            Cache::put('license:offline_grace_ends', $endsAt, self::OFFLINE_GRACE);
            Log::warning('[License] Server unreachable — 72h offline grace started', ['ends_at' => $endsAt]);
            return 'active'; // assume active during grace
        }

        if (now()->lt(\Carbon\Carbon::parse($graceEnds))) {
            Log::debug('[License] Within offline grace period');
            return 'active'; // still in grace
        }

        // Grace expired — fall back to local DB record
        Log::warning('[License] Offline grace period expired — using local DB record');
        $license = License::where('is_active', true)->first();
        return $license?->computeRenewalStatus() ?? 'invalid';
    }

    private function syncLocalRecord(array $payload): void
    {
        if (empty($payload['license_key'])) return;

        $license = License::findByKey($payload['license_key']);
        if (! $license) return;

        $license->update([
            'last_validated_at' => now(),
            'last_validated_ip' => request()->ip(),
            'valid_until'       => $payload['valid_until'] ?? $license->valid_until,
            'max_stores'        => $payload['max_stores'] ?? $license->max_stores,
            'max_terminals'     => $payload['max_terminals'] ?? $license->max_terminals,
            'tier'              => $payload['tier'] ?? $license->tier,
            'renewal_status'    => $payload['status'] ?? $license->computeRenewalStatus(),
        ]);
    }
}
