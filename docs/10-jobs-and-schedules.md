# 10 — Jobs & schedules

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

Every queued job, every cron task, with their queue + frequency.

## Planned scope

- RecordStockMovements (default queue) — runs after every sale/void/refund
- DetectSaleAnomaly (ai queue, +5s delay) — fraud scan, manager alert if flagged
- DispatchWebhook (default queue) — outbound webhook with retry + signing
- Scheduled: rates:lock at 06:00 AST — daily USD→SRD fetch from ExchangeRate-API
- Scheduled: license:check at 00:05 AST — daily license validation, 72h offline grace
- Scheduled: ai:weekly-summary Monday 08:00 — GPT-generated narrative per store
- Scheduled: sanctum:prune-expired at 03:00 — token cleanup
- Horizon dashboard at /horizon — failed_jobs handling

---

→ Back to the [overview](README.md)
