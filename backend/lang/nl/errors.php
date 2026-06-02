<?php

/**
 * Dutch error messages surfaced to the user via API responses.
 *
 * Pulled by Laravel's __() helper when SetLocale middleware sets the
 * app locale to 'nl' (either via Accept-Language header from the frontend
 * or the authenticated user's locale preference).
 *
 * Keep placeholders consistent across nl/ and en/ files — the same
 * :vendor / :path tokens are used in both so callers don't have to
 * branch on locale.
 *
 * Style: full sentences. Tell the user (a) what's wrong, (b) what to do
 * about it, (c) who to contact if (b) doesn't help. Surinamese business
 * Dutch — no English borrowings unless there's no native equivalent.
 */

return [
    'no_daily_rate' => 'Geen dagkoers beschikbaar voor vandaag. Vraag de Org Admin om de wisselkoers in te stellen via Dashboard → Dagkoers, of neem contact op met :vendor support (:email).',
];
