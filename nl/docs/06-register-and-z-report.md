# 6 — Kassa & Z-Rapport

> 🚧 **Stub** — dit hoofdstuk is gepland maar nog niet geschreven. Bekijk andere hoofdstukken in de sidebar; kom terug wanneer de marker weg is.

De open-dienst → sluit-dienst-cyclus van de kassier en hoe die oprolt in het einde-dag van de manager.

## Geplande scope

- RegisterSession-states: open → closed → reopen_requested → reopen_approved
- Open: opening_float, single-session-per-register-guard, single-session-per-cashier-per-day-guard
- Sluiten: 4-step-modal, verwachte vs getelde contant, discrepantie-vastlegging
- Reopen-request-flow + manager-goedkeuring in Dashboard
- X-Rapport (mid-day snapshot) vs Z-Rapport (einde dag, vestigingsniveau)
- Z-Rapport sync_status: pending → sent → failed
- Submit-to-HQ-flow (POST /reports/z-report/{id}/submit + ZReportSubmitted broadcast)

---

→ Terug naar het [overzicht](README.md)
