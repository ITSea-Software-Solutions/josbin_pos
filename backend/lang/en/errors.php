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

    // Register + Z-Report
    'register_already_closed_today' => 'This register was already closed today. Ask your manager to re-open it.',
    'register_day_already_closed'   => "Today's register is already closed.",
    'z_report_already_sent'         => 'This Z-report has already been sent to headquarters.',

    // Sales — void / refund flow
    'void_only_completed'           => 'Only completed sales can be voided.',
    'void_requires_second_approval' => 'Void request recorded. Waiting for second approval.',
    'second_approver_must_differ'   => 'The second approval must come from a different user.',
    'refund_only_completed'         => 'Only completed sales can be refunded.',
    'receipt_emailed'               => 'Receipt emailed to :email.',

    // Sales — inventory (strict mode only; default policy allows oversell)
    'insufficient_stock'            => 'Insufficient stock for ":product". Only :available left. Adjust stock via Dashboard → Stock, or lower the quantity.',

    // Licence / organisation
    'no_active_licence_for_stores'  => 'No active licence for this organisation. Ask the Super Admin to issue one before creating stores.',
];
