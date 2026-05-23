<?php

namespace App\Http\Middleware;

use App\Models\ApiIntegration;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ValidateApiKey
 *
 * Authenticates Layer 3 (Open Integration API) requests.
 * Clients send: X-API-Key: <raw key>
 * We hash it and compare against api_integrations.api_key_hash (SHA-256).
 *
 * Attaches the resolved ApiIntegration to the request as 'api_integration'
 * so downstream controllers can scope queries to the correct store/org.
 */
class ValidateApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $rawKey = $request->header('X-API-Key');

        if (! $rawKey) {
            return response()->json([
                'error'   => 'Unauthorized',
                'message' => 'X-API-Key header is required.',
            ], 401);
        }

        $hash = hash('sha256', $rawKey);
        $integration = ApiIntegration::with('store.organisation')
            ->where('api_key_hash', $hash)
            ->where('is_active', true)
            ->first();

        if (! $integration) {
            return response()->json([
                'error'   => 'Unauthorized',
                'message' => 'Invalid or inactive API key.',
            ], 401);
        }

        // Rate limit: 1,000 calls/min per API key
        $limiterKey = 'api_key_ratelimit:' . $integration->id;
        $current = cache()->increment($limiterKey);
        if ($current === 1) {
            cache()->put($limiterKey, 1, 60);
        }
        if ($current > 1000) {
            return response()->json([
                'error'   => 'TooManyRequests',
                'message' => 'Rate limit exceeded: 1,000 requests per minute.',
            ], 429);
        }

        // Update last ping
        $integration->update(['last_ping_at' => now()]);

        $request->attributes->set('api_integration', $integration);

        $response = $next($request);

        // Mark sandbox responses so integrators can confirm they are not
        // hitting production. See config('josbin_pos.sandbox').
        if (config('josbin_pos.sandbox') && method_exists($response, 'header')) {
            $response->header('X-Josbin-Environment', 'sandbox');
        }

        return $response;
    }
}
