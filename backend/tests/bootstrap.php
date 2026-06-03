<?php

/**
 * Test bootstrap — runs BEFORE the autoloader, so by the time Laravel's
 * LoadEnvironmentVariables fires we've already pinned APP_ENV=testing.
 * That triggers Laravel to load .env.testing (which points at the
 * josbin_pos_test database) instead of the container's .env (which
 * points at the demo database).
 *
 * Without this file the test suite connected to and wiped josbin_pos_demo
 * via RefreshDatabase, destroying seeded org / user / daily-rate data
 * every time anyone ran `php artisan test`. The fix is layered:
 *   1. Override $_ENV / $_SERVER / putenv() here, BEFORE autoload
 *   2. Laravel loads .env.testing because APP_ENV=testing
 *   3. .env.testing has DB_DATABASE=josbin_pos_test
 *   4. phpunit.xml's <env force="true"> is a belt-and-braces redundancy
 *      for anyone who runs `vendor/bin/phpunit` directly
 *
 * Verified by `tests/Feature/CheckDbTest` (kept as a permanent
 * regression sentinel — fails if the wrong DB is ever connected).
 */

// Pin the env variables every Laravel bootstrap consults, in every order.
$override = [
    'APP_ENV'      => 'testing',
    'DB_DATABASE'  => 'josbin_pos_test',
];

foreach ($override as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key]    = $value;
    $_SERVER[$key] = $value;
}

require __DIR__ . '/../vendor/autoload.php';
