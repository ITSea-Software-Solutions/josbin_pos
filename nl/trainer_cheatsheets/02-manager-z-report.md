# Vestigingsmanager — Einde dag (Z-Rapport)
**Josbin POS · Winkelbeheerder dagafsluiting**

> Eén keer per handelsdag uitvoeren, na de **laatste verkoop** en nadat **alle kassiers hun kassa hebben gesloten**. Het sluiten van de dag is definitief — controleer dubbel voordat je tikt.

---

## 📋 Controle vóór afsluiten

- [ ] **Alle kassiers hebben hun kassa gesloten.** Dashboard → **Kassabeheer** — elke rij *Gesloten*.
- [ ] **Alle heropeningsverzoeken afgehandeld.** Oranje "Wacht op goedkeuring"-teller = 0.
- [ ] **Alle vastgehouden bonnen afgewerkt** door kassiers (voltooid of weggegooid).
- [ ] **Wisselkoers van vandaag vergrendeld.** POS-bovenbalk → **Wisselkoers** toont ✓ Vergrendeld.
- [ ] **Kassalades geteld en in zakken.** Fysiek geld in handen.

---

## 📊 Open het scherm

POS-bovenbalk → **Dagafsluiting**:

```
  ┌──────────────────────────┬──────────────────────────┐
  │ Dagoverzicht             │ Kasafstemming            │
  │ • Totaal verkopen SRD    │ • Verwacht kasgeld (sys) │
  │ • Aantal transacties     │ • Werkelijk kasgeld (jij)│
  │ • Totaal BTW             │ • Verschil (automatisch) │
  │ • Contant / Pin totalen  │ • Opmerking (bij verschil)│
  └──────────────────────────┴──────────────────────────┘
  Geschiedenis (7 dagen) — recente Z-Rapporten + syncstatus
```

Controleer eerst het overzicht goed. Lijkt er iets niet te kloppen, **sluit dan niet** — check Verkoopgeschiedenis of bel de kassier.

---

## 💰 Kasafstemming

1. Tel elk biljet + munt over **elke** lade, opgeteld.
2. **Werkelijk kasgeld** — type SRD-totaal in (bv. `4875.50`).
3. **Verschil** wordt direct bijgewerkt:

   | Kleur | Betekenis |
   |-------|-----------|
   | 🟢 `SRD 0.00` | Klopt ✓ |
   | 🔴 `−SRD x.xx` | Tekort — minder geld dan verwacht |
   | 🔴 `+SRD x.xx` | Overschot — meer geld dan verwacht |

4. **Elk verschil >SRD 0.01** ⇒ **Verschil opmerking** wordt verplicht. Type een reden (NL of EN), bv. *"Wisselgeld fout bij verkoop #2026-00038"*. De Indienen-knop blijft uitgeschakeld tot het ingevuld is.

---

## ✅ Z-Rapport indienen

1. Tik op **Z-rapport afdrukken**.
2. Het systeem vergrendelt de cijfers van vandaag, synchroniseert met het hoofdkantoor, drukt af op de bonprinter (indien geconfigureerd).
3. Groene banner: *"Dag succesvol afgesloten"* ✅
4. Nieuwe rij in **Geschiedenis (7 dagen)** met een syncbadge:

| Badge | Betekenis | Actie |
|-------|-----------|-------|
| 🟢 **Verzonden** | Gesynchroniseerd met hoofdkantoor ✓ | Klaar. |
| 🟡 **In afwachting** | In wachtrij, automatisch opnieuw proberen (1m → 5m → 15m → 30m) | Wachten. |
| 🔴 **Mislukt** | Synchronisatie mislukt | Zie hieronder. |

---

## 🔄 Als synchronisatie mislukt

**A) Opnieuw proberen vanuit scherm:** Rij in geschiedenis → **Verzenden naar hoofdkantoor** → bevestig.
**B) Wachten:** automatische retry hervat zodra het internet terug is. Gegevens zijn lokaal veilig.
**C) USB / WhatsApp / e-mail:** Rij in geschiedenis → **💾 .josbin_pos** → bestand wordt gedownload (AES-256 versleuteld, veilig om te versturen). Hoofdkantoor importeert via Super Admin Dashboard.

> De dag is **gesloten** op het moment dat je lokaal indient. Syncstatus gaat alleen over het bereiken van het hoofdkantoor — het blokkeert nooit de handel van morgen.

---

## 🚨 Veelvoorkomende problemen

| Situatie | Wat doen |
|----------|----------|
| Kassier liet kassa open staan en ging naar huis | Dashboard → **Kassabeheer** → vind de sessie → sluit namens hem met jouw kastelling + een opmerking. |
| Heropeningsverzoek van een kassier | Dashboard → **Kassabeheer** → oranje banner → lees de reden → **Goedkeuren** of **Afwijzen** (afwijzing vereist een reden). |
| Verschil groot (>SRD 100) | **Niet sluiten.** Tel opnieuw. Controleer Verkoopgeschiedenis op late annuleringen. Bel de kassier. Sluit pas als je het verschil begrijpt. |
| Per ongeluk gesloten | Dag is vergrendeld — **geen ongedaan maken** by design. Verkoopgeschiedenis blijft accuraat; sync kan opnieuw ingediend worden. |
| Z-Rapport toont gegevens van gisteren | Ververs (rechtsboven ↻). Nog steeds fout? Controleer de tijdzone van de terminal (moet AST / Paramaribo zijn). |
| Tussentijdse momentopname nodig (geen sluiting) | POS-bovenbalk → **Rapporten** → tabblad **X-Rapport**. Alleen bekijken — sluit de dag nooit. |

---

> **Gouden regel:** het Z-Rapport is je formele overdracht aan het hoofdkantoor en Belastingdienst Suriname. Tel het geld fysiek. Leg elk verschil schriftelijk uit. Eenmaal ingediend is de boekhouding van vandaag vergrendeld — zo blijft het auditspoor betrouwbaar.
