<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;

class SalePolicy
{
    public function before(User $user): ?bool
    {
        return $user->isSuperAdmin() ? true : null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('sales.view');
    }

    public function view(User $user, Sale $sale): bool
    {
        return $user->can('sales.view');
    }

    public function create(User $user): bool
    {
        return $user->can('sales.create');
    }

    public function void(User $user, Sale $sale): bool
    {
        return $user->can('sales.void');
    }

    public function refund(User $user, Sale $sale): bool
    {
        return $user->can('sales.refund');
    }

    public function hold(User $user): bool
    {
        return $user->can('sales.hold');
    }
}
