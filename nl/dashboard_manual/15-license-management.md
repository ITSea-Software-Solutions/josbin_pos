# Hoofdstuk 15 — Licentiebeheer (UI-overzicht)

**Voor wie:** Super Admin (volledig overzicht van elke licentie over elke klant) en Organisatiebeheerder (ziet alleen de licentie van zijn eigen organisatie, kan een verlenging aanvragen).

**Wanneer u het nodig heeft:** elke keer dat een banner verschijnt die waarschuwt dat een licentie de vervaldatum nadert; wanneer een klant vraagt "hoe lang hebben we nog?"; of als onderdeel van de wekelijkse Super Admin-doorloop van het platform.

**Wat het voorkomt:** de ongemakkelijke maandagochtend waarin de POS van een klant om 06:00 AST in gedeeltelijke vergrendeling gaat en niemand wist dat de licentie verliep. Het dashboard maakt de vervalpijplijn zichtbaar lang voordat dat gebeurt.

> **Dit hoofdstuk is het *UI-overzicht* — wat het Licentie-scherm toont en hoe u het bedient.** Het diepgaande operationele speelboek (sleutels uitgeven vanuit de Licentieserver, hardware-fingerprints, end-to-end installatie, probleemoplossing, off-boarding, sales talking points) staat in **[Hoofdstuk 16 — Licentie-operaties](16-license-operations.md)**. Kruislinkt ze; dupliceer niet. Als u zoekt naar "wat doe ik wanneer de hardware van de klant kapot ging en de fingerprint veranderde?" — dat is Hoofdstuk 16 §16.9.

> _Screenshot placeholder: `dashboard_manual/screenshots/15-license-list.png`._
> _Vereist Super Admin-vastlegging — Organisatiebeheerder-zijbalk toont het Licentiebeheer-scherm niet; het demo Super Admin-account heeft 2FA afgedwongen._
---

## 15.1 Het model op dit scherm

Het Licentie-scherm toont rijen uit de back-office `licenses`-tabel — één rij per organisatie per actieve licentie.

```
ORGANISATIE (bv. Supermarkt De Hoop NV)
   │
   └── LICENTIE   (tier = Standard, max_stores = 1, max_terminals = 3)
         ├── valid_from         2026-05-26
         ├── valid_until        2027-05-26   ← drijft de urgentieberekening
         ├── days_remaining     365          ← afgeleid (vandaag vs valid_until)
         ├── hardware_uuid      <sha256 hash van MAC + CPU ID + install UUID>
         ├── last_validated_at  2026-05-26 06:00:00 (AST)
         ├── grace_period_ends_at  null      ← gezet wanneer in offline grace
         └── renewal_status     "active"     ← active / warning_30 / warning_14
                                              / grace / soft_lock / hard_lock
```

Het dashboard zet `days_remaining` + `renewal_status` om in een enkele **urgentie**-waarde (`ok / medium / high / critical`) die alle kleuren en welke banners worden getoond aanstuurt. De mapping:

| Dagen tot vervaldatum | Status | Urgentie | Banner |
|---|---|---|---|
| > 30 dagen | `active` | `ok` | geen |
| ≤ 30 dagen | `warning_30` | `medium` | gele strook |
| ≤ 14 dagen | `warning_14` | `high` | oranje strook |
| Verlopen, binnen 14-dagen grace | `grace` | `critical` | rode strook |
| Grace verlopen, gedeeltelijke vergrendeling (nieuwe verkopen geblokkeerd) | `soft_lock` | `critical` | rode strook |
| Gedeeltelijke vergrendeling + 30 dagen, volledige vergrendeling (login geblokkeerd) | `hard_lock` | `critical` | rode strook |

Kruislink: zie Hoofdstuk 16 §16.7 voor wat de klant op elke stap ervaart.

---

## 15.2 Het scherm openen

**Pad:** Dashboard → **Licentiebeheer** (linkerzijbalk, alleen Super Admin).

> Organisatiebeheerders zien een uitgeklede versie onder de instellingen van hun eigen organisatie — alleen hun ene licentierij, de urgentiebadge, en de knop **Vernieuwen**. Ze kunnen geen licenties van andere organisaties zien (de API filtert op queryniveau op `organisation_id`).

De pagina is in vier delen:

1. **Statistiekstrook** (bovenaan) — vier kaarten: Totaal / Actief / Verloopt (≤14d) / Kritiek
2. **Alertbanners** — automatische rode banner als een licentie kritiek is, oranje banner als een licentie in het ≤14d-venster zit
3. **Licentietabel** — één rij per organisatie
4. **Vervaltijdlijn legenda** (onderaan) — kleurcoderingsspiekbrief overeenkomend met de tabelstippen

---

## 15.3 De licentietabel — kolom voor kolom

| Kolom | Toont | Notities |
|---|---|---|
| **Organisatie** | Gekleurde initialen-avatar + organisatienaam + eerste 8 tekens van de licentie-UUID | Nuttig voor matchen met logs / kruisverwijzen in de Licentieserver |
| **Tier** | Gekleurde badge: Standard (indigo), Professional (paars), Enterprise (blauw) | Zie Hoofdstuk 16 §16.4.3 voor wat elke tier ontgrendelt |
| **Limieten** | `N vestigingen` + `N terminals` | Harde caps; overschrijden van een van beide is wat het bericht "License limit reached" in POS triggert (Hoofdstuk 16 §16.8) |
| **Geldig tot** | Vervaldatum in de locale van de gebruiker. Rood vetgedrukt als in het verleden. | Als een grace-periode einddatum bestaat, getoond eronder in rood: *"Noodperiode tot DD-MM-YYYY"* |
| **Resterende dagen** | Dagen-resterend pilletje, kleurgegradeerd groen → amber → oranje → rood → rood+teken voor verlopen | Negatief getal betekent voorbij vervaldatum |
| **Laatste validatie** | Wanneer de back-office voor het laatst succesvol heeft ingecheckt bij de Licentieserver | `—` als nooit gevalideerd (verse installatie); ouder dan 72u betekent dat de licentie in **offline grace** zit — zie §15.5 |
| **Status** | Ofwel *"In behandeling"* (verlengingsaanvraag ingediend, leverancier nog niet gereageerd) OF de urgentiebadge | In behandeling overrideert urgentie totdat leverancier de aanvraag verwerkt |
| (acties) | Knop **Vernieuwen** wanneer urgentie ≠ `ok` en geen aanvraag in behandeling | Verdwijnt volledig terwijl een aanvraag in behandeling is |

Een voettekstregel toont het totale aantal licenties.

> _Screenshot placeholder: `dashboard_manual/screenshots/15-license-row-detail.png`._
> _Vereist Super Admin-vastlegging — zie notitie bovenaan dit hoofdstuk._
---

## 15.4 Een verlenging aanvragen

Dit is de **klantgerichte** actie — wanneer een Organisatiebeheerder of Super Admin op *Vernieuwen* klikt, vernieuwen ze de licentie niet zelf (de leverancier controleert dat op de Licentieserver, zie Hoofdstuk 16). Ze dienen een **verlengingsaanvraag** in die in het auditlogboek terechtkomt en leveranciersondersteuning op de hoogte stelt.

**Om verlenging aan te vragen:**

1. Licentiebeheer-scherm → vind de rij → tik op **Vernieuwen** (of het rode equivalent als kritiek).
2. De Verlengingsmodal opent met:
   - De organisatienaam, tier
   - Huidige vervaldatum, aantal vestigingen, aantal terminals
   - Optioneel **Opmerkingen** tekstveld — typische inhoud: *"Verlenging voor 12 maanden, zelfde tier. Geen wijzigingen aan aantal terminals."*
3. Tik op **Aanvraag versturen**.
4. Bevestiging: *"Aanvraag ingediend — u wordt binnen 1 werkdag gecontacteerd."* De rijstatus verandert naar *"In behandeling"* en de Vernieuwen-knop wordt vervangen.

Onder de motorkap:

- Een entry wordt geschreven naar `audit_logs` met `event = 'license_renewal_requested'`, met vermelding van wie, wanneer, het IP, en de notities.
- `licenses.renewal_status` wordt ingesteld op `renewal_pending`.
- Leveranciersondersteuning ziet dit in hun dagelijkse Super Admin-dashboardrondgang en neemt contact op met de klant om betaling te bevestigen en de verlenging in de Licentieserver te verwerken.
- Wanneer de Licentieserver daadwerkelijk de nieuwe vervaldatum uitgeeft, werkt de volgende nachtelijke `license:check` (of een geforceerde check) `valid_until` bij en wist `renewal_status` — de rij gaat terug naar `ok` urgentie, banners weg, geen herinstallatie nodig.

> Het dashboard **verlengt nooit direct een licentie**. Het zou het licentiemodel verslaan als elke Organisatiebeheerder zich naar een gratis jaar zou kunnen klikken. De Vernieuwen-knop is altijd een *aanvraag*; de daadwerkelijke verlenging is een leverancieroperatie op de Licentieserver.

---

## 15.5 Wat de indicatoren betekenen — in één oogopslag

### Statistiekstrook-kaarten (bovenaan)

| Kaart | Aantal |
|---|---|
| **Totaal** | Elke licentie op het platform (inclusief ingetrokken) |
| **Actief** | `is_active = true` |
| **Verloopt** | Urgentie = `high` (≤ 14 dagen) |
| **Kritiek** | Urgentie = `critical` (verlopen, in grace, gedeeltelijke vergrendeling, of volledige vergrendeling) |

### Alertbanners

- **Rode banner** verschijnt als een licentie `urgency = critical` heeft. Bewoording: *"N licentie(s) vereisen onmiddellijke actie — verlopen of in noodperiode."*
- **Oranje banner** verschijnt als een licentie `urgency = high` heeft. Bewoording: *"N licentie(s) verlopen binnen 14 dagen. Verleng zo snel mogelijk."*

Beide linken nergens heen — ze zijn informatief, de acties zitten op de rijen.

### Vervaltijdlijn legenda (onderaan)

Een horizontale strook gekleurde stippen + labels die de urgentietabel in §15.1 weerspiegelen. Nuttig voor nieuwe Super Admins die de kleurcode willen onthouden.

---

## 15.6 Hardware-fingerprint reset — afgehandeld in Hoofdstuk 16

Een veelvoorkomende operationele vraag — *"de klant heeft zijn back-office-pc vervangen, het activeringstoken is nu ongeldig"* — is **geen** dashboard-actie. Het Licentie-scherm toont de fingerprint-hash (op dit moment als onderdeel van de rij-metadata; leverancier kan de rij uitklappen om hem te zien) maar laat u hem niet resetten.

De reset gebeurt in de **Licentieserver-admin**, niet het klantgerichte dashboard. Zie **[Hoofdstuk 16 §16.9 Hardware-fingerprint](16-license-operations.md#169-hardware-fingerprint--what-it-is-and-why)** voor het volledige speelboek.

---

## 15.7 Offline-grace-indicator

Als de back-office al enige tijd de Licentieserver niet kan bereiken, toont de kolom **Laatste validatie** een verouderde datum en krijgt de rij een kleine amberkleurige stip.

| Status | Wat de kolom toont |
|---|---|
| Net gevalideerd (< 24u) | Datum van vandaag, groene stip in rij |
| Verouderd 24–72u | Datum 1–3 dagen geleden, geen speciale indicator (dit is normaal — checks zijn dagelijks) |
| Verouderd > 72u | Datum > 3 dagen geleden + amberkleurige stip. Dashboard toont een *"Licentie kan niet bevestigd worden"*-banner op elk scherm. POS werkt nog steeds. |

> De "72-uur offline grace" is opzettelijk — de omzet van de klant stopt nooit door een netwerkstoring naar de Licentieserver van de leverancier. Zie Hoofdstuk 16 §16.6 voor het klantzijdig gedrag.

---

## 15.8 Een nieuwe licentie uitgeven (Super Admin, in-dashboard pad)

Er bestaan twee paden om een licentie in het systeem te krijgen — beide produceren dezelfde rij in `licenses` en triggeren hetzelfde verlengings-/vervalgedrag:

1. **Licentieserver (on-prem IonCube-levering)** — het oorspronkelijke pad, beschreven in [Hoofdstuk 16](16-license-operations.md). Gebruik voor klanten die een on-site Docker + IonCube-installatie ontvangen.
2. **In-dashboard (SaaS / intern / dev-organisaties)** — Super Admin klikt op de knop **+ Licentie uitgeven** rechtsboven op dit scherm. Geen externe Licentieserver vereist.

**Om een licentie uit te geven vanuit het dashboard:**

1. Klik op **+ Nieuwe licentie** in de paginakop (alleen Super Admin).
2. Kies de **Organisatie** uit het keuzemenu.
3. Kies de **Tier** (Standard / Professional / Enterprise).
4. Stel **Max. vestigingen** en **Max. terminals** in — de vestigingslimiet wordt live afgedwongen: wanneer een Organisatiebeheerder de (N+1)e vestiging probeert aan te maken, retourneert de API `409 LICENSE_STORE_LIMIT_REACHED` en het dashboard toont het bericht.
5. Kies **Geldig van** en **Geldig tot** (standaard vandaag en vandaag+1j).
6. Klik op **Licentie uitgeven**. De rij verschijnt direct in de tabel. Actie geauditlogd als `license.issued`.

**Per-rij Bewerken / Deactiveren (alleen Super Admin):**

- Het potloodpictogram opent hetzelfde formulier vooraf ingevuld voor bewerken — meestal gebruikt om `max_stores` te verhogen, `valid_until` te verlengen (een echte verlenging, niet alleen de aanvraagflow in §15.4), of tier mid-contract te wijzigen.
- Het prullenbakpictogram **deactiveert** de licentie — zet `is_active=false`. De rij blijft in de auditketen; alleen de handhaving stopt. Gebruik dit voor annuleringen / off-boarding.

> De Vernieuwen-knop beschreven in §15.4 heeft nog steeds een plaats — het is voor *klanten* (Organisatiebeheerders) om een verlenging **aan** te **vragen** die de leverancier goedkeurt op de Licentieserver. De Bewerken-knop is de leverancierzijdige directe verlenging, en alleen Super Admin ziet die.

---

## 15.9 Wat dit scherm NIET doet

Om tijd te besparen bij doodlopende sporen, biedt het Licentiebeheer-dashboard expliciet geen:

- **Weergave licentiesleutel** — sleutels zijn gehasht in rust; niets in het dashboard kan een sleutel onthullen na uitgifte. Klanten die hun sleutel verloren hebben kunnen heractiveren met dezelfde sleutel die bij installatie is verstuurd (deze staat in hun installer-e-mail) of contact opnemen met leveranciersondersteuning voor een opnieuw verzenden.
- **Hardware-fingerprint reset** — alleen leverancier, op de Licentieserver (Hoofdstuk 16 §16.9). Het dashboard ziet nooit ruwe hardware-data.
- **Per-feature toggles** — features zijn tier-gebonden, niet individueel licentieerbaar.
- **Klantzijdige directe licentieverlenging** — de Vernieuwen-knop in §15.4 is een *aanvraag*; de daadwerkelijke verlenging gebeurt via Super Admin Bewerken (§15.8) of op de Licentieserver.

---

## 15.10 Snelle referentie

```
SCHERM OPENEN          Dashboard → Licentiebeheer
                       (alleen Super Admin — Organisatiebeheerders zien hun eigen rij in org-instellingen)

STATUS BEGRIJPEN       Statistiekstrook → Totaal / Actief / Verloopt / Kritiek
                       Tabelrijen → urgentiebadge per organisatie
                       Tijdlijn legenda → kleurcode onderaan

VERLENGING AANVRAGEN   Rij → Vernieuwen → notities invullen → Aanvraag versturen
                       Auditgelogd. Status slaat om naar "In behandeling".
                       Leverancier verwerkt in Licentieserver (1 werkdag).

VERVAL URGENTIE-MAP    > 30 dagen     → groen   (ok)
                       ≤ 30 dagen     → geel    (medium)
                       ≤ 14 dagen     → oranje  (high)
                       Verlopen ≤ 14d → rood    (critical, grace)
                       Gedeeltelijke vergr. → rood (critical, verkopen geblokkeerd)
                       Volledige vergr.     → rood (critical, login geblokkeerd)

OFFLINE VEROUDERD      Laatste validatie > 72u geleden → amberkleurige stip + "kan niet bevestigd"-banner
                       POS blijft verkopen — 72u grace is opzettelijk

INTREKKEN / HARDWARE   Niet in dashboard — zie Hoofdstuk 16 (Licentieserver-admin)
RESET / NIEUWE SLEUTEL Niet in dashboard — zie Hoofdstuk 16
```

Voor alles voorbij wat het scherm toont — sleutels uitgeven, installeren op het terrein van de klant, wat er gebeurt op dag 355 vs dag 0, hardware-fingerprint resets, off-boarding — ga naar **[Hoofdstuk 16 — Licentie-operaties](16-license-operations.md)**.

---

→ Volgende: [Hoofdstuk 16 — Licentie-operaties: sales, install, vernieuwen, herstellen](16-license-operations.md)
