<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A single physical Josbin POS installation bound to a license.
 *
 * The installation_key is the per-install token the POS sends on every
 * /api/validate call. The hardware fingerprint binds the activation to a
 * specific machine (MAC + CPU ID + installation UUID).
 */
class LicenseActivation extends Model
{
    use HasUuids;

    protected $fillable = [
        'license_id', 'installation_key',
        'hardware_mac', 'hardware_cpu', 'hardware_uuid', 'hardware_fingerprint',
        'hostname', 'last_ip', 'last_validated_at', 'activated_at', 'is_active',
    ];

    protected $casts = [
        'last_validated_at' => 'datetime',
        'activated_at'      => 'datetime',
        'is_active'         => 'boolean',
    ];

    protected $hidden = ['installation_key'];

    public function license(): BelongsTo
    {
        return $this->belongsTo(License::class);
    }

    /**
     * Deterministic hardware fingerprint from the three identifiers.
     * Returns null when no identifier is supplied.
     */
    public static function fingerprint(?string $mac, ?string $cpu, ?string $uuid): ?string
    {
        $parts = array_filter([$mac, $cpu, $uuid]);

        if (empty($parts)) {
            return null;
        }

        return hash('sha256', strtolower(implode('|', $parts)));
    }

    /** A fresh, opaque per-installation token. */
    public static function newInstallationKey(): string
    {
        return 'inst_'.bin2hex(random_bytes(24));
    }
}
