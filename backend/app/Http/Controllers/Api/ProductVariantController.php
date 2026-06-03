<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD for product variants — nested under /products/{product}/variants.
 *
 * All authorization is via ProductPolicy (re-uses products.create / .edit /
 * .delete). No standalone variant policy — a variant inherits the parent
 * product's permission shape exactly. Cost handling mirrors ProductController:
 * cost_price is stripped from request + response when the actor lacks
 * products.view_cost.
 */
class ProductVariantController extends Controller
{
    /** GET /api/products/{product}/variants */
    public function index(Request $request, Product $product): JsonResponse
    {
        $this->authorize('view', $product);
        $this->ensureSameOrg($request, $product);

        $variants = $product->variants()->get()->map(
            fn (ProductVariant $v) => $this->formatVariantForUser($v, $request)
        );

        return response()->json(['data' => $variants]);
    }

    /** POST /api/products/{product}/variants */
    public function store(Request $request, Product $product): JsonResponse
    {
        $this->authorize('update', $product);
        $this->ensureSameOrg($request, $product);

        $data = $this->validateVariant($request, $product, null);
        $data = $this->applyCostGate($request, $data);

        $variant = $product->variants()->create([
            ...$data,
            'organisation_id' => $product->organisation_id,
        ]);

        return response()->json(['data' => $this->formatVariantForUser($variant, $request)], 201);
    }

    /** PUT /api/products/{product}/variants/{variant} */
    public function update(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorize('update', $product);
        $this->ensureSameOrg($request, $product);
        $this->ensureVariantBelongs($variant, $product);

        $data = $this->validateVariant($request, $product, $variant->id);
        $data = $this->applyCostGate($request, $data);

        $variant->update($data);

        return response()->json(['data' => $this->formatVariantForUser($variant->fresh(), $request)]);
    }

    /** DELETE /api/products/{product}/variants/{variant} */
    public function destroy(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorize('delete', $product);
        $this->ensureSameOrg($request, $product);
        $this->ensureVariantBelongs($variant, $product);

        $variant->delete();
        return response()->json(null, 204);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private function validateVariant(Request $request, Product $product, ?string $excludeId): array
    {
        return $request->validate([
            'name_nl'    => ['required', 'string', 'max:200'],
            'name_en'    => ['required', 'string', 'max:200'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            // SKU + barcode unique per ORG across product + variant tables.
            // We enforce per-table here (partial unique indexes handle cross-
            // table edge cases at the DB level). Most stores don't reuse the
            // same SKU on different parents anyway.
            'sku'        => [
                'nullable', 'string', 'max:80',
                Rule::unique('product_variants', 'sku')
                    ->where('organisation_id', $product->organisation_id)
                    ->ignore($excludeId),
            ],
            'barcode'    => [
                'nullable', 'string', 'max:30',
                Rule::unique('product_variants', 'barcode')
                    ->where('organisation_id', $product->organisation_id)
                    ->ignore($excludeId),
            ],
            // Price / cost optional — null means "inherit parent's"
            'price'              => ['nullable', 'numeric', 'min:0'],
            'cost_price'         => ['nullable', 'numeric', 'min:0'],
            'stock_qty'          => ['sometimes', 'numeric', 'min:0'],
            'low_stock_threshold'=> ['nullable', 'numeric', 'min:0'],
            'attributes'         => ['nullable', 'array'],   // {"size":"1kg","color":"red",...}
            'is_active'          => ['sometimes', 'boolean'],
        ]);
    }

    private function applyCostGate(Request $request, array $data): array
    {
        if ($request->user()->can('products.view_cost')) return $data;
        unset($data['cost_price']);
        return $data;
    }

    private function formatVariantForUser(ProductVariant $variant, Request $request): array
    {
        $arr = $variant->toArray();
        // Effective values so the dashboard/POS doesn't have to re-resolve
        $arr['effective_price'] = $variant->effectivePrice();
        if (! $request->user()->can('products.view_cost')) {
            unset($arr['cost_price']);
        } else {
            $arr['effective_cost'] = $variant->effectiveCost();
        }
        return $arr;
    }

    private function ensureSameOrg(Request $request, Product $product): void
    {
        $orgId = $request->user()->organisation_id;
        if ($orgId && $product->organisation_id !== $orgId) {
            abort(403, 'Access denied.');
        }
    }

    private function ensureVariantBelongs(ProductVariant $variant, Product $product): void
    {
        if ($variant->product_id !== $product->id) {
            abort(404);
        }
    }
}
