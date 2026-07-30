---
layout: home

hero:
  name: Josbin POS
  text: Documentatie
  tagline: POS-platform voor Suriname — drie-lagen architectuur, BTW conform Belastingdienst, multi-vestiging dashboard, offline-first synchronisatie.
  actions:
    - theme: brand
      text: Ontwikkelaarsdocs
      link: /nl/docs/
    - theme: alt
      text: POS-handleiding
      link: /nl/user_manual/

features:
  - icon: 🏗️
    title: Voor ontwikkelaars
    details: Architectuur, request-levenscyclus, BTW-pipeline, sync-flow, code-overzicht. Lees op volgorde of spring naar een hoofdstuk.
    linkText: Open ontwikkelaarsdocs
    link: /nl/docs/

  - icon: 🛒
    title: Voor kassiers & vestigingsmanagers
    details: Stap-voor-stap POS-werkstromen — inloggen, dagelijkse setup, verkopen, bonnen, klanten, kortingen, Z-Rapporten, instellingen.
    linkText: Open POS-handleiding
    link: /nl/user_manual/

  - icon: 🏢
    title: Voor HQ-beheerders
    details: Dashboard voor organisatie-, vestiging-, gebruikers-, catalogus- en rapportbeheer. Cross-vestiging BTW, Rekenkamer-export, audit-trail.
    linkText: Open dashboard-handleiding
    link: /nl/dashboard_manual/

  - icon: 📋
    title: Trainersbladen
    details: Eén-pagina afdrukbare referenties voor klassikale trainingen en naast-de-kassa hulp.
    linkText: Open trainersbladen
    link: /nl/trainer_cheatsheets/
---

## Wat is Josbin POS?

Een complete enterprise POS- en multi-vestigingsplatform, gebouwd voor Suriname. Drie-lagen architectuur:

1. **POS desktop-app** (Electron, Windows) — wat de kassier ziet aan de balie
2. **Super Admin webdashboard** — HQ-overzicht over alle vestigingen
3. **Open integratie-API** — voor derde-partij POS-systemen die naar onze platform pushen

Gebouwd met Laravel 13 + React 19 + PostgreSQL 16, met `pgvector` voor AI-productzoekfuncties en Reverb WebSockets voor live HQ-updates. Volledig tweetalig (Nederlands / Engels), BTW-correct volgens Belastingdienst Suriname, hash-keten audit-trail volgens Rekenkamer-eisen.

## Snel beginnen

- Eerste keer in het project? Lees [`README.md`](https://github.com/) (Engels) — heeft de quickstart-commando's en test-instructies.
- Werk je aan code? [`CLAUDE_WORKING_GUIDE.md`](https://github.com/) — engineering discipline, surfaces checklist, gotcha registry.
- Wil je weten of een feature al bestaat? [`FEATURES_AND_FLOWS.md`](https://github.com/) — 100+ features met status (✅/🟡/🔲), 7 kritieke gebruikersjourneys, rollen-matrix.

## Taal

Schakel rechtsboven tussen Engels en Nederlands. Beide versies bevatten dezelfde hoofdstukken en zelfde structuur — alleen de tekst verschilt.

> **Let op:** sommige technische ontwikkelaarsdocs onder *Ontwikkelaarsdocs* zijn grotendeels code en commando's. Die delen blijven Engels (zoals gebruikelijk in IT-projecten); de prozagedeelten zijn vertaald.
