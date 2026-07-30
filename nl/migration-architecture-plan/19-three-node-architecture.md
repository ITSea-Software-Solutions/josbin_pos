# 19. Architectuur met drie knooppunten — winkel, beheer, belasting

Josbin POS is één product, geleverd als **drie onafhankelijke knooppunten**. Elk
knooppunt heeft een eigen database, een eigen installatie en een eigen reden van
bestaan. Ze praten met elkaar over smalle, geversioneerde verbindingen — nooit
door een database te delen.

Dit hoofdstuk is het contract daartussen. Het is een ontwerpdocument: lees het
vóór u code verplaatst, en wijzig het vóór u de verbindingen wijzigt.

---

## 19.1 De vorm

<svg viewBox="0 0 700 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Drie knooppunten: winkelknooppunt in de winkel, beheerknooppunt in de cloud, belastingknooppunt bij de Belastingdienst, met licentie-, synchronisatie- en aangiftepijlen ertussen" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- Winkelknooppunt -->
  <rect x="20" y="150" width="200" height="180" rx="12" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="176" text-anchor="middle" font-size="13.5" font-weight="700" fill="#111827">🏪 Winkelknooppunt</text>
  <text x="120" y="195" text-anchor="middle" font-size="11" fill="#6b7280">in de winkel, op hun pc</text>
  <line x1="36" y1="206" x2="204" y2="206" stroke="#e6ecf5" stroke-width="1.5"/>
  <text x="120" y="224" text-anchor="middle" font-size="11" fill="#111827">kassa's · verkopen · assortiment</text>
  <text x="120" y="242" text-anchor="middle" font-size="11" fill="#111827">kassasessies · klanten</text>
  <text x="120" y="260" text-anchor="middle" font-size="11" fill="#111827">eigen gebruikers</text>
  <rect x="36" y="274" width="168" height="24" rx="6" fill="#e9f7ef"/>
  <text x="120" y="291" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ verkoopt zonder internet</text>
  <text x="120" y="316" text-anchor="middle" font-size="10" fill="#6b7280">geen beheer- of licentiecode</text>

  <!-- Beheerknooppunt -->
  <rect x="265" y="40" width="180" height="150" rx="12" fill="#293371"/>
  <text x="355" y="66" text-anchor="middle" font-size="13.5" font-weight="700" fill="#ffffff">☁️ Beheerknooppunt</text>
  <text x="355" y="84" text-anchor="middle" font-size="11" fill="#c9d2ee">u host dit zelf</text>
  <line x1="281" y1="95" x2="429" y2="95" stroke="#4a5596" stroke-width="1.5"/>
  <text x="355" y="113" text-anchor="middle" font-size="11" fill="#ffffff">organisaties · licenties</text>
  <text x="355" y="131" text-anchor="middle" font-size="11" fill="#ffffff">vloot · geconsolideerd beeld</text>
  <text x="355" y="149" text-anchor="middle" font-size="11" fill="#ffffff">ondertekent licentietokens 🔑</text>
  <text x="355" y="173" text-anchor="middle" font-size="10" fill="#c9d2ee">privésleutel blijft hier</text>

  <!-- Belastingknooppunt -->
  <rect x="490" y="150" width="190" height="180" rx="12" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="585" y="176" text-anchor="middle" font-size="13" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <text x="585" y="195" text-anchor="middle" font-size="11" fill="#5b6b62">Belastingdienst</text>
  <line x1="506" y1="206" x2="664" y2="206" stroke="#cfe0d5" stroke-width="1.5"/>
  <text x="585" y="224" text-anchor="middle" font-size="11" fill="#0e1a14">alleen BTW-aangiften</text>
  <text x="585" y="242" text-anchor="middle" font-size="11" fill="#0e1a14">eigen database</text>
  <text x="585" y="260" text-anchor="middle" font-size="11" fill="#0e1a14">beeld over organisaties heen</text>
  <rect x="506" y="274" width="158" height="24" rx="6" fill="#e6efe9"/>
  <text x="585" y="291" text-anchor="middle" font-size="10.5" fill="#1f6b3b">geen commerciële gegevens</text>

  <!-- Licentie: beheer -> winkel -->
  <line x1="272" y1="140" x2="185" y2="180" stroke="#EF6C00" stroke-width="2.5"/>
  <polygon points="185,180 196,176 194,187" fill="#EF6C00"/>
  <text x="126" y="128" font-size="10.5" font-weight="600" fill="#EF6C00">ondertekende licentie 🔑</text>
  <text x="126" y="142" font-size="10" fill="#6b7280">activatie + verlenging</text>

  <!-- Synchronisatie: winkel -> beheer -->
  <line x1="205" y1="205" x2="290" y2="180" stroke="#293371" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="290,180 279,178 283,189" fill="#293371"/>
  <text x="212" y="232" font-size="11" font-weight="600" fill="#293371">sync ↑</text>
  <text x="212" y="246" font-size="10" fill="#6b7280">totalen, Z-rapporten</text>
  <text x="212" y="259" font-size="10" fill="#6b7280">geen klantgegevens</text>

  <!-- Aangifte: winkel -> belasting (rechtstreeks) -->
  <line x1="222" y1="300" x2="486" y2="300" stroke="#1f6b3b" stroke-width="2.5"/>
  <polygon points="486,300 475,296 475,305" fill="#1f6b3b"/>
  <text x="354" y="292" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1f6b3b">BTW-aangifte, ondertekend door de winkel</text>
  <text x="354" y="318" text-anchor="middle" font-size="9.5" fill="#6b7280">rechtstreeks — het beheerknooppunt zit niet in de bewijsketen</text>

  <!-- Bevestiging: belasting -> beheer -->
  <line x1="520" y1="150" x2="445" y2="110" stroke="#9aa3b8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <polygon points="445,110 456,110 452,119" fill="#9aa3b8"/>
  <text x="458" y="96" font-size="9.5" fill="#6b7280">alleen bevestiging</text>
  <text x="458" y="108" font-size="9.5" fill="#6b7280">ingediend j/n · ref · wanneer</text>
</svg>

Lees de pijlen, niet de vakken — de verbindingen zíjn de architectuur:

| Verbinding | Richting | Vervoert | Internet nodig |
|---|---|---|---|
| **Licentie** | beheer → winkel | Ondertekend token: limieten, einddatum, vingerafdruk | Alleen bij activatie en verlenging |
| **Sync** | winkel → beheer | Verkooptotalen, Z-rapporten, kassagebeurtenissen | Wanneer beschikbaar; anders in de wachtrij |
| **Aangifte** | winkel → belasting | BTW-aangifte, ondertekend door de winkel | Op het moment van aangifte |
| **Bevestiging** | belasting → beheer | Ingediend ja/nee, referentie, tijdstip — **geen bedragen** | Zo goed als mogelijk |

---

## 19.2 Wat elk knooppunt bezit

**Winkelknooppunt** — het enige dat een winkelier ooit installeert.

Bezit de kassa's, de verkopen, het assortiment, de voorraad, de kassasessies, de
klanten en de eigen gebruikersaccounts. Verkoopt onbeperkt zonder internet, omdat
er in het verkooppad niets over een verbinding gaat.

Het bevat **geen enkele beheercode**: geen licentie-uitgifte, geen rapportage over
organisaties heen, geen vlootbeheer. Die machine staat in het gebouw van iemand
anders, en wie hem in handen heeft, kan de schijf lezen. Code die u niet
meelevert, kan niemand lezen.

**Beheerknooppunt** — u host dit zelf, één exemplaar.

Organisaties, licenties, de vloot, het geconsolideerde beeld over de eigen
vestigingen van een klant. Bewaart de **ondertekensleutel** van de licentie, en
die verlaat dit knooppunt nooit.

**Belastingknooppunt** — het exemplaar van de Belastingdienst.

Alleen BTW-aangiften, in een eigen database. Het bevat nooit de commerciële
gegevens van een winkel: geen productregels, geen klanten, geen marges.

---

## 19.3 De licentie: ondertekend, offline gecontroleerd

Het vanzelfsprekende ontwerp is "de winkel vraagt onze server of de sleutel
geldig is". Bouw dat niet. Het gaat op twee manieren mis die echt tellen:

- Richt het knooppunt op een server die altijd ja zegt (één regel in het
  hosts-bestand), of
- blokkeer de aanroep en leef voor altijd in de respijtperiode.

**In plaats daarvan: het beheerknooppunt ondertekent, het winkelknooppunt
controleert.**

```
Beheerknooppunt                          Winkelknooppunt
───────────────                          ───────────────
privésleutel ─ondertekent─► LICENTIETOKEN ─► publieke sleutel (in de build)
                            ├ organisatie-id
                            ├ limiet vestigingen / kassa's
                            ├ tier
                            ├ expires_at
                            └ hash van de hardwarevingerafdruk
```

Bij elke start controleert het knooppunt de **signatuur** en de **einddatum** —
volledig zonder netwerk. Dat draait het vertrouwensmodel de goede kant op:

- Het token aanpassen in de eigen database van de winkel breekt de signatuur.
- De VM naar een tweede machine kopiëren breekt de vingerafdruk.
- Een nagemaakte server kan geen token maken zonder de sleutel om te ondertekenen.
- Offline werken werkt **volgens ontwerp**, de hele levensduur van het token, en
  niet bij de gratie van een respijttimer.

De netwerkaanroep gaat daarmee niet meer over geldigheid, maar over **verlenging
en intrekking**: een token met een latere einddatum ophalen en de
intrekkingslijst binnenhalen.

Twee details die u makkelijk overslaat en die later pijn doen:

- **Klokmanipulatie.** Bewaar de hoogste servertijd die ooit gezien is. Gaat de
  lokale klok daar achteruit voorbij, beschouw de licentie dan als verdacht.
- **De sleutel in de database is geen geheim.** Ga ervan uit dat de klant hem
  leest. Dat is prima — hij is ondertekend, niet verborgen. Wat nooit in de buurt
  van het winkelknooppunt mag komen, is de *privé*sleutel.

---

## 19.4 Activatie, eenmalig

```
1. U registreert de organisatie in het beheerknooppunt en geeft een licentiesleutel uit.
2. De winkel installeert het knooppunt. Bij de eerste start wordt om de sleutel gevraagd.
3. Het knooppunt roept het beheerknooppunt één keer aan: sleutel ──► ondertekend token.
4. Het knooppunt controleert de signatuur, bewaart het token, legt de vingerafdruk vast.
5. Het knooppunt maakt het eerste beheerdersaccount aan op basis van het e-mailadres
   in het token. Die beheerder stelt lokaal een wachtwoord in.
6. Setup klaar. Vanaf hier maakt de winkel zelf vestigingen, kassa's en gebruikers
   aan — lokaal, zonder centrale administratie.
```

Stap 5 is wat offline werken eerlijk maakt. Er is **geen centrale
gebruikerstabel**: winkelgebruikers bestaan alleen in de winkel. Niets aan het
inloggen van een kassamedewerker vereist dat uw server bereikbaar is, ooit.

---

## 19.5 Wat bewust geen verbinding oversteekt

- **Klantnamen, telefoonnummers, ID-nummers.** Versleutelde WBP-S-gegevens. Die
  blijven in de winkel. Het beheerknooppunt heeft ze niet nodig, en de sterkste
  privacypositie is ze niet hebben.
- **Inkoopprijzen en marges.** De commerciële positie van de winkel is van de
  winkel.
- **Productregels naar het belastingknooppunt.** Een BTW-aangifte is totalen per
  tarief. Detail op regelniveau hoort bij de Rekenkamer-export, op verzoek, en
  niet bij een routineaangifte.

---

## 19.6 Versietolerantie

Winkels werken bij op hun eigen moment, dus op elk moment omvat de vloot meerdere
versies. Elke sync- en aangiftepayload draagt een schemaversie, en **het
beheerknooppunt accepteert N−2**. Dit is het punt dat in jaar twee bijt, niet in
jaar één — bouw het in vóórdat er een vloot is.

---

## 19.7 Openstaande beslissingen

> **Inmiddels besloten.** Dit is allemaal beslist — zie
> [hoofdstuk 21](/nl/migration-architecture-plan/21-migration-record) voor de keuzes en de onderbouwing.
> Hieronder bewaard als vastlegging van wat openstond.

Deze punten waren nog niet vastgesteld en staan hier zodat niemand iets aanneemt:

1. **Eén winkelknooppunt per organisatie, of per vestiging?** Een keten met vijf
   filialen: één server op het hoofdkantoor, of vijf onafhankelijke knooppunten?
   Dat verandert wat "vestiging" in de licentielimieten betekent.
2. **Escrow.** Als de leverancier verdwijnt, moet een winkel dan door kunnen
   handelen? Een permanent token op verzoek beantwoordt dat; de beslissing is
   commercieel.
3. **Hosting van het belastingknooppunt.** Draait de Belastingdienst een eigen
   exemplaar, of logt men in op een exemplaar dat u voor hen host?

---

## 19.8 Volgorde van werken

1. Snijd de modules uit — `shop` / `control` / `tax` — bovenop de gedeelde
   domeinkern. Er wordt nog niets anders uitgerold; dit is zuivere
   herstructurering en mag het gedrag niet veranderen.
2. Licentie-uitgifte met signatuur in het beheerknooppunt, offline controle in het
   knooppunt. Vervangt de huidige altijd-online licentiecontrole.
3. Activatieflow, inclusief het aanmaken van de eerste beheerder.
4. Drie buildtargets, drie databases, drie compose-bestanden.
5. BTW-aangifte omzetten naar rechtstreeks indienen, met ondertekening aan
   winkelzijde.

Stap 1 is degene die goed moet. De BTW-engine, de geldafronding en de bonopbouw
blijven in de gedeelde kern en worden **één keer** geschreven — drie exemplaren
van een belastingberekening lopen uiteen, en als de bon van een winkel en de
Belastingdienst een cent verschillen is dat geen bugmelding maar een
nalevingsincident.
