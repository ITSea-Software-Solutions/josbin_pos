<?php

namespace Tests\Feature;

use App\Http\Middleware\SetLocale;
use App\Models\Organisation;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * SetLocale middleware + lang/{nl,en}/errors.php translations.
 *
 * Resolution order locked in:
 *   1. Authenticated user's `locale` column (sticky preference)
 *   2. Accept-Language request header (UI toggle)
 *   3. Default 'nl'
 *
 * Also verifies the same __('errors.no_daily_rate', […]) call returns
 * different strings depending on locale, so callers can be locale-agnostic.
 */
class LocaleAwareErrorsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_translation_returns_dutch_when_locale_is_nl(): void
    {
        app()->setLocale('nl');
        $msg = __('errors.no_daily_rate', ['vendor' => 'Josbin', 'email' => 'x@x.sr']);
        $this->assertStringContainsString('Geen dagkoers', $msg);
        $this->assertStringContainsString('Vraag de Org Admin', $msg);
        $this->assertStringContainsString('Josbin', $msg);
        $this->assertStringContainsString('x@x.sr', $msg);
    }

    public function test_translation_returns_english_when_locale_is_en(): void
    {
        app()->setLocale('en');
        $msg = __('errors.no_daily_rate', ['vendor' => 'Josbin', 'email' => 'x@x.sr']);
        $this->assertStringContainsString('No exchange rate', $msg);
        $this->assertStringContainsString('Ask your Org Admin', $msg);
        $this->assertStringContainsString('Josbin', $msg);
    }

    public function test_middleware_picks_user_locale_over_header(): void
    {
        $org = Organisation::create([
            'name' => 'L', 'type' => 'retail', 'btw_number' => 'X',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $user = User::create([
            'name' => 'U', 'email' => 'u@l.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'en', 'is_active' => true,
        ]);

        $request = Request::create('/api/whatever');
        $request->headers->set('Accept-Language', 'nl');
        $request->setUserResolver(fn () => $user);

        (new SetLocale)->handle($request, fn () => response('ok'));

        $this->assertEquals('en', app()->getLocale(),
            "User's saved locale (en) must override Accept-Language (nl).");
    }

    public function test_middleware_falls_back_to_accept_language_when_no_user(): void
    {
        $request = Request::create('/api/whatever');
        $request->headers->set('Accept-Language', 'en-US,en;q=0.9');

        (new SetLocale)->handle($request, fn () => response('ok'));

        $this->assertEquals('en', app()->getLocale(),
            'Region suffix must be stripped — en-US should resolve to en.');
    }

    public function test_middleware_defaults_to_nl_when_unknown(): void
    {
        $request = Request::create('/api/whatever');
        $request->headers->set('Accept-Language', 'sranantongo,fr;q=0.5');

        (new SetLocale)->handle($request, fn () => response('ok'));

        $this->assertEquals('nl', app()->getLocale(),
            'Unsupported locales must fall back to nl.');
    }

    public function test_middleware_defaults_to_nl_when_header_missing(): void
    {
        // Symfony Request::create() auto-injects "en-us,en;q=0.5" so we have
        // to explicitly REMOVE the header to test the missing case.
        $request = Request::create('/api/whatever');
        $request->headers->remove('Accept-Language');

        (new SetLocale)->handle($request, fn () => response('ok'));

        $this->assertEquals('nl', app()->getLocale());
    }
}
