<?php

use App\Models\Store;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Josbin POS Broadcast Channel Authorisation
|--------------------------------------------------------------------------
|
| Private channels are authenticated via Sanctum.
| A user may only subscribe to channels belonging to their organisation.
| Government org channels are isolated — commercial users cannot subscribe.
|
*/

// Default user-presence channel
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return $user->id === $id;
});

// ── Store channel ─────────────────────────────────────────────────────────────
// Subscribed by: cashiers and managers of the specific store
// Events: SaleCompleted, ProductUpdated, StoreStatusChanged, LicenseWarning
Broadcast::channel('store.{storeId}', function ($user, string $storeId) {
    // Super Admin can subscribe to any store channel
    if ($user->role === 'super_admin') return true;

    // The store must belong to the user's organisation
    $store = Store::find($storeId);
    if (! $store || $store->organisation_id !== $user->organisation_id) return false;

    // Organisation Admin and Store Manager can access store channels
    if (in_array($user->role, ['organisation_admin', 'store_manager', 'cashier', 'auditor'])) {
        return true;
    }

    return false;
});

// ── Organisation channel ──────────────────────────────────────────────────────
// Subscribed by: Organisation Admin and Super Admin via dashboard
// Events: SaleCompleted (aggregated), ZReportSubmitted, StoreStatusChanged, LicenseWarning
Broadcast::channel('org.{orgId}', function ($user, string $orgId) {
    // Super Admin can subscribe to any org channel
    if ($user->role === 'super_admin') return true;

    // Organisation Admin and Store Manager can subscribe to their org channel
    if (in_array($user->role, ['organisation_admin', 'store_manager', 'auditor'])) {
        return $user->organisation_id === $orgId;
    }

    return false;
});

// ── Super Admin dashboard channel ────────────────────────────────────────────
// Only Super Admins — cross-org events (platform-wide license alerts, etc.)
Broadcast::channel('platform.admin', function ($user) {
    return $user->role === 'super_admin';
});
