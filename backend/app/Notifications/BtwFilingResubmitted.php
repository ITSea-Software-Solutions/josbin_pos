<?php

namespace App\Notifications;

use App\Models\BtwSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent to the Belastingdienst inspectors when a taxpayer corrects & resubmits
 * a filing (supersede) — closes the dispute loop the other way so the inspector
 * knows a corrected filing is waiting in their review queue. Queued.
 */
class BtwFilingResubmitted extends Notification implements ShouldQueue
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
            'type'          => 'btw_resubmitted',
            'submission_id' => $s->id,
            'reference'     => $ref,
            'organisation'  => $org,
            'period'        => $this->period(),
            'amount_srd'    => number_format((float) $s->total_btw_srd, 2, '.', ''),
            'link'          => '/btw-submissions',
            'title'         => [
                'nl' => 'BTW-aangifte opnieuw ingediend',
                'en' => 'BTW filing resubmitted',
            ],
            'message'       => [
                'nl' => "{$org} heeft een gecorrigeerde aangifte ingediend ({$ref}) — gereed voor herbeoordeling.",
                'en' => "{$org} resubmitted a corrected filing ({$ref}) — ready for re-review.",
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
            ->subject(($nl ? 'BTW-aangifte opnieuw ingediend' : 'BTW filing resubmitted') . ' — ' . $s->reference)
            ->greeting($nl ? 'Belastingdienst' : 'Tax Authority')
            ->line($nl
                ? "{$org} heeft een gecorrigeerde BTW-aangifte ingediend (referentie {$s->reference}, periode {$this->period()})."
                : "{$org} has resubmitted a corrected BTW filing (reference {$s->reference}, period {$this->period()}).")
            ->action($nl ? 'Beoordeel aangifte' : 'Review filing', $url)
            ->line($nl ? 'De aangifte staat klaar voor herbeoordeling.' : 'The filing is ready for re-review.');
    }
}
