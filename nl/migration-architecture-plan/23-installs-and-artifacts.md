# 23. Eén repository, veel artefacten — wat er werkelijk geïnstalleerd wordt

Hoofdstuk 20 legde vast dat de drie knooppunten in **één repository** wonen. Dit
hoofdstuk beantwoordt de vraag die daar meteen op volgt: als het één repository
is, wat krijgt een klant dan werkelijk?

Niet de repository. Nooit de repository.

---

## 23.1 Drie vormen die een winkel kan hebben

<svg viewBox="0 0 700 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three shop setups: a single Android terminal running standalone, a small shop with a Windows PC running the node and two tills as clients, and a supermarket with a dedicated server and many tills" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- A: kiosk -->
  <rect x="14" y="34" width="205" height="250" rx="11" fill="#ffffff" stroke="#EF6C00" stroke-width="2.5"/>
  <text x="116" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">A · One till, no PC</text>
  <rect x="66" y="52" width="102" height="128" rx="9" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="117" y="76" text-anchor="middle" font-size="24">📱</text>
  <text x="117" y="100" text-anchor="middle" font-size="11.5" font-weight="700" fill="#111827">Android terminal</text>
  <text x="117" y="120" text-anchor="middle" font-size="10.5" fill="#b35400">IS the shop node</text>
  <text x="117" y="137" text-anchor="middle" font-size="10.5" fill="#6b7280">own database</text>
  <text x="117" y="154" text-anchor="middle" font-size="10.5" fill="#6b7280">on the device</text>
  <text x="117" y="171" text-anchor="middle" font-size="10.5" fill="#6b7280">printer over USB</text>
  <text x="116" y="204" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ sells with nothing else</text>
  <text x="116" y="221" text-anchor="middle" font-size="10.5" fill="#6b7280">market stall · kiosk</text>
  <text x="116" y="238" text-anchor="middle" font-size="10.5" fill="#6b7280">one-person shop</text>
  <rect x="30" y="250" width="173" height="24" rx="6" fill="#fdecdc"/>
  <text x="116" y="266" text-anchor="middle" font-size="10" fill="#b35400">single till only — see §23.10</text>

  <!-- B: small shop -->
  <rect x="240" y="34" width="205" height="250" rx="11" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="342" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">B · A PC in the back</text>
  <rect x="262" y="52" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.4"/>
  <text x="298" y="72" text-anchor="middle" font-size="16">📱</text>
  <text x="298" y="90" text-anchor="middle" font-size="9.5" fill="#111827">till</text>
  <rect x="350" y="52" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.4"/>
  <text x="386" y="72" text-anchor="middle" font-size="16">🖥</text>
  <text x="386" y="90" text-anchor="middle" font-size="9.5" fill="#111827">till</text>
  <line x1="298" y1="100" x2="330" y2="140" stroke="#293371" stroke-width="1.6"/>
  <line x1="386" y1="100" x2="354" y2="140" stroke="#293371" stroke-width="1.6"/>
  <text x="342" y="119" text-anchor="middle" font-size="9.5" fill="#6b7280">shop LAN</text>
  <rect x="270" y="142" width="145" height="66" rx="9" fill="#293371"/>
  <text x="342" y="164" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">🗄 Any Windows PC</text>
  <text x="342" y="182" text-anchor="middle" font-size="10.5" fill="#c9d2ee">Docker · shop node</text>
  <text x="342" y="199" text-anchor="middle" font-size="10.5" fill="#c9d2ee">the books live here</text>
  <text x="342" y="228" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ tills are thin clients</text>
  <text x="342" y="248" text-anchor="middle" font-size="10.5" fill="#6b7280">2–5 tills · today's model</text>
  <text x="342" y="265" text-anchor="middle" font-size="10.5" fill="#6b7280">shop · bakery · pharmacy</text>

  <!-- C: supermarket -->
  <rect x="466" y="34" width="220" height="250" rx="11" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="576" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">C · Dedicated server</text>
  <rect x="482" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="511" y="78" text-anchor="middle" font-size="15">🖥</text>
  <rect x="548" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="577" y="78" text-anchor="middle" font-size="15">🖥</text>
  <rect x="614" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="643" y="78" text-anchor="middle" font-size="15">🖥</text>
  <text x="576" y="108" text-anchor="middle" font-size="9.5" fill="#6b7280">6–20 tills + manager screens</text>
  <line x1="576" y1="114" x2="576" y2="142" stroke="#1f6b3b" stroke-width="1.6"/>
  <rect x="496" y="144" width="160" height="64" rx="9" fill="#1f6b3b"/>
  <text x="576" y="166" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">🗄 Server box</text>
  <text x="576" y="184" text-anchor="middle" font-size="10.5" fill="#cfe0d5">same shop node image</text>
  <text x="576" y="201" text-anchor="middle" font-size="10.5" fill="#cfe0d5">UPS · nightly archive</text>
  <text x="576" y="230" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ same software as B</text>
  <text x="576" y="250" text-anchor="middle" font-size="10.5" fill="#6b7280">bigger box, more tills</text>
  <text x="576" y="267" text-anchor="middle" font-size="10.5" fill="#6b7280">supermarket · government</text>

  <text x="350" y="308" text-anchor="middle" font-size="11" fill="#6b7280">B and C are the same install on different hardware. A is a different thing — the node runs ON the till.</text>
  <text x="350" y="324" text-anchor="middle" font-size="10.5" font-weight="600" fill="#111827">All three sell with no internet. All three sync and file when they have it.</text>
</svg>

| | Voor wie | Winkelknooppunt draait op | Kassa's |
|---|---|---|---|
| **A · Zelfstandig** | Marktkraam, kiosk, eenmanszaak | **De Android-terminal zelf** | 1, en dat is hetzelfde apparaat |
| **B · Kleine winkel** | 2–5 kassa's, geen IT-personeel | Elke Windows-pc met Docker | Android en/of Electron, dunne clients |
| **C · Supermarkt** | 6+ kassa's, overheid | Een aparte machine met UPS | Dezelfde clients als B |

B en C zijn dezelfde software op andere hardware, en dat is wat vandaag bestaat.
**A bestaat nog niet** en is het grootste losse onderdeel van dit hele plan.

---

## 23.2 Wat een klant krijgt — een image, geen repository

Vandaag zet `deploy-server.sh` de backend-code op de server met `git fetch &&
git reset --hard`, en de container koppelt de broncode in. Voor onze eigen droplet
is dat acceptabel. Het mag nooit de manier zijn waarop een winkel geïnstalleerd
wordt: het zou de hele repository — beheerknooppunt, licentieserver en al — op een
machine achter iemands toonbank zetten, precies wat
[§20.1](/nl/migration-architecture-plan/20-split-build-plan) zegt te vermijden.

**De repository is een ontwikkelartefact. De image is het product.**

```
one repository
      │
      ├── CI bouwt drie images, elk uit een eigen buildcontext
      │      shop    = domain/ + nodes/Shop      IonCube-geëncodeerd, ondertekend
      │      control = domain/ + nodes/Control
      │      tax     = domain/ + nodes/Tax
      │
      ├── ondertekend, naar een privéregister, aangeduid met DIGEST
      │
      └── de winkel krijgt:   docker-compose.yml  +  .env  +  image@sha256:…
                              docker compose pull && docker compose up -d

          geen git · geen broncode · geen composer · geen buildgereedschap
```

De winkel-image kán `nodes/Control` niet bevatten, want die bestanden zaten nooit
in de buildcontext. Dat is controleerbaar in plaats van beloofd, en de poort bij
stap 6 in hoofdstuk 20 is precies die controle: doorzoek het gebouwde artefact op
elk Control-pad en laat de build falen als het er is.

**Voor een winkel zonder bruikbaar internet** is er aan winkelzijde helemaal geen
register nodig:

```
docker save josbin/shop@sha256:… -o josbin-shop-1.9.0.tar     ← bij ons
… USB-stick, naast het installatieprogramma …
docker load -i josbin-shop-1.9.0.tar                          ← bij de winkel
```

Hetzelfde ondertekende artefact, offline. Dezelfde vorm als laag 4 van de
synchronisatie, waar het product al op leunt.

---

## 23.3 Hoe het team het kloont en draait

Ontwikkelaars klonen die ene repository en krijgen alles — dat is de bedoeling.

```
git clone …/josbin_pos && cd josbin_pos
cp .env.example .env
docker compose up -d              # alle drie de knooppunten in één installatie
```

Tijdens stap 1 tot en met 3 van het bouwplan valt er niets te kiezen: de app start
als één installatie, precies zoals nu. Vanaf stap 3 bepaalt een knooppuntprofiel
welke routes worden geregistreerd, welke migraties draaien en welke modules laden:

```
JOSBIN_NODE=all       # standaard — de ontwikkelvorm, alles in één
JOSBIN_NODE=shop      # wat een winkel draait
JOSBIN_NODE=control   # wat wij draaien
JOSBIN_NODE=tax       # wat het exemplaar van de Belastingdienst draait
```

`all` blijft voor altijd de standaard, want een ontwikkelaar die drie omgevingen
moet starten om een bug na te spelen, gaat bugs niet meer naspelen.

---

## 23.4 Op Windows zijn het knooppunt en de kassa twee aparte installaties

Dit verwart mensen, dus zeg het gewoon. In opstelling B draait vaak één pc allebei,
maar het zijn losstaande artefacten:

| Artefact | Wat het is | Bevat |
|---|---|---|
| **Docker-stack** | Het winkelknooppunt — de server, de database, de boeken | Geëncodeerde PHP, Postgres, Redis |
| **`Josbin POS.exe`** | Een kassa. Een client, meer niet | React-interface, wijst naar een server-URL |

De `.exe` bevat het knooppunt nooit. Hem verwijderen kost niets; de boeken staan in
Docker. Hem opnieuw installeren op een andere pc en naar hetzelfde LAN-adres wijzen
is vijf minuten werk — precies wat je wilt als een kassa op zaterdagmiddag
uitvalt.

---

## 23.5 Op Android: één APK met twee standen

De huidige app is Capacitor: de React-interface in een WebView, die via HTTP met
een winkelknooppunt praat. Hij leest zijn serveradres al tijdens het draaien
(`serverConfig.ts`, `ServerConfigModal`, LAN-ontdekking), dus een kassa
omzetten is een instelling, geen nieuwe build. **Die client blijft precies zoals
hij is** — dat is wat opstelling B en C draaien, en het werkt.

De zelfstandige stand breidt diezelfde keuze uit:

```
Eerste start →  Waar staan uw gegevens?
              ○ Een server op dit netwerk     → clientstand  (opstelling B en C)
                  [ Zoek mijn server ]  of  http://192.168.1.20:8080
              ○ Op dit apparaat               → zelfstandig  (opstelling A)
```

**Eén APK, beide standen.** Geen twee apps — en dat komt uit de geschiedenis van
dit project zelf: twee APK's die op elkaar lijken leveren precies de vraag in het
veld die ons al een dag heeft gekost, *welke build staat er nu eigenlijk op deze
terminal?* Eén artefact, één versienummer, de stand zichtbaar in Instellingen en
in het profielmenu. In de clientstand start het knooppunt op het apparaat
simpelweg nooit.

---

## 23.6 De zelfstandige stand is nieuwe functionaliteit, geen schakelaar

Wees eerlijk over de omvang hiervan. Vandaag is de kassa een **dunne client**: geen
lokale database, niets in de wachtrij. Elke verkoop gaat naar het winkelknooppunt,
en een kassa die haar knooppunt niet bereikt, kan niet verkopen. De vijflaagse
terugval is het *knooppunt* dat richting onze cloud in de wachtrij zet — het is
nooit de *kassa* geweest die richting het knooppunt wacht.

De zelfstandige stand is dus geen vlag over bestaande code. Het is het
servergedrag van het winkelknooppunt, opnieuw gebouwd om op het apparaat te
draaien:

| Onderwerp | Opstelling B (vandaag) | Opstelling A (zelfstandig) |
|---|---|---|
| Database | Postgres in Docker | **Room / SQLite op het apparaat** |
| Verkoop-, kassa- en Z-rapportlogica | Laravel | **Native Kotlin op het apparaat** |
| BTW-berekening | `BtwCalculationService` | **Zie §23.8 — het lastige deel** |
| Synchronisatie op de achtergrond | Laravel-wachtrij + planner | **WorkManager + voorgrondservice** |
| Privésleutel van het knooppunt (h22) | Een bestand op een leesbare schijf | **Android Keystore — hardwarematig** |
| Printer, lade, scanner | USB vanaf de kassa | Ongewijzigd — al native Java |
| Licentie | Ondertekend token, offline gecontroleerd | Idem, vingerafdruk = Android-ID + installatie-UUID |
| Aangifte- en synccliënten | Op het knooppunt | Dezelfde contracten, draaiend op het apparaat |
| NL / EN / Sranantongo | Ongewijzigd | Ongewijzigd |

Wat de zelfstandige stand bewust **niet** krijgt: meerdere kassa's. Een
Android-apparaat is een slechte server voor andere kassa's — het besturingssysteem
kan het in slaap zetten, het netwerk laten vallen of het proces beëindigen. Een
winkel die een tweede kassa nodig heeft, gaat naar opstelling B. Zie §23.10.

---

## 23.7 Wat native wordt, en wat React blijft

De vraag was een volledige app in Java/Kotlin bovenop de WebView-client. De
richting klopt; de grens hoort op een specifieke plek te liggen: **maak het
knooppunt native, houd de interface gedeeld.**

| Laag | Taal | Waarom |
|---|---|---|
| Knooppunt: database, verkoop-/kassa-/Z-rapportlogica, sync, aangifte, licentie, sleutelopslag | **Kotlin** | Vereist Room, WorkManager, een voorgrondservice en de Keystore. Niets daarvan is bereikbaar vanuit een WebView, en het moet allemaal overleven dat het OS je app als inactief bestempelt. |
| Hardware: printer, lade, scanner | **Java/Kotlin** | Is het al — `UsbPrinterPlugin` |
| Interface: kassaschermen, instellingen, rapporten, bonnen, drie talen | **React, in de WebView** | Eén codebase voor Electron, web en Android. Herbouwen in Compose dupliceert 43 kassafuncties plus instellingen en rapporten, voor een team zonder Android-ontwikkelaar. |

In de zelfstandige stand praat de React-interface met het native knooppunt via de
Capacitor-brug in plaats van via HTTP. Dat is dezelfde client-servervorm als
opstelling B, samengevouwen op één apparaat, met de brug waar eerst het LAN zat. De
schermen merken het verschil niet, en juist dat maakt ze herbruikbaar.

**Het sterkste argument om native te gaan is niet snelheid — het is de Keystore.**
[§22.7](/nl/migration-architecture-plan/22-node-authentication) moet toegeven dat de
privésleutel op een Windows-pc op een leesbare schijf staat en dat we hooguit de
schade kunnen begrenzen. Op Android kan een Keystore-sleutel met StrongBox- of
TEE-ondersteuning **helemaal niet van het apparaat worden gehaald**. Een zelfstandig
Android-knooppunt is daarmee de veiligste opstelling in het product, niet de
zwakste — en dat is het waard om tegen een overheidsklant te zeggen.

**Over de interface óók native herbouwen:** daar is op dit moment geen bewijs voor.
De traagheid die vanaf de winkelvloer werd gemeld, is onderzocht en verholpen, en
de oorzaak was een scannerinvoer die de focus wegnam — niet het renderen van de
WebView. Blijkt later uit meting dat een specifiek scherm op de terminal echt te
traag is — het productraster is de waarschijnlijkste kandidaat — bouw dán dát scherm
in Compose achter dezelfde brug. Alles vooraf herbouwen besteedt de volledige
capaciteit van het team aan een probleem dat niet is aangetoond.

---

## 23.8 De BTW-engine in drie talen — het echte probleem

Hoofdstuk 20 zegt dat de BTW-engine **één keer** mag bestaan, omdat drie
exemplaren uiteenlopen en een verschil van één cent tussen een bon en een aangifte
een nalevingsincident is. De zelfstandige stand lijkt daar direct mee in strijd:
PHP kan niet op de terminal draaien, dus moet de berekening ook in Kotlin bestaan
— en in TypeScript overal waar de kassabon een lopend totaal toont.

**Dat is al zo.** `frontend/src/store/cartStore.ts` doet vandaag korting-dan-BTW,
met 24 vitest-gevallen, naast `BtwCalculationService` in de backend met 56
PHPUnit-gevallen. Twee implementaties, apart getest, nooit tegen elkaar. Op dit
moment is dat te overleven omdat de backend herberekent en wint — het getal in de
interface is alleen wat de kassamedewerker ziet tijdens het aanslaan.

In de zelfstandige stand is er geen backend die iets corrigeert: **het getal op
het apparaat wordt de boekhouding.** Met een native knooppunt is dat het getal van
Kotlin, en dat maakt drie implementaties van dezelfde belastingregel — PHP,
TypeScript, Kotlin.

Erger nog: ze rekenen niet hetzelfde. De backend gebruikt overal bcmath-strings.
De cart store gebruikt JavaScript-floats en `Math.min`. Die zijn het over bijna elk
mandje eens en over sommige niet — en dat wordt maanden later een jacht op
afrondingsverschillen in de maandaangifte van een winkel, met de Belastingdienst
die wacht.

**De oplossing is een gedeelde conformiteitssuite, geen gedeelde taal.**

- Eén canonieke set BTW-vectoren — invoer en exact verwachte uitvoer — in
  `domain/Btw/vectors/`, meeversioneerd met de engine.
- **Elke** implementatie draait ze in CI: PHPUnit, vitest én JUnit lezen hetzelfde
  bestand. Een vector die in de ene taal slaagt en in de andere faalt, laat de
  build falen. Dit is wat een derde implementatie draaglijk maakt in plaats van
  roekeloos.
- De TypeScript-kant stapt over op decimale rekenkunde (`decimal.js` of bigint in
  centen) in plaats van floats, zodat ze het überhaupt eens kunnen zijn.
- Nieuw tarief, nieuwe vrijstelling, nieuwe kortingsregel → **eerst een nieuwe
  vector**, daarna de implementaties.

Daarmee wordt "één keer geschreven" van een uitspraak over een plek een uitspraak
over **gedrag**, en dat is wat werkelijk telt. Het is de moeite waard of de
zelfstandige stand er nu komt of niet, want de tweede implementatie bestaat al en
is al ongetest tegen de eerste.

Wil je letterlijk één implementatie, dan is de optie de domeinkern naar
WebAssembly compileren en vanuit beide runtimes aanroepen. Dat lost het echt op, en
het kost meer dan de conformiteitssuite aan buildcomplexiteit, personeel en
debugbaarheid. De aanbeveling is: nu vectoren, WASM alleen als de vectoren
verschillen blijven vinden. Met drie talen in het spel wordt het argument voor WASM
sterker, en het is het punt om te herzien als Kotlin en PHP uit elkaar gaan lopen.

---

## 23.9 Op een tablet ís het apparaat de boekhouding

In opstelling A staat de volledige handelsgeschiedenis van de winkel op een
terminal die kan vallen, gestolen worden, teruggezet worden naar fabrieksinstellingen
of meegenomen worden door een vertrekkende medewerker. Dat is wezenlijk slechter
dan een pc in een achterkamer, en de installatie moet dat zo behandelen:

- **Versleuteld archief na elk Z-rapport**, niet alleen 's nachts — het verlies mag
  hooguit één dienst beslaan, geen hele dag.
- **Uploaden zodra er enige verbinding is**, ook een hotspot van een telefoon. De
  payload is klein; opportunistisch volstaat.
- **Volledige schijfversleuteling van Android verplicht**, plus een toegangscode
  afgedwongen bij de installatie. De kassa weigert de zelfstandige stand zonder.
- **App-eigen opslag**, nooit externe mappen of cache, zodat Android bij weinig
  ruimte de database niet kan opruimen.
- **Zeg het hardop in de installatiegids en op het scherm**: dit apparaat ís uw
  boekhouding. De USB-export bestaat en een winkelier hoort te weten hoe die werkt.

---

## 23.10 Licentie: zelfstandig is één kassa, en er is een uitweg

Een zelfstandig knooppunt is een winkelknooppunt. Twee zelfstandige tablets in één
winkel zouden **twee knooppunten, twee databases, twee gescheiden boekhoudingen**
zijn — geen gecombineerd Z-rapport, geen enkele BTW-aangifte, en voor het
beheerknooppunt twee organisaties. Dat is geen configuratiefout om te documenteren;
het is een beperking die de licentie afdwingt.

- Het licentietoken draagt de stand van het knooppunt. Zelfstandige tokens worden
  uitgegeven voor **één terminal**.
- Een tweede zelfstandig knooppunt activeren onder dezelfde organisatie wordt door
  het beheerknooppunt geweigerd, met een melding die zegt wat men wél moet doen.
- **De uitweg is een ondersteunde migratie**, geen herbouw: exporteer het
  versleutelde archief van het apparaat, installeer opstelling B op een pc,
  importeer, en zet de tablet om naar client. De tablet houdt zijn gegevens tot de
  import is gevalideerd. Dit pad moet bestaan vóór de zelfstandige stand uitkomt,
  want juist de winkels die A kiezen groeien door naar B.

---

## 23.11 Wat gebouwd moet worden

Bovenop N1–N24:

| # | Te bouwen | Waar |
|---|---|---|
| N25 | Drie Dockerfiles / buildcontexten + release-taak in CI | Build |
| N26 | Images ondertekenen, vastzetten op digest, offlinebundel via `docker save` | Build |
| N27 | Artefactcontrole: winkel-image bevat geen Control-code | Build |
| N28 | Knooppuntprofiel (`JOSBIN_NODE`) — routes, migraties, modules | Alle |
| N29 | **BTW-conformiteitsvectoren**, gedraaid door PHPUnit, vitest *én* JUnit | Build |
| N30 | Decimale rekenkunde in het geldpad van de interface (floats eruit) | 🏪 Shop |
| N31 | Schema + migraties op het apparaat (Room) | 📱 Kotlin |
| N32 | Verkoop-, kassa- en Z-rapportlogica op het apparaat | 📱 Kotlin |
| N32b | Brug-API — de client van de React-interface, gericht op het native knooppunt | 📱 Kotlin + UI |
| N32c | Knooppuntsleutel in de Android Keystore (StrongBox/TEE waar aanwezig) | 📱 Kotlin |
| N32d | WorkManager-sync + voorgrondservice zodat het OS het niet stillegt | 📱 Kotlin |
| N33 | Zelfstandige stand: keuze bij eerste start, licentiebinding, standweergave | 📱 Kotlin + UI |
| N34 | Versleuteld archief per Z-rapport + opportunistisch uploaden | 📱 Kotlin |
| N35 | Aangifte- en synccliënten draaiend op het apparaat | 📱 Kotlin |
| N36 | Migratie zelfstandig → opstelling B (export, import, omzetten) | 📱 + ☁️ |

N29 en N30 zijn het waard om **nu** te doen, vóór de opsplitsing en vóór de
zelfstandige stand. Ze verhelpen een risico op uiteenlopen dat vandaag al in het
opgeleverde product zit.
