<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Store;
use App\Models\StoreProductOverride;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/products/pos — per-store price + stock resolution.
 *
 * PERF: the endpoint constrains the storeStocks / storeOverrides eager-loads to
 * the requested store. This test pins the behaviour the optimisation must not
 * break — each store sees ITS OWN override price and stock, never the other
 * store's, even though both rows exist for the product.
 */
class PosProductsEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_pos_endpoint_returns_each_stores_own_price_and_stock(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $org = Organisation::create([
            'name' => 'PerStore Org', 'type' => 'retail', 'btw_number' => 'SR-PS',
            'currency' => 'SRD', 'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        $storeA = Store::create([
            'organisation_id' => $org->id, 'name' => 'Paramaribo', 'city' => 'Paramaribo',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);
        $storeB = Store::create([
            'organisation_id' => $org->id, 'name' => 'Nickerie', 'city' => 'Nieuw-Nickerie',
            'default_btw_rate' => 10, 'is_active' => true, 'pos_type' => 'native',
        ]);

        $cat = Category::create([
            'organisation_id' => $org->id, 'name_nl' => 'Cat', 'name_en' => 'Cat',
            'is_active' => true, 'sort_order' => 1,
        ]);

        $product = Product::create([
            'organisation_id' => $org->id, 'category_id' => $cat->id,
            'name_nl' => 'Rijst', 'name_en' => 'Rice', 'price' => '10.00',
            'btw_rate' => '10', 'btw_exempt' => false, 'stock_qty' => 0, 'is_active' => true,
        ]);

        // Nickerie charges more (transport) and holds different stock.
        StoreProductOverride::create([
            'store_id' => $storeB->id, 'product_id' => $product->id, 'price_override' => '12.50',
        ]);
        ProductStock::create([
            'product_id' => $product->id, 'store_id' => $storeA->id,
            'stock_qty' => '40.000', 'low_stock_threshold' => '0.000',
        ]);
        ProductStock::create([
            'product_id' => $product->id, 'store_id' => $storeB->id,
            'stock_qty' => '7.000', 'low_stock_threshold' => '0.000',
        ]);

        $cashier = User::create([
            'name' => 'Kassa', 'email' => 'kassa-ps@test.sr', 'password' => bcrypt('pw'),
            'organisation_id' => $org->id, 'store_id' => $storeA->id,
            'role' => User::ROLE_CASHIER, 'locale' => 'nl', 'is_active' => true,
        ]);
        $cashier->assignRole(User::ROLE_CASHIER);

        // Store A: base price, A's stock.
        $this->actingAs($cashier, 'sanctum')
            ->getJson('/api/products/pos?store_id=' . $storeA->id)
            ->assertOk()
            ->assertJsonPath('data.0.price', '10.00')
            ->assertJsonPath('data.0.stock_qty', '40.000');

        // Store B: override price, B's stock — no bleed from A's constrained load.
        $this->actingAs($cashier, 'sanctum')
            ->getJson('/api/products/pos?store_id=' . $storeB->id)
            ->assertOk()
            ->assertJsonPath('data.0.price', '12.50')
            ->assertJsonPath('data.0.stock_qty', '7.000');
    }
}
