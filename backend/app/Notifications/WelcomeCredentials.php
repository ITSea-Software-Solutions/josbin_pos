<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Welcome / login-credentials email sent to a newly created user when the
 * admin ticks "send welcome email" on the user-create form.
 *
 * SECURITY: the admin sets the initial password directly (UserController::store
 * validates a plaintext password from the admin — it is never generated nor
 * stored in the clear), so we do NOT — and cannot safely — email a plaintext
 * password. The mail gives the user their login email + dashboard URL and tells
 * them their administrator will share their initial password securely, which
 * they can change after first login.
 *
 * Mail-only channel: the recipient has no session/bell yet, so there is nothing
 * to write to the database (in-app) channel. Queued so an SMTP hiccup is
 * isolated to its own job and can never break user creation — same defensive
 * approach as the BTW filing notifications.
 */
class WelcomeCredentials extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $newUser) {}

    /** @return array<int,string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $u = $this->newUser;
        // Prefer the new user's own locale; fall back to their org's, then nl.
        $locale = ($u->locale ?? $u->organisation?->locale) === 'en' ? 'en' : 'nl';
        $nl = $locale === 'nl';

        $appName = config('app.name', 'Josbin POS');
        $subject = ($nl ? 'Welkom bij ' : 'Welcome to ') . $appName;

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.welcome-credentials', [
                'locale'       => $locale,
                'name'         => $u->name,
                'email'        => $u->email,
                'appName'      => $appName,
                'orgName'      => $u->organisation?->name,
                'dashboardUrl' => rtrim((string) config('josbin_pos.dashboard_url'), '/'),
                'supportEmail' => config('josbin_pos.vendor.email'),
            ]);
    }
}
