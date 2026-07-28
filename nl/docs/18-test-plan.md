# 18. Testplan — wat wordt getest, en hoe

Dit is het register van alles waarop Josbin POS wordt getest. Het bestaat uit
twee helften, en die beantwoorden twee verschillende vragen:

| | **Deel A — Geautomatiseerd** | **Deel B — Handmatig** |
|---|---|---|
| Beantwoordt | "Heeft deze wijziging iets kapotgemaakt?" | "Werkt het op de winkelvloer?" |
| Draait | Bij elke codewijziging, zonder toezicht | Vóór een release, en bij een nieuwe winkel |
| Duurt | Ongeveer 4 minuten | Ongeveer 90 minuten voor de volledige ronde |
| Bewijst | De regels kloppen nog | Een mens kan het werk doen |

Het een vervangt het ander niet. Geautomatiseerde tests vinden een
BTW-afrondingsfout in milliseconden en zullen nooit opmerken dat een knop op
een scherm van 600 pixels onbereikbaar is. Handmatig testen ziet dat meteen en
kan geen 371 belastingscenario's opnieuw doorlopen vóór de lunch.

::: tip Dit afdrukken
Deel B is gemaakt om af te drukken. Gebruik de afdrukfunctie van uw browser —
navigatie en zoekbalk verdwijnen automatisch en elke sectie begint op een eigen
pagina. Vink met de hand af, onderteken onderaan elke sectie, bewaar de vellen.
:::

**Actueel houden:** elke nieuwe functie voegt zijn handmatige gevallen hier toe
in dezelfde wijziging die de functie toevoegt. Een functie zonder regel in Deel
B is niet af. Zie §18.7.

---

## 18.1 Deel A — Geautomatiseerde tests

Deze draaien bij elke push, in een schone omgeving die vanaf nul wordt
opgebouwd, vóórdat een wijziging samengevoegd kan worden. Een rood resultaat
blokkeert de samenvoeging; niemand kan er langs.

### Wat er draait

| Suite | Aantal | Duur | Wat het dekt |
|---|---:|---:|---|
| Backend (PHPUnit) | **371 tests · 1.276 controles** | ~47 s | Elke regel over geld, belasting, toegang en audit |
| Kassa-app (Vitest) | **156 tests** | ~1 s | Bonbytes, rekenwerk in de kar, scanner, barcodes, datums |
| Dashboard (Vitest + typecontrole) | typeveilige build | ~40 s | Compileert zonder typefouten |
| End-to-end rooktest | 1 volledige run | ~3 min | Een echte stack, vanaf niets opgestart, verkoopt iets |
| Afhankelijkheidsaudit | elk pakket | ~20 s | Bekende kwetsbaarheden in alles waarvan we afhangen |
| Codestijl (PSR-12) | hele backend | ~15 s | Eén consistente stijl |

Totalen gelden voor versie 1.5.8 en groeien met elke release.

### De end-to-end rooktest

Degene die er voor een niet-ontwikkelaar het meest toe doet. Bij elke wijziging
doet een machine dit:

1. Start een complete stack vanaf niets — database, server, cache, WebSockets
2. Voert elke databasemigratie uit
3. Zet een organisatie, winkel, producten en gebruikers klaar
4. Logt in als kassamedewerker
5. Opent een kassa met een startbedrag
6. Voegt producten toe aan een kar en rondt een echte verkoop af
7. Controleert of de BTW, de totalen en de voorraadmutatie allemaal kloppen
8. Leest de verkoop, de bon en het rapport terug
9. Scant het serverlogboek op elke foutregel
10. Breekt de hele stack weer af

Faalt één stap, dan is de build rood. Dit is de test die bewijst dat het
product nog *werkt*, niet alleen dat de onderdelen compileren.

### Wat de backend-suite dekt, per gebied

| Gebied | Getest gedrag |
|---|---|
| **BTW & geld** | Tarief per product, vrijgestelde goederen, korting vóór belastingextractie, gemengde tarieven, SRD-afronding, aangiftes, herinneringen bij te laat |
| **Verkopen & retouren** | Verkoop aanmaken, bonnummering per winkel bij gelijktijdigheid, terugbetalingen, retouren zonder originele bon, productvarianten, meer verkopen dan er ligt |
| **Betalingen** | Contant, kaart met bankafstemming, gemengd, overschrijving, mobiel bankieren, vreemde valuta, QR-wallets |
| **Kassa's & contant** | Startbedrag, dienstoverdracht, geld in/uit, Z-rapport afsluiten, kasverschillen, vergeten sessies die 's nachts sluiten |
| **Rapporten** | Daggrenzen in Surinaamse tijd, caching, PDF-export, winst, lijsttotalen |
| **Audit & naleving** | Alleen-toevoegen logboek, manipulatiedetectie, ketenvolledigheid, bereik van de inspecteur, exportwaarborgen |
| **Toegangsrechten** | Rolrechten, winkeltoewijzing, isolatie tussen organisaties, tokenbereik, passkeys, inlogbeperking |
| **Klanten & privacy** | Aankoopgeschiedenis, verwijdering op verzoek (WBP-S) |
| **Licenties** | Verloopstatussen, maximum aantal winkels, toegang tot de installer |
| **Assortiment** | Productvelden, varianten, de productlijst voor de kassa |
| **Wisselkoers** | Dagelijkse vastzetting, zelfherstel als de bron onbereikbaar is |

### Zelf uitvoeren

```bash
docker compose exec app php artisan test
```

```bash
cd frontend && npm run test:run
```

---

## 18.2 Deel B — Handmatige testlijst

Werk van boven naar beneden. Elke regel is één handeling en één ding dat daarna
waar moet zijn. Faalt een regel, schrijf dan in Opmerkingen wat er gebeurde —
"werkte niet" is geen melding, "lade bleef dicht, geen melding op het scherm"
wel.

**Tester:** ________________  **Datum:** ____________  **Versie:** __________

**Winkel / kassa:** _________________________  **Hardware:** ______________

### A. Inloggen en de kassa openen

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| A1 | Open de app | Inlogscherm, winkelnaam klopt | ☐ | |
| A2 | Log in met een verkeerd wachtwoord | Geweigerd, duidelijke melding | ☐ | |
| A3 | Log vijf keer verkeerd in | Geblokkeerd met wachtmelding | ☐ | |
| A4 | Log correct in als kassamedewerker | Kassalijst verschijnt | ☐ | |
| A5 | Tik ↻ Vernieuwen op de kassalijst | Lijst herlaadt, geen fout | ☐ | |
| A6 | Open een kassa met een startbedrag | Kassascherm, bedrag vastgelegd | ☐ | |
| A7 | Sluit de app, open opnieuw, log in | Terug in *dezelfde* dienst, geen "al open" | ☐ | |
| A8 | Probeer een kassa van een collega te openen | Geweigerd, meldt wie hem heeft | ☐ | |
| A9 | Zet de taal op Nederlands | Hele scherm verandert, geen herstart | ☐ | |

### B. Verkopen

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| B1 | Tik een product aan | Toegevoegd, totaal verandert | ☐ | |
| B2 | Tik hetzelfde product nog eens | Aantal wordt 2, geen tweede regel | ☐ | |
| B3 | Scan een barcode met de scanner | Juiste product, **bij de eerste scan** | ☐ | |
| B4 | Tik een product aan, scan daarna | Scan werkt nog, niets dubbel | ☐ | |
| B5 | Scan een onbekende barcode | Meldt niet gevonden, kar ongewijzigd | ☐ | |
| B6 | Zoek een product op naam | Treffers verschijnen tijdens typen | ☐ | |
| B7 | Wijzig het aantal op een regel | Totaal én BTW veranderen mee | ☐ | |
| B8 | Verwijder een regel | Weg, totaal gecorrigeerd | ☐ | |
| B9 | Geef korting op één regel | Regeltotaal daalt, BTW herberekend over het **gekorte** bedrag | ☐ | |
| B10 | Geef korting op de hele kar | Idem, over alle regels | ☐ | |
| B11 | Voeg een BTW-vrij product toe | Geen BTW op die regel, rest ongemoeid | ☐ | |
| B12 | Filter op categorie | Alleen die categorie | ☐ | |
| B13 | Leeg de kar | Leeg, totaal nul | ☐ | |

### C. Betaling aannemen

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| C1 | Open het betaalscherm | Te betalen bedrag klopt met de kar | ☐ | |
| C2 | Bekijk de contant-stap | **Betaling voltooien zichtbaar zonder scrollen** | ☐ | |
| C3 | Typ een bedrag op het toetsenblok | Wisselgeld rekent mee tijdens typen | ☐ | |
| C4 | Tik een snelbedrag aan | Vult dat bedrag, wisselgeld klopt | ☐ | |
| C5 | Voer minder dan het totaal in | Voltooien blijft uitgeschakeld | ☐ | |
| C6 | Rond een contante verkoop af | Bonscherm, wisselgeld groot in beeld | ☐ | |
| C7 | Start de volgende verkoop, open betaling | **Vorig bedrag is weg** | ☐ | |
| C8 | Betaal met kaart | Vastgelegd als kaart, bankvelden optioneel | ☐ | |
| C9 | Betaal deels contant, deels kaart | Beide bedragen vastgelegd, splitsing klopt | ☐ | |
| C10 | Betaal met QR-wallet | Winkel-QR met het bedrag in beeld | ☐ | |
| C11 | Open "Meer betaalmethoden" | Overschrijving, mobiel, vreemde valuta | ☐ | |
| C12 | Breek een betaling halverwege af | Terug naar de kar, niets vastgelegd | ☐ | |

### D. Bon, printer en geldlade

> Vereist de echte printer en lade aangesloten.

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| D1 | Rond een contante verkoop af | Bon print vanzelf | ☐ | |
| D2 | Let op de lade bij die verkoop | **Gaat open zodra het printen begint** | ☐ | |
| D3 | Lees de geprinte bon | Winkelnaam, datum **dag eerst**, **naam** van de medewerker | ☐ | |
| D4 | Bekijk de TOTAAL-regel | Eén regel, niet over twee | ☐ | |
| D5 | Bekijk het BTW-blok | Eén keer per tarief, bedragen tellen op | ☐ | |
| D6 | Bekijk een lange productnaam | Loopt door, niet afgekapt | ☐ | |
| D7 | Tik Opnieuw printen | Print weer, **lade gaat NIET open** | ☐ | |
| D8 | Zet de printer uit, verkoop | Fout vertelt *waarom*, in woorden | ☐ | |
| D9 | Zet hem aan, tik Opnieuw printen | Print | ☐ | |
| D10 | Verkoop aan een klant met telefoonnummer | WhatsApp-knop, al geadresseerd | ☐ | |
| D11 | Instellingen → Hardware → Lade testen | Lade opent, geen papier | ☐ | |
| D12 | Instellingen → Hardware → Bon testen | Testbon print | ☐ | |
| D13 | Met een voetafbeelding ingesteld, print | Afbeelding onderaan gestempeld | ☐ | |

### E. Klanten, geparkeerde bonnen, retouren

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| E1 | Voeg een klant toe tijdens de verkoop | Opgeslagen, gekoppeld, scherm blijft | ☐ | |
| E2 | Zoek een klant op telefoonnummer | Gevonden | ☐ | |
| E3 | Parkeer een bon met een naam | Naar Open bonnen, kar leeg | ☐ | |
| E4 | Help een andere klant, haal de bon terug | Komt compleet terug | ☐ | |
| E5 | Betaal één regel van een eerdere verkoop terug | Voorraad terug, retour vastgelegd | ☐ | |
| E6 | Annuleer een verkoop | Reden verplicht, verkoop gemarkeerd | ☐ | |
| E7 | Zoek die verkoop in rapporten | Buiten de omzet, zichtbaar in de audit | ☐ | |

### F. Transacties en herdrukken

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| F1 | Open Transacties | Verkopen van vandaag | ☐ | |
| F2 | Zoek een bonnummer | Gevonden | ☐ | |
| F3 | Wijzig de datum | Verkopen van die dag | ☐ | |
| F4 | Tik 🖨 bij een verkoop | **Opties: opnieuw printen, PDF, e-mail, WhatsApp** | ☐ | |
| F5 | Print daar opnieuw | Papier komt eruit | ☐ | |
| F6 | Open de PDF | Opent, gelijk aan het papier | ☐ | |
| F7 | Verstuur per e-mail | Bevestigt verzonden *(mail moet ingesteld zijn)* | ☐ | |
| F8 | Verstuur via WhatsApp | WhatsApp opent met de bontekst | ☐ | |

### G. Einde dag

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| G1 | Open het Z-rapport als manager | Totalen kloppen met de dag | ☐ | |
| G2 | Bekijk de betaalverdeling | Contant / kaart / overig klopt | ☐ | |
| G3 | Voer het getelde kasgeld in, kloppend | Sluit netjes af | ☐ | |
| G4 | Voer kasgeld in dat *niet* klopt | Verschil rood, **notitie verplicht** | ☐ | |
| G5 | Print het Z-rapport | Print als formeel document | ☐ | |
| G6 | Probeer dezelfde dag twee keer te sluiten | Geweigerd | ☐ | |
| G7 | Bekijk de 7-daagse historie | Eerdere sluitingen met synchronisatiestatus | ☐ | |

### H. Wie mag wat zien

> Log als elke rol apart in. Dit beschermt het geld en de gegevens van de winkel.

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| H1 | Kassamedewerker: bekijk het menu | **Geen Etiketten, Wisselkoers of Einde dag** | ☐ | |
| H2 | Kassamedewerker: probeer de wisselkoers | Niet bereikbaar | ☐ | |
| H3 | Kassamedewerker: open Rapporten | Alleen de eigen winkel | ☐ | |
| H4 | Manager: bekijk het menu | Etiketten, Wisselkoers, Einde dag aanwezig | ☐ | |
| H5 | Manager: open gegevens van een andere winkel | Niet mogelijk | ☐ | |
| H6 | Org-beheerder: open het dashboard | Alleen eigen organisatie | ☐ | |
| H7 | Org-beheerder: zoek een andere organisatie | Nergens zichtbaar | ☐ | |
| H8 | Auditor: probeer iets te wijzigen | Overal alleen-lezen | ☐ | |
| H9 | Super admin: log in | Tweestapsverificatie vereist | ☐ | |

### I. Dashboard (kantoor)

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| I1 | Open het dashboard | Winkelkaarten met omzet van vandaag | ☐ | |
| I2 | Rond een verkoop af op de kassa | Dashboardtotaal stijgt **zonder herladen** | ☐ | |
| I3 | Open een winkeldetail | Volledige transactielijst | ☐ | |
| I4 | Vergelijk twee winkels | Cijfers naast elkaar | ☐ | |
| I5 | Draai een BTW-rapport | Belastingdienst-formaat, cijfers kloppen | ☐ | |
| I6 | Exporteer een rapport naar PDF | Downloadt, opent, leesbaar | ☐ | |
| I7 | Exporteer naar CSV | Opent in een spreadsheet | ☐ | |
| I8 | Voeg een product toe | Verschijnt op de kassa | ☐ | |
| I9 | Importeer een productbestand | Rijen geïmporteerd, fouten benoemd | ☐ | |
| I10 | Wijzig een prijs | Kassa toont de nieuwe prijs | ☐ | |
| I11 | Voeg een gebruiker toe | Kan inloggen met de gegeven rol | ☐ | |
| I12 | Open het auditlogboek | Toont wie wat wanneer deed | ☐ | |
| I13 | Upload de platform-voetafbeelding | Staat op de volgende geprinte bon | ☐ | |

### J. Werken zonder internet

> Het bestaansrecht van het product. Test het bewust.

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| J1 | Trek het internet van de winkel eruit | Kassa verkoopt door | ☐ | |
| J2 | Verkoop meerdere artikelen offline | Alles rondt normaal af | ☐ | |
| J3 | Bekijk het managerscherm | Geel "synchronisatie wacht, N in wachtrij" | ☐ | |
| J4 | Print offline | Print | ☐ | |
| J5 | Herstel het internet | Wachtrij loopt vanzelf leeg | ☐ | |
| J6 | Controleer het dashboard | Alle offline verkopen aanwezig | ☐ | |
| J7 | Exporteer een dag naar USB | Bestand geschreven | ☐ | |
| J8 | Importeer dat bestand op het hoofdkantoor | Komt binnen alsof het gesynchroniseerd was | ☐ | |

### K. De hardware zelf

| # | Doe dit | Moet gebeuren | ✓ | Opmerkingen |
|---|---|---|:-:|---|
| K1 | Trek de USB van de printer los en terug | Verbindt opnieuw, print | ☐ | |
| K2 | Herstart de kassa | App start vanzelf, printer nog gekoppeld | ☐ | |
| K3 | Scan snel 20 barcodes | Alle 20 komen aan, geen gemist | ☐ | |
| K4 | Print een vel schaplabels | Barcodes scannen correct terug | ☐ | |
| K5 | Draai een kassa een hele dag | Geen vertraging, geen herstart nodig | ☐ | |

**Sectieresultaat:** Geslaagd ☐ Gezakt ☐  **Handtekening:** ________________

---

## 18.3 Wat "geslaagd" betekent

Een release wordt vrijgegeven wanneer:

- Elke geautomatiseerde suite groen is
- Elke regel in Deel B is afgevinkt, of een geschreven, geaccepteerde reden heeft
- Alles wat faalde is opgelost óf vastgelegd als bekende beperking die de klant
  heeft gezien

Een release wordt **niet** vrijgegeven op "het werkte grotendeels".

## 18.4 Als een test faalt

1. Schrijf precies op wat u zag, inclusief elke melding op het scherm — de
   exacte woorden zijn belangrijker dan al het andere in de melding
2. Noteer wat u er direct vóór deed
3. Noteer de versie en of het Windows of Android is
4. Gebeurt het één keer en daarna niet meer, zeg dat erbij — sporadische fouten
   zijn echte fouten en later het lastigst te vinden

Het nuttigste dat een tester kan toevoegen, is of dezelfde handeling **los wél
werkt maar in een reeks faalt.** Die ene waarneming versmalt een fout sneller
dan welke beschrijving ook.

## 18.5 Testen bij een nieuwe winkel

Vóór een winkel live gaat, draai minimaal: **A, B, C, D, G, H, J.** Die dekken
de paden die geld kosten of de handel blokkeren. De rest kan in de eerste week
volgen.

## 18.6 Wat hier niet in zit

Duidelijk gezegd, zodat niemand iets anders aanneemt:

- **Belasting- en stresstests** staan apart — zie de operationele documentatie
- **Beveiligingstests** tegen de OWASP Top 10 zijn een aparte oefening met een
  eigen rapport
- **Geautomatiseerd schermtesten** van de kassa-app (onbemand door schermen
  klikken) bestaat niet. Schermgedrag valt onder Deel B, door een mens. De
  moeite waard om toe te voegen naarmate het product groeit.

## 18.7 Dit document levend houden

Wanneer een functie wordt toegevoegd of gewijzigd:

1. Voeg of werk de regels in Deel B bij **in dezelfde wijziging**
2. Voeg de geautomatiseerde test toe die de regel bewaakt, als de regel over
   geld, belasting, toegang of gegevens gaat
3. Werk de aantallen in §18.1 bij wanneer een release uitgaat

Een functie zonder handmatig geval en zonder geautomatiseerde test is niet af,
hoe goed hij ook demonstreert.
