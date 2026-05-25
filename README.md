# Josbin POS

Enterprise Point of Sale and multi-store management platform built for Suriname. Three-layer architecture: Electron POS desktop app, Super Admin web dashboard, and Open Integration API.

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13, PHP 8.3 |
| Database | PostgreSQL 16 + pgvector |
| Cache / Queues | Redis 7 + Laravel Horizon |
| WebSockets | Laravel Reverb |
| Frontend (POS) | React 19.2, TypeScript, Electron 33 (Windows) + Capacitor 6 (Android) |
| Frontend (Dashboard) | React 19.2, TypeScript, Vite 6 |
| State | Zustand 5, TanStack Query v5 |
| i18n | i18next (Dutch / English) |
| Hardware | ESC/POS thermal printing, cash drawer, USB barcode scanner |
| Infrastructure | Docker + Docker Compose, Nginx |

---

## Supported Hardware

The POS app runs on both **Windows** (Electron) and **Android** (Capacitor). Both platforms share the same React codebase and backend API.

| Hardware | Windows (Electron) | Android (Capacitor) |
|---|---|---|
| Thermal receipt printer — Network TCP | ✅ | ✅ |
| Thermal receipt printer — USB | ✅ via Windows spooler | ✅ via `@capgo/capacitor-printer` |
| Cash drawer (RJ11 via printer) | ✅ auto-opens on cash sale | ✅ auto-opens on cash sale |
| Barcode scanner — USB HID | ✅ keyboard wedge | ✅ USB OTG keyboard wedge |
| Barcode scanner — Camera | ✅ Quagga2 | ✅ Quagga2 |
| Hardware license fingerprint | ✅ MAC + CPU + UUID | ✅ Device ID via `@capacitor/device` |

**Recommended printer setup:** EPSON TM-T20 (or any ESC/POS-compatible) connected via Ethernet/WiFi. Enter the printer's IP in Settings → Printer. No drivers required on any platform.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- [Node.js 20+](https://nodejs.org/) — for the frontend dev server
- [npm 10+](https://www.npmjs.com/)
- **Android builds only:** Android Studio + JDK 17

---

## Running the project

### 1. Backend (Docker — all services)

The backend runs entirely inside Docker. All services start with one command from the project root.

```bash
docker compose up -d
```

That starts:

| Container | Role | Port |
|---|---|---|
| `josbin_pos_nginx` | Reverse proxy → PHP-FPM | **8080** |
| `josbin_pos_app` | Laravel 13 / PHP-FPM | internal |
| `josbin_pos_postgres` | PostgreSQL 16 + pgvector | **5432** |
| `josbin_pos_pgbouncer` | Connection pooler (PgBouncer) | **5433** |
| `josbin_pos_redis` | Redis 7 | **6379** |
| `josbin_pos_reverb` | WebSocket server | **6001** |
| `josbin_pos_horizon` | Queue worker | internal |
| `josbin_pos_scheduler` | Laravel cron | internal |

**First-time setup** — run migrations then seed demo data:

```bash
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed
```

> **Note:** Run `migrate` and `db:seed` as two separate commands. The `migrate --seed` shorthand can fail on a fresh database due to migration ordering.

**Stop all services:**

```bash
docker compose down
```

**Rebuild containers after Dockerfile changes:**

```bash
docker compose build --no-cache && docker compose up -d
```

---

### 2. POS — Windows Electron (dev)

```bash
cd frontend
npm install          # first time only
npm run dev          # starts Electron window + Vite hot-reload together
```

The Electron renderer is also accessible at **http://localhost:5173** in a browser during development. API calls go to `http://localhost:8080/api`.

**Build Windows installer (.exe):**

```bash
cd frontend
npm run build:win
# Output: frontend/release/Josbin POS-1.0.0-Setup.exe
```

---

### 3. POS — Android (Capacitor)

Requires Android Studio and JDK 17 installed on the build machine.

```bash
cd frontend
npm install

# Build React → sync to Android project → open in Android Studio
npm run build:android

# Hot-reload against local Vite dev server (emulator only)
npm run android:dev
```

The `build:android` command:
1. Builds the React app with `vite build`
2. Runs `npx cap sync android` to copy assets into the Android project
3. Opens Android Studio where you build/sign/install the APK

**For hot-reload on a real device** (same WiFi as dev machine):
```bash
# In capacitor.config.ts, change CAPACITOR_DEV server URL to your machine's LAN IP
# e.g. http://192.168.1.50:5173
CAPACITOR_DEV=true npm run android:dev
```

**USB printer plugin (already in package.json — just sync after install):**
```bash
npm install          # installs @capgo/capacitor-printer automatically
npx cap sync android
```

---

### 4. Super Admin Dashboard (web)

```bash
cd dashboard
npm install          # first time only
npm run dev
```

Opens at **http://localhost:5174**. API calls proxy to `http://localhost:8080/api`.

---

## URLs

### Live stack (`docker compose up -d`)

| URL | What |
|---|---|
| `http://localhost:8080` | Laravel app (Nginx → PHP-FPM) |
| `http://localhost:8080/api` | REST API root (Sanctum-guarded) |
| `http://localhost:8080/api/health` | Liveness check (no auth) |
| `http://localhost:8080/api/v1/docs` | **Swagger UI** — Open Integration API (Layer 3) |
| `http://localhost:8080/api/v1/openapi.json` | Raw OpenAPI 3.0 spec |
| `http://localhost:8080/horizon` | Horizon — queue monitoring |
| `http://localhost:8080/telescope` | Telescope — debug (dev only) |
| `ws://localhost:6001` | Reverb WebSocket server |
| `localhost:5432` | PostgreSQL direct |
| `localhost:5433` | PostgreSQL via PgBouncer (pooled) |
| `localhost:6379` | Redis |

### Frontends (started outside Docker)

| URL | What | Start |
|---|---|---|
| `http://localhost:5173` | **POS** (Electron + Vite) | `cd frontend && npm run dev` |
| `http://localhost:5174` | **Super Admin Dashboard** | `cd dashboard && npm run dev` |
| `http://localhost:5180` | **Documentation site** (VitePress — dev docs + user manual) | `cd docs-site && npm run dev` |

### Demo stack — runs alongside live, isolated data, port-shifted

```bash
docker compose -p josbin_demo \
  -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

| URL | What |
|---|---|
| `http://localhost:8082` | Demo Laravel app (own DB, yellow "DEMO MODE" banner) |
| `localhost:55433` | Demo PostgreSQL |
| `localhost:6380` | Demo Redis |
| `ws://localhost:6002` | Demo Reverb |

Full guide: see [docs/00-installation-and-setup.md](docs/00-installation-and-setup.md).

### License server (separate app, `cd license-server && docker compose up -d`)

| URL | What |
|---|---|
| `http://localhost:8090` | License server root |
| `http://localhost:8090/api/activate` | Hardware-fingerprint binding |
| `http://localhost:8090/api/validate` | Daily validation called by EnsureLicenseValid |
| `http://localhost:8090/api/admin/licenses` | Issue / renew / revoke (admin key) |

### Sandbox API (third-party integration testing, `docker compose -f docker-compose.sandbox.yml up -d`)

| URL | What |
|---|---|
| `http://localhost:8091` | Isolated Laravel app, sends `X-Josbin-Environment: sandbox` header |
| `localhost:55432` | Sandbox PostgreSQL |

---

## Authentication

Login via `POST /api/auth/login`:

```json
{
  "email": "admin@josbin-pos.sr",
  "password": "JosbinPOS@2026!",
  "device_name": "pos-electron"
}
```

Returns `{ token, expires_at, user }`. Pass the token as `Authorization: Bearer <token>` on all subsequent requests.

**Default seeded accounts:**

| Role | Email | Password | 2FA? |
|---|---|---|---|
| Super Admin | `admin@josbin-pos.sr` | `JosbinPOS@2026!` | Yes (enforced) |
| Organisation Admin (HQ) | `orgadmin@dehoop.sr` | `OrgAdmin@2026` | No |
| Store Manager | `manager@dehoop.sr` | `Manager@2026` | No |
| Cashier | `kassa@dehoop.sr` | `Cashier@2026` | No |

`orgadmin@dehoop.sr` is the **HQ catalogue owner** — only role (besides Super Admin) that can bulk-import products, manage API keys, and push catalogue updates to all POS terminals.

---

## Printer & Cash Drawer Setup

Printer configuration is saved per-device in Settings → Printer & Cash Drawer.

### Option A — Network TCP (recommended)

Works on Windows and Android without any drivers. Requires the printer to be connected via Ethernet or WiFi on the same LAN as the POS terminal.

1. Find the printer's IP address (print a self-test page or check your router)
2. Open **Settings → Printer & Cash Drawer**
3. Select **Network (TCP)**, enter the IP address, leave port as `9100`
4. Click **Test cash drawer** to verify

Supported printers: EPSON TM-T20 (Ethernet model), TM-T88, Star TSP100, and any printer with ESC/POS over TCP port 9100.

### Option B — USB (Windows only)

1. Install the printer using the manufacturer's Windows driver
2. Open **Settings → Printer & Cash Drawer**
3. Select **USB**, click **Refresh**, choose the printer from the list

### Option B — Android PrintManager (HTML receipt)

`@capgo/capacitor-printer` is already included in `package.json`. It sends the receipt as HTML to Android's native PrintManager — most Android POS terminals with a built-in printer auto-print silently. After `npm install`:

```bash
cd frontend
npx cap sync android
npm run build:android
```

In Settings → Printer & Cash Drawer, select **USB**. For the cash drawer pulse on Android, also configure a Network (TCP) IP — the drawer command is sent as raw ESC/POS bytes over TCP since Android's PrintManager does not support raw byte jobs.

### Cash drawer

The cash drawer connects via RJ11 cable to the receipt printer (standard on all ESC/POS countertop printers). No separate configuration is needed — the drawer opens automatically when the printer is configured.

- **Drawer opens automatically** on every completed cash or mixed payment
- **Pin 2** is the default (covers EPSON TM-T20, Star, most Posiflex models)
- Change to **Pin 5** in Settings if the drawer does not open

---

## API Reference

All routes are under `/api` and require `Authorization: Bearer <token>` except where noted.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Login, returns token |
| `POST` | `/auth/logout` | Revoke current token |
| `POST` | `/auth/logout-all` | Revoke all tokens |
| `GET` | `/auth/me` | Current user + permissions |
| `POST` | `/auth/refresh` | Rotate token |
| `GET` | `/auth/two-factor/setup` | Get 2FA QR code |
| `POST` | `/auth/two-factor/confirm` | Confirm TOTP code |
| `POST` | `/auth/two-factor-challenge` | Complete 2FA login |

### Health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | DB + Redis + disk status (Docker healthcheck) |

### Stores

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/stores` | List stores (org-scoped) |
| `GET` | `/stores/{id}` | Single store |
| `PUT` | `/stores/{id}` | Update store |
| `DELETE` | `/stores/{id}` | Delete store |

### Categories

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/categories` | List all categories |
| `POST` | `/categories` | Create category |
| `PUT` | `/categories/{id}` | Update category |
| `DELETE` | `/categories/{id}` | Delete category |

### Products

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/products/pos` | POS product grid (fast, minimal payload) |
| `GET` | `/products/barcode/{barcode}` | Lookup by barcode |
| `POST` | `/products/import` | CSV bulk import |
| `POST` | `/products/push` | Push catalogue to store(s) via WebSocket |
| `GET` | `/products` | Paginated catalogue |
| `POST` | `/products` | Create product |
| `GET` | `/products/{id}` | Single product |
| `PUT` | `/products/{id}` | Update product |
| `DELETE` | `/products/{id}` | Delete product |
| `POST` | `/products/{id}/image` | Upload product image (JPEG/PNG/WebP, max 2 MB) |
| `GET` | `/products/{id}/stock-history` | Paginated stock movement ledger |

### Sales

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/sales` | Create sale (BTW + discounts auto-calculated) |
| `GET` | `/sales` | List sales |
| `GET` | `/sales/{id}` | Single sale |
| `POST` | `/sales/{id}/void` | Void sale |
| `POST` | `/sales/{id}/refund` | Refund sale |
| `POST` | `/sales/hold` | Hold bill |
| `GET` | `/sales/held` | List held bills |
| `DELETE` | `/sales/held/{id}` | Restore held bill |
| `GET` | `/sales/{id}/receipt/pdf` | PDF receipt stream |
| `POST` | `/sales/{id}/receipt/email` | Send HTML email receipt |

### Customers

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/customers` | Search by name/phone (HMAC exact match, WBP-S compliant) |
| `POST` | `/customers` | Create customer |
| `POST` | `/customers/import` | CSV bulk import (deduplicates by phone HMAC) |
| `GET` | `/customers/{id}` | Single customer (decrypted) |
| `PUT` | `/customers/{id}` | Update customer |

### Exchange Rates

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/rates` | Today's rate + 30-day history |
| `POST` | `/rates/fetch` | Fetch live rate from ExchangeRate-API |
| `POST` | `/rates/override` | Manual rate override |

### Discount Rules

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/discount-rules` | List discount rules (org-scoped) |
| `POST` | `/discount-rules` | Create rule (product / category / cart) |
| `PUT` | `/discount-rules/{id}` | Update rule |
| `DELETE` | `/discount-rules/{id}` | Delete rule |

### Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports/daily` | Daily summary (`?date=YYYY-MM-DD`) |
| `GET` | `/reports/monthly` | Monthly summary (`?year=&month=`) |
| `GET` | `/reports/custom` | Custom range (`?date_from=&date_to=`) |
| `GET` | `/reports/top-products` | Top products by revenue |
| `GET` | `/reports/x-report` | X-Report snapshot (no register close) |
| `POST` | `/reports/z-report` | Z-Report — close register, cash reconciliation |
| `GET` | `/reports/z-report/history` | Last 7 Z-Reports |
| `GET` | `/reports/btw` | BTW report (Belastingdienst format) |
| `GET` | `/reports/export` | PDF/CSV export |
| `GET` | `/reports/rekenkamer` | Rekenkamer audit export (signed PDF) |

### API Keys (Open Integration)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api-keys` | List API integrations |
| `POST` | `/api-keys` | Create integration (returns `webhook_secret` once) |
| `PUT` | `/api-keys/{id}` | Update integration |
| `DELETE` | `/api-keys/{id}` | Delete integration |
| `POST` | `/api-keys/{id}/rotate-webhook-secret` | Rotate HMAC signing secret |

### Open Integration API (v1) — API key auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/sales` | Push sale from third-party POS |
| `POST` | `/v1/sales/batch` | Batch upload (idempotent) |
| `GET` | `/v1/reports/sales` | Pull sales for integration's store |
| `GET` | `/v1/reports/summary` | Pull summary for integration's store |

Authenticate with `X-API-Key: <key>` header. Webhook payloads are signed with `X-JosbinPOS-Signature: sha256=<hmac>`.

---

## Useful Docker commands

```bash
# View logs
docker compose logs -f app
docker compose logs -f nginx
docker compose logs -f horizon

# Run artisan commands
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed
docker compose exec app php artisan rates:lock        # fetch today's USD→SRD rate
docker compose exec app php artisan tinker

# Run backend tests
docker compose exec app php artisan test
docker compose exec app php artisan test --filter BtwCalculationServiceTest

# Connect to PostgreSQL
docker compose exec postgres psql -U josbin_pos -d josbin_pos

# Connect to Redis
docker compose exec redis redis-cli -a secret

# Clear all caches
docker compose exec app php artisan optimize:clear

# Rebuild PHP image only
docker compose build app && docker compose up -d app
```

---

## Frontend commands

```bash
# POS — Windows Electron
cd frontend
npm run dev           # Electron + Vite hot-reload
npm run build:win     # Windows .exe installer
npm run type-check    # TypeScript check (no emit)
npm run test          # Vitest unit tests

# POS — Android Capacitor
cd frontend
npm run build:android # Build + sync + open Android Studio
npm run android:dev   # Hot-reload dev build on emulator
npm run cap:sync      # Sync web assets to Android project after changes

# Dashboard (web)
cd dashboard
npm run dev           # Vite dev server at :5174
npm run build         # Production build
npm run type-check
```

---

## Project structure

```
josbin_pos/
├── backend/                    # Laravel 13 application
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/    # All API controllers
│   │   │   └── Middleware/         # SessionTimeout, EnsureTwoFactor, etc.
│   │   ├── Models/                 # Eloquent models (UUID PKs)
│   │   ├── Policies/               # RBAC policies (Spatie)
│   │   ├── Services/
│   │   │   ├── BtwCalculationService.php    # BCMath BTW engine
│   │   │   ├── DiscountRuleService.php      # Product/category/cart discount engine
│   │   │   ├── StockMovementService.php     # Atomic stock ledger (append-only)
│   │   │   ├── ReceiptService.php           # PDF + email receipts
│   │   │   └── AuditHashService.php         # SHA-256 hash chain for audit log
│   │   ├── Jobs/
│   │   │   ├── RecordStockMovements.php     # Queued stock deduction after sale
│   │   │   ├── DispatchWebhook.php          # HMAC-signed webhook delivery
│   │   │   └── DetectSaleAnomaly.php        # AI fraud detection (queued)
│   │   └── Console/Commands/
│   │       ├── LockDailyRate.php            # rates:lock — fetch USD→SRD
│   │       └── VerifyAuditChain.php         # audit:verify — hash chain check
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   │       ├── RolesAndPermissionsSeeder.php
│   │       ├── SuperAdminSeeder.php
│   │       └── DevelopmentDataSeeder.php    # 50 Surinamese products, 3 users
│   ├── resources/views/
│   │   ├── receipts/receipt.blade.php       # 80mm thermal PDF
│   │   └── emails/receipt.blade.php         # HTML email receipt
│   ├── routes/api.php
│   └── tests/Unit/
│       └── BtwCalculationServiceTest.php    # 56 BTW accuracy tests
│
├── frontend/                   # React 19 POS app — Electron (Windows) + Capacitor (Android)
│   ├── electron/
│   │   ├── main.ts             # Electron main process — TCP/USB printing, cash drawer, fingerprint
│   │   └── preload.ts          # Secure IPC bridge to renderer
│   ├── capacitor.config.ts     # Android build config
│   ├── src/
│   │   ├── lib/
│   │   │   ├── escpos.ts           # ESC/POS byte builder — receipt, cash drawer pulse, paper cut
│   │   │   ├── hardware.ts         # Platform abstraction — routes to Electron or Capacitor
│   │   │   └── capacitor-printer.ts # Android USB/TCP print bridge
│   │   ├── api/                # Axios clients per resource
│   │   ├── store/
│   │   │   ├── authStore.ts        # Login, token, permissions
│   │   │   ├── cartStore.ts        # Cart state + BTW computation
│   │   │   └── settingsStore.ts    # storeId, language, printer config
│   │   ├── screens/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── POSScreen.tsx
│   │   │   ├── ReportsScreen.tsx
│   │   │   ├── EndOfDayScreen.tsx
│   │   │   └── SettingsScreen.tsx  # Includes printer & cash drawer config UI
│   │   ├── components/pos/
│   │   │   ├── PaymentModal.tsx    # Auto-opens cash drawer on cash/mixed payment
│   │   │   ├── ReceiptModal.tsx    # ESC/POS print + PDF + email receipt
│   │   │   └── ...
│   │   ├── types/
│   │   │   ├── models.ts
│   │   │   └── electron.d.ts       # window.josbin_pos IPC type definitions
│   │   └── i18n/               # nl.json, en.json (includes printer/drawer translations)
│
├── dashboard/                  # React 19 + Vite (Super Admin web app)
│
├── docker/
│   ├── php/                    # PHP-FPM Dockerfile + php.ini
│   ├── nginx/default.conf
│   └── postgres/init.sql       # pgvector + pg_trgm extension init
│
├── tests/
│   ├── load/                   # k6 load tests (10 VUs + morning rush spike)
│   └── e2e/                    # Playwright end-to-end specs
│
├── progress/                   # Weekly reports + phase task tracking
├── docker-compose.yml
└── setup.sh
```

---

## Key business rules

**BTW (Surinamese VAT)**
- Currently 10%, configurable per product
- Extracted from tax-inclusive prices: `btw = price - price / (1 + rate)`
- Discounts applied **before** BTW extraction (Belastingdienst Suriname requirement)
- BTW-exempt flag for basic foodstuffs and medicine
- All arithmetic uses BCMath (backend) — no floating point

**Currency**
- All amounts in SRD (Surinamese Dollar)
- PostgreSQL `DECIMAL(12,2)` — no float columns
- Daily USD→SRD rate fetched from ExchangeRate-API at 06:00 AST
- Rate locked per day; all sales that day use the locked rate
- USD equivalent shown on receipt as informational line only

**Timezone**
- All timestamps stored and displayed in AST (America/Paramaribo, UTC−3)

**Customer data (WBP-S compliance)**
- Name, phone, email, ID number encrypted with AES-256 at field level
- Search uses HMAC-SHA256 hashes — exact match only, no partial search by design

**Stock ledger**
- All stock changes go through `StockMovementService` — append-only, cannot be edited or deleted
- Stock deducted after every sale via queued `RecordStockMovements` job

**ESC/POS printing**
- All receipt bytes built by `src/lib/escpos.ts` — pure TypeScript, no external dependencies
- Cash drawer pulse sent as ESC/POS bytes through the receipt printer connection (RJ11)
- Platform routing in `src/lib/hardware.ts` — same call works on Electron and Android
- PDF receipt always available as fallback regardless of printer configuration

---

## Environment variables (backend/.env)

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `"Josbin POS"` | Must be quoted (contains space) |
| `APP_KEY` | generated | Laravel encryption key |
| `APP_ENV` | `local` | `local` / `production` |
| `DB_HOST` | `pgbouncer` | Connect via PgBouncer (pooled) |
| `DB_PORT` | `5432` | PgBouncer internal port |
| `DB_DATABASE` | `josbin_pos` | Database name |
| `DB_USERNAME` | `josbin_pos` | DB user |
| `DB_PASSWORD` | `secret` | DB password |
| `REDIS_HOST` | `redis` | Redis host |
| `REDIS_PASSWORD` | `secret` | Redis password |
| `EXCHANGERATE_API_KEY` | — | API key from exchangerate-api.com (free tier) |
| `REVERB_APP_KEY` | `josbin_pos-key` | WebSocket app key |

> **Note:** `APP_NAME` must be quoted in `.env` (`APP_NAME="Josbin POS"`). Unquoted values with spaces cause a dotenv parse error on startup.

---

## Troubleshooting

**`php artisan` fails: "Failed to parse dotenv file. Encountered unexpected whitespace"**
Ensure `APP_NAME` is quoted in `backend/.env`:
```
APP_NAME="Josbin POS"
```

**Migrations fail: `relation "audit_logs" does not exist`**
The spatie auditing package creates a table named `audits` by default. The `config/audit.php` in this project sets `table = audit_logs`. If you see this error, the config cache may be stale:
```bash
docker compose exec app php artisan config:clear
docker compose exec app php artisan migrate
```

**Seeder fails: `invalid input syntax for type bigint` on `model_has_roles`**
The spatie permission tables need `model_uuid` to be type `uuid`, not `bigint`. The migration `2026_04_12_200014_fix_permission_tables_for_uuid` handles this automatically. If you hit this on a database that already ran migrations, apply the fix manually:
```bash
docker compose exec postgres psql -U josbin_pos -d josbin_pos -c "
  ALTER TABLE model_has_permissions DROP CONSTRAINT model_has_permissions_pkey;
  ALTER TABLE model_has_permissions ALTER COLUMN model_uuid TYPE uuid USING model_uuid::text::uuid;
  ALTER TABLE model_has_permissions ADD PRIMARY KEY (permission_id, model_uuid, model_type);
  ALTER TABLE model_has_roles DROP CONSTRAINT model_has_roles_pkey;
  ALTER TABLE model_has_roles ALTER COLUMN model_uuid TYPE uuid USING model_uuid::text::uuid;
  ALTER TABLE model_has_roles ADD PRIMARY KEY (role_id, model_uuid, model_type);
"
```

**PostgreSQL role does not exist on first start**
Docker only runs `docker/postgres/init.sql` when the data directory is empty. If a previous run created the directory with a different role:
```bash
docker compose down
rm -rf docker/postgres/data
docker compose up -d
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed
```

**Cash drawer does not open**
1. Confirm the printer is configured in Settings → Printer & Cash Drawer
2. Try the **Test cash drawer** button in settings
3. Switch drawer pin from Pin 2 to Pin 5 (or vice versa)
4. For network printers: verify the IP address is reachable (`ping <printer-ip>` from the POS terminal)
5. For USB on Android: ensure the `@capgo/capacitor-printer` plugin is installed and the APK was rebuilt after installation

**Android app cannot reach the backend**
The backend must be on the same network. In `capacitor.config.ts`, the API base URL defaults to the LAN address of the backend server. Update `VITE_API_URL` in the frontend `.env` to the backend's LAN IP before building the APK:
```
VITE_API_URL=http://192.168.1.10:8080/api
```

---

## Development workflow

```bash
# 1. Start the backend stack
docker compose up -d

# 2. First-time only — migrate and seed
docker compose exec app php artisan migrate
docker compose exec app php artisan db:seed

# 3a. Start the POS — Windows Electron
cd frontend && npm run dev

# 3b. OR build the POS — Android
cd frontend && npm run build:android

# 4. OR start the Super Admin Dashboard
cd dashboard && npm run dev

# 5. After pulling changes that include new migrations
docker compose exec app php artisan migrate

# 6. Run the full test suite
docker compose exec app php artisan test
```

---

## Phase progress

| Phase | Scope | Status |
|---|---|---|
| Phase 1 | Architecture, Docker, DB schema, CI/CD scaffolding | ✅ Complete |
| Phase 2 | POS system — backend APIs + full React/Electron frontend | ✅ Complete |
| Phase 3 | Super Admin Dashboard, WebSocket, sync, Open API, AI features | 🔄 In progress (72 / 97 tasks) |
| Phase 4 | UAT, OWASP testing, IonCube encoding, go-live | 🔲 Planned |

**Android + hardware support** (added during Phase 2 completion):
- Capacitor 6 wrapper for Android APK build
- ESC/POS receipt printing — network TCP (port 9100) and USB on both platforms
- Cash drawer auto-trigger on cash/mixed payments
- Hardware fingerprint for license binding on Android via `@capacitor/device`
- Printer config UI in Settings with live test button
