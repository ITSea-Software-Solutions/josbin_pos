# Hoofdstuk 8 — Voorraadbeheer

**Voor wie:** vestigingsmanager (dagelijks — leveringen ontvangen, breuk afschrijven, lage-voorraadalerts in de gaten houden) en organisatiebeheerder (cross-vestiging reviews, openingsvoorraad laden wanneer een nieuw filiaal online komt).
**Wanneer u het gebruikt:** elke keer dat voorraad fysiek van eigenaar wisselt en het systeem het nog niet wist — facturen komen binnen, een doos valt, iemand vindt bedorven vlees, een voorraadtelling klopt niet met het scherm.
**Wat het voorkomt:** stille over-verkoop, spook-shrinkage, BTW-rapporten die niet matchen met fysieke realiteit, en managers die over een lege schap horen van een klagende klant.

Het Voorraad-scherm is de enige plek in het dashboard waar u **het getal op het schap handmatig kunt verplaatsen**. Al het andere (een verkoop, een annulering, een terugbetaling) verplaatst voorraad automatisch als bijwerking — daar hoeft u niets voor te doen.

![08 voorraadscherm](screenshots/08-stock-screen.png)
---

## 8.1 Het model — hoe Josbin POS voorraad volgt

Voorraad is **per (product, vestiging)**. Er is geen enkele `stock_qty`-kolom op een product die "de hele organisatie" deelt — elk filiaal houdt zijn eigen telling.

```
ORGANISATIE (bv. Supermarkt De Hoop NV)
   │
   ├── hoofdproduct: "Volle Melk 1L"
   │     │
   │     ├── ProductStock(vestiging: Paramaribo Centrum)  →  aantal 24, drempel 6
   │     ├── ProductStock(vestiging: Nieuw Nickerie)      →  aantal  3, drempel 6  ← LAAG
   │     └── ProductStock(vestiging: Marowijne)           →  aantal  0, drempel 6  ← OP
   │
   └── stock_movements (alleen-toevoegen grootboek — elke wijziging, voor altijd)
         │
         ├── 2026-05-26 09:14  sale          −1   qty_after 24   door kassier Sharmila
         ├── 2026-05-26 11:02  adjustment    +50  qty_after 74   door manager Rashied  (notitie: "factuur 2026-05-26")
         ├── 2026-05-26 15:48  void          +1   qty_after 75   door kassier Sharmila
         └── …
```

Twee tabellen doen ertoe:

| Tabel | Doel | Veranderbaarheid |
|---|---|---|
| `product_stocks` | Het *huidige* getal op het schap, per (product, vestiging). Atomair bijgewerkt bij elke beweging. | Bijgewerkt, nooit verwijderd |
| `stock_movements` | Het *grootboek* — elke wijziging van dat getal, met de actor, reden, optionele notitie en een `qty_after`-snapshot. | Alleen-toevoegen (`updating`/`deleting` in code geblokkeerd) |

Elke wijziging loopt door `StockMovementService::record()`, die de matchende `product_stocks`-rij vergrendelt, de delta toepast en de grootboekrij schrijft binnen één DB-transactie. Dat garandeert:

- Twee kassiers die het **laatste blik corned beef** tegelijk afrekenen aan dezelfde kassapositie, kunnen niet beiden slagen — de rijlock serialiseert ze.
- Verkopen in **verschillende vestigingen** voor hetzelfde product blokkeren elkaar niet — andere `product_stocks`-rij.
- U kunt geschiedenis niet herschrijven. Er is nergens een knop "deze beweging bewerken", en de API heeft er ook geen.

> **Voorraad kan nooit negatief worden.** De service klemt de resulterende hoeveelheid op nul. Schrijft u 100 af van een schap dat er maar 80 op heeft, dan is de nieuwe waarde `0`, niet `-20`. De beweging registreert nog steeds eerlijk `qty_change = -100`, dus een latere voorraadtelling leest "we hebben meer afgeschreven dan er was — onderzoek".

### Waar het initiële getal vandaan komt

Wanneer u een vestiging toevoegt aan een organisatie die al een gevulde catalogus heeft, is geen handmatige seeding nodig. De eerste keer dat er iets gebeurt met een (product, vestiging)-paar in het nieuwe filiaal, maakt het systeem de `product_stocks`-rij aan met de `stock_qty` van het hoofdproduct als startwaarde, markeert die met reden `initial` en gaat vanaf daar verder. Geen spookrijen, geen NULL-tellingen — maar ook geen opgeblazen "elke filiaal heeft magisch dezelfde openingsvoorraad", omdat de rij alleen materialiseert wanneer nodig.

---

## 8.2 Naar het Voorraad-scherm gaan

**Pad:** Dashboard linker zijbalk → **Voorraad**.

U komt op de tab **Alle producten**. Het scherm heeft twee tabs:

| Tab | Toont | Wanneer gebruiken |
|---|---|---|
| **Alle producten** | Elk actief product, met huidige voorraad + drempel. Zoekbaar op naam of barcode. Gepagineerd 30 per pagina. | Routine-reviews, een specifiek product vinden om aan te passen. |
| **Lage voorraad (N)** | Alleen producten op of onder hun `low_stock_threshold` (of op nul). Geen paginatie — gecapt op 50. | Uw ochtendveeg, bijbestelplanning, het scherm dat u opent als de dashboardoverzicht-tegel zegt "12 laag / 3 op". |

Een **gele banner** zit bovenaan de Alle-producten-tab altijd wanneer de lage-voorraadlijst niet leeg is — zelfs als u niet op die tab bent. Hij bevat een knop "Nu beoordelen" die u naar de tab Lage voorraad springt.

> **Waar de alert-tegel in past.** De dashboard-home (Hoofdstuk 0) toont een groene tegel wanneer alles in orde is en een gele tegel wanneer minstens één product laag of op is. Klikken erop koppelt naar de tab Lage voorraad. Het nummer op de home-tegel en het nummer in de tab-header komen uit dezelfde query — die zijn altijd eens.

---

## 8.3 Een rij lezen

![08 voorraadrij-badges](screenshots/08-stock-row-badges.png)
Elke rij in de tabel vertelt u in één oogopslag vier dingen:

| Element | Betekenis |
|---|---|
| **Productnaam** (NL of EN afhankelijk van uw locale) | Klikdoel voor de actieknoppen. Barcode eronder in monospace. |
| **Categorie** | Nederlandse naam wanneer uw locale `nl` is, Engels wanneer `en`. `—` als er geen categorie is. |
| **Voorraad** | Huidige hoeveelheid. Gekleurd groen (gezond), amber (laag) of rood (op). Achterloop-nullen weggestript — u ziet `12`, niet `12.000`. |
| **Min. drempel** | De `low_stock_threshold` voor dit product in deze vestiging. `—` indien niet ingesteld. |

En twee **badges** wanneer relevant:

| Badge | Kleur | Trigger | Wat het betekent |
|---|---|---|---|
| **LAAG** | Amber `#f59e0b` | `0 < stock_qty ≤ low_stock_threshold` en `threshold > 0` | Binnenkort bijbestellen. Verkopen gaan nog steeds door. |
| **OP** | Rood `#dc2626` | `stock_qty ≤ 0` | Kassiers zien een inline-waarschuwing in de POS; verkopen zijn nog steeds mogelijk (Josbin POS blokkeert over-verkoop niet hard — u kunt verkopen vanuit een backstock die u vergat te ontvangen). |

De hele rij krijgt ook een pastelrode/amber achtergrond zodat u een drukke pagina kunt scannen zonder nummers te lezen. **OP wint van LAAG** — een nul-voorraadrij wordt nooit geel geverfd, alleen rood.

> **De drempel is een *vestiging-specifieke* instelling**, geen hoofdcatalogus-instelling, ook al wordt die getoond in de tabel naast de productnaam. Twee filialen van dezelfde keten kunnen verschillende drempels draaien voor "Brood Wit" afhankelijk van bakdag-cadens. De standaard wanneer een nieuwe vestiging een rij krijgt, is de `low_stock_threshold` van het hoofdproduct (die `0` is als u er nooit een instelde — betekent "geen alert" voor dat product).

---

## 8.4 Voorraad aanpassen — de alledaagse werkstroom

Gebruik dit wanneer voorraad fysiek is verplaatst en het systeem het nog niet weet — een levering ontvangen, breuk / vervaltermijn / diefstal afschrijven, een telling repareren na een voorraadtelling, of openingsvoorraad laden wanneer een nieuw filiaal live gaat.

**Pad:** Voorraad-scherm → vind het product (zoek op naam of barcode) → tik op **+ Aanpassen**.

![08 aanpassen-modal](screenshots/08-adjust-modal.png)
Het Aanpassen-modal opent. Vul in:

| Veld | Verplicht | Opmerkingen |
|---|:-:|---|
| **Aanpassing** | ✅ | Voorzien getal. Positief = ontvangen (`+50`). Negatief = afschrijven (`-5`). Nul wordt afgewezen — er is geen punt om een no-op te registreren. |
| **Reden** | ✅ | Kies een van de drie. Zie de tabel hieronder. |
| **Notitie** | optioneel maar verwacht voor afschrijvingen | Vrije tekst tot 500 tekens. Zichtbaar voor elke latere kijker van de bewegingsgeschiedenis en voor de auditor. bv. `factuur 2026-04-28`, `bedorven voorraad — 3 yoghurts`, `voorraadtelling — telling 47, systeem 50`. |

Het modal previewt **Nieuwe voorraad** terwijl u typt zodat u de wiskunde sanity-checken kunt. Is het resultaat negatief, dan wordt de preview rood — maar dat is alleen een waarschuwing. De save gaat nog steeds door en de opgeslagen hoeveelheid wordt server-side op `0` geklemd.

### De drie redenen die u kunt kiezen

| Reden-waarde | Nederlands label | Engels label | Wanneer kiezen |
|---|---|---|---|
| `import` | *Levering ontvangen* | *Stock received* | Een doos kwam net van uw leverancier. Altijd positief. Notitieveld moet verwijzen naar het factuurnummer. |
| `adjustment` | *Correctie* | *Correction / write-off* | Iets anders — bedorven, gebroken, gestolen, mis-geteld, gevonden in de achterkamer, geschonken. Positief **of** negatief. Notitieveld wordt sterk aanbevolen. |
| `initial` | *Beginsaldo* | *Opening stock* | Eerste keer laden in een nieuw filiaal, of een eenmalige rebase na een volledige fysieke voorraadtelling aan jaareinde. |

> **Er is geen `sale` / `void` / `refund`-optie in het keuzemenu.** Die redenen bestaan in het grootboek maar worden alleen door het systeem zelf geschreven wanneer een verkoop gebeurt — u kunt er geen vervalsen vanuit dit scherm.

Wanneer u tikt op **Opslaan**, gebeuren drie dingen atomair:

1. De `product_stocks`-rij voor deze (product, huidige vestiging) krijgt de nieuwe hoeveelheid.
2. Een `stock_movements`-rij wordt geschreven met uw gebruikers-ID, de reden, de optionele notitie en een snapshot van de resulterende hoeveelheid.
3. Het Voorraad-scherm, de Lage-voorraad-lijst, de dashboardoverzicht-tegel en het bewegingsgeschiedenis-modal verversen allemaal.

> **Per-vestiging valkuil.** Het Voorraad-scherm zoals momenteel uitgeleverd werkt tegen de actieve vestigingscontext voor managers en tegen een org-breed aggregaat voor OA. Wanneer de onderliggende API de aanpassing doet, vereist die een expliciete `store_id`. Beheert u meerdere vestigingen en moet u voorraad ontvangen in een *specifieke* vestiging, schakel dan eerst uw vestigingscontext (vestigingspicker rechtsboven) — anders landt de aanpassing op het verkeerde schap.

### Een levering ontvangen — het juiste patroon

1. De truck arriveert. Tel de kartonnen tegen de pakkettenlijst van de leverancier zoals ze van de truck komen.
2. Voor elk regel-item dat matcht met de pakkettenlijst:
   - Zoek het product op het Voorraad-scherm op barcode (USB-scanner: focus gewoon het zoekvak en haal de trekker over).
   - Tik op **+ Aanpassen**.
   - Aanpassing: `+<aantal>` (positief).
   - Reden: `Levering ontvangen`.
   - Notitie: de factuur- of pakkettenlijst-referentie, bv. `factuur LIDL-2026-04-28`.
   - Opslaan.
3. Verschillen (5 verwacht, 4 in doos) — ontvang wat daadwerkelijk is, en dien dan een credit-notaverzoek in bij de leverancier. Doe niet alsof u 5 heeft ontvangen omdat het papierwerk dat zegt. Het auditlogboek vangt de leugen zes weken later wanneer iemand een voorraadtelling draait.

### Afschrijven — het juiste patroon

1. Neem de bedorven / gebroken / vervallen voorraad apart.
2. Op het Voorraad-scherm, vind elk item.
3. Aanpassing: `-<aantal>` (negatief). Reden: `Correctie`. Notitie: een specifieke reden — *geen* alleen "shrinkage".
4. Opslaan.
5. Verwijder de voorraad fysiek zodat die niet per ongeluk terug op het schap kan komen.

> **Waarom notities ertoe doen.** "Aanpassing: −12" zonder notitie is onbeantwoordbaar in een kwartaal-review. "Aanpassing: −12 — vervallen aardbeienyoghurts, batch L-44, gevonden bij 09:00 voorraadtelling" is auditeerbaar. Streef naar het tweede.

---

## 8.5 Bewegingsgeschiedenis bekijken

Elk product draagt een volledig grootboek van elke voorraadwijziging sinds de rij voor het eerst werd aangemaakt. Om die te lezen: Voorraad-scherm → rij → knop **Historie**.

![08 historie-modal](screenshots/08-history-modal.png)
Het modal lijst de meest recente 50 bewegingen nieuwste-eerst:

| Kolom | Toont |
|---|---|
| **Datum** | Gelocaliseerde korte datum (NL: `26 mei`; EN: `May 26`). Tijd wordt *niet* getoond — open het auditlogboek (Hoofdstuk 13) voor seconde-precisie timestamps. |
| **Reden** | Een van zes waarden, zie tabel hieronder. Notities (indien aanwezig) verschijnen op een tweede regel in grijs. |
| **Wijziging** | De delta. Groen indien positief, rood indien negatief, met een voorloop `+` voor duidelijkheid. |
| **Voorraad** | `qty_after` — het lopende totaal **na** dat deze beweging is toegepast. Laat u de schap-staat op elk punt in het verleden reconstrueren zonder uw weg de lijst af te trekken. |
| **Door** | De gebruiker die de wijziging triggerde. `—` (systeem) voor automatische catch-up jobs (zeldzaam). |

### De zes reden-waarden

| Reden | Oorsprong | Teken | Betekenis |
|---|---|---|---|
| `sale` | POS — een verkoop voltooid | Negatief | Een kassier heeft het product aan de kassa afgerekend. |
| `void` | POS — een vastgehouden bon geannuleerd of een verkoop geannuleerd vóór printen | Positief | De reservering werd teruggegeven aan het schap. |
| `refund` | Manager — terugbetaling uitgegeven via de POS | Positief | De klant bracht goederen terug; voorraad hersteld. |
| `adjustment` | Dashboard — manager-aanpassing via dit scherm | Beide | Verzamelterm voor afschrijvingen, correcties, vondsten. |
| `import` | Dashboard — "Levering ontvangen" vanuit dit scherm, of CSV-import (Hoofdstuk 5) | Positief | Levering arriveerde. |
| `initial` | Dashboard — openingsvoorraad in een nieuw filiaal | Positief | Eerste keer dat het systeem ooit voorraad zag voor deze (product, vestiging). |

> **Waarom geen "bewerken"-knop op historie-rijen?** Omdat de tabel het niet toestaat — `static::updating(fn () => false)` op het `StockMovement`-model. Schreef u het verkeerde getal op, dan is uw enige toevlucht *een corrigerende beweging aanmaken* die de fout uitlegt. Zowel het origineel als de correctie blijven voor altijd. Dit is wat een auditor wil zien.

---

## 8.6 De lage-voorraaddrempel instellen en afstemmen

De `low_stock_threshold` voor een product in een specifieke vestiging bepaalt wanneer de amber LAAG-badge verschijnt.

| Waar u die instelt | Pad | Scope |
|---|---|---|
| Hoofdstandaard (toegepast op nieuwe vestigingen) | Catalogus → Producten → Bewerk een product → veld `low_stock_threshold` | Org-brede standaard — alleen gebruikt om *nieuwe* (product, vestiging)-rijen te seeden. |
| Vestigingsspecifieke override | *(momenteel niet zichtbaar in de dashboard-UI als standalone editor)* — indirect ingesteld via de catalogusstandaarden plus de per-vestiging rij die bij eerste activiteit materialiseert. | Per (product, vestiging). |

In de huidige release is de praktische regel:

1. Stel verstandige org-brede standaarden in de catalogus in: brood = 5, melk = 6, sigaretten = 2, wat past bij uw wekelijkse snelheid.
2. Wanneer een nieuwe vestiging opent, worden die standaarden geërfd de eerste keer dat een beweging het product in die vestiging aanraakt.
3. Heeft een specifiek filiaal echt een andere drempel nodig (bv. Nickerie ziet een tragere brood-omloop dan Centrum), dan is dat voorlopig een leverancier-zijde aanpassing — een UI-editor voor vestigingsspecifieke drempels staat op de backlog.

**Een drempel van `0` (de standaard als u er nooit een instelde) schakelt de LAAG-badge volledig uit** voor dat product, zelfs wanneer voorraad oprecht laag is. Op-voorraad (`qty_qty ≤ 0`) wordt *altijd* gemarkeerd ongeacht drempel — het is een aparte check.

> **Zet de drempel niet te laag.** "Drempel = 1" betekent dat u de alert pas ziet wanneer er precies één over is — tegen de tijd dat u handelt, bent u al op. Streef naar "genoeg om één leveringscyclus te duren". Voor een wekelijkse broodlevering is dat een week aan verkopen.

---

## 8.7 De dashboardoverzicht-tegel — uw ochtendblik

![08 overzicht-tegel](screenshots/08-overview-tile.png)
Op de dashboard-home, net onder de vier KPI-kaarten, zit de **Voorraadalerts**-tegel. Hij heeft twee staten:

| Staat | Wanneer | Kleur | Gedrag |
|---|---|---|---|
| **Alles goed** | Geen producten laag, geen producten op | Groen — `✓ Geen waarschuwingen` | Geruststellend, niet klikbaar. |
| **Heeft alerts** | Minstens één laag of op | Geel met een rode badge voor OP-telling | Hele tegel is klikbaar + toetsenbordnavigeerbaar; klik springt naar Voorraad → tab Lage voorraad. |

De tegel ververst elke 2 minuten op de achtergrond, dus een aanpassing die u op het Voorraad-scherm maakt, weerspiegelt op de home-tegel tegen de tijd dat u terug navigeert.

> **Waar de telling vandaan komt.** De tegel vraagt het producten-endpoint om `low_stock=true` (gecapt op 200 rijen voor payload-grootte) en telt client-side: `op` is `stock_qty ≤ 0`, `laag` is `0 < stock_qty ≤ threshold`. De paginatie `total` is het gezaghebbende gecombineerde cijfer getoond in de badge.

---

## 8.8 De POS-zijde van lage voorraad

Hoewel deze handleiding voor het dashboard is, is het de moeite waard om te weten wat kassiers zien, zodat u hun vragen kunt beantwoorden.

Op de POS-app toont elke productkaart en elke winkelwagen-regel-item een kleine **gele inline-waarschuwing** wanneer het product zich in de lage-voorraadset voor de huidige vestiging bevindt. De check wordt gedreven door `useLowStockSet()` op de frontend — een aparte query tegen dezelfde `low_stock=true`-filter, gescoped op de vestiging van de kassier, gecacht voor 5 minuten.

Kassiers kunnen het product nog steeds afrekenen — Josbin POS blokkeert nooit een verkoop op een voorraadtelling omdat de telling fout kan zijn. De waarschuwing is een "vertel de manager wanneer u kans krijgt"-signaal, geen over-verkoop-preventie. Op-voorraad-producten tonen ook een scherper rode waarschuwing op de winkelwagen-regel.

> **Waarom geen harde blokkade?** Omdat klanttevredenheid wint van data-hygiëne aan de kassa. Zegt het systeem "0 over" maar er is een vergeten doos onder de balie, dan moet de kassier het kunnen verkopen en het back-office later laten verzoenen. Het auditspoor (en de volgende voorraadtelling) vangt het verschil.

---

## 8.9 Veelvoorkomende fouten / valkuilen

**Aanpassen in de verkeerde vestiging.** Voorraad is per (product, vestiging). Bent u een OA die lage voorraad over alle filialen beoordeelt, dan landt een aanpassing in de vestiging die momenteel in context is — niet in elk filiaal. Controleer altijd dubbel de vestigingspicker voor u tikt op Opslaan. Ontvangt u een levering op hoofdkantoor die naar twee filialen wordt gedistribueerd, dan heeft u *twee* aanpassingen nodig — één bij elke vestiging — niet één grote.

**De verkeerde reden gebruiken.** "Aanpassing: +50, reden: Levering ontvangen" leest voor de auditor als "dit is een levering". `adjustment` (correctie) gebruiken voor een echte levering verbergt de link naar het leverancierspapierwerk. Kies `import` wanneer een factuur bestaat; gebruik `adjustment` alleen voor afschrijvingen, correcties en vondsten.

**De notitie vergeten op een afschrijving.** Twaalf weken later weet niemand — inclusief u — meer waarom "Brie 200g" met 8 daalde op een dinsdagochtend. Het auditlogboek zal trouw vastleggen "manager X verminderde voorraad met 8 om 09:14, geen notitie". Dat is een auditreuk.

**Denken dat het deactiveren van een product de voorraad wist.** Het deactiveren van een product (Hoofdstuk 4) verbergt het van het POS-grid. Het zet `product_stocks`-rijen **niet** op nul en stopt u niet van het draaien van voorraadtellingen ertegen. Wilt u oprecht een product met pensioen sturen dat resterende voorraad heeft, schrijf dan eerst de voorraad af (`adjustment` met een notitie als `"uit verkoop genomen — oude verpakking"`) en deactiveer dan.

**Twee kassiers die "de laatste" verkopen aan dezelfde kassa.** Dit *kan niet* leiden tot over-verkoop bij één kassa — de rijlock op `product_stocks` serialiseert de twee transacties. De tweede ziet `qty_after = 0` en zou, als u hardblokkering had ingeschakeld, falen. Momenteel slaagt het en de waarde klemt op `0` — in het ergste geval heeft u één negatief-gevormd auditspoor om te verzoenen, nooit twee fantoom-verkopen.

**Voorraad gaat naar nul maar geen alert.** Indien `low_stock_threshold = 0` (de standaard) en voorraad raakt nul, dan ziet u nog steeds de **OP**-rode badge — op-voorraad wordt apart van de drempel gecontroleerd. Maar u zult *geen* LAAG amber badge zien tussen, zeg, "20 over" en "1 over". Stel een echte drempel per product in.

**Bulk-ontvangen via CSV.** Nog niet zichtbaar op het Voorraad-scherm. Voor nu is de werkstroom voor een 100-regel-factuur: scan elke barcode + pas aan. Bulk-ontvangen via CSV staat op dezelfde fase 2-backlog als de vestiging-specifieke drempel-editor — zie Hoofdstuk 5 voor de bestaande catalogus-CSV-import.

---

## 8.10 Wat in het auditlogboek wordt vastgelegd

Elke voorraadbeweging maakt **twee** records aan:

1. **Een `stock_movements`-rij** — het operationele grootboek. Direct beschikbaar vanuit het Historie-modal (§8.5) en vanuit `GET /api/products/{id}/stock-history`. Alleen-toevoegen op de modellaag (`static::updating(fn () => false)` en `static::deleting(fn () => false)`).
2. **Een `audit_logs`-rij** — het compliance-grootboek, hash-geketend. Zichtbaar op het Auditlogboek-scherm (Hoofdstuk 13). Registreert: wie het deed, IP-adres, de oude en nieuwe `stock_qty`-waarden, de reden, de notitie. Kan door *niemand* worden gewijzigd of verwijderd, inclusief Super Admin.

Verkopen, annuleringen en terugbetalingen maken ook beide records aan. Bij twijfel is het auditlogboek de canonieke "wat is er echt gebeurd"-view; de voorraadbeweging-historie is de handige per-product-view.

> **Voor Rekenkamer-compliance:** de ondertekende PDF-export (Hoofdstuk 13) bevat alle voorraadbewegingen met een reden van `adjustment`, `import` of `initial` — d.w.z. elke handmatige interventie door een mens. Verkoop-gedreven bewegingen (`sale`, `void`, `refund`) zijn afleidbaar uit de transactiegeschiedenis en worden niet gedupliceerd in de voorraadsectie van de export.

---

## 8.11 Snelreferentie

```
VOORRAAD-SCHERM OPENEN  Dashboard → zijbalk → Voorraad
ALLEEN LAGE VOORRAAD    Boven-pagina gele banner → "Nu beoordelen"
                        OF Voorraad-scherm → tab Lage voorraad
                        OF Dashboard-home → gele Voorraadalerts-tegel

VOORRAAD AANPASSEN      Voorraad-scherm → vind product → + Aanpassen
                        → voer voorzien aantal + reden + notities in → Opslaan

LEVERING ONTVANGEN      Voorraad-scherm → scan barcode → + Aanpassen
                        → +aantal, reden: Levering ontvangen, notitie: factuurref → Opslaan

AFSCHRIJVING            Voorraad-scherm → vind product → + Aanpassen
                        → −aantal, reden: Correctie, notitie: specifieke reden → Opslaan

BEWEGINGSGESCHIEDENIS BEKIJKEN  Voorraad-scherm → rij → Historie
                                Nieuwste 50, alleen-toevoegen, inclusief gebruiker + notities

HOOFDDREMPEL INSTELLEN  Catalogus → Producten → Bewerken → low_stock_threshold
                        Toegepast op nieuwe (product, vestiging)-paren als standaard
```

Voor alles waar boven naar wordt kruisverwezen: zie [Hoofdstuk 1 — Rollen en rechten](01-roles-and-permissions.md) voor wie kan aanpassen vs bekijken, [Hoofdstuk 4 — Catalogus en categorieën](04-catalogue-and-categories.md) voor het instellen van de hoofd-`low_stock_threshold`, en [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) voor de hash-geketende compliance-view van elke aanpassing.

---

→ Volgende: [Hoofdstuk 9 — Klanten](09-customers.md)
