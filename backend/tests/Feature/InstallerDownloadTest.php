<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Installer metadata + download.
 *
 * The point of this endpoint is that a manager on the shop LAN can add a till
 * with no internet, so the tests pin the two states that matter in the field:
 * a server WITH an installer deployed, and one WITHOUT (which must degrade to
 * "not available" rather than an error the dashboard has to special-case).
 */
class InstallerDownloadTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private User $cashier;
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();

        $this->dir = storage_path('framework/testing/installers');
        if (! is_dir($this->dir)) {
            mkdir($this->dir, 0777, true);
        }
        array_map('unlink', glob($this->dir . '/*') ?: []);
        config(['josbin_pos.installer_dir' => $this->dir]);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir . '/*') ?: []);
        parent::tearDown();
    }

    private function token(User $u): string
    {
        return $u->createToken('phpunit')->plainTextToken;
    }

    public function test_reports_not_available_when_no_installer_is_deployed(): void
    {
        $res = $this->withToken($this->token($this->manager))->getJson('/api/installer');

        $res->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('reason', 'not_deployed');
        // The dashboard shows this so a half-finished install is self-diagnosing.
        $this->assertSame($this->dir, $res->json('expected_dir'));
    }

    public function test_reports_metadata_for_the_newest_installer(): void
    {
        file_put_contents($this->dir . '/Josbin POS Setup 0.9.0.exe', str_repeat('a', 2048));
        touch($this->dir . '/Josbin POS Setup 0.9.0.exe', time() - 3600);
        file_put_contents($this->dir . '/Josbin POS Setup 1.0.0.exe', str_repeat('b', 4096));

        $res = $this->withToken($this->token($this->manager))->getJson('/api/installer');

        $res->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('filename', 'Josbin POS Setup 1.0.0.exe')
            ->assertJsonPath('version', '1.0.0')
            ->assertJsonPath('size_bytes', 4096)
            // No APK deployed → the Android slot is explicitly null,
            // so the dashboard can hide that row without special-casing.
            ->assertJsonPath('android', null);
    }

    public function test_reports_android_apk_alongside_the_exe(): void
    {
        file_put_contents($this->dir . '/Josbin POS Setup 1.0.0.exe', str_repeat('a', 2048));
        file_put_contents($this->dir . '/josbin-pos-1.1.0.apk', str_repeat('b', 1024));

        $res = $this->withToken($this->token($this->manager))->getJson('/api/installer');

        $res->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('filename', 'Josbin POS Setup 1.0.0.exe')
            ->assertJsonPath('android.filename', 'josbin-pos-1.1.0.apk')
            ->assertJsonPath('android.version', '1.1.0')
            ->assertJsonPath('android.size_bytes', 1024);
    }

    public function test_download_platform_android_streams_the_apk_with_its_mime(): void
    {
        file_put_contents($this->dir . '/josbin-pos-1.0.0.apk', 'PK-fake-apk');

        $res = $this->withToken($this->token($this->manager))
            ->get('/api/installer/download?platform=android');

        $res->assertOk();
        $this->assertSame('application/vnd.android.package-archive', $res->headers->get('content-type'));
        $this->assertStringContainsString('josbin-pos-1.0.0.apk', (string) $res->headers->get('content-disposition'));

        // The Windows download must NOT fall back to the APK.
        $this->withToken($this->token($this->manager))
            ->get('/api/installer/download')
            ->assertStatus(404);
    }

    public function test_download_rejects_unknown_platform(): void
    {
        file_put_contents($this->dir . '/josbin-pos-1.0.0.apk', 'PK-fake-apk');

        $this->withToken($this->token($this->manager))
            ->get('/api/installer/download?platform=linux')
            ->assertStatus(422);
    }

    public function test_download_streams_the_binary(): void
    {
        file_put_contents($this->dir . '/Josbin POS Setup 1.0.0.exe', 'MZ-fake-binary');

        $res = $this->withToken($this->token($this->manager))->get('/api/installer/download');

        $res->assertOk();
        $this->assertStringContainsString('attachment', (string) $res->headers->get('content-disposition'));
        $this->assertStringContainsString('Josbin POS Setup 1.0.0.exe', (string) $res->headers->get('content-disposition'));
    }

    public function test_download_404s_when_nothing_is_deployed(): void
    {
        $this->withToken($this->token($this->manager))
            ->get('/api/installer/download')
            ->assertStatus(404);
    }

    public function test_cashier_cannot_see_or_download_the_installer(): void
    {
        file_put_contents($this->dir . '/Josbin POS Setup 1.0.0.exe', 'MZ-fake-binary');

        $this->withToken($this->token($this->cashier))->getJson('/api/installer')->assertStatus(403);
        $this->withToken($this->token($this->cashier))->get('/api/installer/download')->assertStatus(403);
    }

    public function test_endpoints_require_authentication(): void
    {
        $this->getJson('/api/installer')->assertStatus(401);
        $this->getJson('/api/installer/download')->assertStatus(401);
    }
}
