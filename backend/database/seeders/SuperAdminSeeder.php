<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = User::firstOrCreate(
            ['email' => 'admin@josbin-pos.sr'],
            [
                'name'     => 'Josbin POS Admin',
                'password' => Hash::make('JosbinPOS@2026!'),  // Change on first login
                'role'     => User::ROLE_SUPER_ADMIN,
                'locale'   => 'nl',
                'is_active' => true,
            ]
        );

        $superAdmin->assignRole(User::ROLE_SUPER_ADMIN);
    }
}
