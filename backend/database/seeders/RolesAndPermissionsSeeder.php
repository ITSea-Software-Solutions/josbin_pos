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

            // Settings
            'settings.manage',

            // Barcode labels
            'labels.print',

            // Audit log
            'audit.view',
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
            'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.sync',
            'categories.manage',
            'customers.view', 'customers.create', 'customers.edit',
            'reports.daily', 'reports.monthly', 'reports.custom', 'reports.top_products',
            'reports.x_report', 'reports.z_report', 'reports.export', 'reports.btw', 'reports.rekenkamer',
            'rates.view', 'rates.lock', 'rates.override',
            'z_report.close', 'z_report.submit', 'z_report.view_history',
            'users.view', 'users.create', 'users.edit',
            'stores.manage',
            'settings.manage',
            'labels.print',
            'audit.view',
        ]);

        // Store Manager — manages their assigned store
        $storeManager = Role::firstOrCreate(['name' => User::ROLE_STORE_MANAGER, 'guard_name' => 'web']);
        $storeManager->syncPermissions([
            'sales.create', 'sales.view', 'sales.void', 'sales.refund', 'sales.hold', 'sales.restore',
            'products.view', 'products.create', 'products.edit',
            'categories.manage',
            'customers.view', 'customers.create', 'customers.edit',
            'reports.daily', 'reports.monthly', 'reports.custom', 'reports.top_products',
            'reports.x_report', 'reports.z_report', 'reports.export', 'reports.btw',
            'rates.view', 'rates.lock', 'rates.override',
            'z_report.close', 'z_report.submit', 'z_report.view_history',
            'users.view', 'users.create',
            'settings.manage',
            'labels.print',
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
    }
}
