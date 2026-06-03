<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regression sentinel for the bug that wiped the demo DB on every test run.
 *
 * Symptom: cashier rings a sale → "Geen dagkoers beschikbaar." Investigation
 * shows the daily_rates row I'd just inserted is gone. Cause: tests connect
 * to whatever DB Laravel resolves via env(), and the docker container's
 * DB_DATABASE=josbin_pos_demo wins over phpunit.xml's <env> entries —
 * RefreshDatabase then wipes the demo DB between tests.
 *
 * The layered fix lives in:
 *   - tests/bootstrap.php          forces APP_ENV + DB_DATABASE BEFORE autoload
 *   - .env.testing                 ground truth for the test connection
 *   - phpunit.xml force="true"     belt-and-braces for direct phpunit runs
 *
 * This test fails LOUDLY (not silently) if any of those regress. Keep it
 * — losing demo data mid-client-review is the kind of bug that erodes
 * trust permanently.
 */
class TestDatabaseIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_tests_run_against_isolated_database_not_demo_or_live(): void
    {
        $connected = \DB::connection()->getDatabaseName();

        $this->assertSame('josbin_pos_test', $connected,
            "Tests must connect to josbin_pos_test (got '{$connected}'). "
            . 'See tests/bootstrap.php + .env.testing + phpunit.xml. '
            . 'If this fails, RefreshDatabase is about to wipe whatever DB '
            . 'is connected.');

        // Sanity-check the names a developer might confuse it with.
        $this->assertNotSame('josbin_pos',      $connected, 'Live DB!');
        $this->assertNotSame('josbin_pos_demo', $connected, 'Demo DB!');
    }
}
