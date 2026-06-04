<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // ExchangeRate-API (supports SRD — do NOT use Frankfurter/ECB which lacks SRD)
    'exchangerate_api' => [
        'key'        => env('EXCHANGERATE_API_KEY'),
        'markup_pct' => env('EXCHANGERATE_MARKUP_PCT', '0.00'),
        // Static USD→SRD fallback used when there's no real API key yet and
        // no prior rate to carry forward (fresh install / demo). Last resort
        // before the "no rate" error — keeps the POS sellable out of the box.
        // Set to null to force a hard error instead (strict production).
        'static_rate' => env('EXCHANGERATE_STATIC_RATE', '37.50'),
    ],

    // OpenAI — used for fraud detection narrative + weekly AI summary
    'openai' => [
        'key'   => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4o'),
    ],

];
