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
];
