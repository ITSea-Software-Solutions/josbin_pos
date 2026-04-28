<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Government accounts (is_government org) must present a valid TOTP code.
 * The "2FA verified" flag is stored as a short-lived token ability.
 */
class EnsureTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->requires2FA()) {
            return $next($request);
        }

        // Check if the current token carries the 2fa_verified ability
        if (! $user->tokenCan('2fa_verified')) {
            return response()->json([
                'message' => 'Two-factor authentication required.',
                'code'    => 'TWO_FACTOR_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
