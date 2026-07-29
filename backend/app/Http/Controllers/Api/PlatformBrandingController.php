<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Platform-wide receipt branding — Super Admin only.
 *
 * The image set here is stamped at the foot of printed receipts for EVERY
 * store that has not uploaded one of its own. It lives in `app_settings` (an
 * audited key/value table) rather than in config, so it can be changed from
 * the dashboard without a redeploy and every change leaves an audit row
 * naming who made it.
 *
 * Resolution order at print time (see ReceiptStampService):
 *   1. the store's own upload
 *   2. this platform default
 *   3. the file shipped with the backend, if any
 * Nothing at any level means nothing is printed.
 *
 * A note on WHAT belongs here. This is the vendor's or the shop's own mark.
 * It must not be used to imply that a third party has approved, certified or
 * verified a sale. A government or tax-authority emblem in particular asserts
 * an endorsement that does not exist unless the authority has actually granted
 * it — that misleads the customer holding the receipt, and it is a trademark
 * exposure for the operator and for every shop running the till. If such an
 * arrangement is ever granted in writing, this is the right place to configure
 * it; the constraint is on the claim, not on the mechanism.
 */
class PlatformBrandingController extends Controller
{
    public const STAMP_KEY = 'receipt_footer_stamp_path';

    private function authoriseSuperAdmin(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, __('Super Admin only.'));
    }

    /** GET /api/settings/receipt-stamp */
    public function show(Request $request): JsonResponse
    {
        $this->authoriseSuperAdmin($request);

        $path = AppSetting::get(self::STAMP_KEY);

        return response()->json(['data' => [
            'path' => $path,
            'url'  => $path ? Storage::disk('public')->url($path) : null,
        ]]);
    }

    /** POST /api/settings/receipt-stamp */
    public function update(Request $request): JsonResponse
    {
        $this->authoriseSuperAdmin($request);

        $request->validate([
            // SVG excluded for the same reason as store logos: inline <script>
            // served same-origin from /storage is stored XSS.
            'stamp' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        // Refuse an image this server cannot actually decode, HERE, while the
        // person who chose it is still looking at the screen.
        //
        // Laravel's `image` rule uses getimagesize(), which reads a header and
        // needs no GD support for the format. So a JPEG uploaded to a build
        // whose GD lacks JPEG passed validation, stored happily, and then
        // produced nothing on paper — with no error anywhere, on any screen.
        // The upload said "Uploaded ✓" and the receipt came out blank, which
        // is the worst way for software to fail.
        $probe = @imagecreatefromstring((string) file_get_contents($request->file('stamp')->getRealPath()));
        if ($probe === false) {
            return response()->json([
                'message' => __('errors.image_not_decodable'),
                'code'    => 'IMAGE_NOT_DECODABLE',
            ], 422);
        }
        imagedestroy($probe);

        $old = AppSetting::get(self::STAMP_KEY);

        $path = $request->file('stamp')->store('branding', 'public');
        AppSetting::set(self::STAMP_KEY, $path);

        // Every till caches its rasterised stamp for a day; drop the cache so a
        // change here reaches the shop floor on the next receipt rather than
        // tomorrow.
        Cache::flush();

        if ($old && $old !== $path && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }

        return response()->json(['data' => [
            'path' => $path,
            'url'  => Storage::disk('public')->url($path),
        ]]);
    }

    /** DELETE /api/settings/receipt-stamp */
    public function destroy(Request $request): JsonResponse
    {
        $this->authoriseSuperAdmin($request);

        $old = AppSetting::get(self::STAMP_KEY);
        if ($old && Storage::disk('public')->exists($old)) {
            Storage::disk('public')->delete($old);
        }
        AppSetting::set(self::STAMP_KEY, null);
        Cache::flush();

        return response()->json(['data' => ['path' => null, 'url' => null]]);
    }
}
