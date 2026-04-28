<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Revoke Sanctum tokens that have passed their expiry.
 * Laravel's built-in expiration handles this, but this middleware provides
 * an early 401 with a machine-readable code for the POS to act on.
 */
class SessionTimeout
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token && $token->expires_at && $token->expires_at->isPast()) {
            $token->delete();

            return response()->json([
                'message' => 'Session expired. Please log in again.',
                'code'    => 'SESSION_EXPIRED',
            ], 401);
        }

        return $next($request);
    }
}
