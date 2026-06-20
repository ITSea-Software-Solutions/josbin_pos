<?php

namespace App\Notifications;

use App\Models\BtwSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the submitter (+ org admins) when the Belastingdienst inspector
 * accepts a BTW filing — closure confirmation so the loop has a clear end.
 * Queued for the same channel-isolation reason as BtwFilingDisputed.
 */
class BtwFilingAccepted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public BtwSubmission $submission) {}

    /** @return array<int,string> */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    private function period(): string
    {
        $s = $this->submission;

        return $s->period_start === $s->period_end
            ? (string) $s->period_start
            : "{$s->period_start} → {$s->period_end}";
    }

    /** @return array<string,mixed> */
    public function toDatabase(object $notifiable): array
    {
        $s = $this->submission;
        $ref = $s->reference;

        return [
            'category'      => 'btw',
            'type'          => 'btw_accepted',
            'submission_id' => $s->id,
            'reference'     => $ref,
            'period'        => $this->period(),
            'amount_srd'    => number_format((float) $s->total_btw_srd, 2, '.', ''),
            'link'          => '/btw-submissions',
            'title'         => [
                'nl' => 'BTW-aangifte geaccepteerd',
                'en' => 'BTW filing accepted',
            ],
            'message'       => [
                'nl' => "De Belastingdienst heeft aangifte {$ref} geaccepteerd.",
                'en' => "The Tax Authority accepted filing {$ref}.",
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->submission;
        $locale = ($notifiable->locale ?? $s->organisation?->locale) === 'en' ? 'en' : 'nl';
        $nl = $locale === 'nl';

        $subject = ($nl ? 'BTW-aangifte geaccepteerd' : 'BTW filing accepted') . ' — ' . $s->reference;

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.btw-accepted', [
                'locale'    => $locale,
                'orgName'   => $s->organisation?->name ?? ($nl ? 'belastingplichtige' : 'taxpayer'),
                'reference' => $s->reference,
                'period'    => $this->period(),
                'btw'       => number_format((float) $s->total_btw_srd, 2, ',', '.'),
                'portalUrl' => rtrim((string) config('josbin_pos.dashboard_url'), '/') . '/btw-submissions',
            ]);
    }
}
