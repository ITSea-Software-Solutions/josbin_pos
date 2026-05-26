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

    /**
     * Org-scope every per-sale read. Before this guard a cashier from one
     * organisation could GET /api/sales/{uuid} for another organisation's
     * sale and read it. Now: must have sales.view AND the sale's store
     * must belong to the caller's organisation.
     */
    public function view(User $user, Sale $sale): bool
    {
        return $user->can('sales.view') && $this->ownsSale($user, $sale);
    }

    public function create(User $user): bool
    {
        return $user->can('sales.create');
    }

    public function void(User $user, Sale $sale): bool
    {
        return $user->can('sales.void') && $this->ownsSale($user, $sale);
    }

    public function refund(User $user, Sale $sale): bool
    {
        if (! $user->can('sales.refund') || ! $this->ownsSale($user, $sale)) return false;
        // Additionally enforce store-assignment for store-scoped roles. A
        // Store Manager assigned to Paramaribo can't refund a Nickerie sale.
        // Org Admin / Auditor / Super Admin keep org-wide scope (see
        // User::isOrgScopedRole + canAccessStore backfill semantics).
        return $sale->store_id ? $user->canAccessStore($sale->store_id) : true;
    }

    /**
     * The sale belongs to a store inside the user's organisation.
     * Super Admin bypasses via the before() check above.
     */
    private function ownsSale(User $user, Sale $sale): bool
    {
        return $sale->store?->organisation_id === $user->organisation_id;
    }

    public function hold(User $user): bool
    {
        return $user->can('sales.hold');
    }
}
