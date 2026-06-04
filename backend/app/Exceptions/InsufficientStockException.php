<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Thrown when a sale would drive stock below zero AND the organisation has
 * opted into strict inventory (organisations.block_oversell = true).
 *
 * Thrown from inside the sale DB::transaction so the whole sale rolls back —
 * nothing is recorded, no stock moves, no money changes hands. Renders as a
 * 422 with a localised, cashier-friendly message naming the product so the
 * cashier knows exactly which line to fix.
 */
class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly string $productName,
        public readonly float $available,
        public readonly float $requested,
    ) {
        parent::__construct("Insufficient stock for {$productName}: {$available} available, {$requested} requested.");
    }

    /** Renders directly to JSON for API requests (Laravel calls this automatically). */
    public function render(Request $request): ?JsonResponse
    {
        if (! $request->is('api/*') && ! $request->expectsJson()) {
            return null;
        }

        return response()->json([
            'message' => __('errors.insufficient_stock', [
                'product'   => $this->productName,
                'available' => rtrim(rtrim(number_format($this->available, 3, '.', ''), '0'), '.'),
            ]),
            'code'      => 'INSUFFICIENT_STOCK',
            'product'   => $this->productName,
            'available' => $this->available,
            'requested' => $this->requested,
        ], 422);
    }
}
