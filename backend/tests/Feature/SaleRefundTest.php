<?php

namespace Tests\Feature;

use App\Models\DailyRate;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * POST /api/sales/{sale}/refund
 *
 * A refund is implemented as a NEW Sale row with negative totals/BTW and
 * negative item quantities, linked back to the original via void_reason
 * ("REFUND: <reason>"). Only manager+ can issue refunds (sales.refund
 * permission). Cross-org access is blocked by SalePolicy::refund() —
 * Laravel returns 404 (model not found) for /sales/{uuid} when policy
 * denies AND the route-model binding finds the sale (then 403). With
 * Sanctum + UUID route model binding, the framework returns 403 for
 * authorize() failures; we assert that below.
 */
class SaleRefundTest extends TestCase
{
    use RefreshDatabase;

    private User $cashier;
    private User $manager;
    private Store $store;
    private Organisation $org;
    private Product $cola;
    private Sale $originalSale;

    protected function setUp(): void
    {
        parent::setUp();

        Event::fake();
        Bus::fake();

        $this->seed(DatabaseSeeder::class);

        $this->cashier = User::where('email', 'kassa@dehoop.sr')->firstOrFail();
        $this->manager = User::where('email', 'manager@dehoop.sr')->firstOrFail();
        $this->org     = Organisation::where('name', 'Supermarkt De Hoop')->firstOrFail();
        $this->store   = Store::where('organisation_id', $this->org->id)->firstOrFail();
        $this->cola    = Product::where('organisation_id', $this->org->id)
            ->where('btw_exempt', false)->orderBy('name_nl')->firstOrFail();

        DailyRate::create([
            'date'        => today()->toDateString(),
            'usd_to_srd'  => '38.5000',
            'raw_rate'    => '37.5000',
            'markup_pct'  => '2.50',
            'source'      => 'manual',
            'locked_by'   => $this->manager->id,
            'locked_at'   => now(),
        ]);

        // Build the original sale: 2× Cola @ 11.00 = 22.00, BTW 2.00
        $this->originalSale = Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->cashier->id,
            'sale_number'        => Sale::nextNumber($this->store->id),
            'subtotal_srd'       => '22.00',
            'discount_srd'       => '0.00',
            'btw_srd'            => '2.00',
            'total_srd'          => '22.00',
            'payment_method'     => 'cash',
            'cash_received_srd'  => '22.00',
            'change_srd'         => '0.00',
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => now(),
        ]);

        SaleItem::create([
            'sale_id'               => $this->originalSale->id,
            'product_id'            => $this->cola->id,
            'product_name_snapshot' => $this->cola->name_nl,
            'unit_price_srd'        => '11.00',
            'quantity'              => '2.000',
            'discount_srd'          => '0.00',
            'discount_pct'          => '0.00',
            'btw_rate'              => '10.00',
            'btw_exempt'            => false,
            'btw_srd'               => '2.00',
            'line_total_srd'        => '22.00',
        ]);
    }

    // ─── Happy path: manager refunds full quantity ───────────────────────────

    public function test_manager_can_refund_full_sale_creating_negative_sale_row(): void
    {
        $originalItem = $this->originalSale->items()->first();

        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/sales/{$this->originalSale->id}/refund", [
                'reason' => 'Klant retourneerde het product wegens defect.',
                'items'  => [[
                    'sale_item_id' => $originalItem->id,
                    'quantity'     => 2,
                ]],
            ]);

        $response->assertStatus(201);

        // A NEW sale row exists with negative totals & BTW
        $this->assertDatabaseCount('sales', 2);

        $refundSale = Sale::where('id', '!=', $this->originalSale->id)->firstOrFail();
        $this->assertSame('-22.00', (string) $refundSale->total_srd);
        $this->assertSame('-22.00', (string) $refundSale->subtotal_srd);
        $this->assertSame('-2.00',  (string) $refundSale->btw_srd);
        $this->assertSame('completed', $refundSale->status);
        $this->assertStringStartsWith('REFUND:', $refundSale->void_reason);

        // Refund item has negative quantity, negative line_total, negative btw
        $refundItem = $refundSale->items()->first();
        $this->assertNotNull($refundItem);
        $this->assertSame('-2.000', (string) $refundItem->quantity);
        $this->assertSame('-22.00', (string) $refundItem->line_total_srd);
        $this->assertSame('-2.00',  (string) $refundItem->btw_srd);
    }

    public function test_partial_refund_negates_only_refunded_quantity(): void
    {
        $originalItem = $this->originalSale->items()->first();

        // Refund 1 of 2 units
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/sales/{$this->originalSale->id}/refund", [
                'reason' => 'Eén stuk teruggebracht — andere blijft verkocht.',
                'items'  => [[
                    'sale_item_id' => $originalItem->id,
                    'quantity'     => 1,
                ]],
            ]);

        $response->assertStatus(201);

        $refundSale = Sale::where('id', '!=', $this->originalSale->id)->firstOrFail();
        $this->assertSame('-11.00', (string) $refundSale->total_srd);
        $this->assertSame('-1.00',  (string) $refundSale->btw_srd);
    }

    // ─── 403 for cashier (manager+ only) ─────────────────────────────────────

    /**
     * P1-D3: refund legs must carry the original discounts (prorated), or
     * discount/BTW reports double-count after refunds. Original here:
     * 2 units, line discount 4.00, sale-level discount 6.00 on a 40.00
     * gross → items stored net. Refunding 1 of 2 units must produce a
     * refund item with discount_srd = -2.00 (half the line discount), a
     * header discount of -3.00 (half the sale-level discount), and the
     * subtotal − discount = total identity on the refund row.
     */
    public function test_refund_carries_prorated_discounts_for_report_netting(): void
    {
        // line: 2 × 20.00 = 40.00 gross, line discount 4.00 → 36.00;
        // stored line_total additionally nets the distributed sale
        // discount (6.00) → 30.00. BTW 10% inclusive on the net.
        $discounted = Sale::create([
            'store_id'           => $this->store->id,
            'cashier_id'         => $this->cashier->id,
            'sale_number'        => Sale::nextNumber($this->store->id),
            'subtotal_srd'       => '36.00',
            'discount_srd'       => '6.00',
            'btw_srd'            => '2.73',
            'total_srd'          => '30.00',
            'payment_method'     => 'cash',
            'cash_received_srd'  => '30.00',
            'change_srd'         => '0.00',
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => now(),
        ]);
        $discountedItem = SaleItem::create([
            'sale_id'               => $discounted->id,
            'product_id'            => $this->cola->id,
            'product_name_snapshot' => $this->cola->name_nl,
            'unit_price_srd'        => '20.00',
            'quantity'              => '2.000',
            'discount_srd'          => '10.00',
            'discount_pct'          => '0.00',
            'btw_rate'              => '10.00',
            'btw_exempt'            => false,
            'btw_srd'               => '2.73',
            'line_total_srd'        => '30.00',
        ]);

        $res = $this->withToken($this->manager->createToken('t')->plainTextToken)
            ->postJson("/api/sales/{$discounted->id}/refund", [
                'reason' => 'Klant retourneerde één stuk',
                'items'  => [[
                    'sale_item_id' => $discountedItem->id,
                    'quantity'     => '1.000',
                ]],
            ]);

        $res->assertStatus(201);
        $refund = Sale::findOrFail($res->json('data.id'));
        $refundItem = $refund->items->first();

        // Item leg: half the stored item discount (10.00 → 5.00), negative.
        $this->assertSame('-5.00', (string) $refundItem->discount_srd);
        $this->assertSame('-15.00', (string) $refundItem->line_total_srd);

        // Header: money refunded is half the paid total…
        $this->assertSame('-15.00', (string) $refund->total_srd);
        // …the sale-level discount is prorated (6.00 × 15/30 = 3.00)…
        $this->assertSame('-3.00', (string) $refund->discount_srd);
        // …and subtotal − discount = total holds on the refund row:
        // -18.00 − (-3.00) = -15.00.
        $this->assertSame('-18.00', (string) $refund->subtotal_srd);
        $this->assertSame(
            (string) $refund->total_srd,
            bcsub((string) $refund->subtotal_srd, (string) $refund->discount_srd, 2),
        );
    }

    public function test_cashier_cannot_refund_a_sale(): void
    {
        $originalItem = $this->originalSale->items()->first();

        $response = $this->actingAs($this->cashier, 'sanctum')
            ->postJson("/api/sales/{$this->originalSale->id}/refund", [
                'reason' => 'Probeer terugbetaling als kassier.',
                'items'  => [[
                    'sale_item_id' => $originalItem->id,
                    'quantity'     => 1,
                ]],
            ]);

        // Cashier lacks the sales.refund permission → SalePolicy::refund() returns false
        $response->assertStatus(403);
        // No refund sale created
        $this->assertDatabaseCount('sales', 1);
    }

    // ─── 404 / 403 for cross-org sale ────────────────────────────────────────

    public function test_manager_cannot_refund_another_orgs_sale(): void
    {
        // Build a second org + store + cashier + sale in that org
        $otherOrg = Organisation::create([
            'name'              => 'Concurrent Supermarkt',
            'type'              => 'retail',
            'btw_number'        => 'BTW-SR-999999',
            'currency'          => 'SRD',
            'locale'            => 'nl',
            'is_government'     => false,
            'subscription_tier' => 'standard',
        ]);
        $otherStore = Store::create([
            'organisation_id'  => $otherOrg->id,
            'name'             => 'Other Store',
            'address'          => 'Elsewhere',
            'city'             => 'Nickerie',
            'default_btw_rate' => 10.00,
            'is_active'        => true,
            'pos_type'         => 'native',
        ]);
        $otherCashier = User::create([
            'name'            => 'Other Cashier',
            'email'           => 'other@elsewhere.sr',
            'password'        => bcrypt('secret'),
            'organisation_id' => $otherOrg->id,
            'role'            => User::ROLE_CASHIER,
            'locale'          => 'nl',
            'is_active'       => true,
        ]);
        $foreignSale = Sale::create([
            'store_id'           => $otherStore->id,
            'cashier_id'         => $otherCashier->id,
            'sale_number'        => Sale::nextNumber($otherStore->id),
            'subtotal_srd'       => '11.00',
            'discount_srd'       => '0.00',
            'btw_srd'            => '1.00',
            'total_srd'          => '11.00',
            'payment_method'     => 'cash',
            'cash_received_srd'  => '11.00',
            'change_srd'         => '0.00',
            'status'             => 'completed',
            'source'             => 'pos',
            'exchange_rate_used' => '38.5000',
            'occurred_at'        => now(),
        ]);
        $foreignItem = SaleItem::create([
            'sale_id'               => $foreignSale->id,
            'product_id'            => null,
            'product_name_snapshot' => 'Foreign product',
            'unit_price_srd'        => '11.00',
            'quantity'              => '1.000',
            'discount_srd'          => '0.00',
            'discount_pct'          => '0.00',
            'btw_rate'              => '10.00',
            'btw_exempt'            => false,
            'btw_srd'               => '1.00',
            'line_total_srd'        => '11.00',
        ]);

        // The local manager tries to refund the foreign org's sale.
        // SalePolicy::refund() returns false because the sale's store belongs
        // to another organisation → Laravel returns 403.
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/sales/{$foreignSale->id}/refund", [
                'reason' => 'Cross-org refund attempt.',
                'items'  => [[
                    'sale_item_id' => $foreignItem->id,
                    'quantity'     => 1,
                ]],
            ]);

        $response->assertStatus(403);

        // Only the originally-built two sales (this org's + foreign org's) exist
        // — no refund sale was inserted.
        $this->assertSame(2, Sale::count());
    }

    // ─── 422: validation errors ──────────────────────────────────────────────

    public function test_short_reason_returns_422(): void
    {
        $originalItem = $this->originalSale->items()->first();

        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/sales/{$this->originalSale->id}/refund", [
                'reason' => 'no', // < 5 chars
                'items'  => [[
                    'sale_item_id' => $originalItem->id,
                    'quantity'     => 1,
                ]],
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['reason']);
    }

    public function test_missing_items_returns_422(): void
    {
        $response = $this->actingAs($this->manager, 'sanctum')
            ->postJson("/api/sales/{$this->originalSale->id}/refund", [
                'reason' => 'Manager wants refund, forgot items array.',
                // no items
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['items']);
    }
}
