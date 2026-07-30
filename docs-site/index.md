---
layout: home

hero:
  name: Josbin POS
  text: Documentation
  tagline: Enterprise POS platform for Suriname — three-layer architecture, Belastingdienst-compliant BTW, multi-store dashboard, offline-first sync.
  actions:
    - theme: brand
      text: Developer Docs
      link: /docs/
    - theme: alt
      text: User Manual
      link: /user_manual/
    - theme: alt
      text: 🎬 Video's & presentatie
      link: /videos.html
    - theme: alt
      text: 🧭 Architecture plan
      link: /plan/

features:
  - icon: 🏗️
    title: For developers
    details: Architecture, request lifecycle, BTW pipeline, sync flow, code map. Read in order or jump to a chapter.
    linkText: Open developer docs
    link: /docs/

  - icon: 🛒
    title: For cashiers & store managers
    details: Step-by-step POS workflows — login, daily setup, sales, receipts, customers, discounts, Z-Reports, settings.
    linkText: Open user manual
    link: /user_manual/

  - icon: 🏢
    title: For HQ admins
    details: Dashboard manual — roles & permissions, organisation/store setup, catalogue, reports, audit log. The HQ-facing book.
    linkText: Open dashboard manual
    link: /dashboard_manual/

  - icon: 🚀
    title: Brand-new install
    details: Single end-to-end runbook covering server install, organisation onboarding, hardware setup, first live sale.
    linkText: Installation & Setup Guide
    link: /docs/00-installation-and-setup

  - icon: 🎬
    title: Watch instead of read
    details: The platform presentation (13 chapters, ±3 min, NL/EN with voice-over) plus the promo and teaser — ideal for a team session or a first demo.
    linkText: Open the video overview
    link: /videos.html

  - icon: 🧭
    title: Where we're heading
    details: The plan to split the product into three independent nodes — shop, control, tax. Target architecture, the freeze list of what must not break, and where all 220 features land. A plan, not what runs today.
    linkText: Open the architecture plan
    link: /plan/

  - icon: 📐
    title: Architecture in one read
    details: Three layers, eight containers, a traced sale from cashier tap to broadcast — the foundational doc.
    linkText: Architecture overview
    link: /docs/01-architecture
---

## How to use this site

Pick **Developer Docs** if you're maintaining or extending Josbin POS — the chapters there are written for engineers.

Pick **User Manual** if you're training cashiers or store managers — those chapters use plain language, no technical jargon.

Press **`/`** anywhere on the site to search across both books.

To save a page as PDF: use your browser's **Print → Save as PDF** menu while viewing the page. The print stylesheet hides the navigation and renders the content cleanly.

## Conventions across all docs

- **Money** is always SRD with 2 decimals. Internally always bcmath strings — never floats.
- **Time** is always AST (`America/Paramaribo`, UTC-3).
- **IDs** are UUIDs (v7 for sortable ones).
- **File paths** are written `backend/app/Http/Controllers/Api/SaleController.php:128` — click to open at that exact line in your editor.

## When something doesn't match the docs

The code is the source of truth. If you find a mismatch, update the doc in the same PR as the code change. Stale docs are worse than no docs.
