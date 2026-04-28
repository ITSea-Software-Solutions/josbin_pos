<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /** GET /api/categories */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Category::class);

        $categories = Category::query()
            ->where('organisation_id', $request->user()->organisation_id)
            ->orderBy('sort_order')
            ->orderBy('name_nl')
            ->get();

        return response()->json(['data' => $categories]);
    }

    /** POST /api/categories */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('manage', Category::class);

        $data = $request->validate([
            'name_nl'    => ['required', 'string', 'max:100'],
            'name_en'    => ['required', 'string', 'max:100'],
            'icon'       => ['nullable', 'string', 'max:50'],
            'color'      => ['nullable', 'string', 'max:20'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $category = Category::create([
            ...$data,
            'organisation_id' => $request->user()->organisation_id,
            'is_active'       => true,
        ]);

        return response()->json(['data' => $category], 201);
    }

    /** PUT /api/categories/{category} */
    public function update(Request $request, Category $category): JsonResponse
    {
        $this->authorize('manage', Category::class);
        $this->ensureSameOrg($request, $category->organisation_id);

        $data = $request->validate([
            'name_nl'    => ['sometimes', 'string', 'max:100'],
            'name_en'    => ['sometimes', 'string', 'max:100'],
            'icon'       => ['nullable', 'string', 'max:50'],
            'color'      => ['nullable', 'string', 'max:20'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active'  => ['sometimes', 'boolean'],
        ]);

        $category->update($data);

        return response()->json(['data' => $category]);
    }

    /** DELETE /api/categories/{category} */
    public function destroy(Request $request, Category $category): JsonResponse
    {
        $this->authorize('manage', Category::class);
        $this->ensureSameOrg($request, $category->organisation_id);

        $category->delete();

        return response()->json(null, 204);
    }

    private function ensureSameOrg(Request $request, string $orgId): void
    {
        if ($request->user()->organisation_id && $request->user()->organisation_id !== $orgId) {
            abort(403, 'Access denied to this resource.');
        }
    }
}
