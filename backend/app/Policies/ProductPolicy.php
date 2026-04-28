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
}
