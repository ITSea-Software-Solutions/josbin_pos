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

    // User management
    'self_delete_blocked' => 'U kunt uw eigen account niet verwijderen.',

    // Password / account
    'wrong_current_password' => 'Het huidige wachtwoord is onjuist.',
    'password_changed'       => 'Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd.',

    // Auth / 2FA
    'too_many_login_attempts' => 'Te veel inlogpogingen. Probeer het over enkele minuten opnieuw.',
    'cannot_reset_mandatory_2fa' => 'Tweefactorauthenticatie is verplicht voor dit account en kan niet worden gereset.',

    // Register + Z-Report
    'register_already_closed_today' => 'Deze kassa is vandaag al gesloten. Vraag uw manager om heropening.',
    'discrepancy_note_required' => 'Een kasverschil vereist een korte toelichting.',
    'register_already_closed'       => 'Deze kassasessie is al gesloten.',
    'register_day_already_closed'   => 'De kas voor vandaag is al gesloten.',
    'z_report_already_sent'         => 'Dit Z-rapport is al verzonden naar het hoofdkantoor.',

    // Sales — void / refund flow
    'void_only_completed'           => 'Alleen voltooide verkopen kunnen worden geannuleerd.',
    'void_requires_second_approval' => 'Annuleringsverzoek geregistreerd. Wachten op tweede goedkeuring.',
    'second_approver_must_differ'   => 'De tweede goedkeuring moet door een andere gebruiker worden gegeven.',
    'refund_only_completed'         => 'Alleen voltooide verkopen kunnen worden terugbetaald.',
    'refund_unconfirmed_payment'    => 'Deze verkoop wacht nog op betalingsbevestiging. Bevestig eerst de betaling (Dashboard → Openstaande betalingen) en betaal daarna terug.',
    'receipt_emailed'               => 'Kassabon verstuurd naar :email.',
    'customer_redacted'             => 'Persoonsgegevens van de klant zijn gewist. Het record blijft bewaard voor de verkoophistorie maar bevat geen identificeerbare gegevens meer.',
    'missing_btw_number'            => 'Deze organisatie heeft geen BTW-nummer geregistreerd, dus er kan geen BTW-bon worden uitgegeven. Vraag de Org Admin om het in te stellen via Dashboard → Organisatie.',

    // Sales — inventory (strict mode only; default policy allows oversell)
    'insufficient_stock'            => 'Onvoldoende voorraad voor ":product". Nog :available op voorraad. Pas de voorraad aan via Dashboard → Voorraad, of verlaag het aantal.',

    // Licence / organisation
    'no_active_licence_for_stores'  => 'Geen actieve licentie voor deze organisatie. Vraag de Super Admin om een licentie uit te geven voordat u vestigingen aanmaakt.',
];
