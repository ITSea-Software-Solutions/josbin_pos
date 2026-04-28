<?php

namespace App\Policies;

use App\Models\User;

class CategoryPolicy
{
    public function before(User $user): ?bool
    {
        return $user->isSuperAdmin() ? true : null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('categories.manage') || $user->can('products.view');
    }

    public function manage(User $user): bool
    {
        return $user->can('categories.manage');
    }
}
