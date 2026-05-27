# Hoofdstuk 7 — Kortingsregels

**Voor wie:** **Organisatiebeheerder** (stelt regels in over de hele org of gescoped op één vestiging) en **vestigingsmanager** (aanmaken, bewerken, deactiveren van regels voor hun eigen vestiging). Kassiers zien actieve regels bij verkooptijd maar kunnen ze niet aanmaken — per ontwerp, zie [de rechtenmatrix van Hoofdstuk 1](01-roles-and-permissions.md#13-the-permission-matrix).

**Wanneer u het doet:** een Moederdagpromotie draaien (10% korting op alle bakkerij gedurende een week), een permanente seniorenkorting op één productcategorie, een concurrent matchen op de cola-prijs van één vestiging voor het weekend, of een "koop 5 krijg er 1 gratis" voorraad-uitverkoop op een uitgefaseerde lijn.

**Waarom dit pijn voorkomt:** zonder kortingsregels zou elke kassier handmatige regel- of basket-kortingen toepassen op basis van een geprint memo — en u zou alle traceerbaarheid kwijtraken ("waarom gaf Kassa 3 15% aan die klant?"). Met regels is de korting **automatisch**, **begrensd**, **tijdgevensterd** en **gelogd**.

![07 lijst kortingsregels](screenshots/07-discount-rules-list.png)
---

## 7.1 Wat een kortingsregel doet

Een regel is een kleine set voorwaarden plus een actie:

```
WANNEER  de winkelwagen een matchend product (of categorie of wat dan ook) bevat
EN       de huidige datum binnen het [valid_from, valid_to]-venster van de regel valt
EN       de regel is_active = true
DAN      verminder de regelprijs met X procent  -OF-
         verminder de regelprijs met SRD X     -OF-
         pas een koop-X-krijg-Y-gratis-patroon toe
```

De regel wordt geëvalueerd **aan de POS, op het moment dat de kassier een product toevoegt of de verkoop afrekent**. Het wijzigt niet de hoofdprijs in de catalogus; het laat de hoofdprijs zichtbaar op de bon en voegt eronder een regel **Korting** toe. Dat is het formaat dat Belastingdienst verwacht op elke bon — de BTW wordt vervolgens herberekend op het gediscounte bedrag (Surinaamse regel: korting vóór BTW-extractie).

### De drie "van toepassing op"-scopes

Het `applies_to`-veld van de regel bepaalt welk soort winkelwagenitem het volgt:

| Dashboard-formulierwaarde | Backend canonieke waarde | Activeert op | Voorbeeld |
|---|---|---|---|
| **Alle producten** | `cart` | Elke regel in de winkelwagen. Effectief een winkelwagen-niveau korting. | "10% korting op alles tot eind mei." |
| **Categorie** | `category` | Winkelwagenregels waarvan het product tot de gekozen categorie behoort. | "15% korting op alle Bakkerij op zondagen." |
| **Specifiek product** | `product` | Eén specifiek product (gematcht op `applies_to_id`). | "SRD 2 korting op Cola 1.5L." |

> **Eén subtiel verschil om te weten:** het dashboardformulier labelt de winkelwagenbrede scope als **Alle producten**, terwijl de onderliggende API het opslaat als `cart`. Hetzelfde ding. Bevraagt u ooit de database direct of roept u de API aan vanuit een derde-partij-tool, verwacht dan `cart` te zien, niet `all`.

### De drie kortingstypes

Het `type`-veld van de regel bepaalt hoe de korting wordt berekend:

| Dashboard-formulierwaarde | Backend canonieke waarde | Wat `value` betekent | Wanneer te gebruiken |
|---|---|---|---|
| **Percentage (%)** | `pct_discount` | `10` = 10% korting. De cap `max_discount_srd` legt een plafond in SRD. | De meeste promoties. Zelf-schalend met prijs. |
| **Vast bedrag (SRD)** | `fixed_discount` | `5.00` = SRD 5,00 korting op de regel, per eenheid. | "SRD 5 korting op elke cola" — werkt ongeacht cola-variant prijsstelling. |
| **(alleen API)** | `buy_x_get_y` | `value` = de gratis hoeveelheid. `min_qty` = de koopdrempel. | "Koop 5 krijg er 1 gratis" voorraadopruiming. Nog niet zichtbaar in het dashboardformulier — zie §7.9. |

> Net als bij de scope vereenvoudigt het formulier de labels. Achter de schermen slaat de backend de canonieke `pct_discount` / `fixed_discount` / `buy_x_get_y` op. De vertaling gebeurt server-side bij opslaan.

### De vestigings-scope (org-breed vs vestiging-specifiek)

Elke regel behoort tot een organisatie. Daarnaast heeft elke regel een optionele `store_id`:

- `store_id = null` (de standaard bij aanmaken vanuit het huidige dashboardformulier) → **van toepassing op elke vestiging in de org**.
- `store_id = <één vestiging>` → **van toepassing alleen in die vestiging**. Ingesteld via API of een ontwikkelaar; het huidige formulier toont dit keuzemenu niet.

De door vestigingsmanager aangemaakte regels worden automatisch gescoped op hun vestiging; OA-regels zijn standaard org-breed tenzij gewijzigd. Dit betekent dat een vestiging-specifieke seniorenpromotie alleen in dat filiaal brandt — handig om een lokale concurrent te matchen zonder over de keten te spillen.

---

## 7.2 De entiteiten

| Tabel | Doel | Sleutelkolommen |
|---|---|---|
| `discount_rules` | Eén rij per regel. | `id`, `organisation_id`, `store_id` (nullable), `name`, `applies_to`, `applies_to_id`, `type`, `value`, `min_qty`, `max_discount_srd`, `stackable`, `is_active`, `valid_from`, `valid_to`, `created_by` |

Foreign keys cascaden: verwijder een organisatie → regels weg. Verwijder een vestiging → regels die *alleen* aan die vestiging toebehoren worden ontkoppeld (gezet op `null`, wat ze org-breed maakt — wees hiervan bewust). Een product of categorie verwijderen waar een regel naar wijst via `applies_to_id` breekt de regel niet; het stopt gewoon met matchen totdat u `applies_to_id` repareert.

De **`scopeActive`** model-scope (gebruikt door de POS wanneer die vraagt om "regels om nu toe te passen") retourneert alleen regels waar:

```sql
is_active = true
AND (valid_from IS NULL OR valid_from <= now())
AND (valid_to   IS NULL OR valid_to   >= now())
```

— geëvalueerd in **AST** (America/Paramaribo, UTC-3), de systeem-brede tijdzone voor alle timestamps.

---

## 7.3 Stap voor stap — een percentageregel aanmaken

**Pad:** Dashboard → zijbalk → **Kortingsregels**.

![07 nieuw regel-modal](screenshots/07-new-rule-modal.png)
1. Rechtsboven op het scherm → **+ Nieuwe regel**.
2. Het modal opent. Vul in:

   | Veld | Wat typen | Opmerkingen |
   |---|---|---|
   | **Naam** | `Zomerkorting 10%` | Mensleesbaar. Toont in de regellijst en op het auditlogboek. Niet gezien door de klant. Max 200 tekens. |
   | **Type korting** | `Percentage (%)` | Standaard. Opgeslagen als `pct_discount` op de backend. |
   | **Waarde** | `10` | Het percentage. `10` betekent 10% korting. |
   | **Van toepassing op** | `Alle producten` | Winkelwagenbreed. (Of kies Categorie / Specifiek product — zie §7.4.) |
   | **Min. aantal** | leeg laten voor "geen minimum" | Indien ingesteld (bv. `5`), vuurt de regel alleen wanneer het regel-aantal de drempel haalt. Decimalen toegestaan (`2.5` kg). |
   | **Max. korting (SRD)** | leeg laten voor "geen cap" | Indien ingesteld (bv. `50.00`), zou een 10%-regel op een SRD 800-verkoop nog steeds maar SRD 50 korting geven. Handige vangrail. |
   | **Geldig vanaf** | `2026-06-01` | Datumkiezer. Leeg laten voor "geen start". Opgeslagen als middernacht AST. |
   | **Geldig tot** | `2026-06-30` | Leeg laten voor "geen eind". Moet ≥ geldig-vanaf zijn. |
   | **Stapelbaar met andere kortingen** | niet aangevinkt (standaard) | Niet aangevinkt, combineert deze regel *niet* met andere vurende regels — het systeem kiest er één. Bedoelt u "deze regel speelt goed met de loyaliteitsregel", vink dan aan. |
   | **Actief** | aangevinkt (standaard) | Vink uit om een concept op te slaan. |

3. Klik op **Opslaan**.
4. De regel verschijnt in de tabel gesorteerd op aangemaakt-op (nieuwste eerst), met statuspil **Actief** in groen.
5. De volgende verkoop aan elke kassa in de organisatie zal die toepassen — POS leest actieve regels bij elke winkelwagenwijziging.

---

## 7.4 Stap voor stap — een categorie-gescopde regel

Uitgewerkt voorbeeld: 15% korting op elk bakkerijproduct, elke dag, geen einddatum.

1. **+ Nieuwe regel.**
2. Naam: `Bakkerij — vaste 15% korting`.
3. Type: `Percentage (%)`; Waarde: `15`.
4. Van toepassing op: **Categorie**.
5. Een nieuw veld **ID van categorie/product** verschijnt eronder.
6. **Vind de UUID van de categorie.** Dit is het ongemakkelijke stuk — het huidige formulier verwacht dat u de UUID plakt:
   - Open een nieuw browsertabblad.
   - Ga naar **Catalogus → Categorieën**.
   - Rechtermuisklik op de knop *Bewerken* voor "Bakkerij" → *Element inspecteren*, of bekijk de URL na klik op bewerken — de UUID verschijnt in de API-aanroep.
   - Of vraag een ontwikkelaar om die te lezen uit `SELECT id FROM categories WHERE organisation_id = … AND name_nl = 'Bakkerij'`.
7. Plak de UUID in het veld.
8. Laat Min. aantal, Max. korting en de datumrange leeg (het is een permanente regel).
9. **Stapelbaar** uit — bakkerijklanten mogen niet dubbel scoren met de org-brede regel.
10. **Opslaan.**

De eerste kassier die na opslaan een bakkerij-item scant, ziet de kortingsregel op de winkelwagen.

> **De UUID-plak-stap is een bekend ruw randje.** Een categorie/product-picker staat op de roadmap. Tot dan is de omweg gedocumenteerd in de ruwe-randjes-sectie (§7.10).

---

## 7.5 Stap voor stap — een product-gescopde tijdgelimiteerde regel

Uitgewerkt voorbeeld: SRD 2 korting op Cola 1.5L voor één weekend (za 1 juni tot zo 2 juni 2026).

1. **+ Nieuwe regel.**
2. Naam: `Cola weekend deal — 1-2 juni`.
3. Type: **Vast bedrag (SRD)**.
4. Waarde: `2.00` (SRD 2 korting per eenheid).
5. Van toepassing op: **Specifiek product**.
6. ID van product: plak de UUID van het product (zelfde UUID-vind-omweg als §7.4 — maar voor Catalogus → Producten).
7. Min. aantal: leeg laten.
8. Geldig vanaf: `2026-06-01`. Geldig tot: `2026-06-02`.
9. Actief: ✓. Stapelbaar: uit laten.
10. **Opslaan.**

Na zondagnacht verloopt de regel automatisch — de `scopeActive`-check faalt (`valid_to < now()`), en de POS stopt met toepassen zonder dat iemand iets hoeft aan te raken. De regelrij blijft in de tabel staan voor het auditspoor; u ziet die als **Inactief** in grijs op maandagochtend.

> Het dashboard verwijdert verlopen regels **niet** automatisch. Ze zitten in de tabel als permanente registratie. Wilt u dezelfde promotie volgend jaar opnieuw draaien, bewerk dan de datums en heractiveer — geen noodzaak om opnieuw aan te maken.

---

## 7.6 Schakelen, bewerken en verwijderen

De tabel onderaan het scherm toont elke regel gegroepeerd op status — actieve regels eerst (volledige opaciteit), inactieve eronder bij 50% opaciteit.

| Actie | Waar | Wat het doet |
|---|---|---|
| **Actief wisselen** | Statuspil in de rij (`Actief` / `Inactief`) | Eén klik. Actieve regels stoppen direct met vuren; inactieve regels beginnen direct met vuren. Geen herladen nodig aan de kassa's (regels worden bij elke verkoop opgevraagd). |
| **Bewerken** | Grijze knop *Bewerken* in de rij | Opent hetzelfde modal, vooringevuld. Opslaan vervangt de bestaande rij. |
| **✕ Verwijderen** | Rode knop ✕ in de rij | Bevestigingsprompt. Verwijdert de regelrij permanent. **Eerdere verkopen worden niet beïnvloed** — de korting die ze registreerden is onderdeel van het onveranderlijke verkooprecord. |

Heeft u een fout gemaakt op een verse regel, dan is **verwijderen prima**. Heeft u de regel een tijdje draaien en wilt u die met pensioen sturen, **schakel dan naar Inactief** in plaats van te verwijderen — op die manier blijft de geschiedenis van de regel (en de link uit eerdere verkopen die zeggen "deze regel vuurde hier") betekenisvol.

---

## 7.7 Hoe regels met elkaar combineren

U kunt tegelijk veel actieve regels hebben. Wanneer een kassier een product afrekent, doet de POS:

1. Vraagt de backend om alle regels waar `is_active = true` EN `now()` binnen het geldigheidsvenster is EN de vestigings-scope van de regel matcht (deze vestiging *of* null).
2. Splitst ze in de drie prioriteitsbuckets:
   ```
   Bucket 1: product-specifieke regels (applies_to = 'product', applies_to_id = dit product)
   Bucket 2: categorieregels           (applies_to = 'category', applies_to_id = de categorie van dit product)
   Bucket 3: winkelwagen-niveau regels (applies_to = 'cart')
   ```
3. Voor elke bucket kiest **de enkele best-matchende niet-stapelbare regel** OF — indien `stackable = true` — behoudt alle matchende regels.
4. Past de kortingen toe in volgorde (Bucket 1 → 2 → 3) zodat een product-specifieke deal voorrang heeft op een categorieregel, die voorrang heeft op een winkelwagen-brede regel.
5. Herberekent BTW op de **gediscounte** regeltotalen — Surinaamse belastingregel is *korting vóór BTW-extractie*.

In de praktijk: **laat Stapelbaar uit** tenzij u zorgvuldig heeft nagedacht over hoe twee regels interageren. Dubbelstapelen is de makkelijkste manier om een klant 30% korting te geven terwijl u 10% bedoelde.

De **`max_discount_srd`**-cap is uw vangnet op percentage-regels. Een `10%`-regel met `max_discount_srd = 50.00` op een SRD 800-winkelwagen kost u nog steeds maar SRD 50 — zonder die zou u SRD 80 weggeven.

---

## 7.8 Wat de kassier ziet (en wat de bon toont)

Vanaf de kassa-zijde zijn kortingsregels onzichtbaar totdat ze vuren. Wanneer dat gebeurt:

- De winkelwagenregel toont de originele prijs doorgestreept, met de kortingsprijs eronder.
- Een klein opschrift **Korting** toont de regelnaam (`Bakkerij — vaste 15% korting`) zodat de kassier weet waarom de prijs veranderde.
- Het subtotaal op de bon toont het **bruto subtotaal** (vóór korting), dan een **Korting**-regel, dan **Subtotaal na korting**, dan BTW, dan totaal.

Dit is het formaat dat Belastingdienst Suriname verwacht voor bonnen waarop kortingen zijn toegepast. De regel is niet optioneel — bakt u de korting in de regelprijs en slaat u de kortingsregel over, dan matcht uw BTW-rapport niet.

Een kassier kan ook een **handmatige** regel- of verkoop-niveau korting bovenop toepassen — dat is een ander mechanisme (zie [Hoofdstuk 8 van de POS-handleiding](../user_manual/08-discounts.md)). Kortingsregels worden eerst toegepast; handmatig daarbovenop.

---

## 7.9 Het koop-X-krijg-Y regeltype

De backend ondersteunt een derde regeltype, `buy_x_get_y`, gebruikt voor "koop 5 krijg er 1 gratis"-patronen:

```
type:    buy_x_get_y
value:   1           ← de gratis hoeveelheid
min_qty: 5           ← de koopdrempel
```

Wanneer de winkelwagen 5 eenheden van het matchende product bevat (of 10, of 15), wordt één (of twee, of drie) eenheden waarde aan regelprijs verwijderd als korting.

Het huidige dashboardformulier **toont dit type niet** — het keuzemenu biedt alleen `Percentage` en `Vast bedrag` aan. Om vandaag een koop-X-krijg-Y-regel aan te maken, moet een ontwikkelaar direct naar `/api/discount-rules` POSTen. Een formulieroptie staat op de roadmap.

---

## 7.10 Bekende ruwe randjes (en de omwegen)

| Ruw randje | Omweg |
|---|---|
| Categorie- / productvelden vragen om een UUID, geen picker. | Open Catalogus in een apart tabblad, vind de entiteit, kopieer de UUID uit de URL na bewerken. Of gebruik het netwerk-paneel van de browser om de ID te vangen. Een picker staat op de roadmap. |
| Het "Van toepassing op"-keuzemenu labelt `Alle / Categorie / Product` maar de API slaat op als `cart / category / product`. | Cosmetisch — geen actie nodig. Bevraagt u de database, verwacht dan `cart`. |
| Het "Type"-keuzemenu labelt `Percentage / Vast` maar de API slaat op als `pct_discount / fixed_discount`. | Cosmetisch — geen actie nodig. Roept u de API direct aan, gebruik dan de canonieke namen. |
| Het dashboard toont niet op welke vestiging(en) een regel is gescoped — elke regel lijkt org-breed. | Het huidige formulier maakt altijd org-brede regels. Vestigings-scope vereist API. De tabel-kolom-met-vestigingspil staat op de roadmap. |
| `buy_x_get_y` is niet beschikbaar in het formulier. | Gebruik de API. Zie [Hoofdstuk 12 — API-integraties en webhooks](12-api-integrations-and-webhooks.md). |
| Verlopen regels zitten in de tabel als Inactief; de lijst groeit in de tijd. | Dit is bewust voor het auditspoor. Filter de regellijst visueel, of verwijder echt verouderde regels (de eerdere verkopen blijven onaangeroerd). |
| Twee managers maken regels met dezelfde naam. | Namen zijn niet uniek afgedwongen. Gebruik een datum- of vestigingsprefix (`Nickerie — Bakkerij 15%`) om verwarring te voorkomen. |
| U stelt `min_qty = 5` in denkend dat het "minimaal 5 SRD" betekent. | `min_qty` is de **hoeveelheid**-drempel, niet de prijsdrempel. Er is geen "minimum verkoopwaarde"-regeltype in deze release. |

---

## 7.11 Veelvoorkomende fouten

| Symptoom | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| Regel toont **Actief** maar vuurt niet aan de kassa | Geldigheidsvenster al in het verleden, OF u bent in een vestiging die niet matcht met de `store_id` van de regel, OF de product/categorie-UUID is fout. | Controleer de datums. Indien in venster, controleer de UUID — plak die terug in Catalogus zoeken om te bevestigen dat die wijst op wat u denkt. |
| Regel vuurt twee keer (klant krijgt 20% korting in plaats van 10%) | Twee regels matchen beide dit product en minstens één is gemarkeerd als **Stapelbaar**. | Bewerk de regels en zet stapelbaar uit op degene die niet zou moeten compounderen. |
| Percentageregel van 100% werd toegepast (item ging gratis) | Iemand typte `100` in Waarde. Of een typo `1000` werd ergens geklemd. | Bewerk de waarde. Stel een `max_discount_srd`-cap in als gordel-en-bretels. |
| Korting verschijnt aan één kassa maar niet aan een andere | Verbonden POS-terminal is offline of heeft regels niet opnieuw opgehaald sinds de schakelaar. | De meeste kassa's halen opnieuw op bij elke verkoop; een harde verversing op de offline terminal lost het op zodra die terug online is. |
| U stelt Geldig tot = 1 juni 2026 in en de regel stopt met vuren op de ochtend van 1 juni, niet aan het einde van 1 juni | De datum wordt opgeslagen als middernacht AST. "Geldig tot" is inclusief van de datum maar op 00:00. | Wilt u een regel *door* 1 juni actief, stel dan Geldig tot = `2026-06-02` in. |
| U schakelde een regel uit maar een verkoop die al in uitvoering was toen de schakelaar gebeurde, kreeg toch de korting | Regels worden geëvalueerd wanneer de regel wordt toegevoegd, niet bij afrekenen. | De schakelaar beïnvloedt alleen nieuwe winkelwagenregels die ná de schakelaar zijn toegevoegd. Bestaande winkelwagens behouden wat ze hadden. |
| Negatieve-bedrag-waarde wordt afgewezen | De validator vereist `value >= 0.01`. Kortingen kunnen niet nul of negatief zijn. | Wilt u nul korting, deactiveer dan de regel. Wilt u een prijs*verhoging* (toeslag), dan is dat geen kortingsregel — gebruik een vestigingsspecifieke prijsoverschrijving ([Hoofdstuk 6](06-pricing-and-per-store-overrides.md)). |
| U klikt Opslaan en krijgt *"applies_to_id is verplicht wanneer applies_to product of category is"* | U koos `Categorie` of `Specifiek product` maar liet het UUID-veld leeg. | Plak de UUID. Of wijzig `Van toepassing op` naar `Alle producten`. |

---

## 7.12 Wat in het auditlogboek wordt vastgelegd

Elke kortingsregel-mutatie is een hoge-impact-event — een misgeconfigureerde regel kan in een weekend duizenden SRD weggeven voor iemand het merkt. De audit-pipeline registreert:

- De **actie** (`created`, `updated`, `deleted` of `is_active` geschakeld).
- De **gebruiker** die de wijziging maakte (hun dashboard-account + IP-adres).
- De **organisatie** en (indien gescoped) **vestiging**.
- De **voor en na** JSON van elk veld — `name`, `type`, `value`, `min_qty`, `max_discount_srd`, `stackable`, `is_active`, `valid_from`, `valid_to`.
- De **timestamp** in AST.

Daarnaast registreert elke verkoop welke regels op haar vuurden (in de kortingsbreakdown van de verkoopregel) — dus de vraag *"waarom gaf Kassa 2 15% korting op transactie #4523?"* heeft een antwoord: "regel `Bakkerij — vaste 15% korting` (uuid: …) was actief en de winkelwagen bevatte twee bakkerij-items".

Auditors en OA's kunnen beide lagen zien in [Hoofdstuk 13 — Auditlogboek](13-audit-log.md). Het auditlogboek is alleen-toevoegen — een vestigingsmanager die later betreurt dat hij een regel heeft gemaakt, kan de auditrij niet laten verdwijnen.

---

## 7.13 Rechten- en rol-samenvatting

Uit [de matrix in Hoofdstuk 1](01-roles-and-permissions.md#13-the-permission-matrix):

| Rol | Regels bekijken | Aanmaken / bewerken / verwijderen |
|---|:-:|:-:|
| Super Admin | ✅ | ✅ |
| Organisatiebeheerder | ✅ | ✅ |
| Vestigingsmanager | ✅ | ✅ (gescoped op regels die ze in hun vestiging kunnen beheren) |
| Kassier | ✅ (alleen-lezen — POS leest actieve regels bij verkooptijd) | ❌ |
| Auditor | ✅ | ❌ |
| API-integratie | ❌ | ❌ |

De backend dwingt dit af via de `discount_rules.manage`-rechtenpoort op elke mutatieroute — niet alleen in de UI. Een kassier die de API toch bereikt, krijgt een 403.

---

## 7.14 Snelreferentie

```
EEN REGEL AANMAKEN    Dashboard → Kortingsregels → + Nieuwe regel
                      → naam, type, waarde, applies_to, datums → Opslaan
EEN REGEL WISSELEN    Klik op de pil Actief / Inactief in de rij
EEN REGEL BEWERKEN    Bewerken op de rij → wijzigen → Opslaan
EEN REGEL VERWIJDEREN ✕ op de rij → Bevestigen  (gebruik Schakel Inactief in plaats daarvan
                      als de regel in echte verkopen heeft gevuurd — behoudt het spoor)

DE DRIE SCOPES        Alle producten   (backend: cart)
                      Categorie        (heeft categorie-UUID nodig in applies_to_id)
                      Specifiek product (heeft product-UUID nodig in applies_to_id)
DE DRIE TYPES         Percentage (%)            → backend: pct_discount
                      Vast bedrag (SRD)         → backend: fixed_discount
                      Koop X krijg Y (alleen API) → backend: buy_x_get_y

VANGRAILS             min_qty           = drempel-hoeveelheid om te triggeren
                      max_discount_srd  = cap per regel (gebruik dit op %-regels!)
                      stackable=false   = alleen deze regel vuurt vanuit zijn bucket
                      valid_from/to     = ISO-datum, middernacht AST, inclusief
TOEGEPAST             bij elke winkelwagenwijziging aan de kassa; herberekend per regel
                      BTW herberekend NA korting (Surinaamse regel)
ROLLEN                Super Admin · OA · Vestigingsmanager (mutaties).
                      Kassier · Auditor (alleen-lezen).
```

Vastgelopen? Zie [Hoofdstuk 4](04-catalogue-and-categories.md) voor catalogus-concepten, [Hoofdstuk 6](06-pricing-and-per-store-overrides.md) voor vestigingsspecifieke prijsoverschrijvingen (de langere-termijn neef van een tijdgelimiteerde regel), [Hoofdstuk 8 van de POS-handleiding](../user_manual/08-discounts.md) voor wat de kassier ziet, en [Hoofdstuk 13](13-audit-log.md) voor het auditspoor.

---

→ Volgende: [Hoofdstuk 16 — Licentie-operatie](16-license-operations.md) *(hoofdstukken 8-15 binnenkort beschikbaar)*
