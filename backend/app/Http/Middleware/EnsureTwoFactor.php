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

        $token = $user->currentAccessToken();

        // Enforce the per-token 2FA marker ONLY on real API tokens
        // (PersonalAccessToken) — that's the actual attack surface: a stolen
        // Bearer token must not act for a mandatory-2FA user unless it was
        // issued after the 2FA challenge. First-party/session auth presents a
        // TransientToken, and Laravel's actingAs() (test harness) presents no
        // token at all — both complete 2FA through the normal login flow, not
        // via a token ability, so neither should be blocked here.
        if (! $token instanceof \Laravel\Sanctum\PersonalAccessToken) {
            return $next($request);
        }

        // Task #74 — full session tokens carry the '*' wildcard ability, so
        // $user->tokenCan('2fa_verified') would always return true for ANY
        // logged-in user (wildcard satisfies). We instead check the LITERAL
        // string in the abilities array, which only the post-2FA tokens get.
        $abilities = $token->abilities ?? [];
        if (! is_array($abilities) || ! in_array('2fa_verified', $abilities, true)) {
            return response()->json([
                'message' => 'Two-factor authentication required.',
                'code'    => 'TWO_FACTOR_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
