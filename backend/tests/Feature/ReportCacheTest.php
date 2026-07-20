<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use App\Models\User;
use App\Support\ReportCache;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Server-side report caching (ReportCache) — PERF at 50-store scale.
 *
 * Pins the four properties that make the cache safe:
 *   1. A repeated identical request is served from cache (fewer queries,
 *      byte-identical payload, stale until TTL).
 *   2. Two organisations with byte-identical query strings NEVER share a
 *      cached payload (the org is part of the key).
 *   3. Store-scoped callers (SM/cashier) and org-wide callers (OA) and the
 *      platform-wide SA all get distinct cache keys.
 *   4. TTL policy: 60 s when the window touches today (AST), 15 min for
 *      fully-past windows — refunds are stamped occurred_at = now() so past
 *      windows only change via rare void / late-sync events.
 *
 * Uses REAL Sanctum tokens (createToken → withToken), never actingAs():
 * the session.timeout middleware breaks on TransientToken.
 */
class ReportCacheTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $orgA;
    private Organisation $orgB;
    private Store $storeA;
    private Store $storeB;
    private User $oaA;
    private User $oaB;
    private User $smA;
    private User $sa;

    /** Fixed fully-past window, entirely controlled by this test. */
    private const PAST_FROM = '2026-06-10';
    private const PAST_TO   = '2026-06-11';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        [$this->orgA, $this->storeA] = $this->makeOrgWithStore('Cache Org A');
        [$this->orgB, $this->storeB] = $this->makeOrgWithStore('Cache Org B');

        $this->oaA = $this->makeUser($this->orgA, User::ROLE_ORGANISATION_ADMIN, 'oa-a@cache.sr');
        $this->oaB = $this->makeUser($this->orgB, User::ROLE_ORGANISATION_ADMIN, 'oa-b@cache.sr');
        $this->smA = $this->makeUser($this->orgA, User::ROLE_STORE_MANAGER, 'sm-a@cache.sr', $this->storeA);
        $this->sa  = $this->makeUser($this->orgA, User::ROLE_SUPER_ADMIN, 'sa@cache.sr');

        DailyRate::firstOrCreate(['date' => today()->toDateString()], [
            'usd_to_srd' => '38.5000', 'raw_rate' => '37.5000', 'markup_pct' => '2.50',
            'source' => 'manual', 'locked_at' => now(),
        ]);

        // Past window: org A = SRD 100.00, org B = SRD 250.00.
        $this->makeSale($this->storeA, $this->oaA, '100.00', self::PAST_FROM . ' 10:00:00');
        $this->makeSale($this->storeB, $this->oaB, '250.00', self::PAST_FROM . ' 11:00:00');
    }

    // ─── Fixtures ─────────────────────────────────────────────────────────

    /** @return array{0: Organisation, 1: Store} */
    private function makeOrgWithStore(string $name): array
    {
        $org = Organisation::create([
            'name' => $name, 'type' => 'retail',
            'btw_number' => 'SR-' . uniqid(), 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $store = Store::create([
            'organisation_id' => $org->id, 'name' => $name . ' Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        return [$org, $store];
    }

    private function makeUser(Organisation $org, string $role, string $email, ?Store $store = null): User
    {
        $user = User::create([
            'name' => $email, 'email' => $email,
            'password' => bcrypt('pw'),
            'organisation_id' => $org->id,
            'store_id' => $store?->id,
            'role' => $role,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $user->assignRole($role);

        return $user;
    }

    private function makeSale(Store $store, User $cashier, string $total, Carbon|string $occurredAt): Sale
    {
        return Sale::create([
            'store_id'           => $store->id,
            'cashier_id'         => $cashier->id,
            'sale_number'        => 'CT-' . uniqid(),
            'subtotal_srd'       => $total,
            'discount_srd'       => '0.00',
            'btw_srd'            => '0.00',
            'total_srd'          => $total,
            'payment_method'     => 'cash',
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => $occurredAt instanceof Carbon
                ? $occurredAt
                : Carbon::parse($occurredAt, 'America/Paramaribo'),
        ]);
    }

    /** Real Sanctum token — never actingAs() (session.timeout breaks on TransientToken). */
    private function token(User $user, array $abilities = ['*']): string
    {
        return $user->createToken('t', $abilities)->plainTextToken;
    }

    /**
     * Send the next request authenticated as $user via a REAL bearer token.
     * Sanctum's RequestGuard caches the resolved user on the shared app
     * instance, so when one test method switches identities the second
     * request would silently run as the first user — reset the guards first.
     */
    private function asUser(User $user, array $abilities = ['*']): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($this->token($user, $abilities));
    }

    private function pastCustomUrl(Store $store): string
    {
        return "/api/reports/custom?store_id={$store->id}"
            . '&date_from=' . self::PAST_FROM . '&date_to=' . self::PAST_TO;
    }

    // ─── 1. Second identical request served from cache ────────────────────

    public function test_second_identical_request_is_served_from_cache(): void
    {
        $token = $this->token($this->oaA);
        $url   = $this->pastCustomUrl($this->storeA);

        DB::enableQueryLog();
        $first = $this->withToken($token)->getJson($url)->assertOk()->json();
        $queriesFirst = count(DB::getQueryLog());

        DB::flushQueryLog();
        $second = $this->withToken($token)->getJson($url)->assertOk()->json();
        $queriesSecond = count(DB::getQueryLog());
        DB::disableQueryLog();

        // Byte-identical payload, and the aggregation queries did not run
        // again (only per-request auth/middleware queries remain).
        $this->assertSame($first, $second);
        $this->assertLessThan($queriesFirst, $queriesSecond);

        // Stale-read proof: a new sale inside the window is invisible while
        // the entry lives — the payload is genuinely served from cache.
        $this->makeSale($this->storeA, $this->oaA, '40.00', self::PAST_FROM . ' 12:00:00');
        $third = $this->withToken($token)->getJson($url)->assertOk()->json();
        $this->assertSame($first, $third);
        $this->assertSame('100.00', $third['data']['total_sales_srd']);
    }

    // ─── 2. No cross-organisation bleed ───────────────────────────────────

    public function test_two_orgs_with_identical_query_strings_never_share_a_cached_payload(): void
    {
        // No store_id/org_id params → the query string is byte-identical for
        // both orgs. Org A primes the cache; if the key ignored the caller's
        // org, org B would be served org A's SRD 100.00 payload.
        $url = '/api/dashboard/reports/consolidated'
            . '?date_from=' . self::PAST_FROM . '&date_to=' . self::PAST_TO;

        $a = $this->asUser($this->oaA)->getJson($url)->assertOk()->json();
        $b = $this->asUser($this->oaB)->getJson($url)->assertOk()->json();

        $this->assertSame('100.00', $a['total_sales']);
        $this->assertSame('250.00', $b['total_sales']);

        // And the keys themselves differ for identical endpoint + params.
        $params = ['from' => self::PAST_FROM, 'to' => self::PAST_TO, 'org_id' => 'all', 'store_id' => 'all'];
        $this->assertNotSame(
            ReportCache::key($this->oaA, 'dashboard.consolidated', $params),
            ReportCache::key($this->oaB, 'dashboard.consolidated', $params),
        );
    }

    // ─── 3. Store-scoped vs org-wide vs platform callers ──────────────────

    public function test_store_scoped_org_wide_and_platform_callers_use_distinct_cache_keys(): void
    {
        $params = ['store_id' => $this->storeA->id, 'from' => self::PAST_FROM, 'to' => self::PAST_TO];

        $smKey = ReportCache::key($this->smA, 'reports.custom', $params);
        $oaKey = ReportCache::key($this->oaA, 'reports.custom', $params);
        $saKey = ReportCache::key($this->sa,  'reports.custom', $params);

        $this->assertNotSame($smKey, $oaKey);
        $this->assertNotSame($oaKey, $saKey);
        $this->assertNotSame($smKey, $saKey);

        $this->assertStringContainsString("org:{$this->orgA->id}:store:{$this->storeA->id}", $smKey);
        $this->assertStringContainsString("org:{$this->orgA->id}", $oaKey);
        $this->assertStringNotContainsString(':store:', $oaKey);
        $this->assertStringContainsString(':platform:', $saKey);
    }

    public function test_platform_wide_payload_is_never_served_to_an_org_admin(): void
    {
        $url = '/api/dashboard/reports/consolidated'
            . '?date_from=' . self::PAST_FROM . '&date_to=' . self::PAST_TO;

        // SA (platform scope: org A 100 + org B 250 = 350) primes the cache
        // with the exact query string the OA sends next. SA tokens carry the
        // 2fa_verified ability to clear the mandatory-2FA gate.
        $saJson = $this->asUser($this->sa, ['*', '2fa_verified'])
            ->getJson($url)->assertOk()->json();
        $oaJson = $this->asUser($this->oaA)
            ->getJson($url)->assertOk()->json();

        $this->assertSame('350.00', $saJson['total_sales']);
        $this->assertSame('100.00', $oaJson['total_sales']);
    }

    // ─── 4. TTL policy ────────────────────────────────────────────────────

    public function test_ttl_is_60s_for_windows_touching_today_and_15min_for_past_windows(): void
    {
        $todayAst = Carbon::now('America/Paramaribo')->toDateString();

        $this->assertSame(ReportCache::TTL_PAST_SECONDS, ReportCache::ttl('2026-01-31'));
        $this->assertSame(ReportCache::TTL_LIVE_SECONDS, ReportCache::ttl($todayAst));
        $this->assertSame(
            ReportCache::TTL_LIVE_SECONDS,
            ReportCache::ttl(Carbon::now('America/Paramaribo')->addDay()->toDateString()),
            'A window extending past today can still receive sales → live TTL.',
        );
    }

    public function test_today_range_expires_after_60_seconds(): void
    {
        $token    = $this->token($this->oaA);
        $todayAst = Carbon::now('America/Paramaribo')->toDateString();
        $url      = "/api/reports/custom?store_id={$this->storeA->id}"
            . "&date_from={$todayAst}&date_to={$todayAst}";

        $before = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame(0, $before['transaction_count']);

        $this->makeSale($this->storeA, $this->oaA, '55.00', now());

        // Still inside the 60 s TTL → cached zero.
        $cached = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame($before, $cached);

        // 61 s later the live TTL has lapsed → fresh aggregation.
        $this->travel(61)->seconds();
        $after = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame(1, $after['transaction_count']);
        $this->assertSame('55.00', $after['total_sales_srd']);
    }

    public function test_past_range_survives_60_seconds_and_expires_after_15_minutes(): void
    {
        $token = $this->token($this->oaA);
        $url   = $this->pastCustomUrl($this->storeA);

        $first = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame('100.00', $first['total_sales_srd']);

        // A late-sync/void-style change lands in the past window…
        $this->makeSale($this->storeA, $this->oaA, '40.00', self::PAST_FROM . ' 12:00:00');

        // …and is still invisible 2 minutes later: the past window uses the
        // 15-minute TTL, not the 60-second live TTL.
        $this->travel(2)->minutes();
        $stillCached = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame('100.00', $stillCached['total_sales_srd']);

        // After the 15-minute TTL the entry lapses and the window refreshes.
        $this->travel(14)->minutes();
        $refreshed = $this->withToken($token)->getJson($url)->assertOk()->json('data');
        $this->assertSame('140.00', $refreshed['total_sales_srd']);
        $this->assertSame(2, $refreshed['transaction_count']);
    }
}
