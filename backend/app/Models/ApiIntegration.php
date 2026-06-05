<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiIntegration extends Model
{
    use HasUuids;

    protected $fillable = [
        'store_id', 'pos_system', 'api_key_hash',
        'webhook_url', 'webhook_events', 'webhook_secret',
        'last_ping_at', 'is_active', 'settings',
    ];

    protected $casts = [
        'webhook_events' => 'array',
        'settings'       => 'array',
        'is_active'      => 'boolean',
        'last_ping_at'   => 'datetime',
        // Encrypted at rest — a DB read / backup theft would otherwise expose
        // every integrator's HMAC signing secret, enabling forged webhook
        // deliveries. Transparently decrypts on access (DispatchWebhook signs
        // with it). Existing plaintext rows migrated by
        // 2026_06_05_000001_encrypt_webhook_secrets.
        'webhook_secret' => 'encrypted',
    ];

    // Never expose secrets in API responses
    protected $hidden = ['api_key_hash', 'webhook_secret'];

    /**
     * Generate and persist a fresh webhook_secret for this integration.
     * Call when creating a new integration or rotating the secret.
     */
    public function rotateWebhookSecret(): string
    {
        $secret = bin2hex(random_bytes(32));
        $this->forceFill(['webhook_secret' => $secret])->save();
        return $secret;
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
