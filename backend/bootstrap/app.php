<?php

use App\Http\Middleware\AuthenticateViaQueryToken;
use App\Http\Middleware\EnsureLicenseValid;
use App\Http\Middleware\EnsureTwoFactor;
use App\Http\Middleware\SessionTimeout;
use App\Http\Middleware\TrackStoreActivity;
use App\Http\Middleware\ValidateApiKey;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum token expiry check on every authenticated API request
        $middleware->appendToGroup('api', SessionTimeout::class);

        // License check on all authenticated API requests
        $middleware->appendToGroup('api', EnsureLicenseValid::class);

        // Track store activity for online/offline indicator (throttled)
        $middleware->appendToGroup('api', TrackStoreActivity::class);

        // Named middleware aliases
        $middleware->alias([
            'session.timeout'   => SessionTimeout::class,
            'two_factor'        => EnsureTwoFactor::class,
            'license'           => EnsureLicenseValid::class,
            'api.key'           => ValidateApiKey::class,
            'auth.query_token'  => AuthenticateViaQueryToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Return JSON for all API exceptions
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );
    })->create();
