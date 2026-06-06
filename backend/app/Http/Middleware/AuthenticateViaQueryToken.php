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
        // Resolve token from ?token= query param OR Authorization: Bearer header.
        $queryToken = $request->query('token');
        $rawToken   = $queryToken ?? $request->bearerToken();

        if ($rawToken) {
            $tokenModel = PersonalAccessToken::findToken($rawToken);

            if ($tokenModel && $tokenModel->tokenable) {
                // SECURITY (P0-5): a token in the URL query string leaks into
                // webserver access logs, browser history, and Referer headers.
                // Refuse BROAD/session tokens there — only a narrow,
                // single-resource `receipt:{id}` token may travel in a URL.
                // Bearer-header tokens are unaffected (they don't leak into URLs),
                // so the in-app PDF view (Authorization header) keeps working
                // with the normal session token.
                if ($queryToken !== null) {
                    $abilities = is_array($tokenModel->abilities) ? $tokenModel->abilities : [];
                    $isReceiptScoped = (bool) array_filter(
                        $abilities,
                        fn ($a) => is_string($a) && str_starts_with($a, 'receipt:'),
                    );
                    if (in_array('*', $abilities, true) || ! $isReceiptScoped) {
                        // Do NOT authenticate. The request falls through
                        // unauthenticated; the controller's authorize('view')
                        // then rejects with 403. The leaked broad token is inert.
                        return $next($request);
                    }
                }

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
