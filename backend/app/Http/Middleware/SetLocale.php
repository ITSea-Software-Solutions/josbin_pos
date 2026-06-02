<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SetLocale — pick the app locale per request so __('errors.…') calls in
 * controllers return text in the right language.
 *
 * Resolution order (first wins):
 *   1. Authenticated user's `locale` column ('nl' | 'en')
 *      — sticky per-user preference set in My Account
 *   2. Accept-Language header from the frontend axios interceptor
 *      — reflects the *current* i18n toggle even before the user has
 *        saved their preference, and before login
 *   3. Default 'nl' (Surinamese client primary language)
 *
 * Only 'nl' and 'en' are accepted. Anything else falls back to 'nl' —
 * adding a third locale later (Sranantongo etc.) means widening the
 * SUPPORTED list and shipping the matching lang/sr/ tree.
 */
class SetLocale
{
    private const SUPPORTED = ['nl', 'en'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $this->resolveLocale($request);
        app()->setLocale($locale);
        return $next($request);
    }

    private function resolveLocale(Request $request): string
    {
        // 1. Authenticated user's saved preference
        $user = $request->user();
        if ($user && in_array($user->locale, self::SUPPORTED, true)) {
            return $user->locale;
        }

        // 2. Accept-Language header from the frontend
        $header = $request->header('Accept-Language', '');
        // Strip region: "en-US,en;q=0.9" → "en"
        $primary = strtolower(strtok($header, ',-;'));
        if (in_array($primary, self::SUPPORTED, true)) {
            return $primary;
        }

        // 3. Default
        return 'nl';
    }
}
