# Hoofdstuk 9 — Klanten

**Voor wie:** vestigingsmanager (zoekt vaste klanten op, herstelt typefouten in details, beoordeelt topbesteders) en organisatiebeheerder (CSV-importeert een bestaande klantenbase bij migratie van een andere POS, draait cross-vestiging rapporten op loyale klanten).
**Wanneer u het gebruikt:** wanneer een klant zijn bon ge-e-maild wil, wanneer een oud telefoonnummer moet worden bijgewerkt, wanneer een nieuwe winkel opent met een handgetypte Excel-lijst van bestaande regulars om in één keer te laden.
**Wat het voorkomt:** gemiste herbestellingen van vergeten loyale klanten, WBP-S compliance-bevindingen tegen persoonlijk identificeerbare data die in platte tekst staat, het back-office dat per ongeluk een CSV van telefoonnummers van klanten exporteert naar de e-mail van een leverancier.

Het Klanten-scherm is waar u klanten leest, bewerkt en importeert. Kassiers maken nieuwe klanten direct aan vanuit de POS-app — ze hebben het dashboard daar niet voor nodig. Het dashboard is voor de back-office-views: zoeken, bewerken, bulkimport, topbesteder-rapporten.

![09 klantenlijst](screenshots/09-customers-list.png)
---

## 9.1 Het model — waarom klantgegevens speciaal zijn

In Josbin POS bevat een klantrecord **persoonlijk identificeerbare informatie (PII)** die rechtstreeks onder **WBP-S** (*Wet Bescherming Persoonsgegevens Suriname*, de Surinaamse persoonsgegevensbeschermingswet) valt. Dat heeft directe gevolgen voor hoe de data wordt opgeslagen en wat u ermee kunt doen.

```
ORGANISATIE
   │
   └── customers
         │
         ├── id              (uuid, plat)
         ├── name            ←─── AES-256 versleuteld in rust + HMAC name_hash voor exact-match zoeken
         ├── phone           ←─── AES-256 versleuteld + HMAC phone_hash voor exact-match zoeken
         ├── email           ←─── AES-256 versleuteld (geen zoekhash)
         ├── id_number       ←─── AES-256 versleuteld, WBP-S "bijzondere persoonsgegevens" (overheids-ID)
         ├── total_spend_srd (DECIMAL 12,2, plat — bijgewerkt door elke verkoop)
         ├── visit_count     (integer, plat — bijgewerkt door elke verkoop)
         └── created_at      (timestamptz AST)
```

Twee versleutelingsmechanismen zijn aan het werk, en beide doen ertoe voor hoe het scherm zich gedraagt:

| Mechanisme | Wat het doet | Waarom |
|---|---|---|
| **`Crypt::encryptString()`** op de vier PII-velden | Slaat AES-256 ciphertext op in Postgres. Ontsleutelt alleen binnen de Laravel-app, via de per-app encryptiesleutel. | WBP-S compliance: als iemand een ruwe DB-dump krijgt, ziet die ondoorzichtige ciphertext, geen telefoonnummers. |
| **`hash_hmac('sha256', value, app.key)`** op naam + telefoon | Slaat een vaste-lengte HMAC ernaast op, zodat we een exact-match-query (`WHERE phone_hash = ?`) kunnen draaien zonder elke rij te ontsleutelen. | Maakt zoeken mogelijk zonder versleuteling te breken. Trade-off: geen partial / starts-with / fuzzy zoeken. |

> **Waarom `id_number` geen HMAC-hash krijgt:** overheids-ID-nummers zijn *bijzondere persoonsgegevens* onder WBP-S en mogen alleen worden opgeslagen voor smalle juridische doeleinden (bv. een bon uitgeven aan een overheidsinstelling voor een fiscaal aftrekbare aankoop). Ze zijn bewust *niet* zoekbaar om te ontmoedigen dat ze worden gebruikt als opzoeksleutel.

### Praktische gevolgen van de versleuteling

| Gedrag | Waarom |
|---|---|
| U kunt **alleen zoeken op een exacte volledige naam of exact telefoonnummer** — `"Sandra"` zal `"Sandra Codrington"` niet vinden. | Zoeken gebruikt de HMAC-hash van de *exacte kleine-letter* zoekterm — partiële matches zouden vereisen elke klantrij te ontsleutelen, wat een WBP-S overtreding is. |
| De lijst **pagineert altijd op recentheid** (`created_at DESC`) in plaats van op naam. | Alfabetisch sorteren zou vereisen elke rij in de org te ontsleutelen voor paginering. Recentheid is gratis. |
| **E-mailzoeken wordt niet ondersteund.** | Geen HMAC-hash voor e-mail — zou elke rij moeten ontsleutelen. |
| **Ruwe DB-exports zijn nutteloos** voor een dief zonder de app-sleutel. | Dat is het hele punt. |
| Twee records met dezelfde *exacte* naam zullen dezelfde `name_hash` delen. | Verwacht — HMAC is deterministisch met dezelfde sleutel. |

---

## 9.2 Waar klanten vandaan komen

Drie aanmaak-paden voeden dezelfde `customers`-tabel:

| Bron | Getriggerd door | Gebruikt wanneer |
|---|---|---|
| **POS-kassier — snel toevoegen** | Kassier tikt "+ Nieuwe klant" midden in de verkoop op de POS-app | Het meest voorkomende pad. Klant wil bon ge-e-maild, of het is een regular die hun bezoekcount wil zien doortikken. Naam + telefoon is het minimum. |
| **Dashboard — Bewerken** | OA of manager bewerkt een bestaand record | Typefouten herstellen, nummers bijwerken, een e-mail toevoegen achteraf. Er is geen Aanmaak-knop in het dashboard — snel toevoegen leeft aan de kassa. |
| **Dashboard — Bulk-CSV-import** | OA uploadt een CSV via het API-endpoint | Eenmalig wanneer een nieuwe klant migreert van een andere POS (of een eenmanszaak-eigenaar zijn eerste Josbin POS-terminal opent en zijn bestaande regulars wil laten laden). |

> **Waarom geen "Klant toevoegen"-knop in het dashboard?** Eenmanszaak- en kleine-keten-werkstromen maken bijna altijd klanten aan bij het contactpunt — de kassier die vraagt "wilt u een bon ge-e-maild?". De rol van het dashboard is beoordelen, repareren en bulkladen — geen data-invoer. Heeft u een use-case voor één-voor-één toevoegen vanuit het back-office, dan ondersteunt het API-endpoint (`POST /api/customers`) dat; de UI toont alleen geen knop.

---

## 9.3 Het Klanten-scherm — wat erop staat

**Pad:** Dashboard zijbalk → **Klanten**.

![09 klantenscherm](screenshots/09-customers-screen.png)
De pagina toont één doorzoekbare, gepagineerde tabel. De header-teller (`123 klanten gevonden`) weerspiegelt het **totaal in uw organisatie**, niet alleen de huidige pagina.

### De kolommen

| Kolom | Wat het toont | Opmerkingen |
|---|---|---|
| **Naam** | Volledige naam van de klant, met een automatisch gegenereerde 2-letter avatar (eerste letter van voor- + achternaam-woord). | Ontsleuteld bij lezen door de Laravel-controller. Verschijnt nooit in de ruwe DB. |
| **Telefoon** | Vrije-tekst telefoon — meestal met Suriname-landcode (`+597 …`). | `—` als ontbrekend. Ontsleuteld bij lezen. |
| **E-mail** | Kleine-letter e-mail. | `—` als ontbrekend. Ontsleuteld bij lezen. |
| **Totaal besteed** | Levenslange SRD-besteding over de organisatie, opgehoogd bij elke voltooide verkoop. | Plat `DECIMAL(12,2)`. Over alle vestigingen binnen de org. |
| **Bezoeken** | Levenslange bezoekcount over de organisatie. | Plat integer. Eén unieke verkoop = één bezoek. |
| **Klant sinds** | Eerste keer dat de klant is aangemaakt (d.w.z. hun eerste POS-ontmoeting). | Gelocaliseerd: `26 mei 2026` (NL) / `May 26, 2026` (EN). |
| **(actie)** | Knop **Bewerken**. | Opent het bewerk-modal — §9.5. |

### De zoekbalk

Typ een zoekterm en druk op Enter / wacht — de tabel filtert terwijl u typt, pagina herstelt naar 1.

| Wat u typt | Wat het matcht |
|---|---|
| **Volledige naam** (elk hoofdletter-gebruik) — `Sandra Codrington` | Exact match tegen `name_hash` (kleine letters). `sandra codrington` werkt ook. |
| **Telefoonnummer** — `+5978554120` of `8554120` | Exact match tegen `phone_hash`. Het formaat moet **byte-voor-byte identiek** zijn aan hoe het is opgeslagen. |
| Gedeeltelijk — `Sandra` | Retourneert **niets**. Partiële matches zijn technisch niet mogelijk (zie §9.1). |
| E-mail — `sandra@…` | Retourneert **niets**. E-mail is versleuteld zonder hash — zie §9.1. |

> **Best-practice tip voor kassiers.** Bij het snel toevoegen van een klant aan de POS, *standaardiseer het telefoonformaat* — bv. altijd `+597XXXXXXX`, nooit een mix van `+597`, `0` en spaties. Slaan twee kassiers dezelfde persoon op met verschillende formaten, dan tonen ze als twee klanten en zijn nooit vindbaar via zoeken.

---

## 9.4 Een rij lezen — wat de besteding- / bezoekgetallen betekenen

`total_spend_srd` en `visit_count` worden bijgewerkt bij **elke voltooide verkoop** die deze klant noemt. Ze tellen het bruto verkooptotaal (vóór individuele regelkortingen maar na een verkoop-niveau korting — d.w.z. wat de klant daadwerkelijk betaalde), in SRD, tegen de vergrendelde dagkoers.

| Event | Effect op `total_spend_srd` | Effect op `visit_count` |
|---|---|---|
| Verkoop voltooid en de klant werd aan de kassa gekozen | `+ total_srd` | `+ 1` |
| Verkoop **geannuleerd** vóór printen | geen effect (de verkoop is nooit "voltooid" geweest) | geen effect |
| Verkoop **terugbetaald** | momenteel *niet* verlaagd (bezoekcount en levenslange besteding weerspiegelen engagement, geen netto-omzet) | geen effect |
| Verkoop geregistreerd tegen de standaard **loopklant** | geen effect (loopklant is een systeemklant, niet in deze lijst) | geen effect |

> **Waarom terugbetalingen levenslange besteding niet verminderen.** Het getal is een **loyaliteit / engagement metric**, geen boekhoudkundige figuur. Heeft een klant SRD 500 in levenslange bezoeken besteed en één item terugbetaald, dan *bestedeed* hij nog steeds SRD 500. Netto-van-terugbetaling omzet is waar de Verkoopsrapporten (Hoofdstuk 10) voor zijn.

---

## 9.5 Een klant bewerken

**Pad:** Klanten-scherm → vind de rij → tik op **Bewerken**.

![09 bewerk-modal](screenshots/09-edit-modal.png)
Het modal toont drie velden:

| Veld | Verplicht | Opmerkingen |
|---|:-:|---|
| **Naam** | ✅ | Vervangen van de waarde berekent ook de `name_hash` automatisch opnieuw — toekomstige zoekopdrachten gebruiken de nieuwe waarde. |
| **Telefoon** | optioneel | Hetzelfde: bewerken berekent `phone_hash` opnieuw. Leeg laten om te wissen. |
| **E-mail** | optioneel | Kleine letters + 254-tekens standaard e-mailvalidatie. Leeg laten om te wissen. |

Tik op **Opslaan**. De rij wordt direct bijgewerkt en de wijziging wordt geregistreerd in het **auditlogboek** (Hoofdstuk 13) met de oude en nieuwe waarden getoond als onderdeel van de standaard diff — maar met de waarden geredigeerd als versleutelde strings, zodat de auditor ziet *dat* er iets veranderde aan een klant zonder te zien wat.

> **Wat u niet vanuit dit scherm kunt bewerken.** `id_number` (overheids-ID) is bewerkbaar via de API maar bewust niet zichtbaar in het dashboard-bewerk-modal — het is een *bijzonder persoonsgegeven* en mag niet casual worden gecorrigeerd door back-officestaff. Moet een overheids-ID worden bijgewerkt, dan is dat een leverancier-supportverzoek met een schriftelijke reden.

> **Wat u helemaal niet kunt doen.** Er is geen Verwijderen-knop. Hard-verwijderen van een klant zou elke historische verkoop verwezen die ze ooit noemde en het auditspoor breken. De `customers`-tabel gebruikt `SoftDeletes`, dus een soft-delete is technisch mogelijk via API maar **niet zichtbaar in de UI**. Het juiste patroon, als een klant verzoekt om verwijdering van zijn data onder WBP-S "recht op wissing", is een leverancier-supportverzoek — we soft-deleten de rij, blanco de PII en houden de verkoopgeschiedenis wijzend naar een grafsteen-record.

---

## 9.6 Bulk-CSV-import

Wanneer een klant migreert van een andere POS — of een eenmanszaak-eigenaar zijn eerste Josbin POS-installatie opent met een lange klantenlijst in Excel — kunt u de hele lading bulk-importeren.

> **Waar de UI is.** Vanaf deze release is de CSV-import-knop **niet zichtbaar op het Klanten-scherm**. Het endpoint (`POST /api/customers/import`) bestaat en is bedraad; de UI-affordance staat op dezelfde fase 2-backlog als de vestiging-specifieke voorraaddrempel-editor. Tot dan wordt de import direct vanuit de API gedraaid (leverancier-supporttaak) of vanuit het scherm **Catalogus → Import / Export** als die operator-rol het toont.

Het CSV-formaat is klein en strikt:

### CSV-formaat

Eén header-rij, dan één datarij per klant.

| Kolom | Verplicht | Opmerkingen |
|---|:-:|---|
| `name` | ✅ | Volledige naam. Rijen met lege `name` worden overgeslagen. |
| `phone` | optioneel | Gebruikt als **match-sleutel** voor upserts — zie hieronder. |
| `email` | optioneel | Kleine letters aanbevolen. |
| `id_number` | optioneel | Overheids-ID. Alleen geladen indien aanwezig — versleuteld bij schrijven. |

Voorbeeld:

```csv
name,phone,email,id_number
Sandra Codrington,+5978554120,sandra@dehoop.sr,
Rashied Alibaks,+5978900123,,
Maria van der Berg,+5978112233,maria@example.sr,N12345678
```

### Wat de import doet, rij voor rij

Voor elke datarij:

1. Indien `name` leeg → **overgeslagen** (geteld in `skipped`).
2. Indien `phone` aanwezig → zoek een bestaande klant in deze organisatie met dezelfde telefoon (HMAC-match). Indien gevonden → **update** de velden van die klant. Zo niet → **maak een nieuwe klant aan**.
3. Indien `phone` leeg → **maak altijd een nieuwe klant aan**. (Geen de-duplicatie mogelijk — het systeem heeft niets om op te matchen.)
4. De hele import draait in één DB-transactie. Elke geworpen fout rolt de hele batch terug — partiële imports landen nooit.

Respons:

```json
{ "created": 42, "updated": 7, "skipped": 1, "errors": ["Row 13: column count mismatch"] }
```

> **Telefoon is de de-duplicatie-sleutel.** Importeert u dezelfde CSV twee keer, dan rapporteert de tweede run `updated: 49, created: 0` — elk record matcht de telefoonhash van de eerste run en krijgt zijn velden opnieuw geschreven. Dit is opzettelijk en veilig; wees gewoon bewust dat het opnieuw uitvoeren van een verouderde CSV handmatige bewerkingen in het dashboard sinds dan zal *overschrijven*.

> **5 MB cap.** Het endpoint capt de upload op 5 MB. Voor een typische CSV (~150 bytes per rij) is dat ongeveer 33.000 klanten in één keer. Grotere lijsten moeten worden gesplitst.

---

## 9.7 De standaard loopklant

Elke verkoop die **geen** specifieke klant noemt, wordt geregistreerd tegen de "loopklant" van de organisatie. De loopklant:

- Is een enkel, systeembeheerd record per organisatie.
- Verschijnt **niet** in de Klanten-scherm-lijst.
- Cumuleert geen `total_spend_srd` of `visit_count` (dat zou de topbesteder-lijsten verstoren).
- Kan niet worden bewerkt of verwijderd.

Dit is grotendeels onzichtbaar voor back-office-gebruikers — de enige reden om het te weten is bij het beoordelen van het Top Klanten-rapport (Hoofdstuk 10): loopklant is uitgesloten van de top-N lijst, daarom matchen de totalen op dat rapport niet met totale dagelijkse omzet.

---

## 9.8 Veelvoorkomende fouten / valkuilen

**"Ik zocht naar Sandra en kreeg niets."** Zoeken heeft de **exacte volledige naam** nodig (hoofdletterongevoelig). "Sandra" alleen matcht "Sandra Codrington" niet. Dit is een bewuste WBP-S ontwerpkeuze — partieel zoeken zou vereisen elke rij te ontsleutelen.

**"Waarom staat deze persoon drie keer in de lijst?"** Bijna altijd omdat drie verschillende kassiers de telefoon in drie formaten hebben opgeslagen: `+5978554120`, `0085554120` en `08554120`. De HMAC ziet drie verschillende strings → drie verschillende hashes → drie verschillende klanten. Repareer: spreek bij training één telefoonformaat af en houd u eraan. Om duplicaten te samenvoegen, is het veiligste pad alle drie rijen bewerken om naar één canoniek telefoonnummer te wijzen (elke bewerking berekent de hash opnieuw; oude rijen worden niet vindbaar via telefoon maar bestaan nog steeds).

**"Ik wil een CSV van klanten exporteren voor onze nieuwsbrief."** Dit is **niet voorzien als één-klik export** per ontwerp — bulk-klantextractie is een WBP-S risico. Als het gestelde verwerkingsdoel van de klant (de *verwerkingsdoel* aangegeven in de Verwerkersovereenkomst) marketing omvat, kan de leverancier de export op schriftelijk verzoek produceren. Probeer het niet zelf via de API te scrapen op eigen initiatief — dat wordt gelogd.

**"Ik heb een klant verwijderd maar ze zijn er nog steeds."** Er is geen verwijderknop in het dashboard. Heeft u de API direct gebruikt en een soft-delete getriggerd, dan is de `deleted_at` van de rij gezet maar de rij blijft voor verkoopgeschiedenis-integriteit. Om echt te zuiveren, zie leverancier-support — de operatie is een bewuste, geaudite, handmatige stap.

**"Bewerk-modal toont het e-mailveld maar ik kan er niet in typen voor een bestaande klant."** U kunt dat wel. Zorg dat het veld niet wordt gerenderd achter een ander element (zeldzame browser-glitch — volledige paginaherlading repareert het). Is het veld letterlijk alleen-lezen en weigert het toetsaanslagen, dan is dit een bug — meld aan leverancier-support.

**"Totaal besteed ging omhoog maar bezoekcount niet."** Mag niet gebeuren. Als het wel gebeurt, is dit een bug — elke voltooide verkoop zou beide moeten ophogen. Open het auditlogboek (Hoofdstuk 13) en vind de verkoop, controleer dan of er één halverwege werd teruggedraaid. Open vervolgens een leverancier-ticket.

**"Een CSV importeren maakte duplicaten."** De CSV bevatte geen telefoonnummers (geen match-sleutel — maakt altijd aan), of het telefoonformaat in de CSV matchte niet met het formaat al in de database. Standaardiseer beide, importeer opnieuw, accepteer de tweede-ronde duplicaten als opruimen (samenvoegen zoals hierboven beschreven).

---

## 9.9 Wat in het auditlogboek wordt vastgelegd

Elke actie op een klant maakt een entry in het auditlogboek (Hoofdstuk 13):

| Actie | Audit `event` | `old_values` | `new_values` |
|---|---|---|---|
| Aangemaakt via POS snel toevoegen of import | `created` | `null` | De nieuwe veldwaarden — **maar** de PII-velden worden opgeslagen als hun *versleutelde* ciphertext in de audit. De auditor ziet dat een klant is aangemaakt, niet wie. |
| Bewerkt via dashboard | `updated` | De vorige versleutelde ciphertext van elk gewijzigd veld | De nieuwe versleutelde ciphertext. De diff-viewer toont twee ondoorzichtige strings — per ontwerp. |
| Soft-gedeleted via API (leverancier-support) | `updated` | (oude `deleted_at: null`) | (nieuwe `deleted_at: <timestamp>`) |

Dit betekent dat de view van de auditor op de klantentabel is "**wanneer** een record veranderde, **wie** het veranderde, en **of** PII werd aangeraakt" — niet de PII zelf. Dat is WBP-S-correct: het auditlogboek zelf is geen achterdeur om versleutelde data te lezen.

De `audit_logs`-rij is hash-geketend en alleen-toevoegen (zie Hoofdstuk 13) zodat zelfs een Super Admin niet kan knoeien met het record achteraf.

> **Voor het eigen data-toegangsverzoek van de klant:** onder WBP-S kan een klant vragen om "alles wat u over mij heeft" te zien. De tooling van de leverancier (apart `php artisan customer:export` commando) ontsleutelt en dumpt de hele lading naar een ondertekend JSON-bestand. Probeer dit niet met de hand samen te stellen vanuit het dashboard — u mist de versleutelde velden en het auditspoor.

---

## 9.10 Snelreferentie

```
KLANTEN OPENEN         Dashboard → zijbalk → Klanten
ZOEKEN                 Typ exacte volledige naam OF exacte telefoon → Enter
                       (partieel / e-mail zoeken niet ondersteund per ontwerp)

EEN KLANT BEWERKEN     Rij → Bewerken → wijzig naam / telefoon / e-mail → Opslaan

EEN KLANT AANMAKEN     Gedaan aan de POS door de kassier — geen UI in het dashboard.
                       (API bestaat: POST /api/customers)

BULKIMPORT             Nog niet in de dashboard-UI. Gebruik de API:
                       POST /api/customers/import
                       CSV-kolommen: name (verpl.), phone, email, id_number
                       Match-sleutel voor upsert: phone (HMAC)

VERWIJDEREN            Niet zichtbaar. WBP-S "recht op wissing" → leverancier-support.

TOPBESTEDERS / BEZOEKEN  Rapporten → Top Klanten (Hoofdstuk 10)

EXPORT VOOR MARKETING  Leverancier-supportverzoek — geen self-service-actie.
```

Kruisverwijzingen: [Hoofdstuk 1](01-roles-and-permissions.md) voor wie kan bekijken vs bewerken, de POS-handleiding voor kassiers-zijde snel toevoegen, [Hoofdstuk 10](10-reports.md) voor het Top Klanten-rapport, [Hoofdstuk 13](13-audit-log.md) voor wat de auditor ziet wanneer u een klantrecord aanraakt.

---

→ Volgende: [Hoofdstuk 10 — Rapporten](10-reports.md) *(binnenkort beschikbaar)*
