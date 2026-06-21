<?php

namespace App\Notifications;

use App\Models\BtwSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the Belastingdienst inspectors when a taxpayer files a NEW BTW
 * submission — so a fresh filing in their review queue doesn't rely on them
 * re-checking the list. Queued (database + mail) like the rest of the BTW
 * notifications, so a mail/queue hiccup can't block the filing.
 */
class BtwFilingSubmitted extends Notification implements ShouldQueue
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
        $org = $s->organisation?->name ?? '';

        return [
            'category'      => 'btw',
            'type'          => 'btw_submitted',
            'submission_id' => $s->id,
            'reference'     => $ref,
            'organisation'  => $org,
            'period'        => $this->period(),
            'amount_srd'    => number_format((float) $s->total_btw_srd, 2, '.', ''),
            'link'          => '/btw-submissions',
            'title'         => [
                'nl' => 'Nieuwe BTW-aangifte',
                'en' => 'New BTW filing',
            ],
            'message'       => [
                'nl' => "{$org} heeft aangifte {$ref} ingediend ({$this->period()}) — gereed voor beoordeling.",
                'en' => "{$org} filed {$ref} ({$this->period()}) — ready for review.",
            ],
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $s = $this->submission;
        $nl = ($notifiable->locale ?? 'nl') !== 'en';
        $org = $s->organisation?->name ?? '';
        $url = rtrim((string) config('josbin_pos.dashboard_url'), '/') . '/btw-submissions';

        return (new MailMessage)
            ->subject(($nl ? 'Nieuwe BTW-aangifte' : 'New BTW filing') . ' — ' . $s->reference)
            ->greeting($nl ? 'Belastingdienst' : 'Tax Authority')
            ->line($nl
                ? "{$org} heeft een nieuwe BTW-aangifte ingediend (referentie {$s->reference}, periode {$this->period()})."
                : "{$org} filed a new BTW submission (reference {$s->reference}, period {$this->period()}).")
            ->action($nl ? 'Beoordeel aangifte' : 'Review filing', $url)
            ->line($nl ? 'De aangifte staat klaar voor beoordeling.' : 'The filing is ready for review.');
    }
}
