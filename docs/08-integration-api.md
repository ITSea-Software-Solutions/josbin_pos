# 8 — Open Integration API (Layer 3)

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

The /api/v1/* surface for third-party POS systems and back-office integrations.

## Planned scope

- API-key auth via X-Api-Key header, ValidateApiKey middleware
- POST /v1/sales — single sale ingest with full BTW validation
- POST /v1/sales/batch — offline batch upload, idempotent on sale_ref
- GET /v1/reports/* — sales pull with date range + pagination
- Outbound webhooks — sale.created / refund.issued / shift.closed via DispatchWebhook job
- Sandbox environment (docker-compose.sandbox.yml) — X-Josbin-Environment header
- OpenAPI 3.0 spec + Swagger UI at /api/v1/docs

---

→ Back to the [overview](README.md)
