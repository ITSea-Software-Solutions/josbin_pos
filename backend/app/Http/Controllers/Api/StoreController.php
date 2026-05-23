<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class StoreController extends Controller
{
    /**
     * Return stores accessible to the authenticated user.
     * Super admin sees all stores (paginated).
     * Other roles see stores in their organisation only.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Store::query()->orderBy('name');

        if (! $user->isSuperAdmin()) {
            $query->where('organisation_id', $user->organisation_id);
        }

        if ($request->boolean('active_only', true)) {
            $query->where('is_active', true);
        }

        $stores = $query->with('organisation:id,name')->get();

        return response()->json(['data' => $stores]);
    }

    /** GET /api/stores/{store} */
    public function show(Request $request, Store $store): JsonResponse
    {
        $this->authorize('view', $store);

        // btw_number is loaded so receipts can fall back to the org's BTW
        // number when the store has no per-store override configured.
        return response()->json(['data' => $store->load('organisation:id,name,btw_number')]);
    }

    /** PUT /api/stores/{store} — org admin or super admin */
    public function update(Request $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $data = $request->validate([
            'name'              => ['sometimes', 'string', 'max:200'],
            'address'           => ['nullable', 'string', 'max:500'],
            'city'              => ['nullable', 'string', 'max:100'],
            'default_btw_rate'  => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'receipt_header'    => ['nullable', 'string', 'max:500'],
            'receipt_footer'    => ['nullable', 'string', 'max:500'],
            'receipt_logo_path' => ['nullable', 'string', 'max:500'],
            'pos_type'          => ['sometimes', Rule::in(['native', 'external'])],
            'settings'          => ['sometimes', 'array'],
            'is_active'         => ['sometimes', 'boolean'],
        ]);

        $store->update($data);

        return response()->json(['data' => $store->fresh()]);
    }

    /** POST /api/stores/{store}/logo — upload receipt logo image */
    public function uploadLogo(Request $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,svg', 'max:2048'],
        ]);

        // Remove old logo if it exists
        if ($store->receipt_logo_path && Storage::disk('public')->exists($store->receipt_logo_path)) {
            Storage::disk('public')->delete($store->receipt_logo_path);
        }

        $path = $request->file('logo')->store("logos/{$store->id}", 'public');
        $store->update(['receipt_logo_path' => $path]);

        return response()->json([
            'data' => [
                'receipt_logo_path' => $path,
                'receipt_logo_url'  => Storage::disk('public')->url($path),
            ],
        ]);
    }

    /** DELETE /api/stores/{store} — soft delete / deactivate, super admin only */
    public function destroy(Request $request, Store $store): JsonResponse
    {
        $this->authorize('delete', $store);

        $store->update(['is_active' => false]);
        $store->delete();

        return response()->json(null, 204);
    }
}
