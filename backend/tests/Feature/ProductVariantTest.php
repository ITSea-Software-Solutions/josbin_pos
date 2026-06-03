<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Stage 2 — product variants.
 *
 * Locks down: CRUD, per-org SKU/barcode uniqueness, cost-strip for SM,
 * inherit-from-parent pricing, hasVariants() helper.
 *
 * Sale-flow variant tests (variant snapshot on sale_items + stock decrement)
 * live in SalesVariantFlowTest.
 */
class ProductVariantTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $oa;
    private User $sm;
    private Product $parent;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Variants Org', 'type' => 'retail',
            'btw_number' => 'SR-V', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'standard', 'is_active' => true,
        ]);

        $store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'S',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $cat = Category::create([
            'organisation_id' => $this->org->id,
            'name_nl' => 'X', 'name_en' => 'X',
            'is_active' => true, 'sort_order' => 1,
        ]);

        $this->parent = Product::create([
            'organisation_id' => $this->org->id,
            'category_id' => $cat->id,
            'name_nl' => 'Bruine Bonen', 'name_en' => 'Brown Beans',
            'price' => '5.00', 'cost_price' => '3.00',
            'btw_rate' => '10', 'btw_exempt' => false,
            'stock_qty' => 100, 'is_active' => true,
        ]);

        $this->oa = User::create([
            'name' => 'OA', 'email' => 'oa-var@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->sm = User::create([
            'name' => 'SM', 'email' => 'sm-var@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id, 'store_id' => $store->id,
            'role' => User::ROLE_STORE_MANAGER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sm->assignRole(User::ROLE_STORE_MANAGER);
    }

    public function test_oa_can_create_variant_with_all_fields(): void
    {
        $resp = $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl'    => '1kg',
                'name_en'    => '1kg',
                'sku'        => 'BB-1KG',
                'barcode'    => '8990000001234',
                'price'      => '9.50',
                'cost_price' => '6.00',
                'stock_qty'  => 50,
                'attributes' => ['size' => '1kg'],
                'sort_order' => 1,
            ])
            ->assertCreated();

        $data = $resp->json('data');
        $this->assertEquals('BB-1KG', $data['sku']);
        $this->assertEquals('9.50', $data['price']);
        $this->assertEquals('6.00', $data['cost_price']);
        $this->assertEquals(['size' => '1kg'], $data['attributes']);
        $this->assertEquals('9.50', $data['effective_price']);
        $this->assertEquals('6.00', $data['effective_cost']);
    }

    public function test_variant_without_price_inherits_from_parent(): void
    {
        $variant = ProductVariant::create([
            'organisation_id' => $this->org->id,
            'product_id' => $this->parent->id,
            'name_nl' => '500g', 'name_en' => '500g',
            'price' => null, 'cost_price' => null,
            'stock_qty' => 20, 'is_active' => true,
        ]);

        $this->assertEquals('5.00', $variant->effectivePrice());
        $this->assertEquals('3.00', $variant->effectiveCost());
    }

    public function test_sm_cannot_persist_cost_on_variant(): void
    {
        $this->actingAs($this->sm, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl' => '1kg', 'name_en' => '1kg',
                'price' => '9.50',
                'cost_price' => '6.00', // SM trying to set cost
                'stock_qty' => 50,
            ])
            ->assertCreated();

        $created = ProductVariant::where('name_nl', '1kg')->first();
        $this->assertNull($created->cost_price, 'SM cannot set cost on variant.');
    }

    public function test_sm_response_excludes_cost(): void
    {
        ProductVariant::create([
            'organisation_id' => $this->org->id,
            'product_id' => $this->parent->id,
            'name_nl' => '1kg', 'name_en' => '1kg',
            'price' => '9.50', 'cost_price' => '6.00',
            'stock_qty' => 50, 'is_active' => true,
        ]);

        $resp = $this->actingAs($this->sm, 'sanctum')
            ->getJson("/api/products/{$this->parent->id}/variants");

        $row = $resp->json('data.0');
        $this->assertArrayNotHasKey('cost_price', $row);
        $this->assertArrayNotHasKey('effective_cost', $row);
    }

    public function test_variant_sku_unique_per_org(): void
    {
        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl' => '1kg', 'name_en' => '1kg', 'sku' => 'DUP',
            ])->assertCreated();

        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl' => '5kg', 'name_en' => '5kg', 'sku' => 'DUP',
            ])->assertStatus(422);

        // Two variants with null SKU — both succeed (partial unique).
        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl' => '10kg', 'name_en' => '10kg',
            ])->assertCreated();
        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$this->parent->id}/variants", [
                'name_nl' => '20kg', 'name_en' => '20kg',
            ])->assertCreated();
    }

    public function test_has_variants_helper(): void
    {
        $this->assertFalse($this->parent->fresh()->hasVariants());

        ProductVariant::create([
            'organisation_id' => $this->org->id,
            'product_id' => $this->parent->id,
            'name_nl' => '1kg', 'name_en' => '1kg',
            'stock_qty' => 1, 'is_active' => true,
        ]);

        $this->assertTrue($this->parent->fresh()->hasVariants());
    }

    public function test_variant_update_round_trip(): void
    {
        $variant = ProductVariant::create([
            'organisation_id' => $this->org->id,
            'product_id' => $this->parent->id,
            'name_nl' => '1kg', 'name_en' => '1kg',
            'price' => '9.50', 'stock_qty' => 50, 'is_active' => true,
        ]);

        $this->actingAs($this->oa, 'sanctum')
            ->putJson("/api/products/{$this->parent->id}/variants/{$variant->id}", [
                'name_nl' => '1 kilogram', 'name_en' => '1 kilogram',
                'price' => '10.00',
            ])
            ->assertOk();

        $variant->refresh();
        $this->assertEquals('1 kilogram', $variant->name_nl);
        $this->assertEquals('10.00', $variant->price);
    }

    public function test_variant_delete_cascade(): void
    {
        $variant = ProductVariant::create([
            'organisation_id' => $this->org->id,
            'product_id' => $this->parent->id,
            'name_nl' => '1kg', 'name_en' => '1kg',
            'stock_qty' => 1, 'is_active' => true,
        ]);

        $this->actingAs($this->oa, 'sanctum')
            ->deleteJson("/api/products/{$this->parent->id}/variants/{$variant->id}")
            ->assertNoContent();

        // Soft-deleted — row still exists with deleted_at
        $this->assertSoftDeleted('product_variants', ['id' => $variant->id]);
    }
}
