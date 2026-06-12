<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * AST (America/Paramaribo, UTC-3) calendar-day boundaries as absolute instants.
 *
 * Report date filters used `whereDate('occurred_at', '>=', $from)` /
 * `whereDate(… '<=', $to)`. `whereDate` wraps the column in `DATE(col)`, so:
 *   1. Postgres cannot use the B-tree index on `occurred_at` — every report
 *      query becomes a full scan of the sales table (PERF-1).
 *   2. `DATE(timestamptz)` is evaluated in the SESSION timezone — correctness
 *      then hinges on the DB session being AST (the G-022 / G-023 footgun).
 *
 * These helpers return ISO-8601 instants WITH the -03:00 offset, so a
 * half-open range `occurred_at >= dayStart($from) AND occurred_at < dayAfter($to)`
 * is:
 *   - index-friendly (no function on the column), and
 *   - session-timezone-independent (the bound literal carries its own offset,
 *     so Postgres needs no session TZ to interpret it).
 *
 * The range is half-open on the top end on purpose: `< dayAfter($to)` includes
 * every instant of $to's AST day (up to 23:59:59.999) without the off-by-one a
 * `<= $to 00:00:00` bound would cause.
 */
final class AstDates
{
    public const TZ = 'America/Paramaribo';

    /** Inclusive lower bound — 00:00:00 AST of $date (e.g. 2026-06-01T00:00:00-03:00). */
    public static function dayStart(string $date): string
    {
        return Carbon::parse($date, self::TZ)->startOfDay()->toIso8601String();
    }

    /** EXCLUSIVE upper bound — 00:00:00 AST of the day AFTER $date. */
    public static function dayAfter(string $date): string
    {
        return Carbon::parse($date, self::TZ)->startOfDay()->addDay()->toIso8601String();
    }
}
