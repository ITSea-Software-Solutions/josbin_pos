<?php

namespace App\Policies;

use App\Models\Store;
use App\Models\User;

class StorePolicy
{
    public function viewAny(User $user): bool
    {
        return true; // all authenticated users can list stores in their scope
    }

    public function view(User $user, Store $store): bool
    {
        if ($user->isSuperAdmin()) return true;
        return $user->organisation_id === $store->organisation_id;
    }

    public function create(User $user): bool
    {
        return in_array($user->role, [User::ROLE_SUPER_ADMIN, User::ROLE_ORGANISATION_ADMIN]);
    }

    public function update(User $user, Store $store): bool
    {
        if ($user->isSuperAdmin()) return true;
        return $user->role === User::ROLE_ORGANISATION_ADMIN
            && $user->organisation_id === $store->organisation_id;
    }

    public function delete(User $user, Store $store): bool
    {
        return $user->isSuperAdmin();
    }
}
