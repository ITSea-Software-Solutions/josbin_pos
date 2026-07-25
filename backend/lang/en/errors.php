<?php

/**
 * English error messages surfaced to the user via API responses.
 *
 * Keep keys + placeholders in sync with lang/nl/errors.php — callers
 * pass __('errors.…', […]) without branching on locale.
 */

return [
    'no_daily_rate' => "No exchange rate set for today. Ask your Org Admin to set it via Dashboard → Daily Rate, or contact :vendor support (:email).",

    // User management
    'self_delete_blocked' => "You can't delete your own account.",

    // Password / account
    'wrong_current_password' => 'Current password is incorrect.',
    'password_changed'       => 'Password changed. Other devices have been signed out.',

    // Auth / 2FA
    'too_many_login_attempts' => 'Too many login attempts. Please try again in a few minutes.',
    'cannot_reset_mandatory_2fa' => 'Two-factor authentication is mandatory for this account and cannot be reset.',

    // Register + Z-Report
    'register_already_closed_today' => 'This register was already closed today. Ask your manager to re-open it.',
    'discrepancy_note_required' => 'A cash difference needs a short note explaining it.',
    'register_already_closed'       => 'This register session is already closed.',
    'register_day_already_closed'   => "Today's register is already closed.",
    'z_report_already_sent'         => 'This Z-report has already been sent to headquarters.',

    // Sales — void / refund flow
    'void_only_completed'           => 'Only completed sales can be voided.',
    'void_requires_second_approval' => 'Void request recorded. Waiting for second approval.',
    'second_approver_must_differ'   => 'The second approval must come from a different user.',
    'refund_only_completed'         => 'Only completed sales can be refunded.',
    'refund_unconfirmed_payment'    => 'This sale is still awaiting payment confirmation. Confirm the payment first (Dashboard → Pending payments), then refund.',
    'receipt_emailed'               => 'Receipt emailed to :email.',
    'customer_redacted'             => 'Customer personal data has been erased. The record is kept for sales history but no longer contains identifiable information.',
    'missing_btw_number'            => 'This organisation has no BTW registration number on file, so a BTW receipt cannot be issued. Ask your Org Admin to set it in Dashboard → Organisation.',

    // Sales — inventory (strict mode only; default policy allows oversell)
    'insufficient_stock'            => 'Insufficient stock for ":product". Only :available left. Adjust stock via Dashboard → Stock, or lower the quantity.',

    // Licence / organisation
    'no_active_licence_for_stores'  => 'No active licence for this organisation. Ask the Super Admin to issue one before creating stores.',

    // Passkeys (WebAuthn)
    'passkey_ceremony_expired'      => 'The passkey request expired. Please try again.',
    'passkey_invalid'               => 'That passkey could not be verified. Please try again.',
    'not_found'                     => 'Not found.',

    // POS installer download
    'installer_not_deployed'        => 'No installer has been deployed on this server yet. Ask your Josbin POS contact.',
];
