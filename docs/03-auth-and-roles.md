# 3 — Auth & roles

Sanctum tokens, TOTP 2FA, six RBAC roles, and the policies that stop cross-org reads. The whole flow lives in `backend/app/Http/Controllers/Api/AuthController.php` plus four middlewares.

---

## Login — happy path

```
1. POST /api/auth/login
   { email, password, device_name? }

2. AuthController::login                    backend/.../AuthController.php:28
     ├── validate
     ├── RateLimiter check                  5 failures / 5 min, keyed by email+ip
     ├── User lookup                        WHERE email = ?
     ├── Hash::check (bcrypt cost 12)
     ├── is_active gate
     ├── update last_login_at
     │
     ├── if requires2FA():
     │     ├── if !two_factor_confirmed_at  → return two_factor_setup_required
     │     └── else                         → return two_factor_required + pre_auth_token
     │
     └── handlePostLoginChecks              govt: single-device + geo-alert

3. createToken(name, abilities, expiresAt: now()->addHours(12))
   abilities = user.getAllPermissions().pluck('name')

4. Response 200:
   { token, expires_at, user: { id, name, email, role, locale,
     permissions, requires_2fa, two_factor_confirmed, organisation_id } }
```

The token in `token` is a Sanctum plaintext token — `{tokenId}|{hash}`. The frontend stores it (POS in `localStorage` under `josbin_pos_pos_token`, dashboard under `josbin_pos_dashboard_token`) and sends it as `Authorization: Bearer <token>` on every later request.

Abilities = permissions. `createToken` stuffs every Spatie permission name into the token's abilities, plus `2fa_verified` if applicable. `tokenCan('sales.create')` on the server then matches one-for-one with Spatie's `can('sales.create')` — no extra DB lookup per request.

---

## 2FA — setup, challenge, lifecycle

Three token kinds with different abilities and TTLs:

| Ability | TTL | Purpose | Issued by |
|---|---|---|---|
| `two_factor_setup` | 30 min | User must complete TOTP setup before getting a real token. | `login()` if `requires2FA() && !two_factor_confirmed_at` |
| `two_factor_challenge` | 10 min | Password passed; awaiting TOTP code. | `login()` if `requires2FA() && two_factor_confirmed_at` |
| (full token, includes `2fa_verified`) | 12 h | Operational session. | `twoFactorChallenge()`, `twoFactorConfirm()`, `login()` (no 2FA path), `refresh()` |

### Setup flow (first time)

```
POST /api/auth/login                       password OK
  → { two_factor_setup_required: true, setup_token, user }

GET  /api/auth/two-factor/setup            Bearer setup_token
  → { secret, qr_code_url }                ← user scans QR in authenticator app

POST /api/auth/two-factor/confirm          Bearer setup_token + { code }
  ├── Google2FA::verifyKey
  ├── set two_factor_confirmed_at = now()
  ├── generate 8 recovery codes (16 hex bytes, "XXXXX-XXXXX")
  ├── delete setup_token
  └── issue full token (includes 2fa_verified)
  → { token, expires_at, user, recovery_codes }
```

`twoFactorSetup` will *generate and persist* a new `two_factor_secret` (encrypted) on first call. On retry it returns the existing one — so refreshing the QR page is safe.

`twoFactorConfirm` enforces `tokenCan('two_factor_setup')`. The setup token is deleted on success. Recovery codes are encrypted (`encrypt(json_encode(...))`) into `users.two_factor_recovery_codes` and shown **once** to the user.

### Challenge flow (returning user)

```
POST /api/auth/login                       password OK
  → { two_factor_required: true, pre_auth_token }

POST /api/auth/two-factor-challenge        ← no Sanctum guard; pre_auth_token in body
  body: { pre_auth_token, code }
  ├── PersonalAccessToken::findToken
  ├── tokenCan('two_factor_challenge')
  ├── expires_at check                     auto-delete on expiry
  ├── Google2FA::verifyKey(secret, code)
  ├── delete pre_auth_token
  └── issue full token (includes 2fa_verified)
  → { token, expires_at, user }
```

Two notable choices:

- `two-factor-challenge` is the **only** auth endpoint that isn't behind `auth:sanctum`. The pre_auth_token is in the body, not the header — so the route is in the public group (`backend/routes/api.php:52`).
- The 10-minute TTL is short enough that an intercepted pre_auth_token is barely useful but long enough for a user who fumbles the authenticator app.

### Verifying 2FA on every later request

`EnsureTwoFactor` middleware (`backend/app/Http/Middleware/EnsureTwoFactor.php`):

```php
if (! $user->requires2FA())          return $next();
if (! $user->tokenCan('2fa_verified')) return 403 TWO_FACTOR_REQUIRED;
return $next();
```

It's registered as the `two_factor` alias (`backend/bootstrap/app.php:35`), but **not** auto-attached to the global API group. You apply it to specific routes/groups that need a re-verified TOTP — e.g. `Route::middleware('two_factor')->...`. Today only a handful of routes wear it; expanding coverage is a per-endpoint decision.

---

## 2FA policy via `AppSetting`

Two layers decide whether a user must use 2FA:

1. **Always-on roles**: `User::TWO_FACTOR_ALWAYS_ROLES = ['super_admin']`. Hardcoded. Cannot be disabled.
2. **Always-on for government orgs**: `isGovernmentUser()` (any role inside an `is_government` organisation). Cannot be disabled.
3. **Configurable per role**: Super Admin opts roles into mandatory 2FA via `AppSetting`.

`User::requires2FA()` (`backend/app/Models/User.php:112-121`):

```php
public function requires2FA(): bool
{
    if (in_array($this->role, self::TWO_FACTOR_ALWAYS_ROLES, true)
        || $this->isGovernmentUser()) {
        return true;
    }
    $policyRoles = AppSetting::get(self::TWO_FACTOR_POLICY_KEY, []);
    return is_array($policyRoles) && in_array($this->role, $policyRoles, true);
}
```

The setting key is `two_factor_required_roles`; value is a JSON array of role names. `SecurityPolicyController` (`backend/app/Http/Controllers/Api/SecurityPolicyController.php`) reads and writes it via two endpoints, both gated to Super Admin:

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/settings/two-factor-policy` | — |
| `PUT` | `/api/settings/two-factor-policy` | `{ two_factor_required_roles: [...] }` |

The controller restricts the configurable set:

```php
// SecurityPolicyController.php:22-27
private const CONFIGURABLE_ROLES = [
    User::ROLE_ORGANISATION_ADMIN,
    User::ROLE_STORE_MANAGER,
    User::ROLE_CASHIER,
    User::ROLE_AUDITOR,
];
```

`super_admin` is excluded (always on) and `api_integration` is excluded (machine account, API-key auth, no TOTP). The PUT validator rejects values outside this list. `AppSetting` is `Auditable`, so every policy change is in the immutable log.

---

## The six roles

Defined in `User::ROLES` constants and seeded in `backend/database/seeders/RolesAndPermissionsSeeder.php`. There are **44** permissions in the catalogue:

| Role | Permissions | Scope |
|---|---:|---|
| `super_admin` | 44 (all) | Platform-wide. Bypasses every policy via `before()` hooks. |
| `organisation_admin` | 39 | Their own organisation only. |
| `store_manager` | 33 | Their assigned store(s). |
| `cashier` | 16 | POS screen + own-store reports. |
| `auditor` | 13 | Read-only — for govt compliance officers. |
| `api_integration` | 4 | Machine account, API-key auth, no UI. |

The four `api_integration` permissions are `sales.create`, `sales.view`, `products.view`, `reports.daily` — exactly the surface a third-party POS needs to push sales and pull a daily total.

### Permission catalogue at a glance

| Group | Permissions |
|---|---|
| Sales | `sales.create`, `sales.view`, `sales.void`, `sales.void.approve`, `sales.refund`, `sales.hold`, `sales.restore` |
| Products | `products.view`, `products.create`, `products.edit`, `products.delete`, `products.import`, `products.sync` |
| Customers | `customers.view`, `customers.create`, `customers.edit` |
| Reports | `reports.daily`, `reports.monthly`, `reports.custom`, `reports.top_products`, `reports.x_report`, `reports.z_report`, `reports.export`, `reports.btw`, `reports.rekenkamer` |
| Rates | `rates.view`, `rates.lock`, `rates.override` |
| Z-Report | `z_report.close`, `z_report.submit`, `z_report.view_history` |
| Users | `users.view`, `users.create`, `users.edit`, `users.delete` |
| Admin | `categories.manage`, `stores.manage`, `organisations.manage`, `api_integrations.manage`, `discount_rules.manage`, `settings.manage` |
| Other | `ai.insights`, `labels.print`, `audit.view` |

`sales.void.approve` is the second-approver permission used by government segregation-of-duties (see below).

### Spatie tables

The permission engine is `spatie/laravel-permission`. Four tables, all with bigint PKs (the role/permission IDs aren't UUIDs because the catalogue is small and stable):

| Table | Holds |
|---|---|
| `permissions` | `id`, `name`, `guard_name` — one row per permission string above. |
| `roles` | `id`, `name`, `guard_name` — six rows. |
| `role_has_permissions` | `(permission_id, role_id)` — the matrix above, ~109 rows total. |
| `model_has_roles` | `(role_id, model_type, model_id)` — links a `User` UUID to a role. |
| `model_has_permissions` | Same shape, for ad-hoc per-user grants. Unused today. |

The vendor migration assumes a bigint user PK; `2026_04_12_200014_fix_permission_tables_for_uuid.php` widens `model_id` to hold UUIDs.

---

## User helpers

Three predicates in `backend/app/Models/User.php` keep policy code readable:

| Method | Returns true when |
|---|---|
| `isSuperAdmin()` | `role === 'super_admin'` |
| `isAtLeastManager()` | role in `[super_admin, organisation_admin, store_manager]` |
| `requires2FA()` | always-on OR govt org OR configured via AppSetting |
| `isGovernmentUser()` | `organisation->is_government === true` |

`isAtLeastManager` is what most "show me anything that aggregates across users" checks lean on. `isGovernmentUser` flips the geo-alert, single-device enforcement, and mandatory 2FA — discussed below.

---

## Cross-org data isolation

Two guards closed real leaks during the session-5 audit. Both are mandatory; never ship a new route that takes a `store_id` or sale ID without them.

### `StoreBelongsToOrg` validation rule

`backend/app/Rules/StoreBelongsToOrg.php`. Replaces the previous `exists:stores,id` rule, which only checked existence — letting one organisation's user pass another organisation's store ID and read its sales, reports, registers.

```php
'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
```

The rule:

1. Loads the authenticated user.
2. Super Admin: existence check only.
3. Everyone else: `Store::where('id', $value)->where('organisation_id', $user->organisation_id)->exists()`.

If the store belongs to another org, the rule fails with "The selected store does not belong to your organisation."

Apply this in every FormRequest or `$request->validate()` that accepts a store ID — sales, reports, register operations, price overrides, discount rules.

### `SalePolicy::ownsSale`

`backend/app/Policies/SalePolicy.php`. Per-sale reads, voids, and refunds check that the sale's store is inside the caller's organisation:

```php
private function ownsSale(User $user, Sale $sale): bool
{
    return $sale->store?->organisation_id === $user->organisation_id;
}

public function view(User $user, Sale $sale): bool
{
    return $user->can('sales.view') && $this->ownsSale($user, $sale);
}
```

Before this guard a cashier from org A could `GET /api/sales/{uuid}` for a sale in org B — the controller only checked `sales.view`, which the cashier had. Now: permission **and** ownership.

Super Admin bypasses via `before()`:

```php
public function before(User $user): ?bool
{
    return $user->isSuperAdmin() ? true : null;
}
```

Other policies in the codebase follow the same pattern: `CustomerPolicy`, `ProductPolicy`, `StorePolicy`, `OrganisationPolicy`, `CategoryPolicy`, `UserPolicy`.

---

## Session timeout — what's actually enforced

The CLAUDE.md target is "15 min POS, 60 min dashboard". The reality is more modest:

- **Server side.** Tokens are issued with `expiresAt: now()->addHours(12)`. `SessionTimeout` middleware (`backend/app/Http/Middleware/SessionTimeout.php`) runs on every authenticated API request and returns `401 SESSION_EXPIRED` once `expires_at` is in the past, deleting the token at the same time. That's it — there is no server-side idle timer that revokes a token earlier than its declared expiry.
- **Client side.** Neither `frontend/src/store/authStore.ts` nor `dashboard/src/store/authStore.ts` implements an idle-clock that calls `logout()` after N minutes of inactivity. Both stores rely solely on the server's `expires_at` returned at login.

If the 15/60-minute idle policy is required for compliance, it still needs to be built: a client-side idle timer that calls `POST /api/auth/logout` and a (future) `last_activity_at` column the middleware could check.

Document this gap rather than paper over it.

---

## Government-org rules

Triggered when `organisations.is_government === true`. All concentrated in `AuthController::handlePostLoginChecks` (called after both normal login and 2FA challenge) and the always-on `requires2FA()` flag.

### Mandatory non-bypassable 2FA

`User::requires2FA()` returns true for every user inside a government org, regardless of role or AppSetting. No way to opt out short of flipping `organisations.is_government` to false.

### Single-device enforcement

Every successful login from a government user revokes all of that user's other Sanctum tokens before issuing the new one:

```php
// AuthController.php:355-372
if ($isGovt) {
    $user->tokens()
        ->where('name', 'not like', '2fa-%')
        ->delete();
    AuditLog::create([
        'event' => 'single_device_logout',
        'new_values' => json_encode(['reason' => 'govt single-device enforcement', 'ip' => $request->ip()]),
        ...
    ]);
}
```

The `not like '2fa-%'` keeps any active setup or challenge tokens alive so a parallel 2FA flow isn't disrupted. The forced revocation is recorded in the audit log.

### Geo-alert (not block)

`checkGeoAlert($user, $ip)` calls `ip-api.com` and, if the country code isn't `SR`, logs `geo_alert_login` and emails the org admin in their locale (Dutch or English template). It never blocks the login — failed lookups also never block. Private/loopback IPs are skipped so local installs don't spam alerts.

### Dual approval for refunds

The `sales.void.approve` permission exists for government segregation-of-duties: no single user creates AND approves a refund. The schema supports it via `sales.void_approved_by` (`backend/database/migrations/2026_04_12_200008_create_sales_table.php:31`). Permission is granted to `super_admin` and `organisation_admin` only — `store_manager` and `cashier` can request, but can't approve their own. The configurable SRD threshold mentioned in the brief is a per-org setting; today the controller logic accepts a `void_approved_by` field but enforcement of the dual-approval requirement on high-value voids is still being built — search for TODOs in `SaleController::void`.

---

## Password storage — bcrypt cost 12

`.env.example:89` sets `BCRYPT_ROUNDS=12`. Laravel's `Hash::make` then produces a `$2y$12$...` hash on every `User::create` / `update(['password' => ...])` — the User model's `password` cast is `'hashed'` (`backend/app/Models/User.php:40`), so plain-text writes are hashed automatically.

Why cost 12: each `Hash::check` takes roughly 250 ms on commodity hardware. Brute-forcing 10,000 candidate passwords against a single hash on a single CPU takes ~40 minutes. Against a stolen password file with 100 hashes, that's ~70 hours per attacker machine — slow enough that detection-and-rotation beats the cracker.

Costs above 12 would be slower at login; below 12 wouldn't keep up with modern GPU cracking. 12 is the present industry-recommended floor for bcrypt and what OWASP currently advises.

The rate limiter in `AuthController::login` adds the second line: 5 failures in 5 minutes per `email + ip`, returning `429` with `seconds` until next attempt. The progressive 1/2/4/8s delay described in the brief is not implemented today — the limiter is a fixed window.

---

## Token lifetimes and refresh

| Token kind | Created by | TTL | Purpose |
|---|---|---:|---|
| Full session | `login`, `twoFactorChallenge`, `twoFactorConfirm`, `refresh` | 12 h | The everyday Bearer token. |
| `2fa-setup` | `login` (setup branch) | 30 min | Lets the user fetch the QR code and confirm. |
| `2fa-challenge` | `login` (challenge branch) | 10 min | Lets the user submit the TOTP after password. |

`POST /api/auth/refresh` (`backend/app/Http/Controllers/Api/AuthController.php:311-336`) rotates a full token:

1. Read current token via `$user->currentAccessToken()`.
2. Re-read every permission from Spatie (a re-issue picks up role changes).
3. Preserve `2fa_verified` if the prior token had it.
4. Create a fresh token with `expiresAt: now()->addHours(12)`.
5. Delete the old token.
6. Return `{ token, expires_at }`.

Refresh is **not** automatic — the frontend must call it before `expires_at`. There is no refresh-token / access-token split; the same Sanctum token is rotated in place.

`POST /api/auth/logout` deletes the current token. `POST /api/auth/logout-all` deletes every token the user owns (across all devices) — useful for "I lost my laptop" and as the click target for an admin revoking sessions.

---

## Putting it together — middleware order on `/api/*`

For every Sanctum-guarded API call:

```
nginx → php-fpm → Laravel API group
  1. EnforceFrameGuard, etc. (default web middleware)
  2. auth:sanctum                          401 if no/bad token
  3. SessionTimeout                        401 SESSION_EXPIRED if token past expires_at
  4. EnsureLicenseValid                    403 if license hard-locked
  5. TrackStoreActivity                    bump stores.last_activity_at (throttled)
  6. (route-specific) two_factor           403 TWO_FACTOR_REQUIRED if no 2fa_verified ability
  7. (route-specific) can:permission       403 if permission missing
  8. Controller + Policy
```

Order is set in `backend/bootstrap/app.php:22-39`. The `two_factor` middleware is opt-in per route — it's defined as an alias but not glued onto the global group.

---

→ [4 — Sale lifecycle](04-sale-lifecycle.md)
