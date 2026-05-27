# Hoofdstuk 11 — Rapporten

**Wie gebruikt dit:** Vestigingsmanager, auditor
**Waar:** Bovenbalk → Rapporten

Rapporten geven u inzicht in de verkoopprestaties van uw vestiging. Alle bedragen zijn in SRD (Surinaamse Dollar).

---

## 11.1 Het scherm Rapporten openen

1. Klik in de bovenbalk op **Rapporten**.
2. Het scherm Rapporten opent met vier tabbladen bovenaan.

---

## 11.2 Overzicht van rapporttabbladen

| Tabblad | Wat het toont |
|-----|--------------|
| **Dagelijks** | Verkopen voor één specifieke dag |
| **Maandelijks** | Verkooptotalen voor een hele maand |
| **Aangepast** | Verkopen voor een door u gekozen periode |
| **X-Rapport** | Live momentopname van vandaag tot nu toe (geen afsluiting) |

---

## 11.3 Dagrapport

1. Klik op het tabblad **Dagelijks**.
2. Er verschijnt een datumkiezer. De huidige datum is standaard geselecteerd.
3. Klik op het datumveld en kies indien nodig een andere datum.
4. Het rapport wordt automatisch geladen.

**Wat u ziet:**

| Statistiek | Beschrijving |
|--------|-------------|
| Totale verkopen (SRD) | Alle omzet voor die dag |
| Aantal transacties | Aantal voltooide verkopen |
| Gemiddelde besteding | Gemiddelde verkoopwaarde |
| Totale BTW | Totale geheven belasting |
| Totaal contant | Omzet uit contante betalingen |
| Totaal pin | Omzet uit pin/kaartbetalingen |

**BTW-uitsplitsingstabel:**

Onder de samenvattingskaarten toont een BTW-uitsplitsingstabel:
- Belasting per tarief (bijv. 10%, 0%)
- Het belastbare basisbedrag
- Het BTW-bedrag per tarief

Deze tabel is opgemaakt voor BTW-aangifte bij Belastingdienst Suriname.

**Top producten:**

Onder de BTW-tabel worden de bestverkochte producten voor die dag vermeld met:
- Rang (#1, #2, etc.)
- Productnaam
- Verkochte eenheden
- Omzet in SRD

---

## 11.4 Maandrapport

1. Klik op het tabblad **Maandelijks**.
2. Er verschijnt een maandkiezer (bijv. "April 2026").
3. Klik om de maand te wijzigen.
4. Het rapport wordt geladen met totalen voor de hele maand.

De opmaak is identiek aan het dagrapport — dezelfde samenvattingskaarten, BTW-uitsplitsing en top producten — maar dan voor de hele maand.

---

## 11.5 Rapport met aangepast bereik

Gebruik dit wanneer u gegevens nodig heeft voor een specifieke periode die niet past in dagelijks of maandelijks.

1. Klik op het tabblad **Aangepast**.
2. Er verschijnen een veld **Datum vanaf** en **Datum tot**.
3. Klik op **Datum vanaf** en selecteer de startdatum.
4. Klik op **Datum tot** en selecteer de einddatum.
5. Het rapport wordt geladen voor die hele periode.

**Voorbeelden:**
- Vorige week: Datum vanaf = 7 dagen geleden, Datum tot = vandaag
- Vorig kwartaal: Datum vanaf = begin kwartaal, Datum tot = einde kwartaal
- Een specifieke promotieperiode: bijv. 15 april tot 22 april

---

## 11.6 X-Rapport (live momentopname)

1. Klik op het tabblad **X-Rapport**.
2. Het rapport laadt direct en toont de verkopen van vandaag **tot dit moment**.
3. Een gele banner bevestigt dat dit een live momentopname is: *"X-Rapport — [huidige tijd]"*

Het X-Rapport sluit de dag **niet** af. U kunt het zo vaak uitvoeren als u wilt gedurende de dag. Gebruik het om:
- Te controleren hoe de ochtendshift presteert
- Te zien of een drukke uur in de cijfers wordt weerspiegeld
- De eindtotalen van de dag te schatten

---

## 11.7 Een rapport exporteren naar PDF

Alle rapporttabbladen (behalve X-Rapport) kunnen naar PDF worden geëxporteerd.

1. Selecteer het tabblad en het datumbereik dat u wilt.
2. Wacht tot het rapport is geladen.
3. Klik op **PDF exporteren** in de rechterbovenhoek van het rapportgedeelte.
4. Een PDF opent in een nieuw tabblad of wordt gedownload.

De PDF bevat:
- Vestigingsnaam en rapportperiode
- Alle samenvattingscijfers
- BTW-uitsplitsingstabel
- Lijst met top producten
- Nederlandse of Engelse koppen, afhankelijk van de actieve taal

> **Tip voor BTW-aangifte:** Exporteer het maandelijkse Dagrapport voor de aangifteperiode. De BTW-uitsplitsingstabel is correct opgemaakt voor Belastingdienst Suriname.

---

## 11.8 De BTW-uitsplitsing lezen

De BTW-uitsplitsingstabel is belangrijk voor belastingnaleving:

```
BTW Rate    |  Taxable base (SRD)  |  BTW amount (SRD)
────────────┼──────────────────────┼───────────────────
10%         |        SRD 2,847.27  |     SRD 284.73
BTW-exempt  |          SRD 312.00  |       SRD 0.00
────────────┼──────────────────────┼───────────────────
Total       |        SRD 3,159.27  |     SRD 284.73
```

- Rij **10%** — alle producten onderhevig aan standaard BTW
- Rij **BTW-vrij** — basisvoedingsmiddelen, medicijnen en andere vrijgestelde producten
- Het BTW-bedrag in de rij 10% is wat moet worden aangegeven bij Belastingdienst

> **Waar is het formele "BTW-rapport" / aangifte?** De POS heeft geen tabblad voor BTW-aangifte — die werkstroom leeft op het dashboard, toegankelijk voor uw manager / Organisatiebeheerder. De BTW-totalen per dag die U ziet in de uitsplitsingstabel hierboven zijn dezelfde cijfers die worden ingediend; het dashboard voegt een formele actie **Indienen bij Belastingdienst** toe met auditgrade tracking + accepteren/betwisten door de belastinginspecteur. Volledige werkstroom: [dashboardhandleiding hfst 20 — BTW-aangiftes bij Belastingdienst Suriname](../dashboard_manual/20-btw-submissions-belastingdienst.md). De BTW-*uitsplitsing* per vestiging die uw manager gebruikt tijdens een aangifte staat in [dashboardhandleiding hfst 10 §10.4](../dashboard_manual/10-reports.md).

---

## Veelgestelde vragen over rapporten

**V: De verkopen van een dag lijken verkeerd. Kan ik ze corrigeren?**
A: Verkoopgegevens zijn onveranderlijk voor auditintegriteit. Neem contact op met uw manager of systeembeheerder.

**V: Kan ik individuele transacties zien?**
A: Ja — individuele transactiedetails zijn beschikbaar in het Super Admin Dashboard. Neem contact op met uw manager.

**V: Het rapport toont SRD 0.00 voor een dag waarvan ik weet dat er verkopen waren.**
A: Controleer of u de juiste datum heeft geselecteerd. Controleer ook of het Z-Rapport voor die dag is afgesloten. Verkopen die na middernacht AST zijn geregistreerd, verschijnen op de volgende dag.

**V: Hoe ver terug gaat de rapportgeschiedenis?**
A: Alle verkopen sinds de installatie van het systeem zijn beschikbaar.
