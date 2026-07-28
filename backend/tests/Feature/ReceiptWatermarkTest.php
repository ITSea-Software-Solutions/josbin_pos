<?php

namespace Tests\Feature;

use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use App\Services\ReceiptService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Watermark printed behind the bill on the HTML / emailed / PDF receipt.
 *
 * Two rules matter more than the picture itself: a store's own image wins
 * over the platform default, and a missing file yields NO watermark rather
 * than a broken image on a document a customer keeps.
 */
class ReceiptWatermarkTest extends TestCase
{
    use RefreshDatabase;

    private Sale $sale;
    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);

        // The base seeder ships no sales — build one the way the till would.
        $this->store  = Store::firstOrFail();
        $cashier      = User::where('store_id', $this->store->id)->firstOrFail();
        $this->sale   = Sale::create([
            'store_id'     => $this->store->id,
            'cashier_id'   => $cashier->id,
            'sale_number'  => Sale::nextNumber($this->store->id),
            'subtotal_srd' => '110.00',
            'discount_srd' => '0.00',
            'btw_srd'      => '10.00',
            'total_srd'    => '110.00',
            'payment_method' => 'cash',
            'status'       => 'completed',
            'source'       => 'pos',
            'occurred_at'  => now(),
        ]);
        SaleItem::create([
            'sale_id'      => $this->sale->id,
            'product_name_snapshot' => 'Brood',
            'unit_price_srd' => '110.00',
            'quantity'     => 1,
            'discount_srd' => '0.00',
            'discount_pct' => '0.00',
            'btw_rate'     => '10',
            'btw_exempt'   => false,
            'btw_srd'      => '10.00',
            'line_total_srd' => '110.00',
        ]);
    }

    private function watermark(): ?string
    {
        return app(ReceiptService::class)
            ->buildViewData($this->sale->fresh(['store']), 'nl')['store']['watermark'];
    }

    public function test_no_watermark_when_the_default_file_is_absent(): void
    {
        config(['josbin_pos.receipt_watermark_default' => 'branding/does-not-exist.png']);

        $this->assertNull($this->watermark(), 'a missing file must not produce a broken image');
    }

    public function test_no_watermark_when_the_default_is_switched_off(): void
    {
        config(['josbin_pos.receipt_watermark_default' => null]);

        $this->assertNull($this->watermark());
    }

    public function test_platform_default_applies_to_a_store_that_set_nothing(): void
    {
        $rel = 'branding/test-watermark.png';
        $abs = public_path($rel);
        @mkdir(dirname($abs), 0775, true);
        file_put_contents($abs, base64_decode(
            // 1×1 transparent PNG
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        ));
        config(['josbin_pos.receipt_watermark_default' => $rel]);

        try {
            $uri = $this->watermark();
            $this->assertNotNull($uri);
            $this->assertStringStartsWith('data:image/png;base64,', $uri, 'must embed — DomPDF runs with remote loading off');
        } finally {
            @unlink($abs);
        }
    }

    public function test_a_stores_own_watermark_beats_the_platform_default(): void
    {
        Storage::fake('public');
        Storage::disk('public')->put('watermarks/mine.png', 'STORE-OWN-BYTES');

        $this->store->forceFill([
            'settings' => array_merge($this->store->settings ?? [], [
                'receipt_watermark_path' => 'watermarks/mine.png',
            ]),
        ])->save();

        $uri = $this->watermark();

        $this->assertNotNull($uri);
        $this->assertStringContainsString(base64_encode('STORE-OWN-BYTES'), $uri);
    }

    public function test_falls_back_to_the_default_when_the_stores_file_went_missing(): void
    {
        Storage::fake('public'); // store points at a file that isn't there

        $this->store->forceFill([
            'settings' => array_merge($this->store->settings ?? [], [
                'receipt_watermark_path' => 'watermarks/deleted.png',
            ]),
        ])->save();

        config(['josbin_pos.receipt_watermark_default' => 'branding/also-missing.png']);

        // Neither exists → no watermark, and crucially no exception on a
        // receipt the customer is waiting for.
        $this->assertNull($this->watermark());
    }

    public function test_the_receipt_renders_the_watermark_behind_the_content(): void
    {
        $rel = 'branding/test-watermark.png';
        $abs = public_path($rel);
        @mkdir(dirname($abs), 0775, true);
        file_put_contents($abs, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        ));
        config(['josbin_pos.receipt_watermark_default' => $rel]);

        try {
            $html = view('receipts.receipt', app(ReceiptService::class)
                ->buildViewData($this->sale->fresh(['store']), 'nl'))->render();

            $this->assertStringContainsString('data:image/png;base64,', $html);
            // Emitted before the bill, so the figures sit on top of it.
            $this->assertLessThan(
                strpos($html, 'class="receipt"'),
                strpos($html, 'position:fixed'),
                'watermark must be emitted before the receipt body',
            );
        } finally {
            @unlink($abs);
        }
    }
}
