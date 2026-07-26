<?php

namespace App\Notifications;

use App\Models\Store;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A store's BTW return is overdue. Sent to the store's managers (OA + SM) both
 * by the daily btw:overdue-check nudge and by an inspector's manual reminder.
 * Database channel is the dashboard bell; mail rides along as its own queued
 * job so an SMTP problem never blocks the reminder.
 */
class BtwFilingOverdue extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Store $store,
        public int $daysOverdue,
        public string $source, // auto | inspector
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nl = ($notifiable->locale ?? 'nl') === 'nl';

        return [
            'type'    => 'btw.filing_overdue',
            'title'   => $nl ? 'BTW-aangifte te laat' : 'BTW filing overdue',
            'message' => $nl
                ? "{$this->store->name}: de BTW-aangifte is {$this->daysOverdue} dag(en) te laat. Dien deze zo spoedig mogelijk in bij de Belastingdienst."
                : "{$this->store->name}: the BTW return is {$this->daysOverdue} day(s) overdue. Please file it with the Belastingdienst as soon as possible.",
            'store_id'     => $this->store->id,
            'days_overdue' => $this->daysOverdue,
            'source'       => $this->source,
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
