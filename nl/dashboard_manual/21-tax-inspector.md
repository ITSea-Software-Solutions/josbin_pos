# Hoofdstuk 21 — Belastinginspecteur (Belastingdienst Suriname)

Dit hoofdstuk behandelt de **tax_inspector**-rol — het account van Belastingdienst Suriname op het platform. Het is een cross-organisatie, strikt alleen-lezen rol beperkt tot BTW-aangiftes. Dit hoofdstuk is geschreven voor de inspecteur zelf (wat zij zien), de Super Admin die het account aanmaakt, en de OA die nieuwsgierig is waarom iemand buiten hun organisatie hun aangiftes kan zien.

> **Waarom een rol, geen apart portaal?** Wij overwogen het bouwen van een aparte Gov Portal-app en besloten daartegen. De redenering is vastgelegd in [`CLAUDE_WORKING_GUIDE.md` G-018](../CLAUDE_WORKING_GUIDE.md): hetzelfde identiteitssysteem, dezelfde data, dezelfde theming, klein feature-oppervlak — past als een rol binnen het bestaande dashboard. Industriestandaard (Stripe, Shopify Plus, Datadog org-admin, Auth0 doen allemaal belasting/regulator-toegang via rol-gating in de hoofdapp).

---

## 21.1 Wat de belastinginspecteur kan doen

Een `tax_inspector`-account heeft **cross-organisatie alleen-lezen** toegang strikt gescopet aan:

| Kan doen | Kan niet doen |
|---|---|
| Elke BTW-aangifte over elke organisatie op het platform lijsten | Catalogus, producten, prijzen zien |
| Filteren op organisatie / periode / status / datumbereik | Verkoopdetail of verkoopitems zien |
| Inzoomen op een aangifte en zien totalen + de bron sale-ID's bestreken | Klanten zien (enige PII) |
| Een ingediende aangifte accepteren | Enige data bewerken (alleen-lezen, behalve de accept/dispute-actie) |
| Een ingediende aangifte betwisten met een schriftelijke reden | Licenties uitgeven, gebruikers beheren, organisaties beheren |
| Hun eigen auditlogboek-entries zien (eigen accept/dispute-acties) | Operationele data zien — voorraad, kassa's, Z-Rapporten, AI-inzichten, etc. |
| Hun eigen profiel + wachtwoord + 2FA beheren | Iets in de schermen van andere rollen |

De rol bestaat omdat de Belastingdienst inspecteert over alle belastingplichtigen, niet slechts één — dat is een fundamenteel ander bereik dan de per-organisatie `auditor`-rol (die is voor interne compliance-medewerkers / Rekenkamer toegewezen aan een specifiek ministerie).

---

## 21.2 Een belastinginspecteur-account aanmaken (Super Admin-taak)

**Pad:** Dashboard → Platform → **Gebruikers** → **+ Gebruiker toevoegen**.

Vul in:
- **Naam** — de echte naam van de inspecteur (bv. "Belastingdienst Inspecteur — J. de Vries")
- **E-mail** — het officiële `@gov.sr`-e-mailadres van de inspecteur
- **Rol** — **Belastinginspecteur** in het keuzemenu (alleen Super Admin ziet deze optie)
- **Organisatie** — leeg laten. Belastinginspecteurs zijn cross-organisatie by design en moeten niet worden vastgepind aan een enkele tenant.
- **Tijdelijk wachtwoord** — auto-genereer een sterke; deel het via de inloggegevens-banner die na aanmaak verschijnt

> **2FA is verplicht** — belastinginspecteur staat op de `TWO_FACTOR_ALWAYS_ROLES`-lijst naast Super Admin. Bij hun eerste login prompts het dashboard automatisch QR-code-scan in Google Authenticator (of een willekeurige TOTP-app). Eenmaal bevestigd heeft elke volgende login ook de 6-cijferige code nodig. Kan niet worden uitgeschakeld op beleidsniveau. Zie [h17](17-security-policy.md).

Overhandig hen de inloggegevens (de banner toont het tijdelijke wachtwoord eenmaal). Vertel hen de dashboard-URL.

### Demo-account (voor testen)

Indien u in de demo-stack werkt:
- E-mail: `belastingdienst@gov.sr`
- Wachtwoord: `Inspector@2026`
- Bij hun eerste login worden zij gevraagd 2FA in te stellen — scan de QR met Google Authenticator.

> **Geen screenshots in dit hoofdstuk (nog).** Omdat 2FA verplicht en niet-omzeilbaar is voor deze rol, kan de headless Playwright screenshot-suite niet bij de UI van de inspecteur komen zonder een handmatige 2FA-secret-wissing via `php artisan tinker`. Voer de suite handmatig uit nadat u het geheim heeft gewist (zie het taakverslag) om `21-tax-inspector-dashboard.png` en de cross-organisatie-aangiftelijst vast te leggen. Tot dan vertrouwt het hoofdstuk op proza + de onderliggende schermontwerpen die u kunt zien door direct in te loggen op de demo-stack.

---

## 21.3 Wat de inspecteur ziet wanneer zij inloggen

Na een succesvolle login (wachtwoord + 2FA), wordt de inspecteur auto-gerouteerd **direct naar het BTW Dashboard** — een KPI-landingspagina die hen een netwerkbrede momentopname geeft voordat zij inzoomen op individuele aangiftes.

Hun zijbalk-navigatie (toegevoegd in taak #82) heeft precies twee secties:

```
─ COMPLIANCE ─
  BTW Dashboard                ← landingsscherm met KPI's, trend, top organisaties, late waarschuwingen
  BTW-aangiftes                ← de volledige lijst, filterbaar
  Auditlogboek                 ← hun eigen actiespoor

─ ACCOUNT ─
  Mijn Profiel                 ← profiel + wachtwoord + 2FA-reset + eigen sessies
```

Dat is het. Geen Vestigingen, Producten, Klanten, of andere operationele data. De rolbadge linksonder zegt **Belastinginspecteur** (NL) of **Tax Inspector** (EN).

### Het BTW Dashboard (landingsscherm)

Vier koptegels bovenaan:
- **BTW deze maand** (met % delta vs vorige maand — groen als omhoog, rood als omlaag)
- **In behandeling beoordeling** — aantal `filed`-aangiftes die wachten op accept/dispute. Klik om naar de lijst te springen voorgefilterd op filed.
- **Open betwistingen** — aantal `disputed`-aangiftes die wachten op correctie van belastingplichtige. Klik om te springen.
- **Geaccepteerd deze maand** — formele bevestigingen afgetekend.

Daaronder: een **30-dagen BTW-trend** sparkline (BTW geheven per dag) voor snel oogcontact met netwerkvolume.

Vervolgens twee zij-aan-zij panelen:
- **Top organisaties (per BTW deze maand)** — top 10 belastingplichtigen gerangschikt op afgedragen BTW. Klik op een rij → lijstweergave gefilterd op die organisatie.
- **Late aangiftes (>7 dagen)** — organisaties die meer dan een week niet hebben ingediend. Rode vlag — dit zijn degene om achter aan te gaan. Klik om naar de lijst van die organisatie te springen (die mogelijk leeg is, wat de "niet ingediend"-status bevestigt).

Auto-refresh: elke 60 seconden, geen handmatige herlaad nodig.

### De aangiftelijst (nu met rijke filters — taak #82)

| Filter | Wat het doet |
|---|---|
| 🔍 **Zoekvak** | Match op referentienummer (bv. `BTW-2026-05-DEHOOPP-DAY-001`) of organisatienaam. Live. |
| **Status** | `filed` (wachtrij) / `accepted` / `disputed` / `superseded` |
| **Periode** | `dagelijks` / `maandelijks` |
| **Organisatie** | Keuzemenu van alle organisaties op het platform |
| **POS-bron** | `Josbin POS` (native verkopen) / `External POS (API)` (Laag-3-integratoren) / Alle |
| ✗ **Filters wissen** | Pilletje dat verschijnt wanneer een filter is ingesteld, één-klik reset |

Klik op een rij → opent het detailscherm (§21.3a).

---

### 21.3a Aangifte-detailscherm

Opent wanneer de inspecteur op een aangifterij klikt. Vervangt de vorige "alleen-lijst"-weergave met een volledig audit-kwaliteit beeld.

**Kop:** referentie, organisatienaam + BTW-nummer, periodebereik.

**Status + totalen-tegel:**
- 4 statistieken: Aantal verkopen · Totaal omzet · Belastbaar · Vrijgesteld
- Groot getal: **BTW te betalen** (het hoofdcijfer dat wordt ingediend)
- Statusbadge (Filed / Accepted / Disputed / Superseded)
- Ingediend-op + door; Beoordeeld-op + door (indien beoordeeld)
- **Actieknoppen**: ✓ Accepteren, ⚠ Betwisten (indien filed), ↺ Opnieuw indienen (indien OA / SM van eigen organisatie en aangifte is filed/disputed)

**Notitiespaneel:** indienernotitie (van OA) + inspecteursnotitie (van u op vorige beoordeling) letterlijk getoond.

**Vier uitsplitsingstegels** (2×2 raster):

1. **🏬 Per vestiging** — wanneer een organisatie meerdere vestigingen heeft, zie welke wat bijdroeg. Aantal transacties + BTW per vestiging. Nuttig voor "vestiging A is verantwoordelijk voor het grootste deel van de betwisting".
2. **💻 Per POS-bron** — **de toekomstbestendige.** Toont of verkopen kwamen van `Josbin POS` (native) of `External POS (API)` (een derde-partij POS die verkopen heeft gepusht via onze Laag-3 Open Integration API). Beide dragen gelijkelijk bij aan de BTW-aangifte — de inspecteur ziet de VOLLEDIGE aangifte ongeacht op welke kassa de verkoop is geboekt. De keuze van de belastingplichtige voor POS-leverancier is onzichtbaar vanuit een BTW-perspectief.
3. **💳 Per betalingsmethode** — contant / pin / overschrijving / mobiel bankieren / vreemde valuta / QR-betaling. Nuttig voor het verifiëren van contant-vs-bank-afwikkelingsreconciliatie.
4. **🧾 Per BTW-tarief** — de juridische Belastingdienst-weergave: 0% (vrijgesteld) vs 10% (standaard) vs elk aangepast tarief, met basis + BTW-kolommen.

**🕒 Tijdlijn:** elke auditlogboek-gebeurtenis die deze aangifte raakt, in chronologische volgorde. Filed → reviewed → (superseded? → nieuwe aangifte → reviewed → …)

### 21.3b Waarom zichtbaarheid van bron-POS belangrijk is

Suriname's regelgevingsmodel verwacht dat BTW-afdracht de **belastingplichtige (de organisatie)** volgt, niet de techstack die zij gebruiken. Een supermarkt zou kunnen:

- Josbin POS exclusief gebruiken (`source = pos` op elke verkoop)
- Een derde-partij POS gebruiken die verkopen pusht via onze `POST /v1/sales`-API (`source = api`)
- Beide naast elkaar gebruiken (verschillende terminals, verschillende leveranciers, dezelfde organisatie)

In alle drie de gevallen dient de OA één BTW-aangifte per periode in die ALLE hun verkopen dekt. De detailweergave van de inspecteur toont de **mix** — zij zien hetzelfde wettelijke totaal ongeacht hoe het is geboekt, maar met toeschrijving zodat zij het POS-landschap van de organisatie begrijpen tijdens compliance-beoordelingen.

Dit is opzettelijke toekomstbestendiging — naarmate meer Surinaamse detailhandelaren gemengde-POS-opstellingen adopteren (bv. een keuken-POS voor restaurants + Josbin voor kassier), verandert de inspecteur-workflow niet.

---

## 21.4 Dagelijkse workflow

### De wachtrij beoordelen

Het BTW-aangiftes-scherm opent naar de meest recente aangiftes over alle organisaties, gesorteerd op ingediend-op DESC. Standaard ziet de inspecteur alles; veelvoorkomende filters:

- **Status = filed** — de onbeoordeelde wachtrij (waar de meeste dagen op lijken)
- **Status = disputed** — aangiftes nog onder correctie
- **Periode = maandelijks** + Jaar/Maand-bereik — de officiële aangiftecyclus
- **Organisatie** — inzoomen op een specifieke belastingplichtige

### Per-aangifte acties

Voor elke `filed`-rij heeft de inspecteur twee knoppen:

**✓ Accepteer** — formele bevestiging.
- Optionele notitie (bv. *"Geverifieerd tegen bankafschrift 26-05-2026."*)
- Bevestigt dat de aangifte overeenkomt met verwachtingen
- Auditgelogd

**⚠ Betwist** — formele bezwaar.
- Verplichte reden (min 5 tekens)
- Voorbeelden: *"Totalen komen niet overeen met bankdepot-log."* / *"Eén Z-Rapport-periode ontbreekt."* / *"BTW-tarief verkeerd toegepast op categorie X."*
- Auditgelogd
- De OA van de belastingplichtige ziet de betwistingsreden de volgende keer dat ze BTW-aangiftes openen en kan een correctie opnieuw indienen (zie [h20 §20.5](20-btw-submissions-belastingdienst.md#205-resubmitting-a-correction-supersede-flow))

### Wanneer een belastingplichtige opnieuw indient

De nieuwe aangifte verschijnt in de wachtrij met dezelfde periode-datums maar een nieuwe referentie. Het vervangen origineel is nog steeds doorzoekbaar (filter gewoon `status = superseded`) en linkt naar zijn vervanging.

---

## 21.5 Hoe zit het met hun auditlogboek?

Het Auditlogboek-nav-item (in de sectie Compliance) is de weergave van de inspecteur van hun EIGEN actiespoor — elke accept / dispute die zij hebben gedaan, met tijdstempels, IP, doel-aangiftereferentie. Het scherm scopet op `user_id = inspector.id`.

> **Waarom dit bestaat:** Rekenkamer of een willekeurige second-line audit van de Belastingdienst zelf kan de inspecteur vragen "wat heeft u afgelopen kwartaal geaccepteerd?" en de inspecteur heeft een schoon, exporteerbaar spoor.

---

## 21.6 Wat de inspecteur NOOIT kan zien

Dit is de moeite waard om duidelijk te stellen, vooral aan Organisatiebeheerders die zich zorgen kunnen maken over privacy:

| Data | Zichtbaarheid |
|---|---|
| Productnamen, prijzen, BTW-tarieven per product | ❌ |
| Individuele verkooprijen, verkoopitems, regeltotalen | ❌ |
| Klantnamen, contactgegevens, ID-nummers (allen WBP-S-versleuteld sowieso) | ❌ |
| Voorraadniveaus, voorraadmutaties | ❌ |
| Z-Rapporten (per-vestiging kassa-sluitingen) | ❌ |
| Kassa's, kassasessies, kassier-verschillen | ❌ |
| Gebruikerslijsten, rollijsten, wie is ingelogd | ❌ |
| API-integratie-sleutels, webhooks | ❌ |
| **Alleen BTW-aangiftes — en alleen de snapshot-totalen, nooit de onderliggende brondata** | ✅ |

De sale-ID's die door een aangifte worden bestreken WORDEN opgeslagen op de aangifte-rij voor Rekenkamer-traceerbaarheid — maar de backend-policy van de inspecteur-rol stelt geen verkoop-detail-endpoint bloot. Zij kunnen "deze aangifte dekte N sale-ID's" zien; zij kunnen niet opzoeken wat op elke stond.

Een Belastingdienst-auditor die dieper detail wil, gebruikt de Rekenkamer-exportworkflow ([h10 §10.6](10-reports.md)) die door de SA/OA gaat, niet door de inspecteur-rol.

---

## 21.7 Veelvoorkomende vragen

### "Waarom kan ik geen vestigingsdata zien? Ik moet de totalen verifiëren."
By design — BTW-aangiftes dragen de totalen die de belastingplichtige attesteert. Diepere verificatie is een Rekenkamer-stijl audit die een andere (papier-gebonden + signed PDF) workflow is met de betrokkenheid van de Organisatiebeheerder, geen self-service dashboard inzoom. Praat met de Organisatiebeheerder als u het nodig heeft.

### "Ik heb een aangifte betwist maar de belastingplichtige heeft niet opnieuw ingediend."
Dat is hun beslissing om te maken — zij kunnen achter de oorspronkelijke totalen blijven staan. De betwisting is permanent op het audittrail. U kunt escaleren via uw normale Belastingdienst-proces.

### "Kan ik aangiftes zien van organisaties die zijn gedeactiveerd?"
Ja — de aangifterij is onafhankelijk van de actieve vlag van de organisatie. Als een belastingplichtige midden in het jaar failliet gaat, zijn hun bestaande aangiftes nog steeds inspecteerbaar.

### "Ik wil een CSV-export van alle geaccepteerde aangiftes voor Q1."
Nog niet — Fase 2 verbetering. Voor nu: filter op datumbereik + status=accepted, screenshot of kopieer de tabel. E-mail josbin-support als u een export-pijplijn nodig heeft toegevoegd.

### "Kan ik de onderliggende bonnen zien achter een aangifte?"
Nee, zie §21.6. Als u dat nodig heeft, kan de Organisatiebeheerder een Rekenkamer-export genereren ([h10 §10.6](10-reports.md)) wat een signed PDF + CSV is met de volledige transactiedetail. Standaard voor diepgaande belastingautoriteit-onderzoeken.

### "Kunnen twee belastinginspecteurs hetzelfde account delen?"
Nee. Elke inspecteur moet zijn eigen account hebben zodat het audittrail accept/dispute-acties correct toeschrijft. Super Admin maakt één account per inspecteur aan.

---

## 21.8 Wat gebeurt er als u uw 2FA-apparaat vergeet

Standaardherstel:
1. U stelt 2FA in bij eerste login en **ontving 8 recovery codes** — gebruik een daarvan om in te loggen (elk eenmalig).
2. Als u alle 8 heeft gebruikt: de **Super Admin kan uw 2FA resetten** via Dashboard → Gebruikers → uw rij → **Reset 2FA** ([h3 §3.10](03-users.md)). U wordt gevraagd de QR-code opnieuw in te stellen.
3. Na de reset, **scan de nieuwe QR**, sla de nieuwe recovery codes ergens veiliger op dan uw telefoon (kluis, afgedrukt in een verzegelde envelop, etc.).

---

## Zie ook

- [Hoofdstuk 20 — BTW-aangiftes aan Belastingdienst Suriname](20-btw-submissions-belastingdienst.md) — wat de OA / SM doet aan de andere kant
- [Hoofdstuk 1 — Rollen & Rechten](01-roles-and-permissions.md) — de volledige rolmatrix
- [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) — eigen actiespoor
- [Hoofdstuk 17 — Beveiligingsbeleid](17-security-policy.md) — 2FA-handhaving
- [`FEATURES_AND_FLOWS.md §1.2b + §3.8`](../FEATURES_AND_FLOWS.md) — feature-lijst + end-to-end journey
- [`CLAUDE_WORKING_GUIDE.md` G-018](../CLAUDE_WORKING_GUIDE.md) — waarom een rol, geen portaal
