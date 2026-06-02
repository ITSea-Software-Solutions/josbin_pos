<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    public function before(User $user): ?bool
    {
        return $user->isSuperAdmin() ? true : null;
    }

    public function viewAny(User $user): bool
    {
        return $user->can('products.view');
    }

    public function view(User $user, Product $product): bool
    {
        return $user->can('products.view')
            && ($user->organisation_id === null || $user->organisation_id === $product->organisation_id);
    }

    public function create(User $user): bool
    {
        return $user->can('products.create');
    }

    public function update(User $user, Product $product): bool
    {
        return $user->can('products.edit')
            && ($user->organisation_id === null || $user->organisation_id === $product->organisation_id);
    }

    public function delete(User $user, Product $product): bool
    {
        return $user->can('products.delete')
            && ($user->organisation_id === null || $user->organisation_id === $product->organisation_id);
    }

    public function import(User $user): bool
    {
        return $user->can('products.import');
    }

    public function sync(User $user): bool
    {
        return $user->can('products.sync');
    }

    /**
     * Who can see cost_price + margin on the product payload.
     *
     * Cost = margin = sensitive business data. Cashier seeing it on the till
     * is a leak (customer leaning over the counter sees it too). SM on small
     * single-store Surinamese shops often IS the operational owner, but the
     * safer default — and the one Square / Lightspeed pick — is OA-only.
     *
     * Add 'products.view_cost' permission to SM via the dashboard's
     * fine-grained perm panel (when we build it) if a specific tenant wants
     * to grant it.
     */
    public function viewCost(User $user): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }
        return $user->can('products.view_cost');
    }
}
