# Hoofdstuk 5a — Terugbetalingen en Annuleringen

Dit hoofdstuk laat u zien hoe u geld teruggeeft aan een klant voor een verkoop die al voltooid is, en hoe u een verkoop annuleert die nog wordt aangeslagen.

Er zijn **twee** verschillende dingen, en Josbin POS behandelt ze anders:

| Situatie | Wat u doet | Resultaat |
|---|---|---|
| Klant is van gedachten veranderd **vóór de betaling** — verkoop staat nog op het scherm | Verwijder de regels uit de winkelwagen (Hoofdstuk 4) of **verwerp de bon** | Geen verkooprij aangemaakt |
| Klant wil geld terug **na de betaling** — verkoop al opgeslagen | **Terugbetaling** (dit hoofdstuk) | Er wordt een nieuwe terugbetalingsrij aangemaakt, de oorspronkelijke verkoop blijft staan |
| U heeft een typefout gemaakt en wilt een voltooide verkoop volledig annuleren (bijv. verkeerde artikelen aangeslagen) | **Annulering** (dit hoofdstuk) | De status van de verkoop springt naar `voided`, totalen worden uit rapporten verwijderd |

> **Belangrijk verschil:** Een terugbetaling maakt een **nieuwe rij** aan die de oorspronkelijke verkoop compenseert. Het origineel blijft intact in het auditlogboek en in de rapporten. Een annulering markeert het origineel als geannuleerd — alsof het nooit is gebeurd, voor zover totalen tellen. De Belastingdienst Suriname verwacht terugbetalingen voor correcties na betaling, geen annuleringen. Gebruik terugbetalingen in het normale dagelijkse werk; reserveer annuleringen voor echte "deze verkoop had nooit mogen bestaan"-gevallen.

---

## 5a.1 Wie kan terugbetalingen en annuleringen doen

| Rol | Terugbetaling | Annulering |
|---|---|---|
| Kassier (standaard) | ❌ — manager nodig | ❌ — manager nodig |
| Vestigingsmanager | ✅ | ✅ |
| Organisatiebeheerder | ✅ | ✅ |

Een kassier die op de kassa aanslaat ziet een melding **"Manager goedkeuring vereist"** wanneer hij/zij op **Terugbetalen** tikt. De manager scant zijn/haar pas / voert zijn/haar PIN in / logt in op dezelfde terminal om autorisatie te verlenen. Zelfde proces voor annuleringen.

Deze splitsing is bewust — het voldoet aan de Surinaamse audit-eis (Belastingdienst + Rekenkamer) dat geen enkele gebruiker zowel een verkoop kan aanslaan ÉN omkeren.

---

## 5a.2 Hoe u een terugbetaling uitvoert

**Pad:** POS → tabblad **Verkopen** (boven aan het POS-scherm) → zoek de verkoop → klik op de knop **↺ Terugbetalen** op de regel.

### Stap 1 — Vind de oorspronkelijke verkoop

Het tabblad Verkopen toont standaard de verkopen van vandaag. Om een oudere te vinden:

- **Datumkiezer** bovenaan — kies gisteren / een week geleden / een specifieke datum.
- **Zoekvak** — typ het verkoopnummer (bijv. `S-2026-001234`) of de naam van de klant.
- **Filter op status** — voltooid / geannuleerd / terugbetaald.

Elke rij toont: tijd, verkoopnummer, klant (indien aanwezig), totaal, betaalmethode en de actieknoppen.

### Stap 2 — Open de Terugbetaling-modal

Klik op **↺ Terugbetalen** op de regel van de verkoop.

Als u geen manager bent: u ziet een melding **Manager goedkeuring vereist**. Geef de terminal aan uw manager; hij/zij logt in, de modal opent.

### Stap 3 — Kies wat u wilt terugbetalen

De modal toont elke regel van de oorspronkelijke verkoop met het aantal. U kunt:

- **Volledige terugbetaling** — laat alle aantallen op hun oorspronkelijke waarde staan; het totaal van de terugbetaling komt overeen met het oorspronkelijke totaal.
- **Gedeeltelijke terugbetaling — aantal** — typ een kleiner aantal in de kolom **Aant. terug** voor een regel. Veelvoorkomend geval: klant kocht 6 yoghurts, 2 waren bedorven, betaal er 2 terug.
- **Gedeeltelijke terugbetaling — hele regel** — typ `0` voor regels die u niet terugbetaalt; alleen de regels met aantal > 0 worden terugbetaald.
- **Kan niet meer terugbetalen dan oorspronkelijk** — het veld is begrensd op het oorspronkelijke aantal. De rechterkolom werkt live bij om het terugbetalingstotaal in SRD te tonen.

> **En de BTW?** Maak u geen zorgen. Josbin POS herberekent de BTW van de terugbetaling automatisch uit het BTW-tarief van de oorspronkelijke regel, met de korting-voor-belasting-volgorde behouden (zelfde berekening als de oorspronkelijke verkoop). De terugbetalingsbon toont de BTW-specificatie.

### Stap 4 — Reden voor terugbetaling (verplicht)

Het veld **Reden** is verplicht en moet minimaal 5 tekens bevatten. Voorbeelden:

- `Verkeerd product meegenomen — klant heeft het ongeopend teruggebracht`
- `Beschadigd artikel — zie bon REF-204`
- `Manager keurde uit goodwill terugbetaling goed — vaste klant`

Deze reden komt terecht in het auditlogboek en de Rekenkamer-export. Schrijf het voor iemand die het 6 maanden later zal lezen.

### Stap 5 — Bevestigen

Tik op **✓ Bevestig terugbetaling**. Er gebeuren drie dingen:

1. Er wordt een **terugbetalingsrij** opgeslagen (nieuw verkoopnummer, status `refunded`, negatieve totalen).
2. Voorraad wordt **automatisch teruggeplaatst** voor terugbetaalde regels (de klant brengt de artikelen terug).
3. De kassalade **gaat open** als de oorspronkelijke betaling contant of gemengd was (u moet het contante geld teruggeven).
4. Een **terugbetalingsbon** wordt afgedrukt en op het scherm getoond met het terugbetalingsnummer — geef de afgedrukte versie aan de klant.

Het tabblad Verkopen werkt direct bij om de terugbetalingsrij direct onder de oorspronkelijke verkoop te tonen (gekoppeld).

---

## 5a.3 Gedrag van de kassalade bij terugbetalingen

| Oorspronkelijke betaling | Wat opent |
|---|---|
| Contant | Kassalade gaat open — geef het contante geld terug |
| Pin | Lade blijft dicht — u doet de pin-terugbetaling apart op de PIN-terminal van de bank, markeer daarna **Overslaan & afronden** in het recon-paneel |
| Gemengd (contant + pin) | Lade gaat open voor het contante deel; doe het pin-deel apart |
| Overschrijving | Lade blijft dicht — betaal de bankrekening van de klant apart terug en registreer de uitgaande referentie van de bank in het notitieveld van de terugbetaling |
| Mobiel bankieren | Hetzelfde als bankoverschrijving |
| Vreemde valuta | Lade gaat open — terugbetaling in dezelfde valuta tegen de vergrendelde dagkoers (geen valutawinst/-verlies voor de klant) |

> **Pin-terugbetalingen in Suriname:** Ons systeem communiceert niet met de PIN-terminal van de bank. U moet de pin-terugbetaling eerst op de terminal doen (met behulp van de bonslip van de bank) en deze daarna in Josbin POS registreren. De bon drukt "Terugbetaald via pin · Bank · Goedkeur. #" wanneer de kassier het recon-paneel op de terugbetaling invult.

---

## 5a.4 Hoe u een verkoop annuleert

**Gebruik wanneer:** de verkoop volledig fout was (verkeerde klant in rekening gebracht, testverkoop, systeemtest). Voor "geef wat geld terug" gebruikt u een terugbetaling.

**Pad:** POS → tabblad **Verkopen** → zoek de verkoop → klik op de knop **✗ Annuleer**.

### Stap 1 — Manager goedkeuring

Kassiers zien de goedkeuringsmelding. Managers gaan direct verder.

### Stap 2 — Reden (verplicht)

Hetzelfde veld als bij terugbetalingen — minimaal 5 tekens. Voorbeelden:

- `Testverkoop tijdens ochtend-setup — mag niet in rapporten staan`
- `Verkeerde klant in rekening gebracht — opnieuw aangeslagen onder juist account`
- `Kassierfout — dubbele aanslag`

### Stap 3 — Bevestigen

De status van de verkoop springt naar `voided`. Gevolgen:

1. **Totalen verwijderd** uit dagelijkse / maandelijkse / BTW-rapporten — alsof de verkoop nooit heeft plaatsgevonden.
2. **Voorraad teruggeplaatst** voor alle artikelen op de verkoop.
3. **Kassalade gaat open** als de oorspronkelijke betaling contant was (u bent de klant het contante geld nog verschuldigd) — maar alleen als de annulering **op dezelfde dag** als de verkoop plaatsvindt.
4. **Geannuleerde verkopen blijven voor altijd in het auditlogboek** met de reden voor de annulering, de annulerende gebruiker en het tijdstempel.
5. **Bon wordt NIET opnieuw afgedrukt** — annuleringen heffen op; terugbetalingen draaien terug mét documentatie.

> **Wat verandert op de bon?** Niets — de oorspronkelijke bon die de klant heeft is nog steeds geldig papier, maar de annulering in het systeem betekent dat de totalen niet meetellen. Als de klant om een retour vraagt, moet hij/zij nog steeds "GEANNULEERD" duidelijk gestempeld zien. Beste werkwijze: annuleer nooit een verkoop waarvan al een gedrukte bon de deur uit is gegaan; gebruik in plaats daarvan een terugbetaling.

---

## 5a.5 En hoe zit het met een terugbetaling terugbetalen? (Heraanslagen)

U kunt geen terugbetaling terugbetalen. Als u een fout heeft gemaakt op de terugbetaling zelf (verkeerde artikelen / verkeerd aantal), doe dan **nog een** terugbetaling op de oorspronkelijke verkoop voor het verschil, OF annuleer de verkeerde terugbetaling eerst en begin opnieuw.

Als geen van beide paden werkt (bijv. de oorspronkelijke verkoop is al volledig terugbetaald), doe een **handmatige kascorrectie** bij de kassa en documenteer de zaak in het auditlogboek via de Notities-functie. Beoordeling door de manager — Rekenkamer-auditors verwachten het papierspoor te zien.

---

## 5a.6 Veelvoorkomende situaties

### "Klant zegt dat het product defect is"
1. Controleer het probleem (visueel inspecteren of de productreferentie controleren).
2. Open het tabblad Verkopen, vind hun verkoop, klik op **↺ Terugbetalen**.
3. Kies alleen de defecte regel. Reden: `Defect product — zie issue ref XYZ`.
4. Bevestigen → contant teruggeven / pin-terugbetaling verwerken / enz.
5. Zet het geretourneerde artikel apart in de "naar manager"-stapel. De manager beslist over terugzenden aan leverancier of weggooien.

### "Klant wil ruilen — zelfde waarde"
Twee benaderingen:
- **Snel:** Sla het nieuwe artikel als nieuwe verkoop aan, betaal de oude terug. Twee schone transacties, gemakkelijk te auditen.
- **Handmatig:** Sommige winkels doen offline ruilingen van gelijke waarde. Josbin POS ondersteunt bewust GEEN enkele "ruil"-knop — te gemakkelijk om voorraad en BTW uit het oog te verliezen. Doe altijd twee transacties.

### "Klant betaalde met pin — retour is meer dan ik in de kassalade heb"
Terugbetalingen gaan terug **op dezelfde manier als ze binnenkwamen**. Pin-verkopen worden via de PIN-terminal van de bank terugbetaald op de pas, niet uit uw kassalade. Als u per ongeluk geprobeerd heeft contant terug te betalen vanuit een pin-verkoop, annuleer de verkeerde terugbetaling en doe het correct via de terminal.

### "Verkoop is dagen geleden gesloten — kan ik nog terugbetalen?"
Ja. Zolang het Z-Rapport van die dag niet is geblokkeerd, kunt u elke voorgaande verkoop terugbetalen. De terugbetaling telt mee in de totalen van **vandaag** (niet die van de oorspronkelijke dag), met het auditspoor van de oorspronkelijke dag bewaard op beide rijen.

### "Klant wil een gedeeltelijke terugbetaling op een B2B-factuur (overschrijving)"
Verwerk de terugbetaling in Josbin POS, doe daarna de uitgaande bankoverschrijving apart via uw bank-app. Registreer de uitgaande referentie in de notitie van de terugbetaling: `Uitgaande overschrijving ref OUT-2026-05-26-001`. OA bevestigt wanneer de middelen de rekening verlaten (zelfde Pending Payments-proces maar omgekeerd — toekomstige verbetering).

---

## 5a.7 Wat in het auditlogboek terechtkomt

Elke terugbetaling en annulering schrijft een audit_logs-vermelding die een Auditor of Rekenkamer-inspecteur kan lezen:

| Veld | Terugbetaling | Annulering |
|---|---|---|
| event | `sale.refunded` | `sale.voided` |
| auditable_id | id terugbetalings-verkoop (nieuwe rij) | id oorspronkelijke verkoop |
| old_values | (null) | `{"status": "completed"}` |
| new_values | `{"refunds_sale_id": "...", "reason": "...", "lines": [...]}` | `{"status": "voided", "reason": "...", "voided_by": "..."}` |
| user_id | de manager die goedkeurde | de manager die goedkeurde |
| ip_address | IP van de terminal | IP van de terminal |
| timestamp | AST-tijdzone | AST-tijdzone |

Het Auditlogboek-scherm van het dashboard ([dashboard_manual/13](../dashboard_manual/13-audit-log.md)) laat de OA / Auditor filteren op deze events en op een klikken om de volledige diff te zien.

---

## Zie ook

- [Hoofdstuk 4 — Een verkoop maken](04-making-a-sale.md) — het omgekeerde: een verkoop opbouwen
- [Hoofdstuk 5 — Betaling aannemen](05-payment.md) — hoe de oorspronkelijke verkoop is betaald
- [Hoofdstuk 10 — Einde dag](10-end-of-day.md) — terugbetalingen en annuleringen op het Z-Rapport
- [POS-handleiding hfdst 11 — Rapporten](11-reports.md) — terugbetalingen vinden in het dagrapport
- [Dashboard-handleiding hfdst 11 — Z-Rapporten & Synchronisatie](../dashboard_manual/11-z-reports-and-end-of-day-sync.md) — toewijzing terugbetalingen in de HK-weergave
