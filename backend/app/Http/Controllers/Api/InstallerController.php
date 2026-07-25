<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves the POS installers (Windows .exe + Android .apk) from the server the
 * dashboard runs on.
 *
 * Why here and not a static file on the docs site: on a real store install the
 * back-office server IS the only thing reachable when the shop has no internet.
 * A manager adding a fourth till on a Tuesday morning should be able to open
 * the dashboard on the shop LAN, download the installer, and be selling — with
 * the internet cable unplugged the whole time.
 *
 * The file is NOT a secret (the licence is what gates usage, not the binary),
 * but the endpoint is authenticated + manager-gated so the client's dashboard
 * stays coherent and downloads leave an audit trail.
 */
class InstallerController extends Controller
{
    /**
     * GET /api/installer
     *
     * Metadata so the dashboard can render — or gracefully hide — the download
     * card. Never 404s: "no installer deployed on this server" is a normal
     * state (e.g. the cloud demo box), not an error.
     */
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $exe = $this->resolveInstaller('exe');
        $apk = $this->resolveInstaller('apk');

        if (! $exe && ! $apk) {
            return response()->json([
                'available' => false,
                'reason'    => 'not_deployed',
                // Tell the operator where the file is expected, so a
                // half-finished install is self-diagnosing.
                'expected_dir' => config('josbin_pos.installer_dir'),
            ]);
        }

        // Flat fields describe the Windows exe (the original contract);
        // 'android' is the APK for Android terminals (Posiflex RT etc.).
        return response()->json([
            'available' => true,
            ...($exe ? $this->describe($exe) : []),
            'android'   => $apk ? $this->describe($apk) : null,
        ]);
    }

    /** @return array{filename: string, size_bytes: int, updated_at: string, version: ?string} */
    private function describe(string $file): array
    {
        return [
            'filename'   => basename($file),
            'size_bytes' => filesize($file) ?: 0,
            'updated_at' => date(DATE_ATOM, filemtime($file) ?: time()),
            'version'    => $this->versionFromName(basename($file)),
        ];
    }

    /**
     * GET /api/installer/download?platform=windows|android
     *
     * Streams the binary. Range requests are supported by the response class,
     * which matters on a shaky 4G link in the interior — a dropped download
     * resumes instead of restarting 100+ MB. The APK gets its real MIME type
     * so Chrome on an Android terminal offers to install it directly.
     */
    public function download(Request $request): BinaryFileResponse
    {
        abort_unless($request->user()->isAtLeastManager(), 403);

        $platform = $request->query('platform', 'windows');
        abort_unless(in_array($platform, ['windows', 'android'], true), 422);

        $file = $this->resolveInstaller($platform === 'android' ? 'apk' : 'exe');
        abort_if(! $file, 404, __('errors.installer_not_deployed'));

        return response()->download($file, basename($file), [
            'Content-Type' => $platform === 'android'
                ? 'application/vnd.android.package-archive'
                : 'application/octet-stream',
        ]);
    }

    /**
     * Newest file of the given type in the configured directory. Newest-wins
     * means dropping an updated build in the folder is the whole "release"
     * procedure — no config edit, no restart.
     */
    private function resolveInstaller(string $ext): ?string
    {
        $dir = config('josbin_pos.installer_dir');

        if (! $dir || ! is_dir($dir)) {
            return null;
        }

        $candidates = glob(rtrim($dir, '/') . '/*.' . $ext) ?: [];
        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn ($a, $b) => (filemtime($b) ?: 0) <=> (filemtime($a) ?: 0));

        $newest = $candidates[0];

        // Defence in depth: never serve anything that resolved outside the
        // configured directory (symlink / traversal paranoia).
        $real    = realpath($newest);
        $realDir = realpath($dir);

        return ($real && $realDir && str_starts_with($real, $realDir)) ? $real : null;
    }

    /** "Josbin POS Setup 1.0.0.exe" → "1.0.0"; null when the name has no version. */
    private function versionFromName(string $name): ?string
    {
        return preg_match('/(\d+\.\d+\.\d+)/', $name, $m) ? $m[1] : null;
    }
}
