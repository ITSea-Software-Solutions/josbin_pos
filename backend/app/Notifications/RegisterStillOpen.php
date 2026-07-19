<?php

namespace App\Notifications;

use App\Models\RegisterSession;
use App\Models\Store;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Closing-time nudge: the store's configured closing time has passed and a
 * register session is still open. Database channel is the source of truth
 * (dashboard bell); mail rides along and may silently no-op until SMTP is
 * configured — each channel is its own queued job so one can't block the
 * other.
 */
class RegisterStillOpen extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Store $store,
        public RegisterSession $session,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase(object $notifiable): array
    {
        $nl = ($notifiable->locale ?? 'nl') === 'nl';

        return [
            'type'    => 'register.still_open',
            'title'   => $nl ? 'Kassa nog open na sluitingstijd' : 'Register still open after closing time',
            'message' => $nl
                ? "{$this->store->name}: de kassa van {$this->session->cashier?->name} staat nog open (geopend {$this->session->opened_at?->format('H:i')}). Sluit hem af vóór vertrek."
                : "{$this->store->name}: the register of {$this->session->cashier?->name} is still open (opened {$this->session->opened_at?->format('H:i')}). Close it before leaving.",
            'store_id'   => $this->store->id,
            'session_id' => $this->session->id,
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
