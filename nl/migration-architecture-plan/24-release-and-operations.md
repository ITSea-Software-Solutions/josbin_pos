# 24. Releasebeheer, operatie en naleving

Hoofdstuk 23 zegt dat een klant een ondertekende image krijgt. Dit hoofdstuk gaat
over hoe die image ontstaat, hoe die veilig bij de klant komt, en wat er in het
nalevingspapierwerk verandert zodra er drie knooppunten zijn in plaats van één.

Het is het minst spannende hoofdstuk van het plan, en het hoofdstuk waarvan het
ontbreken het meest opvalt bij een overheidsklant.

---

## 24.1 Releases worden door CI gebouwd, niet op een laptop

Vandaag draaien vier workflows tests. **Geen enkele levert een artefact op.** Elke
`.exe`, elke `.apk`, elke uitgerolde bundel wordt op een ontwikkelmachine gebouwd
en van daaraf verstuurd.

Dat heeft al een release gekost. De APK van versie 1.7.0 bevatte een verouderde
webbundel doordat een lokale buildstap stil faalde en het inpakken gewoon
doorging — het artefact zag er goed uit, was ondertekend, werd geïnstalleerd, en
bevatte de schermen van de vorige versie.

```
   commit ──► CI ──► build ──► test ──► SBOM ──► ondertekenen ──► register (op digest)
                                                            │
                                                            ├─► onze droplet
                                                            ├─► pull uit register, voor winkels mét internet
                                                            └─► docker save → USB, voor winkels zónder
```

Wat er verandert:

- **Elk artefact wordt in CI gebouwd**, vanaf een getagde commit, anders is het
  geen release.
- **Een SBOM per release** (CycloneDX), meegeleverd bij de release. Wordt steeds
  vaker gevraagd bij overheidsaanbestedingen, en kost bijna niets zodra de
  pijplijn er is.
- **Herkomst**: de build legt vast welke commit, welke workflow-run, welke invoer.
  "Welke code draait deze winkel" wordt beantwoordbaar vanuit een digest.
- **Artefactcontrole is een buildstap, geen gewoonte.** Het bestaande
  `verify-artifacts.sh` — dat de echte `.apk`/`.asar` uitpakt en zoekt naar
  markeringen die aanwezig moeten zijn — wordt een verplichte CI-poort in plaats
  van iets wat iemand zich herinnert nadat hij zich een keer heeft gebrand.

Ook los van de opsplitsing de moeite waard om te beëindigen: broncode inkoppelen
in productie én `git reset --hard` op de server betekenen allebei dat de draaiende
code geen vastgezet, reproduceerbaar artefact is, en dat je er niet precies naar
terug kunt rollen.

---

## 24.2 Het updatekanaal is een aanvalspad

Nergens staat op dit moment hoe een winkelknooppunt een update krijgt zodra het
achter iemands toonbank staat. Dat is het waardevolste doelwit in het hele
systeem: wie dat compromitteert bereikt in één keer elke winkel, met onze naam op
het pakket.

- **Images ondertekend** (cosign), **door het knooppunt gecontroleerd vóór
  installatie**. Die controle moet vanuit een bestand werken, zodat het USB-pad
  geen omweg is — dezelfde eigenschap die hoofdstuk 22 van payloads eist.
- **Vastgezet op digest, nooit op een meebewegende tag.** `:latest` betekent "wat
  het register vandaag zegt", en dat is precies wat een aanvaller wil dat het
  betekent.
- **Gefaseerde uitrol**: eerst onze eigen droplet, dan een proefwinkel, dan de
  vloot. Bij 200 winkels hoort een slechte release er één te raken, niet alle.
- **Een gedocumenteerde terugrol voor de applicatie, en een voorwaartse oplossing
  voor de database.** De image van gisteren kun je terugzetten; een migratie in het
  veld kun je niet ongedaan maken. Die asymmetrie is waarom §24.4 bestaat.

---

## 24.3 De verbindingen hebben eigen tests nodig

De kenmerkende storing van de opsplitsing is geen crash. Het is beheer en winkel
die het stilletjes oneens zijn over wat een payload betekent, zes weken uit elkaar,
zonder test die het had kunnen merken.

- **Vaste voorbeeldpayloads per schemaversie**, bij het contract in
  `domain/Contracts/`. Eén bestand per verbinding per versie.
- **Beide kanten testen tegen die voorbeelden**, niet tegen elkaars draaiende
  code: de opbouwer in de winkel moet ze produceren, de inname bij beheer moet ze
  accepteren.
- **Een versiematrix in CI** die de belofte van §19.6 bewijst: build N neemt
  voorbeelden van N, N−1 en N−2 aan. Die belofte is nu proza, en proza laat geen
  build falen.
- Een voorbeeld wordt **toegevoegd vóór** de code die een payload wijzigt, net
  zoals §24.7 wil dat een BTW-vector vóór een tariefwijziging komt.

Dit is de concrete reden dat het ontbrekende testpad (N16) eerst opgelost moet
worden. De poort bij stap 1 is "suite groen, geen test aangepast" — en er is
nergens om hem te draaien.

---

## 24.4 Migraties: eerst uitbreiden, daarna opruimen

Drie databases die op eigen schema's bijwerken, op machines die niet van ons zijn,
zonder realistische manier om een schema in een winkel terug te draaien.

**Alleen vooruit, en nooit iets weggooien in dezelfde release als de
codewijziging:**

1. **Uitbreiden** — voeg de nieuwe kolom of tabel toe. Oude code negeert hem,
   nieuwe code schrijft hem. Uitrollen. Beide versies draaien probleemloos naast
   elkaar.
2. Vullen, controleren.
3. **Opruimen** — een *latere* release verwijdert de oude kolom, zodra elk
   knooppunt in de vloot de uitbreidingsrelease voorbij is.

Omdat de vloot permanent meerdere versies omvat, is de voorwaarde voor de
opruimstap een controle over de hele vloot, geen datum op de kalender: het
statusregister van knooppunten (N11) moet zeggen dat niemand nog op het oude schema
zit.

**Elke stap in hoofdstuk 20 heeft vóór aanvang een geschreven terugrolcriterium
nodig** — wat ons precies zou doen stoppen, en wat we dan doen. Een poort die
alleen zegt hoe "klaar" eruitziet, is een halve poort.

---

## 24.5 Wat we beloven als het misgaat

Geen van deze getallen bestaat vandaag, en overheidsaanbestedingen vragen er
rechtstreeks naar. Voorgesteld, om vast te stellen in plaats van aan te nemen:

| Knooppunt | RPO — hoeveel gegevens mogen weg | RTO — hoe snel weer draaiend | Hoe |
|---|---|---|---|
| **Winkel (pc)** | ≤ 24u | ≤ 4u met een reserve-pc | Nachtelijk versleuteld archief + lokale back-up; gedocumenteerde restore |
| **Winkel (zelfstandig Android)** | ≤ 1 dienst | ≤ 2u op een vervangend apparaat | Archief na elk Z-rapport (§23.9) |
| **Beheer** | ≤ 15 min | ≤ 2u | Postgres WAL, point-in-time recovery, al aanwezig |
| **Belasting** | ≤ 15 min | ≤ 4u | Idem, plus een aangiftewachtrij die opnieuw kan worden afgespeeld |

Een getal dat niemand geoefend heeft, is een gok. Elk getal vraagt om een restore
die daadwerkelijk is uitgevoerd en geklokt — de bestaande maandelijkse
restoretest is de juiste gewoonte, uitgebreid naar elk knooppunt en naar een
zelfstandig apparaat.

---

## 24.6 De nalevingsdocumenten veranderen van vorm

Er bestaan drie documenten: een incidentresponsplan, een OWASP Top 10-beoordeling
en de verwerkersovereenkomst met haar bewaartermijnentabel. Ze beschrijven **één
installatie**, en het incidentresponsplan noemt knooppunten helemaal niet.

Ze blijven kloppen voor het opgeleverde product en mogen niet worden aangepast om
een architectuur te beschrijven die niet bestaat. De versies van ná de opsplitsing
staan hier, en vervangen de levende documenten op de dag dat de opsplitsing
uitkomt.

**Wat er werkelijk verandert:**

- **Wie is getroffen, en wie meldt aan wie.** Een inbreuk in een winkelknooppunt
  betreft de gegevens van de winkel, op de machine van de winkel, met ons als
  leverancier. Een inbreuk in het beheerknooppunt betreft onze systemen en hun
  afgeleide gegevens. Een inbreuk in het belastingknooppunt betreft een
  overheidssysteem **dat wij als verwerker beheren** — D3 zet ons in een rol die we
  nooit eerder hadden, met meldplichten richting de Belastingdienst binnen een
  termijn.
- **Bewaartermijnen worden per knooppunt en per gegevenssoort.** De winkel bewaart
  de volledige verkoophistorie voor de wettelijke termijn; beheer bewaart totalen
  onbeperkt en persoonsgegevens nooit; belasting bewaart aangiften onder eigen
  wettelijke regels; archieven hebben een eigen termijn en eigen verwijdering. Eén
  tabel kan dat niet beschrijven.
- **De OWASP-beoordeling verdrievoudigt in omvang**, en de pentest ermee — zie
  §24.7.
- **De verwerkersovereenkomst krijgt een tweede relatie.** Vandaag dekt zij
  commerciële klanten. Na D3 komt er een tweede verwerkersovereenkomst, met de
  Belastingdienst, over een systeem dat wij voor hen hosten — inclusief
  onderhoudstoegang op naam, gelogd en in tijd begrensd, in plaats van een
  permanent beheerdersaccount.

---

## 24.7 De goedkope punten, die geen van alle bestaan

Stuk voor stuk klein. Samen zijn ze het grootste deel van wat een
beveiligingsvragenlijst uitvraagt.

| | Wat | Waarom nu |
|---|---|---|
| **Pentest-omvang** | Test de **verbindingen**, niet alleen de twee interfaces: vervals een totaalbericht, speel er een opnieuw af, doe aangifte voor een ander BTW-nummer, knoei met een archief | Een pentest van het al geharde deel bewijst het minst |
| **Afhankelijkhedenbeleid** | Dependabot of Renovate, plus een vastgelegde patchtermijn per ernst | De afhankelijkhedenaudit was eenmalig; actualiteit verloopt vanaf de dag dat hij draaide |
| **Open-source-vermelding** | Een NOTICE-bestand in elk installatieprogramma | Laravel en node-modules meeleveren brengt vermeldingsplichten mee. IonCube-encodering heft die niet op |
| **`security.txt`** | RFC 9116, op de publieke site | Een onderzoeker zonder meldkanaal publiceert het in plaats daarvan |
| **Geen persoonsgegevens in logs** | Een expliciete regel, plus een CI-controle op logregels | WBP-S. Een klantnaam in een logbestand is een kopie van persoonsgegevens die niemand heeft geïnventariseerd |
| **Klokdiscipline** | NTP op het knooppunt; elke klokaanpassing naar het auditlog | "Hoe laat vond deze verkoop plaats" is juridisch relevant in een fiscaal systeem, en §19.3 houdt de monotone servertijd al bij voor licenties |
| **BTW-vectoren** | §23.8 — één vectorbestand, drie testrunners | Het risico op uiteenlopen zit **vandaag** in het opgeleverde product |

---

## 24.8 Fiscalisering: wees er klaar voor, bouw het nog niet

Verschillende landen certificeren kassasoftware rechtstreeks — het Duitse
KassenSichV vereist een manipulatiebestendige technische beveiligingsvoorziening,
het Franse NF525 vereist gecertificeerde onveranderlijkheid van verkoopgegevens.
**Suriname kent zo'n eis niet**, en bouwen voor een eis die niet bestaat zou
speculatief zijn.

Maar de vorm van het product is er al grotendeels: een alleen-toevoegen-auditlog
met een SHA-256-hashketen, aaneengesloten verkoopnummering per vestiging,
onveranderlijke Z-rapporten, en — na hoofdstuk 22 — aangiften die door de winkel
zijn ondertekend en aan de vorige aangifte zijn geketend.

De houding om aan te nemen, en hardop tegen de Belastingdienst te zeggen: **als
Suriname certificering invoert, is dit een conformiteitsoefening en geen herbouw.**
Dat is een concurrentiepositie die het waard is om op papier te hebben, en het kost
niets om die te behouden zolang niemand de keten uit gemak verzwakt.

---

## 24.9 Wat gebouwd moet worden

Bovenop N1–N36:

| # | Te bouwen | Waar |
|---|---|---|
| N37 | Release-pijplijn in CI — bouwen, testen, SBOM, ondertekenen, publiceren op digest | Build |
| N38 | `verify-artifacts.sh` verheven tot verplichte CI-poort | Build |
| N39 | Updatekanaal ondertekenen + controle aan knooppuntzijde, inclusief de offlinebundel | 🏪 + ☁️ |
| N40 | Gefaseerde uitrol: droplet → proefwinkel → vloot | ☁️ Control |
| N41 | Contractvoorbeelden per verbinding + N−2-versiematrix in CI | Build |
| N42 | Uitbreiden/opruimen als migratiediscipline + schemacontrole over de vloot vóór opruimen | Alle |
| N43 | Terugrolcriterium beschreven voor elk van de zeven stappen in hoofdstuk 20 | Plan |
| N44 | RTO/RPO vastgesteld, en een geoefende restore per knooppunt | Operatie |
| N45 | Incidentresponsplan, bewaartermijnen en verwerkersovereenkomst herschreven per knooppunt | Naleving |
| N46 | Pentest gericht op de verbindingen | Naleving |
| N47 | Afhankelijkhedenbeleid, OSS-NOTICE, `security.txt`, controle op persoonsgegevens in logs | Build |
| N48 | NTP-discipline + klokaanpassingen in het auditlog | 🏪 Shop |

N37, N38 en de BTW-vectoren uit §23.8 zijn de drie die het waard zijn om **vóór**
stap 1 van het bouwplan te doen. Elk van drieën repareert iets dat nu al fout is.
