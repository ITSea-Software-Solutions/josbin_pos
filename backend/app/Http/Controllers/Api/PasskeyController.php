<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Passkeys\Actions\GenerateRegistrationOptions;
use Laravel\Passkeys\Actions\GenerateVerificationOptions;
use Laravel\Passkeys\Actions\StorePasskey;
use Laravel\Passkeys\Actions\VerifyPasskey;
use Laravel\Passkeys\Exceptions\InvalidPasskeyException;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Support\WebAuthn;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialRequestOptions;

/**
 * Passkey (WebAuthn) endpoints for the dashboard.
 *
 * Registration/management run under auth:sanctum; login is a guest,
 * usernameless (discoverable-credential) ceremony that ends in the same
 * token response as a password login. A user-verified passkey is
 * two-factor by construction (device possession + biometric/PIN), so a
 * passkey login does NOT additionally require the TOTP step.
 *
 * Challenge round-trip: WebAuthn needs the options from step 1 when
 * verifying step 2. We're stateless (bearer tokens, no session), so the
 * serialized options live in the cache for 5 minutes — pulled exactly
 * once, which also kills replay.
 */
class PasskeyController extends Controller
{
    private const CEREMONY_TTL_SECONDS = 300;

    /** GET /auth/passkeys — the current user's registered passkeys. */
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->passkeys()
                ->orderBy('created_at')
                ->get(['id', 'name', 'created_at', 'last_used_at']),
        ]);
    }

    /** POST /auth/passkeys/options — creation options for a new passkey. */
    public function registerOptions(Request $request): JsonResponse
    {
        $user = $request->user();
        $options = app(GenerateRegistrationOptions::class)($user);

        Cache::put($this->registrationKey($user->id), WebAuthn::toJson($options), self::CEREMONY_TTL_SECONDS);

        return response()->json(['options' => json_decode(WebAuthn::toJson($options), true)]);
    }

    /** POST /auth/passkeys — verify the attestation and store the passkey. */
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name'       => ['required', 'string', 'max:80'],
            'credential' => ['required', 'array'],
        ]);

        $user = $request->user();
        $cachedOptions = Cache::pull($this->registrationKey($user->id));

        if (! $cachedOptions) {
            throw ValidationException::withMessages([
                'credential' => [__('errors.passkey_ceremony_expired')],
            ]);
        }

        try {
            $options = WebAuthn::fromJson($cachedOptions, PublicKeyCredentialCreationOptions::class);
            $credential = WebAuthn::fromJson(
                json_encode($request->input('credential'), JSON_THROW_ON_ERROR),
                PublicKeyCredential::class,
            );

            $passkey = app(StorePasskey::class)($user, $request->input('name'), $credential, $options);
        } catch (InvalidPasskeyException $e) {
            throw ValidationException::withMessages(['credential' => [$e->getMessage()]]);
        } catch (\Throwable $e) {
            // Surface WHY in the log (never to the client) — a failed
            // WebAuthn ceremony is otherwise undebuggable in the field.
            \Log::warning('passkey.register_failed', ['user' => $user->id, 'error' => $e->getMessage()]);
            throw ValidationException::withMessages([
                'credential' => [__('errors.passkey_invalid')],
            ]);
        }

        AuditLog::create([
            'user_id'         => $user->id,
            'organisation_id' => $user->organisation_id,
            'event'           => 'auth.passkey_registered',
            'auditable_type'  => 'passkey',
            'auditable_id'    => $user->id,
            'old_values'      => null,
            'new_values'      => ['name' => $passkey->name, 'credential_id' => $passkey->credential_id],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        return response()->json([
            'data' => $passkey->only(['id', 'name', 'created_at', 'last_used_at']),
        ], 201);
    }

    /** DELETE /auth/passkeys/{passkey} — remove one of your own passkeys. */
    public function destroy(Request $request, int $passkeyId): JsonResponse
    {
        $user = $request->user();

        /** @var Passkey|null $passkey */
        $passkey = $user->passkeys()->whereKey($passkeyId)->first();

        if (! $passkey) {
            return response()->json(['message' => __('errors.not_found')], 404);
        }

        $passkey->delete();

        AuditLog::create([
            'user_id'         => $user->id,
            'organisation_id' => $user->organisation_id,
            'event'           => 'auth.passkey_removed',
            'auditable_type'  => 'passkey',
            'auditable_id'    => $user->id,
            'old_values'      => ['name' => $passkey->name, 'credential_id' => $passkey->credential_id],
            'new_values'      => null,
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        return response()->json(['message' => 'ok']);
    }

    /**
     * POST /auth/passkeys/login-options — guest. Usernameless flow: empty
     * allow-list, the authenticator offers its discoverable credentials.
     */
    public function loginOptions(Request $request): JsonResponse
    {
        $options = app(GenerateVerificationOptions::class)(null);

        $ceremonyId = Str::random(40);
        Cache::put($this->loginKey($ceremonyId), WebAuthn::toJson($options), self::CEREMONY_TTL_SECONDS);

        return response()->json([
            'ceremony_id' => $ceremonyId,
            'options'     => json_decode(WebAuthn::toJson($options), true),
        ]);
    }

    /** POST /auth/passkeys/login — verify the assertion, issue a Sanctum token. */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'ceremony_id' => ['required', 'string', 'size:40'],
            'credential'  => ['required', 'array'],
            'device_name' => ['nullable', 'string', 'max:80'],
        ]);

        $cachedOptions = Cache::pull($this->loginKey($request->input('ceremony_id')));

        if (! $cachedOptions) {
            throw ValidationException::withMessages([
                'credential' => [__('errors.passkey_ceremony_expired')],
            ]);
        }

        try {
            $options = WebAuthn::fromJson($cachedOptions, PublicKeyCredentialRequestOptions::class);
            $credential = WebAuthn::fromJson(
                json_encode($request->input('credential'), JSON_THROW_ON_ERROR),
                PublicKeyCredential::class,
            );

            $passkey = app(VerifyPasskey::class)($credential, $options, null);
        } catch (InvalidPasskeyException $e) {
            throw ValidationException::withMessages(['credential' => [$e->getMessage()]]);
        } catch (\Throwable $e) {
            \Log::warning('passkey.login_failed', ['error' => $e->getMessage()]);
            throw ValidationException::withMessages([
                'credential' => [__('errors.passkey_invalid')],
            ]);
        }

        /** @var \App\Models\User $user */
        $user = $passkey->user;

        if (! $user || ! $user->is_active) {
            throw ValidationException::withMessages(['credential' => [__('auth.inactive')]]);
        }

        $user->update(['last_login_at' => now()]);

        AuditLog::create([
            'user_id'         => $user->id,
            'organisation_id' => $user->organisation_id,
            'event'           => 'auth.passkey_login',
            'auditable_type'  => 'user',
            'auditable_id'    => $user->id,
            'old_values'      => null,
            'new_values'      => [
                'role'        => $user->role,
                'passkey'     => $passkey->name,
                'device_name' => $request->input('device_name', 'web'),
                'user_agent'  => substr((string) $request->userAgent(), 0, 200),
            ],
            'ip_address'      => $request->ip(),
            'created_at'      => now(),
        ]);

        // Same shape as AuthController@login's success branch. Wildcard
        // ability + policy checks at request time (task #74). No TOTP
        // step-up: a user-verified passkey already proves two factors.
        $token = $user->createToken(
            name: 'pos-' . ($request->input('device_name', 'web')),
            abilities: ['*'],
            expiresAt: now()->addHours(12),
        );

        return response()->json([
            'token'      => $token->plainTextToken,
            'expires_at' => $token->accessToken->expires_at->toIso8601String(),
            'user'       => AuthController::userPayload($user),
        ]);
    }

    private function registrationKey(string $userId): string
    {
        return "passkey-register:{$userId}";
    }

    private function loginKey(string $ceremonyId): string
    {
        return "passkey-login:{$ceremonyId}";
    }
}
