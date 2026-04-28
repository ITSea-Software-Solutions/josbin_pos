<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

/**
 * Atomic stock updates with full movement trail.
 *
 * All inventory changes must go through record() — it locks the product row,
 * applies the qty_change, and inserts a StockMovement in the same transaction.
 *
 * Usage:
 *   app(StockMovementService::class)->record(
 *       product: $product,
 *       qtyChange: -2.0,     // negative = deduct
 *       reason: 'sale',
 *       sale: $sale,
 *       userId: $user->id,
 *   );
 */
class StockMovementService
{
    /**
     * Atomically adjust stock_qty and record the movement.
     *
     * @param Product     $product
     * @param float       $qtyChange  Signed delta — negative to deduct
     * @param string      $reason     One of StockMovement::REASONS
     * @param string      $storeId    UUID of the store where the movement occurred
     * @param Sale|null   $sale       Associated sale (if applicable)
     * @param string|null $userId     UUID of the acting user (null = system)
     * @param string|null $notes      Required for 'adjustment' reason
     * @return StockMovement
     */
    public function record(
        Product $product,
        float $qtyChange,
        string $reason,
        string $storeId,
        ?Sale $sale = null,
        ?string $userId = null,
        ?string $notes = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $qtyChange, $reason, $storeId, $sale, $userId, $notes) {
            // Lock the row to prevent concurrent over-sells
            $locked = Product::lockForUpdate()->find($product->id);

            $qtyAfter = (float) $locked->stock_qty + $qtyChange;

            // Clamp to 0 — stock should not go negative in normal operation
            $qtyAfter = max(0.0, $qtyAfter);

            $locked->update(['stock_qty' => $qtyAfter]);

            return StockMovement::create([
                'product_id'      => $product->id,
                'store_id'        => $storeId,
                'organisation_id' => $product->organisation_id,
                'qty_change'      => $qtyChange,
                'qty_after'       => $qtyAfter,
                'reason'          => $reason,
                'sale_id'         => $sale?->id,
                'user_id'         => $userId,
                'notes'           => $notes,
                'created_at'      => now(),
            ]);
        });
    }

    /**
     * Record movements for all items in a sale (reason: 'sale').
     * Called after a sale is successfully stored.
     */
    public function recordSale(Sale $sale, ?string $userId = null): void
    {
        $sale->loadMissing('items');

        foreach ($sale->items as $item) {
            if (! $item->product_id) {
                continue; // deleted product snapshot — no stock to track
            }

            $product = Product::find($item->product_id);
            if (! $product) {
                continue;
            }

            $this->record(
                product: $product,
                qtyChange: -(float) $item->quantity,
                reason: 'sale',
                storeId: $sale->store_id,
                sale: $sale,
                userId: $userId,
            );
        }
    }

    /**
     * Restore stock for all items in a voided or refunded sale.
     * $reason should be 'void' or 'refund'.
     */
    public function recordVoidOrRefund(Sale $sale, string $reason, ?string $userId = null): void
    {
        $sale->loadMissing('items');

        foreach ($sale->items as $item) {
            if (! $item->product_id) {
                continue;
            }

            $product = Product::find($item->product_id);
            if (! $product) {
                continue;
            }

            // For refunds the qty is stored as negative in the refund sale — restore absolute value
            $qtyToRestore = abs((float) $item->quantity);

            $this->record(
                product: $product,
                qtyChange: +$qtyToRestore,
                reason: $reason,
                storeId: $sale->store_id,
                sale: $sale,
                userId: $userId,
            );
        }
    }
}
