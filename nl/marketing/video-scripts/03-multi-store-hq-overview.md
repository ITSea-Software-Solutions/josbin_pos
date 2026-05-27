# Script 03 — Multi-vestiging hoofdkantoor live overzicht

**Doel:** de SaaS / "we zijn meer dan één kassa"-pitch. Overtuig een multi-vestiging-retailer dat het hoofdkantoor echte waarde haalt uit het overstappen van per-vestiging-spreadsheets naar één live dashboard.

**POV:** Organisatiebeheerder (`orgadmin@dehoop.sr / OrgAdmin@2026`). Optionele cameo: Super Admin Platform-overzicht aan het einde (sla over als SA 2FA niet gewist is — het breekt het verhaal niet).

**Doelduur:** 3 min.

**Controle vóór opname**

- [ ] Demostack met **minstens 2 vestigingen** geseed onder één organisatie. Als er maar 1 is, voeg een tweede toe via het Vestigingen-scherm vóór de opname.
- [ ] Een paar verkopen vandaag aangeslagen over beide vestigingen zodat het dashboard niet allemaal nullen toont. Makkelijkste manier: draai twee POS-dev-tabs als kassiers op verschillende vestigingen, sla per stuk 3–4 verkopen aan.
- [ ] Beide POS-vensters geminimaliseerd maar niet gesloten — die gebruik je in de live-update-scène.
- [ ] Browsertaal nl-NL.

---

## Openingshaakje — 10 s

> "Als je meer dan één vestiging hebt, loopt het hoofdkantoor meestal een dag achter. Rapporten komen binnen via Excel per e-mail, tegen de tijd dat je ze geconsolideerd hebt is het 3 uur 's middags en het verschil waar je deze ochtend op had moeten reageren is nu het probleem van deze week. Zo ziet realtime eruit."

**Caption op het scherm:** "Multi-vestiging zichtbaarheid — live."

---

## Scène 1 — Het OA-overzicht (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Ingelogd als OA, op Dashboard-overzicht | "Startpagina van de Organisatiebeheerder voor Supermarkt De Hoop. Twee vestigingen vooralsnog — Paramaribo centrum en Nickerie." | |
| Per-vestiging-kaarten zichtbaar | "Elke vestiging krijgt een kaart. Omzet vandaag. Transactie-aantal. Gemiddeld mandje. Laatste synchronisatie. Online- of offline-indicator." | |
| Hover op een kaart → inzoomen | "Klik op een kaart — volledige transactielijst voor die vestiging." | |
| Terug naar overzicht | "Terug." | |
| Toon top-producten-tegel | "Top product over het hele netwerk — Bruine Bonen deze week." | "Top-verkopers over vestigingen heen in één weergave" |
| Toon geconsolideerd totaal | "Geconsolideerde omzet en BTW — hoofdkantoor-cijfer, niet vijf vestigingscijfers die ik zelf moet optellen." | |

---

## Scène 2 — Live updates via Reverb WebSocket (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Dashboard-overzicht op voorgrond | "Let op de Paramaribo-kaart. Ik ga nu een verkoop aanslaan op die kassa." | |
| Wissel naar POS-venster (Paramaribo-kassier) | "Kassier slaat 2 artikelen aan, 50 SRD totaal, contant." | |
| Snel: 2 klikken, afrekenen, contant, voltooien | (Vertel niet over de kassa — zeg "en voltooien" als brug) | |
| Wissel terug naar dashboard | "Terug naar het hoofdkantoor — de kaart van Paramaribo is net opgehoogd. Geen verversen. Reverb WebSocket pushte het." | "Live — geen vernieuwknop" |
| Herhaal voor Nickerie (optioneel) | "Hetzelfde voor Nickerie." | |
| Beide kaarten bijgewerkt | "Het hoofdkantoor ziet het op het moment dat de kassier op Voltooien tikt. Dat is het verschil tussen je bedrijf zien gebeuren en er morgen over lezen." | |

---

## Scène 3 — Inzoomen op rapporten (45 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Zijbalk → **Rapporten** | "Rapporten — dagelijks, maandelijks, aangepast bereik, BTW, Rekenkamer." | |
| Klik op **Geconsolideerd** | "Geconsolideerd overzicht over alle vestigingen." | |
| Toon datumkiezer, betaalmethode-uitsplitsing | "Kies elk datumbereik. Toont betaalmethode × bank-uitsplitsing — zodat de dagelijkse kaartafrekening overeenkomt met het bankafschrift zonder handmatig uitzoeken." | "Kaarten × bank — automatisch afgestemd" |
| Klik op **PDF-export** | "PDF — Nederlandse of Engelse kopteksten, afhankelijk van de taal van de kijker." | |
| Toon eerste pagina van gedownloade PDF | "Belandt in de downloads van de manager. Zelfde formaat elke keer, klaar om te delen." | |

---

## Scène 4 (optioneel) — SA Platform-overzicht (15 s)

Doe deze alleen als SA 2FA gewist is, sla anders over.

| Klik | Narratie | Caption |
|------|----------|---------|
| Uitloggen, inloggen als Super Admin | "Super Admin — de platform-eigenaar — ziet één niveau hoger: elke organisatie, elke vestiging, elke licentie." | |
| Platform-overzicht-paneel zichtbaar | "Actieve organisaties, actieve vestigingen, verkopen vandaag over het hele platform. Nuttig als je dit voor meerdere klanten draait." | |

---

## Afsluiting — 15 s

> "De verschuiving hier gaat van naar je bedrijf van gisteren kijken naar nu je bedrijf bekijken. Of je nu twee vestigingen of twintig runt, het hoofdkantoor ziet wat er gebeurt op het moment dat het gebeurt — en de kassier hoeft niks aan zijn manier van werken te veranderen."

**Laatste caption op het scherm:** "Realtime. Elke vestiging. Geen hertik."

---

## Na opname

- De live-update-scène is de geldscène. Als de WebSocket niet snel genoeg vuurde op de take, neem alleen die scène opnieuw op; je kunt hem inplakken.
- Titel: *"Josbin POS — Multi-vestiging live, geen verversen."*
