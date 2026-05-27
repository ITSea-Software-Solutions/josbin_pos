# Hoofdstuk 4 — Productcatalogus en categorieën

**Voor wie:** organisatiebeheerder (de catalogus-eigenaar) en vestigingsmanager (beperkte editor).

De catalogus is het hart van het systeem — het is wat kassiers aantikken om een verkoop af te rekenen. Maak het op het hoofdkantoor één keer goed, en elke kassa bij elk filiaal volgt direct mee.

Dit hoofdstuk behandelt de werkstroom voor één product (toevoegen, bewerken, deactiveren, een barcode scannen), de categoriestructuur (wat er voorgevuld is, hoe u eigen categorieën toevoegt) en de BTW-vrij-vlag — die directe juridische implicaties heeft onder de Surinaamse belastingwet.

Voor *bulk*-laden via CSV of Excel, zie Hoofdstuk 5.
Voor *vestigingsspecifieke prijsoverschrijvingen* (bv. Nickerie verkoopt hetzelfde blik corned beef voor SRD 14,50 in plaats van 13,00), zie Hoofdstuk 6.

---

## 4.1 Hoe de catalogus is georganiseerd

Het model is bewust simpel:

```
ORGANISATIE (bv. Supermarkt De Hoop NV)
   │
   ├── hoofdproductcatalogus (één hoofdlijst, gedeeld door alle vestigingen)
   │     │
   │     ├── product: "Volle Melk 1L"  →  Categorie: Zuivel,    Prijs: SRD 12.50,  BTW: 10 %
   │     ├── product: "Brood Wit"      →  Categorie: Brood,     Prijs: SRD  6.00,  BTW: vrijgesteld
   │     └── product: "Cola 1.5L"      →  Categorie: Frisdrank, Prijs: SRD 18.00,  BTW: 10 %
   │
   └── vestigingen
         ├── De Hoop — Paramaribo Centrum  (ziet de hoofdcatalogus tegen hoofdprijzen)
         └── De Hoop — Nieuw Nickerie      (ziet de hoofdcatalogus, optioneel met prijsoverschrijvingen)
```

Belangrijke implicaties:

- **Eén catalogus per organisatie.** Voeg een product één keer toe; alle filialen in die org zien het.
- **Vestigingsspecifieke prijsoverschrijvingen** zijn een opt-in aanpassing, geen apart product. De productnaam, barcode, BTW-tarief en categorie worden altijd op orgniveau ingesteld; alleen de prijs (en voorraadtelling) kunnen per vestiging variëren. Zie Hoofdstuk 6.
- **Voorraad is per vestiging.** Een product toevoegen geeft het voor het gemak een initiële `stock_qty` op catalogusniveau, maar elke vestiging volgt vanaf dan zijn eigen fysieke telling (Hoofdstuk 8).

> **Kassiers kunnen producten niet bewerken.** De POS-app *verkoopt* producten alleen; ze kan ze niet aanmaken of wijzigen. Dit is een bewuste bescherming tegen kassa-zijde fraude (bv. een kassier die een nepproduct met lage prijs aanmaakt om voor een vriend af te rekenen).

---

## 4.2 Een enkel product toevoegen

**Pad:** Dashboard → **Catalogus** (linker zijbalk) → tab **Producten** is standaard geselecteerd → **+ Product toevoegen** (knop rechtsboven).

> Alleen Super Admin: kies eerst de organisatie uit de selector **Organisatie** bovenaan de pagina. OA en vestigingsmanager zijn automatisch beperkt tot hun eigen organisatie — de selector verschijnt niet.

Het modal Product toevoegen opent. Velden:

| Veld | Verplicht | Opmerkingen |
|---|:-:|---|
| **Naam (NL)** | ✅ | Nederlandse naam. Getoond op bonnen en POS-grid wanneer de taal van de kassier Nederlands is. bv. `Volle Melk 1L`. |
| **Naam (EN)** | ✅ | Engelse naam. Getoond wanneer de taal Engels is. Mag identiek zijn aan NL als er geen goede vertaling is. |
| **Categorie** | optioneel | Kies uit het keuzemenu. Bepaalt onder welke kleur-gecodeerde filterknop het product valt op de POS-grid. |
| **Barcode** | optioneel | EAN-13, Code 128, EAN-8, UPC-A. Typ het, of tik op het kleine scanner-icoon naast het veld om met de cameraapparaat te scannen. |
| **Prijs (SRD)** | ✅ | Decimaal, 2 plaatsen — bv. `12.50`. Dit is wat de kassier standaard afrekent; vestigingsspecifieke overschrijvingen (Hfdst. 6) kunnen afwijken. |
| **BTW %** | ✅ | `10 %` (huidige Suriname VAT) of `0 %`. Standaard `10`. |
| **BTW-vrijgesteld** | optionele schakelaar | Basisvoedingsmiddelen en medicijnen — zie §4.7 hieronder. Bij aanvinken wordt het BTW %-veld volledig overgeslagen. |
| **Voorraad** | optioneel | Beginvoorraad. Standaard `0`. Vestigingsvoorraad wordt vanaf dan apart gevolgd. |

Tik op **Opslaan**. Het product verschijnt direct in de producttabel en wordt naar elke verbonden POS-terminal in deze organisatie gepusht via WebSocket — meestal zichtbaar aan de kassa binnen een paar seconden.

### Een barcode scannen met de camera

De kleine barcode-icoon-knop naast het veld **Barcode** opent een camera-scanneroverlay. Het gebruikt dezelfde Quagga2-bibliotheek als de POS-app:

1. Tik op het icoon. Browser vraagt om cameratoestemming — accepteer.
2. Richt de camera op de EAN-13 / Code 128 / UPC-A / EAN-8 barcode op de productverpakking.
3. Wanneer een code wordt gedetecteerd, toont het veld die in het groen, plus een groene knop "Gebruiken".
4. Tik op **Gebruiken**. De barcode wordt in het veld gezet; de scanner sluit.

Voor werkstromen waar u veel producten toevoegt met een USB-barcodescanner (gebruikelijk in stockroom-opstellingen), zet gewoon de focus in het Barcode-veld en haal de trekker over — USB-barcodescanners typen tekens en drukken dan Enter, dus ze werken zonder dat de cameramodal nodig is.

> **Unieke barcodes worden niet afgedwongen** tussen producten in deze release. Als u per ongeluk dezelfde EAN-13 aan twee producten toewijst, ziet de kassier die het scant de *eerste* match — wat meestal niet is wat u wilt. Controleer altijd dubbel op uniciteit bij het toevoegen van meerdere varianten van hetzelfde item.

---

## 4.3 Een product bewerken

**Pad:** Catalogus → tab Producten → vind de rij → tik op **Bewerken**.

Hetzelfde modal als Product toevoegen, met alles vooringevuld. U kunt elk veld wijzigen, inclusief het BTW-tarief, de BTW-vrij-vlag, de categorie, de prijs, de voorraad. Tik op **Opslaan**.

Wijzigingen propageren naar elke verbonden POS-terminal in de organisatie binnen seconden via de WebSocket-push. Kassiers die toevallig op het productgrid zijn, zien de nieuwe prijs live updaten.

Het modal Bewerken toont ook een schakelaar **Actief** (die verschijnt niet in het formulier Toevoegen — nieuwe producten worden altijd actief aangemaakt). Hem hier uitschakelen is hetzelfde als de rij-deactiveer-knop hieronder beschreven.

> **Een subtiele gedraging:** als u de prijs van een product bewerkt *terwijl een kassier het in een halfafgemaakte winkelwagen heeft staan*, behoudt de winkelwagen de prijs waarop het is toegevoegd. De nieuwe prijs geldt pas de *volgende* keer dat de kassier het product toevoegt. Dit voorkomt het verrassen van de klant met een prijswijziging midden in de verkoop.

---

## 4.4 Een product verwijderen (deactiveren)

Het dashboard toont **Deactiveren** in plaats van hard verwijderen. Permanente verwijdering van een product dat ooit is verkocht zou BTW-rapporten en het Rekenkamer-auditspoor breken. Deactivering geeft u hetzelfde praktische resultaat zonder dat risico.

**Om een product te deactiveren:**

1. Catalogus → tab Producten → vind de rij.
2. Tik op de rode knop **Deact.**.
3. Bevestig de prompt.

De statusbadge wisselt naar grijs *Inactief*. Het product verdwijnt van het POS-grid op elke terminal binnen seconden. Historische verkopen zijn onaangeroerd — elke bon waar dit product ooit op stond, toont het nog steeds.

**Heractiveren** is dezelfde knop, nu groen en gelabeld **Act.**

Roltechnisch (volgens de rechtenmatrix van Hoofdstuk 1):
- **Super Admin** en **organisatiebeheerder** kunnen deactiveren/heractiveren.
- **Vestigingsmanager** kan individuele producten bewerken (typefouten herstellen, prijzen aanpassen) maar *kan niet* deactiveren — dat is een hoofdkantoorbeslissing omdat het elk filiaal tegelijk raakt.

> **Permanent hard-verwijderen** van een product dat nooit is verkocht, is technisch mogelijk via API voor leverancier-support, maar niet zichtbaar in de dashboard-UI. Heeft een klant echt een product nodig dat weg is (bv. een duplicaat-entry per ongeluk aangemaakt), dan deactiveert de OA het en laat het staan — het schaadt niets.

---

## 4.5 Categorieën beheren

Categorieën zijn de kleur-gecodeerde knoppen bovenaan het POS-productgrid. Een goede categoriestructuur maakt de kassa sneller — een slechte laat kassiers zoeken.

**Pad:** Catalogus → tab **Categorieën**.

### Wat er voorgevuld komt

Wanneer u een nieuwe organisatie aanmaakt, voorvult Josbin POS automatisch **41 standaardcategorieën** gericht op een Surinaamse supermarkt / convenience store. Ze zijn ruwweg gegroepeerd naar waar dingen op de winkelvloer staan:

| Sectie | Categorieën |
|---|---|
| **Verse voeding** | Brood, Bakkerij, Zuivel, Vlees, Vis, Kip, Groenten, Fruit, Diepvries |
| **Droge voorraad** | Droog, Rijst & Pasta, Granen, Sauzen, Kruiden, Conserven |
| **Dranken** | Dranken, Frisdrank, Sap, Water, Koffie & Thee, Bier, Wijn & Sterk |
| **Snacks & traktaties** | Snacks, Snoep, Chips, IJs |
| **Gereguleerd** | Tabak |
| **Huishouden** | Huishoud, Schoonmaak, Wasmiddel, Papierwaren |
| **Persoonlijke verzorging** | Hygiëne, Cosmetica, Verzorging, Gezondheid |
| **Gezin** | Baby, Huisdier |
| **Diversen** | School & Kantoor, Hardware, Elektronica, Cadeau, Overig |

Elk komt met een Nederlandse naam, een Engelse naam, een emoji-icoon en een kleur — allemaal in één oogopslag zichtbaar voor de kassier.

> **U kunt elk ervan negeren, verbergen, hernoemen of uitbreiden.** De seeder is gewoon een verstandige starterspakket zodat een nieuwe org niet naar een leeg grid staart op dag één.

### Een nieuwe categorie toevoegen

1. Catalogus → tab Categorieën → **+ Categorie toevoegen**.
2. Vul in:
   - **Naam (NL)** — bv. `Surinaamse Specialiteiten`
   - **Naam (EN)** — bv. `Surinamese Specialties`
   - **Sorteervolgorde** — een getal (lager = verschijnt eerder in het POS-grid). Standaard `0` zet het helemaal vooraan. Gebruik `10`, `20`, `30`… spacing om later ruimte te laten om ertussen in te voegen.
3. Tik op **Opslaan**.

> **Pictogram en kleur:** voorgevulde categorieën hebben een emoji-icoon en een merkkleur. Het dashboardformulier toont momenteel geen icoon-/kleur-editors wanneer u een nieuwe categorie *aanmaakt* — nieuwe krijgen een standaardplaatshouder. Heeft u aangepaste pictogrammen nodig op uw eigen categorieën, dan is dat een leverancier-supportverzoek.

### Een categorie bewerken

Tab Categorieën → knop **Bewerken** op de rij. Dezelfde velden als het toevoegmodal, plus een schakelaar **Actief**.

Een categorie hernoemen is veilig — elk product dat ernaar wees, wijst er nog steeds naar. De nieuwe naam verschijnt direct op het POS-grid.

### Categorieën herordenen / deactiveren

Om te **herordenen**: bewerk de categorie en wijzig haar *Sorteervolgorde*. Lagere getallen komen eerst. Het POS-grid herrangschikt bij de volgende refresh.

Om te **deactiveren** (verbergen voor POS): tik op de rode knop **Deact.** op de rij. Kassiers zien de categorieknop niet meer. Producten toegewezen aan die categorie blijven in het systeem maar verschijnen onder *Geen categorie* in de alle-producten-view van de kassier.

Om **permanent te verwijderen**: niet zichtbaar in de UI. Deactiveren is de juiste keuze om dezelfde redenen als producten (§4.4).

---

## 4.6 Wat kassiers daadwerkelijk zien in de POS

Het POS-productgrid wordt op twee manieren gestuurd door uw catalogusinstellingen:

- De **categoriefilterbalk** bovenaan het grid spiegelt uw actieve categorieën, in de volgorde die u instelt met `sort_order`. Op een categorie tikken filtert het grid op producten in die categorie.
- De **producttegels** tonen wat u in `name_nl` of `name_en` heeft getypt, plus de prijs in SRD. De kassier kan zijn grid configureren om weer te geven op naam alleen, foto alleen, of beide — dat is een instelling per terminal (behandeld in de POS-handleiding).

Gedeactiveerde producten en categorieën verdwijnen uit de view van de kassier binnen seconden na de dashboardwijziging. Er is geen "publiceren"-stap — elke save is live.

> **De view van de kassier volgt de taal van de kassier.** Hebben ze hun UI op Nederlands ingesteld, dan zien ze `name_nl`. Op Engels, `name_en`. Beide velden invullen is daarom de extra vijf seconden per product waard.

---

## 4.7 De BTW-vrij-vlag — wanneer te gebruiken

Suriname BTW (momenteel 10%) wordt **niet geheven** op bepaalde goederen, waaronder:

- Basisvoedingsmiddelen (`brood`, basisrijst, basisbloem, rauw fruit en groenten, vers vlees, melk voor kinderen)
- Medicijnen en farmaceutica
- Een handvol andere categorieën gedefinieerd door Belastingdienst Suriname

Wanneer u **BTW-vrijgesteld** aanvinkt op een product, gebeuren drie dingen:

1. Het BTW %-veld wordt overgeslagen — het systeem slaat `btw_rate = 0` op ongeacht wat was ingesteld.
2. De productregel op elke bon toont **Vrijgesteld** in plaats van een 10% BTW-cijfer.
3. Het dagelijkse BTW-rapport (Hoofdstuk 10) telt deze verkopen onder een aparte "vrijgesteld"-regel zodat Belastingdienst-aangiftes schoon blijven.

> **Niet zeker of iets vrijgesteld is?** Raad niet. De officiële lijst wordt gepubliceerd door Belastingdienst Suriname en periodiek bijgewerkt — bij twijfel, heft BTW (10%) en laat de klant terugvragen als ze daar grond voor hebben. Het tegenovergestelde (BTW overslaan op iets belastbaars) creëert een compliance-probleem voor de klant.

De producttabel markeert vrijgestelde producten met een groene pil in de BTW-kolom voor snel visueel scannen.

---

## 4.8 Catalogus pushen — directe refresh van elke POS-terminal

![Catalogus-header — "📡 Pushen naar alle kassa's" naast "+ Product toevoegen"](screenshots/04-catalogue-push-button.png)


Na een bulkprijswijziging, een serie bewerkingen of een CSV-import — wanneer u wilt dat elke kassa de nieuwe catalogus *nu* ziet in plaats van te wachten op de volgende natuurlijke refetch:

**Pad:** Catalogus → header → **📡 Pushen naar alle kassa's**.

Wat er gebeurt:

1. Backend zendt een `catalogue.refresh`-event uit op het Reverb WebSocket-kanaal van de org.
2. Elke POS-terminal in de org ontvangt het event, invalideert zijn gecachte `pos-products`-query en haalt opnieuw `/api/products/pos` op.
3. Bijgewerkte prijzen / nieuwe producten / verwijderde items verschijnen binnen seconden op het scherm.

Knopstatussen:
- **📡 Pushen naar alle kassa's** (inactief)
- **… Bezig met pushen** (onderweg)
- **✓ Verstuurd** (groene flits gedurende 3 seconden)
- **✗ Mislukt** (rode flits; controleer Horizon voor de Reverb-jobfout)

Rechten: toegekend aan `store_manager`, `organisation_admin` en `super_admin` via de `products.create`-capability. Kassiers zien de knop niet.

> Wanneer *niet* pushen: kleine aanpassingen (één prijswijziging, één nieuw product) — terminals halen al om de paar minuten opnieuw op via TanStack Query's stale-time. De push is voor de gevallen waarbij zo lang wachten niet acceptabel is.

---

## 4.9 Bulkimport — kruisverwijzing

Voor het laden van honderden of duizenden producten tegelijk (een typische winkelopening of jaarlijkse prijsrefresh):

- CSV-upload met een te downloaden template
- Idempotente upsert (bestaande barcodes worden bijgewerkt, niet gedupliceerd)
- Validatierapport met aangemaakt / bijgewerkt / overgeslagen / fouten

Dit wordt behandeld in **Hoofdstuk 5 — Bulkimport (CSV / Excel)** *(binnenkort beschikbaar)*. De haken zijn in deze release — het Catalogus Import / Export-scherm zit in de zijbalk onder **Import / Export**, toegankelijk voor alleen Super Admin en OA.

---

## 4.10 AI-autocategorisering

Geplande functie: bij het toevoegen van een nieuw product zou een AI-helper een waarschijnlijke categorie voorstellen op basis van de productnaam (en barcode-zoekopdracht tegen een database van veelvoorkomende Suriname-SKU's).

Vanaf deze release **bevat het dashboard-product-aanmaakformulier geen "Suggereer categorie"-knop**. De AI-functies die *wel* live zijn (slimme productzoekfunctie aan de POS, weekoverzicht verkoop, anomaliedetectie) zijn toegankelijk vanuit het AI-inzichten-scherm en worden behandeld in Hoofdstuk 14. Autocategorisering bij productaanmaak staat op de fase 2-roadmap; deze sectie wordt bijgewerkt zodra die wordt geleverd.

Wilt u een startcategorie voor een nieuwe import, dan is de schoonste huidige aanpak:
- Laat het veld **Categorie** leeg bij het toevoegen van het product.
- Voer later een snelle filter uit: Catalogus → Producten → filter `Alle categorieën` → bekijk de geen-categorie-items in batch en wijs toe.

---

## 4.11 Snelreferentie

```
PRODUCT TOEVOEGEN     Catalogus → Producten → + Product toevoegen → formulier invullen → Opslaan
PRODUCT BEWERKEN      Catalogus → Producten → Bewerken op rij → wijzigen → Opslaan
PRODUCT DEACTIVEREN   Catalogus → Producten → Deact. op rij → bevestigen
BARCODE SCANNEN       Binnen Product toevoegen/bewerken → tik scanner-icoon → richt op barcode → Gebruiken

CATEGORIE TOEVOEGEN   Catalogus → tab Categorieën → + Categorie toevoegen → formulier invullen → Opslaan
CATEGORIE BEWERKEN    Catalogus → Categorieën → Bewerken op rij → wijzigen → Opslaan
CATEGORIEËN HERORDENEN Bewerk elk → pas Sorteervolgorde aan (lager = eerder)
CATEGORIE DEACTIVEREN Catalogus → Categorieën → Deact. op rij → bevestigen

PUSHEN NAAR ALLE KASSA'S  Organisaties-lijst → Catalogus pushen-knop op org-rij
                          (auto-pushes gebeuren bij elke save; deze knop forceert een re-push)
```

Vastgelopen? Bekijk Hoofdstuk 1 voor wat elke rol mag aanraken, Hoofdstuk 6 voor vestigingsspecifieke prijsoverschrijvingen, Hoofdstuk 8 voor voorraadbeheer.

---

→ Volgende: Hoofdstuk 5 — Bulkimport (CSV / Excel) *(binnenkort beschikbaar)*
