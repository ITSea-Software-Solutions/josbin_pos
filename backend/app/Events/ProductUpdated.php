<?php

namespace App\Events;

use App\Models\Product;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast when a product's price, name, BTW rate, or availability changes.
 * POS terminals in the organisation receive this and refresh their product cache.
 *
 * Channel: org.{orgId} — all terminals in the organisation receive the update.
 * The frontend should invalidate the TanStack Query cache for ['pos-products'].
 */
class ProductUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly Product $product,
        public readonly string  $action = 'updated', // created | updated | deleted | price_changed
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("org.{$this->product->organisation_id}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'product.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'product_id'      => $this->product->id,
            'action'          => $this->action,
            'organisation_id' => $this->product->organisation_id,
            'name_nl'         => $this->product->name_nl,
            'name_en'         => $this->product->name_en,
            'price'           => $this->product->price,
            'btw_rate'        => $this->product->btw_rate,
            'btw_exempt'      => $this->product->btw_exempt,
            'barcode'         => $this->product->barcode,
            'stock_qty'       => $this->product->stock_qty,
        ];
    }
}
