# Hoofdstuk 13 — Auditlogboek

**Voor wie:** Organisatiebeheerder (af en toe — "wie heeft afgelopen woensdag de prijs van dit product gewijzigd?"), Auditor (intensief — die rol bestaat specifiek om dit scherm te lezen), en elke Belastingdienst-inspecteur of Rekenkamer-compliance-medewerker die tijdens een controle een Auditor-account heeft gekregen.
**Wanneer u dit gebruikt:** geschillen over *wie wat heeft gedaan*, post-incident forensisch onderzoek ("de prijs was verkeerd van 14:00 tot 16:30 — wie heeft dat hersteld?"), het voorbereiden van een Rekenkamer-auditpakket, en routinematige steekproeven door de Belastingdienst tijdens een BTW-controle.
**Wat dit voorkomt:** geschillen die niet kunnen worden opgelost omdat niemand weet wie iets heeft gewijzigd, overheidsbevindingen van "niet-controleerbare financiële administratie", en elke aannemelijke ontkenning voor manipulatie door een beheerder die later spijt heeft van een beslissing.

Het auditlogboek is **de enige bron van waarheid** voor de vraag *"wat is er in dit systeem gebeurd, door wiens hand, wanneer?"*. Andere schermen in het dashboard tonen de **huidige toestand**; het auditlogboek toont de **geschiedenis van elke wijziging** die ertoe heeft geleid.

![13 auditlogboek-scherm](screenshots/13-audit-log-screen.png)
---

## 13.1 Het model — waarom dit scherm bijzonder is

De meeste databasetabellen kunnen worden ingevoegd in, bijgewerkt, en verwijderd. De tabel `audit_logs` is opzettelijk ontdaan van twee van deze drie rechten, **op de modellaag in code**, niet alleen door Postgres-rechten:

```php
// backend/app/Models/AuditLog.php
protected static function booted(): void
{
    static::creating(function (AuditLog $log) {
        // …bereken SHA-256 row_hash + previous_row_hash hier…
    });

    static::updating(fn () => false);   // ← blokkeert stil elke UPDATE
    static::deleting(fn () => false);   // ← blokkeert stil elke DELETE
}
```

Dat, plus een hash-keten, geeft u **drie onafhankelijke redenen** waarom een beheerder de geschiedenis niet kan manipuleren:

| Verdedigingslaag | Wat het doet | Wat het tegenhoudt |
|---|---|---|
| **1. Eloquent hooks** | `static::updating(fn () => false)` en `static::deleting(fn () => false)` retourneren `false`, wat Laravel behandelt als "operatie stil afbreken". | Elk codepad dat via het `AuditLog`-model loopt — inclusief admintools, console-opdrachten, en per ongeluk gemaakte developerfouten. |
| **2. Database-schrijfbeveiliging** | De Postgres-rol die door de applicatie wordt gebruikt heeft alleen `INSERT, SELECT` op `audit_logs` — `UPDATE` en `DELETE` zijn ingetrokken. | Iedereen die het model omzeilt met `DB::table('audit_logs')->update(...)`. De query geeft een fout op DB-driver-niveau. |
| **3. SHA-256 hash-keten** | Elke nieuwe rij slaat zowel zijn eigen `row_hash` op (berekend uit zijn inhoud + de hash van de vorige rij) als de hash van de vorige rij. Manipulatie van een historische rij maakt dat elke rij erna faalt bij verificatie. | Iedereen met ruwe filesystem-toegang die handmatig Postgres-databestanden herschrijft. Ze kunnen de bytes veranderen; ze kunnen de keten niet opnieuw berekenen zonder hem te breken. |

```
                              ┌─ rij N-1 ─┐         ┌─── rij N ───┐         ┌─ rij N+1 ─┐
                              │           │         │             │         │           │
                              │ row_hash  │ ──hash─▶│ prev_hash   │ ──hash─▶│ prev_hash │
                              │           │         │ row_hash    │         │           │
                              └───────────┘         └─────────────┘         └───────────┘

                          inhoud van rij N wijzigen   →   row_hash berekent een andere waarde
                                                      →   prev_hash van rij N+1 komt niet meer overeen
                                                      →   verifyChain() markeert de breuk
```

> **Zelfs de Super Admin kan het auditlogboek niet wijzigen.** Dit is opzettelijk. Als de leverancier (Super Admin) stilletjes rijen zou kunnen verwijderen, zou het auditlogboek geen bewijswaarde hebben — en zou de Rekenkamer de export niet accepteren.

### Wat wordt gecontroleerd

Elk Eloquent-model dat de `OwenIt\Auditing\Auditable`-trait gebruikt. Op dit moment:

| Model | Wanneer geschreven | Wie triggert het (meestal) |
|---|---|---|
| `Sale` | Aangemaakt (elke verkoop), bijgewerkt (zelden — manager-correcties), verwijderd (nooit — verkopen worden geannuleerd, niet verwijderd) | Kassier, manager (terugbetalingen/annuleringen) |
| `Product` | Aangemaakt, bijgewerkt (prijswijzigingen, BTW-wijzigingen, deactivering, voorraadcorrecties), verwijderd (alleen leverancier) | Organisatiebeheerder, Vestigingsmanager |
| `User` | Aangemaakt, bijgewerkt (rolwijziging, 2FA-reset, deactivering), verwijderd (zelden) | Organisatiebeheerder, Super Admin |
| `Organisation` | Aangemaakt, bijgewerkt, verwijderd | Super Admin |
| `Store` | Aangemaakt, bijgewerkt, verwijderd | Super Admin, Organisatiebeheerder |
| `ZReport` | Aangemaakt (elke sluiting), bijgewerkt (alleen wanneer synchronisatiestatus verandert) | Vestigingsmanager |
| `Customer` | Aangemaakt, bijgewerkt. PII-velden blijven versleuteld in de auditwaarden — zie Hoofdstuk 9. | Kassier (POS quick-add), Organisatiebeheerder, Vestigingsmanager |
| Voorraad-gerelateerd | Een voorraadcorrectie schrijft zowel een `stock_movements`-rij als een `audit_logs`-rij | Vestigingsmanager, Organisatiebeheerder |

Elke rij bevat:

| Veld | Wat het opslaat |
|---|---|
| `id` | Big int, auto-increment. Gebruikt als de natuurlijke ordening binnen de keten. |
| `user_id` | De UUID van de actor. `null` als een systeemjob (zeldzaam — zie hieronder). |
| `organisation_id` | De organisatie waartoe de wijziging behoort. Gebruikt om te scopen wat elke rol kan zien. |
| `event` | `created`, `updated`, of `deleted`. |
| `auditable_type` | De volledig gekwalificeerde modelklasse (bv. `App\Models\Sale`). |
| `auditable_id` | De PK van het gewijzigde model. |
| `old_values` | JSONB. De waarden van de velden *vóór* de wijziging. `null` voor `created`. |
| `new_values` | JSONB. De waarden van de velden *na* de wijziging. `null` voor `deleted`. |
| `ip_address` | Het IP van de actor op het moment. `inet`-type in Postgres. |
| `created_at` | Wandkloktijd in **AST** (America/Paramaribo). |
| `previous_row_hash` | SHA-256 hex van de `row_hash` van de vorige auditrij. `null` voor de allereerste rij van een organisatie. |
| `row_hash` | SHA-256 hex van de inhoud van deze rij geconcateneerd met `previous_row_hash`. De ketenschakel. |

---

## 13.2 Wie kan wat zien

Zichtbaarheid wordt bepaald per rol. Hetzelfde auditlogboek wordt op database-queryniveau gefilterd — er is geen "ik laat u alle rijen zien maar verberg ze in de UI"-truc.

| Rol | Ziet audit-entries voor… |
|---|---|
| **Super Admin** | Elke rij in de tabel, over elke organisatie. |
| **Organisatiebeheerder** | Alleen rijen waar `user_id` toebehoort aan een gebruiker in zijn eigen organisatie. |
| **Auditor** | Zelfde scope als Organisatiebeheerder (hun eigen organisatie), maar alleen-lezen over het hele dashboard — ze bestaan voor complianceonderzoeken. |
| **Vestigingsmanager, Kassier, API-integratie** | Geen toegang. Het menu-item wordt niet eens weergegeven. |

> **De query-scope wordt server-side afgedwongen.** Een Vestigingsmanager kan het auditlogboek niet bereiken, zelfs niet door de URL in te typen — de controller retourneert `403 Forbidden`.

> **Aandachtspunt overheidsafdeling.** Wanneer een organisatie als `is_government = true` is gemarkeerd, leeft deze in een apart geïsoleerde tenant-database (onderdeel van de beveiligingsarchitectuur voor overheidsklanten). Het auditlogboek voor een overheidsorganisatie is daarom fysiek gescheiden van commerciële organisaties — zelfs een Super Admin moet naar de juiste tenant verwijzen om het te lezen. Het dashboard handelt dit transparant af in normaal gebruik; voor directe DB-queries (leveranciersondersteuning) kies de juiste verbinding.

---

## 13.3 Het scherm — wat erop staat

**Pad:** Dashboard-zijbalk → **Audit / Auditlogboek**.

![13 auditlogboek overzicht](screenshots/13-audit-log-overview.png)
Drie regio's gestapeld van boven naar beneden:

1. **Rekenkamer-exportpaneel** — datumbereik + taalkiezer + knop "Rekenkamer-PDF downloaden". Zie §13.7.
2. **30-dagen samenvattingskaarten** — aantal gebeurtenissen in de laatste 30 dagen, uitgesplitst per gebeurtenistype (`created` / `updated` / `deleted`) en per modeltype.
3. **Filterbare tabel** — de werkelijke rijen, nieuwste eerst.

### Samenvattingskaarten

Snelle visuele baseline van wat er gebeurt. Cijfers zijn alleen voor de **laatste 30 dagen**, gescopet op het zichtbare-organisatie-bereik van de gebruiker.

| Kaart | Wat het telt |
|---|---|
| **Totaal 30 dagen** | Elke auditrij in het venster (binnen zichtbaarheidsbereik). |
| **Created** | Auditrijen met `event = created`. |
| **Updated** | Auditrijen met `event = updated`. |
| **Deleted** | Auditrijen met `event = deleted`. Zou een klein getal moeten zijn — de meeste "deletes" in Josbin POS zijn soft (deactiveringen), die als `updated` verschijnen. |
| Eén kaart per `model_type` | Per-model tellingen — bv. `Sale 432`, `Product 17`, `User 3`. |

> **Een hoog "Deleted"-aantal voor `Product` is een waarschuwingssignaal.** Catalogusitems horen niet hard te worden verwijderd (Hoofdstuk 4) — ze horen te worden gedeactiveerd. Als u `Deleted: 12` ziet tegen `Product`, is het de moeite waard om die rijen op te halen en te vragen waarom.

---

## 13.4 Het logboek filteren

Een balk met filters bevindt zich tussen de samenvattingskaarten en de tabel. Alle filters worden gecombineerd (AND) en resetten naar pagina 1 bij wijziging.

| Filter | Type | Wat het matcht |
|---|---|---|
| **Zoeken** + knop | Vrije tekst | Een hoofdletter-ongevoelige substring van `event`, `auditable_type`, of de JSONB-geserialiseerde `new_values`. Nuttig voor "vind elke auditrij die een specifieke productnaam vermeldt". |
| **Event** | Keuzemenu | `Alle events` (standaard), `created`, `updated`, `deleted`. |
| **Model** | Keuzemenu | `Alle modellen`, dan: `Sale`, `Product`, `User`, `Organisation`, `Store`, `ZReport`. De match is een suffix-`like` zodat het volledig gekwalificeerde klassenamen tolereert. |
| **Datum van** | Datuminvoer | Inclusieve ondergrens op `created_at::date`. AST. |
| **Datum t/m** | Datuminvoer | Inclusieve bovengrens op `created_at::date`. AST. |
| **Wis filters** | Knop | Reset alles naar standaardwaarden (`per_page: 50, page: 1`). |

### Typische filterrecepten

| Vraag | Stel deze filters in |
|---|---|
| "Toon me elke productprijswijziging in de laatste 7 dagen" | Event = `updated`, Model = `Product`, Datum van = vandaag − 7. Kijk dan naar de diff-kolom voor `price`-wijzigingen. |
| "Wie heeft gisteren een verkoop geannuleerd?" | Event = `updated`, Model = `Sale`, Datum van + Datum t/m = gisteren. Annuleringen verschijnen als een statusveldwijziging naar `voided`. |
| "Heeft iemand deze maand een gebruiker gedeactiveerd?" | Event = `updated`, Model = `User`, Datum van = eerste van de maand. Zoek naar `is_active: true → false` in de diff. |
| "Vind elke auditrij die 'Volle Melk' vermeldde afgelopen kwartaal" | Zoeken = `Volle Melk`, Datum van / t/m = kwartaal. Raakt elke rij waarvan de `new_values` JSON de string bevat. |
| "Alle admin-logins van afgelopen week opgehaald" | Op dit moment registreert het auditlogboek geen succesvolle logins als een rij (login wordt gevolgd via `last_login_at` op `users`). Mislukte logins staan in het aparte beveiligingslog — niet in dit scherm vanaf deze release. |

### De tabel — kolom voor kolom

| Kolom | Toont |
|---|---|
| **Tijdstip** | Gelokaliseerde korte datum + 24-uurs tijd (`26 mei` / `14:32`). AST. Klik ergens op de rij om uit te klappen. |
| **Event** | Gekleurd pilletje — groen `Created`, blauw `Updated`, rood `Deleted`. |
| **Model** | Gekleurd pilletje — paars `Sale`, cyaan `Product`, amber `User`, groen `Organisation`, indigo `Store`, roze `ZReport`. |
| **Gebruiker** | De naam van de actor + rol (`Vestigingsmanager`, `Organisatiebeheerder`, etc.) — of `System` als `user_id` null is. |
| **Wijzigingen** | Een compacte veld-voor-veld diff: tot 4 gewijzigde velden, elk met `oud → nieuw` (afgekapt tot ~20 tekens). `+N meer velden` als er meer zijn. De velden `updated_at`, `last_used_at`, `last_login_at` worden opzettelijk verborgen — die vuren bij elke save en voegen geen signaal toe. |
| **IP** | Bron-IP-adres ten tijde van de actie. Nuttig voor "deze wijziging kwam van buiten het kantoornetwerk". |
| **(chevron)** | ▼ / ▲ — klikken op de rij toggelt de volledige detail-uitklap. |

### Uitgeklapte rij

Klikken op een rij onthult de volledige **Vóór**- en **Na**-waarden als naast elkaar mooi geformatteerde JSON, plus de **Model-ID** (UUID) van het gewijzigde record. PII-velden (klantnaam, telefoon, etc.) verschijnen als hun *versleutelde ciphertext* — zie §13.6.

![13 auditrij uitgeklapt](screenshots/13-audit-row-expanded.png)
---

## 13.5 Een diff lezen

De diff-kolom is dicht by design — de meeste updates raken slechts één of twee velden, dus ze allemaal inline tonen bespaart u het klikken in elke rij.

Een typische rij leest:

```
price        12.50  →  13.00
btw_rate                10.00
is_active    true   →   false      +3 meer velden
```

| Visuele cue | Betekenis |
|---|---|
| Twee pilletjes met `→` ertussen | Veld gewijzigd; links = vóór, rechts = na. |
| Enkel groen pilletje, geen `→` | Veld is aanwezig in `new_values` maar afwezig of ongewijzigd in `old_values`. Voor een `created`-gebeurtenis ziet elk veld er zo uit. |
| Enkel rood pilletje, geen `→` | Veld is in `old_values` maar gewist in `new_values` (bv. een barcode op null zetten). |
| Grijze sleutel, geen pilletje | Veld wordt getoond maar beide kanten leeg / niet relevant. |
| `+N meer velden`-regel | Meer gewijzigde velden dan de 4-rij-preview kan tonen. Klik op de rij om ze allemaal te zien. |

---

## 13.6 PII in het auditlogboek — wat een auditor werkelijk ziet

Klantrecords en een paar andere tabellen versleutelen hun PII in rust (Hoofdstuk 9). Die versleutelde kolommen stromen door naar het auditlogboek **als hun ciphertext** — wat betekent dat de diff twee lange ondoorzichtige strings toont, geen twee leesbare namen.

Dit is opzettelijk. Het voldoet aan twee vereisten tegelijk:

1. De auditor kan verifiëren *dat een record is gewijzigd*, *door wie*, *wanneer*, en *welke velden* — voldoende voor de "controle-spoor"-vereiste van de Rekenkamer.
2. De auditor kan geen PII uit het auditlogboek zelf oogsten — voldoende voor de WBP-S-vereiste van "geen achterdeur naar versleutelde data".

In de praktijk ziet een `Customer` `updated`-rij eruit als:

```
name    eyJpdiI6IkVx…   →   eyJpdiI6Ik9YK…
phone   eyJpdiI6Ikta…   →   eyJpdiI6Ikta…   (geen wijziging)
```

…wat leest als: "het naamveld van de klant is gewijzigd; het telefoonveld is herschreven naar dezelfde waarde (waarschijnlijk onderdeel van een save-alle-velden-bewerking)". Iedereen met de applicatiesleutel kan die ciphertexts ontsleutelen als een gerechtelijk bevel dat vereist. Niemand anders kan dat.

> **Voor niet-PII-tabellen (Product, Sale, etc.) zijn de waarden plain.** Een productprijswijziging toont `12.50 → 13.00` in het duidelijk, zoals het hoort — dat zijn geen persoonsgegevens.

---

## 13.7 Rekenkamer signed-PDF-export

![13 rekenkamer-export](screenshots/13-rekenkamer-export.png)
Bovenaan het scherm zit een datumbereik + taalkiezer + downloadknop: **Rekenkamer van Suriname — Auditexport**.

Dit is het officiële, ondertekende auditdocument dat de **Rekenkamer van Suriname** accepteert bij een financieel overheidsonderzoek. Het is *geen* terloopse CSV — het is een digitaal ondertekende PDF die bevat:

- Een volledige chronologische lijst van elke auditgebeurtenis in het gekozen venster.
- Voor elke gebeurtenis: actor, rol, IP, AST-tijdstempel, model, ID, volledige vóór/na-waarden (PII-velden getoond versleuteld, precies als §13.6).
- Een **ketenverificatieverklaring** — op exporttijd herhaalt het systeem de SHA-256 hash-keten over elke opgenomen rij. Als een rij faalt bij verificatie, wordt de export afgebroken en toont het scherm een fout in plaats van een niet-ondertekende PDF te produceren.
- Een **document-handtekening** — de hele PDF is ondertekend met het certificaat van de organisatie, zodat de Rekenkamer kan verifiëren dat de export afkomstig is van deze specifieke Josbin POS-installatie en niet is bewerkt na generatie.
- Tweetalige (`nl` of `en`) koppen en labels — kies de taal waarin de ontvangende auditor leest.

**Om te genereren:**

1. Kies de **Van** en **Tot** datums (elk AST-datumbereik; standaard is de laatste 30 dagen).
2. Kies de **Taal** — `Nederlands` als het naar een Surinaamse autoriteit gaat, `English` voor intern onderzoek of internationale audit.
3. Klik op **Rekenkamer-PDF downloaden**.
4. De PDF downloadt als `rekenkamer_<van>_<tot>.pdf`. Overhandig deze aan de auditor.

> **Wie de export kan uitvoeren.** Super Admin, Organisatiebeheerder, en Auditor. Vestigingsmanagers kunnen het niet — by design, het Rekenkamer-pakket is een document op organisatieniveau, geen vestigingsdocument.

> **Wat er gebeurt als de keten breekt.** De export weigert te produceren. Het foutbericht noemt de eerste falende rij. Dit is het systeem dat u vertelt om leveranciersondersteuning te bellen — ketenmislukking duidt op (a) een ontwikkelaarsfout ergens in de codebase die het model heeft omzeild, of (b) manipulatie. Beide zijn ernstig; los het niet handmatig op.

---

## 13.8 Veelvoorkomende fouten / valkuilen

**"Ik kan een rij niet vinden die ik verwachtte te zien."** Drie gebruikelijke oorzaken:

- De handelende gebruiker behoort tot een andere organisatie en u bent geen Super Admin → onzichtbaar door scope.
- Het model gebruikt nog niet de `Auditable`-trait → helemaal niet geaudit. Vanaf deze release omvat dit een paar perifere modellen zoals `HeldBill` (vastgehouden cart-resumes worden momenteel niet individueel geaudit — de resulterende verkoop wel).
- De filterdatums sluiten het uit. `Datum van`/`t/m` zijn *datum*, niet *datum+tijd* — een rij om 23:59 op de 26e is opgenomen met `Datum t/m = 2026-05-26`.

**"Waarom toont een password reset van een admin geen diff?"** Wachtwoordvelden worden uit `old_values` en `new_values` gestript voordat de rij wordt geschreven. U ziet een `User updated`-gebeurtenis door de admin, tegen de ID van de betreffende gebruiker, maar het `password`-veld zal niet in de JSON staan. Dat is correct — bcrypt-hashes blootstellen in het auditlogboek zou een beveiligingsbevinding zijn.

**"De 30-dagen totaal-kaart zegt 1.234 maar de tabel heeft maar 50 rijen."** De tabel is gepagineerd (standaard 50 per pagina). Gebruik de paginatie-besturingselementen onderaan de tabel, of wijzig de paginagrootte via de API (`per_page` tot 200) — er is nog geen paginagrootteselector in de UI.

**"`Sale created`-rijen overspoelen het log."** Dat klopt — elke afgeronde verkoop maakt er één. Gebruik de `Model = Sale` + datumfilters om te focussen, of filter `Event = updated` om de ruis van normale verkopen over te slaan en alleen manager-interventies (annuleringen, terugbetalingen, correcties) te zien.

**"Ik wil een oude audit-entry verwijderen die een typfout bevat."** Dat kan niet. Dat is het hele punt. Voeg een *nieuwe* corrigerende wijziging toe — de oude rij blijft.

**"Zoeken op de klantnaam leverde niets op."** Klant-PII is versleuteld; de `new_values` JSON van de auditrij bevat ciphertext, niet de plaintext naam. Substring-zoeken zal nooit overeenkomen met een klantnaam. Filter in plaats daarvan op `Model = Customer` en de actor.

**"Twee rijen tonen dezelfde wijziging op exact dezelfde seconde."** Bijna altijd twee opslagen door een dubbelgeklikte knop. Eloquent dedupliceert identieke updates niet — elke `save()` produceert één auditrij, zelfs als elk veld identiek is. Cosmetisch, niet schadelijk.

**"Ik heb de Rekenkamer-PDF geëxporteerd en het duurde 3 minuten."** Verwacht voor bereiken van meer dan 90 dagen of organisaties met hoog transactievolume. De ketenverificatie is O(rijen) en de ondertekenstap is een enkele grote hash — beide onvermijdelijk. Plan grote exports voor einde van de dag.

---

## 13.9 Wat wordt geregistreerd in het auditlogboek wanneer u het auditlogboek gebruikt

Dit is de meta-vraag en die verdient een duidelijk antwoord.

De **lees-paden** (het scherm laden, filters toepassen, pagineren, een rij uitklappen) worden **niet geaudit**. Lezen is gratis; auditlog-vermoeidheid is reëel, en elke pageload registreren zou het werkelijke signaal verdrinken.

De **export-actie** (klikken op *Rekenkamer-PDF downloaden*) **wordt** geaudit — een rij wordt geschreven met `event = exported`, `auditable_type = AuditLog`, `user_id = <u>`, IP, en de exportparameters (datumbereik + taal) in `new_values`. Op deze manier registreert het auditlogboek "een export van zichzelf heeft plaatsgevonden" — belangrijk omdat een Rekenkamer-PDF in iemands e-mailinbox een afgeleid werk is dat PII-ciphertext bevat, en de Verwerkersovereenkomst meestal vereist dat alle dergelijke afgeleiden traceerbaar zijn.

> **Eén subtiliteit:** de export-auditrij is zelf deel van de hash-keten. Dus een export om twaalf uur vandaag, gevolgd door een verkoop om 12:01, zijn aan elkaar gebonden — u kunt het exportspoor niet stilletjes verwijderen zonder de keten van dat moment af te breken. Goed.

---

## 13.10 Snelle referentie

```
AUDITLOGBOEK OPENEN     Dashboard → zijbalk → Audit / Auditlogboek
                        Zichtbaar voor: Super Admin, Organisatiebeheerder, Auditor

VIND WIE X HEEFT GEW.   Filter Model = <model>, Event = updated, datumbereik
                        Klik op rij om uit te klappen voor volledige vóór/na JSON

VIND ACTORSPOOR         Geen direct gebruikersfilter in UI (nog) — sorteer door op
                        Gebruiker-kolom te klikken; of bevraag API direct met ?user_id=

RAW JSON DIFF           Klik op een rij om uit te klappen — volledige Vóór/Na-panelen
                        + Model-ID voor kruisverwijzing

EXPORT REKENKAMER-PDF   Bovenaan scherm → datumbereik + taal → Download
                        Hash-keten end-to-end geverifieerd vóór ondertekening

30-DAGEN OVERZICHT      Samenvattingskaarten bovenaan het scherm
                        Auto-gescopet op organisatie-zichtbaarheid van uw rol

KETEN HANDMATIG VERIF.  Leverancieropdracht:
                        php artisan audit:verify-chain --org=<uuid>
                        Retourneert "OK" of noemt de eerste gebroken rij
```

Kruisverwijzingen: [Hoofdstuk 1](01-roles-and-permissions.md) voor wie het auditlogboek kan lezen, [Hoofdstuk 9](09-customers.md) voor waarom PII versleuteld is in auditrijen, [Hoofdstuk 16](16-license-operations.md) voor hoe het auditlogboek licentievervaltijd overleeft (de data-exporttools blijven 90 dagen beschikbaar zelfs onder volledige vergrendeling — `audit_logs` is inbegrepen). Voor de ontwikkelaarszijdedetails van hoe de keten wordt opgebouwd en geverifieerd, zie `/docs/03-auth-and-roles` en de `AuditHashService`-klasse.

---

→ Volgende: Hoofdstuk 14 — AI-inzichten *(binnenkort beschikbaar)*
