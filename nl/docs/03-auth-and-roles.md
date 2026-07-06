# 3 — Auth & rollen

Sanctum tokens, TOTP 2FA, zeven RBAC-rollen, en de policies die cross-org reads stoppen. De hele flow zit in `backend/app/Http/Controllers/Api/AuthController.php` plus vier middlewares.

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

Het token in `token` is een Sanctum plaintext-token — `{tokenId}|{hash}`. De frontend bewaart het (POS in `localStorage` onder `josbin_pos_pos_token`, dashboard onder `josbin_pos_dashboard_token`) en stuurt het als `Authorization: Bearer <token>` op elke latere request.

Abilities = permissions. `createToken` propt elke Spatie-permission-naam in de abilities van het token, plus `2fa_verified` indien van toepassing. `tokenCan('sales.create')` op de server matcht dan één-op-één met Spatie's `can('sales.create')` — geen extra DB-lookup per request.

---

## 2FA — setup, challenge, lifecycle

Drie token-soorten met verschillende abilities en TTLs:

| Ability | TTL | Doel | Uitgegeven door |
|---|---|---|---|
| `two_factor_setup` | 30 min | Gebruiker moet TOTP-setup voltooien voor hij een echte token krijgt. | `login()` als `requires2FA() && !two_factor_confirmed_at` |
| `two_factor_challenge` | 10 min | Wachtwoord doorstaan; wacht op TOTP-code. | `login()` als `requires2FA() && two_factor_confirmed_at` |
| (volledige token, inclusief `2fa_verified`) | 12 u | Operationele sessie. | `twoFactorChallenge()`, `twoFactorConfirm()`, `login()` (no 2FA-pad), `refresh()` |

### Setup-flow (eerste keer)

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

`twoFactorSetup` zal *een nieuwe* `two_factor_secret` *genereren en persisteren* (encrypted) bij de eerste call. Bij retry retourneert hij de bestaande — dus het verversen van de QR-pagina is veilig.

`twoFactorConfirm` dwingt `tokenCan('two_factor_setup')` af. De setup-token wordt verwijderd bij succes. Recovery codes worden encrypted (`encrypt(json_encode(...))`) in `users.two_factor_recovery_codes` en **eenmaal** aan de gebruiker getoond.

### Challenge-flow (terugkerende gebruiker)

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

Twee opvallende keuzes:

- `two-factor-challenge` is het **enige** auth-endpoint dat niet achter `auth:sanctum` zit. De pre_auth_token zit in de body, niet in de header — dus de route staat in de public-groep (`backend/routes/api.php:52`).
- De 10-minuten TTL is kort genoeg dat een onderschepte pre_auth_token nauwelijks bruikbaar is, maar lang genoeg voor een gebruiker die met de authenticator-app prutst.

### 2FA verifiëren op elke latere request

`EnsureTwoFactor`-middleware (`backend/app/Http/Middleware/EnsureTwoFactor.php`):

```php
if (! $user->requires2FA())          return $next();
if (! $user->tokenCan('2fa_verified')) return 403 TWO_FACTOR_REQUIRED;
return $next();
```

Hij is geregistreerd als de `two_factor`-alias (`backend/bootstrap/app.php:35`), maar **niet** automatisch aangehaakt aan de globale API-groep. Je past hem toe op specifieke routes/groepen die een opnieuw-geverifieerde TOTP nodig hebben — bv. `Route::middleware('two_factor')->...`. Vandaag dragen slechts een handvol routes hem; uitbreiding van dekking is een per-endpoint-beslissing.

---

## 2FA-policy via `AppSetting`

Drie lagen bepalen of een gebruiker 2FA moet gebruiken:

1. **Always-on roles**: `User::TWO_FACTOR_ALWAYS_ROLES = ['super_admin', 'tax_inspector']`. Hardcoded. Kan niet uitgeschakeld worden — de tax inspector is per definitie overheid (Belastingdienst Suriname) en krijgt dus dezelfde behandeling als Super Admin.
2. **Always-on voor government orgs**: `isGovernmentUser()` (elke rol binnen een `is_government`-organisatie). Kan niet uitgeschakeld worden.
3. **Configureerbaar per rol**: Super Admin opteert rollen in voor verplichte 2FA via `AppSetting`.

`User::requires2FA()` (`backend/app/Models/User.php:210-219`):

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

De setting-key is `two_factor_required_roles`; waarde is een JSON-array van role-namen. `SecurityPolicyController` (`backend/app/Http/Controllers/Api/SecurityPolicyController.php`) leest en schrijft het via twee endpoints, beide gated naar Super Admin:

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/settings/two-factor-policy` | — |
| `PUT` | `/api/settings/two-factor-policy` | `{ two_factor_required_roles: [...] }` |

De controller beperkt de configureerbare set:

```php
// SecurityPolicyController.php:22-27
private const CONFIGURABLE_ROLES = [
    User::ROLE_ORGANISATION_ADMIN,
    User::ROLE_STORE_MANAGER,
    User::ROLE_CASHIER,
    User::ROLE_AUDITOR,
];
```

`super_admin` en `tax_inspector` zijn uitgesloten (altijd aan) en `api_integration` is uitgesloten (machine-account, API-key-auth, geen TOTP). De PUT-validator weigert waarden buiten deze lijst. `AppSetting` is `Auditable`, dus elke policy-wijziging staat in de immutable log.

De always-on-regel wordt ook aan de admin-kant afgedwongen: het 2FA-reset-endpoint van `UserController` weigert 2FA te strippen van `TWO_FACTOR_ALWAYS_ROLES` en government-gebruikers (`403 MANDATORY_2FA`, `backend/app/Http/Controllers/Api/UserController.php:338-345`).

---

## De zeven rollen

Gedefinieerd in `User::ROLES`-constants en geseed in `backend/database/seeders/RolesAndPermissionsSeeder.php`. Er zijn **49** permissions in de catalogus:

| Rol | Permissions | Scope |
|---|---:|---|
| `super_admin` | 49 (alle) | Platform-breed. Omzeilt elke policy via `before()`-hooks. |
| `organisation_admin` | 43 | Alleen hun eigen organisatie. |
| `store_manager` | 36 | Hun toegewezen vestiging (`users.store_id`). |
| `cashier` | 16 | POS-scherm + eigen-vestiging-rapporten. |
| `auditor` | 13 | Read-only — voor govt-compliance-officers. |
| `api_integration` | 4 | Machine-account, API-key-auth, geen UI. |
| `tax_inspector` | 3 | Cross-organisatie, read-only, uitsluitend BTW-aangiften. |

De vier `api_integration`-permissions zijn `sales.create`, `sales.view`, `products.view`, `reports.daily` — precies het oppervlak dat een POS-systeem van derden nodig heeft om verkopen te pushen en een daily total te pullen.

De drie `tax_inspector`-permissions zijn `btw.view_submissions`, `btw.review_submission`, `audit.view` — aangiften lezen over elke organisatie heen, ze accepteren/betwisten, en het eigen actie-spoor zien. Verder niets: geen catalogus, geen verkoopdetails, geen klanten. Zie de eigen sectie hieronder.

### Permission-catalogus in één oogopslag

| Groep | Permissions |
|---|---|
| Sales | `sales.create`, `sales.view`, `sales.void`, `sales.void.approve`, `sales.refund`, `sales.hold`, `sales.restore` |
| Products | `products.view`, `products.create`, `products.edit`, `products.delete`, `products.import`, `products.sync`, `products.set_btw`, `products.view_cost` |
| Customers | `customers.view`, `customers.create`, `customers.edit` |
| Reports | `reports.daily`, `reports.monthly`, `reports.custom`, `reports.top_products`, `reports.x_report`, `reports.z_report`, `reports.export`, `reports.btw`, `reports.rekenkamer` |
| Rates | `rates.view`, `rates.lock`, `rates.override` |
| Z-Report | `z_report.close`, `z_report.submit`, `z_report.view_history` |
| Users | `users.view`, `users.create`, `users.edit`, `users.delete` |
| Admin | `categories.manage`, `stores.manage`, `organisations.manage`, `api_integrations.manage`, `discount_rules.manage`, `settings.manage` |
| BTW-aangiften | `btw.submit`, `btw.view_submissions`, `btw.review_submission` |
| Other | `ai.insights`, `labels.print`, `audit.view` |

Aantekeningen bij de minder voor de hand liggende:

- `sales.void.approve` is de tweede-goedkeurder-permission die gebruikt wordt door government segregation-of-duties (zie hieronder).
- `products.set_btw` (alleen OA) gate het BTW-tarief / `btw_exempt`-veld op een product — misclassificatie heeft gevolgen voor de Belastingdienst-aangifte. SM heeft `products.edit`, maar deze twee velden worden stilzwijgend gestript door `ProductController::applyBtwGate`.
- `products.view_cost` (SA/OA/SM) toont `cost_price` + marge op product-payloads en gate het winstrapport. Kassiers zien nooit kostprijzen op de kassa.
- `btw.submit` (OA + SM) dient BTW-aangiften in; `btw.view_submissions` (OA, SM, tax_inspector, SA) toont ze; `btw.review_submission` (alleen tax_inspector, naast de `before()`-bypass van SA) accepteert/betwist ze. De aangifte-pijplijn is [hoofdstuk 5](05-btw-pipeline.md).

### Spatie-tabellen

De permission-engine is `spatie/laravel-permission`. Vier tabellen, allemaal met bigint PKs (de role/permission IDs zijn geen UUIDs omdat de catalogus klein en stabiel is):

| Tabel | Bevat |
|---|---|
| `permissions` | `id`, `name`, `guard_name` — één rij per permission-string hierboven. |
| `roles` | `id`, `name`, `guard_name` — zeven rijen. |
| `role_has_permissions` | `(permission_id, role_id)` — de matrix hierboven, ~164 rijen totaal. |
| `model_has_roles` | `(role_id, model_type, model_id)` — koppelt een `User`-UUID aan een rol. |
| `model_has_permissions` | Dezelfde vorm, voor ad-hoc per-user-grants. Vandaag ongebruikt. |

De vendor-migration gaat uit van een bigint user-PK; `2026_04_12_200014_fix_permission_tables_for_uuid.php` verbreedt `model_id` om UUIDs te kunnen bevatten.

---

## De zevende rol — `tax_inspector` (Belastingdienst Suriname)

Een belastingambtenaar van de Belastingdienst Suriname. Alles aan deze rol is bewust smal:

- **Cross-organisatie by design.** De Belastingdienst reguleert elke belastingplichtige op het platform, dus de inspecteur leest BTW-aangiften over *alle* organisaties heen — naast Super Admin de enige rol die dat doet. `User::isCrossOrgRole()` (`backend/app/Models/User.php:158-164`) retourneert true voor exact `super_admin` en `tax_inspector`; controllers gebruiken het om de eigen-org-scoping `WHERE organisation_id = ?` over te slaan (`BtwSubmissionController::applyListFilters`, `OrganisationController::index`).
- **Read-only, alleen BTW-aangiften.** `btw.view_submissions` + `btw.review_submission` + `audit.view` (eigen actie-spoor). `BtwSubmissionPolicy::create` vereist `organisation_id !== null`, dus een inspecteur kan nooit namens een belastingplichtige indienen; `supersede` is evenzeer buiten bereik — dat zou valsheid in geschrifte zijn.
- **`organisation_id` is NULL.** Net als Super Admin hoort de inspecteur bij geen enkele tenant. Elk endpoint dat scoped met `where('organisation_id', $user->organisation_id)` retourneert voor deze rol *niets* — dat is de valkuil. Hij heeft al één keer gebeten: `OrganisationController::index` special-casede oorspronkelijk alleen `isSuperAdmin()`, waardoor de inspecteur in de eigen-org-branch belandde waar `where('id', null)` een leeg org-filter op het BTW-scherm opleverde. De fix stuurt elke cross-org-rol door de platform-brede branch (`OrganisationController.php:31-43`). Gebruik `isCrossOrgRole()` — niet `isSuperAdmin()` — zodra je cross-org leesoppervlak toevoegt.
- **2FA verplicht, niet-omzeilbaar.** `tax_inspector` staat in `User::TWO_FACTOR_ALWAYS_ROLES` naast `super_admin`; de policy-`AppSetting` kan het niet uitschakelen en het admin-2FA-reset-endpoint weigert (`MANDATORY_2FA`).
- **Alleen door Super Admin aan te maken.** `UserController::MANAGEABLE_ROLES` geeft OA/SM geen pad naar de rol (`backend/app/Http/Controllers/Api/UserController.php:21-32`).
- **Overheids-gebrand login-portaal.** Het dashboard serveert een aparte Belastingdienst-login op `/belastingdienst` (ook `?belastingdienst` voor setups zonder SPA-path-fallback) — gedetecteerd in `dashboard/src/App.tsx:13-18`, gerenderd door `dashboard/src/screens/BelastingdienstLoginScreen.tsx`. Onderliggend dezelfde `POST /api/auth/login` + 2FA-challenge; alleen de chrome verschilt. Na login landt de inspecteur op `TaxInspectorDashboard.tsx`.

Wat de inspecteur dag-in-dag-uit doet — review-queue, accepteren/betwisten, bulk-accept, CSV-export — staat bij de aangifte-pijplijn in [5 — BTW-pijplijn](05-btw-pipeline.md).

---

## User-helpers

Een handvol predicates in `backend/app/Models/User.php` houdt policy-code leesbaar:

| Method | Retourneert true wanneer |
|---|---|
| `isSuperAdmin()` | `role === 'super_admin'` |
| `isAtLeastManager()` | role in `[super_admin, organisation_admin, store_manager]` |
| `isOrgScopedRole()` | role in `[super_admin, organisation_admin, auditor, api_integration, tax_inspector]` — org-niveau-rollen zonder eigen vestiging (`users.store_id` NULL) |
| `isStoreBound()` | role in `[cashier, store_manager]` — hoort bij exact één vestiging, geen "alle vestigingen in de org"-bereik |
| `isCrossOrgRole()` | role in `[super_admin, tax_inspector]` — kijkt over organisaties heen |
| `isGovernmentUser()` | `organisation->is_government === true` |
| `requires2FA()` | always-on-rol OF govt org OF geconfigureerd via AppSetting |

`canAccessStore($storeId)` combineert ze tot de ene vraag die de meeste endpoints stellen: Super Admin → elke vestiging; org-scoped rollen → elke vestiging binnen hun organisatie; store-bound rollen → alleen `users.store_id === $storeId` (`backend/app/Models/User.php:177-187`).

`isAtLeastManager` is waar de meeste "toon me iets dat aggregeert over gebruikers"-checks op leunen. `isGovernmentUser` flipt de geo-alert, single-device-afdwinging en verplichte 2FA — hieronder besproken. `isStoreBound` is wat de BTW-aangiften, rapporten en voorraadviews van een Store Manager op de eigen vestiging vastpint.

---

## Cross-org data-isolatie

Twee guards sloten echte lekken tijdens de sessie-5-audit. Beide zijn verplicht; ship nooit een nieuwe route die een `store_id` of sale-ID neemt zonder ze.

### `StoreBelongsToOrg`-validatieregel

`backend/app/Rules/StoreBelongsToOrg.php`. Vervangt de vorige `exists:stores,id`-regel, die alleen het bestaan controleerde — wat een gebruiker van één organisatie de store-ID van een andere organisatie liet doorgeven en zijn verkopen, rapporten, kassa's liet lezen.

```php
'store_id' => ['required', 'uuid', new \App\Rules\StoreBelongsToOrg],
```

De regel:

1. Laadt de geauthenticeerde gebruiker.
2. Super Admin: alleen existence check.
3. Iedereen anders: `Store::where('id', $value)->where('organisation_id', $user->organisation_id)->exists()`.

Als de vestiging bij een andere org hoort, faalt de regel met "The selected store does not belong to your organisation."

Pas dit toe in elke FormRequest of `$request->validate()` die een store-ID accepteert — sales, reports, register-operaties, prijs-overrides, discount rules.

### `SalePolicy::ownsSale`

`backend/app/Policies/SalePolicy.php`. Per-verkoop reads, voids en refunds checken dat de vestiging van de verkoop binnen de organisatie van de caller zit:

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

Voor deze guard kon een kassier van org A `GET /api/sales/{uuid}` doen voor een verkoop in org B — de controller checkte alleen `sales.view`, wat de kassier had. Nu: permission **en** ownership.

Super Admin omzeilt via `before()`:

```php
public function before(User $user): ?bool
{
    return $user->isSuperAdmin() ? true : null;
}
```

Andere policies in de codebase volgen hetzelfde patroon: `CustomerPolicy`, `ProductPolicy`, `StorePolicy`, `OrganisationPolicy`, `CategoryPolicy`, `UserPolicy`.

---

## Sessie-timeout — wat er werkelijk wordt afgedwongen

De CLAUDE.md-target is "15 min POS, 60 min dashboard". De realiteit is bescheidener:

- **Server-zijde.** Tokens worden uitgegeven met `expiresAt: now()->addHours(12)`. `SessionTimeout`-middleware (`backend/app/Http/Middleware/SessionTimeout.php`) loopt op elke geauthenticeerde API-request en retourneert `401 SESSION_EXPIRED` zodra `expires_at` in het verleden ligt, het token tegelijk verwijderend. Dat is het — er is geen server-side idle timer die een token eerder revocet dan zijn opgegeven expiry.
- **Client-zijde.** Noch `frontend/src/store/authStore.ts` noch `dashboard/src/store/authStore.ts` implementeert een idle-clock die `logout()` aanroept na N minuten inactiviteit. Beide stores vertrouwen uitsluitend op de `expires_at` van de server, geretourneerd bij login.

Als de 15/60-minuten idle-policy vereist is voor compliance, moet die nog gebouwd worden: een client-side idle timer die `POST /api/auth/logout` aanroept en een (toekomstige) `last_activity_at`-kolom die de middleware kan checken.

Documenteer deze gap liever dan eroverheen te schilderen.

---

## Government-org-regels

Getriggerd wanneer `organisations.is_government === true`. Allemaal geconcentreerd in `AuthController::handlePostLoginChecks` (aangeroepen na zowel normale login als 2FA-challenge) en de always-on `requires2FA()`-flag.

### Verplichte niet-omzeilbare 2FA

`User::requires2FA()` retourneert true voor elke gebruiker binnen een govt-org, ongeacht rol of AppSetting. Er is geen manier om eruit te stappen behalve `organisations.is_government` op false te zetten.

### Single-device-afdwinging

Elke succesvolle login van een govt-gebruiker revocet alle andere Sanctum-tokens van die gebruiker voordat de nieuwe wordt uitgegeven:

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

De `not like '2fa-%'` houdt eventuele actieve setup- of challenge-tokens in leven zodat een parallelle 2FA-flow niet verstoord wordt. De geforceerde revocation wordt vastgelegd in de audit log.

### Geo-alert (geen block)

`checkGeoAlert($user, $ip)` roept `ip-api.com` aan en, als de landcode niet `SR` is, logt `geo_alert_login` en e-mailt de org-admin in zijn locale (Nederlandse of Engelse template). Het blokkeert de login nooit — gefaalde lookups blokkeren ook nooit. Private/loopback-IPs worden overgeslagen zodat lokale installaties geen alerts spammen.

### Dual approval voor terugbetalingen

De `sales.void.approve`-permission bestaat voor government segregation-of-duties: geen enkele gebruiker maakt EN keurt een terugbetaling goed. Het schema ondersteunt het via `sales.void_approved_by` (`backend/database/migrations/2026_04_12_200008_create_sales_table.php:31`). De permission wordt alleen verleend aan `super_admin` en `organisation_admin` — `store_manager` en `cashier` kunnen aanvragen, maar kunnen hun eigen niet goedkeuren. De configureerbare SRD-drempel die in de brief genoemd wordt is een per-org-setting; vandaag accepteert de controller-logic een `void_approved_by`-veld maar de afdwinging van de dual-approval-vereiste op high-value voids wordt nog gebouwd — zoek naar TODOs in `SaleController::void`.

---

## Wachtwoordopslag — bcrypt cost 12

`.env.example:89` zet `BCRYPT_ROUNDS=12`. Laravels `Hash::make` produceert dan een `$2y$12$...`-hash op elke `User::create` / `update(['password' => ...])` — de `password`-cast van het User-model is `'hashed'` (`backend/app/Models/User.php:40`), zodat plain-text writes automatisch worden gehasht.

Waarom cost 12: elke `Hash::check` duurt ongeveer 250 ms op commodity hardware. Het brute-forcen van 10.000 kandidaat-wachtwoorden tegen één hash op één CPU duurt ~40 minuten. Tegen een gestolen wachtwoordbestand met 100 hashes is dat ~70 uur per aanvallers-machine — traag genoeg dat detectie-en-rotatie de cracker verslaat.

Costs boven 12 zouden trager zijn bij login; onder 12 zou niet bijhouden met moderne GPU-cracking. 12 is de huidige door de industrie aanbevolen vloer voor bcrypt en wat OWASP momenteel adviseert.

De rate limiter in `AuthController::login` voegt de tweede lijn toe: 5 failures in 5 minuten per `email + ip`, retournerend `429` met `seconds` tot volgende poging. De progressieve 1/2/4/8s-delay beschreven in de brief is vandaag niet geïmplementeerd — de limiter is een vast venster.

---

## Token-levensduren en refresh

| Token-soort | Aangemaakt door | TTL | Doel |
|---|---|---:|---|
| Full session | `login`, `twoFactorChallenge`, `twoFactorConfirm`, `refresh` | 12 u | De alledaagse Bearer-token. |
| `2fa-setup` | `login` (setup-branch) | 30 min | Laat de gebruiker de QR-code ophalen en bevestigen. |
| `2fa-challenge` | `login` (challenge-branch) | 10 min | Laat de gebruiker de TOTP indienen na wachtwoord. |

`POST /api/auth/refresh` (`backend/app/Http/Controllers/Api/AuthController.php:311-336`) roteert een volledig token:

1. Lees het huidige token via `$user->currentAccessToken()`.
2. Herlees elke permission van Spatie (een re-issue pikt rolwijzigingen op).
3. Behoud `2fa_verified` als de vorige token het had.
4. Maak een vers token met `expiresAt: now()->addHours(12)`.
5. Verwijder het oude token.
6. Retourneer `{ token, expires_at }`.

Refresh is **niet** automatisch — de frontend moet het aanroepen vóór `expires_at`. Er is geen refresh-token / access-token-split; dezelfde Sanctum-token wordt op zijn plek geroteerd.

`POST /api/auth/logout` verwijdert het huidige token. `POST /api/auth/logout-all` verwijdert elk token dat de gebruiker bezit (over alle apparaten) — nuttig voor "Ik ben mijn laptop kwijt" en als klik-target voor een admin die sessies revocet.

---

## Het samenstellen — middleware-volgorde op `/api/*`

Voor elke Sanctum-guarded API-call:

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

Volgorde is gezet in `backend/bootstrap/app.php:22-39`. De `two_factor`-middleware is opt-in per route — hij is gedefinieerd als een alias maar niet aan de globale groep geplakt.

---

→ [4 — Verkooplevenscyclus](04-sale-lifecycle.md)
