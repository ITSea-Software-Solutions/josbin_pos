# 6 — Kassa & Z-Rapport

De open-dienst → sluit-dienst-cyclus van de kassier, de handmatige contant-in/uit die de lade eerlijk houdt, en hoe een dag oprolt in het vestigings-Z-Rapport dat naar HQ synct. Vrijwel alles staat in twee bestanden: `backend/app/Http/Controllers/Api/RegisterController.php` en het Z-Rapport-blok van `backend/app/Http/Controllers/Api/ReportController.php`.

Twee lagen, makkelijk te verwarren:

| Laag | Rij | Granulariteit | Geproduceerd door |
|---|---|---|---|
| Sessie | `register_sessions` | Eén dienst van één kassier op één kassa | `RegisterController` — openen/sluiten + het "mini-Z-Rapport" per sessie |
| Dag | `z_reports` | Eén rij per **vestiging** per **datum** | `ReportController::zReport` — de formele einde-dag-sluiting |

---

## De sessie-state-machine

`register_sessions.status` is een gewone `string(20)` (geen DB-enum). Er worden ooit maar drie waarden geschreven:

```
open ──sluiten──▶ closed ──reopen aanvragen──▶ reopen_requested
  ▲                                                  │
  └────────────── manager keurt goed ────────────────┘
                  (weigert → terug naar closed)
```

Goedkeuring produceert **geen** `reopen_approved`-status — `approveReopen` flipt de rij terug naar `open` en stempelt `reopen_approved_by/at` (`RegisterController.php:440-453`). (`Register::openSession()` tolereert een `reopen_approved`-waarde defensief, maar niets schrijft die.) Bij goedkeuring worden de sluitvelden (`closing_cash_counted`, `expected_cash`, `discrepancy`, `closed_at`, `closing_note`) genuld zodat de kassier bij de volgende sluiting opnieuw telt. Weigering houdt `closed` en legt `reopen_denial_reason` vast.

### Een sessie openen — vier guards

`POST /api/registers/{register}/open` neemt `opening_float` (verplicht, ≥ 0) en loopt vier poorten af, in volgorde:

1. **Vestigingstoewijzing** — `$user->canAccessStore($register->store_id)`, anders `403 STORE_NOT_ASSIGNED`. Kassiers/SM's zijn aan één vestiging gebonden (h. 3).
2. **Eén open sessie per kassa** — een bestaande `open`/`reopen_requested`-sessie op de kassa → `409 REGISTER_ALREADY_OPEN` (met de blokkerende sessie in de payload). Afgedwongen in code, niet in schema.
3. **Z-Rapport-dagslot** — een niet-manager kan geen kassa openen die vandaag al gesloten is (`status = closed`, `closed_at` vandaag, `cleared_at IS NULL`) → `409 REGISTER_CLOSED_FOR_DAY`. De boeken zijn verzegeld; een manager opent hem zelf of draait *clear-closed-today* (hieronder).
4. **Eén sessie per kassier per vestiging per dag** — dezelfde kassier met een andere `open`/`reopen_requested`-sessie vandaag → `409 CASHIER_ALREADY_HAS_OPEN_SESSION`.

Elke statuswijziging schrijft een `audit_logs`-rij via `logRegisterActivity` — `register.created/updated/deactivated/opened/closed/cash_movement/cleared_for_next_shift/reopen_requested/reopen_approved/reopen_denied`. Let op: de helper geeft `new_values` door als rauwe array — vooraf encoden zou de JSONB-kolom dubbel encoden en de audit-hash-chain desynchroniseren (`RegisterController.php:696-713`).

### Clear-closed-today — dienstoverdracht

`POST /api/registers/{register}/clear-closed-today` (alleen manager, reden verplicht) markeert de gesloten sessies van vandaag met `cleared_at`/`cleared_by`/`clear_note` zodat guard #3 ze negeert en de volgende dienst kan openen. De gesloten sessies zelf worden nooit teruggemuteerd — sluit-events zijn immutable, de clear is een aparte ge-audit-logde actie (`register.cleared_for_next_shift`).

---

## Cash movements — pay-in / pay-out tijdens een dienst

Geld komt binnen of verlaat een lade buiten verkopen om: wisselgeld bijgevuld, een leverancier uit de kassa betaald, een bankafstorting. Niet geregistreerd wordt elk daarvan een fantoom-discrepantie bij sluiting. De oplossing is `cash_movements` (`2026_06_12_000001`, model `backend/app/Models/CashMovement.php`):

```
POST /api/registers/sessions/{session}/cash-movements
{ direction: 'in'|'out', amount: > 0, reason: 2..255 tekens (verplicht) }
```

- Toegestaan voor de eigen kassier van de sessie of een manager, alleen zolang de sessie niet gesloten is (`409` anders).
- `amount` is altijd positief — `direction` draagt het teken (beide afgedwongen door Postgres CHECK-constraints).
- Rijen zijn append-only feiten: `$timestamps = false`, alleen een expliciete `created_at`; er is geen update/delete-endpoint.
- Elke beweging wordt ge-audit-logd als `register.cash_movement` en de response echoot de herberekende lopende `expected_cash` zodat de POS-UI direct bijwerkt (`RegisterController.php:286-331`).

---

## Verwachte contant — de sluitformule

`computeExpectedCash` + `manualCashNet` (`RegisterController.php:624-658`), volledig bcmath:

```
expected_cash = opening_float
              + Σ cash_received − change     (voltooide cash/mixed-verkopen, total ≥ 0)
              − Σ |total|                    (voltooide cash/mixed-refund-rijen, total < 0)
              + Σ pay-in − Σ pay-out         (cash_movements)
```

Details die dit eerlijk houden:

- Alleen de methoden `cash` en `mixed` raken de lade. Bij `mixed` vangt `cash_received_srd − change_srd` exact het contante deel; het kaartdeel staat in `card_amount_srd`.
- Refunds worden opgeslagen als sale-rijen met negatief totaal (h. 4); hun `cash_received_srd`/`change_srd` zijn NULL zodat ze niet in de cash-in-term kunnen lekken.
- `bank_transfer` / `mobile_transfer` / `foreign_cash` / `qr_payment` komen hier nooit voor — ze settelen de lade niet (vreemde valuta is een fysiek aparte valutatelling).

## Een sessie sluiten

`POST /api/registers/sessions/{session}/close` — de eigen kassier van de sessie, of een manager die `canAccessStore` heeft op de vestiging van de sessie (rol alleen is niet genoeg: een OA van org A mag nooit org B's sessie sluiten — of lezen — via een geraden UUID). Payload: `closing_cash_counted` (verplicht) + optionele `closing_note`.

De controller snapshot `expected_cash` op sluitmoment en bewaart `discrepancy = geteld − verwacht` (getekend: negatief = tekort, positief = overschot). Alle drie waarden persisteren op de sessie-rij, zodat latere bewegingen of edits een gesloten dienst nooit kunnen herschrijven.

## Het sessie-mini-Z-Rapport

`GET /api/registers/sessions/{session}/report` (`sessionReport`, `RegisterController.php:501-617`) — zelfde zichtbaarheidsregel als sluiten. Eén aggregatie-query splitst positieve/negatieve totalen met `CASE`-expressies in plaats van twee queries:

| Blok | Inhoud |
|---|---|
| Tellingen | `transaction_count`, `refund_count`, `void_count` + `void_total`, `items_sold` |
| Geld | `gross_sales`, `discounts_total`, `refunds_total`, `net_sales`, `total_btw` |
| `payment_breakdown` | Netto per methode — **alle zeven**: `cash`, `card`, `mixed`, `bank_transfer`, `mobile_transfer`, `foreign_cash`, `qr_payment` |
| `cash_drawer` | `opening_float`, `cash_in`, `cash_out` (verkoop-gedreven), `pay_in`, `pay_out` (handmatige bewegingen, als eigen regels getoond), `expected` |
| Sluiting | `expected_cash`, `closing_cash_counted`, `discrepancy` |

Vóór sluiting wordt `expected_cash` live berekend zodat de kassier het lopende cijfer ziet; na sluiting retourneert het endpoint de gepersisteerde sluitmoment-snapshot.

---

## X-Rapport vs Z-Rapport

| | X-Rapport | Z-Rapport |
|---|---|---|
| Endpoint | `GET /api/reports/x-report` | `POST /api/reports/z-report` |
| Permission | `reports.x_report` | `z_report.close` (+ `canAccessStore`) |
| Effect | Geen — tussentijdse snapshot, lade blijft open | Verzegelt de dag van de vestiging; één rij per vestiging per datum |
| Herhaalbaar | Onbeperkt | `409 ALREADY_CLOSED` bij de tweede poging |

Beide zijn opgebouwd uit dezelfde `buildDailySummary`-aggregatie; de X-Rapport-response draagt de herinnering *"Dit is een tussentijds overzicht. De kassalade is NIET afgesloten."*

`zReport` valideert `store_id` (`StoreBelongsToOrg`) + `actual_cash_srd` + optionele `discrepancy_note`, en persisteert dan de dag (`ReportController.php:144-205`):

- Totalen: `total_sales_srd`, `transaction_count`, `total_btw_srd`.
- **Per-methode-totalen — alle zeven kolommen.** `cash_total_srd`, `card_total_srd`, `mixed_total_srd`, `bank_transfer_total_srd`, `mobile_transfer_total_srd`, `foreign_cash_total_srd`, `qr_payment_total_srd`. De laatste vijf landden in `2026_07_06_090001_add_method_totals_to_z_reports.php` — daarvóór liet de gepersisteerde uitsplitsing die methoden stilzwijgend vallen en telde ze op een QR-zware (Mopé / Uni5Pay+) dag niet meer op tot `total_sales_srd`. Bestaande rijen defaulten naar `0.00`.
- Contant-reconciliatie: `expected_cash_srd` (het contant-totaal van de dag), `actual_cash_srd` (telling van de manager), `cash_discrepancy_srd`, en `discrepancy_note` — alleen opgeslagen als de discrepantie niet nul is.
- `top_products` + `btw_breakdown` JSON-snapshots voor het geprinte rapport.

Let op dat de twee reconciliatieniveaus elkaar niet overlappen: pay-ins/pay-outs en openingsfloats zijn **sessie**-feiten die in de verwachte contant van elke sessie worden gevouwen; het vestigings-Z-Rapport vergelijkt de totaaltelling van de manager met de contant-verkopen van de dag. De sessie-mini-Z-rapporten zijn waar een lade-discrepantie wordt getraceerd.

---

## Sync: pending → sent (→ failed)

`z_reports.sync_status` is een echte enum: `pending | sent | failed` (`2026_04_12_200011`, default `pending`). Handmatig "Indienen bij hoofdkantoor" — sync-optie C uit het voorstel:

```
POST /api/reports/z-report/{zReport}/submit        permission: z_report.submit
  ├── al verzonden → 409 ALREADY_SENT
  ├── update: sync_status = 'sent', synced_at = now()
  └── broadcast ZReportSubmitted (org-kanaal)      → dashboard-vestigingskaart werkt live bij
```

`GET /api/reports/z-report/history` (`z_report.view_history`) retourneert de laatste **7** sluitingen van de vestiging voor de historietabel van het Einde-Dag-scherm. Het broadcast-event staat in [9 — Realtime broadcasts](09-realtime-broadcasts.md); de offline-retry-ladder rond `failed` is [7 — Sync & offline](07-sync-and-offline.md).

---

## Waar elk stuk zit

```
Kassa's & sessies
├── RegisterController              backend/app/Http/Controllers/Api/RegisterController.php
│   ├── open / close                :136 / :227
│   ├── recordCashMovement          :286
│   ├── clearClosedToday            :348
│   ├── requestReopen/approveReopen :399 / :428
│   ├── sessionReport               :501
│   └── computeExpectedCash         :624
├── Register / RegisterSession      backend/app/Models/Register.php, RegisterSession.php
└── CashMovement                    backend/app/Models/CashMovement.php  (2026_06_12_000001)

Z-Rapport (vestigingsdag)
├── ReportController::zReport       backend/app/Http/Controllers/Api/ReportController.php:144
├── ReportController::submitZReport :214   → broadcast ZReportSubmitted
├── ReportController::zReportHistory:238
├── ZReport                         backend/app/Models/ZReport.php
└── Methode-totaal-kolommen         2026_07_06_090001_add_method_totals_to_z_reports.php
```

---

→ Volgende: [7 — Sync & offline](07-sync-and-offline.md)
