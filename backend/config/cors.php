<?php

/**
 * CORS configuration — published explicitly so localhost dev servers
 * (POS :5173, Dashboard :5174, Docs site :5180) and the production
 * frontends are all handled deterministically.
 *
 * Returning `*` worked for most paths via Laravel's defaults, but the
 * browser intermittently rejects responses when the request flow has
 * any wrinkle (preflight + credentials, opaque-redirect, etc.).
 * Echoing back specific origins is the safer + more explicit pattern.
 */
return [

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'broadcasting/auth',
    ],

    'allowed_methods' => ['*'],

    /**
     * In dev: every localhost:* port is allowed. In production set
     * `CORS_ALLOWED_ORIGINS` in .env to a comma-separated list of
     * approved client origins (e.g.
     *   CORS_ALLOWED_ORIGINS=https://pos.dehoop.sr,https://admin.dehoop.sr
     * ).
     */
    'allowed_origins' => array_filter(
        explode(',', env('CORS_ALLOWED_ORIGINS', '')),
        fn ($s) => trim($s) !== '',
    ) ?: [
        'http://localhost:5173',  // POS Vite dev
        'http://localhost:5174',  // Dashboard Vite dev
        'http://localhost:5180',  // Docs site
        'http://localhost:8080',  // Backend self
        'http://localhost:8082',  // Demo backend self
        'http://localhost:8091',  // Sandbox backend self
        'https://localhost',      // Capacitor Android WebView (androidScheme defaults to https since Cap 5)
        'capacitor://localhost',  // Capacitor iOS shell (future)
        'http://localhost',       // Electron dev / edge cases
        'null',                   // Packaged Electron app: file:// pages send the literal Origin "null".
                                  // Safe here because authorisation is the Bearer token, never the
                                  // origin — CORS only gates response *readability* for browser JS.
    ],

    /**
     * Pattern-match any localhost port for dev tooling that hot-bumps
     * (Vite sometimes picks 5175/5176 when defaults are taken). Safe
     * because production allowed_origins come from .env and override.
     */
    'allowed_origins_patterns' => [
        '#^http://localhost(:\d+)?$#',
        '#^http://127\.0\.0\.1(:\d+)?$#',
    ],

    'allowed_headers' => ['*'],

    /**
     * Headers our frontends might want to read off the response — e.g.
     * the X-Josbin-Environment header the sandbox stack returns so
     * integrators can confirm they're not hitting production.
     */
    'exposed_headers' => ['X-Josbin-Environment'],

    'max_age' => 600,

    /**
     * Sanctum + cookie-based auth flows need credentials=true. The
     * frontends use Bearer tokens (not cookies) so this is for the
     * /sanctum/csrf-cookie endpoint that Sanctum offers as an opt-in.
     */
    'supports_credentials' => false,
];
