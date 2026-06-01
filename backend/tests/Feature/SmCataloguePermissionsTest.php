<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Option A: Store Manager gets partial catalogue access.
 *
 * Allowed:
 *   ✅ create + edit category
 *   ✅ create product (without setting BTW — DB default 10% applies)
 *   ✅ edit product name, price, stock — but BTW fields stay frozen
 *
 * Forbidden:
 *   ❌ change btw_rate / btw_exempt (mis-classification → Belastingdienst)
 *   ❌ bulk-import products (catalogue fragmentation risk in chains)
 *   ❌ push catalogue across stores
 */
class SmCataloguePermissionsTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $store;
    private User $sm;
    private User $oa;
    private Category $existingCategory;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Catalogue Test Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-CAT', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $this->store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Main Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->sm = User::create([
            'name' => 'Manager', 'email' => 'sm-cat@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'store_id' => $this->store->id,
            'role' => User::ROLE_STORE_MANAGER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sm->assignRole(User::ROLE_STORE_MANAGER);

        $this->oa = User::create([
            'name' => 'OrgAdmin', 'email' => 'oa-cat@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->existingCategory = Category::create([
            'organisation_id' => $this->org->id,
            'name_nl' => 'Zuivel', 'name_en' => 'Dairy',
            'is_active' => true, 'sort_order' => 1,
        ]);
    }

    public function test_sm_can_create_category(): void
    {
        $this->actingAs($this->sm, 'sanctum')
            ->postJson('/api/categories', [
                'name_nl'    => 'Brood',
                'name_en'    => 'Bread',
                'sort_order' => 2,
            ])
            ->assertCreated();
    }

    public function test_sm_can_create_product_without_setting_btw_uses_db_default(): void
    {
        $response = $this->actingAs($this->sm, 'sanctum')->postJson('/api/products', [
            'name_nl'     => 'Volle Melk 1L',
            'name_en'     => 'Whole Milk 1L',
            'price'       => '6.50',
            'category_id' => $this->existingCategory->id,
            // intentionally NOT sending btw_rate / btw_exempt
        ]);

        $response->assertCreated();

        $product = Product::where('name_nl', 'Volle Melk 1L')->first();
        $this->assertNotNull($product);
        // DB default — Suriname standard VAT
        $this->assertEquals('10.00', $product->btw_rate);
        $this->assertFalse($product->btw_exempt);
    }

    public function test_sm_cannot_set_btw_rate_on_create_even_if_form_sends_it(): void
    {
        // SM tries to mark a product BTW-exempt at create time. Backend
        // silently drops the field and applies the DB default — graceful
        // (the rest of the payload is valid; better than 403'ing the form).
        $this->actingAs($this->sm, 'sanctum')->postJson('/api/products', [
            'name_nl'    => 'Luxury Item',
            'name_en'    => 'Luxury Item',
            'price'      => '500.00',
            'btw_rate'   => '0',     // SM trying to dodge BTW
            'btw_exempt' => true,    // SM trying to mark exempt
        ])->assertCreated();

        $product = Product::where('name_nl', 'Luxury Item')->first();
        $this->assertEquals('10.00', $product->btw_rate, 'SM cannot bypass BTW — falls to default.');
        $this->assertFalse($product->btw_exempt, 'SM cannot mark a product BTW-exempt.');
    }

    public function test_sm_can_edit_product_name_and_price_but_not_btw(): void
    {
        $product = Product::create([
            'organisation_id' => $this->org->id,
            'category_id'     => $this->existingCategory->id,
            'name_nl'         => 'Original', 'name_en' => 'Original',
            'price'           => '5.00',
            'btw_rate'        => '10.00',
            'btw_exempt'      => false,
            'stock_qty'       => 10, 'is_active' => true,
        ]);

        // SM updates name + price + tries to flip BTW
        $this->actingAs($this->sm, 'sanctum')->putJson("/api/products/{$product->id}", [
            'name_nl'    => 'Updated Naam',
            'name_en'    => 'Updated Name',
            'price'      => '7.50',
            'btw_rate'   => '0',
            'btw_exempt' => true,
        ])->assertOk();

        $product->refresh();
        $this->assertEquals('Updated Naam', $product->name_nl);
        $this->assertEquals('7.50', $product->price);
        // BTW must be untouched
        $this->assertEquals('10.00', $product->btw_rate);
        $this->assertFalse($product->btw_exempt);
    }

    public function test_oa_can_set_btw_rate_freely(): void
    {
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl'    => 'Basic Food',
            'name_en'    => 'Basic Food',
            'price'      => '5.00',
            'btw_rate'   => '0',
            'btw_exempt' => true,
        ])->assertCreated();

        $product = Product::where('name_nl', 'Basic Food')->first();
        $this->assertEquals('0.00', $product->btw_rate);
        $this->assertTrue($product->btw_exempt);
    }

    public function test_sm_cannot_bulk_import_products(): void
    {
        // products.import is OA-only — bulk fragmentation guard.
        // Policy hits before validation, so SM gets 403 even on empty body.
        $this->actingAs($this->sm, 'sanctum')->postJson('/api/products/import')
            ->assertForbidden();
    }

    public function test_sm_cannot_push_catalogue(): void
    {
        // products.sync (push catalogue) is OA-only — endpoint is /products/push
        $this->actingAs($this->sm, 'sanctum')->postJson('/api/products/push')
            ->assertForbidden();
    }
}
