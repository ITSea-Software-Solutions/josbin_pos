# Hoofdstuk 10 — Einde dag: Z-Rapport & Kasafstemming

**Wie doet dit:** Vestigingsmanager (of bevoegde leidinggevende)
**Wanneer:** Aan het einde van elke handelsdag, na de laatste verkoop

Het Z-Rapport sluit de kassa formeel af voor de dag. Het:
- Vergrendelt de verkoopcijfers van de dag
- Registreert de kastelling
- Verstuurt (synchroniseert) alle verkoopgegevens naar het hoofdkantoor
- Maakt een onveranderlijke auditregistratie aan

> **Belangrijk:** Het Z-Rapport kan slechts één keer per dag worden uitgevoerd. Zorg ervoor dat alle verkopen van de dag zijn voltooid voordat u afsluit.

---

## 10.1 Het scherm Einde dag openen

1. Klik in de bovenbalk op **Einde dag**.
2. Het scherm Einde dag opent met twee secties: **Samenvatting vandaag** en **Kasafstemming**.

---

## 10.2 De samenvatting van vandaag bekijken

Bekijk vóór het afsluiten de samenvatting om te controleren of de cijfers correct lijken:

| Veld | Wat het betekent |
|-------|--------------|
| Totale verkopen (SRD) | Totale omzet voor de dag |
| Aantal transacties | Aantal voltooide verkopen |
| Totale BTW | Totale geheven belasting |
| Totaal contant | Verkopen contant betaald |
| Totaal pin | Verkopen per pin betaald |

Als een cijfer er verkeerd uitziet, sluit de dag dan nog niet af. Bekijk recente verkopen of neem contact op met uw manager.

---

## 10.3 Kasafstemming — het contante geld tellen

Kasafstemming is het proces waarbij het contante geld in de lade wordt vergeleken met wat het systeem verwacht.

> **Wat verwacht het systeem?** Het verwachte contant van het Z-Rapport is de **netto contante omzet** van de dag: alles wat volledig contant is betaald, minus contante terugbetalingen en retouren. Het bevat **niet** uw beginsaldo (daarom telt u dat niet mee — zie Stap 1), niet het contante deel van gemengde betalingen, en niet de kas-in/kas-uit-mutaties die overdag op een kassa zijn vastgelegd ([Hoofdstuk 3 §3.2a](03-register.md)). Die mutaties worden automatisch verrekend wanneer elke kassier zijn **kassasessie** sluit — op dagniveau verwijst u ernaar in de notitie wanneer ze een verschil verklaren.

**Stap 1 — Tel het contante geld in de lade**

Tel elk biljet en elke munt in de kassalade. Tel niet mee:
- Wisselgeldfloat (het beginsaldo dat u vanmorgen in de lade heeft gelegd)
- Persoonlijk geld

Schrijf het totaal op of onthoud het.

**Stap 2 — Voer het werkelijke contante bedrag in**

1. Zoek in de sectie Kasafstemming het veld **"Werkelijk kasgeld"**.
2. Klik op het veld en typ het totale contante bedrag dat u heeft geteld (bijv. `487.50`).
3. De regel **Verschil** verschijnt direct:
   - **Groen** = tellingen komen overeen ✓
   - **Rood** = er is een verschil

**Voorbeelden van verschillen:**

| Verwacht | Werkelijk | Verschil | Betekenis |
|---------|--------|------------|---------|
| SRD 500.00 | SRD 500.00 | SRD 0.00 ✓ | Perfecte match |
| SRD 500.00 | SRD 495.00 | − SRD 5.00 | Kastekort (mogelijke fout of diefstal) |
| SRD 500.00 | SRD 502.00 | + SRD 2.00 | Kasoverschot (wisselgeldfout) |
| SRD 500.00 | SRD 400.00 | − SRD 100.00 | Een **vastgelegde kas-uit** (bijv. SRD 100 leverancier betaald uit de lade, Hoofdstuk 3 §3.2a) — geen vermist geld. Noem de mutatie in de notitie en de telling is verklaard. |

> **Kas-in en kas-uit:** kasmutaties die tijdens de dienst zijn vastgelegd, worden automatisch verrekend bij het sluiten van de kassasessie van elke kassier, maar het verwachte dagbedrag hierboven trekt ze **niet** af — een vastgelegde kas-uit van SRD 100 verschijnt hier dus nog steeds als −100. Dat is prima: verwijs ernaar in de notitie (*"kas-uit leverancier, zie kassasessie Kassa 1"*) en het verschil is verantwoord. Een **niet-vastgelegde** kas-uit ziet er daarentegen precies uit als vermist geld — en daarom staat Hoofdstuk 3 §3.2a erop dat u elke mutatie vastlegt op het moment dat die plaatsvindt.

**Stap 3 — Bij een verschil: voeg een notitie toe**

Als het verschil meer dan SRD 0.01 bedraagt (d.w.z. geen afrondingsverschil), verschijnt automatisch een veld **Notitie**.

1. Typ een uitleg in het notitieveld. Voorbeelden:
   - *"Shortfall waarschijnlijk door wisselgeld fout bij sale #2026-00038"*
   - *"Overschot — onbekende oorzaak, wordt onderzocht"*
2. De notitie wordt opgeslagen in het auditlogboek en is zichtbaar voor het management.
3. De notitie is **verplicht** voordat u kunt afsluiten. U kunt dit niet overslaan.

---

## 10.4 Het Z-Rapport afsluiten

1. Zodra het werkelijke contante bedrag is ingevoerd en eventuele vereiste notitie is geschreven:
2. Klik op **Dag afsluiten / Z-rapport afdrukken**.
3. Het systeem:
   - Vergrendelt de cijfers van vandaag
   - Probeert gegevens te synchroniseren met het hoofdkantoor
   - Drukt het Z-Rapport af op de bonprinter (indien geconfigureerd)
4. De knop wordt groen en toont: *"Dag succesvol afgesloten"*.

> **Waarschuwing:** Deze actie kan niet ongedaan worden gemaakt. Controleer uw kastelling dubbel voordat u afsluit.

---

## 10.5 De geschiedenistabel van 7 dagen

Onder de sectie kasafstemming toont een geschiedenistabel de laatste 7 afgesloten dagen:

| Kolom | Beschrijving |
|--------|-------------|
| Datum | De datum van die afgesloten dag |
| Totale verkopen | Omzet voor die dag |
| Totale BTW | Geheven belasting |
| Status | Synchronisatiestatus (zie hieronder) |
| Exportknop | Download de gegevens als een .josbin_pos-bestand |

**Betekenissen van synchronisatiestatus:**

| Status | Kleur | Betekenis |
|--------|--------|---------|
| Verzonden ✓ | Groen | Gegevens zijn succesvol naar het hoofdkantoor verzonden |
| In afwachting | Geel | Wacht op synchronisatie (bijv. geen internet op dit moment) |
| Mislukt | Rood | Synchronisatie mislukt — vereist aandacht |

---

## 10.6 Wat te doen als synchronisatie mislukt (status = Mislukt of In afwachting)

Josbin POS heeft **vijf synchronisatielagen** zodat de gegevens van een dag nooit vastzitten op één terminal. U hoeft ze niet uit het hoofd te leren — maar weten dat ze bestaan, verklaart waarom "Mislukt" zich meestal vanzelf oplost.

**Laag 1 — realtime:** elke verkoop die u aanslaat probeert binnen seconden naar de cloud te pushen. Stille succes, geen UI-ruis.

**Laag 2 — automatische herhaling volgens schema:** als Laag 1 mislukt (internetonderbreking), probeert het systeem de mislukte batch opnieuw na **1 minuut → 5 minuten → 15 minuten → 30 minuten**. U hoeft niets te doen — de gele indicator "Synchronisatie in afwachting — N transacties in wachtrij" op uw managerscherm vertelt u dat de achterstand wordt weggewerkt.

**Laag 3 — geforceerde herhaling bij afsluiting Z-Rapport:** wanneer u tikt op **Indienen bij hoofdkantoor**, probeert het systeem de synchronisatie *nu*, met alle wachtende dagen, in chronologische volgorde. Dit is het bewuste "ik wil dat dit NU lukt"-pad. De knop werkt zelfs als Laag 2 stilletjes heeft herhaald — u vertelt het om het direct nog eens te proberen.

**Laag 4 — USB versleutelde export:** als Lagen 1–3 allemaal mislukken (langdurige uitval, dongle dood), gebruik dan het handmatige exportpad hieronder. AES-256 versleuteld bestand, veilig om via e-mail of WhatsApp te verzenden.

**Laag 5 — inhaalslag bij herstel internet:** de lokale server pingt elke 60 seconden de cloud. Zodra het internet terug is, **synchroniseren alle wachtende dagen automatisch in chronologische volgorde**, waarbij elk wordt gemarkeerd als "laat gesynchroniseerd" in het auditlogboek + synchronisatietijdstempel. U hoeft niets opnieuw aan te tikken; u ziet de rijkleur vanzelf van geel naar groen omslaan.

### Wat u eigenlijk moet doen

**Als status = In afwachting:** negeer het 30 minuten lang. Laag 2 herhaalt. Als het daarna nog steeds in afwachting is, controleer dan de internetverbinding — het herstellen ervan activeert Laag 5 automatisch.

**Als status = Mislukt (na 30+ min):**

**Optie A — Tik opnieuw op Indienen bij hoofdkantoor:** geforceerde herhaling van Laag 3. Werkt vaak omdat Laag 2 stilletjes de achterstand heeft opgelost en alleen de meest recente indiening rood bleef.

**Optie B — Wacht tot het internet hersteld is:** Laag 5 pikt het automatisch op zodra de connectiviteit terugkeert.

**Optie C — Exporteer naar USB en lever handmatig (Laag 4):**
1. Zoek in de geschiedenistabel de dag met de mislukte synchronisatie.
2. Klik op de knop **💾 .josbin_pos** in die rij.
3. Een `.josbin_pos`-bestand wordt naar uw computer gedownload.
4. Sla dit bestand op een USB-stick op.
5. Lever de USB af bij het hoofdkantoor, of stuur het bestand via WhatsApp/e-mail.
6. Het hoofdkantoor uploadt het bestand in het Super Admin Dashboard.

> **Belangrijk:** Het `.josbin_pos`-bestand is versleuteld (AES-256). Het is veilig om via e-mail of WhatsApp te verzenden.

> **Wist u dat:** verschilnotities die u tijdens de kasafstemming heeft getypt, zichtbaar zijn voor uw manager in het auditlogboek — zelfs als de synchronisatie van de dag naar het hoofdkantoor vertraagd is. Dus "ik zal dit verschil uitleggen als ik terug ben op het hoofdkantoor" is al gebeurd; de notitie staat er al. Typ zorgvuldig.

---

## 10.7 X-Rapport — momentopname midden op de dag

Het X-Rapport geeft u een momentopname van de verkopen tot nu toe **zonder de dag af te sluiten**.

1. Ga in de bovenbalk naar **Rapporten** (zie [Hoofdstuk 11](11-reports.md)).
2. Klik op het tabblad **X-Rapport**.
3. De huidige totalen verschijnen met een gele banner die bevestigt dat dit geen afsluiting is.

Het X-Rapport wordt door managers gebruikt om de prestaties midden op de dag te controleren. Het heeft geen invloed op het Z-Rapport of de eindcijfers van de dag.

---

## Checklist einde dag

Voordat u 's avonds vertrekt, doorloopt u deze checklist:

- [ ] Alle vastgehouden bonnen zijn voltooid of geleegd
- [ ] Alle kas-in/kas-uit-mutaties zijn met een reden vastgelegd ([Hoofdstuk 3 §3.2a](03-register.md))
- [ ] Het werkelijke contante geld in de lade is geteld
- [ ] De kasafstemming is ingevoerd
- [ ] Verschilnotitie toegevoegd indien nodig
- [ ] Het Z-Rapport is afgesloten
- [ ] Synchronisatiestatus is "Verzonden ✓" (groen)
- [ ] De kassalade is gesloten en beveiligd
- [ ] Het POS-terminalscherm is vergrendeld of de applicatie is gesloten
