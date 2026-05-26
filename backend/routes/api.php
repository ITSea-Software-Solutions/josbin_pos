<?php

use App\Http\Controllers\Api\ApiIntegrationController;
use App\Http\Controllers\Api\DiscountRuleController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\LicenseController;
use App\Http\Controllers\Api\RekenkamerController;
use App\Http\Controllers\Api\SyncExportController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExchangeRateController;
use App\Http\Controllers\Api\OrganisationController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SaleController;
use App\Http\Controllers\Api\SecurityPolicyController;
use App\Http\Controllers\Api\StoreController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RegisterController;
use App\Http\Controllers\V1\ApiDocsController;
use App\Http\Controllers\V1\ReportController as V1ReportController;
use App\Http\Controllers\V1\SaleController as V1SaleController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Josbin POS API Routes
|--------------------------------------------------------------------------
*/

// ── Health check (unauthenticated — for Docker, monitoring, Electron) ─────
Route::get('health', HealthController::class)->name('health');

// ── Environment flags (unauthenticated — so login screen can render the DEMO banner)
// Also advertises the Reverb WS host/port for this stack so the frontend doesn't
// have to guess (live and demo run Reverb on different host ports).
Route::get('environment', function () {
    $isDemo = (bool) config('josbin_pos.demo_mode');
    return response()->json([
        'demo_mode' => $isDemo,
        'sandbox'   => (bool) config('josbin_pos.sandbox'),
        'reverb' => [
            'app_key' => env('REVERB_APP_KEY', config('reverb.apps.apps.0.key', 'josbin_pos-reverb')),
            // PUBLIC host/port the browser must reach — set REVERB_PUBLIC_HOST
            // / REVERB_PUBLIC_PORT in .env (or docker compose env). Falls back
            // to current request host and the in-container 8080.
            'host'    => env('REVERB_PUBLIC_HOST', request()->getHost()),
            'port'    => (int) env('REVERB_PUBLIC_PORT', $isDemo ? 6002 : 6001),
            'scheme'  => env('REVERB_PUBLIC_SCHEME', request()->isSecure() ? 'https' : 'http'),
        ],
    ]);
})->name('environment');

// ── Public ────────────────────────────────────────────────────────────────
Route::prefix('auth')->name('auth.')->group(function () {
    Route::post('login', [AuthController::class, 'login'])->name('login')
        ->middleware('throttle:login');

    // 2FA challenge — uses pre_auth_token from body, not Sanctum guard
    Route::post('two-factor-challenge', [AuthController::class, 'twoFactorChallenge'])->name('2fa.challenge');
});

// ── 2FA Setup — requires setup token (auth:sanctum with two_factor_setup ability) ──
Route::middleware(['auth:sanctum'])->prefix('auth')->name('auth.')->group(function () {
    Route::get('two-factor/setup',    [AuthController::class, 'twoFactorSetup'])->name('2fa.setup');
    Route::post('two-factor/confirm', [AuthController::class, 'twoFactorConfirm'])->name('2fa.confirm');
});

// ── Authenticated (Sanctum) ───────────────────────────────────────────────
Route::middleware(['auth:sanctum', 'session.timeout'])->group(function () {

    // Self-service: personal stats + profile + password change.
    // Strictly scoped to $request->user() — see MeController for the rule.
    Route::prefix('me')->name('me.')->group(function () {
        Route::get('sales-summary', [\App\Http\Controllers\Api\MeController::class, 'salesSummary'])->name('sales-summary');
        Route::get('shifts',        [\App\Http\Controllers\Api\MeController::class, 'shifts'])->name('shifts');
        Route::patch('profile',     [\App\Http\Controllers\Api\MeController::class, 'updateProfile'])->name('profile');
        Route::post('password',     [\App\Http\Controllers\Api\MeController::class, 'changePassword'])->name('password');
    });

    // Auth
    Route::prefix('auth')->name('auth.')->group(function () {
        Route::get('me', [AuthController::class, 'me'])->name('me');
        Route::post('refresh', [AuthController::class, 'refresh'])->name('refresh');
        Route::post('logout', [AuthController::class, 'logout'])->name('logout');
        Route::post('logout-all', [AuthController::class, 'logoutAll'])->name('logout-all');
    });

    // Dashboard (SPOS-306)
    Route::prefix('dashboard')->name('dashboard.')->group(function () {
        Route::get('summary',                [DashboardController::class, 'summary'])->name('summary');
        Route::get('stores/{store}',         [DashboardController::class, 'storeDetail'])->name('store');
        Route::get('reports/consolidated',        [DashboardController::class, 'consolidatedReport'])->name('reports.consolidated');
        Route::get('reports/consolidated/export', [DashboardController::class, 'exportConsolidated'])->name('reports.consolidated.export');
        Route::get('reports/btw',                 [DashboardController::class, 'consolidatedBtwReport'])->name('reports.btw');
        Route::get('reports/btw/export',          [DashboardController::class, 'exportBtw'])->name('reports.btw.export');
        Route::get('z-reports',              [DashboardController::class, 'zReports'])->name('z-reports');
    });

    // AI Features v1 (SPOS-AI)
    // product-search is open to all authed users (POS uses it). weekly-summary
    // and anomalies expose sensitive business insights — manager+ only.
    Route::prefix('ai')->name('ai.')->group(function () {
        Route::get('product-search', [AiController::class, 'productSearch'])->name('product-search');
        Route::get('weekly-summary', [AiController::class, 'weeklySummary'])->name('weekly-summary')->middleware('can:ai.insights');
        Route::get('anomalies',      [AiController::class, 'anomalies'])->name('anomalies')->middleware('can:ai.insights');
    });

    // Sync Export / USB fallback (SPOS — Layer 4 offline fallback)
    Route::prefix('sync')->name('sync.')->group(function () {
        Route::get('export',  [SyncExportController::class, 'export'])->name('export');
        Route::post('import', [SyncExportController::class, 'import'])->name('import');
    });

    // Security policy — per-role 2FA enforcement (Super Admin only)
    Route::prefix('settings')->name('settings.')->group(function () {
        Route::get('two-factor-policy',  [SecurityPolicyController::class, 'show'])->name('2fa-policy.show');
        Route::put('two-factor-policy',  [SecurityPolicyController::class, 'update'])->name('2fa-policy.update');
    });

    // Audit Log (SPOS-310)
    Route::prefix('audit-log')->name('audit.')->group(function () {
        Route::get('/',        [AuditLogController::class, 'index'])->name('index');
        Route::get('summary',  [AuditLogController::class, 'summary'])->name('summary');
    });

    // Organisations (SPOS-303)
    Route::prefix('organisations')->name('organisations.')->group(function () {
        Route::get('/',                                   [OrganisationController::class, 'index'])->name('index');
        Route::post('/',                                  [OrganisationController::class, 'store'])->name('store');
        Route::get('{organisation}',                      [OrganisationController::class, 'show'])->name('show');
        Route::put('{organisation}',                      [OrganisationController::class, 'update'])->name('update');
        Route::delete('{organisation}',                   [OrganisationController::class, 'destroy'])->name('destroy');
        Route::get('{organisation}/stores',               [OrganisationController::class, 'stores'])->name('stores');
        Route::post('{organisation}/stores',              [OrganisationController::class, 'storeCreate'])->name('stores.create');
    });

    // Stores (SPOS-210 / SPOS-303)
    Route::prefix('stores')->name('stores.')->group(function () {
        Route::get('/',                   [StoreController::class, 'index'])->name('index');
        Route::get('{store}',             [StoreController::class, 'show'])->name('show');
        Route::put('{store}',             [StoreController::class, 'update'])->name('update');
        Route::post('{store}/logo',       [StoreController::class, 'uploadLogo'])->name('logo');
        Route::delete('{store}',          [StoreController::class, 'destroy'])->name('destroy');
    });

    // Users (SPOS-304)
    Route::prefix('users')->name('users.')->group(function () {
        Route::get('/',                        [UserController::class, 'index'])->name('index');
        Route::post('/',                       [UserController::class, 'store'])->name('store');
        Route::get('{user}',                   [UserController::class, 'show'])->name('show');
        Route::put('{user}',                   [UserController::class, 'update'])->name('update');
        Route::delete('{user}',                [UserController::class, 'destroy'])->name('destroy');
        Route::post('{user}/activate',         [UserController::class, 'activate'])->name('activate');
        Route::post('{user}/reset-2fa',        [UserController::class, 'reset2fa'])->name('reset-2fa');
    });

    // Categories (SPOS-203)
    Route::prefix('categories')->name('categories.')->group(function () {
        Route::get('/', [CategoryController::class, 'index'])->name('index');
        Route::post('/', [CategoryController::class, 'store'])->name('store');
        Route::put('{category}', [CategoryController::class, 'update'])->name('update');
        Route::delete('{category}', [CategoryController::class, 'destroy'])->name('destroy');
    });

    // Products (SPOS-203)
    Route::prefix('products')->name('products.')->group(function () {
        Route::get('pos', [ProductController::class, 'pos'])->name('pos');
        Route::get('barcode/{barcode}', [ProductController::class, 'byBarcode'])->name('barcode');
        Route::post('import', [ProductController::class, 'import'])->name('import');
        Route::get('export', [ProductController::class, 'export'])->name('export');
        Route::get('import/template', [ProductController::class, 'importTemplate'])->name('import.template');
        Route::post('push', [ProductController::class, 'pushCatalogue'])->name('push');
        Route::get('/', [ProductController::class, 'index'])->name('index');
        Route::post('/', [ProductController::class, 'store'])->name('store');
        Route::get('{product}', [ProductController::class, 'show'])->name('show');
        Route::put('{product}', [ProductController::class, 'update'])->name('update');
        Route::delete('{product}', [ProductController::class, 'destroy'])->name('destroy');
        Route::post('{product}/image', [ProductController::class, 'uploadImage'])->name('image');
        Route::get('{product}/stock-history',  [ProductController::class, 'stockHistory'])->name('stock-history');
        Route::post('{product}/stock-adjust',  [ProductController::class, 'stockAdjust'])->name('stock-adjust');
    });

    // Per-store price overrides
    Route::prefix('stores/{store}/price-overrides')->name('price-overrides.')->group(function () {
        Route::get('/',              [ProductController::class, 'storeOverrides'])->name('index');
        Route::post('/',             [ProductController::class, 'upsertOverride'])->name('upsert');
        Route::delete('{product}',   [ProductController::class, 'deleteOverride'])->name('destroy');
    });

    // Sales (SPOS-205)
    Route::prefix('sales')->name('sales.')->group(function () {
        Route::get('/',                [SaleController::class, 'index'])->name('index');
        Route::post('/',               [SaleController::class, 'store'])->name('store');
        Route::post('hold',            [SaleController::class, 'hold'])->name('hold');
        Route::get('held',             [SaleController::class, 'heldList'])->name('held');
        Route::delete('held/{heldBill}',[SaleController::class, 'restore'])->name('restore');
        Route::get('{sale}',              [SaleController::class, 'show'])->name('show');
        Route::post('{sale}/void',        [SaleController::class, 'void'])->name('void');
        Route::post('{sale}/refund',      [SaleController::class, 'refund'])->name('refund');
        Route::get('{sale}/receipt/pdf',  [SaleController::class, 'receiptPdf'])->name('receipt.pdf');
        Route::post('{sale}/receipt/email',[SaleController::class, 'receiptEmail'])->name('receipt.email');
    });

    // Register sessions (cash drawer open/close)
    Route::prefix('registers')->name('registers.')->group(function () {
        Route::get('my-session',                              [RegisterController::class, 'mySession'])->name('my-session');
        Route::get('sessions',                                [RegisterController::class, 'sessions'])->name('sessions');
        Route::post('sessions/{session}/close',               [RegisterController::class, 'close'])->name('close');
        Route::post('sessions/{session}/request-reopen',      [RegisterController::class, 'requestReopen'])->name('request-reopen');
        Route::post('sessions/{session}/approve-reopen',      [RegisterController::class, 'approveReopen'])->name('approve-reopen');
        Route::get('sessions/{session}/report',               [RegisterController::class, 'sessionReport'])->name('session-report');
        Route::get('/',                                        [RegisterController::class, 'index'])->name('index');
        Route::post('/',                                       [RegisterController::class, 'createRegister'])->name('create');
        Route::put('{register}',                               [RegisterController::class, 'updateRegister'])->name('update');
        Route::delete('{register}',                            [RegisterController::class, 'destroyRegister'])->name('destroy');
        Route::post('{register}/open',                        [RegisterController::class, 'open'])->name('open');
        Route::post('{register}/clear-closed-today',          [RegisterController::class, 'clearClosedToday'])->name('clear-closed-today');
    });

    // Customers (SPOS-206)
    Route::prefix('customers')->name('customers.')->group(function () {
        Route::get('/',          [CustomerController::class, 'index'])->name('index');
        Route::post('/',         [CustomerController::class, 'store'])->name('store');
        Route::post('import',    [CustomerController::class, 'import'])->name('import');
        Route::get('{customer}', [CustomerController::class, 'show'])->name('show');
        Route::put('{customer}', [CustomerController::class, 'update'])->name('update');
    });

    // Exchange rates (SPOS-207)
    Route::prefix('rates')->name('rates.')->group(function () {
        Route::get('/',       [ExchangeRateController::class, 'index'])->name('index');
        Route::post('override',[ExchangeRateController::class, 'override'])->name('override');
        Route::post('fetch',  [ExchangeRateController::class, 'fetch'])->name('fetch');
    });

    // API Integrations / API Keys (SPOS-307)
    // All endpoints gated — Super Admin + Org Admin only.
    Route::prefix('api-keys')->name('api-keys.')->middleware('can:api_integrations.manage')->group(function () {
        Route::get('/',                                              [ApiIntegrationController::class, 'index'])->name('index');
        Route::post('/',                                             [ApiIntegrationController::class, 'store'])->name('store');
        Route::put('{apiIntegration}',                               [ApiIntegrationController::class, 'update'])->name('update');
        Route::delete('{apiIntegration}',                            [ApiIntegrationController::class, 'destroy'])->name('destroy');
        Route::post('{apiIntegration}/rotate-webhook-secret',        [ApiIntegrationController::class, 'rotateWebhookSecret'])->name('rotate-webhook-secret');
    });

    // Discount Rules (SPOS-discount)
    // index() open so POS can read active rules. Mutations gated to manager+.
    Route::prefix('discount-rules')->name('discount-rules.')->group(function () {
        Route::get('/',                  [DiscountRuleController::class, 'index'])->name('index');
        Route::post('/',                 [DiscountRuleController::class, 'store'])->name('store')->middleware('can:discount_rules.manage');
        Route::put('{discountRule}',     [DiscountRuleController::class, 'update'])->name('update')->middleware('can:discount_rules.manage');
        Route::delete('{discountRule}',  [DiscountRuleController::class, 'destroy'])->name('destroy')->middleware('can:discount_rules.manage');
    });

    // License Management (SPOS-license)
    Route::prefix('licenses')->name('licenses.')->group(function () {
        Route::get('/',              [LicenseController::class, 'index'])->name('index');
        Route::post('{id}/renew',    [LicenseController::class, 'renew'])->name('renew');
    });

    // Reports (SPOS-209)
    Route::prefix('reports')->name('reports.')->group(function () {
        Route::get('daily',         [ReportController::class, 'daily'])->name('daily');
        Route::get('monthly',       [ReportController::class, 'monthly'])->name('monthly');
        Route::get('custom',        [ReportController::class, 'custom'])->name('custom');
        Route::get('top-products',  [ReportController::class, 'topProducts'])->name('top-products');
        Route::get('x-report',      [ReportController::class, 'xReport'])->name('x-report');
        Route::post('z-report',     [ReportController::class, 'zReport'])->name('z-report');
        Route::get('z-report/history', [ReportController::class, 'zReportHistory'])->name('z-report.history');
        Route::post('z-report/{zReport}/submit', [ReportController::class, 'submitZReport'])->name('z-report.submit');
        Route::get('btw',           [ReportController::class, 'btwReport'])->name('btw');
        Route::get('export',        [ReportController::class, 'export'])->name('export');
        Route::get('rekenkamer',    [RekenkamerController::class, 'export'])->name('rekenkamer');
    });
});

// ── Open Integration API — Layer 3 (SPOS-307) ────────────────────────────────
// Authentication: X-API-Key header (not Sanctum)
Route::prefix('v1')->name('v1.')->middleware('api.key')->group(function () {

    // Sales
    Route::prefix('sales')->name('sales.')->group(function () {
        Route::post('/',       [V1SaleController::class, 'store'])->name('store');
        Route::post('batch',   [V1SaleController::class, 'batch'])->name('batch');
    });

    // Reports (read-only, scoped to integration's store)
    Route::prefix('reports')->name('reports.')->group(function () {
        Route::get('sales',    [V1ReportController::class, 'sales'])->name('sales');
        Route::get('summary',  [V1ReportController::class, 'summary'])->name('summary');
    });
});

// ── Open Integration API — Documentation (public, no API key required) ────────
Route::prefix('v1')->name('v1.')->group(function () {
    Route::get('openapi.json', [ApiDocsController::class, 'spec'])->name('docs.spec');
    Route::get('docs',         [ApiDocsController::class, 'ui'])->name('docs.ui');
});

// ── Receipt PDF — browser-safe (supports ?token= query param) ────────────────
// Declared outside the auth:sanctum group so AuthenticateViaQueryToken runs first.
// It resolves the token directly via Sanctum's PersonalAccessToken model and logs
// the user in for this request. No Authorization header needed — safe to open in
// a browser tab or Electron's shell.openExternal().
Route::get('sales/{sale}/receipt/pdf', [SaleController::class, 'receiptPdf'])
    ->middleware(['auth.query_token'])
    ->name('receipt.pdf.public');
