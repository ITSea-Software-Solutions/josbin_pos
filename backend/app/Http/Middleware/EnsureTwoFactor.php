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

        // Task #74 — full session tokens carry the '*' wildcard ability, so
        // $user->tokenCan('2fa_verified') would always return true for ANY
        // logged-in user (wildcard satisfies). We instead check the LITERAL
        // string in the abilities array, which only the post-2FA tokens get.
        $abilities = $user->currentAccessToken()?->abilities ?? [];
        if (! is_array($abilities) || ! in_array('2fa_verified', $abilities, true)) {
            return response()->json([
                'message' => 'Two-factor authentication required.',
                'code'    => 'TWO_FACTOR_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
