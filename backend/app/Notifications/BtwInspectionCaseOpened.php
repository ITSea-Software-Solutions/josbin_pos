<?php

namespace App\Notifications;

use App\Models\BtwInspectionCase;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A physical-inspection case has been opened for a store that ignored >= 3 BTW
 * late-filing reminders. Sent to the Belastingdienst inspectors (+ SA) — this
 * IS the "enforcement queue". In-system only; nothing leaves automatically.
 */
class BtwInspectionCaseOpened extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public BtwInspectionCase $case,
        public string $storeName,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nl = ($notifiable->locale ?? 'nl') === 'nl';

        return [
            'type'    => 'btw.inspection_opened',
            'title'   => $nl ? 'Inspectiedossier geopend' : 'Inspection case opened',
            'message' => $nl
                ? "{$this->storeName}: een fysiek-inspectiedossier is geopend na {$this->case->reminder_count} herinnering(en) ({$this->case->days_overdue} dagen te laat)."
                : "{$this->storeName}: a physical-inspection case was opened after {$this->case->reminder_count} reminder(s) ({$this->case->days_overdue} days overdue).",
            'store_id' => $this->case->store_id,
            'case_id'  => $this->case->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $data = $this->toDatabase($notifiable);

        return (new MailMessage)
            ->subject($data['title'])
            ->line($data['message']);
    }
}
