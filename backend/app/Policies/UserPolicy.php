<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * Only manager-level and above can list users.
     */
    public function viewAny(User $user): bool
    {
        return $user->isAtLeastManager();
    }

    public function view(User $user, User $model): bool
    {
        // Can always view self
        if ($user->id === $model->id) return true;
        if ($user->isSuperAdmin()) return true;
        return $user->organisation_id === $model->organisation_id
            && $user->isAtLeastManager();
    }

    public function create(User $user): bool
    {
        return $user->isAtLeastManager();
    }

    /**
     * Can update users within your scope and below your role level.
     */
    public function update(User $user, User $model): bool
    {
        if ($user->id === $model->id) return true; // always edit self
        if ($user->isSuperAdmin()) return true;
        if ($user->organisation_id !== $model->organisation_id) return false;
        return $user->isAtLeastManager() && $this->isRoleBelow($user->role, $model->role);
    }

    public function delete(User $user, User $model): bool
    {
        if ($user->id === $model->id) return false; // cannot delete self
        if ($user->isSuperAdmin()) return true;
        if ($user->organisation_id !== $model->organisation_id) return false;
        return $user->isAtLeastManager() && $this->isRoleBelow($user->role, $model->role);
    }

    /**
     * Returns true if $subjectRole is strictly below $actorRole in the hierarchy.
     */
    private function isRoleBelow(string $actorRole, string $subjectRole): bool
    {
        $hierarchy = [
            User::ROLE_SUPER_ADMIN        => 0,
            User::ROLE_ORGANISATION_ADMIN => 1,
            User::ROLE_STORE_MANAGER      => 2,
            User::ROLE_CASHIER            => 3,
            User::ROLE_AUDITOR            => 3,
            User::ROLE_API_INTEGRATION    => 3,
        ];

        return ($hierarchy[$actorRole] ?? 99) < ($hierarchy[$subjectRole] ?? 99);
    }
}
