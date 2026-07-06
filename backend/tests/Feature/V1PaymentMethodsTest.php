<?php

namespace Tests\Feature;

use App\Models\ApiIntegration;
use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Sale;
use App\Models\Store;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * Layer-3 (Open Integration API) accepts the full Suriname payment-method
 * list — not just cash/card/mixed — so third-party POS systems report the
 * same breakdown the native POS produces and BTW/Z-reports stay comparable
 * across sources. Pending-type methods (transfers, QR wallets) arrive
 * pre-confirmed: the external system already completed the payment at its
 * own till, and the OA has no way to verify someone else's transfers.
 */
class V1PaymentMethodsTest extends TestCase
{
    use RefreshDatabase;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'Ext Org', 'type' => 'retail', 'btw_number' => 'SR-EXT',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $org->id, 'name' => 'Ext-Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'external',
        ]);
        ApiIntegration::create([
            'store_id'     => $this->store->id,
            'pos_system'   => 'ExtVendorPOS',
            'api_key_hash' => hash('sha256', 'ext-key-1'),
            'is_active'    => true,
        ]);
        DailyRate::firstOrCreate(
            ['date' => Carbon::now('America/Paramaribo')->toDateString()],
            ['usd_to_srd' => '37.50', 'raw_rate' => '37.50', 'markup_pct' => 0, 'source' => 'manual', 'locked_at' => now()],
        );
    }

    private function payload(string $ref, array $extra = []): array
    {
        return array_merge([
            'sale_ref'       => $ref,
            'occurred_at'    => Carbon::now('America/Paramaribo')->toIso8601String(),
            'payment_method' => 'cash',
            'items'          => [
                ['product_name' => 'Rijst 1kg', 'unit_price' => 25.00, 'quantity' => 2, 'btw_rate' => 10],
            ],
        ], $extra);
    }

    public function test_v1_accepts_qr_payment_with_wallet_provider(): void
    {
        $resp = $this->withHeader('X-API-Key', 'ext-key-1')->postJson('/api/v1/sales', $this->payload('QR-REF-1', [
            'payment_method'    => 'qr_payment',
            'payment_provider'  => 'Mopé',
            'payment_reference' => 'MP-777',
        ]));
        $resp->assertCreated();

        $sale = Sale::where('external_sale_ref', 'QR-REF-1')->firstOrFail();
        $this->assertSame('qr_payment', $sale->payment_method);
        $this->assertSame('Mopé', $sale->payment_provider);
        $this->assertSame('MP-777', $sale->payment_reference);
        // API-sourced pending-type methods arrive pre-confirmed — they must
        // not clutter the OA confirmation queue.
        $this->assertNotNull($sale->payment_confirmed_at);
        $this->assertFalse($sale->isAwaitingPaymentConfirmation());
    }

    public function test_v1_accepts_bank_transfer_pre_confirmed(): void
    {
        $resp = $this->withHeader('X-API-Key', 'ext-key-1')->postJson('/api/v1/sales', $this->payload('BT-REF-1', [
            'payment_method'    => 'bank_transfer',
            'payment_provider'  => 'DSB',
            'payment_reference' => 'OVB-123',
        ]));
        $resp->assertCreated();

        $sale = Sale::where('external_sale_ref', 'BT-REF-1')->firstOrFail();
        $this->assertSame('DSB', $sale->payment_provider);
        $this->assertNotNull($sale->payment_confirmed_at);
    }

    public function test_v1_persists_foreign_cash_details_with_locked_rate(): void
    {
        $resp = $this->withHeader('X-API-Key', 'ext-key-1')->postJson('/api/v1/sales', $this->payload('FC-REF-1', [
            'payment_method'   => 'foreign_cash',
            'foreign_currency' => 'USD',
            'foreign_amount'   => 2.00,
        ]));
        $resp->assertCreated();

        $sale = Sale::where('external_sale_ref', 'FC-REF-1')->firstOrFail();
        $this->assertSame('USD', $sale->foreign_currency);
        $this->assertSame('37.5000', (string) $sale->foreign_rate_used);
        // foreign_cash is not a pending-type method — no confirmation stamp.
        $this->assertNull($sale->payment_confirmed_at);
    }

    public function test_v1_provider_fields_are_nulled_for_cash(): void
    {
        $resp = $this->withHeader('X-API-Key', 'ext-key-1')->postJson('/api/v1/sales', $this->payload('CASH-REF-1', [
            // Forgiving-fields contract: irrelevant fields silently dropped.
            'payment_provider'  => 'ShouldBeIgnored',
            'payment_reference' => 'ALSO-IGNORED',
        ]));
        $resp->assertCreated();

        $sale = Sale::where('external_sale_ref', 'CASH-REF-1')->firstOrFail();
        $this->assertNull($sale->payment_provider);
        $this->assertNull($sale->payment_reference);
        $this->assertNull($sale->payment_confirmed_at);
    }

    public function test_v1_rejects_unknown_payment_method(): void
    {
        $resp = $this->withHeader('X-API-Key', 'ext-key-1')->postJson('/api/v1/sales', $this->payload('BAD-REF-1', [
            'payment_method' => 'crypto',
        ]));
        $resp->assertStatus(422);
        $resp->assertJsonValidationErrors(['payment_method']);
    }
}
