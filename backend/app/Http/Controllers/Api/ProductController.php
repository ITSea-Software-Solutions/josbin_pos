<?php

namespace App\Http\Controllers\Api;

use App\Events\CatalogueRefresh;
use App\Events\ProductUpdated;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\StoreProductOverride;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    /** GET /api/products — full catalogue with optional filters */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $query = Product::query()
            ->where('organisation_id', $request->user()->organisation_id)
            ->with('category:id,name_nl,name_en,icon,color')
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->input('category_id')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%' . $request->input('search') . '%';
                $q->where(fn ($q2) => $q2
                    ->where('name_nl', 'ilike', $term)
                    ->orWhere('name_en', 'ilike', $term)
                    ->orWhere('barcode', 'like', $term)
                );
            })
            ->when($request->boolean('active_only', true), fn ($q) => $q->where('is_active', true))
            ->when($request->boolean('low_stock'), function ($q) use ($request) {
                // Per-store low-stock if a store_id is given, otherwise org-wide aggregate.
                if ($request->filled('store_id')) {
                    $q->whereExists(function ($sub) use ($request) {
                        $sub->selectRaw('1')->from('product_stocks')
                            ->whereColumn('product_stocks.product_id', 'products.id')
                            ->where('product_stocks.store_id', $request->input('store_id'))
                            ->whereRaw('product_stocks.stock_qty <= product_stocks.low_stock_threshold')
                            ->whereRaw('product_stocks.low_stock_threshold > 0');
                    });
                } else {
                    $q->whereRaw('stock_qty <= low_stock_threshold AND low_stock_threshold > 0');
                }
            })
            ->orderBy('name_nl')
            ->paginate($request->integer('per_page', 50));

        return response()->json($query);
    }

    /** GET /api/products/pos — minimal payload for POS grid (fast) */
    public function pos(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $storeId = $request->input('store_id');

        $products = Product::query()
            ->where('organisation_id', $request->user()->organisation_id)
            ->where('is_active', true)
            ->with(['category:id,name_nl,name_en,icon,color', 'storeStocks'])
            ->orderBy('name_nl')
            ->get()
            ->map(function (Product $p) use ($storeId) {
                return [
                    'id'           => $p->id,
                    'name_nl'      => $p->name_nl,
                    'name_en'      => $p->name_en,
                    'barcode'      => $p->barcode,
                    'price'        => (string) $p->priceForStore($storeId),
                    'btw_rate'     => (string) $p->btw_rate,
                    'btw_exempt'   => $p->btw_exempt,
                    'stock_qty'    => $p->stockForStore($storeId),
                    'image_path'   => $p->image_path,
                    'category_id'  => $p->category_id,
                    'category'     => $p->category,
                ];
            });

        return response()->json(['data' => $products]);
    }

    /** GET /api/products/barcode/{barcode} — sub-100ms lookup for scanner */
    public function byBarcode(Request $request, string $barcode): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $product = Product::query()
            ->where('organisation_id', $request->user()->organisation_id)
            ->where('barcode', $barcode)
            ->where('is_active', true)
            ->with('category:id,name_nl,name_en')
            ->first();

        if (! $product) {
            return response()->json(['message' => 'Product niet gevonden.', 'code' => 'NOT_FOUND'], 404);
        }

        $storeId = $request->input('store_id');

        return response()->json([
            'data' => [
                'id'         => $product->id,
                'name_nl'    => $product->name_nl,
                'name_en'    => $product->name_en,
                'barcode'    => $product->barcode,
                'price'      => (string) $product->priceForStore($storeId),
                'btw_rate'   => (string) $product->btw_rate,
                'btw_exempt' => $product->btw_exempt,
                'stock_qty'  => $product->stockForStore($storeId),
                'category'   => $product->category,
            ],
        ]);
    }

    /** GET /api/products/{product} */
    public function show(Request $request, Product $product): JsonResponse
    {
        $this->authorize('view', $product);
        $this->ensureSameOrg($request, $product->organisation_id);

        return response()->json(['data' => $product->load('category')]);
    }

    /** POST /api/products */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Product::class);

        $data = $this->validateProduct($request);

        $product = Product::create([
            ...$data,
            'organisation_id' => $request->user()->organisation_id,
            'is_active'       => true,
        ]);

        broadcast(new ProductUpdated($product, 'created'));

        return response()->json(['data' => $product->load('category')], 201);
    }

    /** PUT /api/products/{product} */
    public function update(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);
        $this->ensureSameOrg($request, $product->organisation_id);

        $data = $this->validateProduct($request, $product->id);
        $action = isset($data['price']) && $data['price'] !== (string) $product->price
            ? 'price_changed'
            : 'updated';

        $product->update($data);

        broadcast(new ProductUpdated($product->fresh(), $action));

        return response()->json(['data' => $product->fresh()->load('category')]);
    }

    /** DELETE /api/products/{product} */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        $this->authorize('delete', $product);
        $this->ensureSameOrg($request, $product->organisation_id);

        broadcast(new ProductUpdated($product, 'deleted'));
        $product->delete();

        return response()->json(null, 204);
    }

    /**
     * GET /api/products/export
     * Download all products for this organisation as a UTF-8 CSV.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorize('viewAny', Product::class);

        $products = Product::query()
            ->where('organisation_id', $request->user()->organisation_id)
            ->with('category:id,name_nl,name_en')
            ->orderBy('name_nl')
            ->get();

        $filename = 'josbin-products-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($products) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel opens accents correctly
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'name_nl', 'name_en', 'barcode', 'price', 'btw_rate',
                'btw_exempt', 'category_name_nl', 'stock_qty', 'is_active',
            ]);
            foreach ($products as $p) {
                fputcsv($out, [
                    $p->name_nl,
                    $p->name_en,
                    $p->barcode ?? '',
                    $p->price,
                    $p->btw_rate,
                    $p->btw_exempt ? '1' : '0',
                    $p->category->name_nl ?? '',
                    $p->stock_qty,
                    $p->is_active ? '1' : '0',
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * GET /api/products/import/template
     * Download a blank CSV template with headers + 3 example rows.
     */
    public function importTemplate(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $headers = ['name_nl', 'name_en', 'barcode', 'price', 'btw_rate', 'btw_exempt', 'category_name_nl', 'stock_qty'];
        $rows = [
            ['Volle Melk 1L', 'Full Milk 1L',  '8712345678901', '4.99', '0',  '1', 'Zuivel',     '50'],
            ['Brood Wit',     'White Bread',   '8712345678902', '3.50', '10', '0', 'Bakkerij',   '30'],
            ['Coca-Cola 2L',  'Coca-Cola 2L',  '5449000054227', '6.75', '10', '0', 'Dranken',    '100'],
        ];

        // ?format=xlsx returns a real Excel file; default is CSV
        if (strtolower($request->query('format', 'csv')) === 'xlsx') {
            return response()->streamDownload(function () use ($headers, $rows) {
                $s = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
                $s->getActiveSheet()->fromArray(array_merge([$headers], $rows));
                $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($s);
                $writer->save('php://output');
            }, 'josbin-products-template.xlsx', [
                'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="josbin-products-template.xlsx"',
            ]);
        }

        return response()->streamDownload(function () use ($headers, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel opens UTF-8 correctly
            fputcsv($out, $headers);
            foreach ($rows as $r) fputcsv($out, $r);
        }, 'josbin-products-template.csv', [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="josbin-products-template.csv"',
        ]);
    }

    /**
     * POST /api/products/import
     * CSV import: name_nl, name_en, barcode, price, btw_rate, btw_exempt, category_name_nl, stock_qty
     */
    public function import(Request $request): JsonResponse
    {
        $this->authorize('import', Product::class);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:10240'],
        ]);

        $orgId = $request->user()->organisation_id;
        $file  = $request->file('file');
        $path  = $file->getRealPath();
        $ext   = strtolower($file->getClientOriginalExtension() ?: $file->extension());

        try {
            [$headers, $rows] = $this->readImportFile($path, $ext);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not read file: ' . $e->getMessage()], 422);
        }

        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors  = [];
        $categoryCache = []; // name_nl → id, avoid N+1 on categories

        DB::beginTransaction();
        try {
            foreach ($rows as $index => $row) {
                // Skip blank trailing rows
                if (count(array_filter($row, fn ($v) => trim($v) !== '')) === 0) {
                    continue;
                }

                if (count($row) < count($headers)) {
                    // Pad missing columns with empty string (tolerant of trailing missing cols)
                    $row = array_pad($row, count($headers), '');
                }

                $data    = array_combine($headers, array_slice($row, 0, count($headers)));
                $barcode = trim($data['barcode'] ?? '');
                $nameNl  = trim($data['name_nl'] ?? '');

                if ($nameNl === '') {
                    $errors[] = 'Row ' . ($index + 2) . ': name_nl is required';
                    $skipped++;
                    continue;
                }

                // Resolve category by name — create if not found
                $categoryId = null;
                $catName    = trim($data['category_name_nl'] ?? $data['category_id'] ?? '');
                if ($catName !== '') {
                    if (!isset($categoryCache[$catName])) {
                        $cat = \App\Models\Category::firstOrCreate(
                            ['organisation_id' => $orgId, 'name_nl' => $catName],
                            ['name_en' => $catName, 'sort_order' => 0, 'is_active' => true]
                        );
                        $categoryCache[$catName] = $cat->id;
                    }
                    $categoryId = $categoryCache[$catName];
                }

                $attrs = [
                    'name_nl'         => $nameNl,
                    'name_en'         => trim($data['name_en'] ?? '') ?: $nameNl,
                    'price'           => (string) round(abs((float) ($data['price'] ?? 0)), 2),
                    'btw_rate'        => (string) min(100, max(0, round((float) ($data['btw_rate'] ?? 10), 2))),
                    'btw_exempt'      => filter_var($data['btw_exempt'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'stock_qty'       => (string) max(0, round((float) ($data['stock_qty'] ?? 0), 3)),
                    'low_stock_threshold' => (string) max(0, round((float) ($data['low_stock_threshold'] ?? 0), 3)),
                    'category_id'     => $categoryId,
                    'organisation_id' => $orgId,
                    'is_active'       => filter_var($data['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN),
                ];

                if ($barcode) {
                    $product = Product::updateOrCreate(
                        ['organisation_id' => $orgId, 'barcode' => $barcode],
                        $attrs
                    );
                    $product->wasRecentlyCreated ? $created++ : $updated++;
                } else {
                    Product::create($attrs);
                    $created++;
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 422);
        }

        return response()->json([
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => $errors,
        ]);
    }

    /**
     * Read an import file (CSV / XLSX / XLS) into [headers, rows].
     * Headers are trimmed; rows are plain numeric-indexed arrays so the
     * same downstream loop works for any format.
     */
    private function readImportFile(string $path, string $ext): array
    {
        if (in_array($ext, ['xlsx', 'xls'], true)) {
            // PhpSpreadsheet is already in vendor (via maatwebsite/excel).
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($path);
            $reader->setReadDataOnly(true);
            $sheet  = $reader->load($path)->getActiveSheet();
            // toArray(null, true, true, false) → numeric-indexed rows, formatted values, dates calculated
            $rows   = $sheet->toArray(null, true, true, false);
            if (empty($rows)) {
                return [[], []];
            }
            $headers = array_map(fn ($v) => trim((string) $v), array_shift($rows));
            return [$headers, $rows];
        }

        // CSV / TXT
        $rows    = array_map('str_getcsv', file($path));
        $headers = array_map('trim', array_shift($rows));
        return [$headers, $rows];
    }

    /**
     * POST /api/products/push
     *
     * Broadcast a catalogue.refresh signal to all POS terminals in this organisation.
     * Terminals respond by invalidating their product cache and refetching from /api/products/pos.
     * Useful after bulk CSV imports or a series of price/availability changes.
     */
    public function pushCatalogue(Request $request): JsonResponse
    {
        $this->authorize('create', Product::class); // store_manager or above

        $orgId = $request->user()->organisation_id;

        $count = Product::where('organisation_id', $orgId)
            ->where('is_active', true)
            ->count();

        broadcast(new CatalogueRefresh(
            organisationId:    $orgId,
            triggeredByUserId: $request->user()->id,
            triggeredByName:   $request->user()->name,
            productCount:      $count,
        ));

        return response()->json([
            'message'       => 'Catalogue refresh broadcast sent.',
            'product_count' => $count,
            'broadcast_at'  => now()->toIso8601String(),
        ]);
    }

    /**
     * POST /api/products/{product}/image
     * Upload a product image. Stores to storage/app/public/products/{uuid}.webp
     * Max 2 MB, accepts JPEG/PNG/WebP/GIF. Converts to WebP via GD if available.
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);
        $this->ensureSameOrg($request, $product->organisation_id);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpeg,jpg,png,webp,gif', 'max:2048'],
        ]);

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $request->file('image');

        // Store to public disk: storage/app/public/products/{uuid}.{ext}
        $ext  = $file->getClientOriginalExtension() ?: 'jpg';
        $path = $file->storeAs(
            'products',
            $product->id . '.' . $ext,
            'public',
        );

        // Delete old image if different path
        if ($product->image_path && $product->image_path !== $path) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($product->image_path);
        }

        $product->update(['image_path' => $path]);

        return response()->json([
            'image_path' => $path,
            'image_url'  => \Illuminate\Support\Facades\Storage::disk('public')->url($path),
        ]);
    }

    /**
     * GET /api/products/{product}/stock-history
     * Returns the stock movement ledger for a product (manager+).
     */
    public function stockHistory(Request $request, Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        $movements = StockMovement::where('product_id', $product->id)
            ->with('user:id,name', 'sale:id,sale_number,occurred_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($movements);
    }

    /**
     * POST /api/products/{product}/stock-adjust
     * Manual stock adjustment (receive stock, write-off, correction).
     */
    public function stockAdjust(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);
        $this->ensureSameOrg($request, $product->organisation_id);

        $data = $request->validate([
            'qty_change' => ['required', 'numeric'],
            'reason'     => ['required', 'in:adjustment,import,initial'],
            'notes'      => ['nullable', 'string', 'max:500'],
            // Required now — stock is per-store. Manager must pick which store
            // they're adjusting (write-off, receive stock, correction, etc.).
            'store_id'   => ['required', 'uuid', 'exists:stores,id'],
        ]);

        app(\App\Services\StockMovementService::class)->record(
            product:   $product,
            qtyChange: (float) $data['qty_change'],
            reason:    $data['reason'],
            storeId:   $data['store_id'],
            userId:    $request->user()->id,
            notes:     $data['notes'] ?? null,
        );

        return response()->json([
            'data' => [
                'id'        => $product->id,
                'name_nl'   => $product->name_nl,
                'stock_qty' => $product->stockForStore($data['store_id']),
            ],
        ]);
    }

    /**
     * GET /api/stores/{store}/price-overrides
     */
    public function storeOverrides(Request $request, \App\Models\Store $store): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $overrides = StoreProductOverride::where('store_id', $store->id)
            ->with('product:id,name_nl,name_en,barcode,price')
            ->get()
            ->map(fn ($o) => [
                'id'             => $o->id,
                'product_id'     => $o->product_id,
                'product_name'   => $o->product?->name_nl,
                'base_price'     => (string) $o->product?->price,
                'price_override' => (string) $o->price_override,
                'is_active'      => $o->is_active,
            ]);

        return response()->json(['data' => $overrides]);
    }

    /**
     * POST /api/stores/{store}/price-overrides
     * Create or update a per-store price override.
     */
    public function upsertOverride(Request $request, \App\Models\Store $store): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $data = $request->validate([
            'product_id'     => ['required', 'uuid', 'exists:products,id'],
            'price_override' => ['required', 'numeric', 'min:0'],
        ]);

        $override = StoreProductOverride::updateOrCreate(
            ['store_id' => $store->id, 'product_id' => $data['product_id']],
            ['price_override' => $data['price_override'], 'is_active' => true]
        );

        return response()->json(['data' => $override], 201);
    }

    /**
     * DELETE /api/stores/{store}/price-overrides/{product}
     */
    public function deleteOverride(\App\Models\Store $store, Product $product): JsonResponse
    {
        abort_unless(request()->user()->isAtLeastManager(), 403);

        StoreProductOverride::where('store_id', $store->id)
            ->where('product_id', $product->id)
            ->delete();

        return response()->json(null, 204);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function validateProduct(Request $request, ?string $excludeId = null): array
    {
        return $request->validate([
            'name_nl'     => ['required', 'string', 'max:200'],
            'name_en'     => ['required', 'string', 'max:200'],
            'barcode'     => [
                'nullable', 'string', 'max:30',
                Rule::unique('products', 'barcode')
                    ->where('organisation_id', $request->user()->organisation_id)
                    ->ignore($excludeId),
            ],
            'price'       => ['required', 'numeric', 'min:0'],
            'btw_rate'    => ['required', 'numeric', 'min:0', 'max:100'],
            'btw_exempt'  => ['sometimes', 'boolean'],
            'stock_qty'           => ['sometimes', 'numeric', 'min:0'],
            'low_stock_threshold' => ['sometimes', 'numeric', 'min:0'],
            'category_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'image_path'  => ['nullable', 'string', 'max:500'],
            'is_active'   => ['sometimes', 'boolean'],
        ]);
    }

    private function ensureSameOrg(Request $request, string $orgId): void
    {
        if ($request->user()->organisation_id && $request->user()->organisation_id !== $orgId) {
            abort(403, 'Access denied to this resource.');
        }
    }
}
