<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast a full catalogue refresh signal to all POS terminals in an organisation.
 *
 * When received, POS terminals invalidate their ['pos-products'] TanStack Query cache
 * and refetch the full product list from /api/products/pos.
 *
 * This is triggered manually by admins after bulk imports or price changes.
 * Individual product changes also broadcast via ProductUpdated for real-time sync.
 *
 * Channel: org.{orgId} — all terminals in the organisation receive the signal.
 */
class CatalogueRefresh implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string  $organisationId,
        public readonly string  $triggeredByUserId,
        public readonly string  $triggeredByName,
        public readonly int     $productCount,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("org.{$this->organisationId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'catalogue.refresh';
    }

    public function broadcastWith(): array
    {
        return [
            'organisation_id'     => $this->organisationId,
            'product_count'       => $this->productCount,
            'triggered_by'        => $this->triggeredByName,
            'broadcast_at'        => now()->toIso8601String(),
        ];
    }
}
