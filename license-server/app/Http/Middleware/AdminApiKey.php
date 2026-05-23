<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the /api/admin/* endpoints. The developer company's tooling must
 * present the shared secret as the  X-Admin-Key  header.
 */
class AdminApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected  = (string) config('josbin_license.admin_api_key');
        $presented = (string) $request->header('X-Admin-Key', '');

        if ($expected === '' || ! hash_equals($expected, $presented)) {
            return response()->json([
                'error'   => 'Unauthorized',
                'message' => 'A valid X-Admin-Key header is required.',
            ], 401);
        }

        return $next($request);
    }
}
