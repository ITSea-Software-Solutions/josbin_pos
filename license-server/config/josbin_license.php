<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Admin API Key
    |--------------------------------------------------------------------------
    | Secret presented as the  X-Admin-Key  header by the developer company's
    | tooling to reach the /api/admin/* endpoints (issue, renew, revoke).
    */
    'admin_api_key' => env('LICENSE_ADMIN_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | License Key Prefix
    |--------------------------------------------------------------------------
    | Human-readable prefix printed on every issued key, e.g. JOSBIN-AB12-CD34.
    */
    'key_prefix' => env('LICENSE_KEY_PREFIX', 'JOSBIN'),

];
