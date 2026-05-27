# 9 — Realtime broadcasts (Reverb)

> 🚧 **Stub** — dit hoofdstuk is gepland maar nog niet geschreven. Bekijk andere hoofdstukken in de sidebar; kom terug wanneer de marker weg is.

Hoe het dashboard en de POS-terminals live blijven zonder polling.

## Geplande scope

- Reverb WebSocket-server (poort 6001) — auth via Sanctum
- Channels: store.{id}, org.{id} — auth-regels in routes/channels.php
- Events: SaleCompleted, ZReportSubmitted, CatalogueRefresh, LicenseWarning, ProductUpdated, StoreStatusChanged
- broadcast()->toOthers() — sender echoot niet naar zichzelf
- Frontend useEcho-hook + Laravel Echo client-setup
- Government-org-isolatie — commerciële gebruikers kunnen niet subscriben op govt-channels

---

→ Terug naar het [overzicht](README.md)
