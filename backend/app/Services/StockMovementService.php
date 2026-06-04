<?php

namespace App\Services;

use App\Exceptions\InsufficientStockException;
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
     * @param float       $qtyChange       Signed delta — negative to deduct
     * @param string      $reason          One of StockMovement::REASONS
     * @param string      $storeId         UUID of the store where the movement occurred
     * @param Sale|null   $sale            Associated sale (if applicable)
     * @param string|null $userId          UUID of the acting user (null = system)
     * @param string|null $notes           Required for 'adjustment' reason
     * @param bool        $blockOnNegative When true, a resulting stock < 0 throws
     *                                     InsufficientStockException (strict mode).
     *                                     When false (default org policy), stock is
     *                                     allowed to go negative so the ledger stays
     *                                     honest (Σ qty_change == qty_after).
     * @return StockMovement
     *
     * @throws InsufficientStockException
     */
    public function record(
        Product $product,
        float $qtyChange,
        string $reason,
        string $storeId,
        ?Sale $sale = null,
        ?string $userId = null,
        ?string $notes = null,
        bool $blockOnNegative = false,
    ): StockMovement {
        return DB::transaction(function () use ($product, $qtyChange, $reason, $storeId, $sale, $userId, $notes, $blockOnNegative) {
            // Per-store stock is the source of truth. Lock the matching row
            // for this (product, store) pair to prevent two concurrent sales
            // at the same store from overselling. Sales at *different* stores
            // for the same product don't block each other.
            $stock = \App\Models\ProductStock::where('product_id', $product->id)
                ->where('store_id', $storeId)
                ->lockForUpdate()
                ->first();

            // No row yet (new store added after the migration backfill) —
            // initialise from the product's default stock_qty and threshold.
            if (! $stock) {
                $stock = \App\Models\ProductStock::create([
                    'product_id'          => $product->id,
                    'store_id'            => $storeId,
                    'stock_qty'           => $product->stock_qty,
                    'low_stock_threshold' => $product->low_stock_threshold ?? 0,
                ]);
                // Re-fetch with a row lock so the same transaction applies the change atomically.
                $stock = \App\Models\ProductStock::where('id', $stock->id)->lockForUpdate()->first();
            }

            // Honest running balance. We do NOT clamp to zero — clamping made
            // qty_after disagree with qty_change and broke the ledger invariant
            // (Σ qty_change must equal qty_after). A negative value truthfully
            // says "we sold more than we had on record" and surfaces a wrong
            // count to the manager.
            $qtyAfter = bcadd((string) $stock->stock_qty, (string) $qtyChange, 3);

            // Strict inventory (org opted in): a deduction that would go below
            // zero is rejected, rolling back the whole sale transaction.
            if ($blockOnNegative && bccomp($qtyAfter, '0', 3) < 0) {
                throw new InsufficientStockException(
                    productName: $product->name_nl ?? $product->name_en ?? (string) $product->id,
                    available: (float) $stock->stock_qty,
                    requested: abs($qtyChange),
                );
            }

            $stock->update(['stock_qty' => $qtyAfter]);

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
     *
     * Must run inside the sale's DB::transaction so that a rejected oversell
     * (strict mode) rolls the whole sale back, and so a queue outage can never
     * leave a committed sale with un-decremented stock.
     *
     * @param bool $blockOnNegative Strict inventory — reject sales that would
     *                              drive any line's stock below zero.
     *
     * @throws InsufficientStockException
     */
    public function recordSale(Sale $sale, ?string $userId = null, bool $blockOnNegative = false): void
    {
        $sale->loadMissing('items');

        // Batch-load every product once instead of Product::find() per line —
        // keeps the row-lock window short while we hold the sale transaction.
        $productIds = $sale->items->pluck('product_id')->filter()->unique();
        $products   = Product::whereIn('id', $productIds)->get()->keyBy('id');

        foreach ($sale->items as $item) {
            if (! $item->product_id) {
                continue; // deleted product snapshot — no stock to track
            }

            $product = $products->get($item->product_id);
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
                blockOnNegative: $blockOnNegative,
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
