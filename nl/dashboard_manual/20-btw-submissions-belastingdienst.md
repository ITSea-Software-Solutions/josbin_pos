# Hoofdstuk 20 — BTW-aangiftes aan Belastingdienst Suriname

Dit hoofdstuk behandelt de formele BTW-aangifteworkflow: hoe de Organisatiebeheerder / Vestigingsmanager een dagelijkse of maandelijkse BTW-aangifte indient bij Belastingdienst Suriname via het platform, en hoe de belastinginspecteur elke aangifte beoordeelt en accepteert.

Indien u zoekt naar de **per-vestiging BTW-uitsplitsing** zoals u die ziet binnen dag-/maandrapporten, dat is [Hoofdstuk 10 §10.4](10-reports.md). Dit hoofdstuk gaat over de **formele aangifte** die een audit-kwaliteit rij creëert die de inspecteur van de Belastingdienst kan zien, accepteren, betwisten, of u kan laten corrigeren.

Pad: **Dashboard → BTW-aangiftes**.

![BTW-aangiftes-scherm — aangiftelijst met statusbadges](./screenshots/20-btw-submissions-list.png)

---

## 20.1 Wat een "aangifte" is, en wie ze indient

Een **BTW-aangifte** is een momentopname van de totalen van één periode (verkopen, geheven BTW, vrijgestelde BTW) formeel verzonden aan Belastingdienst Suriname.

| Periodetype | Toepassing | Belastingdienst verwacht dit |
|---|---|---|
| **Dagelijks** (`period_start == period_end`) | Hoog-volume winkels die transparantie willen, ad-hoc audits, of een intern beleid om dagelijks aangifte te doen | Optioneel — niet de wettelijke cyclus |
| **Wekelijks** (volledige ma–zo week) | Tussentijdse controle tussen dagelijks en de maandafsluiting | Optioneel — alleen tussentijds |
| **Maandelijks** (1e → laatste dag van één kalendermaand) | Standaard | **Ja — formele maandelijkse aangiftecyclus** |

Beide soorten worden opgeslagen. De inspecteur kan inzoomen op een dagaangifte voor een specifieke datum, ook als de maandaangifte is geaccepteerd — het zijn twee weergaven van dezelfde onderliggende verkoopdata.

| Rol | Kan doen |
|---|---|
| **Organisatiebeheerder** (eigen organisatie) | Indienen · totalen voorvertonen · een correctie opnieuw indienen |
| **Vestigingsmanager** (eigen vestiging) | Idem, maar alleen voor de vestiging die aan hen is toegewezen |
| **Belastinginspecteur** (cross-organisatie, alleen-lezen) | Alle organisatie-aangiftes lijsten · accepteren · betwisten · inzoomen op verkoop-niveau detail |
| **Super Admin** | Alle bovenstaande plus leverancier-zijdige zichtbaarheid voor klantondersteuning |
| Kassier · Auditor · API-integratie | Geen toegang tot dit scherm |

---

## 20.2 Een aangifte indienen (OA / SM workflow)

**Pad:** Dashboard → BTW-aangiftes → **+ Nieuwe aangifte**.

![Modal BTW-aangifte indienen — periodekiezer + voorvertoning](./screenshots/20-submit-btw-modal.png)

### Stap 1 — Kies de periode

Een modal opent. Bovenaan toont deze **voor wie de aangifte is**:

- 🏪 **Aangifte voor: \<uw vestiging\>** — als u **Vestigingsmanager** bent. Uw aangiftes dekken alleen uw toegewezen vestiging; de scope ligt vast en is niet wijzigbaar. (Rapporten, Voorraad en Z-rapport scopen op dezelfde manier naar uw vestiging.)
- 🏢 **Aangifte voor: hele organisatie** — als u **Organisatiebeheerder** bent. Dit is de geconsolideerde aangifte op organisatieniveau (alle vestigingen samen) — de formele aangifte die de Belastingdienst verwacht, omdat BTW per organisatie wordt aangegeven (één BTW-nummer).

Kies daarna **Dagelijks**, **Wekelijks** of **Maandelijks**.

- **Dagelijks** vult vooraf *gisteren* in als datum (u dient meestal de totalen van de vorige dag in als eerste in de ochtend).
- **Wekelijks** vult vooraf *vorige week* in (vorige maandag–zondag) — een tussentijdse weergave tussen dagelijks en de maandafsluiting.
- **Maandelijks** vult vooraf *vorige maand* in (1e tot laatste dag). De einddatum-invoer is vergrendeld — maandelijks *moet* een volledige kalendermaand zijn volgens het Belastingdienst-formaat.

> Een vestigingsaangifte van een Vestigingsmanager en de organisatiebrede aangifte van de Organisatiebeheerder voor **dezelfde periode kunnen beide bestaan** — het zijn verschillende scopes. Wat niet kan, is dezelfde scope + periode twee keer indienen (dat is de dubbel-blokkering in Stap 2).

### Stap 2 — Totalen berekenen (de voorvertoonknop)

Klik op **🔍 Bereken totalen**. Dit is een **droogloop** — er wordt niets opgeslagen. Het systeem trekt elke voltooide verkoop in de periode op en toont:

| Veld | Wat het is |
|---|---|
| Aantal verkopen | Aantal voltooide verkopen in deze periode |
| Totaal omzet | Bruto SRD over alle verkopen (belasting-inclusieve prijzen) |
| Belastbaar | Som van verkopen met ten minste één BTW-belaste regel |
| Vrijgesteld | Som van verkopen die volledig BTW-vrijgesteld waren (basisvoedingsmiddelen, medicijnen) |
| **BTW te betalen** | Som van `btw_srd` — wat wordt afgedragen aan de Belastingdienst |

Als er al een aangifte bestaat voor deze periode (ingediend of geaccepteerd), toont de voorvertoning een gele waarschuwingsbanner: **"⚠️ Er bestaat al een aangifte voor deze periode (REF-XXX, status: …). Het systeem blokkeert dubbele indiening."** U kunt geen dubbele aangifte doen — om opnieuw in te dienen, gebruik de opnieuw-indienflow (§20.5).

### Stap 3 — Optionele indienernotitie

Een korte notitie die terechtkomt in het auditlogboek + zichtbaar is voor de inspecteur. Gebruik het voor:
- *"Eén kassa-einde ontbreekt, volgt in volgende aangifte."*
- *"Kassier had een systeemstoring tussen 14:30–15:00; verkopen voor dat venster zijn opgenomen uit handmatige papieren log."*

Belastingdienst-inspecteurs *lezen* deze — schrijf ze in de veronderstelling dat een inspecteur ze volgende week zal zien.

### Stap 4 — Indienen

Klik op **✓ Indienen bij Belastingdienst**. Drie dingen gebeuren atomisch:

1. Een `btw_submissions`-rij wordt aangemaakt met `status = 'filed'`, de totalen-snapshot, en een automatisch gegenereerde **referentie** zoals `BTW-2026-05-DEHOOPP-DAY-001`.
2. De volledige lijst van `sale_ids` die zijn opgerold in de totalen wordt opgeslagen — zodat een Rekenkamer-audit terug kan lopen van de aangifte naar de bronverkopen rij-voor-rij.
3. Een auditlogboek-entry `btw.submitted` wordt geschreven (zichtbaar in [h13](13-audit-log.md)) EN een manipulatiebestendige SHA-256 hash-keten-rij wordt toegevoegd (zelfde patroon als `audit_logs`).

Een groene bevestigingsbanner toont het referentienummer + het BTW-bedrag. Klaar. De aangifte staat nu in de wachtrij van de inspecteur.

> **Snapshot ≠ hernieuwde berekening.** De totalen opgeslagen op deze aangifte zijn VERGRENDELD op indieningstijd. Als een verkoop *later* wordt geannuleerd of terugbetaald, veranderen de cijfers van de oorspronkelijke aangifte niet — de correctie stroomt door naar de aangifte van de VOLGENDE periode als een negatieve regel. Dit komt overeen met hoe papieren boekhouding werkt in Suriname en vermijdt het retroactief herschrijven van geschiedenis die al is ingediend bij de Belastingdienst.

---

## 20.3 Wat de inspecteur ziet en doet (tax_inspector workflow)

De Belastingdienst-belastinginspecteur logt in met `belastingdienst@gov.sr` (demo) — **2FA is verplicht** voor deze rol, net als Super Admin. Na login landen zij direct op het BTW-aangiftes-scherm (waarbij ze het gebruikelijke Dashboardoverzicht overslaan).

Wat zij zien:

- **Alle aangiftes over alle organisaties** op het platform, gesorteerd op meest recent
- **Filters** op status (filed / accepted / disputed / superseded), periodetype (dagelijks / maandelijks), datumbereik, organisatie
- **Per-rij kolommen:** referentie · organisatie · periode · aantal verkopen · BTW (SRD) · status · ingediend-op + indiener · acties

Wat zij **niet** zien:
- Catalogus, producten, prijzen, klanten, verkoopdetailrijen, voorraad, kassasessies, vestigingsinstellingen, iets anders
- Financiële gegevens van andere belastingplichtigen *buiten* de BTW-totalen die zij formeel hebben ingediend

### Een aangifte accepteren

Voor elke `filed`-rij ziet de inspecteur twee actieknoppen:

**✓ Accepteer** — opent een kleine modal:
- Optionele `inspector_note` (bv. *"Geverifieerd tegen bankafschrift."*)
- Bevestigen → status → `accepted`, `reviewed_at` ingesteld, `reviewed_by` = inspecteur
- De OA van de belastingplichtige ziet de nieuwe status de volgende keer dat ze het scherm openen
- Auditlogboek: `btw.accepted`-gebeurtenis

### Een aangifte betwisten

**⚠ Betwist** — opent dezelfde modal maar de reden is **verplicht** (min 5 tekens).

- Voorbeelden van redenen: *"Totalen komen niet overeen met aanvullende Z-rapporten."*
- Bevestigen → status → `disputed`
- De belastingplichtige wordt **gemeld** — de Organisatiebeheerders + degene die de aangifte indiende krijgen een in-app 🔔 melding (de bel in de dashboardkop, met de betwistingsreden en een link naar de aangifte) **én** een officiële e-mail in Belastingdienst-stijl. Ze hoeven de lijst niet in de gaten te houden om het te weten te komen.
- Auditlogboek: `btw.disputed`-gebeurtenis

Een betwiste aangifte **blijft in het systeem** als een permanent record. De belastingplichtige kan dan een correctie opnieuw indienen (§20.5). Wanneer dat gebeurt, wordt de **inspecteur op zijn beurt gemeld** (🔔 + e-mail) dat een gecorrigeerde aangifte klaarstaat; wanneer de inspecteur **accepteert**, krijgt de belastingplichtige een afsluitende melding.

> 📧 **Opmerking over e-mailbezorging:** de in-app 🔔 bel werkt altijd. De *e-mail*-helft verstuurt pas zodra echte SMTP-gegevens op de server zijn geconfigureerd — tot dan leeft de melding alleen in de bel.

---

## 20.4 Wat de OA doet met een betwiste aangifte

1. Aangifte toont nu `Status = Disputed` met de reden van de inspecteur in `inspector_note`.
2. OA bekijkt de reden. Veelvoorkomende oorzaken: ontbrekende verkopen, BTW-vrijstelling betwist, periodegrensfout.
3. OA herstelt de onderliggende data (registreert de ontbrekende verkoop, corrigeert de BTW-vlag van het product, etc.).
4. OA klikt op **↺ Corrigeer** op de betwiste rij → gaat naar §20.5.

---

## 20.5 Een correctie opnieuw indienen (supersede-flow)

**Wanneer:** de aangifte is `filed` (OA heeft zelf een fout ontdekt) OF `disputed` (inspecteur heeft gevlagd). Een `accepted`-aangifte kan niet opnieuw worden ingediend — Belastingdienst's accept is definitief; verdere wijzigingen vinden plaats via een apart aanpassingsproces in de volgende periode.

**Pad:** BTW-aangiftes-scherm → vind de rij → klik op **↺ Corrigeer**.

### Wat er gebeurt

1. Een modal legt uit: *"Het origineel wordt gemarkeerd 'vervangen'. Een verse aangifte wordt aangemaakt voor dezelfde periode met opnieuw berekende totalen (inclusief eventuele annuleringen/terugbetalingen sinds de eerste aangifte)."*
2. Optioneel redenveld — aanbevolen (bv. *"Late-aangekomen bon opgenomen."*)
3. Klik op **↺ Opnieuw indienen**.

**Atomische transactie:**
- Oude rij: `status = 'superseded'`, `inspector_note` aangevuld met `[Superseded by BTW-XXX on YYYY-MM-DD]`
- Nieuwe rij: vers referentienummer, `status = 'filed'`, **totalen opnieuw berekend uit HUIDIGE verkopen voor dezelfde periode** (zodat annuleringen/terugbetalingen sinds de oorspronkelijke aangifte worden weerspiegeld)
- Auditlogboek: `btw.superseded`-gebeurtenis die beide rijen koppelt

Beide rijen blijven voor altijd in het audittrail. De inspecteur ziet de nieuwe aangifte in zijn wachtrij; het oude referentienummer is nog steeds opzoekbaar met de vervangen status verwijzend naar zijn vervanging.

> **Database-constraint:** de `(organisation_id, period_type, period_start, period_end)` uniqueness op `btw_submissions` is een *partiële* unique — deze sluit `superseded`-status uit. Dat is wat opnieuw indienen mogelijk maakt zonder geschiedenis te laten vallen. (Migratie `2026_05_26_070001_btw_submissions_partial_unique`.)

---

## 20.6 Auditlogboek-entries die u zult zien

Elke statusovergang schrijft een `audit_logs`-rij. Vanuit het [Auditlogboek-scherm](13-audit-log.md) kunt u filteren op deze gebeurtenissen:

| Gebeurtenis | Wanneer | `new_values` bevat |
|---|---|---|
| `btw.submitted` | OA/SM dient in | referentie, periode, totalen, submitter_note |
| `btw.accepted` | Inspecteur accepteert | inspector_note |
| `btw.disputed` | Inspecteur betwist | inspector_note (de betwistingsreden) |
| `btw.superseded` | OA/SM dient een correctie opnieuw in | vervangingsreferentie + nieuwe aangifte-id |

Voor Rekenkamer-audits bevat de [Rekenkamer-export](10-reports.md) de BTW-aangiftegeschiedenis naast de onderliggende verkopen.

---

## 20.7 Veelvoorkomende situaties

### "We zijn vergeten vorige week dagelijks in te dienen — kunnen we het nog steeds indienen?"
Ja. Periodedatums worden gevalideerd als `<= vandaag`, niet "deze week". Kies de datum in het verleden, klik op Bereken totalen, dien in. De referentie zal landen in het auditvenster van vorige week.

### "De Belastingdienst-inspecteur zegt dat zij geen aangifte hebben ontvangen"
De aangifte bestaat in het scherm van UW organisatie als `filed` — maar de inspecteur heeft het nog niet geaccepteerd. Twee mogelijkheden:
1. Inspecteur is nog niet ingelogd (meest voorkomend — zij zijn een mens, geen API).
2. Werkelijke miscommunicatie. Gebruik het auditlogboek om aan te tonen *wanneer* u heeft ingediend en *welke* referentie u heeft gekregen. Zij kunnen zoeken op referentie in hun eigen dashboard.

### "We hebben maandelijks ingediend maar realiseerden ons dat één vestiging was gemist"
Dien de maandaangifte opnieuw in (§20.5). De nieuwe totalen pakken automatisch de verkopen van de gemiste vestiging op. Origineel krijgt `superseded`; nieuwe krijgt `filed`; beide staan in het audittrail.

### "Inspecteur heeft geaccepteerd maar dagen later vonden we een fout"
U kunt een geaccepteerde aangifte niet opnieuw indienen. Twee paden:
- **Kleine fout**: dien een tegenboeking in in de aangifte van de volgende maand met een `submitter_note` die de correctie uitlegt.
- **Materiële fout**: neem direct contact op met de Belastingdienst via hun normale kanaal. Het systeem kan hun accept niet overrulen.

### "Waar vind ik de referentie van de aangifte die ik twee maanden geleden heb verzonden?"
Filter op datumbereik op het BTW-aangiftes-scherm. Of bevraag het auditlogboek (Auditlogboek → event = `btw.submitted` → filter op uw gebruikers-id).

---

## Zie ook

- [Hoofdstuk 10 — Rapporten](10-reports.md) — de per-rapport BTW-uitsplitsing die informeert wat wordt ingediend
- [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) — elke BTW-gebeurtenis wordt hier gelogd
- [Hoofdstuk 21 — Belastinginspecteur-rol](21-tax-inspector.md) — de rol die deze aangiftes beoordeelt
- [`FEATURES_AND_FLOWS.md §1.2b`](../FEATURES_AND_FLOWS.md) — de feature-inventaris + journey §3.8
- [`CLAUDE_WORKING_GUIDE.md` G-018](../CLAUDE_WORKING_GUIDE.md) — waarom we dit als een nieuwe rol hebben gebouwd, niet als een apart portaal
