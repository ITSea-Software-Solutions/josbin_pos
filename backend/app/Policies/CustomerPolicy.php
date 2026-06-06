<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;

class CustomerPolicy
{
    public function before(User $user): ?bool
    {
        return $user->isSuperAdmin() ? true : null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('customers.view');
    }

    public function view(User $user, Customer $customer): bool
    {
        return $user->can('customers.view')
            && ($user->organisation_id === null || $user->organisation_id === $customer->organisation_id);
    }

    public function create(User $user): bool
    {
        return $user->can('customers.create');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $user->can('customers.edit')
            && ($user->organisation_id === null || $user->organisation_id === $customer->organisation_id);
    }

    /**
     * WBP-S erasure (redaction) is a data-controller action — restricted to
     * Organisation Admin (Super Admin passes via before()). Cashiers and
     * store managers cannot redact PII.
     */
    public function delete(User $user, Customer $customer): bool
    {
        return $user->role === User::ROLE_ORGANISATION_ADMIN
            && $user->organisation_id === $customer->organisation_id;
    }
}
