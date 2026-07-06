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

        // Cashier + Store Manager are strictly tied to a single store. No
        // multi-store assignment, no "all stores in org" fallback — a user
        // without store_id (data error) sees nothing rather than the whole
        // org. Org Admin / Auditor / API see the full org.
        if (! $user->isSuperAdmin() && ! $user->isOrgScopedRole()) {
            $query->where('id', $user->store_id ?? '00000000-0000-0000-0000-000000000000');
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

        // A Store Manager edits operational settings of their own store, but
        // tax (default_btw_rate) and structural flags stay Org-Admin-controlled
        // — same principle as BTW rate being OA-only on products.
        if ($request->user()->isStoreBound()) {
            unset($data['default_btw_rate'], $data['is_active'], $data['pos_type']);
        }

        $store->update($data);

        return response()->json(['data' => $store->fresh()]);
    }

    /** POST /api/stores/{store}/logo — upload receipt logo image */
    public function uploadLogo(Request $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $request->validate([
            // SVG deliberately excluded: it can carry inline <script> /
            // <foreignObject> payloads and is served same-origin from
            // /storage → stored XSS. Raster formats only.
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
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

    /**
     * POST /api/stores/{store}/wallet-qr
     *
     * Upload the store's merchant QR for a wallet provider (Mopé / Uni5Pay+).
     * These are the STATIC QR codes the wallet provider issues to the shop
     * (sticker / PDF); the POS shows them full-screen during a QR payment so
     * the customer can scan from the screen instead of hunting for the
     * sticker. Static QRs carry no amount — the customer types the amount in
     * the wallet app, which is why the POS renders the total next to it.
     */
    public function uploadWalletQr(Request $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $request->validate([
            'provider' => ['required', \Illuminate\Validation\Rule::in(array_keys(self::WALLET_SLUGS))],
            // Same raster-only rule as uploadLogo — SVG can carry scripts and
            // /storage is served same-origin (stored XSS).
            'image'    => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $provider = $request->input('provider');
        $slug     = self::WALLET_SLUGS[$provider];

        $settings = $store->settings ?? [];
        $old      = $settings['wallet_qrs'][$provider] ?? null;
        if ($old && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }

        $ext  = $request->file('image')->getClientOriginalExtension() ?: 'png';
        $path = $request->file('image')->storeAs("wallet-qrs/{$store->id}", "{$slug}.{$ext}", 'public');

        $settings['wallet_qrs'][$provider] = $path;
        $store->update(['settings' => $settings]);

        return response()->json(['data' => [
            'provider'      => $provider,
            'wallet_qr_path'=> $path,
            'wallet_qr_url' => Storage::disk('public')->url($path),
        ]]);
    }

    /** DELETE /api/stores/{store}/wallet-qr?provider=… — remove a wallet QR. */
    public function deleteWalletQr(Request $request, Store $store): JsonResponse
    {
        $this->authorize('update', $store);

        $request->validate([
            'provider' => ['required', \Illuminate\Validation\Rule::in(array_keys(self::WALLET_SLUGS))],
        ]);

        $provider = $request->input('provider');
        $settings = $store->settings ?? [];
        $old      = $settings['wallet_qrs'][$provider] ?? null;
        if ($old && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }
        unset($settings['wallet_qrs'][$provider]);
        $store->update(['settings' => $settings]);

        return response()->json(['data' => ['provider' => $provider, 'wallet_qr_path' => null]]);
    }

    /** Wallet providers the POS offers → filesystem slug. Keep in sync with
     *  frontend WALLETS in PaymentModal.tsx ("Other" has no stored QR). */
    private const WALLET_SLUGS = ['Mopé' => 'mope', 'Uni5Pay+' => 'uni5pay'];

    /** DELETE /api/stores/{store} — soft delete / deactivate, super admin only */
    public function destroy(Request $request, Store $store): JsonResponse
    {
        $this->authorize('delete', $store);

        $store->update(['is_active' => false]);
        $store->delete();

        return response()->json(null, 204);
    }
}
