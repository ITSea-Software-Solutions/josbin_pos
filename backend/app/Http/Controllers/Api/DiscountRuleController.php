<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiscountRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiscountRuleController extends Controller
{
    // index() is open to all authed users (POS reads rules to apply at sale).
    // Mutations (store/update/destroy) are gated by `can:discount_rules.manage`
    // in routes/api.php → Super Admin + Org Admin + Store Manager.

    /** GET /api/discount-rules */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $rules = DiscountRule::where('organisation_id', $user->organisation_id)
            ->when($request->filled('store_id'), fn ($q) => $q->where('store_id', $request->input('store_id')))
            ->when($request->boolean('active_only'), fn ($q) => $q->active())
            ->orderByDesc('created_at')
            ->paginate(min($request->integer('per_page', 50), 200));

        return response()->json($rules);
    }

    /** POST /api/discount-rules */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'store_id'         => ['nullable', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'name'             => ['required', 'string', 'max:200'],
            'applies_to'       => ['required', Rule::in(['product', 'category', 'cart'])],
            'applies_to_id'    => ['nullable', 'uuid'],
            'type'             => ['required', Rule::in(['pct_discount', 'fixed_discount', 'buy_x_get_y'])],
            'value'            => ['required', 'numeric', 'min:0.01'],
            'min_qty'          => ['sometimes', 'numeric', 'min:0.001'],
            'max_discount_srd' => ['nullable', 'numeric', 'min:0'],
            'stackable'        => ['sometimes', 'boolean'],
            'is_active'        => ['sometimes', 'boolean'],
            'valid_from'       => ['nullable', 'date'],
            'valid_to'         => ['nullable', 'date', 'after_or_equal:valid_from'],
        ]);

        // Validate: applies_to_id required for product/category
        if (in_array($data['applies_to'], ['product', 'category']) && empty($data['applies_to_id'])) {
            return response()->json([
                'message' => 'applies_to_id is required when applies_to is product or category.',
            ], 422);
        }

        $rule = DiscountRule::create(array_merge($data, [
            'organisation_id' => $user->organisation_id,
            'created_by'      => $user->id,
        ]));

        return response()->json(['data' => $rule], 201);
    }

    /** PUT /api/discount-rules/{rule} */
    public function update(Request $request, DiscountRule $discountRule): JsonResponse
    {
        $user = $request->user();
        if ($discountRule->organisation_id !== $user->organisation_id && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'name'             => ['sometimes', 'string', 'max:200'],
            'type'             => ['sometimes', Rule::in(['pct_discount', 'fixed_discount', 'buy_x_get_y'])],
            'value'            => ['sometimes', 'numeric', 'min:0.01'],
            'min_qty'          => ['sometimes', 'numeric', 'min:0.001'],
            'max_discount_srd' => ['nullable', 'numeric', 'min:0'],
            'stackable'        => ['sometimes', 'boolean'],
            'is_active'        => ['sometimes', 'boolean'],
            'valid_from'       => ['nullable', 'date'],
            'valid_to'         => ['nullable', 'date'],
        ]);

        $discountRule->update($data);

        return response()->json(['data' => $discountRule->fresh()]);
    }

    /** DELETE /api/discount-rules/{rule} */
    public function destroy(Request $request, DiscountRule $discountRule): JsonResponse
    {
        $user = $request->user();
        if ($discountRule->organisation_id !== $user->organisation_id && ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $discountRule->delete();

        return response()->json(null, 204);
    }
}
