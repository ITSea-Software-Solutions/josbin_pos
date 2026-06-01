<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Backfill spatie role attachments for users created before the
 * UserController::store() / update() fix that calls assignRole().
 *
 * Symptom: a user has a role enum on the users row (e.g. 'organisation_admin')
 * but no row in model_has_roles → spatie's $user->can(...) returns false →
 * every policy check 403s. Affects every user created via the dashboard UI
 * after the RolesAndPermissionsSeeder ran but before the role-assignment fix.
 *
 * Idempotent. Safe to run on a fresh seed (does nothing) or on production
 * (only touches users missing a spatie role).
 *
 * Run:  php artisan users:backfill-spatie-roles
 */
class BackfillSpatieRoles extends Command
{
    protected $signature = 'users:backfill-spatie-roles
                            {--dry-run : List affected users without changing anything}';

    protected $description = 'Attach the spatie role to users that only have role on the column';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $fixed  = 0;
        $skipped = 0;

        $users = User::query()
            ->with('roles:id,name')
            ->orderBy('email')
            ->get();

        foreach ($users as $user) {
            $hasSpatieRole = $user->roles->isNotEmpty();
            $matchesEnum   = $user->roles->contains(fn ($r) => $r->name === $user->role);

            if ($hasSpatieRole && $matchesEnum) {
                $skipped++;
                continue;
            }

            $this->line(sprintf(
                '  %s %s  (role=%s, spatie=%s)',
                $dryRun ? '[dry-run]' : '[fixing]',
                $user->email,
                $user->role,
                $user->roles->pluck('name')->implode(',') ?: '(none)',
            ));

            if (! $dryRun) {
                $user->syncRoles([$user->role]);
                $fixed++;
            }
        }

        $this->newLine();
        $this->info(sprintf(
            'Done. %d user(s) %s, %d already correct.',
            $dryRun ? $users->count() - $skipped : $fixed,
            $dryRun ? 'would be fixed' : 'fixed',
            $skipped,
        ));

        return self::SUCCESS;
    }
}
