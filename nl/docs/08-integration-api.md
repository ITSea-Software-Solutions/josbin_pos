# 8 — Open Integration API (Layer 3)

Het `/api/v1/*`-oppervlak waarmee een POS van derden zijn verkopen in Josbin pusht en zijn eigen rapporten terug pullt. Controllers staan in `backend/app/Http/Controllers/V1/`, routes in `backend/routes/api.php:363-382`, auth in één middleware: `backend/app/Http/Middleware/ValidateApiKey.php`.

Ontwerpstandpunt: het externe systeem is het **system of record** voor zijn eigen verkopen. Josbin herleidt de BTW server-side (zodat aangiften verdedigbaar blijven) maar trekt de betaalstatus niet in twijfel — een via de API binnengekomen transfer is al betaald.

---

## Authenticatie — `X-API-Key`

Geen Sanctum hier. Elke `/v1`-call (behalve de docs-endpoints) passeert `ValidateApiKey`, geregistreerd als de `api.key`-middleware-alias:

1. Lees de `X-API-Key`-header — ontbreekt → `401`.
2. `hash('sha256', $rawKey)` en match tegen `api_integrations.api_key_hash` waar `is_active` — geen match → `401`. Rauwe keys worden nooit opgeslagen.
3. Rate limit: **1.000 calls/min per key** (cache-teller) → `429` daarboven.
4. Bump `api_integrations.last_ping_at` (voedt de "laatst gezien"-kolom in het API-keys-scherm van het dashboard).
5. Hang de opgeloste `ApiIntegration` aan de request (`$request->attributes->get('api_integration')`) — elke controller scoped vandaaruit op `$integration->store`. Cross-store-bereik bestaat by construction niet.

Eén key hoort bij één vestiging (`api_integrations.store_id`). Een keten die vijf filialen integreert krijgt vijf keys.

---

## `POST /v1/sales` — enkele verkoop-ingest

`V1\SaleController::store` (`backend/app/Http/Controllers/V1/SaleController.php:35`). Validatie:

| Veld | Regels |
|---|---|
| `sale_ref` | verplicht, ≤ 100 tekens — het transactie-id van het *externe* systeem |
| `occurred_at` | verplicht, datum |
| `payment_method` | verplicht, één van **alle zeven** `Sale::PAYMENT_METHODS`: `cash`, `card`, `mixed`, `bank_transfer`, `mobile_transfer`, `foreign_cash`, `qr_payment` |
| `payment_provider` / `payment_reference` | optioneel, ≤ 64 — bank-/walletnaam + transactiereferentie, voeden de per-provider-reconciliatierapporten |
| `foreign_currency` / `foreign_amount` | optioneel — `USD`/`EUR` + bedrag, voor `foreign_cash` |
| `items[]` | verplicht, ≥ 1: `product_name`, `unit_price`, `quantity` (≥ 0.001), `btw_rate` (0–100), `btw_exempt?`, `discount_srd?` |

Wat de controller ermee doet:

- **BTW wordt server-side herberekend** via dezelfde `BtwCalculationService::calculateLineItem` als de native POS (h. 5) — de eigen belastingberekening van de caller wordt genegeerd. De korting-vóór-BTW-volgorde geldt dus over alle bronnen, en `sales.source = 'api'`-rijen zijn in BTW-aangiften en Z-Rapporten direct vergelijkbaar met native rijen.
- Provider-velden persisteren alleen op methoden die ze gebruiken (`bank_transfer`, `mobile_transfer`, `qr_payment`); `foreign_*` alleen op `foreign_cash`, en `foreign_rate_used` wordt gestempeld vanuit de gelockte dagkoers **alleen voor USD** — `daily_rates` heeft geen EUR-koers, en de USD-koers op een EUR-verkoop stempelen zou foute audit-data inbakken.
- **Pending-type methoden komen vooraf bevestigd binnen**: `payment_confirmed_at = now()` voor `Sale::PM_PENDING_CONFIRMATION`-methoden. De externe kassa heeft de betaling al aangenomen; ze in de OA-bevestigingsqueue zetten zou het pending-payments-scherm vervuilen met transfers die de OA niet kán verifiëren.
- `cashier_id` is NULL (geen Josbin-kassier), `sale_number` komt uit dezelfde per-vestiging advisory-lock-allocator als native verkopen, `exchange_rate_used` wordt gestempeld voor audit.

Response: `201` met de opgeslagen verkoop, of `200` met de *bestaande* verkoop wanneer de request een idempotente replay is (hieronder). Alles draait in één DB-transactie; fouten rollen terug en retourneren `422`.

## Idempotentie — gescoped op `(api_integration_id, external_sale_ref)`

> De oude claim "idempotent op sale_ref (per vestiging)" is **fout** sinds `2026_07_02_090001`.

`external_sale_ref` droeg oorspronkelijk een *globale* unique-constraint terwijl de lookup per vestiging scopede. Twee **verschillende** integraties die dezelfde `sale_ref` op één vestiging hergebruikten botsten: de retryende integrator kreeg *de verkoop van een andere leverancier* terug — een stilzwijgend verloren transactie en gecorrumpeerde BTW.

Idempotentie is nu per integratie:

- `sales.api_integration_id` (FK, nullable) wordt op elke API-sourced verkoop gestempeld, zodat elke verkoop vastlegt welke integratie hem produceerde.
- De globale unique is vervangen door de composite **partial** unique index `sales_integration_external_ref_unique ON (api_integration_id, external_sale_ref) WHERE external_sale_ref IS NOT NULL`.
- De lookup in `store()` matcht op beide kolommen: een retry van *dezelfde* integratie retourneert de bestaande verkoop (`200`); *dezelfde ref van een andere integratie* insert schoon.

Native POS-verkopen (beide kolommen NULL) vallen buiten het partial-predicaat en concurreren nooit op deze index.

## `POST /v1/sales/batch` — offline inhalen

`V1\SaleController::batch`. Accepteert `{ sales: [...] }`, **max. 500 items** per request. Elk item wordt intern door `store()` gereplayd, dus per-item-validatie, BTW-math en idempotentie zijn identiek aan het enkele endpoint. Eén fout item laat de batch niet falen:

```json
{ "created": 412, "skipped": 86, "failed": 2, "errors": [ { "index": 17, "sale_ref": "...", "message": "..." } ] }
```

`skipped` = idempotente duplicaten (het retry-na-verbindingsverlies-geval waarvoor dit endpoint bestaat).

---

## `GET /v1/reports/*` — je eigen data pullen

`V1\ReportController`, strikt gescoped op de vestiging van de integratie:

| Endpoint | Retourneert | Guards |
|---|---|---|
| `GET /v1/reports/sales?date_from&date_to&per_page` | Gepagineerde voltooide verkopen voor het bereik | Max. bereik **31 dagen** (`422 InvalidRange`), `per_page` 10–200 |
| `GET /v1/reports/summary?date_from&date_to` | Aggregaat-totalen voor het bereik (aantal, omzet, BTW) | `date_to ≥ date_from` |

---

## Uitgaande webhooks

`App\Jobs\DispatchWebhook` (queued, `tries = 4`, backoff `1m → 5m → 30m → 2u`). Abonnement is per integratie: `api_integrations.webhook_url` + `webhook_events` (JSONB-array; `'*'` = alles; default `['sale.created']` bij key-aanmaak).

`DispatchWebhook::dispatchIfActive($orgId, $event, $payload)` waaiert uit naar elke actieve, geabonneerde integratie in de organisatie. **Vandaag is `sale.created` het enige geëmitteerde event, afgevuurd bij `/v1/sales`-ingest** — webhooks informeren dus momenteel *andere* integraties in de org over API-sourced verkopen. `refund.issued` / `shift.closed` zijn gereserveerde namen uit het voorstel, nog niet geëmitteerd; sluit ze aan door `dispatchIfActive` aan te roepen vanuit de native `SaleController::refund` / Z-Rapport-sluitpaden.

Leveringscontract (verifieer voordat je een payload vertrouwt):

```
POST {webhook_url}
Content-Type: application/json
X-JosbinPOS-Event:     sale.created
X-JosbinPOS-Signature: sha256=hash_hmac('sha256', rawBody, webhook_secret)
X-JosbinPOS-Delivery:  {job id}

{ "event": "sale.created", "store_id": "...", "occurred_at": "...", "data": { ...sale } }
```

`webhook_secret` is per integratie (encrypted at rest sinds `2026_06_05_000001`); een ontbrekend secret wordt bij de eerste levering auto-gegenereerd. Gefaalde leveringen landen in Horizon (h. 10) met het retry-schema hierboven.

---

## Sandbox

`docker-compose.sandbox.yml` in de repo-root draait een geïsoleerde stack (eigen database, eigen `horizon`, geseed door `SandboxSeeder`) waar integrators tegen kunnen testen. Met `JOSBIN_POS_SANDBOX=true` (`config('josbin_pos.sandbox')`) draagt elke `/v1`-response `X-Josbin-Environment: sandbox`, zodat een integrator kan bewijzen dat hij niet op productie zit.

---

## OpenAPI-docs

Publiek — integrators moeten de docs kunnen lezen vóórdat ze een key hebben (`backend/routes/api.php:379-382`):

| Path | Serveert |
|---|---|
| `GET /api/v1/openapi.json` | De OpenAPI **3.0.3**-spec, uit `backend/resources/api-docs/openapi.json` — dekt `/v1/sales`, `/v1/sales/batch`, `/v1/reports/sales`, `/v1/reports/summary` |
| `GET /api/v1/docs` | Swagger UI (`resources/views/api-docs.blade.php`) die die spec rendert |

De spec is een ingecheckt bestand, niet gegenereerd — wijzig je een `/v1`-contract, werk dan `openapi.json` in dezelfde commit bij.

---

## Waar elk stuk zit

```
Auth
└── ValidateApiKey (api.key)        backend/app/Http/Middleware/ValidateApiKey.php

Ingest
├── V1\SaleController::store        backend/app/Http/Controllers/V1/SaleController.php:35
├── V1\SaleController::batch        :189
└── Idempotentie-index              2026_07_02_090001_scope_external_sale_ref_to_api_integration.php

Reports
└── V1\ReportController             backend/app/Http/Controllers/V1/ReportController.php

Webhooks
├── DispatchWebhook (job)           backend/app/Jobs/DispatchWebhook.php
└── ApiIntegration (model)          backend/app/Models/ApiIntegration.php

Docs & sandbox
├── V1\ApiDocsController            backend/app/Http/Controllers/V1/ApiDocsController.php
├── OpenAPI-spec                    backend/resources/api-docs/openapi.json
└── Sandbox-stack                   docker-compose.sandbox.yml + config/josbin_pos.php ('sandbox')

Key-beheer (dashboard-kant)
└── ApiIntegrationController        backend/app/Http/Controllers/Api/ApiIntegrationController.php
```

---

→ Volgende: [9 — Realtime broadcasts](09-realtime-broadcasts.md)
