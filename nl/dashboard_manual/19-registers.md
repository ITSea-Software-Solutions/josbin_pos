# Hoofdstuk 19 — Kassabeheer

Het **Kassabeheer**-scherm is het thuis van de manager voor de fysieke kassa's onder zijn vestiging. Het is de dashboardtegenhanger van [user_manual h3 — Uw Kassa](../user_manual/03-register.md) (de weergave van de kassier aan de POS).

Pad: **Dashboard → Kassabeheer** (in de sectie *Organisatie* van de zijbalk voor OA / SM; *Support tools* voor SA).

![Kassabeheer-scherm — OA scope](./screenshots/19-registers-screen.png)

> Dit hoofdstuk was lange tijd beloofd door kruisverwijzingen in h11 en is eindelijk geland. Als u hier kwam via "Hoofdstuk 8" of "Hoofdstuk 19" vanuit elders, dit is het.

---

## 19.1 Wat een "kassa" is

In Josbin POS-termen:

- **Kassa** = een genummerde fysieke kassa. Eén per kassalade / POS-terminal in de vestiging. Heeft een naam (bv. "Kassa 1", "Servicebalie") en een actief/inactief vlag.
- **Kassasessie** = één *opening* van een kassa door één kassier. Vanaf het moment dat de kassier de lade opent met een beginsaldo tot het moment dat hij hem sluit met een kastelling. Veel sessies per kassa per dag (dienst-overdrachten).
- **Z-Rapport** = einde-dag juridische sluiting voor de hele vestiging. Aggregeert alle kassasessies voor die vestiging op die datum. Eenmaal gesloten is de dag onveranderbaar.

Dit scherm beheert de **kassa's** (per-kassa setup) en toont de **sessiehistorie** (wie heeft wat geopend, wanneer, met welk verschil). Het Z-Rapport leeft in zijn eigen scherm ([h11](11-z-reports-and-end-of-day-sync.md)).

---

## 19.2 Wat u hier kunt doen, per rol

| Actie | OA | SM | SA | Kassier | Auditor |
|---|---|---|---|---|---|
| Kassa's in de vestiging lijsten | ✅ | ✅ | ✅ | ❌ (alleen POS) | ✅ |
| Een nieuwe kassa toevoegen | ✅ | ✅ | ✅ | ❌ | ❌ |
| Een kassa hernoemen / deactiveren | ✅ | ✅ | ✅ | ❌ | ❌ |
| Open sessies bekijken (wie waar is ingelogd) | ✅ | ✅ | ✅ | ❌ | ✅ |
| Sessiehistorie bekijken | ✅ | ✅ | ✅ | ❌ (alleen eigen) | ✅ |
| Een kasmutatie (kas in / kas uit) vastleggen op een open sessie | ✅ | ✅ | ✅ | ✅ (eigen sessie, op de POS) | ❌ |
| **Een gesloten sessie heropenen voor de volgende dienst** | ✅ | ✅ | ✅ | ❌ | ❌ |
| Een kassier-heropenverzoek goedkeuren | ✅ | ✅ | ✅ | ❌ | ❌ |
| Geforceerd sluiten van een kassasessie (zelden) | ✅ | ✅ | ✅ | ❌ | ❌ |

Kassier ziet dit scherm nooit — hun kassa-acties vinden allemaal plaats op de POS.

---

## 19.3 Een nieuwe kassa toevoegen

**Wanneer u dit gaat doen:** een nieuwe kassa openen, een vervangtoonbank toevoegen voor drukke periodes, een servicebalie afsplitsen van de hoofdkassa.

**Pad:** Kassabeheer → tabblad **Beheren** → vestigings-keuzemenu op de juiste vestiging → **+ Nieuwe kassa**.

Vul in:

- **Naam** — wat de kassier ziet op het open-kassa-scherm. `Kassa 1`, `Kassa 2`, `Servicebalie`, `Express`. Vrije tekst.
- **Actief** — standaard aan. Laat aan tenzij u kassa's voorafmaakt voor een vestiging die nog niet is geopend.

Het systeem wijst automatisch het volgende sequentiële **nummer** toe per vestiging (zodat Paramaribo's Kassa 1 en Nickerie's Kassa 1 beide nummer 1 hebben — ze zijn per-vestiging, niet globaal).

Klik op **Aanmaken**. De kassa verschijnt direct in de lijst. Een kassier die inlogt op de POS in die vestiging ziet hem nu op hun Open-Kassa-scherm.

> **Auditlogboek:** `register.created`-rij met de kassanaam + uw gebruikers-id. Zichtbaar in [h13 — Auditlogboek](13-audit-log.md).

---

## 19.4 Een kassa hernoemen of deactiveren

**Hernoemen:** klik op het potlood **Bewerken** op de rij → wijzig de naam → opslaan. De kassier ziet de nieuwe naam bij volgende refresh. Oude sessies behouden de oude naam in hun audittrail — geen geschiedenis herschrijven.

**Deactiveren:** klik op **Deactiveren**. De kassa verschijnt niet meer op het Open-Kassa-scherm van de kassier. Bestaande sessies en historische rapporten blijven intact.

**U kunt een kassa niet verwijderen met historische sessies** — deactiveer in plaats daarvan. Het auditlogboek bewaart het spoor. Echt "verwijderen" zou historische Z-Rapporten invalideren, wat de Surinaamse compliance-vereiste expliciet verbiedt.

---

## 19.5 Tabblad Open sessies — "wie is er nu ingelogd"

Het tabblad **Open sessies** toont elke kassasessie in status `open` of `reopen_requested` over de vestiging. Eén rij per actieve kassier.

Kolommen:
- Kassa (Kassa 1)
- Kassier (Sharmila Jankipersad)
- Geopend om (14:32 vandaag)
- Duur (3u 12m)
- Beginsaldo (SRD 50,00)
- Status (Open / Heropening aangevraagd)

**Gebruik het wanneer:**
- Een kassier zich ziek heeft gemeld en u wilt weten of zijn lade nog open is op Kassa 2.
- U de vestiging sluit en wilt verifiëren dat elke kassa correct is gesloten.
- Het Z-Rapport niet kan sluiten omdat "open sessies blijven" — dit tabblad vertelt u welke.

Als de kassier is weggelopen zonder te sluiten, heeft u twee opties:
1. **Wacht tot ze terug inloggen** en correct sluiten (voorkeur — zij reconcilieren hun eigen lade).
2. **Geforceerd sluiten** als manager (spaarzaam gebruiken — zie §19.7).

---

## 19.6 Tabblad Geschiedenis — "wie zat tussen 09:00 en 14:00 op Kassa 2"

Het tabblad **Geschiedenis** is het audittrail. Kies een datumbereik; zie elke sessie die in dat venster heeft geopend of gesloten.

Kolommen: kassa · kassier · opened_at · closed_at · opening_float · expected_cash · actual_cash · discrepancy · closing_note · status (gesloten / heropend / vervangen).

**Verschilkolom is kleurgecodeerd:**
- Groen (≤ SRD 1,00): afronding, geen actie
- Geel (SRD 1,01 – 5,00): de moeite van een blik waard, meestal prima
- Rood (> SRD 5,00): onderzoek — lade was tekort of over

Klik op een rij om het volledige detail te zien: elke verkoop geboekt tijdens die sessie, de BTW-uitsplitsing, de sluitingsnotitie die de kassier heeft getypt, eventuele heropen-gebeurtenissen.

> **Waarom per-sessie-historie belangrijk is:** Z-Rapporten vertellen u "vestiging X had vandaag Y totaal". Dit tabblad vertelt u "Sharmila op Kassa 2 van 09:00–14:00 had een SRD -8,00 verschil met notitie 'SRD 5 verloren in koelkast-transfer'". Andere vraag, beide nodig.

---

## 19.7 Heropenen-voor-volgende-dienst (de gebruikelijke case)

**Scenario:** Kassier A sluit zijn lade om 14:00 om naar huis te gaan. Kassier B arriveert om 14:05 om de avonddienst op dezelfde kassa te beginnen. U wilt B niet laten werken met een "verse" kassa zonder context.

**Pad:** Kassabeheer → tabblad **Geschiedenis** → vind de net-gesloten sessie van Kassier A → klik **↺ Heropenen voor volgende dienst**.

Wat er gebeurt:
- De sessie wordt gemarkeerd `cleared_at = now`. Het is officieel gesloten (de afrekening van Kassier A staat; zij zijn niet verantwoordelijk voor wat erna gebeurt).
- Kassier B logt in op de POS en opent de kassa vers — nieuwe sessie, nieuw beginsaldo, nieuwe verantwoording.
- Beide sessies rollen op tot hetzelfde Z-Rapport aan het einde van de dag.

> **Waarom dit bestaat:** zonder de cleared_at-marker zou de POS van de volgende kassier "deze kassa is nog open door Sharmila" tonen en hen dwingen haar niet-gesloten sessie te gebruiken. Met cleared_at is de kassa weer beschikbaar — maar de vorige sessie blijft in de geschiedenis met zijn eigen verschil.

**Auditlogboek:** `register.session_cleared` met de gebruikers-id van de manager, de oorspronkelijke sluitingstijd, en de kassier waarvoor de manager heeft geleegd.

---

## 19.8 Kassier-aangevraagde heropening (de zeldzame case)

**Scenario:** Kassier heeft al zijn lade gesloten en realiseert zich dan dat hij vergeten is een klant te boeken die nog steeds wacht.

De kassier kan op **Vraag heropening** klikken op hun sluitingsbevestigingsscherm. Dat zet de sessie in `reopen_requested`-status — de **manager** ziet het dan in zijn tabblad Open sessies met een gele vlag.

De manager klikt op **Goedkeuren** → status slaat om naar `open` → de kassier boekt de ontbrekende verkoop → zij sluiten opnieuw (met een nieuwe afrekening die hopelijk nu klopt).

Als de manager weigert:
- Klik op **Weigeren**.
- De sessie blijft gesloten met de oorspronkelijke (mogelijk niet-overeenkomende) totalen.
- De kassier moet de ontbrekende klant verwerken als een **nieuwe verkoop** op een verse sessie — manager zal eerst moeten leegmaken-voor-volgende-dienst.

**Waarom goedkeuring belangrijk is:** mid-dag heropens zijn een fraudevector. Zonder manager-gating zou een kassier zijn lade kunnen sluiten (een verschil claimend), dan stilletjes heropenen en aanpassen. Het auditlogboek legt de goedkeuring vast — `register.reopen_approved` met de manager-id, de kassier-id, de reden die de kassier gaf, en een tijdstempel.

---

## 19.9 Geforceerd sluiten (laatste redmiddel)

**Scenario:** Kassier vertrok zonder te sluiten, kan niet worden bereikt, en het Z-Rapport moet draaien.

Pad: Tabblad Open sessies → klik op de sessie → **Geforceerd sluiten** (rode knop, verborgen achter een bevestiging).

U levert aan:
- De werkelijke kastelling (u telt hun lade zelf of gebruikt hun laatst bekende totaal).
- Een reden die in het auditlogboek terechtkomt (`Kassier vertrok zonder te sluiten — geteld door manager 17:30`).
- Een notitie voor het closing_note-veld (`Lade geforceerd gesloten door manager — zie incidentlog 2026-05-26-003`).

**Gevolgen:**
- De sessie sluit met welke kastelling u ook hebt opgegeven.
- Verschil wordt berekend tegen verwacht (waarschijnlijk niet-nul — dat is het punt van de notitie).
- De naam van de kassier blijft op de sessie (zij hebben de verkopen geboekt). Uw naam verschijnt als `closed_by` in het auditlogboek.
- Het Z-Rapport kan nu draaien.

> **Rekenkamer-vriendelijk:** geforceerd-sluiten wordt gemarkeerd in de Rekenkamer-export. Een auditor ziet zowel de sessie van de kassier als de interventie van de manager als aparte gebeurtenissen met een duidelijk papieren spoor.

---

## 19.9a Kas in / uit tijdens een dienst (kasmutaties)

Niet elke SRD die de lade in- of uitgaat is een verkoop. Het wisselgeld raakt op en iemand vult bij; een leverancier wordt contant betaald bij levering; de manager brengt halverwege de middag SRD 2.000 naar de bank. Worden die bewegingen niet vastgelegd, dan klopt de kastelling bij het sluiten niet — buiten de schuld van de kassier om.

**Wie legt het vast:** de kassier op de open sessie, of een manager (SM / OA / SA) — altijd op een **open** kassasessie. Een gesloten sessie weigert de mutatie (`409`).

**Waar:** op de POS — bovenbalk → **💵 Kas** → het modal *Kas in / uit*. Kies een richting, voer het bedrag in en typ de **verplichte reden** (minimaal 2 tekens):

| Richting | Typisch gebruik |
|---|---|
| **Kas in** | Wisselgeld / beginsaldo bijvullen, eigenaar legt contant bij in de lade. |
| **Kas uit** | Bankafstorting halverwege de dienst, leverancier contant betaald bij levering, kleine-kas-aankoop (schoonmaakmiddelen, taxi). |

**Het effect op de afrekening** — daar draait het allemaal om. Elke mutatie past het verwachte contant van de sessie aan, zodat de lade bij het sluiten nog steeds klopt:

```
verwacht contant = beginsaldo
                 + contante verkopen (incl. het contante deel van gemengde betalingen)
                 − contante terugbetalingen
                 + kas-in − kas-uit
```

Een vastgelegde bankafstorting van SRD 2.000 houdt de afsluiting groen. Een **niet-vastgelegde** verschijnt als `−SRD 2.000` kastekort en triggert de verplichte verschilnotitie — zie [Hoofdstuk 11 §11.8](11-z-reports-and-end-of-day-sync.md#118-kasverschil--hoe-het-hier-terechtkomt).

**Waar u het terugziet:**

- De **sluitsamenvatting van de sessie** toont kas-in en kas-uit als eigen regels in het kassalade-blok, naast beginsaldo en contante verkopen.
- Het **auditlogboek** krijgt per mutatie een `register.cash_movement`-gebeurtenis — richting, bedrag, reden, gebruiker, tijdstempel ([h13](13-audit-log.md)).
- De POS toont direct na het vastleggen het **nieuwe verwachte contant**, zodat de kassier altijd weet wat er in de lade hoort te zitten.

> **Coaching-regel:** het redenveld is vrije tekst, maar hoort de tegenpartij of het doel te noemen (`Leverancier Fernandes — SRD 350 contant`), niet `eruit`. Het auditlogboek bewaart het voor altijd; een auditor die het over zes maanden leest, hoort niet te hoeven raden.

De kassierszijde-walkthrough staat in [user_manual h3 — Uw Kassa](../user_manual/03-register.md).

---

## 19.10 Veelvoorkomende situaties

### "We hebben Kassa 1 net in twee kassa's gesplitst — hoe voeg ik de nieuwe toe?"
§19.3. Voeg de kassa toe. De nieuwe verschijnt direct op de POS.

### "Kassier sloot te vroeg en de klant staat er nog"
§19.8 — zij vragen een heropening aan op de POS, u keurt het goed vanaf dit scherm.

### "Laatste kassier liep weg zonder te sluiten"
§19.9 — geforceerd sluiten met een reden. Documenteer in uw dienstlog.

### "Z-Rapport sluit niet — 'open sessies blijven'"
§19.5 — tabblad Open sessies vertelt u welke. Vind de kassier of geforceerd sluiten.

### "We brachten halverwege de dienst contant naar de bank — hoe houden we de kastelling groen?"
§19.9a — leg een kas-uit met reden vast op het moment dat het geld de lade verlaat. Het verwachte contant past zich direct aan en de afsluiting klopt.

### "Hoe weet ik of iemand nu aan het verkopen is?"
§19.5 — tabblad Open sessies is uw live weergave. Kassiernamen + hoe lang zij open zijn geweest.

### "Verkeerde kassier kreeg toeschrijving voor een verkoop"
U kunt geen kassier herstoewijzen aan een verkoop. Betaal de verkoop terug + boek hem onder de juiste kassier ([user_manual h5a](../user_manual/05a-refunds-and-voids.md)). Het auditlogboek behoudt beide.

---

## §19.10 Einde-dag-instellingen — sluitingstijd & nachtelijk automatisch afsluiten

**Vestigingen → (vestiging) → Instellingen → Einde van de dag** geeft elke
vestiging zijn eigen einde-dag-ritme. Niets hiervan is verplicht; alles maakt
de *volgende ochtend* soepeler.

| Instelling | Wat het doet |
|---|---|
| **Sluitingstijd** | Na dit tijdstip krijgen de managers van de vestiging een in-app-melding (en e-mail) als een kassa nog open staat — één per vestiging per dag. Leeg = geen herinnering. |
| **Kassa ’s nachts automatisch afsluiten** | Standaard uit. Aan: elke kassa die op het **automatisch-afsluiten-tijdstip** nog open staat wordt automatisch verzegeld als *systeem-afgesloten — kas niet geteld*. De volgende ochtend kan gewoon beginnen; de manager telt de la als afstemmingstaak in plaats van dat de kassa vastzit. |
| **Tijdstip automatisch afsluiten** | Wanneer de nachtelijke ronde loopt (bijv. `23:59`). Alleen zichtbaar als automatisch afsluiten aan staat. |
| **Managernaam & -telefoon** | Getoond op de kassa als een kassier een "gisteren is nog niet afgesloten"-scherm ziet en een manager moet bellen — met een bel- en WhatsApp-knop. Stel dit in zodat kassiers nooit vastzitten zonder te weten wie ze moeten bereiken. |

### De ochtend erna

Als een kassa na middernacht open bleef, ziet de eerste persoon aan de kassa
een duidelijk **"Gisteren is nog niet afgesloten"**-scherm in plaats van een
cryptische fout:

- Een **manager** die inlogt krijgt inline tellen-en-afsluiten (of, bij een
  automatisch afgesloten sessie, een tel-de-la-stap) — vandaag opent in
  dezelfde beweging.
- Een **kassier** ziet het bel-de-manager-scherm (naam, telefoon, WhatsApp)
  — zonder kasbedragen, want tellen is de taak van de manager.

Een automatisch afgesloten la die nog geteld moet worden verschijnt ook in de
ochtendflow van de manager als een overslaanbare **"telling vastleggen"**-taak
— nu doen of *Later*, verkopen wordt nooit geblokkeerd. Elke automatische
afsluiting en afstemming staat in het [auditlogboek](13-audit-log.md)
(`register.auto_closed`, `register.reconciled`).

---

## Zie ook

- [user_manual h3 — Uw Kassa](../user_manual/03-register.md) — wat de kassier ziet en doet
- [Hoofdstuk 11 — Z-Rapporten & Einde-dag Synchronisatie](11-z-reports-and-end-of-day-sync.md) — de dag-niveau-sluiting die deze sessies oprolt
- [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) — elke kassa / sessiegebeurtenis wordt hier gelogd
- [Hoofdstuk 1 §1.3 — Vestigingsmanager-rol](01-roles-and-permissions.md) — de rol geautoriseerd om de meeste acties op dit scherm te doen

## 19.x Kassabeleid: zelfstandige ploegwissel

**De vraag die dit beantwoordt:** een winkel met 10 kassa's en 3 ploegen
zou bij elke ploegwissel bij elke kassa een beheerder nodig hebben — ±20
"heropen"-acties per dag. Echte ploegenwinkels werken met het
*ladewissel*-model: de vertrekkende caissière sluit en telt, de komende
caissière start vers met eigen wisselgeld, en er komt geen beheerder aan
te pas bij de overdracht zelf.

**Waar:** Organisaties → bewerken → **Kassabeleid** → *Zelfstandige
ploegwissel*. Organisatiebreed, standaard **uit**.

| | Uit (standaard — strikt) | Aan (ploegenwinkels) |
|---|---|---|
| Kassa vandaag gesloten, volgende ploeg komt | Beheerder moet heropenen | Komende caissière opent een NIEUWE sessie met eigen wisselgeld |
| Telling van de vertrekkende caissière | Verzegeld, onaangeroerd | Verzegeld, onaangeroerd — precies hetzelfde |
| Verantwoording | Per sessie, gelogd | Per sessie, gelogd — er gaat niets verloren |
| Dagelijks kassawerk beheerder | ±2 × aantal kassa's goedkeuringen | Verschillen beoordelen + één Z-rapport |

Wat de schakelaar **nooit** verandert: één live sessie per kassa
tegelijk, elke opening en sluiting wordt gelogd met wie/wanneer/
wisselgeld/telling, en verschillen vereisen nog steeds een notitie. Het
beleid versoepelt *wie de volgende ploeg mag starten* — nooit het tellen.

**Aanbevolen:** aan voor supermarkten met ploegen; uit voor
éénploegswinkels en overheidslocaties die de vier-ogen-overdracht willen.

## 19.y Een live sessie geforceerd sluiten (caissière niet beschikbaar)

Een caissière is ziek naar huis, weggelopen, of de kassa hangt — de kassa
toont **In gebruik** en niemand kan erop verkopen. Als manager:
**Kassa's → de open kassa → Sluiten**. Tel de la, vul het bedrag in
(toelichting aanbevolen, bijv. *"caissière ziek naar huis"*), bevestig. De
sessie sluit met de normale verschilcontrole, en **uw naam wordt bij de
sluiting genoteerd** — het schichtrapport toont altijd wie er telde.
Daarna kan de kassa gewoon voor de volgende ploeg worden geopend.
