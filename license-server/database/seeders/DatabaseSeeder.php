<?php

namespace Database\Seeders;

use App\Models\License;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seeds one demo license so the server can be exercised immediately
     * after a fresh install. Safe to run repeatedly (firstOrCreate).
     */
    public function run(): void
    {
        $demoKey = 'JOSBIN-DEMO-DEMO-DEMO-DEMO';

        $license = License::firstOrCreate(
            ['license_key_hash' => License::hashKey($demoKey)],
            [
                'license_key_prefix' => 'JOSBIN-DEMO',
                'organisation_name'  => 'Supermarkt De Hoop (demo)',
                'contact_email'      => 'demo@josbin-pos.sr',
                'tier'               => 'standard',
                'max_stores'         => 3,
                'max_terminals'      => 10,
                'valid_from'         => now()->toDateString(),
                'valid_until'        => now()->addYear()->toDateString(),
                'is_active'          => true,
                'notes'              => 'Seeded demo license — local testing only.',
            ]
        );

        $this->command?->info("Demo license ready.");
        $this->command?->info("  license_key : {$demoKey}");
        $this->command?->info("  license id  : {$license->id}");
        $this->command?->info("Activate a test installation with POST /api/activate { \"license_key\": \"{$demoKey}\" }");
    }
}
