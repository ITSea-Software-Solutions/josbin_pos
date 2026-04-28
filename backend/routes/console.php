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
