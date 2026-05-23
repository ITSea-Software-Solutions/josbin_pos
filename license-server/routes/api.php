<?php

use App\Http\Controllers\ActivationController;
use App\Http\Controllers\Admin\LicenseController;
use App\Http\Controllers\ValidationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Josbin POS License Server — API routes
|--------------------------------------------------------------------------
| All routes are prefixed with /api by the framework.
*/

// ── Public — called by Josbin POS installations ─────────────────────────────
// First-time activation: binds hardware, returns a per-installation key.
Route::post('activate', [ActivationController::class, 'activate'])->name('activate');

// Recurring check: POS calls this on startup and every 24 hours.
Route::post('validate', [ValidationController::class, 'validate'])->name('validate');

// ── Admin — developer company tooling (X-Admin-Key header required) ──────────
Route::middleware('admin.key')->prefix('admin')->name('admin.')->group(function () {
    Route::get('licenses',                   [LicenseController::class, 'index'])->name('licenses.index');
    Route::post('licenses',                  [LicenseController::class, 'store'])->name('licenses.store');
    Route::get('licenses/{license}',         [LicenseController::class, 'show'])->name('licenses.show');
    Route::post('licenses/{license}/renew',  [LicenseController::class, 'renew'])->name('licenses.renew');
    Route::post('licenses/{license}/revoke', [LicenseController::class, 'revoke'])->name('licenses.revoke');
});
