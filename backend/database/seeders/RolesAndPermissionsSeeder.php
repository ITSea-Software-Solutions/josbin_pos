<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Permissions ───────────────────────────────────────────────────────
        $permissions = [
            // Sales
            'sales.create',
            'sales.view',
            'sales.void',
            'sales.void.approve',     // second approver (govt segregation of duties)
            'sales.refund',
            'sales.hold',
            'sales.restore',

            // Products
            'products.view',
            'products.create',
            'products.edit',
            'products.delete',
            'products.import',
            'products.sync',
            // Sets BTW rate / btw_exempt on a product. OA-only by design —
            // mis-classification has Belastingdienst-filing implications. SM
            // has products.edit but is silently filtered out of these two
            // fields by the controller's validation (see ProductController::
            // applyBtwGate).
            'products.set_btw',
            // Sees cost_price + margin on the product payload. OA-only by
            // default; sensitive business data the cashier shouldn't glance
            // at on the till. Grantable to SM per-tenant if desired.
            'products.view_cost',

            // Categories
            'categories.manage',

            // Customers
            'customers.view',
            'customers.create',
            'customers.edit',

            // Reports
            'reports.daily',
            'reports.monthly',
            'reports.custom',
            'reports.top_products',
            'reports.x_report',
            'reports.z_report',
            'reports.export',
            'reports.btw',
            'reports.rekenkamer',   // government audit export

            // Exchange rate
            'rates.view',
            'rates.lock',
            'rates.override',

            // Z-Report / End of Day
            'z_report.close',
            'z_report.submit',
            'z_report.view_history',

            // Users
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',

            // Stores & Orgs
            'stores.manage',
            'organisations.manage',

            // API integrations
            'api_integrations.manage',

            // Discount rules
            'discount_rules.manage',

            // AI insights (manager+ — exposes business-sensitive summaries)
            'ai.insights',

            // Settings
            'settings.manage',

            // Barcode labels
            'labels.print',

            // Audit log
            'audit.view',

            // BTW submissions (Belastingdienst Suriname filings)
            'btw.submit',              // OA / SM: create new submission
            'btw.view_submissions',    // tax_inspector + SA: read across orgs
            'btw.review_submission',   // tax_inspector: accept / dispute
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        // ── Roles ─────────────────────────────────────────────────────────────

        // Super Admin — full platform access
        $superAdmin = Role::firstOrCreate(['name' => User::ROLE_SUPER_ADMIN, 'guard_name' => 'web']);
        $superAdmin->syncPermissions(Permission::all());

        // Organisation Admin — manages their org only
        $orgAdmin = Role::firstOrCreate(['name' => User::ROLE_ORGANISATION_ADMIN, 'guard_name' => 'web']);
        $orgAdmin->syncPermissions([
            'sales.view', 'sales.void', 'sales.void.approve', 'sales.refund',
            'products.view', 'products.create', 'products.edit', 'products.delete',
            'products.import', 'products.sync', 'products.set_btw', 'products.view_cost',
            'categories.manage',
            'customers.view', 'customers.create', 'customers.edit',
            'reports.daily', 'reports.monthly', 'reports.custom', 'reports.top_products',
            'reports.x_report', 'reports.z_report', 'reports.export', 'reports.btw', 'reports.rekenkamer',
            'rates.view', 'rates.lock', 'rates.override',
            'z_report.close', 'z_report.submit', 'z_report.view_history',
            'users.view', 'users.create', 'users.edit',
            'stores.manage',
            'api_integrations.manage',
            'discount_rules.manage',
            'ai.insights',
            'settings.manage',
            'labels.print',
            'audit.view',
            // OA owns BTW filings for their org. Can view their own filings
            // (cross-org visibility is gated separately in the controller).
            'btw.submit',
            'btw.view_submissions',
        ]);

        // Store Manager — manages their assigned store.
        //
        // SM owns the catalogue at their store (Option A revised):
        //   ✅ create + edit products, manage categories
        //   ✅ products.view_cost — SM that creates a product also sets its
        //                           cost; splitting was illogical and forced
        //                           a broken "SM creates → call OA → OA
        //                           fills cost" workflow. Cashier still
        //                           never sees cost (cost stays gated on
        //                           the till's product payload).
        //   ❌ products.set_btw  — BTW rate / exempt flag stays OA-only (filing
        //                          impact at Belastingdienst — SM can quietly
        //                          mis-classify and the audit-log surface is
        //                          deeper than the Stock screen)
        //   ❌ products.import   — bulk CSV/Excel stays OA-only (avoids cross-
        //                          store catalogue fragmentation in chains)
        //   ❌ products.sync     — "push catalogue to all stores" stays OA-only
        $storeManager = Role::firstOrCreate(['name' => User::ROLE_STORE_MANAGER, 'guard_name' => 'web']);
        $storeManager->syncPermissions([
            'sales.create', 'sales.view', 'sales.void', 'sales.refund', 'sales.hold', 'sales.restore',
            'products.view', 'products.create', 'products.edit', 'products.view_cost',
            'categories.manage',
            'customers.view', 'customers.create', 'customers.edit',
            'reports.daily', 'reports.monthly', 'reports.custom', 'reports.top_products',
            'reports.x_report', 'reports.z_report', 'reports.export', 'reports.btw',
            'rates.view', 'rates.lock', 'rates.override',
            'z_report.close', 'z_report.submit', 'z_report.view_history',
            'users.view', 'users.create',
            'discount_rules.manage',
            'ai.insights',
            'settings.manage',
            'labels.print',
            // Single-store managers in small Surinamese shops often file their
            // own BTW. Granting submit + view-own here.
            'btw.submit',
            'btw.view_submissions',
        ]);

        // Cashier — POS screen + store-level reports (read-only, own store)
        $cashier = Role::firstOrCreate(['name' => User::ROLE_CASHIER, 'guard_name' => 'web']);
        $cashier->syncPermissions([
            'sales.create', 'sales.view', 'sales.hold', 'sales.restore',
            'products.view',
            'customers.view', 'customers.create',
            'reports.daily', 'reports.monthly', 'reports.custom',
            'reports.top_products', 'reports.x_report', 'reports.export',
            'z_report.view_history',
            'rates.view',
            'labels.print',
        ]);

        // Auditor — read-only (government compliance officers)
        $auditor = Role::firstOrCreate(['name' => User::ROLE_AUDITOR, 'guard_name' => 'web']);
        $auditor->syncPermissions([
            'sales.view',
            'products.view',
            'customers.view',
            'reports.daily', 'reports.monthly', 'reports.custom', 'reports.top_products',
            'reports.export', 'reports.btw', 'reports.rekenkamer',
            'rates.view',
            'z_report.view_history',
            'audit.view',
        ]);

        // API Integration — machine account for third-party POS
        $apiIntegration = Role::firstOrCreate(['name' => User::ROLE_API_INTEGRATION, 'guard_name' => 'web']);
        $apiIntegration->syncPermissions([
            'sales.create', 'sales.view',
            'products.view',
            'reports.daily',
        ]);

        // Belastingdienst Suriname tax inspector — cross-organisation read-
        // only access to BTW filings. Can accept or dispute filings but never
        // see catalogue, sales detail, customers, or anything else. 2FA is
        // mandatory (enforced via User::TWO_FACTOR_ALWAYS_ROLES).
        $taxInspector = Role::firstOrCreate(['name' => User::ROLE_TAX_INSPECTOR, 'guard_name' => 'web']);
        $taxInspector->syncPermissions([
            'btw.view_submissions',
            'btw.review_submission',
            'audit.view',  // their own action trail; controller scopes to events touching their reviews
        ]);
    }
}
