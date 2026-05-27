# Hoofdstuk 5 — Bulkimport (CSV / Excel)

**Voor wie:** de **organisatiebeheerder** (en Super Admin namens een klant). Kassiers en vestigingsmanagers kunnen geen bulkimport draaien — het is een hoofdkantoor-operatie die elke kassa in elk filiaal tegelijk raakt.

**Wanneer u het doet:** openen van een nieuwe vestiging (de eerste paar honderd producten laden), een jaarlijkse prijsrefresh, nadat een leverancier een nieuwe prijslijst stuurt, of migreren weg van een concurrent-POS.

**Waarom dit pijn voorkomt:** één upload vervangt uren klikken door het modal van één-product in [Hoofdstuk 4](04-catalogue-and-categories.md). Hetzelfde bestand is de **bron van waarheid** voor nieuwe producten *en* prijsupdates — de importer is idempotent, dus hetzelfde bestand morgen opnieuw uploaden is veilig.

![05 importscherm](screenshots/05-import-screen.png)
---

## 5.1 Wat de importer daadwerkelijk doet

Drie operaties in één upload, beslist **per rij** op basis van of de rij een barcode heeft:

```
elke rij in uw CSV / XLSX
   │
   ├── heeft een barcode die al bestaat in de catalogus van deze org
   │     → UPDATE dat product (prijs, naam, BTW, categorie, voorraad…)
   │
   ├── heeft een barcode die NIEUW is voor deze org
   │     → MAAK een nieuw product met die barcode AAN
   │
   └── heeft GEEN barcode
         → MAAK een nieuw product AAN (geen upsert — elke blanco-barcode-rij maakt
           een nieuw product, ook als u twee keer uploadt)
```

Dit is wat "**idempotente upsert op barcode**" in de praktijk betekent: het opnieuw uitvoeren van gisteren's bestand met een paar prijsaanpassingen werkt alleen die paar rijen bij; het maakt *geen* duplicaten. Rijen zonder barcode hebben geen sleutel om op te matchen, dus die maken altijd aan — wees voorzichtig bij het opnieuw uploaden van een bestand vol blanco-barcode-rijen.

Categorieën werken op dezelfde manier maar gematcht op de Nederlandse naam (`category_name_nl`):

```
category_name_nl op rij
   │
   ├── matcht een bestaande categorie in deze org (Nederlandse naam, exact)
   │     → gebruik die category_id
   │
   ├── matcht niets
   │     → MAAK AUTOMATISCH een nieuwe categorie aan met die naam (NL en EN beide
   │       ingesteld op de waarde die u gaf, sort_order = 0, actief)
   │
   └── blanco
         → product opgeslagen zonder categorie (verschijnt onder "Geen categorie"
           op het POS-grid totdat u er een toewijst)
```

Auto-aanmaak van categorieën is handig maar gemakkelijk te misbruiken — zie "Veelvoorkomende fouten" (§5.10).

---

## 5.2 De CSV-kolomreferentie

Headers zijn **hoofdletter-gevoelig** en moeten op rij 1 staan. De volgorde maakt niet uit — de importer mapt op headernaam, niet op positie. Kolommen die de importer niet herkent, worden stilzwijgend genegeerd.

| Kolom | Verplicht | Type | Opmerkingen |
|---|:-:|---|---|
| `name_nl` | ✅ | tekst | Nederlandse naam. De **enige** verplichte kolom. Gebruikt op bonnen en POS-grid wanneer de UI van de kassier Nederlands is. |
| `name_en` | optioneel | tekst | Engelse naam. Indien blanco kopieert de importer `name_nl` erin zodat de Engelse POS-view nooit een lege tegel toont. |
| `barcode` | optioneel | tekst | EAN-13 / EAN-8 / UPC-A / Code 128. Fungeert als de **upsert-sleutel** (zie §5.1). Laat blanco en elke rij maakt een nieuw product aan — ook bij opnieuw uploaden. |
| `price` | optioneel | decimaal | SRD-prijs, twee decimalen. `12.50` niet `12,50`. Negatieve waarden worden geklemd op `0`. Ontbrekend of blanco → `0.00`. |
| `btw_rate` | optioneel | decimaal | Suriname VAT, 0-100. Standaard `10` (het huidige standaardtarief). Buiten-bereik-waarden worden geklemd. |
| `btw_exempt` | optioneel | `0` / `1` | `1` = BTW-vrijgesteld (basisvoeding, medicijnen). `0` = belast. Bij `1` wordt het `btw_rate` opgeslagen maar het systeem schrijft `0` BTW op elke verkoop van dit product. Standaard `0`. |
| `category_name_nl` | optioneel | tekst | Nederlandse categorienaam. Hoofdletter-gevoelig gematcht aan een bestaande categorie in deze org. **Automatisch aangemaakt** als die niet bestaat. |
| `stock_qty` | optioneel | decimaal | Beginvoorraadtelling voor de hoofdcatalogus. Vestigingsvoorraad neemt het vanaf dan over (zie [Hoofdstuk 8](08-stock-management.md)). Decimalen toegestaan (`2.500` kg). |
| `low_stock_threshold` | optioneel | decimaal | Hieronder toont de POS een lage-voorraadwaarschuwing. Standaard `0` (geen alert). |
| `is_active` | optioneel | `0` / `1` | `1` = product zichtbaar op POS-grid (standaard). `0` = inactief, hetzelfde als de knop **Deact.** in [Hoofdstuk 4 §4.4](04-catalogue-and-categories.md#44-deleting-deactivating-a-product). |

Alles wat anders in uw bestand staat, wordt genegeerd. U kunt notitiekolommen, leverancierscodes enz. behouden — die breken de import niet.

### Formaateigenaardigheden om te weten

- **Komma is het enige scheidingsteken.** Puntkomma-gescheiden bestanden (gebruikelijk in Nederlandse Excel-exports) parsen niet correct. Gebruik de knop **CSV-sjabloon** — die produceert een komma-gescheiden bestand met de juiste BOM.
- **UTF-8 met BOM.** Het sjabloon wordt geleverd met een Byte Order Mark zodat Excel accenttekens (é, ï, ç) correct opent. Slaat u uw eigen bestand op vanuit Kladblok als "ANSI", dan ziet u `MozaÃ¯ek` in plaats van `Mozaïek` na de import.
- **Decimale punt, geen komma.** `12.50`. De importer leest `12,50` als het gehele getal `12`.
- **Aanhalingstekens.** Wikkel tekst in `"..."` als die een komma bevat (`"Volle Melk 1L, geheel"`). De preview-parser handelt dit af.

---

## 5.3 Stap voor stap — uw eerste import

1. Log in op het dashboard als **organisatiebeheerder** (of Super Admin gescoped op de doelorg).
2. Zijbalk → **Import / Export** (onder de Catalogus-sectie).
3. U komt op het scherm **Catalogus importeren / exporteren**. Er staan drie knoppen bovenaan:
   - **Catalogus exporteren (.csv)** — download wat er nu in de catalogus zit.
   - **CSV-sjabloon** — blanco template, headers + 3 voorbeeldrijen.
   - **Excel-sjabloon (.xlsx)** — hetzelfde sjabloon, als een echt `.xlsx`-bestand.
4. Eerste keer? Klik op **CSV-sjabloon** (of **Excel-sjabloon** als uw leverancier een `.xlsx` heeft gestuurd). De browser downloadt `josbin-products-template.csv` (of `.xlsx`).
5. Open het in Excel, LibreOffice Calc of Google Sheets. De eerste drie rijen zijn werkende voorbeelden:

   ```
   name_nl,name_en,barcode,price,btw_rate,btw_exempt,category_name_nl,stock_qty
   Volle Melk 1L,Full Milk 1L,8712345678901,4.99,0,1,Zuivel,50
   Brood Wit,White Bread,8712345678902,3.50,10,0,Bakkerij,30
   Coca-Cola 2L,Coca-Cola 2L,5449000054227,6.75,10,0,Dranken,100
   ```

6. **Verwijder de voorbeeldrijen** voordat u uw eigen begint toe te voegen — anders maakt u drie nepproducten aan bij de eerste import. (De importer kan voorbeelddata niet onderscheiden van echte data.)
7. Vul uw producten in. Alleen `name_nl` is verplicht; laat alles wat u niet uitmaakt blanco.
8. Sla het bestand op. Houd het als `.csv` (UTF-8) of `.xlsx`.
9. Terug in het dashboard, sleep het bestand op de gestippelde **dropzone** in het midden van het scherm — of klik op de zone en kies het bestand.

![05 dropzone met bestand](screenshots/05-drop-zone-with-file.png)
10. Voor CSV-bestanden toont het dashboard een **client-side preview** — de eerste N rijen, elk gemarkeerd groen (geldig) of rood (heeft fouten). XLSX-bestanden previewen niet client-side; u ziet *"bestand geladen"* en de validatie gebeurt op de server.
11. Controleer de preview-header op twee badges:
    - `✓ N geldig` — deze worden geïmporteerd.
    - `✗ N met fouten` — deze worden overgeslagen. Hover op het waarschuwingsicoon om te zien wat er mis is (bv. *"Ongeldige prijs"*).
12. Zegt de header `⚠ Ontbrekende verplichte kolom: "name_nl"`, dan is het bestand fout. Repareer de headers en zet het bestand opnieuw neer.
13. Klik op de groene knop **N rijen importeren**.
14. Wacht op de spinner. De import draait in één database-transactie — alles slaagt of niets.
15. De succesbanner verschijnt:

    ```
    ✅ Import voltooid!
       42 aangemaakt   17 bijgewerkt   3 overgeslagen
       ⚠ 3 rij(en) met fouten  ▼  (klik om uit te klappen)
    ```

16. De cataloguspagina ververst; de nieuwe producten zijn binnen seconden zichtbaar bij elke kassa via de WebSocket-push (hetzelfde mechanisme als één-product opslaan — geen extra klik op **Pushen naar POS** nodig).

---

## 5.4 Stap voor stap — prijzen bijwerken vanuit een leveranciersprijslijst

Dit is de meest voorkomende bulkoperatie na de eerste lading.

1. **Exporteer eerst uw huidige catalogus** als veiligheidsnet: bovenaan het importscherm → **Catalogus exporteren (.csv)**. Het bestand `josbin-products-YYYY-MM-DD.csv` wordt opgeslagen in uw downloads. **Bewaar dit.** Het is uw één-klik-undo als de import scheefgaat.
2. Open de prijslijst van de leverancier. Is het een `.xlsx`, dan kunt u die direct uploaden (mits de kolomheaders matchen — meestal doen ze dat niet, dus stap 3).
3. Bouw in een nieuwe spreadsheet een bestand met **de kolommen die u wilt wijzigen** plus `barcode` als sleutel. Voor pure prijsupdates heeft u maar twee kolommen nodig:

   ```
   barcode,price
   8712345678901,5.49
   8712345678902,3.95
   5449000054227,7.00
   ```

   Elk ander veld blijft onaangeroerd op het gematchte product.
4. Sla op als CSV (UTF-8) of XLSX. Sleep op het importscherm.
5. De preview toont elke rij als geldig (barcode + prijs is genoeg). Klik op **Importeren**.
6. Succesbanner: `0 aangemaakt · N bijgewerkt`. De "aangemaakt"-telling zou voor een pure prijsupdate **nul** moeten zijn — is dat niet zo, dan matchen sommige barcodes in uw bestand niet (typefout, ontbrekende voorloopnul, EAN-8 vs EAN-13 mismatch).

> **Prijswijzigingen midden in een verkoop:** als een kassier een halfafgemaakte winkelwagen open heeft met een van deze producten erin, behoudt de **winkelwagen de oude prijs** — de nieuwe prijs geldt pas de volgende keer dat het product wordt toegevoegd. Dit is bewust (geen verrassing voor de klant midden in de verkoop). Zie [Hoofdstuk 4 §4.3](04-catalogue-and-categories.md#43-editing-a-product).

---

## 5.5 Stap voor stap — de huidige catalogus exporteren

Handig voor: back-up vóór een grote wijziging, de catalogus naar een accountant of leverancier sturen, of als startpunt voor een bulkprijslijst-bewerking.

1. Import / Export-scherm → **Catalogus exporteren (.csv)** bovenaan.
2. Browser downloadt direct `josbin-products-YYYY-MM-DD.csv`.
3. Het bestand bevat elk product in de organisatie (actief + inactief) met deze kolommen:

   ```
   name_nl, name_en, barcode, price, btw_rate, btw_exempt,
   category_name_nl, stock_qty, is_active
   ```

4. Bewerk, dan opnieuw importeren. Omdat elke rij zijn barcode draagt, is dit een schone upsert — niets dupliceert.

> Let op: de **export** bevat geen `low_stock_threshold`. Heeft u drempels geconfigureerd en wilt u die behouden tijdens een rondreis-bewerking, voeg die kolom dan handmatig toe voor opnieuw uploaden.

---

## 5.6 Wat "Pushen naar POS" doet — en wanneer u het nodig heeft

U hoeft het meestal **niet** in te drukken. Elke één-product-save en elke bulkimport zendt een `catalogue.refresh`-signaal uit op de WebSocket; verbonden terminals herladen binnen seconden.

De knop **📡 Catalogus pushen naar kassa's** (rechtsboven in de header van het scherm **Catalogus**, zie [Hoofdstuk 4 §4.8](04-catalogue.md)) forceert een verse broadcast. Gebruik die wanneer:

- Een terminal offline was tijdens uw import en u net heeft gezien dat die opnieuw verbindt.
- U een categorie heeft heringeschakeld die eerder verborgen was en de terminal die niet heeft opgepikt.
- U een demo geeft en zeker wilt zijn dat elk scherm binnen één seconde synchroon is.

Het is idempotent — er twee keer op drukken schaadt niets.

---

## 5.7 De preview, validatie en het foutrapport

Twee niveaus van validatie:

| Fase | Waar | Wat het vangt |
|---|---|---|
| **Client-side preview** (alleen CSV) | Uw browser, vóór upload | Ontbrekende `name_nl`-header. Per rij: ontbrekende `name_nl`, niet-numerieke `price`, `btw_rate` buiten 0-100. |
| **Server-side validatie** | Laravel, tijdens upload | Dezelfde checks, plus: bestandstype toegestaan (`csv`, `txt`, `xlsx`, `xls`), bestandsgrootte ≤ 10 MB, organisatie-match, alle DB-beperkingen. Geeft een per-rij foutlijst terug in het antwoord. |

De `⚠ N rij(en) met fouten`-uitklap van de succesbanner lijst elke overgeslagen rij op met het rijnummer uit uw spreadsheet (rij 2 = eerste datarij, omdat rij 1 de header is). Voorbeeld:

```
Rij 14: name_nl is verplicht
Rij 27: Ongeldige prijs: "twaalf"
Rij 31: name_nl is verplicht
```

**Overgeslagen rijen rollen de import niet terug.** De 39 geldige rijen worden opgeslagen; de 3 gebroken worden teruggerapporteerd. Repareer ze in uw bestand, sleep opnieuw, en alleen die 3 worden verwerkt (de andere staan er al en zouden gewoon `updated`-zonder-wijzigingen krijgen).

---

## 5.8 Bestandsgrootte en prestaties

| Limiet | Waarde | Wat er gebeurt als u die overschrijdt |
|---|---|---|
| Max bestandsgrootte | **10 MB** | Server geeft HTTP 422 — *"bestand mag niet groter zijn dan 10240 kilobytes"*. Splits het bestand. |
| Max rijen | geen harde limiet | We hebben 10.000-rij imports schoon getest. Groter dan dat — splits in twee bestanden. |
| Toegestane extensies | `.csv`, `.txt`, `.xlsx`, `.xls` | Alles anders wordt afgewezen vóór lezen. |
| Transactie | **alles-of-niets** op DB-niveau | Triggert een rij een database-niveau fout midden in de import (zeer zeldzaam), dan rolt de hele import terug en krijgt u HTTP 422 met de onderliggende fout. Geen van uw data wijzigt. |

Een typische 500-product-import op de demo-stack draait in onder 3 seconden.

---

## 5.9 Wat in het auditlogboek wordt vastgelegd

Elke productaanmaak of -update — bulk of enkel — schrijft een rij in het onveranderlijke auditlogboek via de `Auditable`-trait van het model. Voor elke rij die u importeert krijgt u:

- De **actie** (`created` of `updated`).
- De **gebruiker** die de import triggerde (uw dashboard-account).
- De **oude waarden** en **nieuwe waarden** als JSON — handig voor "wat was de prijs vóór de import van gisteren?"-vragen.
- Het **IP-adres** en timestamp (AST).

Automatisch aangemaakte categorieën worden op dezelfde manier vastgelegd (event = `created`, auditable type = `Category`). Het auditlogboek is alleen-toevoegen — zelfs Super Admin kan een rij niet verwijderen. Auditors kunnen de volledige geschiedenis bekijken in [Hoofdstuk 13 — Auditlogboek](13-audit-log.md).

Als een inspectie van Belastingdienst of Rekenkamer ooit vraagt *"wie heeft de prijs van dit product gewijzigd op 12 mei 2026?"* — het antwoord is één filter weg.

---

## 5.10 Veelvoorkomende fouten (en hoe ze snel te repareren)

| Symptoom | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| Preview toont `⚠ Ontbrekende verplichte kolom: "name_nl"` | Headersrij ontbreekt of heeft een typefout (`Name_NL`, `name nl`, enz.). | Headernamen zijn hoofdlettergevoelig: `name_nl` exact. |
| Elk accentteken is mojibake (`MozaÃ¯ek`) | Bestand opgeslagen als ANSI/Windows-1252, niet UTF-8. | Sla opnieuw op als **CSV UTF-8** (Excel: *Bestand → Opslaan als → CSV UTF-8*). Of gebruik het XLSX-sjabloon. |
| Prijzen komen binnen als `12.0` waar u `12,50` schreef | Nederlandse decimale komma. De importer leest `12,50` als twee cellen (`12` en `50`) onder puntkomma-scheidingstekens, of als `12` onder komma. | Gebruik een decimale **punt**: `12.50`. |
| `46 aangemaakt` toen u `0 aangemaakt, 46 bijgewerkt` verwachtte | De barcode-kolom ontbrak of was blanco — geen upsert-sleutel, dus elke rij maakte een nieuw product aan. | Voeg de `barcode`-kolom toe met de daadwerkelijke EAN-13's. Verwijder de duplicaat-"nieuwe" producten die u net heeft aangemaakt (Catalogus → Producten → filter op datum van vandaag → Deact. elk). |
| Plotseling zijn er 12 nieuwe categorieën genaamd `meat`, `Meat`, `meats`, `Meat ` (achterloopspatie) | Vrij-tekst typen in `category_name_nl` — elke variant maakt automatisch een aparte categorie aan. | Standaardiseer. Draai **Catalogus → Categorieën** en deactiveer de typefouten, dan opnieuw importeren met de canonieke Nederlandse naam (bv. `Vlees`). |
| Import slaagt maar de nieuwe producten verschijnen niet op het POS-grid | Ze zijn geïmporteerd als `is_active = 0` (u zette de kolom op `0`), of de terminal staat in offlinemodus. | Catalogus → Producten → filter Inactief → Heractiveer. Of: zorg dat `is_active` `1` of gewoon afwezig is (standaard is actief). |
| Server geeft *"Kan bestand niet lezen: …"* op een `.xlsx` | Bestand is wachtwoordbeveiligd, of opgeslagen als `.xls` met een macro-ingeschakelde (`.xlsm`)-extensie hernoemd. | Sla opnieuw op als een eenvoudige `.xlsx`. Macro-ingeschakelde bestanden worden niet ondersteund. |
| BTW-cijfers zien er na import verkeerd uit | `btw_exempt` was ingesteld op een string als `"yes"` in plaats van `1`. De importer behandelt alles wat Laravel's `FILTER_VALIDATE_BOOLEAN` niet herkent als `false`. | Gebruik `1` of `0` — niet `Yes`/`No`/`true`/`false` (die werken toevallig maar `1`/`0` is het gedocumenteerde contract). |
| Eén rij blijft falen met *"name_nl is verplicht"* hoewel u het getypt heeft | De cel heeft een onzichtbare voorloopspatie, of de spreadsheet heeft het auto-geconverteerd naar een formule (een voorloop `=`). | Tik in de cel, herlaad. Als de cel begint met `=`, prefix met `'` (Excel) of wijzig celtype naar *Tekst*. |

> **De grote: blanco-barcode-rijen bij opnieuw importeren.** Heeft uw bestand tientallen rijen zonder barcode, dan **maakt elke re-upload verse duplicaten aan** omdat er geen sleutel is om op te matchen. Wijs altijd barcodes toe — zelfs interne pseudo-codes als `INT-001` — voor alles dat u mogelijk opnieuw importeert.

---

## 5.11 Rechten- en rol-samenvatting

Uit [de matrix in Hoofdstuk 1](01-roles-and-permissions.md#13-the-permission-matrix):

| Rol | Bulkimport | Bulkexport | Catalogus pushen |
|---|:-:|:-:|:-:|
| Super Admin | ✅ | ✅ | ✅ |
| Organisatiebeheerder | ✅ | ✅ | ✅ |
| Vestigingsmanager | ❌ | ❌ | ❌ |
| Kassier | ❌ | ❌ | ❌ |
| Auditor | ❌ | ✅ (alleen-lezen export) | ❌ |
| API-integratie | ❌ | ❌ | ❌ |

Vestigingsmanagers die snel één product moeten toevoegen, gebruiken het [Product toevoegen-modal voor één product](04-catalogue-and-categories.md#42-adding-a-single-product); voor iets groters hebben ze een OA nodig om de import te doen.

---

## 5.12 Snelreferentie

```
SJABLOON DOWNLOADEN  Catalogus → Import/Export → CSV-sjabloon / Excel-sjabloon
CATALOGUS EXPORTEREN Catalogus → Import/Export → Catalogus exporteren (.csv)
BESTAND IMPORTEREN   Catalogus → Import/Export → sleep bestand op dropzone
                     → bekijk preview → Importeer N rijen
PRE-IMPORT BACK-UP   Altijd: exporteer eerst, bewaar het bestand
SLEUTELKOLOM         barcode (matcht bestaande producten → update; ontbreekt → nieuw)
VERPLICHTE KOLOM     name_nl  (enige)
STANDAARDWAARDEN     price=0.00, btw_rate=10, btw_exempt=0, stock_qty=0, is_active=1
                     name_en valt terug op name_nl wanneer blanco
LIMIETEN             10 MB bestandsgrootte · geen rij-limiet (getest tot 10.000)
```

Vastgelopen? Kruisverwijs [Hoofdstuk 4 — Catalogus en categorieën](04-catalogue-and-categories.md) voor de werkstroom voor één product, [Hoofdstuk 6 — Prijzen en vestigingsspecifieke overschrijvingen](06-pricing-and-per-store-overrides.md) voor vestigingsspecifieke prijzen die de hier ingestelde hoofdprijs omzeilen, en [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) om te zien wie wat heeft geïmporteerd.

---

→ Volgende: [Hoofdstuk 6 — Prijzen en vestigingsspecifieke overschrijvingen](06-pricing-and-per-store-overrides.md)
