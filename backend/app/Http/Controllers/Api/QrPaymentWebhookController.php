<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Scaffolding for QR / mobile-wallet PSP webhooks (Phase 3, task #79).
 *
 * Right now there is no Surinamese QR/wallet standard with a public webhook
 * spec. This controller is a placeholder that documents the contract we'd
 * implement when a partner (a future DSB Mobiel API, a Surichange QR service,
 * etc.) ships one. Routes are gated behind a feature flag in config so we can
 * enable them per-deployment when a real PSP integration is signed.
 *
 * Expected webhook payload (POST /api/qr-payments/webhook):
 * ```
 * {
 *   "psp": "DSB_QR",                  // matches Sale.payment_provider
 *   "reference": "QR-2026-05-26-001", // matches Sale.payment_reference
 *   "status": "succeeded",            // succeeded | failed | refunded
 *   "amount_srd": "110.00",
 *   "external_id": "psp-tx-9988",
 *   "occurred_at": "2026-05-26T17:30:00Z"
 * }
 * ```
 *
 * Headers expected when the partner is live:
 *   X-PSP-Signature: sha256=...        HMAC of the body (shared secret)
 *   X-PSP-Timestamp: 2026-05-26T17:30:00Z
 *
 * Current behaviour: returns 503 unless `josbin_pos.qr_webhooks_enabled` is true
 * in config, so a misrouted external POST can't accidentally flip a sale state.
 */
class QrPaymentWebhookController extends Controller
{
    /** POST /api/qr-payments/webhook  (public — auth is via HMAC signature) */
    public function handle(Request $request): JsonResponse
    {
        if (! config('josbin_pos.qr_webhooks_enabled', false)) {
            return response()->json([
                'message' => 'QR webhook endpoint is reserved for future PSP integrations; not enabled on this deployment.',
                'code'    => 'QR_WEBHOOKS_DISABLED',
            ], 503);
        }

        // TODO when a real PSP is wired:
        //   1. Verify X-PSP-Signature using the partner's shared secret
        //   2. Validate $request->json() against the schema above
        //   3. Look up Sale by (payment_provider, payment_reference)
        //   4. On 'succeeded' → set payment_confirmed_at + payment_confirmed_by
        //      (use a dedicated system user, NOT a human OA)
        //   5. On 'failed' → leave pending and write an audit entry so OA sees it
        //   6. Write audit_logs row: event = 'sale.qr_webhook_received'
        //   7. Return 200 ASAP — PSP will retry on timeout
        $payload = $request->json()->all();

        // Stub: just acknowledge the shape exists. No state change.
        return response()->json([
            'received' => true,
            'message'  => 'Stub handler — no PSP integration wired yet.',
            'echo'     => array_intersect_key($payload, array_flip(['psp', 'reference', 'status', 'amount_srd'])),
        ], 202);
    }
}
