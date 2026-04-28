<?php

namespace App\Policies;

use App\Models\Organisation;
use App\Models\User;

class OrganisationPolicy
{
    public function viewAny(User $user): bool
    {
        return in_array($user->role, [
            User::ROLE_SUPER_ADMIN,
            User::ROLE_ORGANISATION_ADMIN,
        ]);
    }

    public function view(User $user, Organisation $organisation): bool
    {
        if ($user->isSuperAdmin()) return true;
        return $user->organisation_id === $organisation->id;
    }

    public function create(User $user): bool
    {
        return $user->isSuperAdmin();
    }

    public function update(User $user, Organisation $organisation): bool
    {
        if ($user->isSuperAdmin()) return true;
        return $user->role === User::ROLE_ORGANISATION_ADMIN
            && $user->organisation_id === $organisation->id;
    }

    public function delete(User $user, Organisation $organisation): bool
    {
        return $user->isSuperAdmin();
    }
}
