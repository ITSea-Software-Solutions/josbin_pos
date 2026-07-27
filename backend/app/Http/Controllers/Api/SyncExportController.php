<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * USB Encrypted Sync Export — Layer 4 of the five-layer offline fallback.
 *
 * Generates an AES-256-CBC encrypted .josbin_pos file containing all sales
 * data for a date range, signed with HMAC-SHA256.
 *
 * The file can be:
 *   a) Saved to a USB drive or sent via WhatsApp/email
 *   b) Uploaded via the Super Admin Dashboard (POST /api/sync/import)
 *      which imports it exactly as if the data had synced normally.
 *
 * Encryption key: HMAC-SHA256(store_id + app_key + date)
 * so the key is deterministic and the dashboard can re-derive it on import.
 */
class SyncExportController extends Controller
{
    private const CIPHER = 'AES-256-CBC';
    private const VERSION = '1.0';

    /**
     * GET /api/sync/export
     *
     * Query params:
     *   store_id  — required
     *   from_date — YYYY-MM-DD (default: today)
     *   to_date   — YYYY-MM-DD (default: today)
     *   include_synced — bool (default: false — only unsynced)
     *
     * Returns: streamed binary download of the .josbin_pos file
     */
    public function export(Request $request): Response
    {
        $request->validate([
            'store_id'  => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
            'from_date' => ['nullable', 'date_format:Y-m-d'],
            'to_date'   => ['nullable', 'date_format:Y-m-d'],
        ]);

        $storeId  = $request->input('store_id');
        $fromDate = $request->input('from_date', now()->toDateString());
        $toDate   = $request->input('to_date', now()->toDateString());

        $store = Store::findOrFail($storeId);
        $this->authorize('view', $store);

        // USB/WhatsApp export covers offline DAYS, not archives: cap the
        // range so a mistyped year can't build a multi-hundred-MB payload
        // in memory. A store offline longer than this exports in parts —
        // the import side is idempotent, so parts are safe.
        abort_if(
            \Carbon\Carbon::parse($fromDate)->diffInDays(\Carbon\Carbon::parse($toDate)) > 92,
            422,
            __('errors.export_range_too_large')
        );

        // Load sales with items
        $sales = Sale::query()
            ->with(['items', 'cashier:id,name,email', 'customer:id,name'])
            ->where('store_id', $storeId)
            ->where('status', '!=', 'held')
            ->whereBetween(DB::raw("DATE(occurred_at AT TIME ZONE 'America/Paramaribo')"), [$fromDate, $toDate])
            ->orderBy('occurred_at')
            ->get();

        $payload = [
            'version'          => self::VERSION,
            'format'           => 'josbin_pos-sync',
            'generated_at'     => now()->toIso8601String(),
            'exported_by'      => $request->user()->email,
            'organisation_id'  => $store->organisation_id,
            'store_id'         => $storeId,
            'store_name'       => $store->name,
            'period'           => ['from' => $fromDate, 'to' => $toDate],
            'record_count'     => $sales->count(),
            'total_srd'        => $sales->sum('total_srd'),
            'total_btw_srd'    => $sales->sum('btw_srd'),
            'sales'            => $sales->toArray(),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        // HMAC checksum of the plain JSON (stored in footer)
        $hmac = hash_hmac('sha256', $json, $this->deriveKey($storeId));

        $envelope = json_encode([
            'hmac'    => $hmac,
            'cipher'  => self::CIPHER,
            'version' => self::VERSION,
            'data'    => $this->encrypt($json, $storeId),
        ]);

        $filename = sprintf(
            'josbin_pos_%s_%s_%s.josbin_pos',
            preg_replace('/[^a-z0-9]/i', '_', $store->name),
            $fromDate,
            $toDate,
        );

        return response($envelope, 200, [
            'Content-Type'        => 'application/octet-stream',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Content-Length'      => strlen($envelope),
            'X-JosbinPOS-Store'     => $storeId,
            'X-JosbinPOS-From'      => $fromDate,
            'X-JosbinPOS-To'        => $toDate,
            'X-JosbinPOS-Records'   => $sales->count(),
        ]);
    }

    /**
     * POST /api/sync/import
     * Super Admin Dashboard uploads a .josbin_pos file for manual import.
     *
     * Returns: { imported: N, skipped: N, errors: [] }
     */
    public function import(Request $request): JsonResponse
    {
        $this->authorize('create', Sale::class);

        $request->validate([
            'file' => ['required', 'file', 'max:51200'], // max 50MB
        ]);

        $content = file_get_contents($request->file('file')->getRealPath());

        $envelope = json_decode($content, true);
        if (! $envelope || ! isset($envelope['data'], $envelope['hmac'], $envelope['cipher'])) {
            return response()->json(['message' => 'Invalid .josbin_pos file format.'], 422);
        }

        if ($envelope['cipher'] !== self::CIPHER) {
            return response()->json(['message' => 'Unsupported cipher: ' . $envelope['cipher']], 422);
        }

        // We need the store_id to derive the decryption key — it's in the outer envelope
        // For the dashboard import we attempt with available store keys
        // The store_id should be provided as a form field for key derivation
        $request->validate(['store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg]]);
        $storeId = $request->input('store_id');

        // Decrypt
        try {
            $json = $this->decrypt($envelope['data'], $storeId);
        } catch (\Throwable) {
            return response()->json(['message' => 'Decryption failed. Wrong store or corrupted file.'], 422);
        }

        // Verify HMAC
        $expectedHmac = hash_hmac('sha256', $json, $this->deriveKey($storeId));
        if (! hash_equals($expectedHmac, $envelope['hmac'])) {
            return response()->json(['message' => 'File integrity check failed. The file may have been tampered with.'], 422);
        }

        $payload = json_decode($json, true);
        if (! $payload || ! isset($payload['sales'])) {
            return response()->json(['message' => 'Invalid payload structure.'], 422);
        }

        // Import sales — skip duplicates by sale_number
        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        DB::beginTransaction();
        try {
            foreach ($payload['sales'] as $saleData) {
                // Skip if already exists (idempotent)
                if (Sale::where('id', $saleData['id'])->exists()) {
                    $skipped++;
                    continue;
                }

                try {
                    // forceFill so the original id and created_at are preserved
                    // — they are not in $fillable, and preserving the id is what
                    // makes the duplicate guard above (and re-imports) idempotent.
                    $sale = (new Sale)->forceFill([
                        'id'                => $saleData['id'],
                        'store_id'          => $saleData['store_id'],
                        'cashier_id'        => $saleData['cashier_id'],
                        'customer_id'       => $saleData['customer_id'] ?? null,
                        'sale_number'       => $saleData['sale_number'],
                        'subtotal_srd'      => $saleData['subtotal_srd'],
                        'discount_srd'      => $saleData['discount_srd'],
                        'btw_srd'           => $saleData['btw_srd'],
                        'total_srd'         => $saleData['total_srd'],
                        'payment_method'    => $saleData['payment_method'],
                        'cash_received_srd' => $saleData['cash_received_srd'] ?? null,
                        'change_srd'        => $saleData['change_srd'] ?? null,
                        'card_amount_srd'   => $saleData['card_amount_srd'] ?? null,
                        'status'            => $saleData['status'],
                        'source'            => 'import',
                        'exchange_rate_used'=> $saleData['exchange_rate_used'] ?? null,
                        'occurred_at'       => $saleData['occurred_at'],
                        'created_at'        => $saleData['created_at'],
                        'updated_at'        => now(),
                    ]);
                    $sale->save();

                    foreach ($saleData['items'] ?? [] as $item) {
                        (new SaleItem)->forceFill([
                            'id'                    => $item['id'],
                            'sale_id'               => $sale->id,
                            'product_id'            => $item['product_id'] ?? null,
                            'product_name_snapshot' => $item['product_name_snapshot'] ?? '',
                            'unit_price_srd'        => $item['unit_price_srd'],
                            'quantity'              => $item['quantity'],
                            'discount_srd'          => $item['discount_srd'] ?? '0.00',
                            'discount_pct'          => $item['discount_pct'] ?? '0.00',
                            'btw_rate'              => $item['btw_rate'],
                            'btw_srd'               => $item['btw_srd'],
                            'line_total_srd'        => $item['line_total_srd'],
                        ])->save();
                    }

                    $imported++;
                } catch (\Throwable $e) {
                    $errors[] = "Sale {$saleData['sale_number']}: " . $e->getMessage();
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'imported' => $imported,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'period'   => $payload['period'] ?? null,
            'store'    => $payload['store_name'] ?? null,
        ]);
    }

    // ─── Crypto helpers ───────────────────────────────────────────────────────

    private function deriveKey(string $storeId): string
    {
        // Deterministic key: HMAC of store_id using the application key
        // The same key can be re-derived on import in the dashboard
        return hash_hmac('sha256', $storeId, config('app.key'));
    }

    private function encrypt(string $data, string $storeId): string
    {
        $key  = hex2bin($this->deriveKey($storeId));
        $iv   = random_bytes(openssl_cipher_iv_length(self::CIPHER));
        $encrypted = openssl_encrypt($data, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);

        return base64_encode($iv . $encrypted);
    }

    private function decrypt(string $data, string $storeId): string
    {
        $key    = hex2bin($this->deriveKey($storeId));
        $binary = base64_decode($data);
        $ivLen  = openssl_cipher_iv_length(self::CIPHER);
        $iv     = substr($binary, 0, $ivLen);
        $ciphertext = substr($binary, $ivLen);

        $decrypted = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($decrypted === false) {
            throw new \RuntimeException('Decryption failed');
        }

        return $decrypted;
    }
}
