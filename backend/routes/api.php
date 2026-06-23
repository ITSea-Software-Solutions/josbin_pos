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
        // Vendor contact for any UI surface that tells a client to "contact
        // support" — licence banners, read-only org header, certificate PDF.
        // Resellers override per-deployment via JOSBIN_POS_VENDOR_* env vars.
        // Public so the login screen + unauthenticated pages can render it.
        'vendor'    => config('josbin_pos.vendor'),
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
// `two_factor` enforces the post-2FA ability on every request for users whose
// role mandates it (super_admin, tax_inspector, government) — closing the gap
// where a stolen *full* token could otherwise skip the 2FA gate after login.
// Safe to mount here: the 2FA challenge (public) and setup/confirm (separate
// auth:sanctum group above) live OUTSIDE this group, so the completion flow
// can't deadlock. Non-2FA users pass straight through (requires2FA() === false).
Route::middleware(['auth:sanctum', 'two_factor', 'session.timeout'])->group(function () {

    // Self-service: personal stats + profile + password change.
    // Strictly scoped to $request->user() — see MeController for the rule.
    Route::prefix('me')->name('me.')->group(function () {
        Route::get('sales-summary', [\App\Http\Controllers\Api\MeController::class, 'salesSummary'])->name('sales-summary');
        Route::get('shifts',        [\App\Http\Controllers\Api\MeController::class, 'shifts'])->name('shifts');
        Route::patch('profile',     [\App\Http\Controllers\Api\MeController::class, 'updateProfile'])->name('profile');
        Route::post('password',     [\App\Http\Controllers\Api\MeController::class, 'changePassword'])->name('password');
        // Task #72 — own activity log + own active sessions for SA/OA/Auditor/API.
        Route::get('activity',        [\App\Http\Controllers\Api\MeController::class, 'activity'])->name('activity');
        Route::get('sessions',        [\App\Http\Controllers\Api\MeController::class, 'sessions'])->name('sessions');
        Route::delete('sessions/{tokenId}', [\App\Http\Controllers\Api\MeController::class, 'revokeSession'])->name('sessions.revoke');
    });

    // In-app notification bell — any authenticated user. Every action is
    // strictly scoped to $request->user()'s own notifications.
    Route::prefix('notifications')->name('notifications.')->group(function () {
        Route::get('/',          [\App\Http\Controllers\Api\NotificationController::class, 'index'])->name('index');
        Route::post('read-all',  [\App\Http\Controllers\Api\NotificationController::class, 'markAllRead'])->name('read-all');
        Route::post('{id}/read', [\App\Http\Controllers\Api\NotificationController::class, 'markRead'])->name('read');
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
        // Task #73 — platform-level KPIs across all orgs (SA only). The
        // existing /summary is org-scoped; this is the vendor view.
        Route::get('platform-overview',      [DashboardController::class, 'platformOverview'])->name('platform-overview');
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

        // Variants — nested under the parent product. Auth via ProductPolicy
        // (any user that can edit a product can manage its variants). See
        // ProductVariantController for cost-gate + uniqueness handling.
        Route::get(   '{product}/variants',           [\App\Http\Controllers\Api\ProductVariantController::class, 'index'])->name('variants.index');
        Route::post(  '{product}/variants',           [\App\Http\Controllers\Api\ProductVariantController::class, 'store'])->name('variants.store');
        Route::put(   '{product}/variants/{variant}', [\App\Http\Controllers\Api\ProductVariantController::class, 'update'])->name('variants.update');
        Route::delete('{product}/variants/{variant}', [\App\Http\Controllers\Api\ProductVariantController::class, 'destroy'])->name('variants.destroy');
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
        // Manager-gated return with no original sale. Declared before {sale} so
        // "blind-return" is not bound as a sale id. Throttled like void/refund.
        Route::post('blind-return',    [SaleController::class, 'blindReturn'])->middleware('throttle:20,1')->name('blind-return');
        Route::get('held',             [SaleController::class, 'heldList'])->name('held');
        Route::delete('held/{heldBill}',[SaleController::class, 'restore'])->name('restore');
        // Phase 2: pending-payments queue for OA. MUST be declared before the
        // {sale} routes or Laravel binds "pending-payments" as a sale id.
        Route::get('pending-payments',        [SaleController::class, 'pendingPaymentsQueue'])->name('pending-payments');
        Route::get('{sale}',              [SaleController::class, 'show'])->name('show');
        // Void + refund are money-reversing and high-impact — a compromised
        // cashier token could otherwise loop through the day's takings before
        // anyone notices. Cap at 20/min per token (the global api limiter is
        // 240/min, far too loose for these two).
        Route::post('{sale}/void',        [SaleController::class, 'void'])->middleware('throttle:20,1')->name('void');
        Route::post('{sale}/refund',      [SaleController::class, 'refund'])->middleware('throttle:20,1')->name('refund');
        Route::get('{sale}/receipt/pdf',  [SaleController::class, 'receiptPdf'])->name('receipt.pdf');
        Route::get('{sale}/receipt/html', [SaleController::class, 'receiptHtml'])->name('receipt.html');
        Route::post('{sale}/receipt/email',[SaleController::class, 'receiptEmail'])->name('receipt.email');
        Route::post('{sale}/confirm-payment', [SaleController::class, 'confirmPayment'])->name('confirm-payment');
    });

    // Register sessions (cash drawer open/close)
    Route::prefix('registers')->name('registers.')->group(function () {
        Route::get('my-session',                              [RegisterController::class, 'mySession'])->name('my-session');
        Route::get('sessions',                                [RegisterController::class, 'sessions'])->name('sessions');
        Route::post('sessions/{session}/close',               [RegisterController::class, 'close'])->name('close');
        Route::post('sessions/{session}/cash-movements',      [RegisterController::class, 'recordCashMovement'])->name('cash-movement');
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
        // WBP-S right-to-erasure — redacts PII, keeps the row. OA + SA only.
        Route::delete('{customer}', [CustomerController::class, 'destroy'])->name('destroy');
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
        Route::post('/',             [LicenseController::class, 'store'])->name('store');
        Route::patch('{id}',         [LicenseController::class, 'update'])->name('update');
        Route::delete('{id}',        [LicenseController::class, 'destroy'])->name('destroy');
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
        // Profit report — revenue / cost / profit / margin% with per-store +
        // top-products-by-profit + loss-makers. Requires products.view_cost
        // (OA + SA + SM). See ReportController::profit for the gate.
        Route::get('profit',        [ReportController::class, 'profit'])->name('profit');
        Route::get('export',        [ReportController::class, 'export'])->name('export');
        Route::get('rekenkamer',    [RekenkamerController::class, 'export'])->name('rekenkamer');
    });

    // ── BTW Submissions (Belastingdienst Suriname filings) ───────────────────
    // OA / SM file (POST), can view their own org's submissions.
    // tax_inspector + SA see cross-org and can accept/dispute filed ones.
    Route::prefix('btw-submissions')->name('btw-submissions.')->group(function () {
        // Static paths first — Laravel binds {btwSubmission} greedily.
        Route::get('inspector-dashboard',     [\App\Http\Controllers\Api\BtwSubmissionController::class, 'inspectorDashboard'])->name('inspector-dashboard');
        Route::post('preview',                [\App\Http\Controllers\Api\BtwSubmissionController::class, 'preview'])->name('preview');
        Route::post('bulk-accept',            [\App\Http\Controllers\Api\BtwSubmissionController::class, 'bulkAccept'])->middleware('throttle:30,1')->name('bulk-accept');
        Route::get('export',                  [\App\Http\Controllers\Api\BtwSubmissionController::class, 'export'])->name('export');
        Route::get('/',                       [\App\Http\Controllers\Api\BtwSubmissionController::class, 'index'])->name('index');
        Route::post('/',                      [\App\Http\Controllers\Api\BtwSubmissionController::class, 'store'])->name('store');
        Route::get('{btwSubmission}/detail',  [\App\Http\Controllers\Api\BtwSubmissionController::class, 'detail'])->name('detail');
        Route::get('{btwSubmission}',         [\App\Http\Controllers\Api\BtwSubmissionController::class, 'show'])->name('show');
        Route::post('{btwSubmission}/accept', [\App\Http\Controllers\Api\BtwSubmissionController::class, 'accept'])->name('accept');
        Route::post('{btwSubmission}/dispute',[\App\Http\Controllers\Api\BtwSubmissionController::class, 'dispute'])->name('dispute');
        // Resubmission — marks the original superseded AND creates a fresh
        // filed row with recomputed totals for the same period. Same OA/SM
        // gate as create; only allowed on filed/disputed (not accepted).
        Route::post('{btwSubmission}/supersede', [\App\Http\Controllers\Api\BtwSubmissionController::class, 'supersede'])->name('supersede');
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

// ── QR / mobile-wallet webhook (Phase 3 scaffolding, task #79) ───────────────
// Public — PSP partners post here. Authenticated by HMAC signature in headers.
// Endpoint returns 503 unless josbin_pos.qr_webhooks_enabled is true.
Route::post('qr-payments/webhook', [\App\Http\Controllers\Api\QrPaymentWebhookController::class, 'handle'])
    ->name('qr-payments.webhook');

// ── Receipt PDF — browser-safe (supports ?token= query param) ────────────────
// Declared outside the auth:sanctum group so AuthenticateViaQueryToken runs first.
// It resolves the token directly via Sanctum's PersonalAccessToken model and logs
// the user in for this request. No Authorization header needed — safe to open in
// a browser tab or Electron's shell.openExternal().
Route::get('sales/{sale}/receipt/pdf', [SaleController::class, 'receiptPdf'])
    ->middleware(['auth.query_token'])
    ->name('receipt.pdf.public');
