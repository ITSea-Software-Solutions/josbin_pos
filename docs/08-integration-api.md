# 8 — Open Integration API (Layer 3)

The `/api/v1/*` surface that lets a third-party POS push its sales into Josbin and pull its own reports back out. Controllers live in `backend/app/Http/Controllers/V1/`, routes in `backend/routes/api.php:363-382`, auth in one middleware: `backend/app/Http/Middleware/ValidateApiKey.php`.

Design stance: the external system is the **system of record** for its own sales. Josbin re-derives the BTW server-side (so filings stay defensible) but does not second-guess payment state — an API-ingested transfer arrives already paid.

---

## Authentication — `X-API-Key`

No Sanctum here. Every `/v1` call (except the docs endpoints) passes `ValidateApiKey`, registered as the `api.key` middleware alias:

1. Read the `X-API-Key` header — missing → `401`.
2. `hash('sha256', $rawKey)` and match against `api_integrations.api_key_hash` where `is_active` — no match → `401`. Raw keys are never stored.
3. Rate limit: **1,000 calls/min per key** (cache counter) → `429` beyond that.
4. Bump `api_integrations.last_ping_at` (feeds the "last seen" column in the dashboard's API-keys screen).
5. Attach the resolved `ApiIntegration` to the request (`$request->attributes->get('api_integration')`) — every controller scopes to `$integration->store` from there. There is no cross-store reach by construction.

One key belongs to one store (`api_integrations.store_id`). A chain integrating five branches gets five keys.

---

## `POST /v1/sales` — single sale ingest

`V1\SaleController::store` (`backend/app/Http/Controllers/V1/SaleController.php:35`). Validation:

| Field | Rules |
|---|---|
| `sale_ref` | required, ≤ 100 chars — the *external* system's transaction id |
| `occurred_at` | required, date |
| `payment_method` | required, one of **all seven** `Sale::PAYMENT_METHODS`: `cash`, `card`, `mixed`, `bank_transfer`, `mobile_transfer`, `foreign_cash`, `qr_payment` |
| `payment_provider` / `payment_reference` | optional, ≤ 64 — bank / wallet name + transaction ref, feeding the per-provider reconciliation reports |
| `foreign_currency` / `foreign_amount` | optional — `USD`/`EUR` + amount, for `foreign_cash` |
| `items[]` | required, ≥ 1: `product_name`, `unit_price`, `quantity` (≥ 0.001), `btw_rate` (0–100), `btw_exempt?`, `discount_srd?` |

What the controller does with it:

- **BTW is recomputed server-side** through the same `BtwCalculationService::calculateLineItem` the native POS uses (ch 5) — the caller's own tax math is ignored. Discount-before-BTW ordering therefore holds across sources, and `sales.source = 'api'` rows are directly comparable to native ones in BTW filings and Z-Reports.
- Provider fields are persisted only on methods that use them (`bank_transfer`, `mobile_transfer`, `qr_payment`); `foreign_*` only on `foreign_cash`, and `foreign_rate_used` is stamped from the locked daily rate **for USD only** — `daily_rates` has no EUR rate, and stamping the USD rate onto a EUR sale would bake wrong audit data in.
- **Pending-type methods arrive pre-confirmed**: `payment_confirmed_at = now()` for `Sale::PM_PENDING_CONFIRMATION` methods. The external till already took the payment; queuing it for OA confirmation would clutter the pending-payments screen with transfers the OA cannot verify.
- `cashier_id` is NULL (no Josbin cashier), `sale_number` comes from the same per-store advisory-lock allocator as native sales, `exchange_rate_used` is stamped for audit.

Response: `201` with the stored sale, or `200` with the *existing* sale when the request is an idempotent replay (below). Everything runs in one DB transaction; failures roll back and return `422`.

## Idempotency — scoped to `(api_integration_id, external_sale_ref)`

> The old claim "idempotent on sale_ref (per store)" is **wrong** since `2026_07_02_090001`.

`external_sale_ref` originally carried a *global* unique constraint while the lookup was scoped per store. Two **different** integrations reusing the same `sale_ref` on one store collided: the retrying integrator got back *another vendor's* sale — a silently lost transaction and corrupted BTW.

Idempotency is now per-integration:

- `sales.api_integration_id` (FK, nullable) is stamped on every API-sourced sale, so each sale records which integration produced it.
- The global unique was replaced by the composite **partial** unique index `sales_integration_external_ref_unique ON (api_integration_id, external_sale_ref) WHERE external_sale_ref IS NOT NULL`.
- The lookup in `store()` matches on both columns: a retry from the *same* integration returns the existing sale (`200`); the *same ref from a different integration* inserts cleanly.

Native POS sales (both columns NULL) are excluded by the partial predicate and never contend on this index.

## `POST /v1/sales/batch` — offline catch-up

`V1\SaleController::batch`. Accepts `{ sales: [...] }`, **max 500 items** per request. Each item is replayed through `store()` internally, so per-item validation, BTW math and idempotency are identical to the single endpoint. One bad item doesn't fail the batch:

```json
{ "created": 412, "skipped": 86, "failed": 2, "errors": [ { "index": 17, "sale_ref": "...", "message": "..." } ] }
```

`skipped` = idempotent duplicates (the retry-after-connection-loss case this endpoint exists for).

---

## `GET /v1/reports/*` — pull your own data

`V1\ReportController`, scoped strictly to the integration's store:

| Endpoint | Returns | Guards |
|---|---|---|
| `GET /v1/reports/sales?date_from&date_to&per_page` | Paginated completed sales for the range | Max range **31 days** (`422 InvalidRange`), `per_page` 10–200 |
| `GET /v1/reports/summary?date_from&date_to` | Aggregate totals for the range (count, sales, BTW) | `date_to ≥ date_from` |

---

## Outbound webhooks

`App\Jobs\DispatchWebhook` (queued, `tries = 4`, backoff `1m → 5m → 30m → 2h`). Subscription is per integration: `api_integrations.webhook_url` + `webhook_events` (JSONB array; `'*'` = everything; defaults to `['sale.created']` on key creation).

`DispatchWebhook::dispatchIfActive($orgId, $event, $payload)` fans out to every active, subscribed integration in the organisation. **Today the only emitted event is `sale.created`, fired on `/v1/sales` ingest** — so webhooks currently notify *other* integrations in the org about API-sourced sales. `refund.issued` / `shift.closed` are reserved names from the proposal, not yet emitted; wire them by calling `dispatchIfActive` from the native `SaleController::refund` / Z-Report close paths.

Delivery contract (verify before trusting a payload):

```
POST {webhook_url}
Content-Type: application/json
X-JosbinPOS-Event:     sale.created
X-JosbinPOS-Signature: sha256=hash_hmac('sha256', rawBody, webhook_secret)
X-JosbinPOS-Delivery:  {job id}

{ "event": "sale.created", "store_id": "...", "occurred_at": "...", "data": { ...sale } }
```

`webhook_secret` is per integration (encrypted at rest since `2026_06_05_000001`); a missing secret is auto-generated on first delivery. Failed deliveries land in Horizon (ch 10) with the retry schedule above.

---

## Sandbox

`docker-compose.sandbox.yml` at the repo root runs an isolated stack (own database, own `horizon`, seeded by `SandboxSeeder`) for integrators to test against. With `JOSBIN_POS_SANDBOX=true` (`config('josbin_pos.sandbox')`), every `/v1` response carries `X-Josbin-Environment: sandbox` so an integrator can prove they're not hitting production.

---

## OpenAPI docs

Public — integrators must be able to read the docs before they have a key (`backend/routes/api.php:379-382`):

| Path | Serves |
|---|---|
| `GET /api/v1/openapi.json` | The OpenAPI **3.0.3** spec, from `backend/resources/api-docs/openapi.json` — covers `/v1/sales`, `/v1/sales/batch`, `/v1/reports/sales`, `/v1/reports/summary` |
| `GET /api/v1/docs` | Swagger UI (`resources/views/api-docs.blade.php`) rendering that spec |

The spec is a checked-in file, not generated — when you change a `/v1` contract, update `openapi.json` in the same commit.

---

## Where each piece lives

```
Auth
└── ValidateApiKey (api.key)        backend/app/Http/Middleware/ValidateApiKey.php

Ingest
├── V1\SaleController::store        backend/app/Http/Controllers/V1/SaleController.php:35
├── V1\SaleController::batch        :189
└── Idempotency index               2026_07_02_090001_scope_external_sale_ref_to_api_integration.php

Reports
└── V1\ReportController             backend/app/Http/Controllers/V1/ReportController.php

Webhooks
├── DispatchWebhook (job)           backend/app/Jobs/DispatchWebhook.php
└── ApiIntegration (model)          backend/app/Models/ApiIntegration.php

Docs & sandbox
├── V1\ApiDocsController            backend/app/Http/Controllers/V1/ApiDocsController.php
├── OpenAPI spec                    backend/resources/api-docs/openapi.json
└── Sandbox stack                   docker-compose.sandbox.yml + config/josbin_pos.php ('sandbox')

Key management (dashboard side)
└── ApiIntegrationController        backend/app/Http/Controllers/Api/ApiIntegrationController.php
```

---

→ Next: [9 — Realtime broadcasts](09-realtime-broadcasts.md)
