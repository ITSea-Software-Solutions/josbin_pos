# 10 — Jobs & schedules

> 🚧 **Stub** — dit hoofdstuk is gepland maar nog niet geschreven. Bekijk andere hoofdstukken in de sidebar; kom terug wanneer de marker weg is.

Elke queued job, elke cron-task, met hun queue + frequentie.

## Geplande scope

- RecordStockMovements (default queue) — draait na elke verkoop/void/refund
- DetectSaleAnomaly (ai queue, +5s delay) — fraude-scan, manager-alert bij flag
- DispatchWebhook (default queue) — outbound webhook met retry + signing
- Scheduled: rates:lock om 06:00 AST — dagelijkse USD→SRD-fetch van ExchangeRate-API
- Scheduled: license:check om 00:05 AST — dagelijkse licentievalidatie, 72u offline grace
- Scheduled: ai:weekly-summary maandag 08:00 — GPT-gegenereerde narrative per vestiging
- Scheduled: sanctum:prune-expired om 03:00 — token-cleanup
- Horizon dashboard op /horizon — failed_jobs handling

---

→ Terug naar het [overzicht](README.md)
