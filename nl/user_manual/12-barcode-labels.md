# Hoofdstuk 12 — Barcodes & Etiketten afdrukken

**Wie gebruikt dit:** Manager, voorraad-/magazijnmedewerker
**Waar:** Bovenbalk → Etiketten

Gebruik dit scherm om productprijsetiketten met barcodes af te drukken voor schaplabelling, voorraadmarkering of prijsweergave.

---

## 12.1 Het Etikettenscherm openen

1. Klik in de bovenbalk op **Etiketten**.
2. Het Etikettenscherm opent met twee panelen:
   - **Linkerpaneel** — productlijst en selectie
   - **Rechterpaneel** — etiketinstellingen en afdrukknop

---

## 12.2 Producten zoeken en selecteren

**Producten zoeken:**
1. Klik op de zoekbalk bovenaan de productlijst.
2. Typ een productnaam of barcode. De lijst filtert terwijl u typt.
3. Wis de zoekopdracht om alle producten weer te zien.

**Individuele producten selecteren:**
1. Zoek het product in de lijst.
2. Klik op het **selectievakje** aan de linkerkant van de productrij.
3. Een vinkje verschijnt en de rij wordt paars gemarkeerd.
4. Herhaal voor elk product dat u wilt labelen.

**Alle gefilterde producten in één keer selecteren:**
1. Gebruik de zoekbalk om indien nodig te filteren op een categorie of naam.
2. Klik op de knop **Alles selecteren** boven de lijst.
3. Alle momenteel zichtbare producten worden geselecteerd.

**Selectie wissen:**
1. Klik op de knop **Deselecteren** om alles uit te vinken.

---

## 12.3 Het aantal etiketten per product instellen

Elk geselecteerd product heeft een **aantalveld** aan de rechterkant van zijn rij.

1. Klik op het nummerveld voor een product.
2. Typ het aantal etiketten dat u wilt (bijv. `10` om 10 etiketten voor dat product af te drukken).
3. Druk op Tab of klik op een ander veld om te bevestigen.

De **etikettensamenvatting** in het rechterpaneel wordt bijgewerkt om het totale aantal etiketten weer te geven dat zal worden afgedrukt.

---

## 12.4 Het barcodetype kiezen

Onder **Type streepjescode** in het rechterinstellingenpaneel:

| Optie | Het beste voor |
|--------|---------|
| **EAN-13** | Standaard retailproducten met een 13-cijferige barcode. De meeste schapscanners lezen dit. |
| **Code 128** | Interne producten, aangepaste codes of elke tekst/nummer tot 20 tekens. |
| **QR** | Producten die een QR-code in plaats van een barcode nodig hebben (bijv. voor telefoonscanning). |

**Hoe te kiezen:**
- Als uw producten al EAN-13-barcodes hebben (de standaardbarcode op de meeste verpakte goederen), selecteert u **EAN-13**.
- Voor interne producten of artikelen zonder een standaardbarcode gebruikt u **Code 128** — het werkt met alle tekens.
- Gebruik **QR** alleen als uw klanten of medewerkers QR-scanners op de telefoon gebruiken.

> **Let op:** Alle barcodes worden direct op uw computer gegenereerd — er is geen internetverbinding nodig.

---

## 12.5 De etiketgrootte kiezen

Onder **Etiketgrootte** zijn er drie maten beschikbaar:

| Grootte | Fysieke afmetingen | Het beste voor |
|------|---------------------|---------|
| **36 × 24 mm** | Klein — ongeveer ter grootte van een postzegel | Kleine productstickers, kruidenpotjes |
| **50 × 30 mm** | Medium — standaard retail schapetiket | De meeste alledaagse producten |
| **60 × 40 mm** | Groot — voldoende ruimte voor naam en prijs | Grote artikelen, goed leesbare etiketten voor oudere klanten |

Selecteer de grootte die overeenkomt met het etikettenpapier dat in uw etiketprinter is geladen.

---

## 12.6 Naam en prijs op het etiket tonen/verbergen

Twee selectievakjes bepalen wat er op elk etiket verschijnt:

| Selectievakje | Wat het regelt |
|----------|-----------------|
| **Naam tonen** | Drukt de productnaam boven de barcode af |
| **Prijs tonen** | Drukt de SRD-prijs onder de barcode af |

Beide zijn standaard aangevinkt. Vink een van beide uit als u die niet op het etiket wilt.

**Voorbeeld etiket met beide ingeschakeld:**
```
┌────────────────────┐
│  Melk (1L)         │  ← product name
│  ||||||||||||||||  │  ← barcode graphic
│  8 712345 678901   │  ← barcode number
│  SRD 8.50          │  ← price
└────────────────────┘
```

---

## 12.7 De etiketten afdrukken

1. Zorg ervoor dat ten minste één product is geselecteerd (de afdrukknop toont het totale aantal, bijv. "Afdrukken (24)").
2. Klik op de knop **Afdrukken**.
3. Er treedt een korte pauze op terwijl het systeem alle barcodes genereert (dit gebeurt lokaal op uw computer).
4. Het **afdrukvenster** van uw browser of systeem opent automatisch.
5. Selecteer uw etiketprinter in de printerlijst.
6. Stel het papierformaat in op uw etikettenpapier.
7. Klik in het venster op **Afdrukken**.

> **Tip:** Etiketprinters moeten meestal als standaardprinter in Windows worden ingesteld. Eenmaal als standaard ingesteld, is de juiste printer meestal voorgeselecteerd in het venster.

> **Android-terminals:** de knop **Afdrukken** opent hier het Android-afdrukvenster (hetzelfde venster als Chrome gebruikt). Kies daar uw etiketprinter. Staan er geen printers in de lijst, schakel dan eerst de afdrukservice van uw printer in op de terminal (Android-instellingen → Afdrukken).

**De printerregel boven de knop Afdrukken** vertelt wat de app over uw printers weet: op de Windows-desktopapp telt hij de printers die in Windows zijn geïnstalleerd (bijv. "Printers gedetecteerd: 2" — of een waarschuwing als er geen zijn gevonden); in de browser en op Android kan de app de printerlijst niet zien en herinnert de regel u eraan dat printers in het afdrukvenster zelf verschijnen.

**Als het afdrukvenster opent maar er niets wordt afgedrukt:**
- Controleer of de juiste printer is geselecteerd.
- Controleer of het etikettenpapier correct is geladen.
- Probeer eerst één etiket af te drukken om de uitlijning te verifiëren voordat u een grote batch maakt.

---

## 12.8 Tips voor het instellen van etiketprinters

Josbin POS verzendt etiketten naar elke printer die in Windows is geïnstalleerd — het is niet beperkt tot thermische printers. Veelvoorkomende etiketprinters:

- **Zebra ZD-serie** — populair in retail, gebruikt ZPL of directe thermische etiketten
- **Dymo LabelWriter** — compact, goed voor kleine hoeveelheden
- **Brother QL-serie** — snel, meerdere etiketgroottes beschikbaar
- Elke **A4-vel etiket**printer — druk op A4-vellen met afpelbare etiketten

Voor de beste resultaten configureert u de etiketprinter in Windows voordat u dit scherm gebruikt. Stel het papierformaat in het afdrukvenster in op exact dezelfde afmetingen als uw etikettenvel.

---

## Veelvoorkomende problemen

| Probleem | Oplossing |
|---------|----------|
| De knop Afdrukken doet niets op een Android-terminal | Werk de app bij — etiketten afdrukken op Android vereist de build van juli 2026 of nieuwer. Controleer daarna of een afdrukservice is ingeschakeld (Android-instellingen → Afdrukken). |
| Barcodes verschijnen alleen als nummers (geen graphic) | Dit was een bekende bug, nu opgelost. Zorg ervoor dat u de nieuwste versie heeft. |
| Etiketten hebben de verkeerde grootte | Controleer of de etiketgrootte in het rechterpaneel overeenkomt met het papier in uw printer, en dat het papierformaat van de printer correct is ingesteld in het afdrukvenster. |
| Product staat niet in de lijst | Het product staat mogelijk niet in de catalogus voor deze vestiging. Neem contact op met uw manager. |
| EAN-13-barcode ziet er verkeerd uit | EAN-13 vereist een 12-cijferig nummer (systeem berekent het 13e controlecijfer). Producten zonder een juiste barcode gebruiken een gegenereerde code. |
