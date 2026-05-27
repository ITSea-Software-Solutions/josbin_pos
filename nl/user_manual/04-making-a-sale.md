# Hoofdstuk 4 — Een verkoop maken

Dit hoofdstuk behandelt alles wat gebeurt vóór de betaling — producten toevoegen, aantallen wijzigen, zoeken en een barcodescanner gebruiken.

---

## 4.1 Producten aan de winkelwagen toevoegen

![POS-scherm — productraster links, lege winkelwagen rechts](screenshots/04-pos-screen-empty-cart.png)

Er zijn vier manieren om een product toe te voegen:

### Methode A — Tikken/klikken op het productraster

1. Het productraster vult het grootste deel van het scherm met productkaarten.
2. Vind het gewenste product en **klik of tik** er één keer op.
3. Het product wordt toegevoegd aan de winkelwagen rechts. Elke klik voegt nog een eenheid toe.

### Methode B — Een categoriefilter gebruiken

1. Categorieknoppen verschijnen als een horizontale rij boven het productraster.
2. Klik op een categorie (bijv. "Dranken", "Zuivel", "Vlees") om alleen producten in die categorie te tonen.
3. Klik op het product om het toe te voegen.
4. Klik op **"Alles"** om terug te gaan naar alle producten.

### Methode C — Zoeken op naam

1. Klik op de **zoekbalk** bovenaan het productraster.
2. Typ de productnaam (of een deel ervan). Het raster werkt in real time bij terwijl u typt.
3. Klik op het product uit de gefilterde resultaten om het toe te voegen.

> **Tip:** Het zoeken begrijpt gedeeltelijke namen en werkt zowel in het Nederlands als in het Engels. "aardappel" en "potato" tikken vindt allebei hetzelfde product.

### Methode D — Een barcode scannen

**USB-barcodescanner (keyboard wedge):**
1. Richt de scanner op de barcode van het product.
2. De scanner voegt het product automatisch toe aan de winkelwagen. Geen klikken nodig.
3. De scanner werkt als een toetsenbord — hij "typt" de barcode in en drukt op Enter.

**Handmatige invoer barcode:**
1. Klik op de zoekbalk.
2. Typ het 8–13 cijferige barcodenummer.
3. Druk op **Enter**. Als de barcode overeenkomt met een product, wordt het toegevoegd aan de winkelwagen.

**Camera-barcodescanner (Quagga2):**
1. Als uw terminal een camera heeft, kan de camerascanner via Instellingen worden ingeschakeld.
2. Richt de camera op de barcode.
3. Bij detectie wordt het product automatisch toegevoegd.

---

## 4.2 Het aantal wijzigen

**Meer van hetzelfde artikel toevoegen:**
- Klik gewoon nogmaals op de productkaart. Elke klik voegt één eenheid toe.

**Een exact aantal instellen:**
1. Zoek het artikel in de winkelwagen (rechterzijde van het scherm).
2. Klik op het **aantal** op die regel.
3. Een bewerkingspaneel voor de regel opent.
4. Wijzig het aantal naar het gewenste getal.
5. Klik op **Opslaan** of druk op **Enter**.

**Een gebroken aantal instellen (gewichts-/bulkartikelen):**
- Aantallen ondersteunen decimale waarden. Voer bijvoorbeeld `1.5` in voor 1,5 kg.

---

## 4.3 Een artikel uit de winkelwagen verwijderen

1. Zoek het artikel in het winkelwagenpaneel.
2. Klik op de knop **× (verwijderen)** of het prullenbakpictogram op die regel.
3. Het artikel wordt verwijderd en het totaal wordt opnieuw berekend.

Om alle artikelen tegelijk te verwijderen, klik op de knop **Winkelwagen leegmaken** onderaan het winkelwagenpaneel.

---

## 4.4 Het winkelwagenpaneel begrijpen

Het winkelwagenpaneel rechts toont:

```
Artikelnaam                Aant.  Stukprijs    Regeltotaal
────────────────────────────────────────────────────────
Melk (1L)                   2×     SRD 8.50     SRD 17.00
Brood volkoren              1×     SRD 12.00    SRD 12.00
────────────────────────────────────────────────────────
Subtotaal                                       SRD 29.00
Korting                                         SRD  0.00
BTW (10%)                                       SRD  2.55  ← belasting
────────────────────────────────────────────────────────
TOTAAL                                          SRD 31.55
```

- **Subtotaal** — de som van alle regeltotalen vóór enige korting
- **Korting** — eventuele toegepaste korting (zie [Hoofdstuk 8 — Kortingen](08-discounts.md))
- **BTW** — het belastingbedrag (al inbegrepen in het totaal — getoond voor transparantie)
- **Totaal** — het bedrag dat de klant betaalt

> **Opmerking over BTW:** Het totaal bevat al BTW. De BTW-regel wordt alleen ter informatie weergegeven, niet als extra heffing. BTW-vrijgestelde producten (basisvoedsel, medicijnen) tonen SRD 0.00 BTW.

---

## 4.5 Dagtotalen bekijken

De **bovenbalk** toont altijd de lopende dagtotalen zonder dat u het POS-scherm hoeft te verlaten:

- **Totaal verkopen** — totale SRD opgenomen aan verkopen vandaag
- **Aantal transacties** — aantal voltooide verkopen vandaag

Deze getallen worden direct na elke voltooide verkoop bijgewerkt.

---

## 4.6a Lage-voorraad- en niet-op-voorraad-badges op het productraster

Wanneer de voorraad van een product in uw vestiging onder de **lage-voorraaddrempel** zakt (per product ingesteld door uw manager), verschijnt er een kleine badge op de producttegel:

| Badge | Betekenis | Kunt u het nog verkopen? |
|---|---|---|
| 🟡 **LAAG** | Voorraad is op of onder de drempel (bijv. nog 5, drempel 5) | Ja — maar waarschuw de manager zodat zij kunnen bijbestellen |
| 🔴 **OP** | Nul voorraad geregistreerd in uw vestiging | Ja — maar meld het; ofwel de catalogus klopt niet, ofwel het product is echt op |

De badges zijn **informatief** — ze blokkeren de verkoop niet. U kunt een product aanslaan, ook als het OP toont, omdat:

- Het getal in het systeem mogelijk niet overeenkomt met het schap (een levering is nog niet vastgelegd).
- De klant het product in handen heeft, dus het bestaat duidelijk.
- Blokkeren zou de klantervaring breken vanwege een probleem met voorraadgegevens.

> **Wat de manager ziet:** het Voorraadscherm van het dashboard toont elk product dat momenteel LAAG of OP is in de vestiging, zodat zij op tekorten kunnen reageren zonder te wachten tot een kassier het meldt. Neem contact op met uw manager als u veel rode badges in één categorie ziet — dat is meestal een gemiste leveringsregistratie.

**Opmerking voor meerdere vestigingen:** de badge toont voorraad **alleen voor uw vestiging**. Een product dat in uw winkel OP is, kan bij de naastgelegen vestiging volop op voorraad zijn. Als u klanten vaak naar de andere vestiging moet sturen, vraag uw manager een vestigingsspecifiek voorraadalarm in te stellen.

---

## 4.6 Wat als een product niet wordt gevonden?

Als een barcode of zoekopdracht geen resultaat oplevert:
- De zoekbalk wordt rood of toont "Geen producten gevonden".
- Het product staat niet in de catalogus. Neem contact op met uw manager om het toe te voegen.

U kunt nog steeds een niet-gecatalogiseerd product verkopen door:
1. Een willekeurig product aan de winkelwagen toe te voegen.
2. De naam en prijs op de regel te bewerken (zie [Hoofdstuk 8 — Kortingen](08-discounts.md) voor bewerken van regels).

---

## Veelvoorkomende problemen

| Probleem | Oplossing |
|---------|----------|
| Productraster is leeg | Controleer of een vestiging is geselecteerd. Controleer internet/serververbinding. |
| Barcodescanner voegt het verkeerde product toe | De barcode kan voor een ander product zijn. Controleer de catalogus. |
| Product toont SRD 0.00 prijs | Het product is niet correct geprijsd. Neem contact op met de manager. |
| Winkelwagentotaal lijkt verkeerd | Controleer op onverwachte kortingen. Klik op elk artikel om prijzen te bekijken. |
