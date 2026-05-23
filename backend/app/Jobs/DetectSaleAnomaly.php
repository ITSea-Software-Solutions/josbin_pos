<?php

namespace App\Jobs;

use App\Models\AuditLog;
use App\Models\Sale;
use App\Models\Store;
use App\Services\AiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Fraud & Anomaly Detection — runs after every completed sale.
 *
 * Uses heuristic rules (fast, no API key needed) plus optional GPT-4o
 * narrative explanation (when API key is present).
 *
 * Flags:
 *   - Large discount (> 30% on a single sale)
 *   - Off-hours sale (before 06:00 or after 23:00 AST)
 *   - Unusually large basket (> 3 × store daily average)
 *   - Same cashier voided > 3 sales in last hour
 *   - Sale amount > 2 standard deviations from store 30-day average
 *
 * Flagged sales are stored in the audit log with event='anomaly_detected'.
 * Future: push notification to store manager via WebSocket.
 */
class DetectSaleAnomaly implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries   = 3;
    public int $timeout = 60;

    public function __construct(public readonly string $saleId) {}

    public function handle(AiService $ai): void
    {
        $sale = Sale::with(['cashier:id,name', 'store:id,name', 'items'])
            ->find($this->saleId);

        if (! $sale || $sale->status !== 'completed') {
            return;
        }

        $flags = $this->runHeuristicChecks($sale);

        if (empty($flags)) {
            return; // Clean — nothing to report
        }

        // Build an AI narrative explanation (best-effort; silent if no key)
        $narrative = $ai->isConfigured()
            ? $this->buildNarrative($ai, $sale, $flags)
            : null;

        // Log to the tamper-evident audit trail. AuditLog::create maintains the
        // SHA-256 hash chain via the model's creating hook — a raw
        // DB::table()->insert() would leave the row hash-less and break
        // `audit:verify`, so it must not be used here.
        AuditLog::create([
            'user_id'         => $sale->cashier_id,
            'organisation_id' => $sale->store->organisation_id ?? null,
            'event'           => 'anomaly_detected',
            'auditable_type'  => Sale::class,
            'auditable_id'    => $sale->id,
            'old_values'      => null,
            'new_values'      => [
                'sale_number'  => $sale->sale_number,
                'flags'        => $flags,
                'store'        => $sale->store->name ?? null,
                'cashier'      => $sale->cashier->name ?? null,
                'total_srd'    => $sale->total_srd,
                'ai_narrative' => $narrative,
                'detected_at'  => now()->setTimezone('America/Paramaribo')->toIso8601String(),
            ],
            'ip_address'      => null,
        ]);

        Log::warning('[AnomalyDetection] Flagged sale', [
            'sale_number' => $sale->sale_number,
            'flags'       => $flags,
            'store'       => $sale->store->name ?? null,
        ]);
    }

    /** @return string[] list of flag descriptions */
    private function runHeuristicChecks(Sale $sale): array
    {
        $flags  = [];
        $storeId = $sale->store_id;
        $ast    = now()->setTimezone('America/Paramaribo');
        $saleTime = \Carbon\Carbon::parse($sale->occurred_at)->setTimezone('America/Paramaribo');

        // 1. Off-hours sale
        if ($saleTime->hour < 6 || $saleTime->hour >= 23) {
            $flags[] = sprintf('Off-hours sale at %s AST', $saleTime->format('H:i'));
        }

        // 2. Large discount (> 30% off total)
        if ((float) $sale->total_srd > 0) {
            $discountPct = ((float) $sale->discount_srd / ((float) $sale->total_srd + (float) $sale->discount_srd)) * 100;
            if ($discountPct > 30) {
                $flags[] = sprintf('Discount %.1f%% exceeds threshold (30%%)', $discountPct);
            }
        }

        // 3. Unusually large basket vs 30-day average
        $avgResult = DB::table('sales')
            ->where('store_id', $storeId)
            ->where('status', 'completed')
            ->where('id', '!=', $sale->id)
            ->where('occurred_at', '>=', now()->subDays(30))
            ->selectRaw('AVG(total_srd) as avg_total, STDDEV(total_srd) as std_total')
            ->first();

        if ($avgResult && $avgResult->avg_total > 0 && $avgResult->std_total > 0) {
            $zScore = abs(((float) $sale->total_srd - (float) $avgResult->avg_total) / (float) $avgResult->std_total);
            if ($zScore > 2.5) {
                $flags[] = sprintf(
                    'Sale SRD %.2f is %.1f standard deviations from 30-day avg (SRD %.2f)',
                    $sale->total_srd,
                    $zScore,
                    $avgResult->avg_total,
                );
            }
        }

        // 4. Same cashier voided > 3 sales in last 1 hour
        if ($sale->cashier_id) {
            $recentVoids = DB::table('sales')
                ->where('store_id', $storeId)
                ->where('cashier_id', $sale->cashier_id)
                ->where('status', 'voided')
                ->where('occurred_at', '>=', now()->subHour())
                ->count();

            if ($recentVoids >= 3) {
                $flags[] = sprintf('Cashier has %d voided sales in the last hour', $recentVoids);
            }
        }

        // 5. Negative or zero total on a non-void
        if ((float) $sale->total_srd <= 0) {
            $flags[] = sprintf('Zero/negative total: SRD %.2f', $sale->total_srd);
        }

        return $flags;
    }

    private function buildNarrative(AiService $ai, Sale $sale, array $flags): ?string
    {
        $saleTime = \Carbon\Carbon::parse($sale->occurred_at)
            ->setTimezone('America/Paramaribo')
            ->format('d-m-Y H:i');

        $prompt = sprintf(
            "You are a POS fraud analyst for Josbin POS in Suriname. " .
            "A sale has been flagged. Write a short (2-3 sentence) risk assessment in Dutch. " .
            "Be factual, professional, and concise.\n\n" .
            "Sale: %s | Store: %s | Cashier: %s | Amount: SRD %s | Time: %s\n" .
            "Flags:\n- %s",
            $sale->sale_number,
            $sale->store->name ?? 'Unknown',
            $sale->cashier->name ?? 'Unknown',
            $sale->total_srd,
            $saleTime,
            implode("\n- ", $flags),
        );

        return $ai->complete(
            'You are a concise fraud analyst. Respond only in Dutch. No headers, no bullet points. 2-3 sentences max.',
            $prompt,
            200,
        );
    }
}
