<?php

namespace App\Http\Controllers\Admin;

use App\Models\License;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;

/**
 * Admin endpoints — used by the Josbin POS developer company to issue,
 * inspect, renew and revoke licenses. Guarded by the admin.key middleware.
 */
class LicenseController extends Controller
{
    private const TIERS = ['basic', 'standard', 'enterprise'];

    /** GET /api/admin/licenses */
    public function index(): JsonResponse
    {
        $licenses = License::query()
            ->withCount(['activations as active_activations' => fn ($q) => $q->where('is_active', true)])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (License $l) => $this->summary($l));

        return response()->json(['data' => $licenses]);
    }

    /** POST /api/admin/licenses — issue a new license. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organisation_name' => ['required', 'string', 'max:255'],
            'contact_email'     => ['nullable', 'email', 'max:255'],
            'tier'              => ['required', Rule::in(self::TIERS)],
            'max_stores'        => ['required', 'integer', 'min:1', 'max:1000'],
            'max_terminals'     => ['required', 'integer', 'min:1', 'max:10000'],
            'valid_from'        => ['required', 'date_format:Y-m-d'],
            'valid_until'       => ['required', 'date_format:Y-m-d', 'after:valid_from'],
            'notes'             => ['nullable', 'string', 'max:2000'],
        ]);

        [$key, $displayPrefix] = $this->generateLicenseKey();

        $license = License::create([
            'license_key_hash'   => License::hashKey($key),
            'license_key_prefix' => $displayPrefix,
            'organisation_name'  => $data['organisation_name'],
            'contact_email'      => $data['contact_email'] ?? null,
            'tier'               => $data['tier'],
            'max_stores'         => $data['max_stores'],
            'max_terminals'      => $data['max_terminals'],
            'valid_from'         => $data['valid_from'],
            'valid_until'        => $data['valid_until'],
            'is_active'          => true,
            'notes'              => $data['notes'] ?? null,
        ]);

        return response()->json([
            'data' => $this->summary($license),
            // The raw key is returned exactly once — it is never stored in plain text.
            'license_key' => $key,
            'message'     => 'License issued. Store the license_key now — it cannot be retrieved again.',
        ], 201);
    }

    /** GET /api/admin/licenses/{license} */
    public function show(License $license): JsonResponse
    {
        $license->load(['activations' => fn ($q) => $q->orderByDesc('activated_at')]);

        return response()->json([
            'data' => array_merge($this->summary($license), [
                'notes'       => $license->notes,
                'activations' => $license->activations->map(fn ($a) => [
                    'id'                => $a->id,
                    'hostname'          => $a->hostname,
                    'hardware_bound'    => $a->hardware_fingerprint !== null,
                    'last_ip'           => $a->last_ip,
                    'last_validated_at' => $a->last_validated_at?->toIso8601String(),
                    'activated_at'      => $a->activated_at?->toIso8601String(),
                    'is_active'         => $a->is_active,
                ]),
            ]),
        ]);
    }

    /** POST /api/admin/licenses/{license}/renew — extend (and reactivate). */
    public function renew(Request $request, License $license): JsonResponse
    {
        $data = $request->validate([
            'valid_until' => ['required', 'date_format:Y-m-d', 'after:today'],
        ]);

        $license->update([
            'valid_until'    => $data['valid_until'],
            'is_active'      => true,
            'revoked_at'     => null,
            'revoked_reason' => null,
        ]);

        return response()->json([
            'data'    => $this->summary($license->fresh()),
            'message' => 'License renewed. The installation reactivates instantly on its next check.',
        ]);
    }

    /** POST /api/admin/licenses/{license}/revoke */
    public function revoke(Request $request, License $license): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $license->update([
            'is_active'      => false,
            'revoked_at'     => now(),
            'revoked_reason' => $data['reason'],
        ]);

        return response()->json([
            'data'    => $this->summary($license->fresh()),
            'message' => 'License revoked. Installations report "invalid" on their next check.',
        ]);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private function summary(License $license): array
    {
        return [
            'id'                 => $license->id,
            'license_key_prefix' => $license->license_key_prefix,
            'organisation_name'  => $license->organisation_name,
            'contact_email'      => $license->contact_email,
            'tier'               => $license->tier,
            'max_stores'         => $license->max_stores,
            'max_terminals'      => $license->max_terminals,
            'active_activations' => $license->active_activations
                ?? $license->activeActivationCount(),
            'valid_from'         => $license->valid_from->toDateString(),
            'valid_until'        => $license->valid_until->toDateString(),
            'is_active'          => $license->is_active,
            'revoked_at'         => $license->revoked_at?->toIso8601String(),
            'revoked_reason'     => $license->revoked_reason,
            'status'             => $license->computeStatus(),
            'created_at'         => $license->created_at?->toIso8601String(),
        ];
    }

    /**
     * Generate a license key formatted PREFIX-XXXX-XXXX-XXXX-XXXX.
     * Returns [plainKey, displayPrefix].
     */
    private function generateLicenseKey(): array
    {
        $prefix   = config('josbin_license.key_prefix', 'JOSBIN');
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
        $groups   = [];

        for ($g = 0; $g < 4; $g++) {
            $segment = '';
            for ($i = 0; $i < 4; $i++) {
                $segment .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $groups[] = $segment;
        }

        $key = $prefix.'-'.implode('-', $groups);

        return [$key, $prefix.'-'.$groups[0]];
    }
}
