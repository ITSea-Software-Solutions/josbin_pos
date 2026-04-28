<?php

namespace App\Http\Middleware;

use App\Models\Store;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * TrackStoreActivity
 *
 * Updates store.last_activity_at on every authenticated API request that
 * includes a store_id (either in body, query, or a route store binding).
 * Uses a Redis-throttled write — at most once per 60 seconds per store —
 * to avoid excessive DB writes on every sale/product request.
 *
 * This powers the online/offline indicator on the Super Admin Dashboard.
 */
class TrackStoreActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Only track after successful auth
        if (! $request->user()) {
            return $response;
        }

        $storeId = $request->input('store_id')
            ?? $request->route('store')?->id
            ?? null;

        if ($storeId) {
            $cacheKey = "store_activity:{$storeId}";
            if (! Cache::has($cacheKey)) {
                Cache::put($cacheKey, 1, 60); // throttle: write at most once/minute
                Store::where('id', $storeId)->update(['last_activity_at' => now()]);
            }
        }

        return $response;
    }
}
