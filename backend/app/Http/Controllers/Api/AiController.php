<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * AI Features API — v1 shipped at launch.
 *
 * GET /api/ai/product-search  — Smart fuzzy search (phonetic + typo tolerant)
 * GET /api/ai/weekly-summary  — Latest weekly AI narrative for the organisation
 * GET /api/ai/anomalies       — Recent anomaly flags from the audit log
 */
class AiController extends Controller
{
    /**
     * GET /api/ai/product-search
     *
     * Smart product search using PostgreSQL similarity functions.
     * Handles Dutch/English names, barcodes, typos, partial matches.
     * pgvector semantic search is wired when embeddings are available.
     *
     * Query params: q (required), store_id (optional), limit (default 10)
     */
    public function productSearch(Request $request): JsonResponse
    {
        $request->validate([
            'q'        => ['required', 'string', 'min:1', 'max:200'],
            'store_id' => ['nullable', 'uuid'],
            'limit'    => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $q       = trim($request->input('q'));
        $orgId   = $request->user()->organisation_id;
        $storeId = $request->input('store_id');
        $limit   = $request->integer('limit', 10);

        // Exact barcode match — highest priority
        if (preg_match('/^\d{8,14}$/', $q)) {
            $exact = Product::query()
                ->where('organisation_id', $orgId)
                ->where('is_active', true)
                ->where('barcode', $q)
                ->with('category:id,name_nl,name_en')
                ->first();

            if ($exact) {
                return response()->json(['data' => [$this->formatProduct($exact, $storeId)], 'source' => 'barcode']);
            }
        }

        // Trigram similarity search (PostgreSQL pg_trgm extension)
        // Falls back to ilike if pg_trgm is not available
        try {
            $products = Product::query()
                ->where('organisation_id', $orgId)
                ->where('is_active', true)
                ->whereRaw(
                    '(similarity(name_nl, ?) > 0.15 OR similarity(name_en, ?) > 0.15 OR name_nl ILIKE ? OR name_en ILIKE ? OR barcode LIKE ?)',
                    [$q, $q, "%{$q}%", "%{$q}%", "%{$q}%"]
                )
                ->with('category:id,name_nl,name_en')
                ->orderByRaw('GREATEST(similarity(name_nl, ?), similarity(name_en, ?)) DESC', [$q, $q])
                ->limit($limit)
                ->get();
        } catch (\Throwable) {
            // Fallback to simple ilike if trigram extension not available
            $products = Product::query()
                ->where('organisation_id', $orgId)
                ->where('is_active', true)
                ->where(fn ($query) => $query
                    ->where('name_nl', 'ilike', "%{$q}%")
                    ->orWhere('name_en', 'ilike', "%{$q}%")
                    ->orWhere('barcode', 'like', "%{$q}%")
                )
                ->with('category:id,name_nl,name_en')
                ->limit($limit)
                ->get();
        }

        return response()->json([
            'data'   => $products->map(fn ($p) => $this->formatProduct($p, $storeId))->values(),
            'source' => 'fuzzy',
            'query'  => $q,
        ]);
    }

    /**
     * GET /api/ai/weekly-summary
     * Returns the latest weekly AI summary for the current user's organisation.
     */
    public function weeklySummary(Request $request): JsonResponse
    {
        $orgId = $request->user()->organisation_id;

        $summary = DB::table('ai_summaries')
            ->where('organisation_id', $orgId)
            ->orderByDesc('week_start')
            ->first();

        if (! $summary) {
            return response()->json(['data' => null, 'message' => 'No summary available yet. Runs every Monday at 08:00 AST.']);
        }

        return response()->json([
            'data' => [
                'week_start' => $summary->week_start,
                'narrative'  => $summary->narrative,
                'stats'      => json_decode($summary->stats ?? '{}', true),
                'locale'     => $summary->locale,
                'generated_at' => $summary->updated_at,
            ],
        ]);
    }

    /**
     * GET /api/ai/anomalies
     * Recent anomaly detections from the audit log for the current organisation.
     */
    public function anomalies(Request $request): JsonResponse
    {
        $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'days'  => ['nullable', 'integer', 'min:1', 'max:90'],
        ]);

        $orgId = $request->user()->organisation_id;
        $days  = $request->integer('days', 30);
        $limit = $request->integer('limit', 20);

        $anomalies = DB::table('audit_logs')
            ->where('organisation_id', $orgId)
            ->where('event', 'anomaly_detected')
            ->where('created_at', '>=', now()->subDays($days))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                $data = json_decode($row->new_values ?? '{}', true);
                return [
                    'id'           => $row->id,
                    'detected_at'  => $row->created_at,
                    'sale_number'  => $data['sale_number'] ?? null,
                    'store'        => $data['store'] ?? null,
                    'cashier'      => $data['cashier'] ?? null,
                    'total_srd'    => $data['total_srd'] ?? null,
                    'flags'        => $data['flags'] ?? [],
                    'ai_narrative' => $data['ai_narrative'] ?? null,
                ];
            });

        return response()->json(['data' => $anomalies]);
    }

    // ─── Helper ───────────────────────────────────────────────────────────────

    private function formatProduct(Product $p, ?string $storeId): array
    {
        return [
            'id'         => $p->id,
            'name_nl'    => $p->name_nl,
            'name_en'    => $p->name_en,
            'barcode'    => $p->barcode,
            'price'      => (string) $p->priceForStore($storeId),
            'btw_rate'   => (string) $p->btw_rate,
            'btw_exempt' => $p->btw_exempt,
            'stock_qty'  => (string) $p->stock_qty,
            'category'   => $p->category,
        ];
    }
}
