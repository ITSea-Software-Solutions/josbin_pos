<?php

use App\Http\Middleware\AdminApiKey;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Admin endpoints require the X-Admin-Key header.
        $middleware->alias([
            'admin.key' => AdminApiKey::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // The license server only ever speaks JSON.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => true
        );
    })->create();
