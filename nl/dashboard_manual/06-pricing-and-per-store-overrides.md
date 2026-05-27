# Hoofdstuk 6 — Prijzen en vestigingsspecifieke overschrijvingen

**Voor wie:** de **organisatiebeheerder** (stelt de hoofdprijs in voor elk product in elk filiaal) en de **vestigingsmanager** (alleen-lezen — managers kunnen een typefout op één product herstellen volgens [Hoofdstuk 4](04-catalogue-and-categories.md), maar ze kunnen geen prijzen overschrijven voor hun eigen vestiging; dat is bewust, zie §6.9).

**Wanneer u het doet:** een filiaal openen in een andere regio met andere kostenstructuur (transport naar Nickerie is duurder dan naar Paramaribo), een vestiging-specifieke promotie draaien die *geen* algemene kortingsregel is (die leven in [Hoofdstuk 7](07-discount-rules.md)), of een lokale concurrent matchen in één filiaal zonder de rest aan te raken.

**Waarom dit pijn voorkomt:** zonder overschrijvingen zou u een aparte catalogus per vestiging moeten onderhouden — en dat is precies waarmee elke door kassiers geleide data-drift begint. Met overschrijvingen behoudt u **één hoofdcatalogus** en voegt u er een kleine lijst van "dit product, in deze vestiging, kost SRD X in plaats van"-uitzonderingen bovenop toe.

![06 prijsoverschrijvingen-scherm](screenshots/06-price-overrides-screen.png)
---

## 6.1 Het prijsmodel in één diagram

```
ORGANISATIE (Supermarkt De Hoop)
   │
   ├── hoofdcatalogus
   │     └── product "Cola 1.5L"  →  prijs SRD 18.00, BTW 10 %
   │
   └── vestigingen
         │
         ├── De Hoop — Paramaribo
         │     │  (geen override-rij voor Cola 1.5L)
         │     └── kassier rekent Cola 1.5L af → SRD 18.00 ← hoofdprijs
         │
         └── De Hoop — Nieuw Nickerie
               │  store_product_overrides-rij bestaat voor Cola 1.5L:
               │  { store_id: nickerie, product_id: cola, price_override: 20.00 }
               │
               └── kassier rekent Cola 1.5L af → SRD 20.00 ← override wint
```

**De regel is simpel, en er is maar één regel:**

> Voor een gegeven `(store_id, product_id)`-paar, als er een rij bestaat in `store_product_overrides`, wordt die prijs gebruikt. Anders wordt de hoofd-`products.price` gebruikt.

Er is geen "percentage boven hoofd", geen "regionale multiplier", geen overerving-hiërarchie buiten vestiging → hoofd. Eén rij per uitzondering, per vestiging. Makkelijk te begrijpen, makkelijk te auditen.

### Wat overschrijvingen *niet* aanraken

De override **wijzigt alleen de SRD-prijs**. Het wijzigt **niet**:

- De naam van het product (Nederlands of Engels).
- De barcode.
- Het BTW-tarief of de BTW-vrij-vlag — BTW is een beslissing van de belastingautoriteit, geen vestigingsspecifieke.
- De categorie, afbeelding of enig ander catalogusveld.
- De voorraadtelling van het product — voorraad is al per vestiging (zie [Hoofdstuk 8](08-stock-management.md)).
- Kortingsregels — die evalueren tegen welke prijs de kassa ook toont, override inbegrepen.

Moet u een ander BTW-tarief heffen per regio, dan is dat een ander product, geen override. (Suriname BTW is nationaal; dit komt bijna nooit voor.)

---

## 6.2 De entiteiten

| Tabel | Doel | Sleutelkolommen |
|---|---|---|
| `products` | Hoofdcatalogus, één rij per SKU per organisatie. | `id`, `organisation_id`, `name_nl`, `name_en`, `price` (de **hoofd**prijs), `btw_rate`, `btw_exempt` |
| `stores` | Eén rij per fysieke vestiging onder een organisatie. | `id`, `organisation_id`, `name`, `city` |
| `store_product_overrides` | Eén rij **alleen wanneer** een vestiging afwijkt van de hoofdprijs voor een product. | `store_id`, `product_id`, `price_override`, `is_active`. Uniek op `(store_id, product_id)`. |

Wanneer u een override verwijdert, ziet de kassier onmiddellijk de hoofdprijs weer. Wanneer u een product verwijdert, gaan al zijn override-rijen mee (foreign-key cascade).

---

## 6.3 Stap voor stap — één override instellen

**Pad:** Dashboard → zijbalk → **Prijsoverschrijvingen**.

![06 vestigingsselector](screenshots/06-store-selector.png)
1. Kies de **vestiging** uit het keuzemenu bovenaan.
   - Alleen Super Admin: kies eerst het **organisatie**-keuzemenu links van de vestigingsselector.
   - OA's zijn beperkt tot hun eigen organisatie — geen org-selector verschijnt.
2. Heeft deze vestiging al overschrijvingen, dan ziet u ze in de tabel — Product · Basisprijs (hoofd) · Vestigingsprijs (override) · Verschil (delta).
3. Klik op **+ Overschrijving toevoegen** (rechtsboven in het tabelgebied).
4. Het modal opent.
5. **Product** keuzemenu: kies het catalogusproduct dat u wilt overschrijven. Het keuzemenu toont de naam in uw actieve UI-taal plus de huidige hoofdprijs ter referentie (`Cola 1.5L (SRD 18.00)`).
6. **Vestigingsprijs (SRD)**: typ de nieuwe prijs in decimaal SRD, twee decimalen — bv. `20.00`.
7. Klik op **Opslaan**.
8. Het modal sluit. De nieuwe rij verschijnt in de tabel met de delta berekend (bv. `+2.00` rood gemarkeerd omdat het een prijsverhoging is; `-1.50` groen gemarkeerd omdat het een korting is).

De kassier in die vestiging ziet de nieuwe prijs bij de volgende productgrid-refresh — binnen seconden via de WebSocket-push, of direct als u op de knop **📡 Catalogus pushen** bovenaan het scherm klikt (zie §6.7).

---

## 6.4 Stap voor stap — een override bewerken

1. Prijsoverschrijvingen-scherm → vestiging is geselecteerd → vind de rij → **Bewerken**.
2. Het modal opent. Het product is vergrendeld (u kunt niet wijzigen voor welk product de override is — verwijder en voeg opnieuw toe als u dat nodig heeft). De huidige vestigingsprijs wordt getoond.
3. Wijzig de waarde **Vestigingsprijs**.
4. **Opslaan.**

De rij wordt direct bijgewerkt; de nieuwe prijs bereikt verbonden kassa's binnen seconden.

---

## 6.5 Stap voor stap — een override verwijderen (terug naar hoofdprijs)

1. Prijsoverschrijvingen-scherm → vind de rij → **✕** (rode knop).
2. Bevestig de prompt *"Verwijderen?"*.
3. De rij verdwijnt uit de tabel.

Vanaf dat moment rekent die vestiging het product af tegen de **hoofdcatalogusprijs** — er is geen aparte "gebruik hoofd"-schakelaar, verwijderen is de manier.

---

## 6.6 Uitgewerkt voorbeeld — Nickerie-transporttoeslag

Scenario: Supermarkt De Hoop runt twee vestigingen. Nickerie ligt 230 km westelijk van Paramaribo en elke truckbezorging voegt ongeveer 8% toe aan de landingskosten. Hoofdkantoor wil dat Nickerie alleen de producten markeert waar de toeslag daadwerkelijk pijn doet (hoge volumes, lage marges) — niet de hele catalogus.

**Beslismatrix** (op het hoofdkantoor opgesteld vóór het dashboard openen):

| Product | Hoofdprijs | Nickerie-prijs | Waarom |
|---|---|---|---|
| Volle Melk 1L | SRD 12,50 | SRD 13,50 | Hoog volume, breekbaar, transportgevoelig. |
| Brood Wit | SRD 6,00 | SRD 6,00 | Lokaal gebakken in Nickerie — geen override nodig. |
| Cola 1.5L | SRD 18,00 | SRD 20,00 | Volumineus, zwaar. |
| Tandpasta 100ml | SRD 14,00 | SRD 14,00 | Klein, licht — toeslag verwaarloosbaar. |
| Wasmiddel 3L | SRD 65,00 | SRD 72,00 | Zwaar. Verzendkosten per pallet. |

**Procedure:**

1. Prijsoverschrijvingen → selecteer vestiging **De Hoop — Nieuw Nickerie**.
2. **+ Overschrijving toevoegen** → Volle Melk 1L → 13.50 → Opslaan.
3. Herhaal voor Cola 1.5L → 20.00 en Wasmiddel 3L → 72.00.
4. Brood Wit en Tandpasta 100ml krijgen **geen override-rij** — die rekenen automatisch af tegen de hoofdprijs.
5. Verifieer: aan de Nickerie-kassa, scan elk product. Volle Melk moet 13,50 tonen; Brood Wit moet 6,00 tonen.

Drie rijen in `store_product_overrides`, niet vijf. Dat is het punt — overschrijvingen zijn de uitzondering, niet de regel.

---

## 6.7 De catalogus pushen naar alle POS-terminals

Elke save op het Prijsoverschrijvingen-scherm zendt automatisch een `catalogue.refresh`-signaal uit. De 📡-knop is er voor de randgevallen:

- Een terminal was offline tijdens uw bewerking en u heeft net gehoord dat die terug is.
- U heeft een lange lijst overschrijvingen gemaakt en wilt één "nu vastleggen"-puls.
- U toont een klant een demo en wilt dat elk scherm tegelijk flikkert.

**Om te pushen:**

1. Open **Catalogus** (zijbalk) → header rechtsboven → **📡 Catalogus pushen naar kassa's**. (De knop zat hier vroeger op het Prijsoverschrijvingen-scherm en is verplaatst naar Catalogus zodat hoofdkantoor kan pushen na elke catalogus- of prijswijziging vanuit één plek.)
2. De knop wisselt door drie staten:
   - `📡 Versturen…` (onderweg)
   - `✓ Verstuurd!` (succes, groen gedurende 3 seconden)
   - `✗ Fout` (mislukt, rood gedurende 3 seconden)
3. Verbonden kassa's invalideren hun productcache en halen opnieuw op van `/api/products/pos` — meestal binnen 1-2 seconden.

Dit pusht de **volledige** actieve catalogus voor de organisatie (hoofd + elke override per vestiging), niet alleen wijzigingen sinds de laatste push. Het is veilig om te spammen — in het ergste geval doen de kassa's een extra fetch.

Het antwoord bevat het aantal uitgezonden actieve producten. Heeft uw catalogus 1.247 actieve producten en geeft de push `product_count: 1247` terug, dan weet u dat de broadcast schoon is verzonden.

---

## 6.8 Waar de override-prijs daadwerkelijk wint

De override-prijs wordt op drie verschillende momenten gelezen. Alle drie grijpen naar dezelfde `(store_id, product_id)`-lookup:

| Wanneer | Waar | Effect |
|---|---|---|
| Kassier voegt het product toe aan de winkelwagen | POS-app productgrid-tik, barcode-scan of handmatige zoekopdracht | De tegel / winkelwagenregel toont de override-prijs, niet hoofd. |
| Kassier rekent de verkoop af | POS dient de verkoop in bij de backend | De `unit_price_srd` van de verkoop registreert de override-prijs. De bon drukt het af. |
| Kortingsregel wordt toegepast | Kortingsregels evalueren tegen de regelprijs | De override-prijs is de basis voor procentuele kortingen. Een `pct_discount = 10`-regel op een SRD 20,00 (overschreven) cola geeft een SRD 2,00-korting, niet SRD 1,80. Zie [Hoofdstuk 7](07-discount-rules.md). |

De bon zelf zegt nergens "(override)". Vanuit het perspectief van de klant *is* de override-prijs de prijs in die vestiging. Dat hij verschilt van een ander filiaal is een interne prijsbeslissing, geen bon-niveau-zorg.

---

## 6.9 Waarom managers geen overschrijvingen mogen instellen

In de [rechtenmatrix](01-roles-and-permissions.md#13-the-permission-matrix) zijn vestigingsspecifieke prijsoverschrijvingen beperkt tot **Super Admin** en **organisatiebeheerder**. Vestigingsmanagers kunnen de hoofdprijzen van individuele producten bewerken ("een typefout, de fles is 1,5L niet 1,6L") maar kunnen geen override-rijen maken voor hun eigen vestiging.

Dit is bewust. Als een vestigingsmanager hun eigen prijzen kon instellen:

- Zouden twee filialen binnen een week in onverenigbare prijzen afdrijven.
- Zouden BTW-rapporten een verwarrend verhaal vertellen ("waarom verkoopt Paramaribo voor 18 en Nickerie voor 17?").
- Vult het auditlogboek zich met prijzen die onder meerdere handen veranderen.
- Worden refund-disputen moeilijker ("maar de bon zegt 18, waarom zegt het systeem 20?").

Prijsstelling is een hoofdkantoor-beslissing. Heeft een vestigingsmanager echt een ééndaagse lokale promotie nodig ("concurrent dumpt cola op 15, we moeten matchen"), dan is het juiste antwoord een **kortingsregel gescoped op die vestiging** ([Hoofdstuk 7](07-discount-rules.md)), geen override — op die manier blijft de oorspronkelijke prijs zichtbaar op de bon met de kortingsregel eronder, wat Belastingdienst verwacht.

Het "ik-ben-een-eenmanszaak"-patroon uit [Hoofdstuk 1 §1.6](01-roles-and-permissions.md#16-the-im-a-single-shop-owner-pattern) — één persoon met zowel een OA- als een kassieraccount — is de schone manier om dit te omzeilen voor echte eenmanszaak-operators.

---

## 6.10 Bulkladen van overschrijvingen (omweg)

Er is in deze release geen dedicated bulkoverride-importscherm. Moet u 50+ overschrijvingen tegelijk instellen, dan is de praktische omweg:

1. Exporteer de hoofdcatalogus ([Hoofdstuk 5 §5.5](05-bulk-import-csv-excel.md#55-step-by-step-exporting-the-current-catalogue)).
2. Beslis in een spreadsheet uw vestigingsspecifieke prijzen. Houd een aparte sheet per vestiging.
3. Ofwel:
   - **Type elke override handmatig** in het Prijsoverschrijvingen-scherm (prima voor onder 20).
   - Of laat een ontwikkelaar direct de API aanroepen: `POST /api/stores/{store}/price-overrides` met `{product_id, price_override}` per rij — makkelijk gescript vanuit een CSV. (Zie [de integratie-API-docs in Hoofdstuk 12](12-api-integrations-and-webhooks.md).)

Een echte "Overschrijvingen importeren"-CSV-UI staat op de roadmap; deze sectie wordt bijgewerkt zodra die wordt geleverd.

---

## 6.11 Veelvoorkomende fouten en valkuilen

| Symptoom | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| U stelt een Nickerie-override in maar de Paramaribo-kassa toont ook de nieuwe prijs | U vergat de vestiging te selecteren en bewerkte per ongeluk een andere. | Prijsoverschrijvingen → kies opnieuw de juiste vestiging → verwijder de verkeerde override. De originele vestiging heeft nog zijn rij — voeg die opnieuw toe. |
| De nieuwe prijs verschijnt niet aan de kassa | Terminal is offline, of de WebSocket-reconnect heeft niet gevuurd. | Klik op de knop **📡 Catalogus pushen**. Werkt het nog steeds niet, herstart dan de POS-app op die terminal. |
| U vindt de override later niet — de tabel is leeg | U kijkt naar de verkeerde vestiging. Elke vestiging heeft zijn eigen lijst. | Kies opnieuw de vestiging. Overschrijvingen zijn niet org-breed; ze zijn vestiging-scoped. |
| De kolom "Verschil" toont rood voor wat u als korting bedoelde | De kolom toont `override − hoofd`. Een rode `+2.00` betekent dat de vestigingsprijs **hoger** is. Groen `−1.50` betekent lager. | Bedoelde u een korting en ziet u een positief getal, dan heeft u de override-prijs hoger dan hoofd getypt. Bewerk de rij. |
| U verwijdert een product en de override is ook weg | Verwacht. Foreign-key cascade — wanneer het hoofdproduct verdwijnt, verdwijnen ook zijn vestiging-rijen. | Wilt u het product alleen uit één vestiging verwijderen, deactiveer dan de override-rij, niet het hoofdproduct. |
| U stelt een override van `0.00` in denkend dat het de override zou uitschakelen | Een override-prijs van `0.00` maakt het product **gratis** in die vestiging. De kassier rekent het af tegen SRD 0. | Om terug te gaan naar hoofd, **verwijder** de override (✕-knop). Stel het niet in op nul. |
| De override blijft hangen zelfs na het wijzigen van de hoofdprijs | Correct. Overschrijvingen zijn absoluut, niet relatief aan hoofd. | Verhoogt u hoofd van 18,00 → 19,00 en wilt u dat de override-vestiging dat spiegelt, bewerk dan ook de override (bv. 20,00 → 21,00). |
| De POS toont de hoofdprijs ondanks dat er een override bestaat | De override-rij heeft `is_active = false` (alleen zo ingesteld via API; de UI toont de schakelaar niet). | Verwijder de rij en voeg opnieuw toe (dat zet `is_active = true`). |
| Meerdere admins bewerken dezelfde override tegelijk, u ziet verouderde data | Het scherm gebruikt optimistische invalidatie; de tweede save wint. | Doe na opslaan een handmatige paginaherlading om te bevestigen wat in de database staat. Het auditlogboek registreert beide wijzigingen. |

---

## 6.12 Wat in het auditlogboek wordt vastgelegd

Override-wijzigingen zijn onregelmatig (vergeleken met verkopen) en hoge impact (een verkeerde override betekent dat elke verkoop van dat product in die vestiging verkeerd afrekent) — dus ze worden gelogd met hetzelfde detailniveau als catalogus-wijzigingen. Elke insert, update of delete op `store_product_overrides` registreert:

- De **actie** (`created`, `updated`, `deleted`).
- De **gebruiker** die de wijziging maakte (uw dashboard-account).
- De **vestiging** en **product** beïnvloed.
- De **oude price_override** en **nieuwe price_override** als JSON.
- Het **IP-adres** en timestamp in AST.

De volledige geschiedenis is zichtbaar voor OA en auditor in [Hoofdstuk 13 — Auditlogboek](13-audit-log.md). Het auditlogboek is alleen-toevoegen — zelfs Super Admin kan een rij niet verwijderen — dus is er ooit een dispuut ("we hebben deze prijs nooit afgesproken"), het antwoord is één filter weg.

Voor het ontwikkelaarsdetail van hoe de audit-pipeline werkt, zie [`/docs/03-auth-and-roles.md`](../docs/03-auth-and-roles.md).

---

## 6.13 Snelreferentie

```
OVERRIDE INSTELLEN    Dashboard → Prijsoverschrijvingen → kies vestiging
                      → + Overschrijving toevoegen → kies product → stel SRD-prijs in → Opslaan
OVERRIDE BEWERKEN     Hetzelfde scherm → Bewerken op rij → wijzig prijs → Opslaan
OVERRIDE VERWIJDEREN  Hetzelfde scherm → ✕ op rij → Bevestigen
PUSHEN NAAR ALLE KASSA'S  📡-knop rechtsboven (de meeste bewerkingen pushen sowieso automatisch)

SLEUTEL               (store_id, product_id) → unieke rij in store_product_overrides
RESOLUTIE             override-rij bestaat?
                          ja → gebruik override price_override
                          nee → gebruik hoofd products.price
ROLLEN                Alleen Super Admin + OA.
                      Vestigingsmanagers mogen geen overschrijvingen instellen voor hun eigen vestiging.
WAT WORDT OVERSCHREVEN De SRD-prijs. Alleen de prijs.
                      BTW, naam, barcode, categorie blijven door hoofd gedefinieerd.
```

Vastgelopen? Zie [Hoofdstuk 4](04-catalogue-and-categories.md) voor de hoofdcatalogus, [Hoofdstuk 5](05-bulk-import-csv-excel.md) voor bulkladen van hoofdprijzen, [Hoofdstuk 7](07-discount-rules.md) voor vestiging-scoped kortingspromoties (het schonere antwoord voor kortdurende lokale prijsdalingen), en [Hoofdstuk 13](13-audit-log.md) voor de audithistorie.

---

→ Volgende: [Hoofdstuk 7 — Kortingsregels](07-discount-rules.md)
