<?php

namespace App\Providers;

use App\Services\LicenseService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // LicenseService is a singleton — one instance per request lifecycle
        $this->app->singleton(LicenseService::class, function () {
            return new LicenseService(
                licenseServerUrl: config('josbin_pos.license_server_url', 'https://license.josbin-pos.sr'),
                installationKey:  config('josbin_pos.installation_key', ''),
            );
        });
    }

    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        // Login throttle — TWO dimensions so neither attack shape gets through:
        //   1. per email+IP  (5 / 5min)  — targeted brute force of one account
        //   2. per IP only   (20 / 5min) — one host spraying many usernames
        // Returning an array applies BOTH; the request is blocked if either trips.
        RateLimiter::for('login', function (Request $request) {
            $tooMany = fn () => response()->json([
                'message' => __('errors.too_many_login_attempts'),
                'code'    => 'RATE_LIMITED',
            ], 429);

            return [
                Limit::perMinutes(5, 5)
                    ->by(strtolower((string) $request->input('email')) . '|' . $request->ip())
                    ->response($tooMany),
                Limit::perMinutes(5, 20)
                    ->by('ip|' . $request->ip())
                    ->response($tooMany),
            ];
        });

        // General API: 240 req/min per authenticated user or IP
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(240)
                ->by($request->user()?->id ?: $request->ip());
        });
    }
}
