<?php

namespace App\Notifications;

use App\Models\BtwSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to an organisation's admins + the original submitter when the
 * Belastingdienst inspector disputes one of their BTW filings.
 *
 * Queued so a mail (SMTP) failure is isolated to its own job — it can never
 * block the inspector's web request nor the database (in-app bell) channel
 * for the other recipients.
 */
class BtwFilingDisputed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public BtwSubmission $submission,
        public string $reason,
    ) {}

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
            'type'          => 'btw_disputed',
            'submission_id' => $s->id,
            'reference'     => $ref,
            'period'        => $this->period(),
            'amount_srd'    => number_format((float) $s->total_btw_srd, 2, '.', ''),
            'reason'        => $this->reason,
            'link'          => '/btw-submissions',
            'title'         => [
                'nl' => 'BTW-aangifte betwist',
                'en' => 'BTW filing disputed',
            ],
            'message'       => [
                'nl' => "De Belastingdienst heeft aangifte {$ref} betwist. Corrigeer en dien opnieuw in.",
                'en' => "The Tax Authority disputed filing {$ref}. Please correct and resubmit.",
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->submission;
        $locale = ($notifiable->locale ?? $s->organisation?->locale) === 'en' ? 'en' : 'nl';
        $nl = $locale === 'nl';

        $subject = ($nl ? 'BTW-aangifte betwist' : 'BTW filing disputed') . ' — ' . $s->reference;

        return (new MailMessage)
            ->subject($subject)
            ->view('emails.btw-disputed', [
                'locale'    => $locale,
                'orgName'   => $s->organisation?->name ?? ($nl ? 'belastingplichtige' : 'taxpayer'),
                'reference' => $s->reference,
                'period'    => $this->period(),
                'btw'       => number_format((float) $s->total_btw_srd, 2, ',', '.'),
                'reason'    => $this->reason,
                'portalUrl' => rtrim((string) config('josbin_pos.dashboard_url'), '/') . '/btw-submissions',
            ]);
    }
}
