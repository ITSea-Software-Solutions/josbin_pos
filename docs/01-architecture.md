# 1 — Architecture overview

Three layers, one backend.

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — POS                       Electron (Win) + Capacitor      │
│ /frontend                           runs on the cashier terminal    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS + WebSocket
┌─────────────────────────────▼───────────────────────────────────────┐
│ LAYER 2 — Super Admin Dashboard     React SPA, browser              │
│ /dashboard                          runs at HQ                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTPS + WebSocket
┌─────────────────────────────▼───────────────────────────────────────┐
│ BACKEND — Laravel 13           serves all three layers              │
│ /backend                                                            │
│                                                                     │
│   /api/auth/*    public                                             │
│   /api/*         Sanctum-guarded     ← POS + Dashboard              │
│   /api/v1/*      API-key-guarded     ← LAYER 3 (third-party)        │
└─────────────────────────────┬───────────────────────────────────────┘
                              ▼
   Postgres 16 + pgvector  ·  Redis 7  ·  Reverb (WS)  ·  Horizon
```

---

## The three layers

| | Layer 1 — POS | Layer 2 — Dashboard | Layer 3 — Integration API |
|---|---|---|---|
| **Source** | `/frontend` | `/dashboard` | `backend/.../V1/*` |
| **Runtime** | Electron (Win) / Capacitor (Android) | Browser SPA | HTTP only |
| **Auth** | Sanctum bearer | Sanctum bearer | API key (`X-Api-Key`) |
| **2FA** | Per-policy | Mandatory for Super Admin + govt | n/a |
| **Idle timeout** | 15 min | 60 min | — |
| **Offline-capable** | Yes (5-layer sync) | No | No |
| **Format** | REST JSON | REST JSON | JSON:API |
| **Docs** | this folder | this folder | `GET /api/v1/docs` (Swagger) |

The dashboard has no backend of its own — it shares Laravel with the POS. Authorisation is enforced at the controller layer (Spatie permissions + policies); the dashboard UI only *hides* what a role can't do.

Layer 3 lives so third-party POS systems can push sales or pull reports without a user login. One API key per integration, scoped to a store, rate-limited.

---

## Container map (dev stack)

`docker compose up -d` brings up 8 containers:

| Container | Role | Host port |
|---|---|---|
| `josbin_pos_nginx` | Reverse proxy → PHP-FPM | **8080** |
| `josbin_pos_app` | PHP-FPM (Laravel) | — |
| `josbin_pos_postgres` | Postgres 16 + pgvector | **5432** |
| `josbin_pos_pgbouncer` | Connection pool | **5433** |
| `josbin_pos_redis` | Redis 7 | **6379** |
| `josbin_pos_reverb` | WebSocket | **6001** |
| `josbin_pos_horizon` | Queue worker | — |
| `josbin_pos_scheduler` | Cron loop | — |

Frontends run **outside** Docker:

| | Command | URL |
|---|---|---|
| POS | `cd frontend && npm run dev` | http://localhost:5173 |
| Dashboard | `cd dashboard && npm run dev` | http://localhost:5174 |

Both proxy `/api/*` to `http://localhost:8080`.

---

## Request lifecycle — a POS sale

The canonical happy path. Other flows are variations.

```
1.  Cashier taps Pay                            POSScreen.tsx
2.  POST /api/sales                             Sanctum bearer header
3.  Nginx → PHP-FPM
4.  Sanctum middleware                          401 if invalid
5.  EnsureLicenseValid                          403 if expired (72h grace)
6.  EnsureTwoFactor                             skipped for cashier role
7.  SessionTimeout                              bump last-activity
8.  SaleController::store                       SaleController.php:36
      ├── validate
      ├── DiscountRuleService::apply
      ├── BtwCalculationService::calculateCart  (bcmath)
      └── DB::transaction
            ├── lookup open RegisterSession
            ├── Sale::create                    sale_number via advisory lock
            ├── SaleItem::create × N
            └── increment customer spend

9.  RecordStockMovements job                    Redis queue → Horizon
10. SaleCompleted event broadcast               Reverb → dashboard + terminals
11. DetectSaleAnomaly job (ai queue, +5s)       fraud scan
12. ReceiptService                              PDF + ESC/POS + email HTML
```

Steps 1–8 are synchronous; target < 200 ms. Steps 9–11 are queued — the cashier never waits.

---

## Where things live

| Looking for… | Path |
|---|---|
| POS screen | `frontend/src/screens/*.tsx` |
| POS API client | `frontend/src/api/*.ts` |
| POS state | `frontend/src/store/*.ts` |
| Dashboard screen | `dashboard/src/screens/*.tsx` |
| Dashboard API client | `dashboard/src/api/*.ts` |
| Sanctum endpoint | `backend/app/Http/Controllers/Api/*Controller.php` |
| Integration endpoint | `backend/app/Http/Controllers/V1/*Controller.php` |
| Migration | `backend/database/migrations/*.php` |
| Model | `backend/app/Models/*.php` |
| Job | `backend/app/Jobs/*.php` |
| Broadcast event | `backend/app/Events/*.php` |
| Business calculation | `backend/app/Services/*.php` |
| Scheduled task | `backend/routes/console.php` |
| Middleware | `backend/app/Http/Middleware/*.php` |
| License server (separate app) | `/license-server` |
| Delivery scripts | `/scripts` |

Feature-by-feature index: [12-code-map.md](12-code-map.md).

---

## Why three layers

Each has a different deployment life:

- **POS** ships as `.exe`/`.apk` to physical hardware; must work offline.
- **Dashboard** is a browser SPA; updates are immediate.
- **Integration API** is a contract with external systems; versioned, sandboxed, backwards-compatible.

One backend serves all three because the *data* is the same. Three backends would mean three places to enforce BTW, three places to audit-log, three to keep in sync.

---

→ [2 — Data model](02-data-model.md)
