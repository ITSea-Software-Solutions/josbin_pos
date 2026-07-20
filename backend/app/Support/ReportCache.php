<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Server-side cache for the heavy read-only report / dashboard aggregates
 * (PERF — keeps the Super Admin Dashboard snappy at 50-store scale).
 *
 * ONLY GET endpoints that aggregate sales data go through this helper.
 * Mutations (Z-Report close/submit, sale create/void/refund) and cheap
 * indexed lookups (z-report history, paginated listings) are never cached.
 *
 * ── Key recipe ───────────────────────────────────────────────────────────────
 *   report:{endpoint}:{visibility-scope}:{sha1(sorted params)}
 *
 * The visibility scope is derived from the CALLER, not the request:
 *   - super_admin                    → "platform"
 *   - org-scoped roles (OA/auditor/…)→ "org:{organisation_id}"
 *   - store-bound roles (SM/cashier) → "org:{organisation_id}:store:{store_id}"
 *
 * That makes cross-tenant bleed structurally impossible: two organisations —
 * or a store-scoped manager vs an org-wide admin — can never share a cache
 * entry even when their query strings are byte-identical. Params are ksort()ed
 * before hashing so ?a=1&b=2 and ?b=2&a=1 share one entry.
 *
 * Locale is deliberately NOT part of the key: every cached payload is pure
 * data (numbers, ISO dates, enum keys, product-name snapshots) — verified
 * against ReportController + DashboardController. The only locale-dependent
 * report outputs are the PDF exports, which are not cached.
 *
 * ── TTL policy ───────────────────────────────────────────────────────────────
 *   - Window touching TODAY (AST) or the future → 60 s  (live tiles stay fresh)
 *   - Fully-past window (date_to < today AST)   → 15 min
 *
 * Past windows are *almost* immutable: refunds and blind returns create NEW
 * negative sales stamped occurred_at = now() (SaleController), so they land in
 * today's window, never in a past one. Two rare events CAN still rewrite a
 * past day — voiding an old completed sale (status flips in place, no date
 * restriction) and Layer-5 offline catch-up sync (client-supplied
 * occurred_at). Both self-correct within the 15-minute TTL, which is accepted
 * staleness for a report screen; the Z-Report close path reads live data and
 * is unaffected.
 *
 * "Today" is evaluated in AST (America/Paramaribo) — report windows roll at
 * AST midnight, not UTC midnight.
 */
final class ReportCache
{
    /** TTL when the requested window includes today (AST) or later. */
    public const TTL_LIVE_SECONDS = 60;

    /** TTL when the requested window ended before today (AST). */
    public const TTL_PAST_SECONDS = 900;

    /**
     * Cache the result of $build under a caller-scoped key.
     *
     * @param User    $user    the authenticated caller (scopes the key)
     * @param string  $endpoint stable endpoint name, e.g. "reports.daily"
     * @param array   $params  every query param that changes the result
     * @param string  $dateTo  inclusive end of the requested window (Y-m-d)
     * @param Closure $build   builds the payload on cache miss
     */
    public static function remember(User $user, string $endpoint, array $params, string $dateTo, Closure $build): mixed
    {
        return Cache::remember(
            self::key($user, $endpoint, $params),
            self::ttl($dateTo),
            $build,
        );
    }

    /** Deterministic, caller-scoped cache key. */
    public static function key(User $user, string $endpoint, array $params): string
    {
        ksort($params);

        return implode(':', [
            'report',
            $endpoint,
            self::visibilityScope($user),
            sha1(json_encode($params)),
        ]);
    }

    /**
     * The caller's data-visibility scope — the security-critical key segment.
     * Distinct scopes always produce distinct keys, even where today's
     * controllers would serve identical payloads; a duplicate cache entry is
     * harmless, a shared one across scopes is a data leak.
     */
    public static function visibilityScope(User $user): string
    {
        if ($user->isSuperAdmin()) {
            return 'platform';
        }

        $scope = 'org:' . $user->organisation_id;

        if ($user->isStoreBound()) {
            $scope .= ':store:' . ($user->store_id ?? 'unassigned');
        }

        return $scope;
    }

    /** 60 s while the window can still receive sales; 15 min once fully past. */
    public static function ttl(string $dateTo): int
    {
        $todayAst = Carbon::now(AstDates::TZ)->toDateString();

        // Y-m-d strings compare correctly lexicographically.
        return $dateTo < $todayAst ? self::TTL_PAST_SECONDS : self::TTL_LIVE_SECONDS;
    }
}
