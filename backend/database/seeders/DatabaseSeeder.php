<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            SuperAdminSeeder::class,
            DevelopmentDataSeeder::class,
            CategoriesSeeder::class,
            // After CategoriesSeeder — it resolves each line to a real
            // category and throws rather than leaving products uncategorised.
            SurinameCatalogueSeeder::class,
        ]);
    }
}
