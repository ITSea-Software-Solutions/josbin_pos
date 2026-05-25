# 9 — Realtime broadcasts (Reverb)

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

How the dashboard and POS terminals stay live without polling.

## Planned scope

- Reverb WebSocket server (port 6001) — auth via Sanctum
- Channels: store.{id}, org.{id} — auth rules in routes/channels.php
- Events: SaleCompleted, ZReportSubmitted, CatalogueRefresh, LicenseWarning, ProductUpdated, StoreStatusChanged
- broadcast()->toOthers() — sender doesn't echo to itself
- Frontend useEcho hook + Laravel Echo client setup
- Government-org isolation — commercial users can't subscribe to govt channels

---

→ Back to the [overview](README.md)
