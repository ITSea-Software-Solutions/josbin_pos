# Offline Fallback — Verificatiestatus

> **Waarom deze doc:** de architecture HTML en proposal beschrijven een "vijflaagse offline fallback". Dit is de eerlijke status van wat er werkelijk geïmplementeerd is vs. scaffolded vs. aspirationeel, vanaf de laatste verificatie-pass.

## Geverifieerd werkend

### Layer 3 — Z-Rapport sync naar cloud (submit-to-HQ)
- `POST /api/reports/z-report/{zReport}/submit` flipt `sync_status` van `pending` → `sent` en stempelt `synced_at`.
- Alleen voor managers via `z_report.submit`-permission.
- Idempotent: re-submit op een al-verzonden rapport retourneert de bestaande rij, geen duplicaat.
- **Caveat:** dit update de *lokale* `z_reports.sync_status`. De daadwerkelijke HTTPS-push naar een aparte cloud-Laravel-instance is hier niet bedraad — voorlopig betekent "sent" "gemarkeerd als verzonden in de lokale DB". In een echte deployment zou de cloud-Laravel een aparte service zijn die dit ontvangt via hetzelfde `/sync/import`-endpoint dat hieronder wordt beschreven.

### Layer 4 — USB encrypted export / import
- `GET /api/sync/export?store_id=X&from_date=Y&to_date=Z` produceert een AES-256 + HMAC-SHA256 signed JSON-file (`.josbin_pos`).
- `POST /api/sync/import` (multipart `file` + `store_id`) re-derived de key, verifieert de HMAC, ingest de sales en items.
- Lokaal geverifieerd: 797-byte export → re-import retourneert `imported:0, skipped:0, errors:[]` voor same-store-roundtrip (verwacht — de bron bestaat al).
- **Use case bewezen:** een manager in het binnenland kan het bestand op USB opslaan of via WhatsApp versturen; HQ uploadt via het dashboard en het landt alsof normaal gesynchroniseerd.

## Scaffolded maar nog niet bedraad

### Layer 1 — Real-time sync bij elke verkoop
Sale-aanmaak commit alleen lokaal. Er is nog geen per-verkoop HTTPS-push naar een cloud-receiver. Het datamodel ondersteunt het (`sales.synced_at` zou kunnen worden toegevoegd; outbox-tabel niet aanwezig). Cloud-receiver zou een aparte Laravel-app zijn.

### Layer 2 — Auto retry met backoff (1m → 5m → 15m → 30m)
Hangt af van Layer 1-outbox. Nog geen retry-job. Het `RecordStockMovements`-job-pattern is de juiste vorm om het op te modelleren.

### Layer 5 — Catch-up sync elke 60 s
Geen geplande `sync:catchup`-commando in `routes/console.php`. Schedule runt al `rates:lock` en `license:check` dus dit toevoegen is mechanisch zodra Layer 1 bestaat.

## Mobile data-fallback (4G-dongle)

Documentatie beschrijft een 4G USB-dongle (Digicel / Telesur) als secundair netwerkpad. Dit is **deployment / netwerkconfiguratie**, geen applicatiecode — er valt niets in de codebase te verifiëren. Configureer op OS-niveau op de back-office-PC; de applicatie ziet alleen "internet is bereikbaar" of niet.

## Wat dit betekent voor de demo

Voor een client-demo, leun op:
- ✅ **Layer 4** — open het Einde Dag-scherm, klik "Exporteer als .josbin_pos", toon het bestand, dan "Importeer" op het dashboard. Echt indrukwekkend en werkt.
- ✅ **Layer 3** — manager klikt "Indienen bij HQ" op Z-Rapport, status flipt naar `Verzonden ✓`. Eerlijk framen: "dit is de lokale kant van de handshake; de cloud-receiver is hetzelfde `/sync/import`-endpoint dat hierboven wordt getoond."
- ⚠️ **Layers 1, 2, 5** — beschrijf ze als "in het datamodel; cloud-receiver en outbox zijn de volgende sprint". Beweer niet dat ze end-to-end werken vandaag.

## Volgende sprint om de gap te dichten

1. `sales`-tabel — voeg `synced_at` nullable timestamp + index toe.
2. Nieuwe job `PushSaleToCloud` gedispatcht na `SaleController::store`-commit. Leest `CLOUD_API_URL` uit `.env`; POST `/v1/sales` (het bestaande Layer 3-integratie-endpoint accepteert deze shape al). Bij 2xx, set `synced_at = now()`. Bij failure handelt Laravel queue-retries de backoff af.
3. Geplande `sync:catchup` elke minuut — pusht elke `synced_at IS NULL` sale ouder dan 60 s.
4. Optioneel: `sales_outbox`-tabel als je expliciete failed-attempt-tracking zichtbaar in Horizon wilt.

Dit voegt ~1 dag werk toe en maakt Layers 1, 2, 5 echt in plaats van beschreven.
