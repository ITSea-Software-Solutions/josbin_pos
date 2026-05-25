<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiIntegration;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ApiIntegrationController extends Controller
{
    // Permission gate (`api_integrations.manage`) is enforced on every route
    // in routes/api.php → Super Admin + Org Admin only. See
    // RolesAndPermissionsSeeder for the assignment.

    /** GET /api/api-keys */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = ApiIntegration::query()
            ->with('store:id,name,organisation_id')
            ->orderByDesc('created_at');

        if (! $user->isSuperAdmin()) {
            $storeIds = Store::where('organisation_id', $user->organisation_id)->pluck('id');
            $query->whereIn('store_id', $storeIds);
        }

        $keys = $query->get()->map(fn (ApiIntegration $k) => [
            'id'             => $k->id,
            'store_id'       => $k->store_id,
            'store_name'     => $k->store?->name ?? $k->store_id,
            'pos_system'     => $k->pos_system,
            'webhook_url'    => $k->webhook_url,
            'webhook_events' => $k->webhook_events ?? [],
            'last_ping_at'   => $k->last_ping_at?->toIso8601String(),
            'is_active'      => $k->is_active,
            'created_at'     => $k->created_at?->toIso8601String(),
        ]);

        return response()->json(['data' => $keys]);
    }

    /**
     * POST /api/api-keys
     * Generates a new API key. Returns the raw key ONCE — never stored plain.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'store_id'       => ['required', 'uuid', 'exists:stores,id'],
            'pos_system'     => ['required', 'string', 'max:100'],
            'webhook_url'    => ['nullable', 'url', 'max:500'],
            'webhook_events' => ['nullable', 'array'],
            'webhook_events.*' => ['string'],
        ]);

        // Verify access to the store
        $store = Store::findOrFail($data['store_id']);
        if (! $user->isSuperAdmin() && $store->organisation_id !== $user->organisation_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $rawKey        = 'sk_' . Str::random(48);
        $keyHash       = hash('sha256', $rawKey);
        $webhookSecret = bin2hex(random_bytes(32));

        $integration = ApiIntegration::create([
            'store_id'       => $data['store_id'],
            'pos_system'     => $data['pos_system'],
            'api_key_hash'   => $keyHash,
            'webhook_url'    => $data['webhook_url'] ?? null,
            'webhook_events' => $data['webhook_events'] ?? ['sale.created'],
            'webhook_secret' => $webhookSecret,
            'is_active'      => true,
        ]);

        return response()->json([
            'data' => [
                'id'             => $integration->id,
                'store_id'       => $integration->store_id,
                'pos_system'     => $integration->pos_system,
                'is_active'      => true,
                'created_at'     => $integration->created_at?->toIso8601String(),
                // Raw credentials returned only once at creation — save immediately
                'api_key'            => $rawKey,
                'api_key_prefix'     => substr($rawKey, 0, 10) . '...',
                'webhook_secret'     => $webhookSecret,
            ],
        ], 201);
    }

    /** PUT /api/api-keys/{integration} — update webhook config */
    public function update(Request $request, ApiIntegration $apiIntegration): JsonResponse
    {
        $user = $request->user();
        $store = Store::findOrFail($apiIntegration->store_id);
        if (! $user->isSuperAdmin() && $store->organisation_id !== $user->organisation_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'webhook_url'    => ['nullable', 'url', 'max:500'],
            'webhook_events' => ['nullable', 'array'],
            'webhook_events.*' => ['string'],
            'pos_system'     => ['sometimes', 'string', 'max:100'],
        ]);

        $apiIntegration->update($data);

        return response()->json(['data' => $apiIntegration->fresh()]);
    }

    /**
     * POST /api/api-keys/{integration}/rotate-webhook-secret
     * Rotate the webhook signing secret. Returns the new secret ONCE.
     * Any in-flight webhooks using the old secret will fail verification — rotate at quiet time.
     */
    public function rotateWebhookSecret(Request $request, ApiIntegration $apiIntegration): JsonResponse
    {
        $user = $request->user();
        $store = Store::findOrFail($apiIntegration->store_id);
        if (! $user->isSuperAdmin() && $store->organisation_id !== $user->organisation_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $newSecret = $apiIntegration->rotateWebhookSecret();

        return response()->json([
            'message'        => 'Webhook secret rotated. Update your receiver immediately.',
            'webhook_secret' => $newSecret,
        ]);
    }

    /** DELETE /api/api-keys/{integration} — revoke (soft deactivate) */
    public function destroy(Request $request, ApiIntegration $apiIntegration): JsonResponse
    {
        $user = $request->user();
        $store = Store::findOrFail($apiIntegration->store_id);
        if (! $user->isSuperAdmin() && $store->organisation_id !== $user->organisation_id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $apiIntegration->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
