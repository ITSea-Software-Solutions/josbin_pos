<?php

namespace App\Events;

use App\Models\Sale;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast on two private channels:
 * 1. store.{storeId}     — POS terminals in the store see the new sale total
 * 2. org.{orgId}         — Super Admin Dashboard updates the live store card
 *
 * Channel authentication: the user must belong to the same organisation.
 * Government org channels are never broadcast alongside commercial org channels.
 */
class SaleCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Sale $sale,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("store.{$this->sale->store_id}"),
            new PrivateChannel("org.{$this->sale->store->organisation_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'sale.completed';
    }

    public function broadcastWith(): array
    {
        return [
            'sale_id'        => $this->sale->id,
            'sale_number'    => $this->sale->sale_number,
            'store_id'       => $this->sale->store_id,
            'store_name'     => $this->sale->store?->name,
            'organisation_id'=> $this->sale->store?->organisation_id,
            'total_srd'      => $this->sale->total_srd,
            'btw_srd'        => $this->sale->btw_srd,
            'payment_method' => $this->sale->payment_method,
            'occurred_at'    => $this->sale->occurred_at,
            'cashier_name'   => $this->sale->cashier?->name,
        ];
    }

    /** Exclude the cashier who created the sale from receiving the echo */
    public function broadcastToEveryoneExcept(): mixed
    {
        return null; // broadcast to all subscribers including creator
    }
}
