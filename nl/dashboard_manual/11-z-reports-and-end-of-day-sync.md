# Hoofdstuk 11 — Z-Rapporten & Einde-dag Synchronisatie

**Voor wie:** Vestigingsmanager (sluit de dag af), Organisatiebeheerder (bewaakt de synchronisatiestatus, dient opnieuw in als iets blijft hangen, importeert USB-back-ups van offline vestigingen), Super Admin (leveranciersondersteuning wanneer een vestiging helemaal niet kan synchroniseren). De Auditor leest mee maar sluit nooit iets af.

**Wanneer u dit gebruikt:**
- **Eenmaal per dag, per vestiging**, aan het einde van de handelsdag — de manager sluit de dag af via het einde-dagscherm in de POS en volgt vervolgens hoe het op dit dashboard binnenkomt.
- **Elke ochtend** controleert de Organisatiebeheerder het scherm **Z-Rapporten & Synchronisatie** — elke rij die langer dan een paar uur op `pending` of `failed` blijft staan, is een dag aan data die het hoofdkantoor nog niet bereikt heeft.
- **Incidenteel, na een stroomstoring of netwerkuitval** — om een `.josbin_pos` USB-back-up te importeren van een vestiging die helemaal niet kon synchroniseren.

**Wat dit voorkomt:**
- **Verloren omzetcijfers.** Als een Z-Rapport om welke reden dan ook niet naar het hoofdkantoor synchroniseert, staat de data nog wel op de lokale Postgres van de vestiging — maar het hoofdkantoor *ziet* het niet op het geconsolideerde dashboard. Vroeg signaleren van `pending`-rijen is hoe u het hoofdkantooroverzicht zuiver houdt.
- **BTW-aangifteverrassingen.** Het maandelijkse BTW-rapport (H10) is alleen volledig als elke dag van de maand gesynchroniseerd is. Eén ontbrekende dag in mei betekent een verschil van duizend SRD bij de aangifte in juni.
- **"Het is kwijt"-paniek.** Bijna nooit terecht. De vijflaagse fallback (§11.7) zorgt ervoor dat elke afgesloten dag uiteindelijk het hoofdkantoor bereikt — meestal binnen seconden, soms pas wanneer iemand het bestand op een USB-stick komt afleveren.

![11 z-rapporten overzicht](screenshots/11-z-reports-overview.png)
---

## 11.1 Het belangrijkste onderscheid in dit hoofdstuk

**Kassa-afsluiting door de kassier** en **Z-Rapport op vestigingsniveau** zijn verschillende zaken. Mensen halen ze voortdurend door elkaar. Ze worden op verschillende momenten uitgevoerd, door verschillende mensen, op verschillende schermen.

| | **Kassa-afsluiting kassier** | **Z-Rapport vestigingsniveau** |
|---|---|---|
| Wie | Kassier (per dienst) | Vestigingsmanager (per dag) |
| Wanneer | Aan het einde van elke dienst — meestal meerdere keren per dag bij een drukke vestiging | Eenmaal per dag, nadat de **laatste** kassier afgesloten heeft |
| Waar | POS-app → bovenbalk → **Kassa sluiten** | POS-app → bovenbalk → **Dagafsluiting** |
| Gedocumenteerd in | [POS-gebruikershandleiding h3 — Uw kassa](../user_manual/03-register.md) | [POS-gebruikershandleiding h10 — Einde dag](../user_manual/10-end-of-day.md), dit hoofdstuk (hoofdkantoorzijde) |
| Wat het vergrendelt | Eén **kassasessie** — één lade voor één dienst | De **gehele handelsdag** voor de vestiging |
| Wat het vastlegt | Een `register_sessions`-rij met de kastelling voor die dienst | Een `z_reports`-rij met de dagtotalen + synchronisatiestatus |
| Kasafrekening | Per lade | Hele vestiging, inclusief alle lades |
| Recht | `register_session.close` (kassier heeft dit voor de eigen lade) | `z_report.close` (alleen manager+) |
| Synchronisatie met hoofdkantoor | Nee — uitsluitend lokaal | **Ja** — submit-to-HQ-flow |
| Idempotent? | Een kassa kan meerdere keren gesloten en heropend worden | **Eén per vestiging per dag**, hard afgedwongen via DB-uniqueness; een tweede afsluiting op dezelfde dag levert `409 ALREADY_CLOSED` op |

Als een kassier zijn kassa om 14:00 sluit omdat hij naar huis gaat, is dat een kassa-afsluiting. Als een andere kassier dezelfde kassa om 14:05 opent voor de avonddienst, is dat een nieuwe kassasessie — nog geen Z-Rapport. Het Z-Rapport gebeurt **eenmaal**, helemaal aan het eind, wanneer alle kassiers klaar zijn.

Het scherm **Z-Rapporten & Synchronisatie** van het dashboard toont alleen de tweede soort (`z_reports`-rijen). Voor kassasessiegeschiedenis op kassierniveau opent u **Kassabeheer** (zijbalk) → kies een vestiging → tabblad **Geschiedenis** — daar onderzoekt u "welke kassier zat tussen 09:00 en 14:00 op Kassa 2". De kassier-flow (dienst openen, overdracht, afsluiten, manager *Heropenen voor volgende dienst*) staat in de POS-gebruikershandleiding: [user_manual / 03-register](../user_manual/03-register.md).

---

## 11.2 Rondleiding door het scherm Z-Rapporten & Synchronisatie

**Pad:** Dashboard → linkerzijbalk → **Z-Rapporten**.

![11 z-rapporten scherm](screenshots/11-z-reports-screen.png)
Drie elementen op dit scherm:

1. **Statistiekenrij** (bovenaan) — vier KPI-kaarten: totaal Z-Rapporten binnen bereik, verzonden, in wachtrij, mislukt.
2. **USB-importpaneel** (inklapbaar) — Laag 4 noodupload. Standaard gesloten; klik om uit te klappen.
3. **Filterbare tabel** — elke afgesloten dag, nieuwste eerst, met synchronisatiestatus.

Het scherm vernieuwt automatisch elke 60 seconden. U kunt ook geforceerd vernieuwen met de knop **Vernieuwen**.

### Filterbalk

| Filter | Standaard | Notities |
|---|---|---|
| **Van** | 7 dagen geleden | Filtert op `report_date` (de kalenderdatum waarop de dag werd afgesloten). |
| **Tot** | Vandaag | Inclusief. |
| **Synchronisatiestatus** | Alle | Kies `Pending`, `Synced` of `Failed` om te verfijnen. |

### Tabelkolommen

| Kolom | Wat het toont |
|---|---|
| **Datum** | `report_date` — de AST-kalenderdatum waarop het Z-Rapport betrekking heeft. |
| **Vestiging** | Vestigingsnaam + stad. |
| **Omzet** | `total_sales_srd` — de bruto-omzet van de dag (inclusief BTW). |
| **BTW** | `total_btw_srd` — geheven belasting voor de dag. |
| **Trans.** | `transaction_count` — afgeronde verkopen. Annuleringen uitgesloten. |
| **Kasverschil** | `cash_discrepancy_srd`. Groen "OK"-pilletje bij exact. Rood pilletje als de teller tekort kwam (bv. `−SRD 5.00`). Amberkleurig pilletje bij overschot (bv. `+SRD 2.00`). Elke waarde ongelijk aan nul, ook positief, betekent dat de telling van de kassier niet overeenkwam met wat het systeem verwachtte. |
| **Sync** | Eén van vier pilletjes — zie §11.3. |
| **Afgesloten door** | Naam van de manager die op **Dag sluiten** klikte. AST-tijdstempel van de meest recente synchronisatiepoging eronder. |

Hover over een rij om deze te markeren (alleen UI — er is in deze release geen actiemenu per rij). Om een vastgelopen Z-Rapport opnieuw in te dienen gebruikt u op dit moment het einde-dagscherm aan de POS-zijde op de back-officecomputer van de vestiging; resubmit aan de hoofdkantoorzijde is een geplande actieknop (zie §11.10 — Roadmap).

### Statistiek-KPI-kaarten

| Kaart | Waarde |
|---|---|
| **Totaal** | Totaal rijen die voldoen aan het datumfilter (ongeacht status). |
| **Verzonden** | Rijen waar `sync_status = synced`. |
| **In wachtrij** | Rijen waar `sync_status = pending`. |
| **Mislukt** | Rijen waar `sync_status = failed`. |

In een gezonde operatie is **In wachtrij = aantal vestigingen dat nog handelt** (de rij van vandaag staat op `pending` totdat de manager daadwerkelijk afsluit), en **Mislukt = 0**. Alles daarbuiten is een onderzoek waard.

### Backend-endpoint

```
GET /api/dashboard/z-reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&sync_status=pending&per_page=50
```

Bron: `backend/app/Http/Controllers/Api/DashboardController.php::zReports`.

---

## 11.3 Synchronisatiestatus — de vier toestanden

Een Z-Rapport-rij bevindt zich altijd in precies één van deze toestanden. (`z_reports.sync_status` is een tekstkolom; de enum-waarden komen uit de back-officecode.)

| Status | Pilkleur | Betekenis | Wat u doet |
|---|---|---|---|
| **`pending`** | Amber | Lokaal afgesloten, nog niet naar het hoofdkantoor verzonden. Het Z-Rapport van vandaag blijft hier vanaf het moment dat de manager op Dag sluiten klikt totdat de submit-to-HQ-aanroep slaagt. | Wachten. Als het langer blijft dan verwacht, controleer dan Laag 1–2 status (§11.7) en gebruik Laag 4 (USB) als het netwerk echt onbereikbaar is. |
| **`sent`** / **`synced`** | Groen | Met succes verzonden naar het hoofdkantoor. Het cijfer is nu zichtbaar in het geconsolideerde dashboard. | Niets — dit is de doelstand. (De backend gebruikt intern `sent`; sommige payloads van het geconsolideerde dashboard normaliseren dit naar `synced` voor weergave.) |
| **`failed`** | Rood | Verzending naar het hoofdkantoor is geprobeerd en mislukt. Specifieke redenen (4xx, 5xx, timeout) worden op dit moment niet in het dashboard getoond — die staan in het back-office Laravel-log. | Onderzoek. Vaak is het een tijdelijke netwerkstoring en slaagt de volgende poging. Aanhoudende failure = USB-export (§11.5). |
| **`never`** | Grijs | Er is nog nooit gesynchroniseerd. Zeldzaam — komt alleen voor als een Z-Rapport bestaat maar de submit-to-HQ-aanroep nooit is uitgevoerd (bv. oude data van vóór de synchronisatie-flow bestond). | Handmatig indienen via het einde-dagscherm aan de POS-zijde. |

> **Eerlijke kanttekening — wat "synced" vandaag werkelijk betekent.** In de huidige release zet `submitZReport` de `sync_status` van `pending` naar `sent`, stempelt `synced_at` op de **lokale** rij, en broadcast vervolgens `ZReportSubmitted` zodat het geconsolideerde dashboard live bijwerkt. De daadwerkelijke HTTPS-push naar een *afzonderlijke* cloud-Laravel-instantie is de geplande volgende sprint — zie [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). In een single-site-implementatie (de meeste Surinaamse klanten) praten dashboard en back-office met dezelfde database, dus "sent" betekent echt "hoofdkantoor heeft de data". In een toekomstige hub-and-spoke-implementatie betekent "sent" "de cloudontvanger heeft de rij bevestigd". De gebruikersgerichte semantiek is identiek; het wire-level-gedrag wordt transparant geüpgraded.

---

## 11.4 De einde-dag-flow, van kassier uit dienst tot "Verzonden ✓"

Dit is de volledige keten, eenmaal van begin tot eind verteld. Elke stap heeft een eigen hoofdstuk; dit is het overzicht.

```
HANDELSDAG EINDIGT
        │
        ▼
1. KASSIER op Kassa 1 sluit zijn kassa           ─── POS-gebruikershandleiding h3
        │    (telt contant, vult evt. verschilnotitie in,
        │     kassasessie is nu gesloten)
        ▼
2. KASSIER op Kassa 2 sluit zijn kassa           ─── idem
        ▼
   (enzovoort voor elke kassa)
        │
        ▼
3. MANAGER opent het einde-dagscherm in POS      ─── POS-gebruikershandleiding h10
        │    (POS bovenbalk → Dagafsluiting)
        ▼
4. MANAGER bekijkt samenvatting van vandaag
        │    (totale verkopen, BTW, aantal transacties, betalingsverdeling,
        │     contanttotalen — alles afgeleid van verkopen in de lokale DB)
        ▼
5. MANAGER telt de kassalade(s) fysiek
        │    Voert werkelijke contant in. Als dit ≠ verwacht contant,
        │    vult verplichte verschilnotitie in.
        ▼
6. MANAGER klikt "Z-Rapport afdrukken"           ─── POST /api/reports/z-report
        │    Backend:
        │      • Controleert dat er geen z_reports-rij bestaat voor (store_id, vandaag)
        │        → als die wel bestaat, retourneert 409 ALREADY_CLOSED
        │      • Berekent dagtotalen via buildDailySummary()
        │      • Voegt z_reports-rij toe met sync_status='pending',
        │        cash_discrepancy_srd = werkelijk − verwacht,
        │        top_products + btw_breakdown als JSONB
        │      • Retourneert het nieuwe ZReport
        │    UI ontvangt 201, drukt de Z-Rapport-bon af
        │    (of biedt PDF aan als er geen bonprinter is).
        ▼
7. De rij is nu zichtbaar in het dashboard       ─── dit scherm
        │    Sync-pilletje = amber "Pending".
        ▼
8. MANAGER klikt "Verzenden naar hoofdkantoor"  ─── POST /api/reports/z-report/{id}/submit
        │    Backend:
        │      • Rechtencontrole: z_report.submit
        │      • Als al verzonden → 409 ALREADY_SENT
        │      • Werkt bij sync_status='sent', synced_at=now()
        │      • Broadcast ZReportSubmitted op het org-kanaal
        │        (Laravel Reverb — het dashboard werkt direct bij)
        ▼
9. Sync-pilletje slaat om naar groen "Verzonden ✓"  ─── dashboard werkt live bij
        │    (live update via WebSocket; geen refresh nodig)
        ▼
   ☑ Dag afgesloten. Het cijfer staat nu in het geconsolideerde dashboard,
   het maandelijkse BTW-rapport, en het auditlogboek.
```

Voor de **managerzijde details** (welke knop, welk bericht, wat te doen als het contant niet klopt) zie [POS-gebruikershandleiding h10](../user_manual/10-end-of-day.md). Dit hoofdstuk behandelt alles **na** stap 6 — d.w.z. wat het hoofdkantoor ziet en wat te doen als er iets misgaat.

---

## 11.5 USB-versleutelde export — Laag 4, de offline reddingsboei

![11 usb-importpaneel](screenshots/11-usb-import-panel.png)
Als het internet van een vestiging de hele dag plat ligt en de submit-to-HQ-aanroep de cloud niet kan bereiken, heeft de manager een fallback: **exporteer de data van de dag naar een versleuteld bestand, breng het op een USB-stick naar het hoofdkantoor (of stuur het via WhatsApp of e-mail), en laat een Organisatiebeheerder het uploaden via dit dashboard-scherm**.

De data komt in de database van het hoofdkantoor terecht **alsof het normaal gesynchroniseerd was** — dezelfde verkoop-ID's, dezelfde regelitems, dezelfde totalen. De pijplijn is idempotent: hetzelfde bestand tweemaal importeren voegt nul dubbele rijen toe.

### Wat zit er in het bestand

Het `.josbin_pos`-bestand is een binaire envelop:

| Laag | Inhoud |
|---|---|
| Buitenste JSON | `{ hmac, cipher, version, data }`. Plaintext envelop zodat het import-endpoint kan valideren voordat ontsleuteling wordt geprobeerd. |
| `data` (base64) | AES-256-CBC versleutelde JSON. Sleutel = `HMAC-SHA256(store_id, APP_KEY)`. IV willekeurig gegenereerd per export en vooraan toegevoegd. |
| `hmac` (hex) | HMAC-SHA256 van de **plaintext** JSON, met dezelfde sleutel. Vangt zowel manipulatie als verkeerde-sleutel-importpogingen. |
| Plaintext payload (binnen de versleuteling) | `version`, `format`, `generated_at`, `exported_by`, `organisation_id`, `store_id`, `store_name`, `period: {from, to}`, `record_count`, `total_srd`, `total_btw_srd`, `sales: [...]` (elk met zijn `items: [...]`). |

De plaintext verlaat nooit de back-officemachine. Wat op de USB meegaat is alleen de AES-envelop. **Veilig om te versturen via WhatsApp, e-mail, USB, wat dan ook** — het bestand is waardeloos voor iedereen zonder de APP_KEY van de back-office *én* het bijbehorende vestigingsrecord aan de andere kant.

### Export aan managerzijde (in de offline vestiging)

Stap voor stap, vanuit het perspectief van de manager aan de back-officecomputer:

1. Einde-dagscherm → 7-daagse historietabel → klik op de rij van de dag(en) die niet synchroniseerden op de downloadknop **💾 .josbin_pos**. (Gedetailleerd in [POS-gebruikershandleiding h10 §10.6](../user_manual/10-end-of-day.md#106-what-to-do-if-sync-fails-status--failed-or-pending).)
2. De browser downloadt `josbin_pos_<vestigingsnaam>_<van>_<tot>.josbin_pos`.
3. Manager kopieert het bestand naar een USB-stick, of voegt het toe aan een e-mail / WhatsApp naar het hoofdkantoor.
4. Manager noteert ook (of het hoofdkantoor weet al) de **Store ID** voor die vestiging — een UUID zoals `123e4567-e89b-12d3-a456-426614174000`. Zonder dit kan het hoofdkantoor het bestand niet ontsleutelen.

Het export-endpoint is `GET /api/sync/export?store_id=<uuid>&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`. Bron: `backend/app/Http/Controllers/Api/SyncExportController.php::export`.

### Import aan hoofdkantoorzijde (aan het bureau van de Organisatiebeheerder)

![11 usb-import resultaat](screenshots/11-usb-import-result.png)
1. Dashboard → scherm **Z-Rapporten**.
2. Zoek bovenaan het paneel **💾 USB back-up importeren** — klik om uit te klappen. Het is gelabeld *"Noodgeval • Laag 4"* in amber.
3. Plak de **Vestiging ID (UUID)** van de offline vestiging in het veld. (Haal dit van de offline vestiging of uit uw Vestigingen-scherm.)
4. Klik op de bestandsinvoer → kies het `.josbin_pos`-bestand dat u ontvangen heeft.
5. Klik op **Importeren**.

Wat u te zien krijgt:

| Resultaat | Betekenis |
|---|---|
| Groene banner met `N geïmporteerd · M overgeslagen` | Succes. `geïmporteerd` = nieuwe verkopen toegevoegd. `overgeslagen` = verkopen waarvan de ID's al bestonden (idempotent — veilig om opnieuw te importeren). |
| `Ontsleuteling mislukt. Verkeerde vestiging of beschadigd bestand.` | De Store ID die u heeft ingetypt komt niet overeen met het bestand. Controleer de UUID dubbel. |
| `Integriteitscontrole van bestand mislukt. Het bestand kan gemanipuleerd zijn.` | HMAC-mismatch. Het bestand is onderweg gewijzigd, of het is gegenereerd tegen een andere APP_KEY (bv. een sandbox-installatie). Vraag een nieuwe export. |
| `Ongeldig .josbin_pos-bestandsformaat.` | De buitenste envelop is misvormd. Waarschijnlijk een gedeeltelijke download; haal het bestand opnieuw op. |

Het import-endpoint is `POST /api/sync/import` met `multipart/form-data` met `file` en `store_id`. Bron: dezelfde `SyncExportController::import`. Backend-groottelimiet: 50 MB per bestand.

### Wat gebeurt er met de bestaande Z-Rapport-rij?

De import herschept de onderliggende `sales`- en `sale_items`-rijen met hun oorspronkelijke ID's. De `z_reports`-rij voor die dag **bestaat al lokaal** in de offline vestiging — die rij gaat echter nooit over de lijn bij een USB-import (de export bevat verkoopdata, geen Z-Rapport-metadata). Dus bij een USB-import:

- De individuele verkopen van de dag staan nu in de database van het hoofdkantoor.
- Geconsolideerde rapporten (H10) die die datum bestrijken bevatten nu deze verkopen.
- Het scherm **Z-Rapporten** aan de hoofdkantoorzijde toont **geen** rij voor die dag voor die vestiging — omdat er geen `z_reports`-rij is ingevoegd aan de hoofdkantoorzijde. Het lokale Z-Rapport van de vestiging bestaat nog wel in de back-office.

Dit is een bekende asymmetrie — zie §11.10 — en de workaround is in de praktijk prima: de data is wat telt; het *feit* dat de dag is afgesloten is vastgelegd in de z_reports-tabel van de back-office en op de voorpagina van het geïmporteerde bestand.

---

## 11.6 De vijflaagse offline-fallback — eerlijke status

De architectuur belooft vijf lagen redundantie tussen "internet werkt" en "manager draagt USB-sticks rond". Hier staat waar elke laag vandaag werkelijk staat.

| Laag | Wat het is | Status | Notities |
|---|---|---|---|
| **1 — Real-time synchronisatie** | Elke individuele verkoop direct na commit naar cloud gepusht | **Opgezet** | Het datamodel ondersteunt het; nog geen `synced_at`-kolom op `sales`, geen outbox-tabel, geen per-sale push-job. In huidige single-site-implementaties is dit impliciet — het dashboard leest uit dezelfde DB. |
| **2 — Auto-retry met backoff (1m → 5m → 15m → 30m)** | Mislukte Laag-1-pushes proberen volgens schema opnieuw | **Opgezet** | Afhankelijk van Laag 1's outbox. De `RecordStockMovements`-job is het juiste patroon om op te modelleren — zelfde vorm, andere payload. |
| **3 — Z-Rapport geforceerde retry / submit-to-HQ** | Manager die op Verzenden-naar-hoofdkantoor klikt is een bewuste einde-dag synchronisatiepoging | **✅ Geverifieerd** | `POST /api/reports/z-report/{zReport}/submit` is bedraad, rechten-gated, idempotent, broadcast naar het dashboard. Zie `submitZReport`-bron. |
| **4 — USB-versleutelde export** | AES-256 + HMAC `.josbin_pos`-bestand, dashboard-upload | **✅ Geverifieerd** | Zowel export- als import-endpoints werken; roundtrip getest. De volledige §11.5-flow hierboven. |
| **5 — Inhaalsynchronisatie elke 60 s** | Wanneer internet terugkomt, alle wachtrij-dagen chronologisch pushen | **Opgezet** | Geen geplande `sync:catchup`-opdracht bestaat. Andere geplande opdrachten (`rates:lock`, `license:check`) bewijzen dat de structuur werkt — inhaal toevoegen is mechanisch zodra Laag 1's outbox bestaat. |

Voor de demo en voor klantbeloften vandaag:

- **Leid met Lagen 3 en 4.** Dit zijn de headline-features en ze werken end-to-end.
- **Beschrijf Lagen 1, 2, 5 als "in het datamodel, cloud-ontvanger en outbox-verzending volgende sprint".** Niet overdrijven.

Referentie: [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md) is het canonieke "wat werkt vandaag"-document — houd het open wanneer u het offline-verhaal met een klant bespreekt.

### Mobiele data-fallback (4G-dongle)

Een 4G USB-dongle (Digicel of Telesur) aangesloten op de back-office-pc is het **secundaire netwerkpad** voor vestigingen in het binnenland waar bekabeld internet onbetrouwbaar is. Dit is **OS-niveau-configuratie**, geen applicatiegedrag — de Laravel-app ziet alleen "internet is bereikbaar" of niet. Synchronisatie-payloads zijn klein (50–200 KB per Z-Rapport), dus een trage 4G-verbinding handelt een maand handel met gemak af.

Wanneer u een nieuwe installatie inschat, is de vraag om aan de klant te stellen "waar is de netwerkaansluiting, wat is de uptime, en is er een 4G-back-upoptie?" — het antwoord bepaalt hoeveel u in de praktijk op Laag 4 zult leunen.

---

## 11.7 Wat de manager daadwerkelijk doet (referentie hoofdkantoorzijde)

Concrete acties die de dashboardgebruiker uitvoert met betrekking tot Z-Rapporten, met rechten.

| Actie | Recht | Scherm | Wat het doet |
|---|---|---|---|
| **Z-Rapportenlijst bekijken** | impliciet (org-scoped) | Z-Rapporten & Synchronisatie | Alleen-lezen, filterbaar. |
| **Synchronisatiestatus van elke afgesloten dag bekijken** | impliciet | Z-Rapporten & Synchronisatie | Eén rij per (vestiging, datum). |
| **USB-back-up importeren** | `sales.create` (gehouden door Organisatiebeheerder / Super Admin / Vestigingsmanager) | Z-Rapporten & Synchronisatie → USB-paneel | Leidt de sleutel opnieuw af van store_id, verifieert HMAC, voert verkopen in. |
| **USB-back-up exporteren voor een vestiging** | `view` op Store-policy | Back-office directe aanroep van `GET /api/sync/export` — op dit moment een back-office-actie, geen dashboard-actie | Produceert het `.josbin_pos`-bestand. |
| **Dag afsluiten** (`z_report.close`) | manager+ (Vestigingsmanager, Organisatiebeheerder, Super Admin) | POS-app → Einde dag | Voegt de `z_reports`-rij in met `sync_status='pending'`. |
| **Z-Rapport indienen bij hoofdkantoor** (`z_report.submit`) | dezelfde set als hierboven | POS-app → Einde dag → knop Verzenden naar hoofdkantoor | Zet status om naar `sent`, broadcast `ZReportSubmitted`. |
| **Historie bekijken (laatste 7 dagen)** (`z_report.view_history`) | kassier+ | POS-app → Einde dag → 7-daagse tabel | Alleen-lezen weergave van recente sluitingen voor de vestiging. |

Kassiers sluiten geen dagen — ze sluiten *kassasessies*. De twee zijn volledig gescheiden (§11.1).

---

## 11.8 Kasverschil — hoe het hier terechtkomt

Wanneer de manager de dag sluit, berekent het systeem:

```
verschil = werkelijk_contant − verwacht_contant
         = (wat de manager fysiek geteld heeft) − (beginsaldo's + contante verkopen − terugbetalingen)
```

Dit wordt opgeslagen als `cash_discrepancy_srd` op de `z_reports`-rij. De verschilkolom in de dashboardtabel toont:

- **OK (groen)** als `|verschil| ≤ SRD 0,005` (d.w.z. afrondings-nul).
- **Rood `−SRD x.xx`** als contant **tekort** was. Mogelijke oorzaken: telfout, gemiste terugbetaling, diefstal, of een verkoop die contant werd geboekt maar met pin werd betaald (geen geld in de lade ervoor).
- **Amber `+SRD x.xx`** als contant **over** was. Meestal een wisselgeldfout in het voordeel van de klant (kassier gaf te weinig wisselgeld).

Als het verschil niet nul is, **moet** de manager een `discrepancy_note` invoeren voordat de dag-sluiten-aanroep slaagt. Die notitie wordt opgeslagen op dezelfde rij en is voor altijd zichtbaar in het auditlogboek — zie [Hoofdstuk 13 — Auditlogboek](13-audit-log.md).

U wilt onderzoek doen naar:

- Aanhoudende tekorten bij één kassier — duik in de kassasessies in het Kassabeheer-scherm (H8) en zoek het patroon.
- Grote amberkleurige overtellingen — die wijzen vaak op een terugbetaling die niet correct is geregistreerd. Stem af tegen de verkooplijst voor de dag.
- Kleine afrondingsachtige verschillen — meestal veilig om te negeren. SRD contant bevat munten van 5 en 10 cent; over een drukke dag kunnen een paar centen beide kanten op drijven.

Het dashboard blokkeert of vergrendelt niet op basis van verschilgrootte — dat is een beleidsbeslissing. Als u een drempel wilt waarboven het Z-Rapport een tweede manager-goedkeuring nodig heeft, is dat ruwweg de "dubbele goedkeuring boven SRD `<drempel>`"-vereiste die als beleid is gemarkeerd voor overheidsafdelingen (zie [Hoofdstuk 1 §1.5](01-roles-and-permissions.md#15-special-rules-for-government-departments)). Voor commerciële klanten is het een leveranciersondersteuning-instelbare optie, nog niet zichtbaar in de dashboard-UI.

---

## 11.9 Eén Z-Rapport per vestiging per dag — de uniqueness-constraint

De tabel `z_reports` heeft een **uniqueness-constraint** op `(store_id, report_date)`. Er kan altijd maar één Z-Rapport-rij bestaan voor één vestiging op één kalenderdatum.

Wat gebeurt als een manager dezelfde dag twee keer probeert af te sluiten:

- POST `/api/reports/z-report` met dezelfde `store_id` voor de datum van vandaag.
- Backend detecteert de bestaande rij, retourneert:

```http
HTTP/1.1 409 Conflict
{
  "message": "De kas voor vandaag is al gesloten.",
  "code": "ALREADY_CLOSED",
  "z_report": { ... bestaande rij ... }
}
```

De UI toont de gebruiker "Vandaag is al afgesloten" in plaats van een duplicaat te maken. De bestaande rij wordt geretourneerd in de body zodat de UI de waarden ervan kan presenteren (synchronisatiestatus, totalen) — handig voor het scenario van de tweede manager die het werk van de eerste controleert.

Op dezelfde manier retourneert het opnieuw indienen van een al verzonden rapport:

```http
HTTP/1.1 409 Conflict
{
  "message": "Dit Z-rapport is al verzonden naar het hoofdkantoor.",
  "code": "ALREADY_SENT",
  "data": { ... bestaande rij ... }
}
```

Beide 409's zijn ontworpen — om te voorkomen dat dubbele statuswijzigingen een puinhoop maken.

### Twee soorten heropenen, vaak verward

Er zijn **twee** dingen die "heropend" kunnen worden — ze bevinden zich op verschillende lagen en hebben zeer verschillende gevolgen:

| Actie | Wat het doet | Wanneer het juist is |
|---|---|---|
| **Een kassasessie heropenen** (manageractie, [h19 §19.7](19-registers.md)) | Markeert een al gesloten kassiersdienst-sessie als `cleared`, zodat de volgende kassier een nieuwe sessie kan openen op dezelfde fysieke kassa. Beide sessies rollen op tot hetzelfde Z-Rapport aan het einde van de dag. | **Gebruikelijk, volledig ondersteund.** Kassier A sluit om 14:00, Kassier B begint de avonddienst op dezelfde Kassa. |
| **Het Z-Rapport zelf heropenen** voor een afgesloten dag | Maak de juridische auditgrens van de dag ongedaan. | **Vrijwel nooit juist.** Het Z-Rapport is de audit-kwaliteit sluiting — heropenen invalideert het BTW-rapport, het geconsolideerde dashboard, en alle aangiften die al naar de Belastingdienst zijn gestuurd. |

**Het Z-Rapport zelf blijft gesloten zodra het gesloten is**, by design. Als een verkoop teruggedraaid moet worden na Z-sluiting, is het juiste antwoord:
- Verwerk de terugbetaling / annulering op de oorspronkelijke verkoop-rij — dat creëert een tegenboeking die de rapporten van morgen automatisch oppikken.
- De totalen van het oorspronkelijke Z-Rapport blijven ongewijzigd; de tegenboeking wordt onder de datum van morgen vastgelegd met de oorspronkelijke verkoop-id gekoppeld.
- BTW en bankreconciliatie werken schoon omdat beide kanten van de boeking bestaan met tijdstempels.

De volledige kassasessie-heropen-flow (kassier-overdracht, manager-goedkeuring voor mid-dag heropens, geforceerd sluiten, audittrail) staat in [Hoofdstuk 19 — Kassabeheer](19-registers.md).

Als de onderliggende behoefte werkelijk *"we moeten een verkeerd geboekte verkoop terugdraaien"* is, is dat een annulering/terugbetaling op de oorspronkelijke verkoop-rij, die telt onder de rapporten van de volgende dag. De totalen van het oorspronkelijke Z-Rapport veranderen niet; de annulering wordt vastgelegd in het auditlogboek en de Rekenkamer-export (zie [Hoofdstuk 10 §10.6](10-reports.md#106-rekenkamer-export--the-court-of-audit-pdf)).

---

## 11.10 Roadmap en bekende asymmetrieën

Dingen waar dit hoofdstuk overheen gaat omdat ze gepland zijn maar niet in de huidige release zitten. Handig om te weten bij het inschatten van klantverwachtingen.

| Item | Huidige staat | Gepland |
|---|---|---|
| Knop "Verzenden naar hoofdkantoor" aan hoofdkantoorzijde op een `pending` / `failed`-rij | Niet in deze release — submit-to-HQ wordt op dit moment getriggerd vanuit het einde-dagscherm aan POS-zijde in de back-office. | Het toevoegen van een **Opnieuw indienen**-actie per rij op de dashboard Z-Rapporten-tabel staat op de backlog. |
| Knop "USB-export genereren" aan hoofdkantoorzijde | Export wordt op dit moment aangeroepen vanuit de back-office (het manager-scherm heeft de download). Het hoofdkantoor kan op dit moment geen nieuwe export *triggeren*. | Een actie aan dashboardzijde **Export genereren voor vestiging X** is gepland voor het geval de offline vestiging telefonisch bereikbaar is maar niet weet hoe de download te starten. |
| Echte Laag-1 (per-sale push naar een afzonderlijke cloudontvanger) | Alleen opgezet. In single-site-implementaties delen dashboard + back-office een DB, dus "real time" is impliciet. | Hub-and-spoke: afzonderlijke cloud Laravel-instantie; per-sale `PushSaleToCloud`-job; `sales.synced_at`-kolom; outbox-tabel. ~1 dag werk volgens `docs/offline-fallback-verification.md`. |
| USB-import maakt geen `z_reports`-rij aan hoofdkantoorzijde | Een USB-geïmporteerde dag verschijnt in geconsolideerde rapporten (verkopen zijn aanwezig) maar niet in de hoofdkantoor Z-Rapportenlijst (geen z_reports-rij meegegeven). | Toekomst: voeg de `z_reports`-metadata toe in de exportenvelop, materialiseer bij import. Lage prioriteit — de financiële data is wat telt; de Z-Rapportenlijst is een synchronisatie-zichtbaarheidstool. |
| Digitale handtekening op Rekenkamer-PDF | SHA-256 documenthash op elke pagina + in response-header. | Volledige PKCS#7 PDF-handtekening met het ondertekencertificaat van de organisatie. Landt met de org-certificaat-infrastructuur. Zie [Hoofdstuk 10 §10.6](10-reports.md#106-rekenkamer-export--the-court-of-audit-pdf). |
| Verschildrempel voor dubbele goedkeuring | Eén-goedkeurder sluiting, geen drempel-gating. | Configureerbare drempel waarboven goedkeuring van een tweede manager vereist is om de dag te sluiten. Overheidsbeleid impliceert het; commerciële klanten kunnen zich aanmelden. |

In geval van twijfel is de canonieke bron [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). Het is een eenpagina eerlijke momentopname — lees het voordat u iets live aan een klant belooft.

---

## 11.11 Probleemoplossing

| Symptoom | Wat er aan de hand is | Wat te doen |
|---|---|---|
| Rij van vandaag ontbreekt voor een vestiging | De manager heeft nog niet op **Dag sluiten** geklikt — de dag is nog open. | Wachten. Of bel ze. De *verkopen* van de dag staan nog in het geconsolideerde rapport (die lezen uit `sales`, niet uit `z_reports`). |
| Rij is amber `Pending` en is dat al uren | De manager heeft afgesloten maar niet op **Verzenden naar hoofdkantoor** geklikt. In single-site-implementaties ook normaal — de broadcast vindt plaats bij Verzenden. | Laat de manager Einde dag openen in de POS, vind de dag in de 7-daagse historie, klik op Verzenden. |
| Rij is rood `Failed` | De verzendaanroep is geprobeerd en gaf een fout. (In de huidige release is deze toestand zeldzaam — de eenvoudige flip-flag-flow faalt niet. Aanhoudende failed-rijen wijzen meestal op een handmatige DB-aanpassing of een gebroken broadcast.) | Onderzoek via het back-office Laravel-log. Opnieuw indienen via het einde-dagscherm aan POS-zijde. |
| Sync-filter op "Pending" toont rijen van gisteren | De dag(en) van gisteren zijn nooit Submit-to-HQ'd. | Laat de manager van elke vestiging indienen. Of USB-importeren (§11.5). |
| `409 ALREADY_CLOSED` bij dag afsluiten | Deze dag is al afgesloten. (Vernieuw het einde-dagscherm om de bestaande rij te zien.) | Probeer niet tweemaal af te sluiten. Als u een gemiste verkoop moet toevoegen, boek hem vandaag — hij telt in het Z-Rapport van vandaag. |
| `409 ALREADY_SENT` bij submit-to-HQ | De rij toont al `sync_status = sent`. Iemand heeft er al op geklikt, of de lokale DB weerspiegelt al een eerdere synchronisatie. | Niets te doen — de data heeft het hoofdkantoor bereikt. |
| USB-import retourneert "Verkeerde vestiging of beschadigd bestand" | De Store ID die u hebt ingetypt komt niet overeen met de versleutelde-sleutel-afleiding van het bestand. | Haal de juiste Store ID uit het Vestigingen-scherm. UUID, niet de vestigingsnaam. |
| USB-import retourneert "Integriteitscontrole bestand mislukt" | HMAC-mismatch — bestand is gewijzigd, of het is gegenereerd door een andere APP_KEY (bv. een sandbox-installatie die met een productie-dashboard praat). | Vraag een nieuwe export. Bevestig dat beide kanten op dezelfde release zitten. |
| Geconsolideerd dashboardtotaal < som van per-vestiging back-office-rapporten | Eén of meer vestigingen zijn offline en hebben niet gesynchroniseerd. | Z-Rapporten-scherm → filter Pending — dat is de lijst. Laat ze indienen, of USB-importeren. |
| Twee managers probeerden tegelijkertijd de dag af te sluiten | De uniqueness-constraint blokkeert de tweede met `409 ALREADY_CLOSED`. | Slechts één van hen zou moeten sluiten. Bepaal wie, en de ander kijkt mee vanaf het dashboard. |
| Het "Verzonden ✓"-pilletje van het dashboard verschijnt maar het geconsolideerde rapport bevat de cijfers nog steeds niet | Vernieuw het geconsolideerde tabblad. Het Rapporten-scherm vernieuwt niet automatisch; het Z-Rapporten-scherm wel. | Gewoon vernieuwen. |

---

## 11.12 Snelle referentie

```
DAGELIJKSE HOOFDKANTOORROUTINE     Z-Rapporten & Sync → check Pending = 0 van gisteren
                                                       → check Failed = 0 altijd

WANNEER EEN VESTIGING VASTZIT      Z-Rapporten & Sync → klap USB-importpaneel uit
                                                       → plak Store ID + .josbin_pos-bestand
                                                       → Importeren

RECHTEN SPIEKBRIEFJE
  z_report.close          manager+   sluit de dag vanuit de POS
  z_report.submit         manager+   klik "Verzenden naar hoofdkantoor"
  z_report.view_history   kassier+   alleen-lezen weergave van recente sluitingen
  (USB-import)            org admin+ via Z-Rapporten-scherm

KEY ENDPOINTS
  POST /api/reports/z-report                       open + sluit een dag-Z-Rapport
  POST /api/reports/z-report/{id}/submit           indienen bij hoofdkantoor
  GET  /api/reports/z-report/history?store_id=…    laatste 7 dagen voor één vestiging
  GET  /api/dashboard/z-reports                    hoofdkantoorlijst met filters
  GET  /api/sync/export?store_id=…&from=…&to=…     download .josbin_pos
  POST /api/sync/import                            upload .josbin_pos bij hoofdkantoor

SYNC-STATUSSEN
  pending  → amber  → "lokaal gesloten, nog niet gepusht"
  sent     → groen  → "hoofdkantoor heeft het"  (sommige payloads tonen dit als "synced")
  failed   → rood   → "push geprobeerd en gaf fout"
  never    → grijs  → "geen synchronisatie ooit geprobeerd" (zeldzaam/legacy)

ONTHOUD
  • Eén Z-Rapport per vestiging per dag (uniqueness-constraint).
  • Verschil ≠ 0 vereist een notitie. De notitie is permanent in auditlogboek.
  • Kassier-sluiting ≠ Z-Rapport. Zie §11.1.
  • USB-import is idempotent — hetzelfde bestand opnieuw uploaden is veilig.
```

---

## 11.13 Kruisverwijzingen

- **Kassier kassasessie-sluiting** — [POS-gebruikershandleiding h3](../user_manual/03-register.md). De per-dienst sluiting die **geen** Z-Rapport is.
- **Manager Einde-dag-workflow op POS** — [POS-gebruikershandleiding h10](../user_manual/10-end-of-day.md). De stap-voor-stap vanuit het manager-perspectief.
- **Rapporten die afgesloten-dag-data lezen** — [Hoofdstuk 10 — Rapporten](10-reports.md). De analytische kant; dit hoofdstuk is de operationele kant.
- **Auditlogboek-entries voor sluitingen + verzendingen** — [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) *(binnenkort beschikbaar)*.
- **Kassabeheer — fysiek kassabeheer + Geschiedenis + heropen-workflow** — [Hoofdstuk 19 — Kassabeheer](19-registers.md). Kassier-flow staat in [POS-gebruikershandleiding h3](../user_manual/03-register.md).
- **Rollen & rechten** — [Hoofdstuk 1 — Rollen & Rechten](01-roles-and-permissions.md).
- **Eerlijke status van elke fallback-laag** — [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). Houd dit open tijdens demo's.
- **Datamodel ontwikkelaarzijde** — [`docs/06-register-and-z-report.md`](../docs/06-register-and-z-report.md) (gepland), [`docs/07-sync-and-offline.md`](../docs/07-sync-and-offline.md) (gepland).

---

→ Volgende: [Hoofdstuk 12 — API-integraties & webhooks](12-api-integrations-and-webhooks.md) *(binnenkort beschikbaar)*
