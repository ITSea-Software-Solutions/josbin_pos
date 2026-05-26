<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    /**
     * POST /api/auth/login
     *
     * Returns a Sanctum token on success.
     * If 2FA is required and configured: returns two_factor_required=true with a
     * short-lived pre-auth token. Frontend must complete the 2FA challenge.
     * If 2FA is required but NOT yet configured: returns two_factor_setup_required=true.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = 'login:' . strtolower($request->input('email')) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            throw ValidationException::withMessages([
                'email' => [__('auth.throttle', ['seconds' => $seconds])],
            ])->status(429);
        }

        $user = User::where('email', $request->input('email'))->first();

        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            RateLimiter::hit($throttleKey, 300);
            throw ValidationException::withMessages([
                'email' => [__('auth.failed')],
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => [__('auth.inactive')],
            ]);
        }

        RateLimiter::clear($throttleKey);
        $user->update(['last_login_at' => now()]);

        // Audit successful logins so security reviews / Rekenkamer audits
        // have a complete trail. The user.last_login_at column tells you
        // "did they log in?" — this row tells you "from where, when, how often".
        \DB::table('audit_logs')->insert([
            'user_id'         => $user->id,
            'organisation_id' => $user->organisation_id,
            'event'           => 'auth.login_success',
            'auditable_type'  => 'user',
            'auditable_id'    => $user->id,
            'old_values'      => null,
            'new_values'      => json_encode([
                'role'        => $user->role,
                'device_name' => $request->input('device_name', 'web'),
                'user_agent'  => substr((string) $request->userAgent(), 0, 200),
            ]),
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        // ── 2FA check ────────────────────────────────────────────────────────
        if ($user->requires2FA()) {
            // 2FA required but not yet set up → user must set it up first
            if (! $user->two_factor_confirmed_at) {
                $setupToken = $user->createToken(
                    name: '2fa-setup',
                    abilities: ['two_factor_setup'],
                    expiresAt: now()->addMinutes(30),
                );

                return response()->json([
                    'two_factor_setup_required' => true,
                    'setup_token'               => $setupToken->plainTextToken,
                    'user'                      => $this->userPayload($user),
                ]);
            }

            // 2FA configured → return a challenge token for the next step
            $preAuthToken = $user->createToken(
                name: '2fa-challenge',
                abilities: ['two_factor_challenge'],
                expiresAt: now()->addMinutes(10),
            );

            return response()->json([
                'two_factor_required' => true,
                'pre_auth_token'      => $preAuthToken->plainTextToken,
            ]);
        }

        // ── Normal login (no 2FA required) ───────────────────────────────────
        $this->handlePostLoginChecks($user, $request);

        $abilities = $user->getAllPermissions()->pluck('name')->toArray();

        $token = $user->createToken(
            name: 'pos-' . ($request->input('device_name', 'web')),
            abilities: $abilities,
            expiresAt: now()->addHours(12),
        );

        return response()->json([
            'token'      => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at->toIso8601String(),
            'user'       => $this->userPayload($user),
        ]);
    }

    /**
     * POST /api/auth/two-factor-challenge
     * Verify a TOTP code after the initial password check.
     * Requires the pre-auth token with ability: two_factor_challenge.
     */
    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $request->validate([
            'pre_auth_token' => ['required', 'string'],
            'code'           => ['required', 'string', 'size:6'],
        ]);

        // Resolve the pre-auth token
        $tokenModel = \Laravel\Sanctum\PersonalAccessToken::findToken($request->input('pre_auth_token'));

        if (! $tokenModel || ! $tokenModel->can('two_factor_challenge') || ! $tokenModel->tokenable) {
            return response()->json(['message' => 'Invalid or expired challenge token.'], 401);
        }

        if ($tokenModel->expires_at && $tokenModel->expires_at->isPast()) {
            $tokenModel->delete();
            return response()->json(['message' => 'Challenge token has expired. Please log in again.'], 401);
        }

        /** @var \App\Models\User $user */
        $user = $tokenModel->tokenable;

        $google2fa = new Google2FA();
        $valid = $google2fa->verifyKey(
            decrypt($user->two_factor_secret),
            $request->input('code'),
        );

        if (! $valid) {
            return response()->json([
                'message' => 'Invalid authentication code. Please try again.',
                'code'    => 'INVALID_2FA_CODE',
            ], 422);
        }

        // Revoke pre-auth token and issue a full token with 2fa_verified ability
        $tokenModel->delete();

        $this->handlePostLoginChecks($user, $request);

        $abilities   = $user->getAllPermissions()->pluck('name')->toArray();
        $abilities[] = '2fa_verified';

        $token = $user->createToken(
            name: 'pos-web',
            abilities: $abilities,
            expiresAt: now()->addHours(12),
        );

        return response()->json([
            'token'      => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at->toIso8601String(),
            'user'       => $this->userPayload($user),
        ]);
    }

    /**
     * GET /api/auth/two-factor/setup
     * Returns the QR code SVG + secret for the authenticator app.
     * Requires a token with ability: two_factor_setup.
     */
    public function twoFactorSetup(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->tokenCan('two_factor_setup') && ! $user->tokenCan('*')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $google2fa = new Google2FA();

        // Generate a new secret if one doesn't exist
        if (! $user->two_factor_secret) {
            $secret = $google2fa->generateSecretKey();
            $user->forceFill(['two_factor_secret' => encrypt($secret)])->save();
        } else {
            $secret = decrypt($user->two_factor_secret);
        }

        $qrCodeUrl = $google2fa->getQRCodeUrl(
            company: config('app.name', 'Josbin POS'),
            holder: $user->email,
            secret: $secret,
        );

        return response()->json([
            'secret'     => $secret,
            'qr_code_url' => $qrCodeUrl,
        ]);
    }

    /**
     * POST /api/auth/two-factor/confirm
     * Confirm 2FA setup by verifying the first TOTP code.
     * On success, sets two_factor_confirmed_at and issues a full token.
     */
    public function twoFactorConfirm(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->two_factor_secret) {
            return response()->json(['message' => 'No 2FA secret found. Please start setup again.'], 422);
        }

        $google2fa = new Google2FA();
        $valid = $google2fa->verifyKey(
            decrypt($user->two_factor_secret),
            $request->input('code'),
        );

        if (! $valid) {
            return response()->json([
                'message' => 'Invalid code. Please try again.',
                'code'    => 'INVALID_2FA_CODE',
            ], 422);
        }

        // Generate recovery codes (8 codes)
        $recoveryCodes = collect(range(1, 8))->map(fn () =>
            strtoupper(bin2hex(random_bytes(5))) . '-' . strtoupper(bin2hex(random_bytes(5)))
        )->all();

        $user->forceFill([
            'two_factor_confirmed_at'   => now(),
            'two_factor_recovery_codes' => encrypt(json_encode($recoveryCodes)),
        ])->save();

        // Revoke the setup token; issue a full authenticated token
        $user->currentAccessToken()->delete();

        $abilities   = $user->getAllPermissions()->pluck('name')->toArray();
        $abilities[] = '2fa_verified';

        $token = $user->createToken(
            name: 'pos-web',
            abilities: $abilities,
            expiresAt: now()->addHours(12),
        );

        return response()->json([
            'token'          => $token->plainTextToken,
            'expires_at'     => $token->accessToken->expires_at->toIso8601String(),
            'user'           => $this->userPayload($user),
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    /**
     * POST /api/auth/logout-all
     * Revoke all tokens for the authenticated user.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'All sessions revoked']);
    }

    /**
     * GET /api/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('roles');

        return response()->json([
            'user' => $this->userPayload($user),
            'environment' => [
                'demo_mode' => (bool) config('josbin_pos.demo_mode'),
                'sandbox'   => (bool) config('josbin_pos.sandbox'),
            ],
        ]);
    }

    /**
     * POST /api/auth/refresh
     * Rotate the current token; old token is deleted.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $oldToken = $user->currentAccessToken();
        $deviceName = str($oldToken->name)->after('pos-')->toString() ?: 'web';

        $abilities = $user->getAllPermissions()->pluck('name')->toArray();

        // Preserve 2fa_verified if the current token had it
        if ($oldToken->can('2fa_verified')) {
            $abilities[] = '2fa_verified';
        }

        $token = $user->createToken(
            name: 'pos-' . $deviceName,
            abilities: $abilities,
            expiresAt: now()->addHours(12),
        );

        $oldToken->delete();

        return response()->json([
            'token'      => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at->toIso8601String(),
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Post-authentication checks — run after both normal login and 2FA challenge.
     *
     * 1. Single-device enforcement for government accounts:
     *    Revoke all existing tokens so only one active session exists at a time.
     *
     * 2. Geo-alert for government accounts:
     *    If the login IP is outside Suriname (country ≠ SR), send an alert email
     *    to the organisation admin. Does NOT block the login — alert only.
     */
    private function handlePostLoginChecks(User $user, Request $request): void
    {
        $isGovt = $this->isGovernmentUser($user);

        // ── 1. Single-device enforcement ─────────────────────────────────────
        if ($isGovt) {
            // Revoke all existing tokens before issuing the new one
            $user->tokens()
                ->where('name', 'not like', '2fa-%') // keep active 2FA pre-auth tokens
                ->delete();

            AuditLog::create([
                'user_id'         => $user->id,
                'organisation_id' => $user->organisation_id,
                'event'           => 'single_device_logout',
                'auditable_type'  => 'user',
                'auditable_id'    => $user->id,
                'old_values'      => null,
                'new_values'      => json_encode(['reason' => 'govt single-device enforcement', 'ip' => $request->ip()]),
                'ip_address'      => $request->ip(),
                'created_at'      => now(),
            ]);
        }

        // ── 2. Geo-alert for non-Suriname login ───────────────────────────────
        if ($isGovt) {
            $this->checkGeoAlert($user, $request->ip());
        }
    }

    /**
     * A user is considered "government" if their organisation is flagged
     * as government, OR if their role is super_admin.
     */
    private function isGovernmentUser(User $user): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        if (! $user->organisation_id) {
            return false;
        }

        return (bool) \Illuminate\Support\Facades\DB::table('organisations')
            ->where('id', $user->organisation_id)
            ->value('is_government');
    }

    /**
     * Use ip-api.com (free, no key needed) to check the country of the login IP.
     * Sends an alert email to the org admin if login is from outside Suriname (SR).
     * Fails silently — never blocks the login.
     */
    private function checkGeoAlert(User $user, string $ip): void
    {
        // Skip private/loopback IPs (local installs)
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return;
        }

        try {
            $geo = Http::timeout(3)->get("http://ip-api.com/json/{$ip}?fields=status,country,countryCode,city")->json();

            if (($geo['status'] ?? '') !== 'success') {
                return;
            }

            $countryCode = $geo['countryCode'] ?? '';

            if ($countryCode !== 'SR') {
                // Log the geo-alert
                AuditLog::create([
                    'user_id'         => $user->id,
                    'organisation_id' => $user->organisation_id,
                    'event'           => 'geo_alert_login',
                    'auditable_type'  => 'user',
                    'auditable_id'    => $user->id,
                    'old_values'      => null,
                    'new_values'      => json_encode([
                        'ip'          => $ip,
                        'country'     => $geo['country'] ?? 'Unknown',
                        'country_code'=> $countryCode,
                        'city'        => $geo['city'] ?? 'Unknown',
                    ]),
                    'ip_address'      => $ip,
                    'created_at'      => now(),
                ]);

                // Send alert email to the org admin (best-effort)
                $adminEmail = \Illuminate\Support\Facades\DB::table('users')
                    ->where('organisation_id', $user->organisation_id)
                    ->whereIn('role', ['organisation_admin', 'super_admin'])
                    ->value('email');

                if ($adminEmail) {
                    $isNl     = ($user->locale ?? 'nl') === 'nl';
                    $subject  = $isNl
                        ? "⚠️ Josbin POS: Inlogpoging buiten Suriname — {$user->name}"
                        : "⚠️ Josbin POS: Login attempt from outside Suriname — {$user->name}";
                    $body     = $isNl
                        ? "Gebruiker {$user->name} ({$user->email}) heeft ingelogd vanuit {$geo['city']}, {$geo['country']} (IP: {$ip}) op " . now()->format('d-m-Y H:i') . " AST.\n\nAls dit niet verwacht was, trek dan direct alle sessies in via het gebruikersbeheer."
                        : "User {$user->name} ({$user->email}) logged in from {$geo['city']}, {$geo['country']} (IP: {$ip}) at " . now()->format('Y-m-d H:i') . " AST.\n\nIf this was unexpected, revoke all sessions immediately via user management.";

                    Mail::raw($body, fn ($m) => $m->to($adminEmail)->subject($subject));
                }
            }
        } catch (\Throwable) {
            // Geo-check failing must never block login
        }
    }

    private function userPayload(User $user): array
    {
        return [
            'id'                    => $user->id,
            'name'                  => $user->name,
            'email'                 => $user->email,
            'role'                  => $user->role,
            'locale'                => $user->locale,
            'is_active'             => $user->is_active,
            'requires_2fa'          => $user->requires2FA(),
            'two_factor_confirmed'  => $user->two_factor_confirmed_at !== null,
            'organisation_id'       => $user->organisation_id,
            'permissions'           => $user->getAllPermissions()->pluck('name'),
            'last_login_at'         => $user->last_login_at?->toIso8601String(),
        ];
    }
}
