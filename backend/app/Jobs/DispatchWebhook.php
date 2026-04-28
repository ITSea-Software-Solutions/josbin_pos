<?php

namespace App\Jobs;

use App\Models\ApiIntegration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DispatchWebhook
 *
 * Sends an outbound webhook to all active API integrations in an org
 * that are subscribed to the given event.
 *
 * Retry schedule: 1 min → 5 min → 30 min → 2 hrs (4 attempts total).
 * Logged in webhook_delivery_log (failed deliveries visible in Horizon).
 */
class DispatchWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 4;
    public array $backoff = [60, 300, 1800, 7200];

    public function __construct(
        private readonly string $integrationId,
        private readonly string $event,
        private readonly array  $payload,
    ) {}

    /**
     * Convenience: find all active integrations in an org subscribed to $event
     * and dispatch a job for each.
     */
    public static function dispatchIfActive(string $orgId, string $event, array $payload): void
    {
        ApiIntegration::whereHas('store', fn ($q) => $q->where('organisation_id', $orgId))
            ->where('is_active', true)
            ->whereNotNull('webhook_url')
            ->get()
            ->each(function (ApiIntegration $integration) use ($event, $payload) {
                $events = $integration->webhook_events ?? [];
                if (in_array($event, $events) || in_array('*', $events)) {
                    static::dispatch($integration->id, $event, $payload);
                }
            });
    }

    public function handle(): void
    {
        $integration = ApiIntegration::find($this->integrationId);
        if (! $integration || ! $integration->is_active || ! $integration->webhook_url) {
            return;
        }

        // Ensure a secret exists — auto-generate if missing (e.g. legacy rows)
        if (! $integration->webhook_secret) {
            $integration->rotateWebhookSecret();
        }

        $body = [
            'event'       => $this->event,
            'store_id'    => $integration->store_id,
            'occurred_at' => now()->toIso8601String(),
            'data'        => $this->payload,
        ];

        $encodedBody = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // HMAC-SHA256 signature — receivers verify with:
        //   hash_hmac('sha256', $rawBody, $webhookSecret) === ltrim($sig, 'sha256=')
        $signature = 'sha256=' . hash_hmac('sha256', $encodedBody, $integration->webhook_secret);

        $response = Http::timeout(10)
            ->withHeaders([
                'Content-Type'           => 'application/json',
                'X-JosbinPOS-Event'        => $this->event,
                'X-JosbinPOS-Signature'    => $signature,
                'X-JosbinPOS-Delivery'     => (string) $this->job?->getJobId(),
            ])
            ->withBody($encodedBody, 'application/json')
            ->post($integration->webhook_url);

        if (! $response->successful()) {
            Log::warning('Webhook delivery failed', [
                'integration_id' => $this->integrationId,
                'event'          => $this->event,
                'url'            => $integration->webhook_url,
                'status'         => $response->status(),
                'attempt'        => $this->attempts(),
                'body'           => substr($response->body(), 0, 500),
            ]);

            $this->release($this->backoff[$this->attempts() - 1] ?? 7200);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Webhook delivery permanently failed', [
            'integration_id' => $this->integrationId,
            'event'          => $this->event,
            'error'          => $exception->getMessage(),
        ]);
    }
}
