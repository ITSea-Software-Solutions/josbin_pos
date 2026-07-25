<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;

/**
 * GET /api/health — unauthenticated, lightweight system health check.
 *
 * Used by:
 * - Docker HEALTHCHECK directive
 * - Uptime monitoring (Laravel Nightwatch, UptimeRobot, etc.)
 * - Electron POS connection indicator
 * - Load balancer / proxy health checks
 *
 * Returns HTTP 200 when all systems are up.
 * Returns HTTP 503 when any critical dependency is down.
 */
class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $checks  = [];
        $healthy = true;

        // ── Database ────────────────────────────────────────────────────────
        try {
            DB::select('SELECT 1');
            $checks['database'] = ['status' => 'ok'];
        } catch (\Throwable $e) {
            $checks['database'] = ['status' => 'error', 'message' => 'DB unreachable'];
            $healthy = false;
        }

        // ── Redis ───────────────────────────────────────────────────────────
        try {
            Redis::ping();
            $checks['redis'] = ['status' => 'ok'];
        } catch (\Throwable $e) {
            $checks['redis'] = ['status' => 'error', 'message' => 'Redis unreachable'];
            $healthy = false;
        }

        // ── Queue workers (Horizon) ─────────────────────────────────────────
        // Horizon stores its status in Redis under a well-known key.
        try {
            $horizonStatus = Cache::store('redis')->get('horizon:status', 'unknown');
            // 'running' = workers active; 'paused' = paused by admin; anything else = problem
            $queueOk = in_array($horizonStatus, ['running', 'paused'], true);
            $checks['queue_workers'] = [
                'status'         => $queueOk ? 'ok' : 'warning',
                'horizon_status' => $horizonStatus,
            ];
            // queue workers down is a warning, not a critical failure
        } catch (\Throwable $e) {
            $checks['queue_workers'] = ['status' => 'warning', 'message' => 'Cannot determine Horizon status'];
        }

        // ── Disk space (warn if <500 MB free on the storage partition) ──────
        try {
            $storagePath = storage_path();
            $freeBytes   = disk_free_space($storagePath);
            $totalBytes  = disk_total_space($storagePath);
            $freeMb      = (int) ($freeBytes / 1024 / 1024);
            $pctFree     = $totalBytes > 0 ? round(($freeBytes / $totalBytes) * 100, 1) : null;

            $diskStatus = $freeMb < 100 ? 'critical' : ($freeMb < 500 ? 'warning' : 'ok');
            if ($diskStatus === 'critical') {
                $healthy = false;
            }

            $checks['disk'] = [
                'status'   => $diskStatus,
                'free_mb'  => $freeMb,
                'free_pct' => $pctFree,
            ];
        } catch (\Throwable $e) {
            $checks['disk'] = ['status' => 'unknown'];
        }

        $status = $healthy ? 200 : 503;

        return response()->json([
            // Stable product identifier — lets the Electron till's LAN
            // "Find my server" sweep recognise a Josbin server by identity
            // instead of guessing from the shape of the response.
            'app'        => 'josbin_pos',
            'status'     => $healthy ? 'ok' : 'degraded',
            'timestamp'  => now()->toIso8601String(),
            'timezone'   => 'America/Paramaribo',
            'app_env'    => config('app.env'),
            'checks'     => $checks,
        ], $status);
    }
}
