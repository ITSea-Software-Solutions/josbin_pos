# Script 01 — Dagcyclus: kassa openen → eerste verkoop → Z-Rapport

**Doel:** een volledige dag van een kassier laten zien in één doorlopende opname. Demystificeert de kassa voor trainers, vestigingsmanagers die het product overwegen, en klanten die willen visualiseren wat hun personeel echt gaat doen.

**POV:** Kassier (`kassa@dehoop.sr / Cashier@2026`).

**Doelduur:** 4 min 30 s.

**Controle vóór opname**

- [ ] Demostack draait, POS op `http://localhost:5173`.
- [ ] Browsertaal staat op nl-NL. Venster 1366 × 820, zoom 100 %.
- [ ] Geen kassa staat open voor vandaag (sluit alle van gisterens opname).
- [ ] Dagkoers van vandaag is vergrendeld — ga naar Dashboard → Dagkoers als OA als dat niet zo is. (Verkoop voltooien mislukt zonder; dat wil je niet op de opname.)
- [ ] Een paar producten met foto's geseed. De Suriname demo-seeder doet dit — bevestig alleen dat het raster gevuld oogt.
- [ ] Loom-opnameknop klaar. Venster geselecteerd, niet "hele scherm" (vermijd het dock).

---

## Openingshaakje — 10 s

> "Als je 's ochtends om 8 uur een Surinaamse supermarkt binnenstapt, is het eerste wat de kassier doet de kassa openen. Ik neem je in 4 minuten mee door een complete dag — kassa openen, een klant afrekenen, en aan het einde van de dag afsluiten voor Belastingdienst."

**Caption op het scherm:** "Een dag van een kassier in 4 minuten."

---

## Scène 1 — Inloggen & kassa openen (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Inlogscherm zichtbaar | "Dus ik log in als kassier Kassa De Hoop. Hetzelfde scherm dat elke kassier op een Windows-kassa overal in Suriname ziet." | |
| Type e-mail + wachtwoord, klik op **Inloggen** | "Wachtwoord — en ik ben binnen. Let op dat de taal standaard Nederlands is. Eén klik in de hoek wisselt naar Engels als de kassier dat liever heeft." | |
| Kom op Kassa openen-scherm | "Het systeem weet dat er nog geen kassa open is op deze terminal, dus het parkeert me hier." | |
| Kies kassa uit keuzemenu (of automatisch geselecteerd) | "Ik kies *Kassa 1*. Als er maar één is, wordt die automatisch geselecteerd." | "Automatisch bij maar één kassa" |
| Type openingsbedrag: 200 | "Openingsbedrag — het geld dat al in de lade ligt. Ik vul SRD 200 in." | |
| Klik op **Openen** | "En we zijn open." | |

---

## Scène 2 — Winkelwagen vullen (75 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Productenraster zichtbaar | "Dit is het hoofd-POS-scherm. Producten per categorie aan de linkerkant. Winkelwagen rechts. Totaal onderaan." | |
| Klik 2× op een categorie (Zuivel) | "De klant koopt yoghurt en brood. Ik tik twee keer op de yoghurt — twee pakken in de winkelwagen." | |
| Klik op categorie Brood, dan op broodproduct | "Brood één keer." | |
| Toon de BTW-kolom in de winkelwagen | "Let op dat de winkelwagen de BTW per regel toont — dat is de Surinaamse BTW. Momenteel 10 procent. Sommige artikelen zoals basislevensmiddelen zijn BTW-vrij en het systeem regelt dat automatisch per product." | "BTW per product geregeld" |
| Klik op kortingsicoon op een regel | "Klant is vaste klant — ik geef 5 SRD korting op het brood. Klik op de regel, vul korting in." | |
| Bevestig korting toegepast + totaal werkt bij | "Korting wordt toegepast, BTW herberekent correct *na* de korting — dat is de Belastingdienst-volgorde, geen gok." | "Korting-dan-BTW = correcte volgorde" |

---

## Scène 3 — Betaling aannemen (45 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Klik op **Afrekenen** | "Klant is klaar om te betalen. Afrekenen." | |
| Betaalmodal opent, drie grote knoppen | "Drie opties bovenaan — contant, pin, gemengd. Er zijn er meer onder *Meer betaalwijzen*, maar 90 procent van de verkopen gaat contant of pin." | |
| Klik op **Contant** | "Klant betaalt contant." | |
| Type 50, zie wisselgeld | "Ik vul het ontvangen bedrag in — 50. Wisselgeld verschijnt direct — 2 SRD 50." | |
| Klik op **Voltooien** | "Voltooien." | "Kassalade gaat automatisch open" |
| Bon-preview verschijnt | "Bon drukt af op de thermische printer. Lade gaat open. Klaar." | |
| Bon afdrukken | "Klant krijgt zijn bon — tweetalig, met de BTW-uitsplitsing die Belastingdienst wil zien." | |

---

## Scène 4 — Einde dag Z-Rapport (90 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Terug op POS-scherm, klik op ☰ menu | "Einde van de dag. Kassier opent het menu." | |
| Klik op **Z-Rapport** | "Z-Rapport — dat is de formele dagafsluiting." | |
| Z-Rapport-scherm toont totalen | "Systeem toont wat het denkt dat vandaag gebeurde — aantal verkopen, totaal SRD, geheven BTW, betalingsuitsplitsing." | |
| Kasgeld-invoer | "Manager telt het fysieke geld in de lade en vult het werkelijke aantal hier in." | |
| Toon verschil-veld als anders | "Als het verschilt, markeert het systeem dat rood en vraagt om een opmerking. Die opmerking belandt voorgoed in het auditlogboek." | "Auditlogboek registreert elk verschil" |
| Klik op **Sluit dag** | "Sluiten. De dag is nu onveranderbaar — er kunnen geen verkopen meer geboekt worden op vandaag." | |
| Sync-indicator bevestigt | "Met internet synchroniseert het in seconden naar het hoofdkantoor. Zonder internet komt het in de wachtrij en probeert opnieuw — vijf aparte fallback-lagen, helemaal tot aan een USB-stick die de manager naar een plek met WiFi kan dragen." | "5 syncfallback-lagen — nooit een verkoop kwijt" |

---

## Afsluiting — 20 s

> "Dat was een complete kassierdag, van openen tot sluiten — en elke stap, van de BTW-berekening tot het auditlogboek, is precies wat Belastingdienst Suriname en de Rekenkamer verwachten te zien als ze ernaar vragen. Geen spreadsheets, geen handmatige hertik, geen compliance-verrassingen."

**Laatste caption op het scherm:** "Josbin POS — gebouwd voor Suriname."

---

## Na opname

- Trim openings-"ok, opnemen" en de afsluitende staart.
- Voeg de captions toe als Loom ze niet live oppikte.
- Stel titel in: *"Josbin POS — Een volledige kassierdag in 4 minuten."*
- Deel link in de demo-deck.
