<?php

namespace App\Http\Controllers;

use App\Models\License;
use App\Models\LicenseActivation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;

/**
 * Validation endpoint — the Josbin POS installation calls this on startup
 * and every 24 hours. Returns the current renewal status so the POS can
 * show banners, soft-lock or hard-lock as appropriate.
 *
 * A response is always HTTP 200 (even for unknown/invalid licenses) so the
 * POS treats it as an authoritative answer rather than an unreachable-server
 * event that would trigger its 72-hour offline grace.
 */
class ValidationController extends Controller
{
    /** POST /api/validate */
    public function validate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'installation_key' => ['required', 'string', 'max:255'],
            'hostname'         => ['nullable', 'string', 'max:255'],
            'ip'               => ['nullable', 'string', 'max:64'],
            'hardware_mac'     => ['nullable', 'string', 'max:255'],
            'hardware_cpu'     => ['nullable', 'string', 'max:255'],
            'hardware_uuid'    => ['nullable', 'string', 'max:255'],
        ]);

        $ip       = $data['ip'] ?? $request->ip();
        $hostname = $data['hostname'] ?? null;

        $activation = LicenseActivation::with('license')
            ->where('installation_key', $data['installation_key'])
            ->first();

        if (! $activation || ! $activation->license) {
            $this->logValidation(null, null, $data['installation_key'], 'not_found', null, $ip, $hostname);

            return response()->json([
                'status'  => 'not_found',
                'message' => 'Unknown installation key.',
            ]);
        }

        $license = $activation->license;

        // A deactivated terminal binding is treated as invalid.
        $status = $activation->is_active ? $license->computeStatus() : 'invalid';

        // Hardware fingerprint — bind on first sight, verify thereafter.
        $hardwareMatch = $this->reconcileHardware($activation, $data);

        $activation->forceFill([
            'last_validated_at' => now(),
            'last_ip'           => $ip,
            'hostname'          => $hostname ?? $activation->hostname,
        ])->save();

        $this->logValidation(
            $license->id, $activation->id, $data['installation_key'],
            $status, $hardwareMatch, $ip, $hostname
        );

        return response()->json([
            'status'            => $status,
            'tier'              => $license->tier,
            'valid_until'       => $license->valid_until->toDateString(),
            'max_stores'        => $license->max_stores,
            'max_terminals'     => $license->max_terminals,
            'activations_used'  => $license->activeActivationCount(),
            'organisation_name' => $license->organisation_name,
            'hardware_match'    => $hardwareMatch,
            'checked_at'        => now()->toIso8601String(),
        ]);
    }

    /**
     * Bind the hardware fingerprint the first time it is seen, and compare
     * it on every subsequent call. Returns true/false/null (null = the POS
     * sent no hardware identifiers this call).
     */
    private function reconcileHardware(LicenseActivation $activation, array $data): ?bool
    {
        $presented = LicenseActivation::fingerprint(
            $data['hardware_mac']  ?? null,
            $data['hardware_cpu']  ?? null,
            $data['hardware_uuid'] ?? null,
        );

        if ($presented === null) {
            return null;
        }

        if ($activation->hardware_fingerprint === null) {
            $activation->forceFill([
                'hardware_fingerprint' => $presented,
                'hardware_mac'         => $data['hardware_mac']  ?? null,
                'hardware_cpu'         => $data['hardware_cpu']  ?? null,
                'hardware_uuid'        => $data['hardware_uuid'] ?? null,
            ]);

            return true;
        }

        return hash_equals($activation->hardware_fingerprint, $presented);
    }

    private function logValidation(
        ?string $licenseId,
        ?string $activationId,
        string $installationKey,
        string $status,
        ?bool $hardwareMatch,
        ?string $ip,
        ?string $hostname,
    ): void {
        DB::table('license_validations')->insert([
            'license_id'              => $licenseId,
            'activation_id'           => $activationId,
            'installation_key_prefix' => substr($installationKey, 0, 12),
            'status_returned'         => $status,
            'hardware_match'          => $hardwareMatch,
            'ip'                      => $ip,
            'hostname'                => $hostname,
            'created_at'              => now(),
        ]);
    }
}
