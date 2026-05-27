# Hoofdstuk 2 — Dagelijkse setup: Wisselkoers

**Wie doet dit:** Vestigingsmanager (of bevoegd personeel)
**Wanneer:** Elke ochtend vóór de eerste verkoop van de dag

---

## Waarom de wisselkoers belangrijk is

Josbin POS legt bij elke verkoop de **USD-naar-SRD wisselkoers** vast. Dit is vereist voor:

- Nauwkeurige financiële rapportage
- BTW-aangiftes bij de Belastingdienst Suriname
- Rekenkamer-audit-exports

**U kunt geen verkopen verwerken totdat er een koers voor vandaag bestaat.** Als een kassier een betaling probeert te voltooien voordat de koers is ingesteld, ziet hij/zij de melding: *"Geen dagkoers beschikbaar. Vergrendel de wisselkoers voor vandaag."*

---

## 2.1 Het Wisselkoers-scherm openen

1. Klik in de bovenbalk op de knop **Wisselkoers**.
2. Het Wisselkoers-scherm opent.

---

## 2.2 De live koers automatisch ophalen

Het systeem kan de koers van vandaag automatisch via internet ophalen.

1. Klik op de knop **"Haal live koers op"**.
2. Het systeem neemt contact op met ExchangeRate-API en vult de USD → SRD koers van vandaag in.
3. De koers verschijnt in het grote weergaveveld: **1 USD = SRD XX,XXXX**
4. De status verandert in **"Vergrendeld"** met het tijdstip van vergrendeling.

> **Tip:** Als het ophalen mislukt (geen internet), gebruik dan de handmatige invoer die hieronder wordt beschreven.

---

## 2.3 De koers handmatig instellen

Als u geen internettoegang heeft, of de opgehaalde koers niet overeenkomt met uw afgesproken koers:

1. Zoek het gedeelte **"Handmatige invoer"**.
2. Klik op het cijferveld en typ de koers (bijv. `36.50`).
   - Gebruik een punt (`.`) als decimaalteken, geen komma.
   - Voer de koers in als SRD per 1 USD. Voorbeeld: als 1 USD = SRD 36,50, typ dan `36.50`.
3. Klik op **Opslaan**.
4. De nieuwe koers verschijnt in het grote weergaveveld en wordt gemarkeerd als **"Handmatig"**.

> **Waarschuwing:** De handmatige koers geldt voor elke verkoop gedurende de hele dag. Voer hem zorgvuldig in. Eenmaal vergrendeld, kan hij niet worden gewijzigd zonder managertoegang.

---

## 2.4 De valuta-omrekenaar gebruiken

Het Wisselkoers-scherm heeft ook een **snelle omrekenaar** ter referentie:

1. Zoek het **omreken-gedeelte** (twee invoervelden, gelabeld USD en SRD).
2. Typ een USD-bedrag → het equivalent in SRD wordt direct berekend.
3. Of typ een SRD-bedrag → het equivalent in USD wordt berekend.
4. Deze omrekeningen zijn alleen ter referentie. Ze beïnvloeden geen enkele verkoop.

---

## 2.5 Koersgeschiedenis bekijken

Onderaan het Wisselkoers-scherm staan de koersen van de laatste 7 dagen:

| Kolom | Beschrijving |
|--------|-------------|
| Datum | De datum waarop de koers is ingesteld |
| 1 USD = SRD | De koers die die dag is gebruikt |
| Bron | "Vergrendeld" (automatisch opgehaald) of "Handmatig" (met de hand ingevoerd) |

Deze geschiedenis is voor referentie en audit-doeleinden.

---

## 2.6 Automatisch ophalen van de koers (achtergrond)

Als niemand de koers handmatig ophaalt, probeert het systeem deze elke ochtend om **06:00 AST (Atlantic Standard Time)** automatisch op te halen via een geplande achtergrondtaak. Dit betekent dat op de meeste ochtenden de koers al is ingesteld wanneer u aankomt.

U kunt deze altijd overschrijven met de handmatige invoer in stap 2.3.

---

## Veelvoorkomende problemen

| Probleem | Oplossing |
|---------|----------|
| Knop "Haal live koers op" toont een fout | Geen internetverbinding. Gebruik handmatige invoer (stap 2.3). |
| De koers is verkeerd ingevoerd | Gebruik handmatige invoer om de juiste koers in te voeren. Het systeem gebruikt de laatste invoer voor vandaag. |
| Een kassier zegt dat hij/zij een verkoop niet kan voltooien | Controleer of de wisselkoers van vandaag is ingesteld. Als deze ontbreekt, stel hem nu in. |
