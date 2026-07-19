<?php

use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Josbin POS Scheduled Commands
| All times are in AST (America/Paramaribo, UTC-3) — see config/app.php
|--------------------------------------------------------------------------
*/

// Lock daily USD→SRD rate at 06:00 AST every day
// ExchangeRate-API is the ONLY source — Frankfurter/ECB does NOT support SRD
Schedule::command('rates:lock')
    ->dailyAt('06:00')
    ->timezone('America/Paramaribo')
    ->runInBackground()
    ->withoutOverlapping()
    ->onFailure(fn () => \Illuminate\Support\Facades\Log::error('rates:lock scheduled job failed'));

// Safety net — every 30 min, make sure today's rate exists. Idempotent no-op
// when the morning rates:lock already succeeded. Saves the demo / pilot
// installs where rates:lock at 06:00 missed (container restart, API outage)
// — cashier hits "Voltooien" and a sale would otherwise 422 NO_DAILY_RATE.
// Morning-recovery batch: nudge managers past the store's closing time, and
// (opt-in per store) seal forgotten sessions overnight so the next morning
// starts unblocked. Both are per-store-time aware; app TZ = AST.
Schedule::command('registers:closing-reminder')->everyFifteenMinutes();
Schedule::command('registers:auto-close')->everyFifteenMinutes();

Schedule::command('rates:ensure-today')
    ->everyThirtyMinutes()
    ->timezone('America/Paramaribo')
    ->runInBackground()
    ->withoutOverlapping();

// Prune expired Sanctum tokens daily at 03:00 AST
Schedule::command('sanctum:prune-expired --hours=24')
    ->dailyAt('03:00')
    ->timezone('America/Paramaribo');

// Validate license with Josbin POS license server daily at 00:05 AST
Schedule::command('license:check --force')
    ->dailyAt('00:05')
    ->timezone('America/Paramaribo')
    ->runInBackground()
    ->withoutOverlapping()
    ->onFailure(fn () => \Illuminate\Support\Facades\Log::warning('license:check scheduled job failed — offline grace period active'));

// Weekly AI sales summary — every Monday 08:00 AST
// Falls back to plain stats narrative if OpenAI key not configured
Schedule::command('ai:weekly-summary')
    ->weeklyOn(1, '08:00') // 1 = Monday
    ->timezone('America/Paramaribo')
    ->runInBackground()
    ->withoutOverlapping()
    ->onFailure(fn () => \Illuminate\Support\Facades\Log::error('ai:weekly-summary failed'));
