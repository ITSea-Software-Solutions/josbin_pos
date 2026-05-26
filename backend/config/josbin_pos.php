<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Josbin POS Installation Configuration
    |--------------------------------------------------------------------------
    |
    | These values are set via environment variables in .env or Docker secrets.
    | They should be configured during initial deployment.
    |
    */

    // URL of the Josbin POS license server (managed by the developer company)
    'license_server_url' => env('JOSBIN_POS_LICENSE_SERVER_URL', 'https://license.josbin-pos.sr'),

    /*
    |--------------------------------------------------------------------------
    | Vendor contact — the company that built + supports this installation
    |--------------------------------------------------------------------------
    |
    | Surfaced everywhere the UI tells a client (OA, manager, cashier) to
    | "contact support" — licence-missing banners, read-only org headers,
    | renewal warnings, the licence certificate PDF. Single source of truth
    | so we never have to grep for hard-coded support addresses again.
    |
    | Override per-deployment via .env if a reseller / partner needs their
    | own contact details on the UI instead of Josbin's.
    |
    */
    'vendor' => [
        'name'    => env('JOSBIN_POS_VENDOR_NAME',    'Josbin'),
        'email'   => env('JOSBIN_POS_VENDOR_EMAIL',   'support@josbin-pos.sr'),
        'phone'   => env('JOSBIN_POS_VENDOR_PHONE',   '+597 471-0000'),
        'website' => env('JOSBIN_POS_VENDOR_WEBSITE', 'https://josbin-pos.sr'),
    ],

    // Installation key issued when the license is activated (per deployment)
    'installation_key' => env('JOSBIN_POS_INSTALLATION_KEY', ''),

    // ExchangeRate-API key (free tier supports SRD)
    'exchange_rate_api_key' => env('EXCHANGE_RATE_API_KEY', ''),

    // Markup percentage applied on top of fetched USD→SRD rate
    'exchange_rate_markup_pct' => env('EXCHANGE_RATE_MARKUP_PCT', '0.00'),

    // Application timezone — always AST for Suriname
    'timezone' => 'America/Paramaribo',

    // Default BTW rate (10% per Belastingdienst Suriname as of 2025)
    'default_btw_rate' => env('JOSBIN_POS_DEFAULT_BTW_RATE', '10.00'),

    // Organisation type for this installation
    // retail | govt | wholesale
    'installation_type' => env('JOSBIN_POS_INSTALLATION_TYPE', 'retail'),

    /*
    |--------------------------------------------------------------------------
    | Sandbox Mode
    |--------------------------------------------------------------------------
    |
    | When true this deployment is an isolated sandbox for third-party
    | integration testing of the Layer 3 Open Integration API (/v1/*).
    | A sandbox runs on its own database and is seeded via SandboxSeeder.
    | The /v1 endpoints add an  X-Josbin-Environment: sandbox  response header
    | so integrators can confirm they are not hitting production.
    |
    */
    'sandbox' => (bool) env('JOSBIN_POS_SANDBOX', false),

    /*
    |--------------------------------------------------------------------------
    | Demo Mode
    |--------------------------------------------------------------------------
    |
    | When true this deployment is a demo / showcase environment. The POS and
    | Dashboard render a prominent yellow "DEMO MODE — not production data"
    | banner so nobody confuses it with the client's live install. Set true
    | only on the demo stack (docker-compose.demo.yml).
    |
    */
    'demo_mode' => (bool) env('JOSBIN_POS_DEMO_MODE', false),

    /*
    |--------------------------------------------------------------------------
    | QR / mobile-wallet webhook ingestion (Phase 3, task #79)
    |--------------------------------------------------------------------------
    |
    | Off by default — the endpoint returns 503 until a real Surinamese PSP
    | partner is wired in. Set JOSBIN_POS_QR_WEBHOOKS_ENABLED=true per
    | deployment once the partner's HMAC secret + spec is configured.
    |
    */
    'qr_webhooks_enabled' => (bool) env('JOSBIN_POS_QR_WEBHOOKS_ENABLED', false),
];
