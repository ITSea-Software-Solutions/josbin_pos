<?php

namespace App\Providers;

use App\Services\AuditHashService;
use App\Services\LicenseService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use OwenIt\Auditing\Events\Audited;

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

        // Hash-chain OwenIt model-audits (Product/User/Customer/… created &
        // updated events). OwenIt writes them to audit_logs through its own
        // model — i.e. WITHOUT our AuditLog `creating` hook — so they used to
        // land with a NULL row_hash and were silently skipped by the verifier.
        // Seal each one into its organisation's chain the moment it is written.
        Event::listen(Audited::class, function (Audited $event): void {
            if (! $event->audit || $event->audit->getKey() === null) {
                return;
            }
            // Attribute the audit to the auditable's organisation when it has
            // one (Product/User/Customer/Store/Variant all do); otherwise it
            // joins the platform partition.
            $orgId = $event->model->getAttribute('organisation_id');
            app(AuditHashService::class)->sealRow(
                (int) $event->audit->getKey(),
                is_string($orgId) ? $orgId : null,
            );
        });
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
