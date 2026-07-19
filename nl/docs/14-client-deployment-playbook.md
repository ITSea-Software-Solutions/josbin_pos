# 14 — Uitroldraaiboek voor klantlocaties

> Het pad van "werkt op onze demoserver" naar "de partner verkoopt en
> installeert het bij echte winkels". Metgezel van de stapsgewijze
> [Installatie- & Setupgids](/nl/docs/00-installation-and-setup) — die gids is
> *hoe je één winkel installeert*; dit draaiboek is *hoe je de hele uitrol
> draait*: voorbereiding, het bezoek op locatie, en de herhaalbare kit
> waarmee de partner elke volgende klant bedient.

## 1. De drie uitrolvormen

| Vorm | Wat draait waar | Wanneer |
|---|---|---|
| **Alleen cloud** | Alles op één server; winkels gebruiken hem via internet | Demo's, evaluatie, kleine pilots met betrouwbaar internet |
| **Lokaal + cloudsync** *(de echte architectuur van het product)* | Per winkel: één backoffice-pc draait de Docker-stack (Laravel + PostgreSQL + Redis); terminals praten ermee via het LAN. De cloud draait het Super Admin-dashboard, de licentieserver en het Belastingdienst-portaal; winkels synchroniseren Z-rapporten en verkopen | Productiewinkels — verkopen gaat door met **nul internet** |
| **Alleen lokaal** | De winkelstack zonder geconfigureerde cloudsync | Eén kleine winkel, geen hoofdkantoor |

Alle drie komen uit dezelfde codebase en dezelfde compose-bestanden — de vorm
wordt bepaald door configuratie, niet door aparte builds.

## 2. Fase 1 — Voorbereiding (voordat iemand reist)

| ✔ | Punt | Toelichting |
|---|---|---|
| ☐ | **Productiecloud gescheiden van demo** | verse droplet/VM, schone `.env`, lege seed — de demobox blijft zandbak |
| ☐ | **Domein + HTTPS op 80/443** | reverse-proxy met subdomeinen (`beheer.…`, `docs.…`, `api.…`) + Let's Encrypt. Elimineert ook de hele klasse "VPN/firewall eet poort 8090"-supportmeldingen |
| ☐ | **Windows-kassa-installer gebouwd & getest** | `cd frontend && npm run build:win` → `Josbin POS-…-Setup.exe`. Ongesigneerd = SmartScreen-melding (acceptabel zolang het leverteam zelf installeert); een code-signing-certificaat verwijdert die voor partner-installaties |
| ☐ | **SPA-dists gebouwd met de juiste omgeving** | de dashboard-/kassa-webbundels bakken `VITE_*`-waarden (API-URL, WebSocket-host, docs-URL) **in tijdens de build** — bouw altijd via `scripts/deploy-server.sh` of na `set -a; source deploy.env; set +a`. Een kale `vite build` levert localhost-bundels op |
| ☐ | **Licentieserver live + pilotlicentie uitgegeven** | activeren → valideren → verval-/gracegedrag end-to-end geverifieerd (dashboardhandleiding h. 15–16) |
| ☐ | **SMTP-gegevens geconfigureerd** | bonnen / welkomstmails / BTW-notificaties blijven stil zonder; de in-app-bel werkt sowieso |
| ☐ | **Wisselkoers-API-sleutel gezet** | `EXCHANGERATE_API_KEY` in de backend-`.env`; dagelijkse vergrendeling 06:00 AST + halfuurlijkse self-heal nemen het over |
| ☐ | **Back-ups aan** | één cronregel installeert `scripts/backup.sh` (nachtelijke dump + wekelijkse basis-snapshot + WAL-archivering = herstel tot op de minuut); bewijs het met `scripts/backup-restore-test.sh` en haal de kopie-op-afstand op via `scripts/pull-backup.sh` (gids Deel I) |
| ☐ | **Belastingtest op de productiebox** | `k6 run -e BASE=… scripts/load-test.js` — het budget van ≤200 ms p95 moet op de echte server gemeten worden, niet op een laptop |
| ☐ | **Geseedde demowachtwoorden geroteerd** | de demo-logins uit de README staan publiek in de repo — roteer elk account op de productiestack vóór er echte data bestaat |
| ☐ | **Offline USB-installatiekit** | ga ervan uit dat het winkelinternet slecht is *tijdens* de installatie: Docker Desktop-installer · vooraf getrokken images (`docker save`-tarballs) · repo-bundel + `.env`-sjabloon · kassa-`Setup.exe` · geprinte Nederlandse installatiegids |
| ☐ | **Generale repetitie op een schone Windows-machine** | loop de Installatiegids van begin tot eind alsof je op locatie bent; herstel elke afwijking. De waardevolste stap vóór vertrek |
| ☐ | **IonCube-encodering** | alleen wanneer code op hardware landt die het leverteam niet beheert; overslaan voor een zelfbeheerde pilot |

## 3. Fase 2 — Het bezoek op locatie (4–5 dagen)

**Meenemen:** de USB-kit, een reserve-barcodescanner, reserveprinter- +
RJ11-ladekabel, een 4G-dongle (Digicel/Telesur) voor de sync-fallback, en een
UPS-advies voor de server-pc.

| Dag | Focus |
|---|---|
| **1 — Installatie** | Server-pc: stack vanaf USB, licentie geactiveerd, organisatie + vestiging + gebruikers aangemaakt, catalogus geïmporteerd (hun Excel → de importer). Terminals: `Setup.exe`, autostart bij opstarten, gericht op de lokale server. Wallet-QR's geüpload, pinterminal-modus = losse bankterminal. |
| **2 — Hardware, één apparaat per keer** | EPSON TM-T20-testprint (BTW-opmaak + logo) · lade-kick via printer · USB-scanner op echte schapproducten (EAN-13 + Code 128) · **etiketteerweegschaal: verifieer de embedded-barcode-indeling op hún weegschaal vóór activering — een verkeerde indeling prijst geruisloos verkeerd** · echte Mopé-/Uni5Pay+-sticker vs de QR op het scherm · cashierflow bankpinterminal + bon overnemen. |
| **3 — Randgevallen-script** | Trek de netwerkkabel er midden in een verkoop uit → blijf verkopen → zie synclagen 1–5 herstellen (incl. USB-export/-import) · zet de printer uit midden in een bon · twee terminals verkopen het laatste stuk van één product · terugbetaling + blinde retour · Z-rapport met kas in/uit en een geforceerd verschil · BTW-aangifte → geschil → opnieuw indienen met het inspecteursaccount · licentievervalbanners (testlicentie die morgen verloopt). |
| **4 — Training + zachte livegang** | Kassiers 15 min (gebruik de gesimuleerde pinterminal); manager: Z-rapport, openstaande betalingen, voorraad; eigenaar: dashboard, rapporten, BTW. Daarna echte verkopen met het leverteam als schaduw. |
| **5 — Buffer + ondertekende overdrachtschecklist** | Losse eindjes, geprinte spiekbriefjes, supportcontacten. |

## 4. Fase 3 — De herhaalbare "nieuwe-klant-kit" van de partner

Elke volgende winkel die de partner verkoopt volgt dezelfde vijf stappen —
zonder ontwikkelaars:

1. **Organisatie aanmaken** in het clouddashboard (handleiding h. 2)
2. **Licentie uitgeven** — tier = aantal vestigingen + terminals (h. 15–16)
3. **Installatiekit overhandigen** — USB + geprinte gids (of zelf installeren)
4. **Livegangchecklist doorlopen** — Delen A–H van de Installatiegids,
   inclusief hardwaretests en de eerste end-to-end-verkoop
5. **Maandelijkse routine** — licentieverlengingen, back-upcheck, docs-site

Escalatiepad: geprinte spiekbriefjes → de in-app Help → docs-site →
supportlijn van de partner → ITSea.

## 5. Livegang-poort (alle vinkjes, elke winkel)

☐ Licentie actief en gevalideerd ☐ Dagkoers van vandaag vergrendeld
☐ Testverkoop geprint + gemaild ☐ Lade opent ☐ Scanner leest schapproduct
☐ Weegschaal-indeling geverifieerd op *hun* weegschaal (indien gebruikt)
☐ Wallet-QR zichtbaar op de kassa ☐ Offline stekkertest geslaagd
☐ Z-rapport gesloten + gesynct naar HQ
☐ Back-up draaide vannacht **en de restore-oefening van deze maand slaagde**
☐ Demo-/seedwachtwoorden geroteerd ☐ Manager kan de docs-site bereiken
