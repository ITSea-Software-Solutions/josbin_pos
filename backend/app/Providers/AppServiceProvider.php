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
        // Login: 5 attempts per 5 minutes per email+IP combo
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinutes(5, 5)
                ->by(strtolower((string) $request->input('email')) . '|' . $request->ip())
                ->response(fn () => response()->json([
                    'message' => 'Te veel inlogpogingen. Probeer het over enkele minuten opnieuw.',
                    'code'    => 'RATE_LIMITED',
                ], 429));
        });

        // General API: 240 req/min per authenticated user or IP
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(240)
                ->by($request->user()?->id ?: $request->ip());
        });
    }
}
