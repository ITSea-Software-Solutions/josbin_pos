<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast license renewal warnings to manager screens and the dashboard.
 * Triggered by the license:check command when status changes.
 *
 * Channels:
 * - org.{orgId}           — Super Admin Dashboard + all org terminals
 * - store.{storeId}       — Individual store terminals (if storeId provided)
 */
class LicenseWarning implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string  $organisationId,
        public readonly string  $licenseStatus,   // warning_30 | warning_14 | grace | soft_lock
        public readonly ?string $validUntil,
        public readonly ?string $storeId = null,
    ) {}

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel("org.{$this->organisationId}"),
        ];

        if ($this->storeId) {
            $channels[] = new PrivateChannel("store.{$this->storeId}");
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'license.warning';
    }

    public function broadcastWith(): array
    {
        $messages = [
            'warning_30' => [
                'nl' => 'Licentie verloopt over 30 dagen. Verleng tijdig.',
                'en' => 'License expires in 30 days. Renew soon.',
            ],
            'warning_14' => [
                'nl' => 'Licentie verloopt over 14 dagen. Verleng nu.',
                'en' => 'License expires in 14 days. Renew now.',
            ],
            'grace' => [
                'nl' => 'Licentie verlopen — noodperiode actief. Verleng zo snel mogelijk.',
                'en' => 'License expired — grace period active. Renew immediately.',
            ],
            'soft_lock' => [
                'nl' => 'Licentie verlopen — nieuwe verkopen geblokkeerd.',
                'en' => 'License expired — new sales blocked.',
            ],
        ];

        return [
            'organisation_id' => $this->organisationId,
            'license_status'  => $this->licenseStatus,
            'valid_until'     => $this->validUntil,
            'message_nl'      => $messages[$this->licenseStatus]['nl'] ?? '',
            'message_en'      => $messages[$this->licenseStatus]['en'] ?? '',
            'broadcast_at'    => now()->toIso8601String(),
        ];
    }
}
