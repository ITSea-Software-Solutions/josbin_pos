<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organisation;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrganisationController extends Controller
{
    /** GET /api/organisations */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            $orgs = Organisation::query()
                ->withCount(['stores', 'users'])
                ->orderBy('name')
                ->paginate($request->integer('per_page', 25));
        } else {
            $orgs = Organisation::where('id', $user->organisation_id)
                ->withCount(['stores', 'users'])
                ->get();
            return response()->json(['data' => $orgs]);
        }

        return response()->json($orgs);
    }

    /** POST /api/organisations — super admin only */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Organisation::class);

        $data = $request->validate([
            'name'              => ['required', 'string', 'max:200'],
            'type'              => ['required', Rule::in(['retail', 'govt', 'wholesale'])],
            'btw_number'        => ['nullable', 'string', 'max:50'],
            'locale'            => ['required', Rule::in(['nl', 'en'])],
            'is_government'     => ['sometimes', 'boolean'],
            'subscription_tier' => ['required', Rule::in(['starter', 'professional', 'enterprise'])],
        ]);

        $org = Organisation::create([
            ...$data,
            'currency'  => 'SRD',
            'is_active' => true,
        ]);

        return response()->json(['data' => $org->loadCount(['stores', 'users'])], 201);
    }

    /** GET /api/organisations/{organisation} */
    public function show(Request $request, Organisation $organisation): JsonResponse
    {
        $this->authorize('view', $organisation);

        return response()->json([
            'data' => $organisation
                ->loadCount(['stores', 'users'])
                ->load('stores:id,organisation_id,name,city,is_active,last_activity_at'),
        ]);
    }

    /** PUT /api/organisations/{organisation} */
    public function update(Request $request, Organisation $organisation): JsonResponse
    {
        $this->authorize('update', $organisation);

        $data = $request->validate([
            'name'              => ['sometimes', 'string', 'max:200'],
            'type'              => ['sometimes', Rule::in(['retail', 'govt', 'wholesale'])],
            'btw_number'        => ['nullable', 'string', 'max:50'],
            'locale'            => ['sometimes', Rule::in(['nl', 'en'])],
            'is_government'     => ['sometimes', 'boolean'],
            'subscription_tier' => ['sometimes', Rule::in(['starter', 'professional', 'enterprise'])],
            'is_active'         => ['sometimes', 'boolean'],
        ]);

        $organisation->update($data);

        return response()->json(['data' => $organisation->fresh()->loadCount(['stores', 'users'])]);
    }

    /** DELETE /api/organisations/{organisation} — super admin only, soft delete */
    public function destroy(Request $request, Organisation $organisation): JsonResponse
    {
        $this->authorize('delete', $organisation);

        // Deactivate all stores first
        $organisation->stores()->update(['is_active' => false]);
        $organisation->update(['is_active' => false]);
        $organisation->delete();

        return response()->json(null, 204);
    }

    // ── Nested store routes ───────────────────────────────────────────────────

    /** GET /api/organisations/{organisation}/stores */
    public function stores(Request $request, Organisation $organisation): JsonResponse
    {
        $this->authorize('view', $organisation);

        $stores = $organisation->stores()
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $stores]);
    }

    /** POST /api/organisations/{organisation}/stores */
    public function storeCreate(Request $request, Organisation $organisation): JsonResponse
    {
        $this->authorize('update', $organisation);

        $data = $request->validate([
            'name'              => ['required', 'string', 'max:200'],
            'address'           => ['nullable', 'string', 'max:500'],
            'city'              => ['nullable', 'string', 'max:100'],
            'default_btw_rate'  => ['required', 'numeric', 'min:0', 'max:100'],
            'receipt_header'    => ['nullable', 'string', 'max:500'],
            'receipt_footer'    => ['nullable', 'string', 'max:500'],
            'receipt_logo_path' => ['nullable', 'string', 'max:500'],
            'pos_type'          => ['required', Rule::in(['native', 'external'])],
        ]);

        $store = $organisation->stores()->create([
            ...$data,
            'is_active' => true,
        ]);

        return response()->json(['data' => $store], 201);
    }
}
