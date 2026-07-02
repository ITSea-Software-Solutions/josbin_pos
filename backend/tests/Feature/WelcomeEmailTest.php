<?php

namespace Tests\Feature;

use App\Models\Organisation;
use App\Models\Store;
use App\Models\User;
use App\Notifications\WelcomeCredentials;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * When an admin creates a user with send_welcome_email = true, the new user is
 * emailed their login credentials (queued WelcomeCredentials notification). The
 * mail must NOT be sent when the flag is absent/false. The welcome email never
 * carries a plaintext password — the admin sets it and shares it securely.
 */
class WelcomeEmailTest extends TestCase
{
    use RefreshDatabase;

    private Organisation $org;
    private Store $store;
    private User $sa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->org = Organisation::create([
            'name' => 'Welcome Test Org', 'type' => 'retail',
            'btw_number' => 'SR-BTW-WELCOME', 'currency' => 'SRD',
            'locale' => 'nl', 'is_government' => false,
            'subscription_tier' => 'professional', 'is_active' => true,
        ]);
        $this->store = Store::create([
            'organisation_id' => $this->org->id, 'name' => 'Welcome Store',
            'city' => 'Paramaribo', 'default_btw_rate' => 10,
            'is_active' => true, 'pos_type' => 'native',
        ]);

        $this->sa = User::create([
            'name' => 'SA', 'email' => 'welcome-sa@test.sr',
            'password' => bcrypt('pw'), 'organisation_id' => $this->org->id,
            'role' => User::ROLE_SUPER_ADMIN, 'locale' => 'nl', 'is_active' => true,
        ]);
        $this->sa->assignRole(User::ROLE_SUPER_ADMIN);
    }

    public function test_welcome_email_is_queued_when_flag_is_set(): void
    {
        Notification::fake();

        $this->actingAs($this->sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'New Cashier', 'email' => 'welcome-cash@test.sr',
                'password' => 'Password123', 'role' => 'cashier', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                'store_id' => $this->store->id,
                'send_welcome_email' => true,
            ])
            ->assertCreated();

        $newUser = User::where('email', 'welcome-cash@test.sr')->firstOrFail();
        Notification::assertSentTo($newUser, WelcomeCredentials::class);
    }

    public function test_welcome_email_not_sent_when_flag_is_off(): void
    {
        Notification::fake();

        $this->actingAs($this->sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Quiet Cashier', 'email' => 'quiet-cash@test.sr',
                'password' => 'Password123', 'role' => 'cashier', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                'store_id' => $this->store->id,
                'send_welcome_email' => false,
            ])
            ->assertCreated();

        Notification::assertNothingSent();
    }

    public function test_welcome_email_not_sent_when_flag_omitted(): void
    {
        Notification::fake();

        $this->actingAs($this->sa, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Default Cashier', 'email' => 'default-cash@test.sr',
                'password' => 'Password123', 'role' => 'cashier', 'locale' => 'nl',
                'organisation_id' => $this->org->id,
                'store_id' => $this->store->id,
                // send_welcome_email omitted — must default to no email.
            ])
            ->assertCreated();

        Notification::assertNothingSent();
    }
}
