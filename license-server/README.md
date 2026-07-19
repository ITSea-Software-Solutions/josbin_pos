# Josbin POS — License Server

A small, standalone **Laravel 13** application that issues, validates, renews and
revokes Josbin POS licenses. It runs **independently** of the main Josbin POS
platform and is operated entirely by the developer company — no customer ever
has access to it.

Every Josbin POS installation calls this server on startup and every 24 hours.
If the server is unreachable, the POS enters its own 72-hour offline grace
period (handled in the main app's `LicenseService`).

---

## URLs & deployment status

| Environment | URL | Status |
|---|---|---|
| Local (`cd license-server && docker compose up -d`) | `http://localhost:8090` | works today |
| Production | — | **NOT deployed yet** — goes live on prod-split day (`PENDING.md` §2) together with the pilot licence |

> ⚠️ Port overlap to know about: on the **test droplet**, `:8090` is the
> Super Admin **Dashboard**, not this app. The license server runs nowhere
> but your machine until prod-split day. The admin API key is generated at
> setup and lives in `license-server/.env` (never committed) — see
> `HANDOVER.md` for the locations inventory.

## What it does

- **Issues** licenses bound to a customer organisation (tier, store count,
  terminal count, expiry date).
- **Activates** an installation — binds it to specific hardware
  (MAC + CPU ID + installation UUID) and returns a per-installation key.
- **Validates** an installation on every check-in and returns the current
  renewal status.
- **Enforces** the licensed terminal count — extra terminals are refused with
  `License limit reached`.
- **Renews / revokes** licenses; renewal reactivates instantly with no reinstall.
- **Logs** every validation call for an audit trail.

---

## Requirements

- PHP 8.3+
- PostgreSQL 16 (or SQLite for a quick local trial)
- Composer 2

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
# set DB_* and LICENSE_ADMIN_KEY in .env
php artisan migrate
php artisan db:seed        # optional — creates one demo license
php artisan serve
```

Or with Docker:

```bash
LICENSE_ADMIN_KEY=your-secret DB_PASSWORD=your-db-pass docker compose up --build
# server on http://localhost:8090
```

Run the test suite:

```bash
php artisan test
```

---

## Renewal status timeline

`computeStatus()` returns one of:

| Status | When | POS behaviour |
|---|---|---|
| `active` | > 30 days until expiry | Normal |
| `warning_30` | ≤ 30 days until expiry | Yellow banner |
| `warning_14` | ≤ 14 days until expiry | Amber banner, daily emails |
| `grace` | Expired ≤ 14 days | Red banner (managers), full operation |
| `soft_lock` | Expired 14–44 days | New sales blocked; data/reports/exports stay available |
| `hard_lock` | Expired > 44 days | Login blocked; data export available 90 more days |
| `invalid` | License revoked or inactive | Treated as hard lock by the POS |
| `not_found` | Unknown installation key | Treated as hard lock by the POS |

This mirrors the renewal enforcement timeline in the main Josbin POS brief.

---

## API

All responses are JSON. Routes are prefixed with `/api`.

### Public — called by Josbin POS installations

#### `POST /api/activate`

First-time activation. Binds hardware and returns an `installation_key`.

```json
{
  "license_key": "JOSBIN-AB12-CD34-EF56-GH78",
  "hardware_mac": "00:1A:2B:3C:4D:5E",
  "hardware_cpu": "BFEBFBFF000906EA",
  "hardware_uuid": "4C4C4544-0034-...",
  "hostname": "back-office-pc"
}
```

→ `201` (or `200` if the same hardware re-activates):

```json
{
  "installation_key": "inst_xxxxxxxx...",
  "status": "active",
  "tier": "standard",
  "valid_until": "2027-05-23",
  "max_stores": 3,
  "max_terminals": 10,
  "activations_used": 1,
  "organisation_name": "Supermarkt De Hoop"
}
```

Errors: `404 NotFound` (bad key), `403 LicenseRevoked`, `403 LicenseLimitReached`.

#### `POST /api/validate`

Recurring check — the POS calls this on startup and every 24 hours.

```json
{
  "installation_key": "inst_xxxxxxxx...",
  "hostname": "back-office-pc",
  "hardware_mac": "00:1A:2B:3C:4D:5E",
  "hardware_cpu": "BFEBFBFF000906EA",
  "hardware_uuid": "4C4C4544-0034-..."
}
```

→ always `200` (so the POS treats it as authoritative, not as an
unreachable-server event):

```json
{
  "status": "active",
  "tier": "standard",
  "valid_until": "2027-05-23",
  "max_stores": 3,
  "max_terminals": 10,
  "activations_used": 4,
  "organisation_name": "Supermarkt De Hoop",
  "hardware_match": true,
  "checked_at": "2026-05-23T12:00:00-03:00"
}
```

The hardware fingerprint is **bound on first validation** and compared on every
call thereafter (`hardware_match`).

### Admin — developer company only (`X-Admin-Key` header)

| Method & path | Purpose |
|---|---|
| `GET /api/admin/licenses` | List all licenses with status + activation counts |
| `POST /api/admin/licenses` | Issue a license — returns the raw key **once** |
| `GET /api/admin/licenses/{id}` | License detail incl. activations |
| `POST /api/admin/licenses/{id}/renew` | Extend `valid_until` (reactivates instantly) |
| `POST /api/admin/licenses/{id}/revoke` | Revoke — installations report `invalid` |

Issue example:

```bash
curl -X POST http://localhost:8090/api/admin/licenses \
  -H "X-Admin-Key: $LICENSE_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organisation_name":"Supermarkt De Hoop","tier":"standard",
       "max_stores":3,"max_terminals":10,
       "valid_from":"2026-05-23","valid_until":"2027-05-23"}'
```

The plain `license_key` is returned **once** and never stored — only its
SHA-256 hash is kept.

---

## How the main Josbin POS app integrates

The main app's `LicenseService` (`backend/app/Services/LicenseService.php`)
already points here:

- `config/josbin_pos.php` → `license_server_url` (env `JOSBIN_POS_LICENSE_SERVER_URL`)
- It `POST`s to `{license_server_url}/api/validate` with the installation key.
- The `status` field drives the dashboard banners and the
  `EnsureLicenseValid` middleware (soft lock / hard lock).

No changes to the main app are required — this server fulfils the contract its
`LicenseService` already expects.

---

## Security notes

- License keys and installation keys are stored only as SHA-256 hashes.
- Admin endpoints require the `X-Admin-Key` shared secret (constant-time
  compared). Keep `LICENSE_ADMIN_KEY` secret and rotate it periodically.
- Run behind HTTPS (Let's Encrypt) in production.
- `php artisan serve` is fine for low volume; for production front the app with
  nginx + php-fpm.




Real blockers (operational, on your side — not code):

DigitalOcean firewall rules (public URLs still blocked)
SMTP credentials (no emails until then)
OpenAI billing credits (AI features silently off)
Domain + HTTPS decision (also unlocks camera-scanning in browsers)
Code-signing yes/no, and the on-site visit date — real printers/scale must be tested on Day 2 there