# Script 04 — Belastinginspecteursportaal doorloop

**Doel:** de overheidsgerichte pitch. Overtuig Belastingdienst Suriname of een Ministerie-inspecteur dat het portaal hen geeft wat ze nodig hebben (zichtbaarheid over organisaties heen, auditspoor, bron-POS-attributie) en *niets* dat ze niet zouden moeten zien (geen catalogus, geen klantgegevens, geen verkoopdetail buiten wat formeel ingediend is).

**POV:** Belastinginspecteur (`belastingdienst@gov.sr / Inspector@2026`).

**Doelduur:** 4 min.

**Controle vóór opname**

- [ ] Demostack draait.
- [ ] **Wis het 2FA-geheim van de belastinginspecteur** vóór de opname (zie `README.md`). Schakel onmiddellijk na de take weer in.
- [ ] Minstens 3 BTW-aangiftes geseed over 2+ organisaties en 2+ statussen (ingediend + geaccepteerd + betwist). Zonder variatie ziet de dashboard-sparkline er vlak uit.
  - Snelle manier: log in als OA, dien een maandelijkse in. Log in als de inspecteur, accepteer hem. Herhaal voor een tweede organisatie met een dagaangifte die op *Ingediend* blijft staan. Betwist er één om dat pad te tonen.
- [ ] Browsertaal nl-NL.

---

## Openingshaakje — 15 s

> "Belastingdienst Suriname ziet BTW-aangiftes vandaag de dag op dezelfde manier als 20 jaar geleden — op papier, in e-mailbijlagen, in spreadsheets die op verschillende dagen van verschillende winkels binnenkomen. Zo zou het scherm van een moderne belastinginspecteur eruit kunnen zien als elke belastingplichtige zijn BTW via hetzelfde platform indient."

**Caption op het scherm:** "Wat een moderne Belastingdienst-inspecteur ziet."

---

## Scène 1 — Inloggen + landingspagina (30 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Inlogpagina | "Inspecteur logt in met zijn overheids-e-mail." | |
| Type inloggegevens | "In productie vereist dit 2FA — niet te omzeilen. Ik heb het alleen voor de opname gewist." | "2FA verplicht in productie" |
| Kom op **BTW Dashboard** | "Inspecteur komt op een BTW-dashboard, niet op een generieke POS-weergave. De rol ziet *alleen* BTW — geen catalogus, geen klanten, geen verkoopdetailrijen." | "Inspecteur ziet alleen wat nodig is" |

---

## Scène 2 — Dashboardrondleiding (45 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Vier KPI-tegels | "Vier KPI's bovenaan — aangiftes deze periode, geaccepteerd, betwist, in afwachting van beoordeling. Zo weet de inspecteur in één oogopslag of er een wachtrij is." | |
| 30-dagen sparkline | "Sparkline toont aangiftes per dag over de laatste 30 dagen. Pieken markeren periode-eind-clusters — nuttige patroongegevens." | |
| Top-organisaties-paneel | "Top organisaties op ingediende BTW. Klik op één om in hun aangiftes in te zoomen." | |
| Late-aangiftes-paneel | "Late aangiftes — organisaties die hun maandaangifte nog niet hebben ingediend, met het aantal dagen te laat. Actiewachtrij, niet zomaar een getal." | "Late aangiftes → actiewachtrij" |

---

## Scène 3 — Aangiftelijst met filters (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Zijbalk → **BTW-aangiftes** | "Aangiftelijst." | |
| Filter-keuzemenu — status | "Filter op status — ingediend, geaccepteerd, betwist, vervangen." | |
| Filter — periodetype | "Periodetype — dagelijks of maandelijks." | |
| Filter — organisatie | "Op organisatie — kies één belastingplichtige om in te zoomen." | |
| Filter — datumbereik | "Datumbereik." | |
| Filter — **Bron** | "En bron-POS — dit is het future-proof stuk. Sommige belastingplichtigen gebruiken Josbin POS, maar het systeem accepteert ook aangiftes van derde-partij-POS-systemen via onze open API. Inspecteur kan de weergave splitsen op welk systeem indiende. Native aangiftes hier, derde-partij daar." | "Native vs derde-partij POS — gesplitste weergave" |
| Pas een filtercombinatie toe | "Combineer filters — geef me alle maandelijkse Geaccepteerde aangiftes van Supermarkt De Hoop van januari tot en met maart." | |
| Tabel werkt bij | "Tabel werkt direct bij. CSV-export beschikbaar." | |

---

## Scène 4 — Inzoomen op een aangifte + accepteren / betwisten (75 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Klik op **Bekijken** bij een Ingediende rij | "Open een aangifte." | |
| Detailscherm — bovenste sectie | "Referentie, organisatie, periode, status. Indiener en ingediend-op." | |
| Per-vestiging-uitsplitsing-tegel | "Per-vestiging-uitsplitsing — voor ketens, zie welke vestiging hoeveel bijdroeg." | |
| Per-betaalmethode-tegel | "Per betaalmethode — contant, pin, bankoverschrijving, mobiele overschrijving. Handig bij het controleren tegen bankafschriften." | |
| Per-BTW-tarief-tegel | "Per BTW-tarief — 0 procent vrijgesteld versus de standaard 10 procent. Maakt direct zichtbaar of een belastingplichtige iets verkeerd geclassificeerd heeft." | "Misclassificaties in één oogopslag zichtbaar" |
| Per-bron-POS-tegel | "En per bron-POS — Josbin native hier, alles via API zou apart verschijnen." | |
| Klik op **✓ Accepteer** | "Cijfers kloppen — accepteer." | |
| Modal — optionele opmerking | "Optionele opmerking — *Geverifieerd tegen bankafschriften.*" | |
| Klik op bevestigen → status springt | "Geaccepteerd. Inspecteur-id, tijdstempel, en opmerking zijn nu permanent." | |
| (Optioneel) Toon **⚠ Betwist**-flow op een andere rij | "Op een andere rij — betwisten. Reden is verplicht, minimaal 5 tekens. Belastingplichtige ziet de reden in zijn eigen dashboard." | "Betwisten → belastingplichtige corrigeert → opnieuw indienen" |

---

## Scène 5 — Auditspoor + wat de inspecteur niet kan zien (30 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Klik op **Mijn activiteit** in Mijn Profiel | "Het eigen auditlogboek van de inspecteur — elke actie die ze hebben uitgevoerd, voor hen zichtbaar." | |
| Toon entries | "Hun accepteren, hun betwisten, hun zoekopdrachten." | |
| Zijbalk-rondleiding | "Zijbalk — twee secties, meer niet. Compliance en Account. Geen manier om bij catalogus, prijzen, klanten, verkoopdetailrijen of andere belastingplichtige-gegevens te komen buiten formeel ingediende BTW-totalen." | "Hard-geïsoleerd op de API-laag" |

---

## Afsluiting — 25 s

> "Wat je hier ziet is een Belastingdienst-inspecteur die zijn werk in minuten kan doen in plaats van dagen — zonder ooit een enkel stukje belastingplichtige-gegevens te zien dat niet voor hem bedoeld is. Cross-organisatie-zichtbaarheid voor BTW. Nul zichtbaarheid voor al het andere. Hash-geketende auditlogboek bij elke actie. Dit is de inspectie-ervaring die de Belastingdienst in 2026 zou moeten hebben."

**Laatste caption op het scherm:** "Gebouwd voor Belastingdienst Suriname."

---

## Na opname

- **Schakel het 2FA van de belastinginspecteur onmiddellijk weer in:**

  ```bash
  docker exec josbin_demo_app php artisan tinker --execute='
    $u = \App\Models\User::where("email","belastingdienst@gov.sr")->first();
    if (! $u->two_factor_secret) {
      // Force a fresh setup on next login.
      $u->save(); // policy will re-enforce
      echo "ready for re-setup\n";
    }
  '
  ```

  Of bezoek simpelweg de Mijn Profiel → 2FA van de inspecteur en zet opnieuw op via authenticator.

- Dit script is degene die het meest waard is om aan een overheidsklant te tonen. Deel pas nadat je het één keer hebt nagelezen op zenuwtrekjes.
- Titel: *"Josbin POS — het Belastingdienst-portaal dat Suriname kon hebben."*
