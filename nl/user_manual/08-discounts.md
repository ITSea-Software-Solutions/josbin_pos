# Hoofdstuk 8 — Kortingen

Josbin POS ondersteunt kortingen op twee niveaus: op individuele regels en op de gehele verkoop. Beide types kunnen een vast SRD-bedrag of een percentage zijn.

---

## 8.1 Soorten korting

| Type | Waar het van toepassing is | Voorbeeld |
|------|-----------------|---------|
| **Korting per regel** | Eén specifieke regel in de winkelwagen | "10% korting op het brood" |
| **Korting op totaal** | Het totaal van de gehele winkelwagen | "5% korting op de hele aankoop" |
| **Automatische regelkorting** | Door het systeem toegepast op basis van vooraf ingestelde regels | "Koop 3 en krijg 1 gratis", "10% korting op categorie Zuivel op dinsdagen" |

> **Belangrijk — BTW-regel:** Alle kortingen worden toegepast **voordat** BTW wordt berekend. Dit is verplicht volgens Belastingdienst Suriname. Het systeem doet dit automatisch — u hoeft zich geen zorgen te maken over de volgorde.

---

## 8.2 Een korting toepassen op één regel

1. Zoek in het winkelwagenpaneel de regel die u korting wilt geven.
2. Klik op de regel om het paneel **Regel bewerken** te openen.
3. U ziet velden voor:
   - **Aantal** — wijzig het aantal indien nodig
   - **Stukprijs** — overschrijf de prijs voor deze verkoop (bijv. onderhandelde prijs)
   - **BTW-tarief** — overschrijf het BTW-tarief voor deze regel
   - **Kortingsbedrag (SRD)** — voer een vaste korting in SRD in
4. Voer het kortingsbedrag in of wijzig de prijs.
5. Klik op **Opslaan**.
6. Het regeltotaal wordt bijgewerkt en het winkelwagentotaal wordt herberekend met de BTW correct toegepast.

**Voorbeeld:**
- Brood kost SRD 12.00. De klant heeft een kortingsbon van SRD 2.00.
- Voer `2.00` in het veld Kortingsbedrag in.
- Het regeltotaal wordt SRD 10.00 en de BTW wordt herberekend over SRD 10.00.

---

## 8.3 Een korting toepassen op de gehele verkoop

1. Zoek in het winkelwagenpaneel de knop **"Korting op bon"** — meestal een percentage- of SRD-pictogram bij het totalengedeelte.
2. Klik erop om het Kortingspaneel te openen.
3. Kies het kortingstype:
   - **Percentage (%)** — bijv. voer `10` in voor 10% korting op het totaal
   - **Vast bedrag (SRD)** — bijv. voer `15` in voor SRD 15.00 korting
4. Voer het bedrag in.
5. Klik op **Toepassen**.
6. De korting verschijnt in de winkelwagen onder het subtotaal. De BTW wordt herberekend over het gekorte bedrag.

---

## 8.4 Een korting verwijderen

**Korting per regel:**
1. Klik op de regel.
2. Zet het kortingsveld terug op `0`.
3. Klik op Opslaan.

**Korting op totaal:**
1. Klik opnieuw op de knop voor korting op totaal.
2. Maak het bedrag leeg en klik op Toepassen (of klik op Verwijderen).

---

## 8.5 Automatische kortingsregels

Managers kunnen vooraf kortingsregels instellen (bijv. "10% korting op alle zuivel elke dinsdag", "Koop 2 Coca-Cola en krijg 1 gratis"). Deze worden **automatisch** toegepast wanneer aan de voorwaarden wordt voldaan — de kassier hoeft niets te doen.

Wanneer een automatische regel van toepassing is:
- De korting verschijnt op de regel in de winkelwagen.
- Het label toont de naam van de regel (bijv. "Promotie: 2+1 gratis").
- De automatische korting en eventuele handmatige korting die u toevoegt, worden gecombineerd.

Als een regel niet van toepassing moet zijn voor een specifieke klant, kunt u deze overschrijven door de regelkorting naar nul te zetten (stap 8.2).

---

## 8.6 Korting weergegeven op de bon

Alle kortingen worden apart op de bon weergegeven:
- Regelkortingen verschijnen op de productregel
- Korting op totaal verschijnt onder het subtotaal
- De BTW wordt berekend over de gekorte prijs (zoals wettelijk verplicht)

### Uitgewerkt voorbeeld — korting-voor-BTW-volgorde

Belastingdienst Suriname vereist dat BTW wordt geëxtraheerd **nadat** kortingen zijn toegepast (niet ervoor). Hier is precies hoe dat werkt in Josbin POS:

```
Cart:
  Rice 5kg            SRD 38.50    (10% BTW)
  Coca-Cola 1.5L      SRD 7.50     (10% BTW)
                      ─────────
  Subtotal            SRD 46.00    (tax-inclusive prices)

Cashier applies 10% sale discount:
  Discount            -SRD 4.60    (10% of 46.00)
                      ─────────
  After discount      SRD 41.40

BTW extracted from the discounted total:
  BTW (10%)            SRD 3.76    (= 41.40 - 41.40/1.10)
  Net (excl. BTW)      SRD 37.64
                      ─────────
  Total to pay         SRD 41.40
```

Drie dingen om op te merken:

1. De **prijs voor de klant veranderde niet** tussen "na korting" en "Totaal te betalen" — dat zijn dezelfde getallen. De BTW-regel is een *uitsplitsing* van de SRD 41.40, niet een toevoeging erbovenop.
2. Het BTW-bedrag (SRD 3.76) is **minder dan 10% van het ongekorte subtotaal** (SRD 4.60). Dat klopt — de korting verlaagt zowel de nettoprijs ALS de BTW proportioneel.
3. De omgekeerde volgorde (eerst BTW, dan korting) zou de klant op deze enkele verkoop **SRD 0.84 te veel belasten**. Vermenigvuldigd over een dag aan transacties is dat echt geld — en dat is niet wettelijk toegestaan onder de Surinaamse BTW-regels.

De bon drukt alle drie getallen af: subtotaal, korting, BTW. De klant kan de berekening verifiëren.

---

## Veelgestelde vragen over kortingen

**V: Kan ik een percentage EN een vaste korting geven op dezelfde regel?**
A: Gebruik het paneel Regel bewerken (stap 8.2). Voer de gecombineerde korting in als één SRD-bedrag.

**V: Kan ik de prijs onder nul brengen?**
A: Nee. Het systeem staat niet toe dat een regeltotaal of winkelwagentotaal door kortingen negatief wordt.

**V: Wordt de korting vóór of na BTW toegepast?**
A: Altijd ervoor. Het systeem regelt dit automatisch en correct, ongeacht wat u invoert.

**V: Kan een kassier elke korting geven die hij wil?**
A: Dit hangt af van de rolinstellingen die door uw manager zijn geconfigureerd. Kassiers kunnen een maximale kortingslimiet hebben. Als u deze overschrijdt, kan het systeem om goedkeuring van de manager vragen.
