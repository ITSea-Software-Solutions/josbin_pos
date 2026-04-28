<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates the request via a ?token= query parameter.
 *
 * Used only on endpoints that must be opened directly in a browser tab
 * (e.g. PDF receipt), where an Authorization header cannot be sent.
 *
 * Looks up the Sanctum PersonalAccessToken directly and logs the user in
 * for the duration of this request, bypassing the need for the header.
 */
class AuthenticateViaQueryToken
{
    public function handle(Request $request, Closure $next): Response
    {
        // Only act when no Bearer header is present (don't override normal auth)
        // Resolve token from ?token= query param OR Authorization: Bearer header
        $rawToken = $request->query('token') ?? $request->bearerToken();

        if ($rawToken) {
            $tokenModel = PersonalAccessToken::findToken($rawToken);

            if ($tokenModel && $tokenModel->tokenable) {
                $user = $tokenModel->tokenable;

                // Set user on the default guard and sanctum guard so that
                // $request->user(), Gate, and authorize() all resolve correctly.
                Auth::setUser($user);
                Auth::guard('sanctum')->setUser($user);
                $request->setUserResolver(fn () => $user);

                // Update last_used_at (mirrors Sanctum's own behaviour)
                $tokenModel->forceFill(['last_used_at' => now()])->save();
            }
        }

        return $next($request);
    }
}
