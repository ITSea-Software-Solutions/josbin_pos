# Josbin POS — Backend (Laravel 13 API)

The API behind every surface of Josbin POS: the Electron/browser POS, the
Super Admin Dashboard, the tax-inspector portal, and the Layer-3 Open
Integration API. PHP 8.3 · PostgreSQL 16 (via PgBouncer) · Redis 7 ·
Reverb WebSockets · Horizon queues. All money is SRD `DECIMAL`, all
timestamps AST (America/Paramaribo), BTW is calculated after discounts.

> Full platform README (all stacks, ports, business rules):
> [`../README.md`](../README.md)

## Server URLs

| Environment | Base URL | Notes |
|---|---|---|
| **Test droplet** | `http://142.93.88.143:8080/api` | demo data; TLS mirror on `https://142.93.88.143:8443` (self-signed) |
| Local live stack | `http://localhost:8080/api` | `docker compose up -d` from the repo root |
| Local demo stack | `http://localhost:8082/api` | isolated DB, yellow DEMO banner |
| Local sandbox (Layer 3) | `http://localhost:8091` | third-party integration testing |

Handy endpoints on any of those bases: `/health` (open liveness),
`/v1/docs` (Swagger UI), `/v1/openapi.json`, and — on the app root, not
`/api` — `/horizon` (queues) and `/telescope` (local only).

## Demo logins

Same accounts on every stack (each has its own isolated database):

| Role | Email | Password |
|---|---|---|
| Super Admin (2FA enforced) | `admin@josbin-pos.sr` | `JosbinPOS@2026!` |
| Organisation Admin | `orgadmin@dehoop.sr` | `OrgAdmin@2026` |
| Store Manager | `manager@dehoop.sr` | `Manager@2026` |
| Cashier | `kassa@dehoop.sr` | `Cashier@2026` |
| Tax Inspector (2FA mandatory) | `belastingdienst@gov.sr` | `Inspector@2026` |

Sandbox API key (fixed, publishable): `sk_sandbox_josbin_pos_demo_2026`.
Rotate all seeded passwords on prod-split day (`PENDING.md` §2). Real
secrets are never in this repo — see `HANDOVER.md` for locations.

Get a token:

```bash
curl -s http://142.93.88.143:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"manager@dehoop.sr","password":"Manager@2026","device_name":"curl"}'
# → { "token": "…", "expires_at": "…", "user": { … } }
# then:  -H "Authorization: Bearer <token>"
```

Passkey (WebAuthn) endpoints exist alongside password login
(`/auth/passkeys/*`) — browser-only ceremonies, see the root README's
Authentication section.

## Working on the backend

```bash
# tests — run INSIDE a stack container (host PHP lacks the ext-redis setup)
docker exec josbin_demo_app php artisan test            # full suite
docker exec josbin_demo_app php artisan test --filter=BtwCalculationTest

# migrations / seeders (live stack container: josbin_pos_app)
docker exec josbin_pos_app php artisan migrate
docker exec josbin_pos_app php artisan db:seed --class=DemoSeeder

# code style
./vendor/bin/pint --dirty
```

Conventions that bite if missed: never bypass Eloquent for `audit_logs`
(append-only DB triggers), money is `bcmath` on `DECIMAL` strings, every
date-windowed report query converts to AST first, and locale-aware errors
go through `__('errors.…')` (nl/en). The registry of hard-won gotchas lives
in [`../CLAUDE_WORKING_GUIDE.md`](../CLAUDE_WORKING_GUIDE.md) §4.
