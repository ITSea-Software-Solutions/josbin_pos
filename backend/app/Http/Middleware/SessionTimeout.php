<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
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

        // TransientToken (what actingAs() supplies, and what a session-guard
        // request carries) has no expires_at at all — reading it raised an
        // undefined-property error and turned a healthy request into a 500.
        // Only a real issued token can expire.
        if ($token instanceof PersonalAccessToken && $token->expires_at && $token->expires_at->isPast()) {
            $token->delete();

            return response()->json([
                'message' => 'Session expired. Please log in again.',
                'code'    => 'SESSION_EXPIRED',
            ], 401);
        }

        return $next($request);
    }
}
