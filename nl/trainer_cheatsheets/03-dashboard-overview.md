# Hoofdkantoorbeheerder — Dashboard eerste kennismaking
**Josbin POS · Beheerportaal eerste kennismaking**

> Cloud webapp op `dashboard.josbin.sr` (of jouw gehoste URL). Gebruik een moderne browser — Chrome, Edge, Firefox.

---

## 🔑 Inloggen

1. Open de dashboard-URL → vul **e-mail + wachtwoord** in.
2. 2FA-code indien vereist (verplicht voor Super Admin + overheidsaccounts).
3. Je komt op een **andere startpagina afhankelijk van je rol**:

| Rol | Komt op | Bereik |
|-----|---------|--------|
| **Super Admin** | Dashboard | Alle organisaties, alle vestigingen |
| **Organisatiebeheerder** | Dashboard | Alleen jouw organisatie |
| **Vestigingsmanager** | Dashboard | Alleen jouw toegewezen vestiging(en) |
| **Auditor** | Dashboard | Alleen-lezen binnen toegestane scope |
| **Kassier** | Mijn Profiel | Alleen eigen statistieken — geen beheer-navigatie |

Taalwissel linksonder: **NL / EN**.

---

## 🗺️ Linkernavigatie

Legenda: **SA**=Super Admin · **OA**=Organisatiebeheerder · **SM**=Vestigingsmanager · **AU**=Auditor

| Item | Zichtbaar | Doel |
|------|-----------|------|
| **Mijn Profiel** | Iedereen | Eigen statistieken, wachtwoord, 2FA |
| **Dashboard** | SA/OA/SM/AU | Live multi-vestiging overzicht |
| **Z-Rapporten** | SA/OA/SM/AU | Dagafsluitingen |
| **Rapporten** | SA/OA/SM/AU | BTW, Rekenkamer, verkopen |
| **Catalogus** | SA/OA/SM | Productenstamlijst |
| **Import / Export** | SA/OA | Bulk CSV-catalogusladen |
| **Kassabeheer** | SA/OA/SM | Kassa's, heropeningen goedkeuren |
| **Klanten** | SA/OA/SM | Klantendatabase |
| **Voorraad** | SA/OA/SM | Voorraadtellingen |
| **Prijsoverschrijvingen** | SA/OA | Vestigingsspecifieke prijsvariaties |
| **Kortingsregels** | SA/OA/SM | Regels-engine |
| **Vergelijking** | SA/OA | Vestiging-vs-vestiging prestaties |
| **AI-inzichten** | SA/OA/SM | Wekelijkse samenvatting, anomalieën |
| **Vestigingsinstellingen** | SA/OA/SM | Per-vestiging configuratie |
| **Organisaties** | SA | Tenantbeheer |
| **Gebruikers** | SA/OA/SM | Accounts + rollen |
| **API-sleutels** | SA/OA | Integratiesleutels |
| **Auditlogboek** | SA/OA/AU | Onveranderbaar beheerspoor |
| **Licenties** | SA | Installaties + vervaldatum |

---

## 🏪 Dashboard-overzicht — jouw startpagina

```
  KPI-RIJ: Omzet vandaag · Transacties · BTW · Vestigingen online
  ─────────────────────────────────────────────
  Organisatietabs (als je er meer dan één beheert)
  ─────────────────────────────────────────────
   ┌────────┐ ┌────────┐ ┌────────┐
   │Vestig. │ │Vestig. │ │Vestig. │   live kaarten
   │ Omzet  │ │ Omzet  │ │ Omzet  │
   │ Tx/Gem │ │ Tx/Gem │ │ Tx/Gem │
   │ ⭐ top │ │ ⭐ top │ │ ⭐ top │
   │ ● Aan  │ │ ● Aan  │ │ ● Uit  │
   └────────┘ └────────┘ └────────┘
```

Elke kaart: SRD-omzet vandaag, transactie-aantal, gemiddeld mandje, BTW, top product ⭐, online-stip, syncbadge. Werkt live bij via WebSocket — geen verversen. Groene **Live**-pil in de bovenbalk = realtime verbonden.

---

## 📊 Inzoomen

**Klik op een vestigingskaart** → Vestigingsdetail (transacties van vandaag, betalingsuitsplitsing). **Klik op een verkoopregel** → volledige verkoop: regels, BTW per regel, kassier, wisselkoers, AST-tijdstempel. **← Terug** (linksboven) gaat terug naar overzicht.

---

## 📅 Rapporten

Linkernavigatie → **Rapporten**. Tabs: **Dagelijks** · **Maandelijks** · **Aangepast bereik** · **BTW** (Belastingdienst-formaat) · **Rekenkamer** (ondertekend audit-PDF voor Rekenkamer) · **Top producten**. Elk rapport heeft **Exporteren PDF** + **Exporteren CSV** rechtsboven. Kopteksten volgen de NL/EN-wissel.

---

## ⚙️ Instellingen, beveiliging, licentie

- **Gebruikers:** linkernavigatie → **Gebruikers** — toevoegen/uitschakelen, rollen toewijzen, 2FA forceren.
- **Organisaties** (SA): topniveau — BTW-nummer, standaardtaal, valuta.
- **Beveiligingsbeleid:** Organisaties → jouw organisatie → Beveiliging-tab — sessietime-out, lockout, geo-waarschuwingen.
- **Vestigingsconfig:** **Vestigingsinstellingen** — bonkop/voet, standaard BTW.
- **Licenties** (SA): **Licenties** — installaties, vervaldatum, terminalaantal.
- **Mijn wachtwoord / 2FA:** **Mijn Profiel**.

---

## 🆘 Als je deze banner ziet…

| Banner | Betekenis | Actie |
|--------|-----------|-------|
| 🟡 Licentie verloopt over N dagen | ≤30 dagen tot verlenging | Neem contact op met Josbin. POS werkt normaal. |
| 🟠 Licentie respijttermijn | Na vervaldatum, 14 dagen respijt | Verleng nu. POS werkt nog. |
| 🔴 Gedeeltelijke vergrendeling: nieuwe verkopen geblokkeerd | Respijt overschreden | Verleng onmiddellijk. Rapporten/exports nog toegankelijk. |
| 🟡 "Synchronisatie in afwachting" bij een vestiging | Z-Rapport niet bij hoofdkantoor | Bij >30 min: manager probeert opnieuw vanuit POS Dagafsluiting. |
| ⚪ Vestigingsstip grijs / Offline | Geen ping in >2 min | Internet ligt eruit bij de vestiging. Lokale POS verkoopt nog gewoon. |
| ⚠️ AI-inzichten anomaliemelding | Ongebruikelijke annulering/korting/buiten kantooruren | Open de melding, lees context, volg op met manager. |

---

> **Gouden regel:** het dashboard is grotendeels alleen-lezen voor het hoofdkantoor. Het echte geld gebeurt in de vestigingen — hier kijk, audit en configureer je. Bij twijfel zoom in op de vestigingskaart en bekijk de echte verkoop.
