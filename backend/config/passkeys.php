<?php

/*
 * Passkey (WebAuthn) configuration — laravel/passkeys.
 *
 * The package's own web-guard routes are disabled (Passkeys::ignoreRoutes()
 * in AppServiceProvider); Josbin exposes its own Sanctum-token API routes
 * via Api\PasskeyController instead, using the package's actions.
 *
 * WebAuthn only works from a secure context whose host is a DOMAIN:
 * localhost in dev, and the real domain once HTTPS is set up. On the
 * plain-IP droplet the browser hides/blocks passkey UI — expected.
 */
return [
    // Relying Party ID: the registrable domain passkeys are bound to.
    // Must match the host the dashboard is served from.
    'relying_party_id' => env('PASSKEYS_RP_ID', parse_url((string) env('APP_URL', 'http://localhost'), PHP_URL_HOST) ?: 'localhost'),

    // Origins allowed to complete WebAuthn ceremonies (scheme://host[:port]).
    // Dev covers the Vite dashboards; production adds the real origin via env.
    'allowed_origins' => array_values(array_filter(array_merge(
        [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:8090',
            'http://localhost:8091',
        ],
        explode(',', (string) env('PASSKEYS_ALLOWED_ORIGINS', '')),
    ))),

    // Secret for deriving stable opaque user handles (no PII in authenticators).
    'user_handle_secret' => env('PASSKEYS_USER_HANDLE_SECRET', env('APP_KEY', '')),

    // WebAuthn ceremony timeout in milliseconds.
    'timeout' => 60000,
];
