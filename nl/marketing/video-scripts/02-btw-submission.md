# Script 02 — BTW-aangifte → Belastingdienst-inspecteur accepteert

**Doel:** het killer-onderscheidingspunt tonen ten opzichte van elk ander POS in Suriname — formele BTW-aangifte vanuit het dashboard, beoordeeld en geaccepteerd door een Belastingdienst-inspecteur binnen hetzelfde platform. Beëindig het BTW-aangiftepijnpunt in één demo.

**POV:** Organisatiebeheerder (`orgadmin@dehoop.sr / OrgAdmin@2026`) → Belastinginspecteur (`belastingdienst@gov.sr / Inspector@2026`).

**Doelduur:** 5 min.

**Controle vóór opname**

- [ ] Demostack draait, dashboard op `http://localhost:5174`.
- [ ] Browsertaal nl-NL.
- [ ] **Wis het 2FA-geheim van de belastinginspecteur** (zie `README.md` — zonder dit kun je het inspecteursdashboard niet bereiken in een schone opname).
- [ ] Wat verkopen geseed voor gisteren of eerder deze maand zodat de *Bereken totalen*-preview echte cijfers toont, geen nullen. Draai de demo-seeder als de data dun aanvoelt.
- [ ] Geen bestaande BTW-aangifte voor de periode die je gaat indienen — het systeem blokkeert duplicaten, wat correct gedrag is maar saai in een demo.

---

## Openingshaakje — 15 s

> "Elke retailer in Suriname moet BTW indienen bij Belastingdienst. Vandaag is dat spreadsheets, handmatige hertik, en heen-en-weer telefoontjes als de cijfers niet kloppen. Ik ga in 30 seconden een maand BTW indienen vanuit Josbin POS — en dan wissel ik naar het account van de belastinginspecteur en accepteer het. Zelfde platform. Auditspoor van begin tot eind."

**Caption op het scherm:** "Van aangifte tot geaccepteerd in 5 minuten."

---

## Scène 1 — Aangifte indienen als OA (90 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Ingelogd als OA, zijbalk zichtbaar | "Ik ben de Organisatiebeheerder van Supermarkt De Hoop. Ik klik op *BTW-aangiftes* in de zijbalk." | |
| Klik op **BTW-aangiftes** | "Dit is de lijst met aangiftes. Bestaande aangiftes verschijnen met statusbadges — Ingediend, Geaccepteerd, Betwist, Vervangen. Voor nu leeg." | |
| Klik op **+ Nieuwe aangifte** | "Nieuwe aangifte." | |
| Modal: kies **Maandelijks** | "Maandelijks — dat is de wettelijke cyclus die Belastingdienst verwacht. Dagelijks staat er ook voor winkels die extra transparantie willen." | "Dagelijkse optie ook beschikbaar" |
| Datumkiezer vult vorige maand in | "Vult automatisch vorige maand in, 1e tot laatste dag. Belastingdienst accepteert geen gedeeltelijke maanden — de kiezer dwingt dat af." | |
| Klik op **🔍 Bereken totalen** | "*Bereken totalen* — dit is een droogloop. Het systeem leest elke voltooide verkoop in die maand en toont me wat ingediend zou worden." | |
| Preview toont aantal, totaal, BTW | "Aantal verkopen — totaal omzet — belastbaar versus vrijgesteld — BTW te betalen. Nog niets opgeslagen." | |
| Type optionele opmerking | "Optionele opmerking voor de inspecteur — bijvoorbeeld *'Eén Z-rapport ontbreekt, volgt'*. Die lezen ze." | |
| Klik op **✓ Indienen** | "Indienen." | |
| Groene bevestigingsbanner met REF | "Referentienummer toegekend. De exacte lijst met verkoop-ID's is in de rij vergrendeld — Rekenkamer kan vanaf deze aangifte terug naar elke bronverkoop, rij voor rij." | "Snapshot is vergrendeld — nooit herberekend" |
| Lijst toont nu de nieuwe rij | "En daar staat het — status *Ingediend*, wachtend op de inspecteur." | |

---

## Scène 2 — Wissel naar de belastinginspecteur (15 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Klik op gebruikerschip → **Uitloggen** | "Uitloggen." | |
| Log in als `belastingdienst@gov.sr` | "Log in als de Belastingdienst-inspecteur. Let op dat deze rol in productie 2FA vereist — ik heb het alleen voor deze opname gewist." | "2FA verplicht in productie" |
| Kom op BTW Dashboard | "De inspecteur komt direct op een BTW-dashboard — ze zien geen catalogus, klanten, prijzen of iets anders. Alleen BTW-aangiftes van elke belastingplichtige op het platform." | "Inspecteur ziet alleen BTW" |

---

## Scène 3 — Inspecteur beoordeelt + accepteert (90 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| BTW Dashboard met KPI-tegels | "Vier KPI's — aangiftes deze periode, geaccepteerd, betwist, in afwachting van beoordeling. Sparkline toont de laatste 30 dagen in één oogopslag." | |
| Klik op **BTW-aangiftes** in zijbalk | "Ga naar de aangiftelijst." | |
| Lijst toont aangiftes van meerdere organisaties | "Aangiftes van elke organisatie, gesorteerd op meest recente. Filter op status, periode, organisatie, bron." | |
| Klik op filter-keuzemenu **Bron** | "Bron-filter. Dit is toekomstgericht — belastingplichtigen kunnen Josbin POS gebruiken, maar ook een derde-partij-POS die data via onze open API pusht. Inspecteur kan de weergave splitsen op welk systeem indiende." | "Future-proof voor gemengde POS-omgevingen" |
| Klik op rij → **Bekijken** | "Inzoomen op onze De Hoop-aangifte." | |
| Detailscherm toont uitsplitsingen | "Detailweergave — zelfde totaal dat de OA zag, maar uitgesplitst per vestiging, per betaalmethode, per BTW-tarief. En de bron-POS-kolom — voor nu kwam alles uit Josbin native." | "Per vestiging, per methode, per tarief" |
| Klik op **✓ Accepteer** | "Cijfers kloppen — accepteer." | |
| Modal — optionele opmerking | "Optionele inspecteursopmerking — *'Geverifieerd tegen bankafschriften'*." | |
| Klik op bevestigen | "Bevestig." | |
| Status springt naar Geaccepteerd | "Status springt naar *Geaccepteerd*. Hash-keten gaat verder — manipulatiebestendigheid ingebouwd. Auditlogboek registreert de id en tijdstempel van de inspecteur." | "Manipulatiebestendige hash-keten" |

---

## Scène 4 — OA ziet de geaccepteerde status (20 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Uitloggen + weer inloggen als OA | "Terug naar de Organisatiebeheerder om te bevestigen dat ze het zien." | |
| Zijbalk → BTW-aangiftes | "BTW-aangiftes." | |
| Zelfde rij toont nu Geaccepteerd-badge | "Zelfde rij — nu *Geaccepteerd*. Met de inspecteursopmerking zichtbaar." | |
| Hover over de audit-tijdstempel | "En de tijdstempel + inspecteur-id staan voorgoed in het auditlogboek — niemand kan deze rij stilletjes bewerken." | |

---

## Afsluiting — 20 s

> "Vijf minuten — van een stapel verkooprijen naar een door Belastingdienst geaccepteerde aangifte, met een auditspoor dat de Rekenkamer morgen kan opvragen. Geen spreadsheets. Geen hertik. Geen heen-en-weer telefoontjes. Dat is wat Josbin POS doet wat geen enkel ander POS in Suriname momenteel doet."

**Laatste caption op het scherm:** "Belastingdienst-aangifte — ingebouwd, niet erop geplakt."

---

## Na opname

- Schakel het 2FA van de belastinginspecteur onmiddellijk weer in. Doe alleen een nieuwe opname als je een retake nodig hebt; laat de demostack niet achter met 2FA uit.
- Trim, captioneer, deel.
- Titel: *"Josbin POS — BTW indienen bij Belastingdienst in 30 seconden."*
