<?php

namespace App\Jobs;

use App\Models\Sale;
use App\Services\StockMovementService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Asynchronously records stock movements after a sale, void, or refund.
 * Dispatching this as a queued job keeps the POS API response fast (<200ms).
 *
 * Reason values: 'sale' | 'void' | 'refund'
 */
class RecordStockMovements implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [30, 120, 600];

    public function __construct(
        private readonly string $saleId,
        private readonly string $userId,
        private readonly string $reason,
    ) {}

    public function handle(StockMovementService $stock): void
    {
        $sale = Sale::with('items')->find($this->saleId);
        if (! $sale) {
            Log::warning('RecordStockMovements: sale not found', ['sale_id' => $this->saleId]);
            return;
        }

        match ($this->reason) {
            'sale'           => $stock->recordSale($sale, $this->userId),
            'void', 'refund' => $stock->recordVoidOrRefund($sale, $this->reason, $this->userId),
            default          => Log::warning('RecordStockMovements: unknown reason', ['reason' => $this->reason]),
        };
    }

    public function failed(\Throwable $e): void
    {
        Log::error('RecordStockMovements permanently failed', [
            'sale_id' => $this->saleId,
            'reason'  => $this->reason,
            'error'   => $e->getMessage(),
        ]);
    }
}
