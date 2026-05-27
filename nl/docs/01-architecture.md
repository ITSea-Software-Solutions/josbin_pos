# 1 — Architectuuroverzicht

Drie lagen, één backend.

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

## De drie lagen

| | Layer 1 — POS | Layer 2 — Dashboard | Layer 3 — Integration API |
|---|---|---|---|
| **Source** | `/frontend` | `/dashboard` | `backend/.../V1/*` |
| **Runtime** | Electron (Win) / Capacitor (Android) | Browser SPA | HTTP only |
| **Auth** | Sanctum bearer | Sanctum bearer | API key (`X-Api-Key`) |
| **2FA** | Per-policy | Verplicht voor Super Admin + govt | n.v.t. |
| **Idle timeout** | 15 min | 60 min | — |
| **Offline-capable** | Ja (5-laagse sync) | Nee | Nee |
| **Format** | REST JSON | REST JSON | JSON:API |
| **Docs** | deze map | deze map | `GET /api/v1/docs` (Swagger) |

Het dashboard heeft geen eigen backend — het deelt Laravel met de POS. Authorisatie wordt afgedwongen op de controller-laag (Spatie permissions + policies); de dashboard-UI *verbergt* alleen wat een rol niet mag doen.

Layer 3 bestaat zodat POS-systemen van derden verkopen kunnen pushen of rapporten kunnen pullen zonder gebruikerslogin. Eén API key per integratie, scoped op een vestiging, rate-limited.

---

## Container-map (dev-stack)

`docker compose up -d` brengt 8 containers omhoog:

| Container | Rol | Host-poort |
|---|---|---|
| `josbin_pos_nginx` | Reverse proxy → PHP-FPM | **8080** |
| `josbin_pos_app` | PHP-FPM (Laravel) | — |
| `josbin_pos_postgres` | Postgres 16 + pgvector | **5432** |
| `josbin_pos_pgbouncer` | Connection pool | **5433** |
| `josbin_pos_redis` | Redis 7 | **6379** |
| `josbin_pos_reverb` | WebSocket | **6001** |
| `josbin_pos_horizon` | Queue worker | — |
| `josbin_pos_scheduler` | Cron-loop | — |

Frontends draaien **buiten** Docker:

| | Commando | URL |
|---|---|---|
| POS | `cd frontend && npm run dev` | http://localhost:5173 |
| Dashboard | `cd dashboard && npm run dev` | http://localhost:5174 |

Beide proxy'en `/api/*` naar `http://localhost:8080`.

---

## Request-lifecycle — een POS-verkoop

Het canonieke happy path. Andere flows zijn variaties.

```
1.  Cashier taps Pay                            POSScreen.tsx
2.  POST /api/sales                             Sanctum bearer header
3.  Nginx → PHP-FPM
4.  Sanctum middleware                          401 if invalid
5.  EnsureLicenseValid                          403 if expired (72h grace)
6.  EnsureTwoFactor                             skipped for cashier role
7.  SessionTimeout                              401 if token past 12h expiry (no idle timer yet — see Ch.3)
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

Stappen 1–8 zijn synchroon; doel < 200 ms. Stappen 9–11 zijn queued — de kassier wacht nooit.

---

## Waar dingen zitten

| Op zoek naar… | Pad |
|---|---|
| POS-scherm | `frontend/src/screens/*.tsx` |
| POS API client | `frontend/src/api/*.ts` |
| POS state | `frontend/src/store/*.ts` |
| Dashboard-scherm | `dashboard/src/screens/*.tsx` |
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
| License server (aparte app) | `/license-server` |
| Delivery scripts | `/scripts` |

Feature-by-feature-index: [12-code-map.md](12-code-map.md).

---

## Waarom drie lagen

Elk heeft een ander deployment-leven:

- **POS** ships als `.exe`/`.apk` naar fysieke hardware; moet offline werken.
- **Dashboard** is een browser SPA; updates zijn meteen.
- **Integration API** is een contract met externe systemen; versioned, sandboxed, backwards-compatible.

Eén backend bedient alle drie omdat de *data* hetzelfde is. Drie backends zou drie plekken betekenen om BTW af te dwingen, drie om audit-loggen te doen, drie om in sync te houden.

---

→ [2 — Datamodel](02-data-model.md)
