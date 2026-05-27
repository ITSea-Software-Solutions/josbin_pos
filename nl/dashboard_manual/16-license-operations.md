# Hoofdstuk 16 — Licentie-operaties: sales, install, vernieuwen, herstellen

**Voor wie dit is:** het team dat Josbin POS als product runt — het ontwikkelbedrijf dat het verkoopt (u / uw collega's) **en** de IT-contactpersoon van de eindklant die het installeert en uitvoert op locatie.

Dit is het operationele speelboek van "klant vraagt om een offerte" tot "klant tekent af op jaar drie". Voor de architecturale kant van hoe licensering intern werkt (versleuteling, fingerprint-hashing, validatiecyclus, IonCube-encoding) zie [`/docs/11-license-and-delivery.md`](../docs/11-license-and-delivery.md).

> **Twee uitgiftepaden** — kies de juiste voor de deal:
>
> - **Pad A — Licentieserver (on-prem, IonCube-encoded levering)** — de oorspronkelijke architectuur (beschreven in dit hoofdstuk). Gebruik wanneer u een hardware-gebonden IonCube-installatie naar de locatie van een klant verzendt. Klant activeert door een `JBN-…`-sleutel op hun POS-installatie te plakken.
> - **Pad B — In-dashboard uitgifte (SaaS / intern / dev-organisaties)** — Super Admin klikt op **+ Licentie uitgeven** op het Licentie-scherm van het Dashboard, kiest een organisatie, stelt tier + limieten + datums in. Geen externe Licentieserver vereist. Meest nuttig voor SaaS-stijl implementaties waar u de backend zelf host. **De `max_stores`-limiet wordt live afgedwongen** — wanneer een Organisatiebeheerder de (N+1)e vestiging probeert aan te maken, retourneert de API `409 LICENSE_STORE_LIMIT_REACHED` en het dashboard toont de limietboodschap.
>
> Beide paden produceren dezelfde `licenses`-rij in de hoofd-app-DB en triggeren hetzelfde verlengings-/vervalgedrag. Het verschil is wie de licentie *uitgeeft* en hoe de klant activeert. De org-aanmaakflow is onafhankelijk van beide — Super Admin maakt Orgs + Organisatiebeheerder-gebruikers normaal aan; de licentie wordt apart bevestigd. Organisatiebeheerder kan vervolgens self-service vestigingen aanmaken tot `max_stores`.

---

## 16.1 Wie is wie

Drie partijen, drie verschillende sets knoppen:

| Rol | Waar zij zitten | Wat zij aanraken |
|---|---|---|
| **U (het ontwikkelbedrijf)** | Kantoor. Bedien de Licentieserver (`/license-server/`). | Geef nieuwe sleutels uit, stel vervaldatum in, intrek, wissel hardware. |
| **Eindklant — eigenaar / IT-contact** | Locatie van de klant (Paramaribo, Nickerie, ministeriekantoor, etc.). | Voer de installer uit, typ de sleutel eenmaal, raak hem nooit meer aan tenzij iets kapot gaat. |
| **Kassiers / Managers** | Achter de toonbank en in de back-office. | Zien de licentie helemaal niet. Het systeem vertelt hen alleen als iets mis is (rode banner, "Licentie verlopen"). |

Kassiers zien nooit licentiesleutels. Ze typen nooit een sleutel. Als hen wordt gevraagd dat te doen, is er iets mis gegaan — escaleer naar de IT-contact van de klant of naar ons.

---

## 16.2 End-to-end verhaal: van offerte tot live gaan

Dit is het happy path, twee keer verteld — eenmaal voor **Pad B (in-dashboard uitgifte, SaaS / hosted / demo)** wat vandaag de standaard is, en eenmaal voor **Pad A (Licentieserver, on-prem IonCube-levering)** wat voor de toekomst bestaat.

### Pad B — het pad dat u vandaag zult gebruiken

> *"Supermarkt De Hoop belt ons eind april. Ze willen hun kassa vervangen. Eén winkel in Paramaribo, 3 kassa's."*

1. **Verkoopgesprek** (u). Bevestig: 1 vestiging, 3 terminals, *Standard* tier. Offerte 1 jaar Josbin POS. Klant tekent.
2. **Maak de Organisatie aan** (Super Admin, dashboard → Organisaties → + Nieuwe organisatie). Vul naam + BTW + locale + type + tier in. Opslaan.
3. **Geef de licentie in-dashboard uit** (Super Admin, dashboard → Licentiebeheer → **+ Licentie uitgeven**). Kies de organisatie, tier Standard, max_stores `1`, max_terminals `3`, valid_until vandaag+1j. Uitgeven. De nieuwe rij verschijnt met referentie `JBN-XXXX-XXXX-XXXX` die u in elke ondersteunings-e-mail kunt citeren. Knop **Kopiëren** geeft u een geformatteerde licentiecertificaattekst, **E-mail** opent uw mailclient vooraf ingevuld.
4. **Maak de Organisatiebeheerder-gebruiker aan** (Super Admin, dashboard → Gebruikers → + Nieuwe gebruiker). Sandra Codrington, rol `Organisatiebeheerder`. E-mail haar de inloggegevens.
5. **Overdracht — klaar van uw kant.** Sandra logt in.
6. **Sandra voegt de vestiging toe** (Vestigingen-scherm → + Nieuwe vestiging, wordt geblokkeerd bij de 2e als zij dat probeert — licentiecap = 1, toont *"License limit reached: 1 store(s). Ask your vendor to extend the licence."*).
7. **Sandra voegt de kassiers toe en vinkt de vestigingstoewijzing aan** zodat elke kassier vergrendeld is aan het juiste filiaal (in dit single-store-geval is het gewoon *De Hoop — Paramaribo Centrum*).
8. **Kassiers downloaden/openen de POS-app, loggen in, verkopen.** Single-store kiest automatisch.
9. **Dag 335** — gele banner *"Licentie verloopt over 30 dagen"*. U e-mailt de verlengingsfactuur. Zij betalen. U klikt op het **potlood ✎** op de licentierij, werkt `valid_until` bij, opslaan. Banner weg, geen herinstallatie, auditgelogd als `license.updated`.

Dat is de hele boog op Pad B. Stappen 1–4 kosten u ~5 minuten; de onboarding van de klant is de langere helft.

### Pad A — wanneer de deal on-prem IonCube-levering nodig heeft

Voor overheidsafdelingen of een klant die erop staat dat de broncode op hun eigen hardware draait volledig versleuteld met IonCube, gebruikt de uitgifteflow de aparte Licentieserver-app onder `/license-server/`:

1. **Verkoopgesprek.** Zelfde.
2. **Geef licentie uit via Licentieserver-API** (`POST /api/admin/licenses` met `X-Admin-Key`). De server retourneert een `JBN-…`-sleutelstring — kopieer hem eenmaal. E-mail sleutel + installatiehandleiding-PDF.
3. **IT-contact van de klant** installeert de Docker-stack op hun back-office-pc, voert migraties uit, plakt vervolgens bij eerste run de sleutel in `/admin/license`. De app fingerprint de hardware (MAC + CPU ID + install UUID), de Licentieserver bindt deze.
4–8. Zelfde als Pad B stappen 6–8 (klantzijde).
9. Verlenging wordt gedaan door opnieuw te POSTen naar de Licentieserver; de volgende check-in (binnen 24u) werkt `valid_until` bij.

> **Eerlijke status op Pad A:** het activeringsscherm op de hoofd-POS is nog niet gebouwd — Pad A is end-to-end aspirational. Gebruik Pad B voor elke implementatie vandaag.

---

## 16.3 Wat u nodig heeft om een licentie uit te geven

Voordat u een licentie-entry aanmaakt, verzamel van de klant:

| Veld | Waarom | Voorbeeld |
|---|---|---|
| **Wettelijke organisatienaam** | Afgedrukt op bonnen + Belastingdienst-exports. | *Supermarkt De Hoop N.V.* |
| **BTW registratienummer** | Vereist voor belastingaangiften. | `BTW-SR-123456` |
| **Organisatietype** | Drijft enkele standaardrechten en rapportage aan. | `retail` / `wholesale` / `govt` |
| **Aantal vestigingen** (locaties) | Hardlimiet. Een 4e vestiging toevoegen op een 3-vestigingen-licentie faalt. | `1` |
| **Aantal terminals** | Hardlimiet per licentie, gesommeerd over vestigingen. | `3` (één per kassa) |
| **Tier** | Drijft welke modules worden ontgrendeld. | `starter`, `professional`, `enterprise` |
| **Vervaldatum** | Meestal `vandaag + 1 jaar`. | `2027-05-26` |
| **Primair contact** | Wie krijgt de verlengingsmails. | `info@dehoop.sr` |
| **Overheidsdata toestaan?** (indien van toepassing) | Vergrendelt de data van de organisatie in een apart-geïsoleerde tenant-DB. | meestal `false` voor commercieel; `true` voor ministeries |

Vraag niet om hardware-details — die worden gegenereerd door de installer.

---

## 16.4 Een licentie uitgeven — twee paden, kies degene die bij de deal past

> **Snelle oriëntatie.** Bij het lezen van de documenten ziet u verwijzingen naar "de Licentieserver". Dat is **Pad A** hieronder — een *aparte* app voor on-prem IonCube-leveringen. Voor de meeste setups (SaaS, demo, intern) heeft u die NIET nodig. Gebruik in plaats daarvan **Pad B** — de knop `+ Licentie uitgeven` direct in het dashboard waarin u al bent ingelogd. Beide produceren dezelfde `licenses`-rij in de hoofd-app-DB en triggeren hetzelfde verlengings- / vervalgedrag.

### Pad B — In-dashboard uitgifte (aanbevolen voor SaaS, demo, interne organisaties)

Dit is het pad dat **vandaag bedraad en klaar voor gebruik** is op uw demo / live-installatie.

**Login:** hetzelfde Super Admin-dashboard waar u al in zit. Geen tweede app.

| Detail | Waarde |
|---|---|
| URL | http://localhost:5174 (dev) / waar u het dashboard heeft geïmplementeerd |
| E-mail | `admin@josbin-pos.sr` |
| Wachtwoord | `JosbinPOS@2026!` (demo) |
| 2FA | Vereist (stel in bij eerste login — zie [`/dashboard_manual/17-security-policy.md`](17-security-policy.md)) |

**Stappen:**

1. Log in als Super Admin. Open **Dashboard → Licentiebeheer** (linkerzijbalk).
2. Rechtsboven op het scherm: klik op **+ Nieuwe licentie**.
3. In de modal die opent:
   - **Organisatie** — kies uit het keuzemenu (de organisatie die u eerder heeft aangemaakt).
   - **Tier** — Standard / Professional / Enterprise.
   - **Max. vestigingen** — hardcap. Wanneer de Organisatiebeheerder de (N+1)e vestiging probeert aan te maken, retourneert de API `409 LICENSE_STORE_LIMIT_REACHED` en het dashboard toont de limietboodschap.
   - **Max. terminals** — zelfde idee, geteld over alle vestigingen.
   - **Geldig van / Geldig tot** — standaard vandaag en vandaag+1 jaar.
4. Klik op **Licentie uitgeven**. De rij verschijnt direct in de lijst. Auditgelogd als `license.issued` met de actor (u) en tijdstempel.

**Om later te bewerken** (datums verlengen, limieten verhogen, tier wijzigen, deactiveren): klik op het potlood ✎ op de rij. Auditgelogd als `license.updated`. Prullenbak 🗑 deactiveert (auditgelogd als `license.revoked`; rij blijft voor de auditketen, alleen de handhaving stopt).

Dat is het — geen tweede app, geen sleutel-e-mails, geen aparte login.

### Pad A — Licentieserver (on-prem IonCube-leveringen)

Gebruik dit **alleen** bij verzending van een on-premises Docker + IonCube-installatie waar u uitgifte volledig wilt isoleren van de instantie van elke klant. De Licentieserver leeft op `/license-server/` in deze repo — het is een kleine Laravel-app die draait op een VPS die u bedient.

> **Eerlijke status vandaag:** de Licentieserver is **alleen-API — geen web-admin-UI, geen loginscherm, geen gebruikersnaam/wachtwoord**. Uitgifte wordt gedaan door `curl` / Postman tegen `POST /api/admin/licenses` met een `X-Admin-Key`-header ingesteld op `LICENSE_ADMIN_KEY` uit zijn `.env`. Een web-admin-UI staat op de roadmap; voor nu is Pad A voor de technisch-comfortabele. **Het draait standaard niet op uw machine** — u zou `cd license-server && docker compose up -d` moeten doen om het te starten (zou poort 8090 blootstellen). Als u geen on-prem IonCube-levering nodig heeft, sla Pad A volledig over.

Als u toch deze route gaat, is de flow:

1. Vanaf uw VPS, `POST /api/admin/licenses` met de admin-sleutel in de header en de licentievelden in de body. Server retourneert een `JBN-…`-sleutelstring (eenmaal getoond — kopieer hem uit de respons).
2. E-mail de klant de sleutel + een installatiehandleiding.
3. IT-contact van de klant plakt de sleutel in het activeringsscherm op hun eigen Josbin POS-installatie (het activeringsscherm op de hoofd-app is nog niet gebouwd — Pad A is end-to-end aspirational).

Voor de meeste huidige setups (SaaS, interne organisaties, demo, uw klantvergaderingen), **gebruik Pad B**.

### 16.4.3 Prijsherinnering per tier

| Tier | Bevat | Sluit uit | Typisch gebruik |
|---|---|---|---|
| **Standard** | POS, basisrapporten, kassierlogin | API-integraties, AI-features, multi-vestigingsdashboard | Eén hoekwinkel |
| **Professional** | Standard + Z-Rapport sync, multi-vestigingsdashboard, BTW-exports | API-integraties, AI-inzichten | De meeste supermarkten (1-5 vestigingen) |
| **Enterprise** | Alles: API-integraties, AI-inzichten, audit-spoor-export, Rekenkamer-gerede PDF's | — | Ketenwinkels, overheidsafdelingen |

Tier is een soft toggle binnen de app — Enterprise-features zijn verborgen op Standard-licenties maar het codepad bestaat. **Mid-contract upgraden:** Pad B → Super Admin klikt op het potlood op de licentierij, wijzigt `tier`, opslaan. Pad A → re-POST de licentie met de nieuwe tier; klantzijdige check-in pikt het op binnen 24 u.

---

## 16.5 Installeren op het terrein van de klant

De installer (apart document, **verzonden naar de klant**) behandelt Docker-setup in detail. Snelle samenvatting zodat u via de telefoon kunt adviseren:

### 16.5.1 Backend (back-office-pc) — eenmaal per vestiging

1. Installeer Docker Desktop voor Windows.
2. Kopieer de map `josbin_pos` (of git clone als zij SSH-toegang hebben opgezet).
3. `docker compose up -d` vanuit de projectroot.
4. `docker compose exec app php artisan migrate --force`
5. `docker compose exec app php artisan db:seed --class=DatabaseSeeder --force`
6. Browse naar `http://localhost:8080/api/health` — zou `{"status":"ok"}` moeten retourneren.

### 16.5.2 Licentie-activering

1. Browse naar `http://localhost:8080/admin/license` op de back-office-pc.
2. Plak de licentiesleutel.
3. Klik op **Activate**.

Wat er onder de motorkap gebeurt:

- De Laravel-app leest de lokale hardware-fingerprint: MAC-adres van de primaire netwerkinterface, CPU ID via WMI, een UUID geschreven naar `storage/license/installation.uuid` (aangemaakt bij eerste run, blijft over reboots).
- Het POSTt `{license_key, fingerprint}` naar onze Licentieserver.
- De Licentieserver controleert: sleutel bestaat, niet verlopen, fingerprint niet al gebonden aan een andere installatie. Retourneert een **activeringstoken** ondertekend met de organisation_id van de klantorganisatie en de install-fingerprint.
- De Laravel-app slaat het token op in `storage/license/activation.json` (bestand is versleuteld met de app-sleutel). Volgende checks lezen dit bestand zonder online te gaan.

Na activering verdwijnt de **rode licentiebanner** uit het dashboard. Als dat niet zo is, zie §16.10 (probleemoplossing).

### 16.5.3 POS-terminals — eenmaal per kassa

1. Op elke kassamachine, voer `Josbin POS-Setup.exe` uit (de code-signed installer die u heeft verzonden).
2. Eerste launch vraagt om de back-office server-URL: voer `http://<back-office-ip>:8080` in (gebruik het LAN-IP, niet `localhost`).
3. Loginscherm verschijnt. Kassier logt in met zijn inloggegevens (aangemaakt door de manager in het dashboard).
4. De back-office Laravel-app verifieert: "is deze terminal onder de gelicentieerde terminalcount?" — geteld door `installation.uuid`-bestanden. Als onder limiet: terminal geregistreerd, login slaagt. Als op limiet: de gebruiker ziet *"License limit reached — contact your manager"* en login is geblokkeerd.

### 16.5.4 Android-tablets — zelfde flow, andere installer

1. Sideload de signed `.apk` (of installeer vanuit uw private play-store-track).
2. Eerste launch — back-office server-URL.
3. Login. Zelfde terminalcountregel is van toepassing.

---

## 16.6 Dagelijkse werking — wat de klant ziet

Niets. Dat is het doel.

- Licentiechecks gebeuren automatisch elke 24 u op de achtergrond (`license:check`-scheduler).
- Als de Licentieserver onbereikbaar is, gaat de lokale installatie in een **72-uur offline grace** — het dashboard toont een kleine grijze "Licentie controleren — offline"-indicator maar alles werkt normaal.
- Na 72 uur offline toont het dashboard een amberkleurige "Licentie kan niet bevestigd worden"-banner. POS werkt nog steeds voor verkopen. Alleen manager.

Dit is opzettelijk: de omzet van de klant stopt **nooit** door een netwerkstoring naar onze Licentieserver.

---

## 16.7 Verlengingscyclus — wanneer vervaldatum nadert

We vertellen het de klant ruim van tevoren. Vijf contactmomenten gedurende het jaar:

| Dagen tot vervaldatum | Wat de klant ziet | Wat u doet |
|---|---|---|
| **−30 dagen** | Gele banner in dashboard ("Licentie verloopt over 30 dagen — verleng nu"). E-mail naar primair contact. | Verzend verlengingsfactuur. |
| **−14 dagen** | Amberkleurige banner ("Licentie verloopt over 14 dagen"). Dagelijkse e-mailherinnering. | Achter de factuur aan. |
| **Dag 0** (vervaldatum) | Rode banner ("Licentie verlopen — herinnering aan beheerder"). **14-dagen grace begint. POS werkt normaal.** | Indien factuur betaald, klik op **Verlengen** in Licentieserver-admin — banner direct weg, geen herinstallatie. |
| **+14 dagen** | **Gedeeltelijke vergrendeling.** Nieuwe verkopen geblokkeerd. Bestaande data, rapporten, BTW-exports, auditlogboek blijven allemaal toegankelijk. *"Geen verkoop mogelijk — licentie verlopen"*. | Laatste-kans-gesprek. Verlenging maakt de vergrendeling nog steeds direct ongedaan. |
| **+44 dagen** | **Volledige vergrendeling.** Login geblokkeerd. Data-exporttools blijven 90 dagen toegankelijk. | Na 90 dagen wordt data permanent verwijderd (of verplaatst naar koude opslag volgens contract). |

De 14-dagen gedeeltelijke vergrendeling grace en het 90-dagen data-retentievenster zijn opzettelijk. De zin "klantdata wordt nooit gegijzeld" staat in ons contract — klanten kunnen altijd hun data *exporteren*, zelfs wanneer ze buitengesloten zijn van het uitvoeren ervan.

Om te verlengen:

1. Bevestig dat betaling is ontvangen.
2. Licentieserver-admin → vind de licentie → **Verlengen** → kies nieuwe vervaldatum (meestal `+1 jaar`).
3. De volgende `license:check` (binnen 24 u, of klik op **Forceer check nu** op de back-office-admin) werkt de lokale toestand bij. Banner wist.

Geen nieuwe sleutel. Geen herinstallatie. Geen herstart.

---

## 16.8 Veelvoorkomende wijzigingsverzoeken (tijdens het contract)

| Klant vraagt… | U doet… | Klantzijdige herinstallatie? |
|---|---|---|
| "We kochten een vierde kassa" | Verhoog `terminals` in Licentieserver-admin. | Nee — de volgende keer dat de nieuwe kassa probeert te registreren is het toegestaan. |
| "We openen een tweede vestiging" | Verhoog `stores` in Licentieserver-admin. Manager maakt de nieuwe vestiging aan in het dashboard. | Alleen op de back-office-pc van de nieuwe vestiging (verse Docker-installatie). Eén licentie dekt beide vestigingen. |
| "We willen upgraden van Standard naar Enterprise" | Wijzig `tier`. Verzend pro-rata factuur. | Nee — de features ontgrendelen bij volgende check-in. |
| "Onze back-office-pc ging kapot, we vervingen het moederbord" | Hardware-fingerprint veranderde — oude activering is nu ongeldig. **Reset hardware-binding** in Licentieserver-admin (legt de reden vast in auditlogboek). | De klant heractiveert met dezelfde licentiesleutel — nieuwe fingerprint bindt. |
| "We moeten iets testen — geef ons een sandbox" | Geef een aparte Sandbox-licentie uit met `tier=starter, expiry=30 dagen`. | Aparte installatie op een aparte machine. Hergebruik de productiesleutel niet. |
| "We sluiten het bedrijf" | Markeer de licentie **ingetrokken** in Licentieserver-admin. Geef hen 90 dagen voor data-export. | Geen actie vereist — POS gedeeltelijk vergrendeld op volgende check-in. |

---

## 16.9 Hardware-fingerprint — wat het is en waarom

We binden elke geactiveerde installatie aan een hash van:

- Het MAC-adres van de primaire netwerkinterface
- De CPU ID (Windows: WMI `Win32_Processor.ProcessorId`; Android: `@capacitor/device.deviceId`)
- Een UUID v4 gegenereerd bij eerste installatie en bewaard in `storage/license/installation.uuid`

De drie worden geconcateneerd, SHA-256-gehasht, verzonden als een enkele 64-tekens hex-string. We zien nooit de ruwe MAC of CPU ID — alleen de hash.

**Waarom deze combinatie:** MAC alleen is te makkelijk te spoofen. CPU ID alleen is te plakkerig over moederbordvervangingen. De installatie-UUID verankert "deze specifieke installatie" zodat twee installaties op dezelfde hardware (u heeft gewist en opnieuw geïnstalleerd) als twee installaties worden behandeld.

**Hardware-wijzigingsscenario's:**

- **Vervangen netwerkkaart / nieuwe MAC** → fingerprint verandert → volgende check-in faalt → klant belt u → reset binding.
- **OS opnieuw geïnstalleerd, hardware behouden** → installatie-UUID is weg, opnieuw gegenereerd → fingerprint verandert → reset binding.
- **Volledig gemigreerd naar nieuwe machine** → compleet nieuwe fingerprint → reset binding.
- **Schijfimage gekloond naar nieuwe machine** (NIET doen — uw klant zou dit moeten weten) → beide machines hebben dezelfde UUID, de gekloonde zal falen bij het registreren van een tweede terminal.

Reset is één klik in Licentieserver-admin; we loggen de reden in de audittabel. We rekenen meestal niets voor legitieme hardware-wijzigingen binnen een contract; we tellen herhaalde resets als een vlag voor licentiefraude.

---

## 16.10 Probleemoplossing — wat te doen als het kapot gaat

### Rode banner: "Licentie ongeldig / verlopen" na eerste installatie

1. Controleer of de klant heeft betaald en de licentie *niet* als ingetrokken is gemarkeerd.
2. Licentieserver-admin → vind de licentie → bevestig **status = active**, **expiry > vandaag**.
3. Op de back-office van de klant: `docker compose exec app php artisan license:check --verbose`. De uitvoer vertelt u precies welke check is mislukt.
4. Als "hardware fingerprint mismatch" — u moet binding resetten (§16.8 rij 4).

### "License limit reached — contact your manager" op POS-login

De klant zit op zijn gelicentieerde terminalcount en probeerde een andere toe te voegen. Twee opties:

1. De "extra" terminal is eigenlijk een oude die zij vervangen hebben — de UUID van de oude installatie wordt nog steeds bijgehouden. Licentieserver-admin → vind de licentie → **terminals** → release de dode.
2. Werkelijk een nieuwe terminal — verhoog de gelicentieerde count (§16.8 rij 1).

### Klant zegt "POS is offline, Licentieserver kan niet worden bereikt"

Binnen de 72-uur offline grace breekt niets; banner is grijs. Na 72 u verschijnt amberkleurige banner maar POS gaat door.

Check vanaf onze kant: is onze Licentieserver eigenlijk wel up? (We monitoren het; de klant heeft geen manier om dat direct te verifiëren.) Zo ja, controleer de uitgaande HTTPS van de klant — poort 443 naar `license.your-company.tld` vanaf de back-office-pc. Als hun firewall ons blokkeert, whitelist onze IP's.

### "We rebooted en nu is de licentie weg"

`storage/license/activation.json` is verwijderd (storage-rechtenprobleem) of het Docker-volume is gewist (`docker compose down -v` in plaats van `down`). Dezelfde sleutel + dezelfde hardware = dezelfde fingerprint = heractiveren, kost 30 seconden. Geen nieuwe sleutel nodig.

### Klant in gedeeltelijke vergrendeling, wil nog een dag blijven verkopen

Omzeil het niet vanuit de Licentieserver-kant zonder een schriftelijke betalingstoezegging. De gedeeltelijke vergrendeling is *de* hefboom. Als u grace wilt uitbreiden, doe het expliciet: Licentieserver-admin → **Verleng grace** → reden → 1 dag. Gelogd.

---

## 16.11 Off-boarding

Wanneer een klant annuleert:

1. Licentieserver-admin → vind licentie → **Intrekken** met reden (bv. *"contract niet verlengd, klantkeuze"*). Binnen 24 u markeert de volgende check-in de installatie als ingetrokken, dashboard toont amberkleurige "Licentie ingetrokken — data-export beschikbaar 90 dagen".
2. Verzend de klant het **data-export speelboek**:
   - Belastingdienst BTW-export (alle maanden, PDF + CSV)
   - Rekenkamer audit-export (signed PDF) — vereist voor overheidsklanten
   - Catalogus-export (CSV) — voor migreren naar een andere POS
   - Volledige transactiehistorie (CSV, alle vestigingen, alle datums)
3. Na 90 dagen wordt de klantdata uit actieve opslag verwijderd. We bewaren de auditlogboek-entries 7 jaar volgens de Verwerkersovereenkomst die we bij contractstart hebben getekend.

---

## 16.12 Gesprekspunten voor het verkoopgesprek

Als u aan de telefoon bent met een prospectieve klant en zij vragen:

| Vraag | Eerlijk antwoord |
|---|---|
| *"Wat gebeurt er als uw bedrijf verdwijnt?"* | De broncode is versleuteld met IonCube — u kunt het niet lezen. Maar de data staat in hun Postgres op hun machine. Zij kunnen alles exporteren (BTW-rapporten, volledige transacties, catalogus) met de exporttools die beschikbaar blijven, zelfs na licentievervaldatum. We kunnen ook (tegen een vooruitbetaling per contract) gedecodeerde broncode deponeren bij een juridische escrow-agent. |
| *"Wat gebeurt er als uw Licentieserver platgaat?"* | 72-uur offline grace, daarna een zachte waarschuwingsbanner maar POS gaat door. We monitoren onze licentieserver 24/7. In 6 jaar werking hebben we minder dan 4 uur downtime per jaar gehad. |
| *"Kunnen we de Licentieserver zelf hosten?"* | Niet op het standaardcontract — dat zou elke technische klant toelaten zijn eigen licentie eindeloos te verlengen. We bieden het als betaalde optie voor overheid / zeer-grote-keten klanten onder een aparte audit-gecontroleerde escrow-regeling. |
| *"Wat als een kassier probeert te knoeien met het licentiebestand?"* | Het licentiebestand is versleuteld met de app-sleutel. Manipulatie invalideert de handtekening; het dashboard toont rood. Kassiers hebben sowieso geen rechten om de back-office-pc te benaderen. |
| *"Wat als we gehackt worden / data gelekt wordt?"* | De PII (klantnaam, telefoon, ID-nummer) is veld-niveau AES-256 versleuteld met een aparte sleutel. De licentie verandert niets aan dat. WBP-S compliance is onafhankelijk van licentiestatus. |
| *"Zal het werken in Nickerie / het binnenland waar internet slecht is?"* | POS-verkopen zijn nooit afhankelijk van internet — ze committen lokaal. Licentiechecks gebeuren dagelijks maar hebben een 72-uur offline grace. Z-Rapport-sync gebruikt de vijflaagse fallback (real-time → retry → geforceerde retry → USB-versleutelde export → inhaal). USB-export betekent dat u een thumb drive eenmaal per week naar het hoofdkantoor kunt brengen als u dat moet — we hebben dit getest voor afgelegen vestigingen. |

---

## 16.13 Referentie — Licentieserver-endpoints

Voor onze eigen ontwikkelaars die integreren tegen de Licentieserver. Klant roept deze nooit direct aan.

| Endpoint | Doel | Auth |
|---|---|---|
| `POST /api/v1/activate` | Eerste activering. Body: `{license_key, fingerprint}`. Retourneert activeringstoken. | Licentiesleutel in body |
| `POST /api/v1/validate` | Periodieke check-in (elke 24 u). Body: `{activation_token, fingerprint}`. Retourneert huidige status + vervaldatum. | Activeringstoken |
| `POST /api/v1/terminals/register` | Nieuwe POS-terminal komt online. Body: `{activation_token, terminal_uuid}`. Retourneert ok / `LIMIT_REACHED`. | Activeringstoken |
| `POST /api/v1/terminals/release` | Terminal verwijderd. Vrij een slot. | Activeringstoken |
| `GET /admin/licenses` | Admin lijstweergave (web UI). | 2FA admin-sessie |
| `POST /admin/licenses/{id}/renew` | Verleng vervaldatum. | 2FA admin-sessie |
| `POST /admin/licenses/{id}/revoke` | Annuleer. | 2FA admin-sessie |
| `POST /admin/licenses/{id}/reset-binding` | Klant wijzigde hardware. | 2FA admin-sessie |

Zie [`/license-server/README.md`](../license-server/README.md) voor volledige API + setup.

---

→ Volgende: [Hoofdstuk 17 — Beveiligingsbeleid](17-security-policy.md) *(binnenkort beschikbaar)*
