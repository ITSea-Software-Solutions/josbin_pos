<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureLicenseValid
 *
 * Applied to all authenticated API routes.
 * - hard_lock   → 402 License Required (login blocked, data export routes exempted)
 * - soft_lock   → 402 on sales creation only (reports/audits still accessible)
 * - grace/warning → 200 + X-License-Status header so frontend can show banners
 *
 * Routes exempted from hard_lock (data export remains accessible 90 days):
 * - GET /api/reports/*
 * - GET /api/sales/*
 * - POST /api/auth/logout
 */
class EnsureLicenseValid
{
    // Routes that remain accessible during hard lock for data export
    private const HARD_LOCK_EXEMPT_PATTERNS = [
        'api/reports',
        'api/sales/*/receipt',
        'api/auth/logout',
        'api/auth/me',
        'api/rates',
    ];

    // Routes blocked during soft lock (new sales creation)
    private const SOFT_LOCK_BLOCKED_PATTERNS = [
        'api/sales',        // POST /api/sales (create sale)
        'api/sales/hold',   // POST /api/sales/hold
    ];

    public function __construct(
        private readonly LicenseService $license,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Skip license check for unauthenticated requests (e.g. login endpoint)
        if (! $request->user()) {
            return $next($request);
        }

        $status = $this->license->getStatus();

        // Enforce the lock BEFORE the request runs — otherwise the controller
        // already executed (a sale committed, stock decremented) and the 402 is
        // cosmetic. The whole point of soft-lock is "no new sales", so it must
        // short-circuit ahead of $next, not after.
        if (in_array($status, ['hard_lock', 'invalid', 'not_found'], true)) {
            // Hard lock — block all except exempt data export routes
            if (! $this->matchesPatterns($request, self::HARD_LOCK_EXEMPT_PATTERNS)) {
                return response()->json([
                    'message'        => 'Licentie verlopen. Neem contact op met Josbin POS voor verlenging.',
                    'message_en'     => 'License expired. Contact Josbin POS to renew.',
                    'code'           => 'LICENSE_HARD_LOCK',
                    'license_status' => $status,
                ], 402);
            }
        } elseif ($status === 'soft_lock') {
            // Soft lock — only block new sales creation
            if ($request->isMethod('POST') && $this->matchesPatterns($request, self::SOFT_LOCK_BLOCKED_PATTERNS)) {
                return response()->json([
                    'message'        => 'Licentie verlopen. Nieuwe verkopen geblokkeerd. Neem contact op voor verlenging.',
                    'message_en'     => 'License expired. New sales blocked. Contact Josbin POS to renew.',
                    'code'           => 'LICENSE_SOFT_LOCK',
                    'license_status' => $status,
                ], 402);
            }
        }

        $response = $next($request);

        // Add status header to all passing responses so frontend can show banners
        if (method_exists($response, 'header')) {
            $response->header('X-License-Status', $status);
        }

        return $response;
    }

    private function matchesPatterns(Request $request, array $patterns): bool
    {
        foreach ($patterns as $pattern) {
            if ($request->is($pattern)) {
                return true;
            }
        }
        return false;
    }
}
