<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Organisation;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Stage 1 product upgrade — standard POS fields the demo client expects:
 *   - sku (unique per org via partial index)
 *   - cost_price (OA-only at API layer)
 *   - brand, supplier, unit, descriptions
 *   - image upload via /products/{id}/image (multipart)
 *
 * + the category-column complaint: index() now returns category_name and
 *   image_url, so the dashboard table doesn't have to lazy-join.
 */
class ProductStandardFieldsTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private User $oa;
    private User $sm;
    private Category $cat;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'StdFields Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-SF', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);

        $store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Main',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->oa = User::create([
            'name' => 'OA', 'email' => 'oa-sf@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'role' => User::ROLE_ORGANISATION_ADMIN,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->oa->assignRole(User::ROLE_ORGANISATION_ADMIN);

        $this->sm = User::create([
            'name' => 'SM', 'email' => 'sm-sf@test.sr',
            'password' => bcrypt('pw'),
            'organisation_id' => $this->org->id,
            'store_id' => $store->id,
            'role' => User::ROLE_STORE_MANAGER,
            'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sm->assignRole(User::ROLE_STORE_MANAGER);

        $this->cat = Category::create([
            'organisation_id' => $this->org->id,
            'name_nl' => 'Zuivel', 'name_en' => 'Dairy',
            'is_active' => true, 'sort_order' => 1,
        ]);
    }

    public function test_oa_can_create_product_with_all_standard_fields(): void
    {
        $resp = $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl'        => 'Volle Melk 1L',
            'name_en'        => 'Whole Milk 1L',
            'sku'            => 'MELK-1L',
            'price'          => '6.50',
            'cost_price'     => '4.50',
            'category_id'    => $this->cat->id,
            'brand'          => 'Frutex',
            'supplier'       => 'Yu Pi NV',
            'unit'           => 'l',
            'description_nl' => 'Verse volle melk',
            'description_en' => 'Fresh whole milk',
        ])->assertCreated();

        $data = $resp->json('data');
        $this->assertEquals('MELK-1L', $data['sku']);
        $this->assertEquals('4.50', $data['cost_price']);
        $this->assertEquals('Frutex', $data['brand']);
        $this->assertEquals('Yu Pi NV', $data['supplier']);
        $this->assertEquals('l', $data['unit']);
        // Margin computed server-side for OA
        $this->assertEquals('2.00', $data['margin']);
        $this->assertNotNull($data['margin_pct']);
    }

    public function test_sm_can_persist_cost_price(): void
    {
        // Original policy stripped cost for SM, forcing a SM-creates-then-OA-
        // fills-cost handoff that nobody wanted. SM now owns the catalogue
        // record fully (including cost). BTW stays OA-only (different risk
        // bucket — see applyBtwGate + ProductPolicy::viewCost).
        $this->actingAs($this->sm, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'A', 'name_en' => 'A',
            'price'   => '10.00',
            'cost_price' => '5.00',
        ])->assertCreated();

        $created = Product::where('name_nl', 'A')->first();
        $this->assertEquals('5.00', $created->cost_price);
    }

    public function test_sm_response_includes_cost_price_and_margin(): void
    {
        Product::create([
            'organisation_id' => $this->org->id,
            'category_id'     => $this->cat->id,
            'name_nl'         => 'Cheese', 'name_en' => 'Cheese',
            'price'           => '15.00', 'cost_price' => '8.00',
            'btw_rate'        => '10', 'stock_qty' => 10, 'is_active' => true,
        ]);

        $resp = $this->actingAs($this->sm, 'sanctum')->getJson('/api/products');
        $resp->assertOk();
        $rows = $resp->json('data');
        $this->assertNotEmpty($rows);
        $cheese = collect($rows)->firstWhere('name_nl', 'Cheese');
        $this->assertNotNull($cheese);
        // SM now sees cost + margin — same shape as OA.
        $this->assertEquals('8.00', $cheese['cost_price']);
        $this->assertEquals('7.00', $cheese['margin']);
    }

    public function test_oa_response_includes_cost_price_and_margin(): void
    {
        Product::create([
            'organisation_id' => $this->org->id,
            'category_id'     => $this->cat->id,
            'name_nl'         => 'Bread', 'name_en' => 'Bread',
            'price'           => '4.00', 'cost_price' => '2.50',
            'btw_rate'        => '0', 'btw_exempt' => true,
            'stock_qty'       => 50, 'is_active' => true,
        ]);

        $resp = $this->actingAs($this->oa, 'sanctum')->getJson('/api/products');
        $row = $resp->json('data.0');
        $this->assertEquals('2.50', $row['cost_price']);
        $this->assertEquals('1.50', $row['margin']);
    }

    public function test_index_response_includes_category_name_and_image_url(): void
    {
        Product::create([
            'organisation_id' => $this->org->id,
            'category_id'     => $this->cat->id,
            'name_nl'         => 'X', 'name_en' => 'X',
            'price'           => '5', 'btw_rate' => '10',
            'stock_qty'       => 1, 'is_active' => true,
        ]);

        $row = $this->actingAs($this->oa, 'sanctum')->getJson('/api/products')->json('data.0');
        $this->assertEquals('Zuivel', $row['category_name']);
        $this->assertNull($row['image_url']); // no image yet
    }

    public function test_sku_must_be_unique_per_org_but_null_is_allowed_multiple_times(): void
    {
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'A', 'name_en' => 'A', 'price' => '1', 'sku' => 'DUP',
        ])->assertCreated();

        // Same SKU — must 422
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'B', 'name_en' => 'B', 'price' => '1', 'sku' => 'DUP',
        ])->assertStatus(422);

        // Two products with NO sku — must both succeed (partial unique index)
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'C', 'name_en' => 'C', 'price' => '1',
        ])->assertCreated();
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'D', 'name_en' => 'D', 'price' => '1',
        ])->assertCreated();
    }

    public function test_unit_must_be_in_allowed_set(): void
    {
        $this->actingAs($this->oa, 'sanctum')->postJson('/api/products', [
            'name_nl' => 'A', 'name_en' => 'A', 'price' => '1',
            'unit' => 'pounds', // invalid
        ])->assertStatus(422);
    }

    public function test_image_upload_stores_file_and_updates_image_path(): void
    {
        Storage::fake('public');

        $product = Product::create([
            'organisation_id' => $this->org->id,
            'name_nl' => 'P', 'name_en' => 'P',
            'price' => '1', 'btw_rate' => '10', 'stock_qty' => 1, 'is_active' => true,
        ]);

        // Use create() not image() because the PHP-FPM container doesn't
        // bundle the GD extension that fake()->image() needs to generate
        // a real PNG. create() makes a plain-bytes file with the right
        // mime + size — Laravel's image validator accepts it.
        $file = UploadedFile::fake()->create('product.jpg', 200, 'image/jpeg');
        $resp = $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$product->id}/image", ['image' => $file]);

        $resp->assertOk();
        $product->refresh();
        $this->assertNotNull($product->image_path);
        Storage::disk('public')->assertExists($product->image_path);
        // Existing endpoint stores at products/{product-uuid}.{ext}
        $this->assertStringContainsString($product->id, $product->image_path);
    }

    public function test_image_upload_rejects_too_large_or_wrong_type(): void
    {
        Storage::fake('public');
        $product = Product::create([
            'organisation_id' => $this->org->id,
            'name_nl' => 'P', 'name_en' => 'P',
            'price' => '1', 'btw_rate' => '10', 'stock_qty' => 1, 'is_active' => true,
        ]);

        // 5 MB > 2 MB cap (existing upload endpoint)
        $big = UploadedFile::fake()->create('huge.jpg', 5_000, 'image/jpeg');
        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$product->id}/image", ['image' => $big])
            ->assertStatus(422);

        // Wrong mime
        $pdf = UploadedFile::fake()->create('manual.pdf', 100, 'application/pdf');
        $this->actingAs($this->oa, 'sanctum')
            ->postJson("/api/products/{$product->id}/image", ['image' => $pdf])
            ->assertStatus(422);
    }
}
