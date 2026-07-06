# Hoofdstuk 10 — Rapporten: dagelijks, maandelijks, BTW, Rekenkamer

**Voor wie:** organisatiebeheerder, vestigingsmanager, auditor. Ook Super Admin, wanneer naar een specifieke klant wordt gekeken. Kassiers zien alleen hun eigen prestaties in [Mijn Account](18-my-account.md) — niet de hier beschreven rapportschermen.

**Wanneer u een rapport draait:**
- **Dagelijks / maandelijks** — Vestigingsmanager controleert hoe een filiaal het doet. OA controleert hoe alle filialen het doen.
- **BTW** — eens per maand, voor de aangifte bij Belastingdienst Suriname. Wie ook de boekhouding doet.
- **Rekenkamer** — wanneer een inspecteur van de Rekenkamer of overheids-compliance-officer vraagt. Of kwartaals, als defensieve gewoonte.
- **Top producten / X-Rapport** — dagelijkse spot-check door de vestigingsmanager tijdens de handelsdag.

**Wat dit voorkomt:** rapporten gebouwd in het dashboard komen direct uit de canonieke verkooprijen, met de BTW-wiskunde al vastgepind door de [BTW-pipeline](../docs/05-btw-pipeline.md). Dat betekent geen spreadsheets, geen handmatige her-invoer, geen afronding-drift tussen wat de kassier afrekende en wat u indient bij Belastingdienst. De Rekenkamer-export draagt een SHA-256 documenthash voor manipulatiedetectie — verschilt een kopie in het wild met één byte, dan bewijst de hash op de voorpagina het.

![10 rapporten overzicht](screenshots/10-reports-overview.png)
---

## 10.1 De negen rapporttypes in één oogopslag

Josbin POS toont negen onderscheiden rapport-endpoints. Sommige leven op het **dashboard Rapporten-scherm** (geconsolideerd cross-vestiging), andere zijn per vestiging en alleen bereikbaar via de API of de POS-zijde einde-dag-flow.

| # | Rapport | Scope | Waar | Rechten | Output |
|---|---|---|---|---|---|
| 1 | **Dagelijks** | één vestiging, één datum | API / POS-rapportenscherm | `reports.daily` | JSON, PDF |
| 2 | **Maandelijks** | één vestiging, kalendermaand | API / POS-rapportenscherm | `reports.monthly` | JSON, PDF |
| 3 | **Aangepast bereik** | één vestiging, elke `from → to` | API / POS-rapportenscherm | `reports.custom` | JSON, PDF |
| 4 | **Top producten** | één vestiging, elk bereik, top N | API / POS-rapportenscherm | `reports.top_products` | JSON |
| 5 | **X-Rapport** (midden van de dag) | één vestiging, vandaag | POS-rapportenscherm, alleen manager | `reports.x_report` | JSON / geprinte strookje |
| 6 | **BTW-rapport** | één vestiging *of* hele org | Dashboard → Rapporten → BTW | `reports.btw` | JSON, PDF |
| 7 | **Rekenkamer-export** | hele org (of één vestigingsfilter) | API `GET /reports/rekenkamer` | `reports.rekenkamer` of OA / Auditor | **Ondertekende PDF** |
| 8 | **Geconsolideerd** (cross-vestiging) | alle vestigingen in een org | Dashboard → Rapporten → Geconsolideerd | (OA / Super Admin / Auditor) | JSON, PDF |
| 9 | **Winst & marge** | één vestiging *of* hele org | Dashboard → Rapporten → Winst & marge | `products.view_cost` (Super Admin / OA / vestigingsmanager) | JSON |

Het scherm **Rapporten** van het dashboard verpakt er drie hiervan (geconsolideerd + BTW + winst & marge). De andere vijf zijn bereikbaar ofwel vanaf het POS-zijde rapportenscherm (voor één vestiging tegelijk) ofwel vanaf de API. De Rekenkamer-export heeft nog geen dedicated dashboardscherm — die wordt getriggerd door URL of door een "Audit-export downloaden"-knop op het Auditlogboek-scherm ([Hoofdstuk 13](13-audit-log.md)).

> Het **Z-Rapport** zit *niet* in dit hoofdstuk. Het is de einde-dag kassa-afsluiting — zie [Hoofdstuk 11](11-z-reports-and-end-of-day-sync.md). Hier landen de analytische rapporten die u leest; Z-Rapport is de operationele actie van een dag sluiten.

---

## 10.2 Het dashboard Rapporten-scherm

**Pad:** Dashboard → linker zijbalk → **Rapporten**.

U landt op een drie-tab-scherm:

- **Geconsolideerd** — cross-vestiging omzet, BTW, transacties, betalingsbreakdown, per-vestiging tabel, top 10 producten.
- **BTW-overzicht** — Belastingdienst-geformatteerd VAT-rapport geaggregeerd over dezelfde vestigingsscope.
- **Winst & marge** — omzet, inkoopkosten, winst en marge % voor dezelfde scope. Deze tab bestaat alleen voor Super Admin, OA en vestigingsmanager — zie §10.4a.

Alle drie de tabs delen één filterbalk bovenaan:

| Filter | Wat het doet | Standaard |
|---|---|---|
| **Van** | Startdatum (inclusief). | Eerste dag van huidige maand. |
| **Tot** | Einddatum (inclusief). | Vandaag. |
| Keuzemenu **Vestiging** | Beperkt de actieve tab tot één vestiging. Wordt alleen getoond wanneer uw org meer dan één vestiging heeft. | Alle vestigingen. |
| Snel-pil **Vandaag** | Stelt van = tot = vandaag in. | — |
| Snel-pil **Gisteren** | Stelt van = tot = gisteren in. | — |
| Snel-pil **Deze maand** | Stelt van = eerste van maand, tot = vandaag in. | — |
| **Vernieuwen** | Draait de query opnieuw. De tab laadt automatisch wanneer u een datum wijzigt, dus dit is voor "force-fresh"-gevallen. | — |
| **Exporteer PDF** | Downloadt het momenteel zichtbare rapport als een PDF in uw UI-taal. | — |

> De datumfilter is **inclusief aan beide uiteinden**. `Van = 2026-05-01`, `Tot = 2026-05-31` retourneert de hele maand mei. Timestamps in de data zijn AST (America/Paramaribo), dus een verkoop afgerekend om 23:58 AST op 31 mei behoort tot het mei-rapport, ook al kan het 1 juni zijn in UTC.

Organisatiescope-regels (besloten door de backend, u kiest niet — het keuzemenu Vestiging hierboven versmalt alleen *binnen* uw org):

- **Super Admin** ziet elke actieve organisatie standaard. Geef `?org_id=…` door om te scopen naar één. Er is nog geen keuzemenu voor dit in het scherm — Super Admins gebruiken meestal de URL of de API.
- **OA / Vestigingsmanager / Auditor** zijn automatisch beperkt tot hun eigen organisatie. Ze kunnen geen data van een andere org zien en de query raakt die data zelfs niet aan.

---

## 10.3 Geconsolideerd rapport (cross-vestiging)

De standaardtab. Beantwoordt de vraag *"hoe doet de hele organisatie het in dit datumbereik?"*.

![10 geconsolideerd](screenshots/10-consolidated.png)
### Wie leest dit

- **Organisatiebeheerder** — elke ochtend, kijkend naar "gisteren" of "deze maand tot nu". Spot een filiaal dat niet op tempo loopt voor de lunch.
- **Auditor** — controleert dat totalen aansluiten op wat is ingediend.
- **Super Admin** — op een hoger niveau, over alle klanten indien nodig.

### Wat u ziet (van boven naar beneden)

#### KPI-kaarten (vier)

| Kaart | Wat het toont | Bron |
|---|---|---|
| **Totale omzet** | Som van `total_srd` over alle voltooide verkopen in scope. | `sales.total_srd` |
| **Transacties** | Aantal voltooide verkopen. Geannuleerde verkopen worden niet geteld. | `sales.id` count |
| **Gemiddelde bon** | Totale omzet ÷ transactie-aantal. Handig om prijs-perceptie wijzigingen te spotten. | afgeleid |
| **BTW** | Som van `btw_srd` over dezelfde set. Dit is de *geheven* belasting — niet wat verschuldigd is na vrijgestelde aftrekkingen (de BTW-tab handelt dat af). | `sales.btw_srd` |

#### Betalingsbreakdown-strip

Drie inline-cijfers: **Contant · Pin/Kaart · Gemengd**, elk gesommeerd voor de scope. Handig voor cashflow-planning (hebben we morgen een Brinks-ophaling?).

#### Per-vestiging tabel — kolommen

| Kolom | Opmerkingen |
|---|---|
| **Vestiging** | Vestigingsnaam. Klik om in te zoomen op [Vestigingsdetail](02-organisation-and-store-setup.md#store-detail). |
| **Stad** | De stad van de vestiging. Helpt wanneer u meerdere vestigingen in dezelfde keten heeft. |
| **Omzet** | Totaal SRD van deze vestiging in scope. |
| **BTW** | Geheven BTW van deze vestiging in scope. |
| **Transacties** | Aantal voltooide verkopen van deze vestiging. |

Vestigingen met nul verkopen in het bereik worden uit de tabel weggelaten (ze vallen uit de `GROUP BY store_id`). Dat is geen verborgen instelling — verschijnt een vestiging niet, dan had die geen voltooide verkopen voor die datums.

#### Top producten tabel

Top 10 producten op omzet over **alle** vestigingen in scope. Kolommen:

| Kolom | Opmerkingen |
|---|---|
| **#** | Rang, 1-10. |
| **Product** | De productnaam zoals die was op het moment van verkoop — `product_name_snapshot`, niet de huidige catalogusnaam. Heeft de kassier vorige maand "Volle Melk 1L" afgerekend en heeft u die vandaag hernoemd naar "Melk 1L Vol", dan toont het rapport nog steeds "Volle Melk 1L". |
| **Aantal** | Som van `quantity` afgerond op integer (eenheden, kg — de eenheden hangen af van het product). |
| **Omzet** | Som van regeltotalen (post-korting, BTW-inclusief). |

### Backend-endpoint

```
GET /api/dashboard/reports/consolidated?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Bron: `backend/app/Http/Controllers/Api/DashboardController.php::consolidatedReport`.

### PDF-export kolommen

Klik op **Exporteer PDF** terwijl u op de tab Geconsolideerd bent. Het bestand `geconsolideerd-rapport-<from>-<to>.pdf` downloadt. Lay-out:

- Voorpagina-header — organisatienaam, datumbereik, gegenereerd-op (AST), gegenereerd-door.
- Samenvattingsblok — totale omzet, BTW, transacties, gem. bon, betalingssplit.
- Per-vestiging tabel — vestiging, stad, transacties, omzet, BTW.
- A4 staand, Nederlandse headers wanneer `locale=nl`, Engels wanneer `locale=en`.

CSV/XLSX-export is nog niet zichtbaar in deze release — de data zit in de PDF-tabellen. Voor een eenmalige is het bovenstaande JSON-endpoint het schoonste pad.

---

## 10.4 BTW-rapport (Belastingdienst-formaat)

Het enige belangrijkste rapport in het dashboard, juridisch gezien. U draait dit **eens per maand** op de tweede tab.

![10 btw-rapport](screenshots/10-btw-report.png)
### De Suriname BTW-context

| Feit | Waarde |
|---|---|
| Standaard BTW-tarief (2026) | **10%** |
| Vrijgestelde categorieën | Basisvoedingsmiddelen (rijst, brood, melk voor kinderen, rauw fruit/groenten, vers vlees), receptmedicijnen, een kleine lijst andere goederen gedefinieerd door Belastingdienst. Zie [Hoofdstuk 4 — BTW-vrij-vlag](04-catalogue-and-categories.md#47-the-btw-exempt-flag--when-to-use-it). |
| Wiskunde | Belasting-**inclusief**: `btw = base × rate / (100 + rate)`. Korting wordt eerst toegepast, BTW geëxtraheerd uit de post-korting netto. Zie [`docs/05-btw-pipeline.md`](../docs/05-btw-pipeline.md) voor het uitgewerkte voorbeeld. |
| Aangifte-autoriteit | **Belastingdienst Suriname**. |
| Aangifteperiode | Maandelijks is canoniek voor VAT. Kies `van = eerste dag van maand`, `tot = laatste dag van maand`. |
| Aangifte-valuta | Alleen SRD. |

### Wat u ziet (van boven naar beneden)

#### Twee grote KPI-kaarten

| Kaart | Wat het toont |
|---|---|
| **Totale BTW te betalen** | Som van `sale_items.btw_srd` over alle voltooide verkopen in scope. Dit is het kopnummer dat op het Belastingdienst-formulier gaat. |
| **Totale bruto omzet** | Som van `sale_items.line_total_srd` (BTW-inclusief). De basis waaruit de BTW boven werd geëxtraheerd. |

De kleinere tekst onder "Totale bruto omzet" leest `Belastingdienst Suriname` — dat is het `format`-veld dat de API teruggeeft, bevestigend dat u kijkt naar de officiële-formaat output.

#### Breakdown per BTW-tarief — kolommen

| Kolom | Wat het toont | Hoe het wordt berekend |
|---|---|---|
| **Tarief** | Het BTW-tarief waarop regel-items werden afgerekend. Doorgaans `0.00%` (vrijgesteld + nul-getarifeerd) en `10.00%`. | `sale_items.btw_rate` |
| **Vrijgesteld** | `Ja` groene pil indien `btw_exempt = true`, `—` anders. Twee rijen kunnen beide `0.00%` tonen — één vrijgesteld, één nul-getarifeerd — en ze verschijnen apart zodat het auditspoor ondubbelzinnig blijft. | `sale_items.btw_exempt` |
| **Bruto incl. BTW** | Som van `line_total_srd` voor de tariefgroep. | `SUM(line_total_srd)` |
| **Netto excl. BTW** | Bruto minus de geëxtraheerde BTW. De belasting-exclusieve basis. | `SUM(line_total_srd) − SUM(btw_srd)` |
| **BTW** | De geëxtraheerde belasting voor de tariefgroep. | `SUM(btw_srd)` |
| **Verkopen** | Aantal onderscheiden verkopen die items op dit tarief bevatten. (Eén verkoop kan gemengde tarieven bevatten en wordt in elk geteld.) | `COUNT(DISTINCT sales.id)` |

De breakdown is `ORDER BY btw_exempt, btw_rate` — vrijgestelde rijen komen eerst, dan oplopende tarief. Voor de meeste Surinaamse retailers is de tabel twee rijen: vrijgesteld (basisvoeding + medicijnen) en 10%.

### Waarom dit netjes mapt op het Belastingdienst-formulier

De Belastingdienst BTW-aangifte vraagt (in essentie):

1. Totale belasting-exclusieve omzet per tariefband
2. De BTW te betalen per tariefband

Beide komen direct uit de kolommen **Netto excl. BTW** en **BTW**. U kopieert ze op het formulier, één regel per tariefband, vrijgestelde omzet onder de vrijgestelde sectie, en u bent klaar.

> **Compliance-auditnotitie:** omdat de BTW-waarden *persistent* per regel op verkooptijd zijn opgeslagen (`sale_items.btw_srd`) — niet opnieuw afgeleid van het tarief bij rapporttijd — kan het rapport niet drijven van de bon die de klant kreeg. De bon die de kassier printte, de auditlog-entry en het BTW-rapport verwijzen allemaal naar dezelfde vergrendelde nummers. Zie [`docs/05-btw-pipeline.md`](../docs/05-btw-pipeline.md) voor de rij-insert-garantie.

### Per-vestiging BTW (wanneer u het nodig heeft)

De BTW-tab van het dashboard is **geconsolideerd over alle vestigingen in uw org**. Voor een één-vestiging BTW-rapport (bv. één filiaal is zijn eigen juridische entiteit met zijn eigen BTW-nummer), roep het per-vestiging-endpoint direct aan:

```
GET /api/reports/btw?store_id=<uuid>&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Bron: `backend/app/Http/Controllers/Api/ReportController.php::btwReport`.

Zelfde vorm als de geconsolideerde versie, gescoped op één vestiging. Het juridisch gebruikelijke geval in Suriname is één BTW-nummer per organisatie, dus de geconsolideerde view van het dashboard matcht met wat wordt ingediend. Structureert uw klant zijn bedrijf met aparte BTW-nummers per filiaal, bouw ze dan een kleine rapportrunner die het per-vestiging-endpoint voor elk filiaal raakt en concateneert — dat is een leverancier-support-taak, geen self-service-feature in deze release.

### PDF-export

Klik op **Exporteer PDF** terwijl u op de BTW-tab bent. Het bestand `btw-rapport-belastingdienst-<from>-<to>.pdf` downloadt. Lay-out:

- Voorpagina-header — organisatienaam, BTW-registratienummer, periode, AST-timestamp.
- Twee samenvattingsregels — totaal bruto, totaal BTW.
- Tariefband-tabel — vrijgestelde rij(en) eerst, dan 10% (en elk ander tarief dat verscheen).
- A4 staand. `locale=nl` is de standaard voor Belastingdienst-aangifte.

Dit is de PDF die u bij de BTW-aangifte voegt of overhandigt aan uw accountant. Print het, onderteken het, dien het in.

### Backend-endpoint

```
GET /api/dashboard/reports/btw?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
GET /api/dashboard/reports/btw/export?date_from=…&date_to=…&locale=nl|en
```

Bron: `backend/app/Http/Controllers/Api/DashboardController.php::consolidatedBtwReport` + `::exportBtw`.

---

## 10.4a Winstrapport (Winst & marge) — omzet, inkoop, marge

De derde tab op het Rapporten-scherm. Beantwoordt de vraag die de geconsolideerde tab bewust niet beantwoordt: *"hoeveel van die omzet hebben we daadwerkelijk overgehouden?"*

### Wie ziet deze tab überhaupt

Inkoopprijzen zijn commercieel gevoelig, dus dit is de enige rapporttab die **rol-gegate is in zowel de UI als de API**:

| Rol | Toegang |
|---|---|
| **Super Admin / OA / vestigingsmanager** | ✅ — dit zijn de rollen die `products.view_cost` hebben (hetzelfde recht dat inkoopprijzen toont in de Catalogus). |
| **Kassier / Auditor / Belastinginspecteur / API-integratie** | ❌ — de tab wordt niet gerenderd, en een directe API-aanroep geeft `403` terug. |

Waarom de auditor en de belastinginspecteur zijn uitgesloten: Belastingdienst audit **BTW**, geen marge. Het BTW-rapport (§10.4) en de Rekenkamer-export (§10.6) dekken alles waar een compliance-beoordelaar recht op heeft — uw inkoopprijzen horen daar niet bij.

### Wat u ziet (van boven naar beneden)

#### KPI-kaarten (vijf)

| Kaart | Wat het toont |
|---|---|
| **Omzet** | Som van regeltotalen (post-korting, BTW-inclusief) voor voltooide verkopen in scope. |
| **Inkoopkosten** | Som van `cost_snapshot_srd × quantity` over dezelfde regels. |
| **Winst** | Omzet − inkoop, gesommeerd uit de per-regel `line_profit_srd`. |
| **Marge %** | Winst ÷ omzet × 100. `—` wanneer omzet nul is. |
| **Transacties** | Aantal voltooide verkopen in scope. Annuleringen uitgesloten, zoals overal. |

#### Waarschuwing "regels zonder inkoopprijs"

Heeft een verkochte regel geen kostensnapshot (het product had geen inkoopprijs op verkoopmoment), dan telt een amber banner die regels: winst is **onderschat** totdat de producten een inkoopprijs krijgen in de Catalogus ([Hoofdstuk 4](04-catalogue-and-categories.md)). De catalogus repareren verbetert alleen *toekomstige* verkopen — zie de snapshot-regel hieronder.

#### Dagelijkse winsttrend

Een lijngrafiek met per dag één omzetlijn en één winstlijn. De snelste manier om "omzet hield stand maar marge stortte in" te spotten — een kortingsprobleem, geen bezoekersprobleem.

#### Per-vestiging breakdown

Eén rij per vestiging — omzet, inkoop, winst, marge %, transacties — gerangschikt op winst. Dit is de view van de keteneigenaar: twee filialen met gelijke omzet kunnen in winst ver uit elkaar liggen als één leunt op lage-marge basisproducten.

#### Top 10 producten op winst

Gerangschikt op **winst, niet op omzet** — bewust een andere ranking dan de top-10 van de geconsolideerde tab. Een hoog-volume lage-marge SKU (rijst, bakolie) zakt in de lijst; een laag-volume hoge-marge item stijgt. Productnamen zijn `product_name_snapshot`, zoals overal.

#### Verlies-verkopen

Elke verkoop in scope waarvan de **winst van de hele verkoop negatief is** — artikelen gingen onder inkoopprijs de deur uit. Ergste eerst, gemaximeerd op 20 rijen: tijdstip, bonnummer, vestiging, omzet, verlies. Twee realistische oorzaken, beide waard om dezelfde dag na te jagen:

- **Te veel korting** — een regel- of verkoopkorting duwde de prijs onder de inkoopprijs.
- **Verkeerd geprijsd product** — de verkoopprijs of de inkoopprijs staat verkeerd in de catalogus.

### De kostensnapshot-regel (waarom de geschiedenis niet beweegt)

Elke verkoopregel bevriest de inkoopprijs van het product op verkoopmoment in `sale_items.cost_snapshot_srd`, en de winst van de regel in `line_profit_srd` — hetzelfde patroon als `product_name_snapshot` en de gepersisteerde BTW-bedragen. Bewerk vandaag de inkoopprijs van een product en **geen enkel historisch winstcijfer verandert**; alleen verkopen die vanaf nu worden geboekt gebruiken de nieuwe inkoopprijs. Een winstrapport over mei rendert in december identiek.

### Backend-endpoint

```
GET /api/reports/profit?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD[&store_id=<uuid>]
```

Bron: `backend/app/Http/Controllers/Api/ReportController.php::profit`. Vereist `products.view_cost` — iedereen anders krijgt `403`.

> **PDF-kanttekening:** er is geen dedicated winst-PDF in deze release — de knop **Exporteer PDF** op deze tab produceert de *geconsolideerde* PDF. Voor een winstcijfer op papier: screenshot de tab of gebruik het JSON-endpoint.

---

## 10.5 Per-vestiging rapporten — dagelijks, maandelijks, aangepast bereik

Deze vijf rapporten (`daily`, `monthly`, `custom`, `top-products`, `x-report`) leven achter `/api/reports/*` en worden gebruikt door het **POS-zijde Rapportenscherm** in plaats van het dashboard. Ze zijn hier vermeld omdat vestigingsmanagers regelmatig vragen "waar zie ik het nummer van gisteren voor *alleen mijn vestiging*?" — en het antwoord is "het POS-zijde Rapportenscherm" (behandeld in [POS-handleiding hfdst. 11](../user_manual/11-reports.md)), of een van deze endpoints direct.

### 10.5.1 Dagelijks rapport — `GET /api/reports/daily`

| Param | Verplicht | Standaard |
|---|:-:|---|
| `store_id` (uuid) | ✅ | — |
| `date` (Y-m-d) | optioneel | vandaag (AST) |

Respons-vorm (`buildDailySummary`):

| Veld | Opmerkingen |
|---|---|
| `store_id`, `date_from`, `date_to` | Beide datumvelden = dezelfde datum. |
| `transaction_count` | Voltooide verkopen. |
| `void_count` | Geannuleerde verkopen in dezelfde periode (aparte teller — annuleringen zijn *niet* in `transaction_count`). |
| `total_sales_srd` | Som van `total_srd`. |
| `total_btw_srd` | Som van `btw_srd`. |
| `total_discount_srd` | Som van `discount_srd` (verkoop-niveau korting; regel-item kortingen zijn ingebakken in `total_srd`). |
| `avg_basket_srd` | Gem. `total_srd`. |
| `cash_total_srd` / `card_total_srd` / `mixed_total_srd` | Betaalmethode-split. |
| `bank_transfer_total_srd` / `mobile_transfer_total_srd` / `foreign_cash_total_srd` / `qr_payment_total_srd` | De overige betaalmethode-totalen — altijd aanwezig, `0.00` wanneer de methode in de periode niet is gebruikt. |
| `bank_breakdown` | Reconciliatierijen — één per `(payment_method, bank/provider)`-paar. Zie §10.5.6. |
| `btw_breakdown` | Array — één rij per `(btw_rate, btw_exempt)`-groep: `base_srd`, `btw_srd`, `rate`, `exempt`. |
| `top_products` | Top 5 op omzet: `product_name`, `quantity`, `revenue_srd`. |

### 10.5.2 Maandelijks rapport — `GET /api/reports/monthly`

| Param | Verplicht |
|---|:-:|
| `store_id` (uuid) | ✅ |
| `year` (integer) | ✅ |
| `month` (integer 1-12) | ✅ |

Zelfde vorm als dagelijks, maar met `date_from = YYYY-MM-01`, `date_to = laatste dag van maand`, plus een `period: "YYYY-MM"` string voor weergave.

### 10.5.3 Aangepast bereik — `GET /api/reports/custom`

| Param | Verplicht |
|---|:-:|
| `store_id` (uuid) | ✅ |
| `date_from` (Y-m-d) | ✅ |
| `date_to` (Y-m-d, ≥ from) | ✅ |

Zelfde vorm als dagelijks, over het gekozen bereik. Handig voor "deze week", "vorig kwartaal", "Black Friday-weekend"-type vragen.

### 10.5.4 Top producten — `GET /api/reports/top-products`

| Param | Verplicht | Standaard |
|---|:-:|---|
| `store_id` (uuid) | ✅ | — |
| `date_from` (Y-m-d) | optioneel | eerste van huidige maand |
| `date_to` (Y-m-d) | optioneel | vandaag |
| `limit` (5-50) | optioneel | 10 |

Retourneert `products`: array van `product_name`, `total_qty`, `total_revenue`, `sale_count` — geordend op omzet desc.

### 10.5.5 X-Rapport (midden-dag snapshot) — `GET /api/reports/x-report`

| Param | Verplicht |
|---|:-:|
| `store_id` (uuid) | ✅ |

Retourneert dezelfde `buildDailySummary`-vorm als het dagelijkse rapport (voor vandaag), met drie extra velden:

| Extra veld | Waarde |
|---|---|
| `type` | `"X-Report"` |
| `generated_at` | AST ISO-8601 timestamp |
| `note` | `"Dit is een tussentijds overzicht. De kassalade is NIET afgesloten."` |

**Dit is het kritieke onderscheid:** het X-Rapport sluit de dag **niet**. Het produceert geen `ZReport`-rij. Het is alleen-lezen — voor spot-checks. Verkopen kunnen direct na blijven gebeuren, precies zoals voorheen. Vergelijk met het Z-Rapport dat de dag *wel* sluit en *wel* een rij persisteert (zie [Hoofdstuk 11](11-z-reports-and-end-of-day-sync.md)).

### 10.5.6 Betaling × bankreconciliatie — `bank_breakdown`

Elk rapport dat op dezelfde samenvatting is gebouwd (dagelijks, maandelijks, aangepast bereik, X-Rapport) draagt ook een **`bank_breakdown`**-array: één rij per `(payment_method, bank/provider)`-combinatie, met een transactie-aantal en een SRD-totaal.

| Veld | Opmerkingen |
|---|---|
| `payment_method` | `card`, `mixed`, `bank_transfer`, `mobile_transfer` of `qr_payment`. Contant verschijnt hier nooit — er valt niets te reconciliëren tegen een afschrift. |
| `provider` | De uitgevende bank die de kassier van de pinterminal-strook overnam (DSB, Hakrinbank, Finabank, …), de overschrijvings-/mobiele provider, of de QR-wallet (Mopé, Uni5Pay+). `null` = geen bank vastgelegd. |
| `tx_count` | Aantal verkopen in de bucket. |
| `total_srd` | SRD-totaal voor de bucket. Bij `mixed`-verkopen telt hier alleen het **kaartdeel** — de contante helft zit al in de lade. |

**Waar het voor is:** de dag (of de afschriftmaand) bucket voor bucket aftikken tegen het vereffeningsafschrift van de bank en het merchant-portaal van de wallet. Zegt het afschrift van DSB dat SRD 4.210,00 is vereffend en zegt de DSB-rij hetzelfde, dan is die methode gereconcilieerd. Zie [Hoofdstuk 22 §22.4](22-payment-methods-and-wallets.md#224-waar-het-geld-terugkomt) voor waar het geld van elke methode daadwerkelijk landt, en Hoofdstuk 11 voor de per-methode-totalen die op elk Z-Rapport meerijden.

**De `null`-bucket:** een rij met `provider = null` betekent dat de kassier **Overslaan & afronden** gebruikte op de kaartstap in plaats van de bank van de pinstrook over te nemen. Dat mag — het blokkeert nooit een verkoop — maar een consistent grote null-bucket maakt afschrift-matching onmogelijk. Het is een **coaching-signaal, geen systeemfout**: herinner kassiers eraan het reconciliatiepaneel in te vullen.

> Deze rijen leven in de rapport-JSON; de per-vestiging PDF-export print de breakdown nog niet. Voor een reconciliatie in een spreadsheet: haal het JSON-endpoint op voor de afschriftperiode.

### PDF-export — dagelijks / maandelijks / aangepast / btw

```
GET /api/reports/export?type=daily|monthly|custom|btw&store_id=…&date=…|date_from=…&date_to=…&locale=nl|en
```

- `type=daily` vereist `date`; standaard vandaag.
- `type=monthly` en `type=custom` vereisen `date_from` + `date_to`.
- `type=btw` is momenteel een placeholder-PDF — gebruik de BTW-export van het dashboard (`/api/dashboard/reports/btw/export`) voor de productie-klare PDF.
- `locale` standaard `nl` (Nederlandse headers) — geef `en` door voor Engels.

Bestandsnaamconventie: `report-<type>-<vandaag>.pdf`, A4 staand.

CSV / XLSX-export staat niet in de per-vestiging-endpoints. De JSON-vorm is het eenvoudigste pad voor downstream tooling; wil een klant Excel uit het dashboard, dan is dat een kleine wrapper-job voor leverancier-support.

---

## 10.6 Rekenkamer-export — de Rekenkamer-PDF

![10 rekenkamer](screenshots/10-rekenkamer.png)
Dit is de **ondertekende PDF + volledige transactielijst** gebruikt door de *Rekenkamer van Suriname* bij het beoordelen van de rekeningen van een overheidsinstelling. Het is ook handig voor elke klant die een "geef me alles voor deze periode"-archiefdocument wil.

### Wie heeft dit nodig

- **Overheidsinstellingen** (`organisations.is_government = true`) — de Rekenkamer kan dit op elk moment vragen. De export is specifiek gebouwd om aan hun formaatverwachtingen te voldoen.
- **Auditors** — interne auditors, externe accountants, Belastingdienst-belastinginspecteurs die een diepe duik doen voorbij het reguliere BTW-rapport.
- **Organisatiebeheerder** — defensief, eens per kwartaal, als onderdeel van uw eigen archief.

### Wat staat er in het document

De PDF (A4 liggend) bevat de **volledige transactiegeschiedenis** voor een organisatie (of één vestiging) over een gekozen datumbereik. Specifiek:

| Sectie | Inhoud |
|---|---|
| **Voorpagina** | Organisatienaam + BTW-nummer, periode (`van → tot`), vestigingsfilter indien van toepassing, gegenereerd-op (AST), gegenereerd-door (naam + e-mail), documenthash (SHA-256). |
| **Executive summary** | Totale omzet, totale BTW, totale netto-basis, voltooid transactie-aantal, geannuleerd transactie-aantal, gem. bon. |
| **BTW-breakdown** | Per tariefband — `btw_rate`, `btw_exempt`, `net_base`, `btw_total`. Zelfde structuur als de BTW-rapport-tab. |
| **Betaalmethode-breakdown** | Per methode (contant, kaart, gemengd) — aantal en totaal. |
| **Volledige transactielijst** | Elke voltooide *en* geannuleerde verkoop in het bereik, geordend op `occurred_at`. Elke rij: verkoopnummer, AST-timestamp, kassiersnaam, vestigingsnaam, betaalmethode, totalen (subtotaal, korting, BTW, totaal), status. |
| **Annuleringslog** | Elke geannuleerde verkoop apart getabuleerd met de annulerings-reden en de gebruiker die het goedkeurde. |
| **Voettekst op elke pagina** | De SHA-256 documenthash, herhaald voor manipulatiebestendigheid. |

### Het ondertekeningsdetail (en wat het vandaag daadwerkelijk doet)

Het document draagt:

| Mechanisme | Wat het doet | Status |
|---|---|---|
| **SHA-256 documenthash** in HTTP-respons-header (`X-Document-Hash`) en op elke pagina van de PDF. | Berekend uit `org_id + period + sale count + grand total + generated_at`. Een van die inputs achteraf wijzigen produceert een andere hash — elke gemanipuleerde kopie stopt met matchen op de auditlog-entry die we houden. | ✅ Werkt — elke export produceert een header + voorpagina-hash. |
| **Digitale handtekening op het certificaat van de organisatie.** | Een formele cryptografische handtekening met het ondertekeningscertificaat van de organisatie (uitgegeven bij installatie). De ondertekende PDF zou een verifieerbare PKCS#7-handtekening dragen die zichtbaar is in elke moderne PDF-reader. | Gepland. De hash boven is de tussentijdse manipulatiebestendigheid; volledige PDF-ondertekening landt wanneer de organisatie-cert-infrastructuur dat doet. |

Wanneer een Rekenkamer-inspecteur vraagt "is deze PDF authentiek?", is het antwoord vandaag:

1. De SHA-256 hash staat op de PDF en is ook geregistreerd in ons auditlog op de server-zijde op het moment van generatie.
2. Geef ze de hash van ons serverlog; ze vergelijken het met de hash op de PDF voor hen. Match = authentiek.

Wanneer de ondertekeningsinfrastructuur wordt geleverd, vereenvoudigt het antwoord tot: "open de PDF, kijk naar het handtekeningspaneel, de ondertekenaar is *`<Organisatienaam>`* op *`<datum>`*".

### Hoe te exporteren

Er is geen dedicated scherm voor dit in de huidige release. Twee paden:

**Pad A — Auditlog-scherm export-knop** ([Hoofdstuk 13](13-audit-log.md)): het Auditlog-scherm heeft een **Rekenkamer-export**-knop rechtsboven die het endpoint aanroept met de momenteel actieve datumfilter.

**Pad B — Directe URL** (leverancier-support / Super Admin):

```
GET /api/reports/rekenkamer?organisation_id=<uuid>&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&locale=nl|en
```

Optioneel `store_id=<uuid>` om te scopen op één filiaal. Optioneel `locale=en` voor Engelse headers (standaard `nl`).

Het bestand `rekenkamer_<orgname>_<from>_<to>.pdf` downloadt.

### Rechten

- **Super Admin** — altijd toegestaan.
- **Organisatiebeheerder** — toegestaan voor hun eigen org.
- **Auditor** — toegestaan voor hun eigen org (dit is precies de rol waarvoor deze PDF is gebouwd).
- **Vestigingsmanager / Kassier** — geweigerd. (Dit is een gevoelige cross-vestiging export — niet binnen de blast-radius van een manager.)
- **API-integratie** — geweigerd. Machines halen geen juridische audit-exports op.

Backend-bron: `backend/app/Http/Controllers/Api/RekenkamerController.php`.

### CSV-begeleider

Voor analytisch gebruik (laden in een spreadsheet), koppel de PDF met het Aangepast Bereik JSON-endpoint (§10.5.3) voor dezelfde datumspanne en verwerk het tot CSV in uw eigen tooling. Een dedicated Rekenkamer-CSV-export zit momenteel niet in de API — de PDF is het *juridische* document; CSV is een gemaksformaat dat geen onderdeel is van de Rekenkamer-vereiste deliverable.

---

## 10.7 Rechten-cheatsheet

Wie kan wat draaien, in één tabel. (Bron: `backend/database/seeders/RolesAndPermissionsSeeder.php`.)

| Recht | Super Admin | OA | Vestigingsmgr | Kassier | Auditor | API-integ. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `reports.daily` | ✅ | ✅ | ✅ | ✅ (eigen vestiging) | ✅ | ✅ |
| `reports.monthly` | ✅ | ✅ | ✅ | ✅ (eigen vestiging) | ✅ | ❌ |
| `reports.custom` | ✅ | ✅ | ✅ | ✅ (eigen vestiging) | ✅ | ❌ |
| `reports.top_products` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `reports.x_report` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `reports.btw` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `products.view_cost` (winstrapport, §10.4a) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `reports.rekenkamer` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `reports.export` (PDF) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Geconsolideerd cross-vestiging** | ✅ | ✅ | ❌ (gescoped op één vestiging) | ❌ | ✅ | ❌ |

Kassier-zichtbaarheid is door de backend **gescoped op hun vestiging** — ze kunnen geen data van een ander filiaal zien zelfs als ze het recht hebben.

---

## 10.8 Sync-status caveat voor rapporten

Alle rapporten hier lezen vanuit de **lokale back-office-database**. Ze zijn *niet* gegate door HQ-sync-status. Is een vestiging drie dagen offline geweest en haar Z-Rapporten staan in `pending` in de wachtrij, dan zijn haar **lokale** dagelijkse / maandelijkse rapporten voor die dagen accuraat — de data zit op de lokale Postgres. Wat *niet* accuraat is, is de view van het **HQ Super Admin Dashboard** op die dagen, omdat de data het netwerk niet heeft overgestoken.

Met andere woorden:

| Waar u vandaan leest | Data-versheid |
|---|---|
| **POS-zijde Rapportenscherm** in het back-office | Altijd live — lokale DB. |
| **Dashboard Rapportenscherm** in hoofdkantoor | Zo vers als de meest recente sync. Is een filiaal offline, dan ontbreekt de data van dat filiaal in geconsolideerde views totdat het Z-Rapport synct. |

Zie [Hoofdstuk 11](11-z-reports-and-end-of-day-sync.md) voor hoe sync-status te lezen en (indien nodig) het gat te dichten met USB-export.

---

## 10.9 Filterveld-referentie

Snelblik van elke filter-input die u in de dashboard-rapportschermen zult zien.

| Veld | Formaat | Gevalideerd als | Waar |
|---|---|---|---|
| `date_from` | `YYYY-MM-DD` | `date_format:Y-m-d` | Alle bereikrapporten |
| `date_to` | `YYYY-MM-DD` | `date_format:Y-m-d`, `after_or_equal:date_from` | Alle bereikrapporten |
| `date` (dagelijks / x-report) | `YYYY-MM-DD` | `date_format:Y-m-d` | Alleen dagelijks-endpoint |
| `year` (maandelijks) | integer ≥ 2020 | `integer, min:2020` | Alleen maandelijks-endpoint |
| `month` (maandelijks) | integer 1-12 | `integer, min:1, max:12` | Alleen maandelijks-endpoint |
| `store_id` | UUID | `uuid` + `StoreBelongsToOrg`-regel | Per-vestiging rapporten |
| `org_id` | UUID | `uuid` | Dashboard geconsolideerd + BTW (Super Admin) |
| `organisation_id` | UUID | `uuid, exists:organisations,id` | Rekenkamer-endpoint |
| `locale` | `nl` of `en` | `Rule::in(['nl','en'])` | Alle PDF-exports |
| `limit` (top producten) | 5-50 | `integer, min:5, max:50` | Top-producten-endpoint |

Een gefaalde validatie geeft HTTP `422` met de veld-niveau foutmelding terug. De dashboard-UI voorkomt de meeste hiervan door widget-ontwerp (datumkiezers enz.), dus u ziet typisch alleen 422 wanneer u de API direct aanroept.

---

## 10.10 Gebruikelijke rapport-taak-playbook

| Taak | Waar | Stappen |
|---|---|---|
| **Maandelijkse BTW-aangifte** | Dashboard → Rapporten → BTW | Stel Van = eerste dag van maand, Tot = laatste dag in. Klik Exporteer PDF (`locale=nl`). Bijvoegen aan aangifte. |
| **Omzet van gisteren over alle filialen** | Dashboard → Rapporten → Geconsolideerd | Klik op de pil **Gisteren**. KPI-kaarten beantwoorden direct. |
| **Eén vestiging, deze maand tot nu** | POS-rapportenscherm in die vestiging | (Manager-zijde werkstroom.) Of raak `/api/reports/custom?store_id=…&date_from=YYYY-MM-01&date_to=vandaag`. |
| **Spot-check een vestiging midden in de dag zonder de dag te sluiten** | POS-rapportenscherm → X-Rapport | Zelfde werkstroom als Z-Rapport maar tik op **X-Rapport** in plaats van **Dag sluiten**. |
| **"Wat verkocht het beste vorig kwartaal?"** | Dashboard → Rapporten → Geconsolideerd | Kies van = eerste van kwartaal, tot = vandaag. Scroll naar **Top producten**. |
| **"Rekenkamer komt volgende week"** | Dashboard → Auditlog → Rekenkamer-export | Kies bereik dat de auditperiode dekt, download de PDF, bewaar de SHA-256 hash in uw archiefsysteem. |
| **Cashflow-planning** | Dashboard → Rapporten → Geconsolideerd | Bekijk **Betaalmethoden**-strip — contant vs kaart-split vertelt u Brinks-ophaalvolume. |
| **Vang een prijs-perceptie-issue** | Dashboard → Rapporten → Geconsolideerd | Bekijk **Gem. bon** over tijd. Een daling zonder transactie-aantal-stijging = klanten kopen minder per bezoek. |

---

## 10.11 Troubleshooting

| Symptoom | Waarschijnlijke oorzaak | Oplossing |
|---|---|---|
| Dashboard-rapportscherm toont nullen over de hele linie | Datumfilter te smal, of geen verkopen in dat bereik. | Verbreed het datumbereik. Probeer de pil **Deze maand**. |
| Nummers matchen niet met het POS-zijde dagelijkse rapport van een vestiging | Eén zijde is de lokale DB (POS); de andere is HQ (dashboard). Is sync `pending`, dan loopt dashboard *achter*. | Controleer het Z-Rapporten-scherm (Hfdst. 11) voor `sync_status`. Indien `pending`, wacht op de volgende retry of gebruik USB-export. |
| PDF-export downloadt maar het bestand is 0 bytes | De query liep leeg, de data was leeg en DomPDF schreef een alleen-header-pagina. | Hercheck uw datumfilter — meestal zijn de datums omgekeerd of in de toekomst. |
| Per-vestiging BTW-totaal ≠ som van geconsolideerd BTW | Een vestiging is gedeactiveerd; die wordt uitgefilterd in de geconsolideerde query (`stores.is_active = true`). Het per-vestiging-endpoint past die filter niet toe. | Heractiveer de vestiging, of lees de per-vestiging-rapporten voor elke vestiging individueel. |
| "Toegang geweigerd" / 403 op het Rekenkamer-endpoint | U bent een vestigingsmanager — u heeft het recht niet. | Geef de export over aan uw OA of auditor. Of laat de Super Admin het namens u draaien. |
| BTW-rapport toont twee rijen op `0.00%` — één vrijgesteld, één niet | Dit is correct. **Vrijgesteld** (basisvoeding, medicijnen) en **nul-getarifeerd** (een 0% BTW-product dat niet juridisch vrijgesteld is) zijn twee verschillende dingen op het Belastingdienst-formulier. | Bedoelde u geen nul-getarifeerde belaste producten, audit dan de catalogus (Hfdst. 4) — elk product moet of 10% belast óf vrijgesteld zijn. |
| Top-producten-tabel ziet er vreemd uit (één productnaam verschijnt twee keer) | Een product werd halverwege de periode hernoemd; zowel oude als nieuwe namen verschijnen omdat het rapport groepeert op `product_name_snapshot`. | Werkt zoals bedoeld — historische bonnen moeten hun originele naam behouden. |

---

## 10.11a HQ-zijde wisselkoers-zichtbaarheid (audit + override)

Elke verkoop draagt de **`exchange_rate_used`** die werd vergrendeld op de dag dat die werd afgerekend — dezelfde koers die we tonen op de USD-regel van de bon. Dit is geen UI-ruis; het is een audit-anker.

### Waar u het ziet als OA / SA

- **Per verkoop** — Verkoopslijst (Dashboard → Verkopen) → klik een verkoop → het detailpaneel toont `Wisselkoers: 1 USD = SRD 37,5000` onderaan. Vergrendeld op het moment van verkoop; nooit herberekend.
- **Per dag** — Dashboard → Rapporten → Dagelijks → de metadatasectie van het rapport toont de koers vergrendeld voor die datum. Heeft een manager die midden in de dag overschreven, dan worden beide koersen vermeld met de OA die de wijziging maakte en de timestamp.
- **Per maand** — Dashboard → Rapporten → Maandelijks → veranderde de koers tijdens de maand, dan vermeldt het rapport de meest-gebruikte koers plus een telling van verkopen op elke onderscheiden koers.

### Waar het audit-gelogd wordt

Drie events raken de koers, allemaal geschreven naar `audit_logs`:

| Event | Wanneer | Wie | Wat zit er in `new_values` |
|---|---|---|---|
| `rate.locked` | Geplande `rates:lock` artisan-commando draait (dagelijks 06:00 AST) | systeem | source (api / manual), USD→SRD waarde, markup_pct |
| `rate.manual_override` | Manager tikt "Override" op het POS-koers-scherm | de SM | old_rate, new_rate, reden |
| `rate.fetched_unlocked` | `/rates/fetch` aangeroepen buiten de geplande run (alleen preview — geen verkoopimpact) | OA / SM | api_response_rate, applied_markup_pct |

### Waarom dit ertoe doet

Belastingdienst Suriname vraagt "welke koers werd gebruikt voor de USD-regel op deze bon?" — en het antwoord moet maanden later reproduceerbaar zijn, zelfs als de koers sindsdien is bewogen. `exchange_rate_used` op elke verkooprij opslaan maakt het antwoord triviaal: bevraag de verkoop, lees de kolom, klaar. Geen retroactieve herberekening, geen "nou, de koers van vandaag is X dus ik denk dat het toen Y was".

Komt een klant terug met een bon van 3 maanden geleden en betwist het USD-bedrag, dan kunt u de verkoop ophalen, de vergrendelde koers zien en de wiskunde direct bevestigen. Hetzelfde voor een Rekenkamer-auditor die een historische handel beoordeelt.

> **Praktische herinnering:** faalt de dagelijkse koers-fetch (ExchangeRate-API down, netwerkprobleem), dan gebruikt het systeem **gisteren's vergrendelde koers**. Het auditlogboek draagt `rate.locked` met `source = 'fallback_previous'`. De OA krijgt een e-mail zodat ze weten handmatig opnieuw te vergrendelen zodra de connectiviteit terug is. **Geen verkopen worden geblokkeerd** door een ontbrekende koers-fetch — de koers van de vorige dag blijft gelden totdat handmatig wordt overschreven.

---

## 10.11b Openstaande betalingen wachtrij (bank + mobiele overschrijvingen wachten op bevestiging)

Bankoverschrijvingen en mobiele overschrijvingen (DSB Mobiel, Hakrinbank Online, Republic Mobile) worden onmiddellijk aan de kassa geregistreerd, maar het geld is nog niet daadwerkelijk verplaatst — de bank van de klant moet de overschrijving nog vereffenen naar de rekening van de winkel. Totdat de OA bevestigt dat het geld geland is, zitten die verkopen in een **Openstaande betalingen**-wachtrij.

**Pad:** Dashboard → **Openstaande betalingen** (sectie Operations, OA / SM).

![Openstaande betalingen wachtrij — wacht op bevestiging](./screenshots/20-pending-payments-queue.png)

Wat u hier doet:
1. Open uw bank-app / afschrift.
2. Match elke openstaande rij op overschrijvings-provider + referentie (de kassier ving deze aan de kassa van het scherm van de klant).
3. Klik op **✓ Bevestig ontvangst** op de rij.
4. De verkoop flipt naar volledig `completed`, valt uit de wachtrij en telt vanaf dat punt mee in de dagelijkse totalen.

> **Waarom dit bestaat:** Belastingdienst telt een verkoop alleen wanneer betaling daadwerkelijk is geland, niet wanneer de kassier het afrekende. Deze in een aparte wachtrij dragen houdt dagelijkse totalen eerlijk en voorkomt per ongeluk dubbel-tellen wanneer het geld uiteindelijk op een latere werkdag arriveert. De originele verkooprij behoudt zijn `occurred_at`-timestamp voor audit; de `confirmed_at`-kolom registreert wanneer het geld daadwerkelijk vereffende en wie het bevestigde.

---

## 10.12 Kruisverwijzingen

- **Welk recht laat wie wat draaien** — [Hoofdstuk 1 — Rollen en rechten](01-roles-and-permissions.md).
- **BTW-vrij-vlag op een product** — [Hoofdstuk 4 — Catalogus en categorieën §4.7](04-catalogue-and-categories.md#47-the-btw-exempt-flag--when-to-use-it).
- **Einde-dag Z-Rapport (de operationele afsluiting, niet het analytische rapport)** — [Hoofdstuk 11 — Z-Rapporten en einde-dag-synchronisatie](11-z-reports-and-end-of-day-sync.md).
- **POS-zijde kassier kassa-afsluiting** — [POS-handleiding hfdst. 3 — Uw kassa](../user_manual/03-register.md).
- **Auditlog (waar elke rapport-export-actie wordt vastgelegd)** — [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) *(binnenkort beschikbaar)*.
- **De volledige BTW-wiskunde** — [Ontwikkelaarsdocs §5 — BTW-pipeline](../docs/05-btw-pipeline.md).
- **Rekenkamer-compliance achtergrond** — [Ontwikkelaarsdocs §3 — Auth en rollen](../docs/03-auth-and-roles.md).

---

→ Volgende: [Hoofdstuk 11 — Z-Rapporten en einde-dag-synchronisatie](11-z-reports-and-end-of-day-sync.md)
