# 11 — License & delivery pipeline

Licensing protects the vendor's business. The design protects the *client's* data so they are never held hostage: even if a licence lapses, every BTW filing, Rekenkamer export and raw CSV remains accessible. This chapter walks the full pipeline — from issuing a license on a separate Laravel server, through IonCube-encoding the backend and code-signing the Electron installer, to the daily validation pings that decide whether banners, soft-lock or hard-lock applies.

---

## 11.1 The three things that protect Josbin POS

| Layer | What it controls | Lives in |
|---|---|---|
| **License system** | WHO can run the software, FOR HOW LONG, on HOW MANY terminals | `/license-server` (separate Laravel app) + `backend/app/Services/LicenseService.php` |
| **IonCube code protection** | Humans cannot read the PHP source delivered to the client | `scripts/encode-ioncube.sh` + `docker/php/Dockerfile:39` |
| **Electron code signing** | Windows can verify the `.exe` came from the vendor | `frontend/package.json:73` + `frontend/build/entitlements.mac.plist` |

The three are independent. A client could legally buy the encoded source, but it would not run without a valid license. A leaked installer would refuse to activate against the license server. A counterfeit `.exe` would trip SmartScreen because the signature does not match.

---

## 11.2 The license server (separate Laravel app)

The license server lives at `/license-server` and runs as its own application — separate database, separate deploy, separate auth. The vendor operates it; no client ever has access to it.

### Why separate

| Why | Consequence |
|---|---|
| Vendor controls the source of truth | A client cannot patch `License::computeStatus()` to always return `active` |
| Smaller blast radius | A bug in the POS cannot leak license data; a bug in the license server cannot affect a live till |
| Independent uptime | License server can be down for 72 h without stopping a single sale (offline grace, §11.4) |
| Lives outside Suriname | License keys / billing data not subject to local server seizure |

### Schema

Three tables. Verified against the migrations.

`licenses` — one row per customer organisation. `license-server/database/migrations/2026_05_23_000001_create_licenses_table.php:17`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary |
| `license_key_hash` | string, unique | SHA-256 of the raw key; the raw key is never stored |
| `license_key_prefix` | string | e.g. `JOSBIN-AB12` — display only |
| `organisation_name` | string | |
| `contact_email` | string nullable | |
| `tier` | string | `basic` \| `standard` \| `enterprise` (validated in `Admin\LicenseController::TIERS`) |
| `max_stores` | uint | hard cap |
| `max_terminals` | uint | hard cap, enforced at activation |
| `valid_from`, `valid_until` | date | renewal timeline reads from `valid_until` |
| `is_active` | bool | |
| `revoked_at`, `revoked_reason` | timestamptz, string | non-null = revoked |
| `notes` | text | vendor's internal notes |

`license_activations` — one row per installation bound to a license. `…000002_create_license_activations_table.php:18`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | primary |
| `license_id` | uuid FK | cascade delete |
| `installation_key` | string, unique | per-install token, sent on every `/api/validate` call |
| `hardware_mac`, `hardware_cpu`, `hardware_uuid` | string nullable | raw identifiers |
| `hardware_fingerprint` | string nullable, indexed | SHA-256 of lowercased `mac\|cpu\|uuid` |
| `hostname` | string nullable | |
| `last_ip` | string nullable | |
| `last_validated_at`, `activated_at` | timestamptz | |
| `is_active` | bool | deactivating an activation reports `invalid` to the POS |

`license_validations` — append-only audit log of every check-in. `…000003_create_license_validations_table.php:16`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint auto | |
| `license_id`, `activation_id` | uuid nullable | FK by value, no constraint (log survives deletes) |
| `installation_key_prefix` | string | **first 12 chars only** — full key is never logged |
| `status_returned` | string | what the server told the POS |
| `hardware_match` | bool nullable | result of fingerprint comparison |
| `ip`, `hostname` | string nullable | |
| `created_at` | timestamptz | |

### Endpoints

All routes verified in `license-server/routes/api.php`.

```
PUBLIC (called by POS installations)
  POST /api/activate     first-time bind
  POST /api/validate     daily check

ADMIN (vendor only, X-Admin-Key header)
  GET  /api/admin/licenses
  POST /api/admin/licenses
  GET  /api/admin/licenses/{id}
  POST /api/admin/licenses/{id}/renew
  POST /api/admin/licenses/{id}/revoke
```

The admin guard is `AdminApiKey` (`license-server/app/Http/Middleware/AdminApiKey.php:15`) — a constant-time `hash_equals` against `LICENSE_ADMIN_KEY` from `.env`. No user accounts, no session, no UI.

### Tier definitions

There is **no** tier seeder yet; the tier name is just a string column with three allowed values. Concrete store/terminal caps live on each license individually:

| Tier | Typical use | Caps stored per license |
|---|---|---|
| `basic` | single store, single till | `max_stores` and `max_terminals` set at issue time |
| `standard` | small chain | same — set per license |
| `enterprise` | multi-region chains, govt | same — set per license |

The seeded demo license (`DatabaseSeeder.php:14`) issues `JOSBIN-DEMO-DEMO-DEMO-DEMO` at `standard`, 3 stores, 10 terminals. Real licenses are issued via the admin endpoint with caps chosen at sale time.

### License key format

Generated in `Admin\LicenseController::generateLicenseKey()`. Format:

```
JOSBIN-XXXX-XXXX-XXXX-XXXX
```

- 4 groups of 4 characters
- Alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 32 chars, no ambiguous `0/O/1/I`
- ≈ 20 bits per group, ≈ 80 bits total — collision-safe, brute-force-impractical
- Stored only as SHA-256 hash; the raw key is returned to the vendor **exactly once** in the `POST /api/admin/licenses` response and never again (`Admin\LicenseController.php:64`)

---

## 11.3 Hardware fingerprint binding

The fingerprint is computed in two places that must agree.

**Electron side** — `frontend/electron/main.ts:198`:

```ts
ipcMain.handle('license:fingerprint', async () => {
  // MAC — first non-internal interface
  // CPU — sha256(cpus()[0].model + hostname).substring(0,16)
  // UUID — crypto.randomUUID(), persisted to userData/install.uuid
})
```

The UUID is written once on first launch and read on every subsequent launch — it survives reboots and Electron upgrades but is destroyed if userData is wiped.

**Server side** — `LicenseActivation::fingerprint()` at `license-server/app/Models/LicenseActivation.php:43`:

```php
return hash('sha256', strtolower(implode('|', array_filter([$mac, $cpu, $uuid]))));
```

Two things to notice:
- `array_filter` skips null values — sending only two of three identifiers still produces a valid fingerprint (useful for VMs without a stable MAC).
- The hash is deterministic; the same hardware always produces the same fingerprint.

### Why bound at activation

`ActivationController::activate()` enforces the hardware contract:

1. If the same fingerprint is already active on this license → return the existing `installation_key` (idempotent). `ActivationController.php:55`
2. Otherwise check `$license->terminalLimitReached()` against `max_terminals`. `ActivationController.php:67`
3. If under the cap, insert a new activation row and return a fresh `installation_key`. `ActivationController.php:74`

One license × N terminals, where N is fixed at sale. The 11th till on a 10-terminal license gets:

```json
HTTP 403
{ "error": "LicenseLimitReached",
  "message": "License limit reached — this license permits 10 terminal(s). Contact Josbin POS to upgrade." }
```

### What happens when hardware changes

| Scenario | Effect | Resolution |
|---|---|---|
| MAC changes (new NIC) but CPU + UUID match | Fingerprint changes; `/api/validate` returns `hardware_match: false` | Vendor deactivates the old activation row in DB; client re-runs activation |
| Motherboard replaced (CPU model changes) | Same as above | Same flow |
| Full reinstall — userData wiped | New UUID is generated; new fingerprint; `/api/activate` consumes a fresh terminal slot | If at cap, vendor deactivates the lost slot first, then client re-activates |
| VM cloning | Both VMs produce the same fingerprint until the UUID file diverges | Detected via duplicate validations from different IPs in `license_validations` |

There is currently **no self-service "re-bind" endpoint** — by design. A vendor support touch is required, which is also the point at which billing/identity is re-verified.

---

## 11.4 The validation lifecycle

```
┌─ POS terminal startup ───────────────────────────────────────┐
│  Electron loads → renderer calls /api/auth/me                │
│  EnsureLicenseValid middleware fires                         │
│  LicenseService::getStatus() → Redis cache hit? → done       │
│                              → miss → POST /api/validate     │
│                                       to license server      │
└──────────────────────────────────────────────────────────────┘

┌─ 00:05 AST every day ────────────────────────────────────────┐
│  scheduler container runs: php artisan license:check --force │
│  LicenseService::forceCheck() bypasses cache, hits server    │
│  Status update broadcast on Reverb if changed                │
│  routes/console.php:27                                       │
└──────────────────────────────────────────────────────────────┘
```

### What the main backend does

`EnsureLicenseValid` middleware (`backend/app/Http/Middleware/EnsureLicenseValid.php:23`) is appended to the `api` group in `backend/bootstrap/app.php:27`. Every authenticated API request passes through it. Unauthenticated requests (login, public endpoints) skip the check.

`LicenseService::getStatus()` (`backend/app/Services/LicenseService.php:39`) returns one of these strings, cached in Redis under `license:status` for 24 hours:

| Status | Meaning | EnsureLicenseValid action |
|---|---|---|
| `active` | All good | pass; header `X-License-Status: active` |
| `warning_30` | 30 days to expiry | pass; banner shown by `LicenseBanner.tsx` |
| `warning_14` | 14 days to expiry | pass; banner |
| `grace` | Expired ≤ 14 days | pass; red banner |
| `soft_lock` | Expired 14–44 days | block `POST /api/sales` and `POST /api/sales/hold` (402); everything else passes |
| `hard_lock` | Expired > 44 days | block everything except `HARD_LOCK_EXEMPT_PATTERNS` (402) |
| `invalid` | Revoked / inactive | treated as `hard_lock` |
| `not_found` | Unknown installation key | treated as `hard_lock` |

A blocked request returns HTTP 402 with a bilingual message and a machine-readable code:

```json
{
  "message":        "Licentie verlopen. Nieuwe verkopen geblokkeerd. Neem contact op voor verlenging.",
  "message_en":     "License expired. New sales blocked. Contact Josbin POS to renew.",
  "code":           "LICENSE_SOFT_LOCK",
  "license_status": "soft_lock"
}
```

### Local cache + 72-hour offline grace

Verified in `LicenseService::offlineFallback()` (`backend/app/Services/LicenseService.php:124`):

```
internet drops → POST /api/validate throws
            ↓
first failure → set license:offline_grace_ends = now+72h
              → return 'active'  (grace assumed)
            ↓
subsequent failures within 72h → still return 'active'
            ↓
after 72h     → fall back to local License row's
                computeRenewalStatus() — uses last-known valid_until
                stored in backend's own License table
```

The cache is forgotten on any successful server response. A flaky connection that returns at any point resets the 72-hour window.

### Dev safety hatch

`LicenseService::getStatus()` short-circuits to `'active'` when `app()->isLocal()` is true or `installation_key` is empty (`backend/app/Services/LicenseService.php:42`). This means developer machines never trip the middleware. Production sets `APP_ENV=production` and `JOSBIN_POS_INSTALLATION_KEY=<inst_...>` so the real check runs.

### Reverb broadcast

`license:check --force` is scheduled at 00:05 AST nightly (`backend/routes/console.php:27`). When the status changes, `LicenseWarning` (`backend/app/Events/LicenseWarning.php`) broadcasts on the org and store private channels with bilingual NL/EN messages baked into `broadcastWith()`. The dashboard and manager terminals show a banner within seconds without polling.

---

## 11.5 Renewal enforcement timeline

The single timeline the client cares about. Every threshold below is verified in `license-server/app/Models/License.php:65` (`computeStatus`), `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS`, and `LicenseBanner.tsx`.

| Phase | Trigger | Cashier sees | Manager sees | Data |
|---|---|---|---|---|
| **−60 d** | Vendor's CRM reminder (out-of-band — not in code) | nothing | nothing | full access |
| **−30 d** (`warning_30`) | ≤ 30 days to expiry | nothing | yellow banner: "Licentie verloopt over 30 dagen…" + email | full access |
| **−14 d** (`warning_14`) | ≤ 14 days to expiry | nothing | amber banner + daily reminder emails | full access |
| **Expiry day** | `valid_until` passes | nothing | banner intensifies | full access |
| **Expiry → +14 d** (`grace`) | post-expiry ≤ 14 days | nothing — sales work normally | red banner: "noodperiode actief. Verkopen doorgaan" | full access |
| **+14 → +44 d** (`soft_lock`) | post-expiry 14–44 days | new sale attempt → on-screen error "Nieuwe verkopen geblokkeerd" | red bold banner: "Nieuwe verkopen geblokkeerd. Verleng nu om te heractiveren" | **all reports, exports, BTW filings, audit logs remain accessible** |
| **+44 d onward** (`hard_lock`) | post-expiry > 44 days | login fails with 402 `LICENSE_HARD_LOCK` | login fails too — but the export routes below still resolve | 90-day window for data export (see §11.6) |
| **+44 + 90 d** | Vendor policy (manual) | — | — | License server admin endpoint allows hard delete |

Two consequences worth calling out:

1. **The grace period is the actual hostage protection.** A till that loses its license never freezes mid-customer; the worst case is "next sale blocked" on the screen *after* finishing the current basket. The cashier never gets stuck with a customer at the counter.
2. **Data access outlives sales access by 30+90 days.** Even in hard lock, the client has three months to extract everything before any data is touched. By comparison, most cloud POSes lock out export the day a subscription lapses.

---

## 11.6 The "client never held hostage" promise

The exempt-route list lives in `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS` (`backend/app/Http/Middleware/EnsureLicenseValid.php:26`):

```php
private const HARD_LOCK_EXEMPT_PATTERNS = [
    'api/reports',          // all reports — daily, monthly, BTW, Rekenkamer
    'api/sales/*/receipt',  // re-print any past receipt
    'api/auth/logout',      // can always sign out cleanly
    'api/auth/me',          // session info — so the UI can render
    'api/rates',            // daily USD→SRD history — useful for audits
];
```

| What stays available in hard lock | Where | Used for |
|---|---|---|
| `GET /api/reports/daily`, `/monthly`, `/custom-range` | `ReportController` | day-by-day sales reconciliation |
| `GET /api/reports/btw` | `ReportController` | Belastingdienst Suriname filings |
| `GET /api/reports/rekenkamer` | `ReportController` | signed PDF for government audit |
| `GET /api/reports/export` (CSV) | `ReportController` | raw export of every transaction |
| `GET /api/sales/{id}/receipt` | `SaleController` | re-print any past receipt as PDF |
| `GET /api/rates` | `RateController` | locked daily USD→SRD history |

What is **not** exempt in hard lock: anything that creates, modifies, or deletes data. The system goes read-only the day the hard lock hits. This is also the day the 90-day data export clock starts.

### Data ownership clause (contract language to include)

> All sales, customer, product, BTW, and audit data created by the client during the licensed term remains the property of the client. In the event of license expiry, non-renewal, or termination of the commercial relationship, the client retains read and export access to all historical data for a minimum of ninety (90) days from the date of hard-lock. The vendor will, on request, provide a full SQL dump and CSV export within fourteen (14) business days at no additional charge.

This clause exists because the encoded source and license enforcement could in principle be read as "we control your data". The exempt-route list above is the technical proof that we do not.

---

## 11.7 IonCube encoding

### What it does

IonCube transforms readable PHP source into a binary stream that the IonCube Loader executes at full speed inside PHP-FPM. There is no decoder — the encoded files are not encrypted-to-plaintext; they are compiled-to-opcodes with an extra integrity layer. Reverse-engineering them is impractical (a paid commercial decoder service exists but produces only partial pseudo-source; no human-readable original is recoverable).

### Loader (free) vs encoder (paid)

| Component | Cost | Where it runs |
|---|---|---|
| **IonCube Loader** | Free, vendor-redistributable | Every client's Docker container — baked in at `docker/php/Dockerfile:39` |
| **IonCube Encoder for PHP 8.3** | Paid commercial licence (vendor's one-time purchase) | Vendor's build machine only, **never on a client server** |

The vendor pays once for the encoder. Every client gets the Loader free, baked into the image — they install nothing extra.

### Loader install (verified)

`docker/php/Dockerfile:39` is arch-aware so both x86-64 production servers and arm64 dev machines build the same image:

```dockerfile
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64)  url='…ioncube_loaders_lin_x86-64.tar.gz' ;; \
      aarch64) url='…ioncube_loaders_lin_aarch64.tar.gz' ;; \
      …
    cp "/tmp/ioncube/ioncube_loader_lin_8.3.so" "$ext_dir/ioncube_loader_lin_8.3.so"; \
    printf 'zend_extension=ioncube_loader_lin_8.3.so\n' > /usr/local/etc/php/conf.d/00-ioncube.ini; \
    php -v | grep -qi ioncube   # build fails if loader did not register
```

The final `grep` is a hard build-time check — a broken loader prevents the image from being tagged.

### Encoding workflow (delivery time)

`scripts/encode-ioncube.sh`. Run on the vendor's machine, **not** on the client server.

```
SRC = ./backend
OUT = ./dist/backend-encoded

ENCODER_FLAGS = (
  -o $OUT
  --php-target-version 8.3
  --ignore vendor       # third-party — restored by composer install
  --ignore node_modules
  --ignore storage      # writable runtime state
  --ignore tests        # not shipped
  --ignore .git
  --ignore .env         # never copied; client supplies their own
  --no-doc-comments
)

ioncube_encoder8.3 $SRC ${ENCODER_FLAGS[@]}
```

The script does a pre-flight check that the encoder exists on PATH (or at `$IONCUBE_ENCODER`) and bails out with a clear message if not (`scripts/encode-ioncube.sh:35`).

### What is encoded vs not

| Path | Encoded? | Why |
|---|---|---|
| `backend/app/**.php` | yes | the bulk of our source — controllers, services, models, jobs |
| `backend/database/**.php`, `backend/routes/**.php`, `backend/config/**.php`, `backend/bootstrap/**.php`, `backend/public/**.php` | yes | also our source |
| `backend/vendor/**` | **no** | third-party, already licensed; client re-runs `composer install --no-dev --optimize-autoloader` |
| `backend/tests/**` | no | not shipped |
| `backend/storage/**` | no | runtime state, must be writable |
| `backend/.env` | no | client provides their own |
| `frontend/dist/**` (Electron renderer) | n/a | Vite output is already minified, mangled JS bundles |
| `frontend/dist-electron/main.js` | n/a | same |
| `dashboard/dist/**` | n/a | same |

So the protected layer is PHP. The React frontends are protected only by minification + the Electron code signature; that is industry-normal for browser-targeted JS.

### Verification

The CI suite (`.github/workflows/backend.yml`) runs on the *un-encoded* source. The recommended pre-delivery check is to run the same test suite on the *encoded* output: spin up the production-image Docker stack pointing at `dist/backend-encoded`, run `php artisan test` inside the container. Pass = the encoded artefact is functionally identical.

This is documented in `scripts/README.md:97` (it is not in CI by policy — IonCube credentials should never sit on a runner).

---

## 11.8 Electron code signing

### Why

Windows SmartScreen and Defender warn loudly on unsigned `.exe` files ("Windows protected your PC…"). Cashiers who see that warning will not install — and rightly. A signed installer:

1. Shows the vendor's verified name in the UAC prompt.
2. Bypasses the SmartScreen reputation gate (with an EV cert) or earns reputation over time (OV).
3. Lets Windows detect tampering — modify a single byte and the signature breaks.

macOS is stricter — without notarization the app simply refuses to open on Catalina+.

### Certificates

| Platform | Cert type | Source | Per-build secret |
|---|---|---|---|
| Windows | OV or EV code-signing `.pfx` | DigiCert / Sectigo (≈ $300–$600/yr OV, $600–$1000/yr EV) | `CSC_LINK`, `CSC_KEY_PASSWORD` |
| macOS | "Developer ID Application" `.p12` | Apple Developer Program ($99/yr) | `CSC_LINK`, `CSC_KEY_PASSWORD` |
| macOS notarization | Apple ID + app-specific password | Apple Developer Program | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |

`scripts/README.md:46` documents the full env-var checklist. Secrets never enter the repo; electron-builder picks them up at build time only.

### Build config (verified)

`frontend/package.json:73` — the `build` block read by electron-builder:

```jsonc
"win": {
  "target": "nsis",
  "icon": "resources/icon.ico",
  "signingHashAlgorithms": ["sha256"],
  "requestedExecutionLevel": "requireAdministrator"
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "installerLanguages": ["Dutch", "English"]
},
"mac": {
  "target": ["dmg", "zip"],
  "icon": "resources/icon.icns",
  "category": "public.app-category.business",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": true
}
```

Build scripts (`frontend/package.json:13`):

```
npm run build:win   →   electron-vite build && electron-builder --win --x64
npm run build:mac   →   electron-vite build && electron-builder --mac
```

If the signing env vars are unset, electron-builder produces an **unsigned** build and skips notarization — useful for local QA but never for client delivery.

### macOS entitlements (verified)

`frontend/build/entitlements.mac.plist` declares what the hardened runtime needs to allow:

| Entitlement | Why |
|---|---|
| `com.apple.security.cs.allow-jit` | V8 (Electron) JIT-compiles JS |
| `com.apple.security.cs.allow-unsigned-executable-memory` | V8 writable+executable pages |
| `com.apple.security.cs.allow-dyld-environment-variables` | electron-builder packaging |
| `com.apple.security.cs.disable-library-validation` | Native modules can load |
| `com.apple.security.device.camera` | Quagga2 barcode scanner |
| `com.apple.security.network.client` | API calls to back-office + cloud |

Notarization happens automatically inside `electron-builder --mac` when the Apple env vars are present — `frontend/package.json:104` sets `"notarize": true`.

### Icons (one-time setup)

Currently missing from the repo:

- `frontend/resources/icon.ico` (Windows, 256×256)
- `frontend/resources/icon.icns` (macOS)

These need to be added before the first release build. Documented in `scripts/README.md:52`.

---

## 11.9 End-to-end delivery flow

What the vendor's team does for a new client, from issued license to running till.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. ISSUE LICENSE                                                         │
│    curl -X POST $LICENSE_SERVER/api/admin/licenses \                     │
│      -H "X-Admin-Key: $LICENSE_ADMIN_KEY" \                              │
│      -d '{"organisation_name":"Supermarkt De Hoop",                      │
│           "tier":"standard","max_stores":3,"max_terminals":10,           │
│           "valid_from":"2026-05-25","valid_until":"2027-05-25"}'         │
│    ──→ save the returned license_key (shown ONCE)                        │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 2. PREPARE CLIENT BACKEND .env                                           │
│    JOSBIN_POS_LICENSE_SERVER_URL=https://license.josbin-pos.sr           │
│    JOSBIN_POS_INSTALLATION_KEY=        (left blank until step 6)         │
│    + DB creds, exchange rate key, app key, etc.                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 3. IONCUBE-ENCODE THE BACKEND                                            │
│    IONCUBE_ENCODER=/opt/ioncube/ioncube_encoder8.3 \                     │
│      scripts/encode-ioncube.sh dist/backend-encoded                      │
│    ──→ ./dist/backend-encoded is shipped (vendor/ restored client-side)  │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 4. CODE-SIGN THE ELECTRON APP                                            │
│    export CSC_LINK=/secure/josbin-codesign.pfx                           │
│    export CSC_KEY_PASSWORD=...                                           │
│    cd frontend && npm run build:win                                      │
│    ──→ ./frontend/release/Josbin POS Setup x.y.z.exe                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 5. HAND OVER                                                             │
│    a. Backend bundle to the client's back-office PC (Docker compose up)  │
│    b. .exe installer to each terminal                                    │
│    c. License key in a sealed envelope to the store manager              │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 6. FIRST LAUNCH (per terminal)                                           │
│    Electron starts → 'license:fingerprint' handler runs                  │
│      mac  = first non-internal NIC                                       │
│      cpu  = sha256(cpu model + hostname)[0..16]                          │
│      uuid = userData/install.uuid (created on first run)                 │
│    Setup screen asks for the license key                                 │
│    Backend POST /api/activate to license server                          │
│    ──→ installation_key returned, written to backend .env                │
│    ──→ status "active" cached for 24h                                    │
│    POS is live                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 7. ONGOING                                                               │
│    Every day at 00:05 AST: scheduler runs license:check --force          │
│    On status change: LicenseWarning broadcast → managers see banner      │
│    On revocation / expiry: timeline of §11.5 takes over                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 11.10 Operating the license server

### Where it runs

A standalone Laravel 13 app (`license-server/`) with its own Postgres instance. Recommended deploy:

- Small VPS (1 vCPU / 2 GB is plenty — handles thousands of validation calls/day)
- TLS via Let's Encrypt (`license.josbin-pos.sr`)
- nginx → php-fpm (do not use `php artisan serve` in production)
- Outside Suriname (so a local server seizure cannot leverage license control)

### Backups

Standard Postgres backup is sufficient. The data is small (KB/license) and the only "loss" scenario that hurts is losing the `license_key_hash` rows — clients with valid keys would re-activate but new ones could not be issued. Daily encrypted dumps to off-region S3 cover it.

### Day-to-day operations

| Task | Command |
|---|---|
| Issue a license | `POST /api/admin/licenses` (curl example in `license-server/README.md:165`) |
| List all licenses | `GET /api/admin/licenses` |
| Inspect one | `GET /api/admin/licenses/{id}` — returns active activations + last-seen IPs/hostnames |
| Renew (extend `valid_until`) | `POST /api/admin/licenses/{id}/renew` — reactivates instantly, no reinstall |
| Revoke (non-payment, breach) | `POST /api/admin/licenses/{id}/revoke` — installations report `invalid` on next 24-h check |

### Monitoring

The `license_validations` table is an append-only log of every check-in. Useful queries:

```sql
-- Installations not seen in 7 days (possibly offline or uninstalled)
SELECT l.organisation_name, a.hostname, MAX(v.created_at)
FROM license_validations v
JOIN license_activations a ON a.id = v.activation_id
JOIN licenses l            ON l.id = v.license_id
GROUP BY l.organisation_name, a.hostname
HAVING MAX(v.created_at) < now() - interval '7 days';

-- Hardware fingerprint mismatches (possible cloned VM or hardware change)
SELECT * FROM license_validations
WHERE hardware_match = false
ORDER BY created_at DESC LIMIT 100;
```

A simple cron + email script on top of these gives the vendor an early-warning channel without standing up a full observability stack.

### Tests

`license-server/tests/Feature/LicenseFlowTest.php` covers: activate-then-validate happy path, idempotent re-activation on same hardware, terminal limit enforcement, unknown installation key, revoked license, soft-lock status at +21 days, admin-key guard. Run with `php artisan test` inside the license-server app.

---

## 11.11 What to tell the client during sales

A short FAQ for the conversation that always comes up.

**"What happens if the internet goes down?"**

The POS keeps running. The license check has a 72-hour offline grace window (`backend/app/Services/LicenseService.php:25`). If the license server itself is unreachable, every till stays operational for three full days before the system starts checking the locally cached license record — which itself can be valid for years. A normal one-day Telesur outage in Nickerie is invisible to the cashier.

**"What happens if Josbin POS goes out of business?"**

The contract should include a source-code escrow clause (third-party escrow agent holds the un-encoded source; released on vendor bankruptcy or breach). Even without escrow, the data export endpoints in §11.6 work indefinitely against the client's own database — no part of the client's data lives only on vendor infrastructure. The license server going dark triggers the 72-hour grace, then the local-DB fallback in `offlineFallback()`.

**"Can I add a fourth register beyond my licensed count?"**

No. `ActivationController.php:67` checks `terminalLimitReached()` before creating an activation. The fourth till's activation request returns HTTP 403 `LicenseLimitReached`. To raise the cap, the vendor issues a new license (or extends the existing one) with a higher `max_terminals` and the client re-activates — the existing terminals' fingerprints are preserved.

**"What if a terminal's hardware fails — do I lose that license seat?"**

No. Contact the vendor; the dead terminal's activation row is deactivated (`is_active = false`); the replacement machine activates into the freed slot. The flow is manual on purpose — it is the moment the vendor verifies the request is legitimate, not a sneaky way to spin up extra tills.

**"Can you read our sales data from your end?"**

No. The license server only knows the SHA-256 hash of the license key, the per-installation `installation_key`, hardware fingerprints, and IP/hostname strings. It never sees sale rows, customer data, or anything from the client's Postgres. The validation payload is the four fields shown in `LicenseService::validateWithServer()` (`backend/app/Services/LicenseService.php:90`).

**"If we stop paying, do we lose our data?"**

No. Soft lock (§11.5) blocks new sales but every report, BTW filing, Rekenkamer export and CSV download still works. Hard lock blocks new logins but the routes in `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS` keep working for 90 days — enough time to extract a full SQL dump and CSV of every transaction. Beyond that, the contract clause in §11.6 obliges the vendor to assist with export.

**"Can I move the back-office server to a new machine?"**

Yes — the backend is a Docker stack. Bring up the same stack on the new machine, restore the Postgres backup, copy the `.env` (which contains `JOSBIN_POS_INSTALLATION_KEY`). The license server sees the same installation key and continues to validate. Terminals are unaffected — they talk to the back-office server's hostname, not to the license server.

---

→ Next: [12 — Code map](12-code-map.md)
