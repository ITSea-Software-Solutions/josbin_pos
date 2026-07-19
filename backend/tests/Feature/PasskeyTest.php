<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Passkeys\Passkey;
use Tests\TestCase;

/**
 * Passkey (WebAuthn) endpoint coverage.
 *
 * The attestation/assertion CRYPTO is vendor-tested (web-auth/webauthn-lib);
 * a real happy-path needs a live authenticator, so these tests pin down
 * everything around it: options shape, challenge caching + single-use pull,
 * auth gating, ownership on delete, and the failure paths cashiers/admins
 * can actually hit.
 */
class PasskeyTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private string $managerToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        // Real Sanctum token, not actingAs(): the session.timeout middleware
        // reads currentAccessToken()->expires_at, which a TransientToken
        // (what actingAs produces) doesn't have.
        $this->managerToken = $this->manager->createToken('phpunit')->plainTextToken;
    }

    private function asManager()
    {
        return $this->withToken($this->managerToken);
    }

    public function test_register_options_require_auth(): void
    {
        $this->postJson('/api/auth/passkeys/options')->assertStatus(401);
    }

    public function test_register_options_return_webauthn_creation_shape_and_cache_challenge(): void
    {
        $res = $this->asManager()->postJson('/api/auth/passkeys/options');

        $res->assertOk()
            ->assertJsonStructure(['options' => ['challenge', 'rp' => ['id', 'name'], 'user' => ['id', 'name', 'displayName'], 'pubKeyCredParams']]);

        $this->assertNotNull(
            Cache::get('passkey-register:' . $this->manager->id),
            'creation options must be cached for the verify step'
        );
    }

    public function test_register_with_garbage_credential_fails_validation_not_500(): void
    {
        $this->asManager()->postJson('/api/auth/passkeys/options')->assertOk();

        $this->asManager()->postJson('/api/auth/passkeys', [
            'name'       => 'Test key',
            'credential' => ['id' => 'nonsense', 'type' => 'public-key'],
        ])->assertStatus(422);
    }

    public function test_register_without_prior_options_says_ceremony_expired(): void
    {
        $this->asManager()->postJson('/api/auth/passkeys', [
            'name'       => 'Test key',
            'credential' => ['id' => 'nonsense', 'type' => 'public-key'],
        ])->assertStatus(422)->assertJsonPath('errors.credential.0', __('errors.passkey_ceremony_expired'));
    }

    public function test_login_options_are_public_and_return_ceremony_id(): void
    {
        $res = $this->postJson('/api/auth/passkeys/login-options');

        $res->assertOk()->assertJsonStructure(['ceremony_id', 'options' => ['challenge', 'rpId']]);
        $this->assertSame(40, strlen($res->json('ceremony_id')));
        $this->assertNotNull(Cache::get('passkey-login:' . $res->json('ceremony_id')));
    }

    public function test_login_with_unknown_ceremony_is_rejected(): void
    {
        $this->postJson('/api/auth/passkeys/login', [
            'ceremony_id' => str_repeat('x', 40),
            'credential'  => ['id' => 'nonsense', 'type' => 'public-key'],
        ])->assertStatus(422)->assertJsonPath('errors.credential.0', __('errors.passkey_ceremony_expired'));
    }

    public function test_login_ceremony_is_single_use(): void
    {
        $ceremonyId = $this->postJson('/api/auth/passkeys/login-options')->json('ceremony_id');

        // First attempt consumes the cached options (and fails on the fake
        // credential); the second must already see an expired ceremony.
        $this->postJson('/api/auth/passkeys/login', [
            'ceremony_id' => $ceremonyId,
            'credential'  => ['id' => 'nonsense', 'type' => 'public-key'],
        ])->assertStatus(422);

        $this->assertNull(Cache::get('passkey-login:' . $ceremonyId));
    }

    public function test_passkey_list_and_owner_scoped_delete(): void
    {
        $other = User::where('email', '!=', $this->manager->email)->firstOrFail();

        $foreign = $other->passkeys()->create([
            'name'          => 'Someone else\'s key',
            'credential_id' => 'foreign-cred-1',
            'credential'    => ['publicKeyCredentialId' => 'foreign-cred-1'],
        ]);
        $mine = $this->manager->passkeys()->create([
            'name'          => 'My laptop',
            'credential_id' => 'my-cred-1',
            'credential'    => ['publicKeyCredentialId' => 'my-cred-1'],
        ]);

        $list = $this->asManager()->getJson('/api/auth/passkeys');
        $list->assertOk();
        $this->assertSame(['My laptop'], array_column($list->json('data'), 'name'), 'list must only show own passkeys');

        // Deleting someone else's key → 404, row untouched
        $this->asManager()->deleteJson('/api/auth/passkeys/' . $foreign->id)->assertStatus(404);
        $this->assertDatabaseHas('passkeys', ['id' => $foreign->id]);

        // Deleting my own works and is audited
        $this->asManager()->deleteJson('/api/auth/passkeys/' . $mine->id)->assertOk();
        $this->assertDatabaseMissing('passkeys', ['id' => $mine->id]);
        $this->assertDatabaseHas('audit_logs', [
            'event'   => 'auth.passkey_removed',
            'user_id' => $this->manager->id,
        ]);
    }
}
