<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a store goes online or offline (last API call timestamp exceeded).
 * The Super Admin Dashboard store card shows the online/offline indicator.
 */
class StoreStatusChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $storeId,
        public readonly string $organisationId,
        public readonly bool   $isOnline,
        public readonly string $storeName,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("org.{$this->organisationId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'store.status';
    }

    public function broadcastWith(): array
    {
        return [
            'store_id'        => $this->storeId,
            'store_name'      => $this->storeName,
            'organisation_id' => $this->organisationId,
            'is_online'       => $this->isOnline,
            'changed_at'      => now()->toIso8601String(),
        ];
    }
}
