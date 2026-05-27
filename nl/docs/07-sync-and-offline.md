# 7 — Sync & offline-robuustheid

> 🚧 **Stub** — dit hoofdstuk is gepland maar nog niet geschreven. Bekijk andere hoofdstukken in de sidebar; kom terug wanneer de marker weg is.

De 5-laagse fallback die de POS laat doorverkopen zelfs wanneer het internet wegvalt.

## Geplande scope

- Layer 1 — real-time outbox queue (Horizon retries bij failure)
- Layer 2 — auto-retry-schedule 1m / 5m / 15m / 30m, gele indicator
- Layer 3 — Z-Rapport forced retry bij sluiten
- Layer 4 — USB AES-256 encrypted export via SyncExportController
- Layer 5 — catch-up sync bij internet-restore, chronologische volgorde
- Mobile data-fallback (4G USB-dongle) voor binnenland-vestigingen
- Hoe verkopen overleven: lokale commit eerst, sync is downstream

---

→ Terug naar het [overzicht](README.md)
