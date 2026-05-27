# 8 — Open Integration API (Layer 3)

> 🚧 **Stub** — dit hoofdstuk is gepland maar nog niet geschreven. Bekijk andere hoofdstukken in de sidebar; kom terug wanneer de marker weg is.

Het /api/v1/*-oppervlak voor POS-systemen van derden en back-office-integraties.

## Geplande scope

- API-key-auth via X-Api-Key-header, ValidateApiKey-middleware
- POST /v1/sales — single sale-ingest met volledige BTW-validatie
- POST /v1/sales/batch — offline batch upload, idempotent op sale_ref
- GET /v1/reports/* — sales pull met date range + paginatie
- Outbound webhooks — sale.created / refund.issued / shift.closed via DispatchWebhook-job
- Sandbox environment (docker-compose.sandbox.yml) — X-Josbin-Environment-header
- OpenAPI 3.0-spec + Swagger UI op /api/v1/docs

---

→ Terug naar het [overzicht](README.md)
