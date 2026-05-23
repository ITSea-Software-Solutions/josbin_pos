<?php

namespace App\Http\Controllers;

use App\Models\License;
use App\Models\LicenseActivation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

/**
 * Activation endpoint — called once when a new Josbin POS installation is
 * first set up. It binds the installation's hardware to the license and
 * returns a per-installation key the POS then uses for /api/validate.
 *
 * Re-running activation on the same hardware is idempotent: the existing
 * installation key is returned instead of consuming another terminal slot.
 */
class ActivationController extends Controller
{
    /** POST /api/activate */
    public function activate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'license_key'   => ['required', 'string', 'max:255'],
            'hardware_mac'  => ['nullable', 'string', 'max:255'],
            'hardware_cpu'  => ['nullable', 'string', 'max:255'],
            'hardware_uuid' => ['nullable', 'string', 'max:255'],
            'hostname'      => ['nullable', 'string', 'max:255'],
        ]);

        $license = License::findByKey($data['license_key']);

        if (! $license) {
            return response()->json([
                'error'   => 'NotFound',
                'message' => 'No license matches that key.',
            ], 404);
        }

        if (! $license->is_active || $license->revoked_at !== null) {
            return response()->json([
                'error'   => 'LicenseRevoked',
                'message' => 'This license has been revoked. Contact Josbin POS.',
            ], 403);
        }

        $fingerprint = LicenseActivation::fingerprint(
            $data['hardware_mac']  ?? null,
            $data['hardware_cpu']  ?? null,
            $data['hardware_uuid'] ?? null,
        );

        // Idempotent: same hardware re-activating gets its existing key back.
        if ($fingerprint !== null) {
            $existing = $license->activations()
                ->where('hardware_fingerprint', $fingerprint)
                ->where('is_active', true)
                ->first();

            if ($existing) {
                return response()->json($this->payload($license, $existing), 200);
            }
        }

        // Enforce the licensed terminal count.
        if ($license->terminalLimitReached()) {
            return response()->json([
                'error'   => 'LicenseLimitReached',
                'message' => "License limit reached — this license permits {$license->max_terminals} terminal(s). Contact Josbin POS to upgrade.",
            ], 403);
        }

        $activation = $license->activations()->create([
            'installation_key'     => LicenseActivation::newInstallationKey(),
            'hardware_mac'         => $data['hardware_mac']  ?? null,
            'hardware_cpu'         => $data['hardware_cpu']  ?? null,
            'hardware_uuid'        => $data['hardware_uuid'] ?? null,
            'hardware_fingerprint' => $fingerprint,
            'hostname'             => $data['hostname'] ?? null,
            'last_ip'              => $request->ip(),
            'activated_at'         => now(),
            'is_active'            => true,
        ]);

        return response()->json($this->payload($license, $activation), 201);
    }

    private function payload(License $license, LicenseActivation $activation): array
    {
        return [
            'installation_key'  => $activation->installation_key,
            'status'            => $license->computeStatus(),
            'tier'              => $license->tier,
            'valid_until'       => $license->valid_until->toDateString(),
            'max_stores'        => $license->max_stores,
            'max_terminals'     => $license->max_terminals,
            'activations_used'  => $license->activeActivationCount(),
            'organisation_name' => $license->organisation_name,
        ];
    }
}
