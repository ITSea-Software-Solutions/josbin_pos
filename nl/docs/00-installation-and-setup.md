# 0 — Installatie- & Setup-gids

End-to-end, op volgorde. Van lege server naar eerste live verkoop.

**Doelgroep:** delivery-team dat Josbin POS installeert voor een nieuwe klant.
**Bijbehorende docs:** [01-architecture.md](01-architecture.md) legt het *waarom* uit; deze doc is het *hoe*.
**Geschatte tijd:** een halve dag voor een single-store-installatie, plus client-side data-invoer (afhankelijk van catalogusgrootte).

---

## Vereisten

### Hardware

| Rol | Aanbevolen | Minimum |
|---|---|---|
| Back-office server-PC (1 per vestiging) | i5 / 16 GB / 256 GB SSD | i3 / 8 GB / 128 GB SSD |
| POS-terminal (1+ per vestiging) | Windows 10/11, 8 GB RAM, touchscreen | Windows 10, 4 GB |
| Thermische printer | EPSON TM-T20 (Ethernet) | Elke ESC/POS via TCP:9100 |
| Kassalade | RJ11 naar printer (pin 2) | RJ11 naar printer (pin 2 of 5) |
| Barcodescanner | USB HID keyboard wedge | USB HID keyboard wedge |
| Android-tablet (optioneel) | 10" tablet met USB-OTG voor printer | n.v.t. |

### Netwerk

- Server-PC en alle POS-terminals op hetzelfde **LAN**.
- Server bereikbaar vanaf terminals op poort **8080** (HTTP) of **443** (HTTPS in productie).
- Uitgaand internet voor: cloud sync, exchange-rate-fetch, licentievalidatie. **Niet vereist** voor verkopen.
- Mobiele data-fallback aanbevolen voor binnenland-vestigingen (Digicel/Telesur 4G USB-dongle op de server).

### Software (server-PC)

- Docker Desktop of Docker Engine + Compose v2
- Git (om updates te pullen)
- Een moderne browser (Chrome/Firefox) voor het dashboard

### Software (POS-terminal)

- Windows 10 of 11 (voor `.exe`-installer), **of** Android 10+ (voor `.apk`)
- Verder niets. De installer bundelt alles.

### Accounts & sleutels die je nodig hebt

| Sleutel | Waar te krijgen | Vereist wanneer |
|---|---|---|
| ExchangeRate-API key | https://www.exchangerate-api.com (gratis tier ondersteunt SRD) | Server-installatie |
| OpenAI API key | https://platform.openai.com (alleen voor AI-features) | Optioneel |
| Anthropic API key | https://console.anthropic.com (AI-fallback) | Optioneel |
| Josbin POS-licentiesleutel | Uitgegeven door je team vanuit de license server | Eerste boot |
| BTW-nummer | De klant levert dat aan | Per organisatie |

---

## Deel A — Backend server-installatie

Voer dit uit op de back-office server-PC. **Totale tijd: ~10 minuten**, langer de eerste keer als Docker images moet pullen.

### A1. Haal de code op

```bash
git clone <your-josbin-pos-repo-url> /opt/josbin-pos
cd /opt/josbin-pos
```

Voor delivery aan klanten: lever in plaats daarvan de IonCube-encoded build — zie [scripts/README.md](../scripts/README.md). Encoded code draait identiek.

### A2. Configureer `.env`

```bash
cp backend/.env.example backend/.env
```

Bewerk `backend/.env` en stel in:

| Sleutel | Waarde |
|---|---|
| `APP_URL` | `http://&lt;server-LAN-IP&gt;:8080` (bv. `http://192.168.1.10:8080`) |
| `EXCHANGERATE_API_KEY` | Je ExchangeRate-API key |
| `JOSBIN_POS_LICENSE_SERVER_URL` | Je license server URL |
| `JOSBIN_POS_INSTALLATION_KEY` | Laat leeg — instellen na activatie in A6 |
| `OPENAI_API_KEY` | Optioneel. Laat de placeholder staan om AI uit te schakelen |

Laat Postgres + Redis credentials op de defaults staan — die zijn container-intern.

### A3. Zet de stack omhoog

```bash
docker compose up -d
```

Wacht tot alle 8 containers `healthy` rapporteren:

```bash
docker compose ps
```

Je zou `josbin_pos_nginx`, `josbin_pos_app`, `josbin_pos_postgres`, `josbin_pos_pgbouncer`, `josbin_pos_redis`, `josbin_pos_reverb`, `josbin_pos_horizon`, `josbin_pos_scheduler` moeten zien — allemaal `healthy` (de scheduler toont geen health-kolom).

### A4. Genereer de encryption keys

```bash
docker compose exec app php artisan key:generate --force
```

Genereer dan de field-level encryption key voor customer PII (WBP-S-compliance):

```bash
echo "ENCRYPTION_FIELD_KEY=base64:$(openssl rand -base64 32)" >> backend/.env
```

Herstart zodat PHP-FPM de nieuwe env oppikt:

```bash
docker compose restart app
```

### A5. Run database migrations

```bash
docker compose exec app php artisan migrate --force
```

Voor een gloednieuwe installatie kun je ook sample data seeden (aanbevolen voor de smoke-test van het delivery-team — verwijderen voor go-live):

```bash
docker compose exec app php artisan db:seed --force
```

### A5a. Koppel de publieke opslag (vereist voor afbeeldingen)

```bash
docker compose exec app php artisan storage:link
```

Zonder deze symlink geeft elke geüploade afbeelding — bonlogo's, productfoto's
en de wallet-QR-codes — een 404. Het is een eenmalige stap per installatie,
makkelijk te vergeten en later lastig te herleiden, dus doe hem direct na de
migraties.

### A6. Activeer de licentie

De eerste keer dat de backend boot, roept hij je license server aan met een hardware fingerprint (MAC + CPU + UUID) en vraagt om activatie. Om een licentie vooraf uit te geven:

```bash
# On the license server
curl -X POST https://<license-server>/api/admin/licenses \
  -H "X-Admin-Key: <admin-key>" \
  -d '{
    "organisation": "Supermarkt De Hoop",
    "tier": "professional",
    "terminal_count": 3,
    "expires_at": "2027-05-23"
  }'
```

Dat retourneert een `installation_key`. Zet die in `backend/.env`:

```
JOSBIN_POS_INSTALLATION_KEY=ik_xxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Herstart en forceer een licentiecheck:

```bash
docker compose restart app
docker compose exec app php artisan license:check --force
```

### A7. Verifieer

```bash
curl -s http://localhost:8080/api/health
# → 200 OK
```

Backend is nu live. Bezoek `http://localhost:8080/api/v1/docs` in een browser om de Open Integration API spec te zien — nuttige bevestiging dat PHP-FPM + nginx + de routing-laag allemaal correct bedraad zijn:

![Swagger UI op /api/v1/docs](screenshots/00-swagger-ui.png)

---

## Deel B — Organisatie-onboarding (Super Admin)

Het dashboard zit op **http://&lt;server-LAN-IP&gt;:5174** in dev, of je productie-HTTPS-URL. Log in als het Super Admin-account dat je team gebruikt.

### B1. Maak de organisatie aan

Dashboard → **Organisaties** → **Aanmaken**

| Veld | Waarde |
|---|---|
| Naam | De juridische naam van de klant (bv. *Supermarkt De Hoop NV*) |
| Type | `retail` / `govt` / `wholesale` |
| BTW-nummer | Het registratienummer van de Belastingdienst van de klant |
| Default BTW-tarief | `10.00` (huidige Suriname VAT) |
| Currency | `SRD` (locked) |
| Locale | `nl` (Dutch primary) |
| Subscription tier | matcht het licentieniveau |

Als de klant een **overheidsdepartement** is, triggert de organisation-flag `is_government=true`:
- Verplichte 2FA voor alle gebruikers
- Dual approval voor terugbetalingen boven drempel *(schema + permission staan; SRD-threshold-afdwinging is nog in ontwikkeling)*
- Geïsoleerde database (gescheiden van commerciële klanten)
- Geo-alert bij logins van buiten Suriname

### B2. Maak vestigingen aan

Hetzelfde scherm → vouw de organisatie uit → **+ Vestiging toevoegen**.

| Veld | Waarde |
|---|---|
| Naam | bv. *De Hoop — Paramaribo Centrum* |
| Adres, stad | Fysieke locatie |
| Default BTW-tarief | erft de org-default; override voor vestigingsspecifieke regels |
| POS-type | `native` (Electron POS) of `external` (alleen Layer 3 API) |
| Bonkop | Vrije tekst — meestal winkelnaam + adres |
| Bonvoet | Vrije tekst — meestal "bedankt" + retourbeleid |
| Bonlogo | Upload PNG/JPG, getoond op PDF- + e-mailbonnen |
| BTW-nummer op bon | Per vestiging overschrijven als anders |

### B2a. Betaalinstellingen per vestiging (2 minuten)

Twee optionele-maar-aanbevolen stappen terwijl u toch in de
vestigingsinstellingen bent:

1. **Wallet-QR's** — upload de Mopé- / Uni5Pay+-merchant-QR van de winkel
   (Vestigingen → Instellingen → *QR-wallets*). De kassa toont hem daarna
   full-screen bij QR-betalingen, zodat klanten direct van het scherm scannen.
2. **Pinterminal-modus** — op elke kassaterminal: Instellingen →
   *Pinterminal*. Laat op *Losse bankterminal* staan voor echte winkels;
   alleen voor training/demo op *Gesimuleerde terminal*. Niet-technische
   uitleg: [/card-payments.html](/card-payments.html).

### B3. Maak kassa's aan onder elke vestiging

Dashboard → **Kassa's** → tabblad **Beheren** → **+ Kassa toevoegen**.

Eén kassa per fysieke kassalade. Naamconventie: `Kassa 1`, `Kassa 2`, etc.

---

## Deel C — Productcatalogus

### C1. CSV / Excel import (aanbevolen voor >20 producten)

Dashboard → **Catalogus** → **Importeren / Exporteren**. Accepteert **.csv, .xlsx, en .xls**-bestanden.

Verplichte kolommen:
```csv
name_nl,name_en,barcode,price,btw_rate,btw_exempt,category_name_nl,stock_qty
Brood wit,White bread,8710398501234,3.50,10.00,1,Bakkerij,40
Cola 1.5L,Coca-Cola 1.5L,5449000000996,15.00,10.00,0,Dranken,120
```

`btw_exempt` is `1` (vrijgesteld) of `0`. Categorieën worden opgezocht op `category_name_nl` en aangemaakt indien afwezig. Bestaande producten worden gematcht op `barcode` en bijgewerkt; rijen met een nieuwe barcode (of geen barcode) worden ingevoegd. Download een starter-template vanaf hetzelfde scherm: **CSV-template downloaden** of **Excel-template downloaden**.

BTW-vrije items (basislevensmiddelen, medicijnen) krijgen `btw_exempt=true` — die slaan BTW volledig over op de bon.

### C2. Handmatige invoer

Catalogus → **+ Product toevoegen** voor uitzonderingen. Gebruik de camera-barcode-scannerknop om de EAN direct van de verpakking te halen.

### C3. AI-categorisatie

Voor producten zonder ingestelde categorie stelt de AI Auto-Categoriseer-knop er één voor op basis van productnaam + barcode-lookup. De manager beoordeelt en accepteert.

### C4. Vestigingsspecifieke prijzen

Dashboard → **Prijsoverrides** → kies vestiging → stel per-product override SRD-prijs in.

Use case: vestiging Nickerie verkoopt hetzelfde item 5% hoger door transportkosten.

---

## Deel D — Gebruikersaccounts

Maak aan in deze volgorde, top-down.

### D1. Organisatiebeheerder

Dashboard → **Gebruikers** → **+ Gebruiker toevoegen**.

| Veld | Waarde |
|---|---|
| Rol | `organisation_admin` |
| Organisatie | degene die je net hebt aangemaakt |
| E-mail | HQ-admin-e-mail van de klant |
| Locale | `nl` |
| 2FA vereist | Ja (aanbevolen) |

Het systeem stuurt een welkomstlink. De OA stelt het wachtwoord in + enrolt in 2FA bij eerste login.

### D2. Vestigingsmanager (één per vestiging)

| Veld | Waarde |
|---|---|
| Rol | `store_manager` |
| Vestiging(en) | één of meer — managers kunnen multi-vestiging draaien |
| 2FA vereist | Ja voor govt-orgs, optioneel voor retail |

### D3. Kassier (één per persoon, niet per dienst)

| Veld | Waarde |
|---|---|
| Rol | `cashier` |
| Vestiging | één |
| 2FA vereist | Meestal nee — login-snelheid telt aan de kassa |

### D4. Auditor (optioneel, voor govt-orgs)

Read-only-rol voor medewerkers van Belastingdienst / Rekenkamer die compliance-reviews doen.

### D5. API Integration (alleen als Layer 3 in gebruik is)

Dashboard → **API Keys** → **+ Nieuwe key**.

Dit is een *machine*-account, geen persoon. Gebruikt door POS-systemen van derden om verkopen te pushen via `/api/v1/sales`. Bind aan één vestiging; rate limit geldt.

---

## Deel E — POS-terminal-installatie (per terminal)

### E1. Haal de installer op

**Evaluatie-/demoversie — nu downloaden:**

> 💾 **[Download Josbin POS voor Windows (demo)](http://142.93.88.143:8095/downloads/josbin-pos-demo-Setup-1.0.0.exe)** — 108 MB, Windows 10/11 (64-bit).

Deze versie is gekoppeld aan de **demoserver** (`142.93.88.143:8080`) en werkt
direct na installatie — log in met de demokassier (`kassa@dehoop.sr` /
`Cashier@2026`) en verkoop tegen live demodata. Twee dingen om te verwachten
bij een demoversie:

- **Windows SmartScreen** toont een "onbekende uitgever"-waarschuwing (de demo
  is niet code-signed). Klik op **Meer info → Toch uitvoeren**. Een
  productieversie voor een betalende klant is wél gesigneerd en toont geen
  waarschuwing.
- Hij wijst naar de demoserver, niet naar een winkelserver. Voor een echte
  winkel krijgt u een versie die aan die winkelserver is gekoppeld — of stel
  elke versie opnieuw in via **⚙ Server** op het inlogscherm (hieronder).

---

Per USB aangeleverd of download van je distributieserver. Bestand: `Josbin POS-1.0.0-Setup.exe` (Windows) of `josbin-pos.apk` (Android).

> **Verkeerd serveradres na installatie?** Geen nieuwe build nodig: tik op het inlogscherm op **⚙ Server**, voer het adres van de winkelserver in (bijv. `192.168.0.250:8080` — `http://` en `/api` worden automatisch toegevoegd), druk op **Testen** tot er *Verbonden* staat en dan **Opslaan & herstarten**. Managers vinden dezelfde optie onder Instellingen → Systeem.

### E2. Installeer op de terminal

Windows: dubbelklik op `.exe`. De wizard installeert naar `C:\Program Files\Josbin POS\`. Maakt een desktop-shortcut.

Android: zet "Installeren uit onbekende bronnen" eenmalig aan voor de bestandsbeheerder, tik dan op de `.apk`.

### E3. De kassa naar zijn server wijzen

**Eén installer werkt voor elke winkel.** Het adres dat in de build zit is
slechts een startpunt — elke kassa bewaart zijn eigen adres, dus een aparte
build per winkel is nooit nodig.

De app bepaalt de server in deze volgorde:

1. **Een op deze kassa opgeslagen adres** (⚙ Server) — wint altijd.
2. **Het adres in de installer** — per conventie krijgt elke winkelserver die
   wij installeren het vaste LAN-adres `192.168.0.250`, zodat een standaard
   installatie helemaal niets hoeft in te stellen.
3. `localhost` — alleen voor ontwikkeling.

**Past de conventie, doe dan niets.** Installeren, inloggen, verkopen.

**Past hij niet** (de router van de winkel gebruikt een ander bereik zoals
`192.168.1.x`, of de winkel werkt tegen een server op afstand):

1. Tik op het inlogscherm op **⚙ Server** (managers: Instellingen → Systeem →
   Serveradres).
2. Voer het adres in — `192.168.0.250:8080`, of een domein zoals
   `pos.klantnaam.sr`. `http://` en `/api` worden automatisch aangevuld.
3. Druk op **Testen** tot er *Verbonden* staat, dan **Opslaan & herstarten**.
4. Adres onbekend? Druk op **🔍 Zoek mijn server** — de kassa doorzoekt het
   eigen netwerk en vult het adres in. Worden er meerdere gevonden, dan kiest
   u uit een lijst.

**Standaard gebruiken** wist een opgeslagen adres en zet de kassa terug op het
ingebouwde adres.

> **⚠️ Alle kassa's van één vestiging moeten hetzelfde adres gebruiken.** Twee
> kassa's die naar verschillende servers wijzen, betekent twee gescheiden
> administraties voor dezelfde winkel. Controleer per kassa via Instellingen →
> Systeem: daar staat altijd het gebruikte adres, met de markering *aangepast*
> als het handmatig is ingesteld.

> **Lokale server of op afstand?** Voor de hardware maakt het niets uit — de
> printer, kassalade en scanner worden aangestuurd door de app op de kassa,
> nooit door de server. Het verschil zit in robuustheid: met de server **in de
> winkel** verandert een internetstoring niets; met een server **op afstand**
> kan de kassa niet verkopen zolang de verbinding weg is. Zie
> [Sync & offline](07-sync-and-offline.md).

> **Een draaiende winkel later naar een andere server verhuizen** is meer dan
> een adreswijziging — de verkoopgeschiedenis staat op de server, dus van
> cloud naar een lokale server (of andersom) is een geplande datamigratie, geen
> instelling.

### E3a. Waar de installer vandaan komt (per winkel)

Zodra een winkelserver draait, is de installer beschikbaar **vanuit het
dashboard van de winkel zelf** — geen internet, geen USB-stick nodig:

**Dashboard → POS-app → Windows-installer → ⬇ Installer downloaden**

Op datzelfde scherm staat het exacte serveradres dat u moet invoeren, met een
kopieerknop. Zichtbaar voor vestigingsmanagers en hoger; kassiers zien het
niet.

Staat er dat er nog geen installer is, dan is het bestand nog niet op die
server geplaatst — de leverancier zet het in de installermap van de server en
de downloadknop verschijnt (herstarten is niet nodig).

### E4. Hardware fingerprint neemt een licentie-slot

Bij de eerste succesvolle login stuurt de POS zijn hardware fingerprint (MAC + CPU ID + een gegenereerde UUID) naar de backend, die hem doorstuurt naar je license server. Deze terminal bezet nu één van de gelicentieerde slots.

Als je het gelicentieerde terminal-aantal raakt, toont de volgende installatie **"License limit reached — contact your provider."** Upgrade het licentieniveau vanuit de license server.

---

## Deel F — Hardware-setup (per terminal)

POS-app → **Instellingen** → **Printer & Kassalade**.

### F0. Welke hardware werkt — compatibiliteit in één oogopslag

| Apparaat | Werkt | Opmerkingen |
|---|---|---|
| **Thermische printers** | Elke **ESC/POS**-printer — EPSON TM-T20/T88-serie, Xprinter (XP-58/XP-80), 3nStar, Bixolon, Rongta, Citizen, Posiflex, generieke "POS-58"/"POS-80" | Bonnen printen met de juiste accenten (é ë ó ñ) via codepagina 858, die al deze printers ondersteunen. **Star Micronics**: zet de printer eerst in *ESC/POS-emulatiemodus* (Stars eigen modus is een andere taal). |
| **Papierbreedte** | **80 mm** (42 tekens) en **58 mm** (32 tekens) | Stel in via Instellingen → Printer → **Papierbreedte**, zodat regels op de rol passen. |
| **Barcodescanners** | Elke **USB- of Bluetooth-HID**-scanner ("toetsenbordmodus") — Honeywell, Zebra/Symbol, Datalogic, Netum, en generieke 1D/2D-scanners | Fabrieksinstellingen werken; scanners die een AIM-prefix meesturen worden automatisch afgehandeld. |
| **Barcodetypes** | EAN-13, EAN-8, UPC-A, UPC-E, ITF-14 (dozen), Code 128 en Code 39 (alfanumerieke leveranciers-SKU's), weegschaal-EAN-13 (gewogen artikelen) | 2D-scanners lezen ook de QR-codes op Josbin-etiketten. |
| **Kassalades** | Elke lade met een **RJ11**-kabel, aangestuurd door de printer | Pin 2 standaard, Pin 5 instelbaar. |
| **Prijsweegschalen** | Bizerba, CAS, Digi, Avery — elke weegschaal die prijs/gewicht-EAN-13 print | Indeling is configureerbaar; controleer vóór livegang tegen de echte weegschaal. |
| **Bank-pinterminals** | Alle (zelfstandig — geen kabel) | Zie F5. |
| **Niet op de thermische bon** | Winkellogo (afbeelding) | Het logo staat op PDF- en e-mailbonnen; thermische bonnen zijn tekst (snelst en werkt op elke printer). |

### F1. Thermische printer — Network TCP (aanbevolen)

1. Print een self-test op de printer (meestal Feed ingedrukt houden tijdens aanzetten) om zijn IP te vinden.
2. In Instellingen → Printer → **Network (TCP)** → voer IP in, poort `9100`.
3. Stel **Papierbreedte** in op de rol: 80 mm (toonbank) of 58 mm (compact).
4. Klik **Testafdruk** → moet een voorbeeldbon afdrukken.
5. Klik **Test kassalade** → de lade moet openspringen.

Werkt op Windows en Android zonder drivers. Dezelfde printer kan meerdere terminals bedienen.

### F2. Thermische printer — USB (alleen Windows)

1. Installeer de printer met de Windows-driver van de fabrikant.
2. Instellingen → Printer → **USB** → **Vernieuwen** → kies uit de lijst.
3. Stel **Papierbreedte** in op de rol.

### F3. Kassalade

Verbindt via een **RJ11-kabel naar de DK-poort van de printer**. Geen aparte configuratie — de printer stuurt hem aan.

- Default pin: **Pin 2** (EPSON TM-T20, Star TSP100, meeste Posiflex).
- Als de lade niet openspringt, schakel naar **Pin 5** in Instellingen.

### F4. Barcodescanner

USB HID-scanner → gewoon insteken. Hij gedraagt zich als een toetsenbord; de POS pakt scans automatisch op terwijl elk scherm open is (focus-onafhankelijk). Bluetooth-scanners in HID-("toetsenbord")modus werken op dezelfde manier.

Test: houd een productverpakking voor de scanner. Als `Beep + het item verschijnt in winkelwagen` → werkend.

**Geen scanner bij de hand?** Tik op de **📷-cameraknop** naast de zoekbalk van de kassa — de camera van de terminal scant live EAN/UPC/Code 128/Code 39/ITF-barcodes. De camera vereist een beveiligde verbinding (HTTPS) of de desktop-app; op een gewoon `http://`-adres blokkeert de browser cameratoegang bewust.

---

### F5. Bank-pinterminal (kaartbetalingen)

Niets aan te sluiten: de pinterminal van de bank is een zelfstandig apparaat —
naast de kassa zetten, klaar. De kassier tikt het bedrag op het bankapparaat
in en registreert de kaartverkoop in de kassa. Er is bewust geen kabel of
koppelstap. Details en visuele gids: [/card-payments.html](/card-payments.html).

## Deel G — Dagelijkse setup (elke ochtend)

### G1. Lock de wisselkoers van vandaag (manager)

POS → scherm **Wisselkoers**.

De geplande backend-job om 06:00 AST probeert USD→SRD op te halen van ExchangeRate-API. Als dat lukte, wordt de dagkoers getoond als **Locked**. Zo niet (geen internet, API plat), dan moet de manager:

1. De koers van vandaag handmatig invoeren (van CBvS of een door de bank gepubliceerd tarief).
2. **Vandaag locken** klikken.

Alle verkopen voor de rest van de dag gebruiken deze koers, opgeslagen op elke salerij voor audit.

### G2. Open de kassa (kassier)

POS → kassier logt in → **Kassa openen**-gate verschijnt.

1. Kies de kassa (Kassa 1 / 2 / ...).
2. Voer het **beginsaldo** in — het contant dat al in de lade zit (bv. 200 SRD).
3. **Openen**. Nu is de POS klaar.

---

## Deel H — Eerste end-to-end test-verkoop

Doe dit met de klant erbij zodat ze het zien werken.

| # | Actie | Verwacht |
|---|---|---|
| 1 | Scan of tik op een product | Verschijnt in winkelwagen met BTW getoond |
| 2 | Voeg een tweede product toe, verander aantal naar 2 | Subtotaal update live |
| 3 | Pas een 10% korting op totaal toe | Kortingsregel + herberekende BTW (na korting) |
| 4 | Klik **Betalen** → **Contant** → voer `100.00` in | Wisselgeld berekend, groot groen bedrag |
| 5 | Klik **Verkoop voltooien** | Kassalade springt open + bon print |
| 6 | Pak de bon op | Bonkop/voet/logo correct, BTW als aparte regel uitgesplitst, verkoopnummer, BTW-nummer afgedrukt |
| 7 | E-mail een kopie: voer je adres in → **Verzenden** | E-mail komt binnen 30s aan |
| 8 | Open het live overzicht van het dashboard | De verkoop verschijnt binnen seconden (Reverb WebSocket push) |
| 9 | Kassier: **Dienst beëindigen** → sluit kassa, tel contant, voer werkelijk bedrag in | Systeem toont verwacht vs geteld, eventueel kasverschil in rood |
| 10 | Manager: **Einde dag** → **Indienen bij hoofdkantoor** | Z-Rapport-rij → "Verzonden ✓ [timestamp]" |
| 11 | Dashboard: **Z-Rapporten** → bevestig dat de rij is aangekomen | Synced |

Als een stap mislukt → zie [13-dev-workflow.md](13-dev-workflow.md) §Troubleshooting (zodra geschreven).

---

## Deel I — Backups, monitoring, lopende ops

### I1. Database-backups (3-2-1-regel) — gescript

De repo levert kant-en-klare backup-tooling mee; eenmalig per server
installeren:

```bash
# Eén cronregel — elke nacht om 03:30 AST:
30 3 * * * /var/www/html/scripts/backup.sh >> /var/backups/josbin/backup.log 2>&1
```

`scripts/backup.sh` doet alles: een gecomprimeerde nachtelijke dump naar
`/var/backups/josbin/db/` (14 bewaard), wekelijks op zondag een basis-snapshot
naar `…/base/` (2 bewaard), en het opschonen van het write-ahead-archief.
Samen met de WAL-archivering die het productie-composebestand aanzet levert
dit **point-in-time recovery tot op de minuut**, niet alleen tot gisternacht.

- **Tweede kopie (buiten de server):** draai `scripts/pull-backup.sh` vanaf de
  kantoorlaptop — haalt de nieuwste dump via SSH naar `~/JosbinBackups/`.
- **Derde kopie:** wijs de `OFFSITE_CMD`-hook in `backup.sh` naar een
  versleutelde bucket zodra die er is.

**Test de restore maandelijks** — `scripts/backup-restore-test.sh` doet dat
zonder risico: herstelt de nieuwste dump in een kladdatabase, vergelijkt de
rijaantallen van zes kerntabellen met live, print PASS/FAIL en gooit de klad
weer weg. Ongeteste backups zijn geen backups.

### I2. Queue monitoring

Bezoek **http://&lt;server-LAN-IP&gt;:8080/horizon** als Super Admin. Toont:
- Openstaande jobs (zou normaal 0 moeten zijn)
- Failed jobs (onderzoek elke)
- Throughput
- Memory use

### I3. Dagelijkse licentiecheck

De scheduler runt `license:check` om 00:05 AST. Als je license server >72 u onbereikbaar is, gaat de POS in offline grace mode (waarschuwingsbanner, verkopen werken nog). Als hij >72 u onbereikbaar is **en** de licentie is verlopen, worden verkopen geblokkeerd.

### I4. Verlengkalender

Zet herinneringen in je agenda:

| Wanneer | Wat |
|---|---|
| 60 dagen voor verval | Bereik klant voor verlengingsbeslissing |
| 30 dagen voor verval | Gele banner verschijnt in dashboard |
| 14 dagen voor verval | Amber banner + dagelijkse e-mail |
| Verval | 14-dagen grace begint, volledige werking gaat door |
| Grace +14 dagen | Soft lock: nieuwe verkopen geblokkeerd, rapporten blijven beschikbaar |
| Grace +44 dagen | Hard lock: login geblokkeerd, data-export blijft |

Verleng door `POST /api/admin/licenses/{license}/renew` aan te roepen op de license server. Activatie is instant — geen herinstallatie.

### I5. Veelvoorkomende issues

| Symptoom | Waarschijnlijke oorzaak | Fix |
|---|---|---|
| POS toont "Server unreachable" | Server-PC uit, of netwerkprobleem | Aanzetten, ping het server-IP, check firewall |
| Verkoop voltooit maar geen bon | Printer-IP gewijzigd | Voer IP opnieuw in in Instellingen → Printer |
| Kassalade springt niet open | Verkeerde pin in Instellingen | Wissel Pin 2 ↔ Pin 5 |
| "Sync pending — N transactions queued" | Internet plat | Retried automatisch 1m/5m/15m/30m; of USB-export vanaf Z-Rapport-scherm |
| MAC is invalid error na key rotation | APP_KEY veranderd; oude encrypted data onleesbaar | Re-seed, of roteer met `php artisan key:generate --show` + custom re-encrypt |
| Licentie-verlopen-banner | Verlenging vereist | Verleng op de license server |

---

---

## Bonus — Een demo-stack draaien naast live

Voor klantdemo's, training of experimenten draai je de **demo-stack** parallel aan je live-stack. Zelfde code, geïsoleerde database, andere poorten — beide kunnen tegelijk omhoog zijn.

```bash
# Bring up the demo stack on its own ports (8082 / 55433 / 6380)
docker compose -p josbin_demo \
  -f docker-compose.yml -f docker-compose.demo.yml up -d --build

# Migrate + seed (one-off, after first start)
docker compose -p josbin_demo -f docker-compose.yml -f docker-compose.demo.yml \
  exec app php artisan migrate --force

docker compose -p josbin_demo -f docker-compose.yml -f docker-compose.demo.yml \
  exec app php artisan db:seed --force

# Fill every screen with realistic data
docker compose -p josbin_demo -f docker-compose.yml -f docker-compose.demo.yml \
  exec app php artisan db:seed --class=DemoSeeder --force

# Point a frontend at the demo backend
cd frontend && VITE_API_URL=http://localhost:8082/api npm run dev
# (similarly for dashboard, on a different terminal/port)
```

Een gele "DEMO MODE — not real data"-banner verschijnt op elk scherm van POS en Dashboard zodra ze met de demo-backend praten (aangestuurd door `JOSBIN_POS_DEMO_MODE=true` blootgesteld via `GET /api/environment`).

> **⚠️ Run migrations opnieuw op demo na elke backend-wijziging.** Demo en live hebben elk hun eigen database. Wanneer een nieuwe migratie wordt geleverd, update `docker compose exec app php artisan migrate` alleen de stack waar je hem op richt. Na het pullen van nieuwe code run je het migrate-commando hierboven ook tegen demo (en sandbox), anders gooit de demo-POS SQL-fouten tegen ontbrekende tabellen. Symptoom: leeg productgrid, "Kon X niet laden"-meldingen.

Afbreken zonder data te verliezen: `docker compose -p josbin_demo -f docker-compose.yml -f docker-compose.demo.yml down`.
Demo-data ook wissen: voeg `--volumes` toe en `rm -rf docker/postgres-demo/`.

---

## Waar nu naartoe

| Doelgroep | Doc |
|---|---|
| Kassiers, vestigingsmanagers (dagelijkse operatie) | [user_manual/](../user_manual/) |
| HQ super admin / org admin (configuratie, rapporten) | (dashboard manual — TODO) |
| Ontwikkelaars die het systeem uitbreiden | [01-architecture.md](01-architecture.md) en verder |
| Delivery / encoded build / code signing | [scripts/README.md](../scripts/README.md) |
| License server-onderhoud | [license-server/README.md](../license-server/README.md) |

---

→ [1 — Architectuuroverzicht](01-architecture.md)
