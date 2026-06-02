<?php

/**
 * English error messages surfaced to the user via API responses.
 *
 * Keep keys + placeholders in sync with lang/nl/errors.php — callers
 * pass __('errors.…', […]) without branching on locale.
 */

return [
    'no_daily_rate' => "No exchange rate set for today. Ask your Org Admin to set it via Dashboard → Daily Rate, or contact :vendor support (:email).",
];
