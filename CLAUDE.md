You are helping a software development team build Josbin POS — a complete enterprise POS and multi-store management platform built specifically for Suriname. A senior developer has already completed the full planning, architecture, and proposal for this project. Your job is to continue from that context and help the team build, document, and deliver it.

Read everything below carefully before responding to anything.

> **Read these too** (in this order at session start):
>  1. [`CLAUDE_WORKING_GUIDE.md`](CLAUDE_WORKING_GUIDE.md) — engineering discipline. Surfaces checklist (§2), end-to-end journeys (§3), gotcha registry (§4). Walk §2 before declaring any task done. Add new gotchas to §4 as we discover them.
>  2. [`FEATURES_AND_FLOWS.md`](FEATURES_AND_FLOWS.md) — feature catalogue. Every feature with status (✅ / 🟡 / 🔲), the flows that wire features together, code-location quick map, roles→features matrix. The fastest way to answer "does the system already do X?".
>
> Both are living docs — update them when you add or change features.

---

## PROJECT NAME & CONTEXT

Product name: Josbin POS
Client location: Suriname
Our role: Software development company building this for a Surinamese client who will sell it to supermarkets, retail shops, and government departments across Suriname.
Build: Fresh from scratch — no legacy codebase.
Team: 2 backend developers + 2 frontend developers
Timeline: 18 weeks across 4 phases
Version: Proposal v3.1 — post client meeting update

---

## THREE-LAYER PLATFORM

Layer 1 — Store POS System (Electron desktop app, Windows)
Layer 2 — Super Admin Dashboard (web browser, cloud)
Layer 3 — Open Integration API (REST + webhooks for third-party POS systems)

---

## KEY REQUIREMENTS (ALL CONFIRMED)

Language: Dutch (Nederlands) primary + English — full bilingual UI, receipts, reports, exports. i18next on React frontend, Laravel Localization on backend. Instant per-user language switch, no restart. Adding a third language (Sranantongo etc.) requires only a new translation file.

Currency: Surinamese Dollar (SRD). PostgreSQL DECIMAL(12,2) for all monetary values — no floating point. All prices, totals, reports in SRD.

Tax: BTW (Belasting over de Toegevoegde Waarde) — Suriname VAT currently 10%. Configurable per product. BTW-exempt flag for basic foodstuffs and medicine. Shown as separate line on receipts. Reports formatted for Belastingdienst Suriname. Discounts applied before BTW extraction — correct compliance order.

Deployment: Electron desktop app (.exe installer) on each POS terminal and manager screen. Local Docker server (Laravel + PostgreSQL + Redis) on one back-office PC per store. No internet required for core sales. Cloud sync for Super Admin Dashboard. SaaS migration path built in from day one — same Docker containers deploy to cloud, zero code changes.

Exchange rate: Daily USD→SRD rate fetched from ExchangeRate-API (free, supports SRD — Frankfurter does NOT support SRD, do not use it) at 06:00 AST via Laravel scheduled command. Locked in daily_rates table and Redis cache. All transactions that day use the locked rate. Manual override available. Rate stored on every sale record for audit purposes.

Timezone: All timestamps in AST (America/Paramaribo, UTC-3).

---

## CHOSEN TECH STACK

Frontend: React 19.2.4 + TypeScript
- Electron (Windows desktop app, compiled binary, DevTools disabled in production)
- React Compiler (auto memoization — no manual useMemo/useCallback)
- Activity API (hold bills pre-rendered in memory — instant load)
- React Actions API (async sale completion, optimistic UI)
- useTransition (non-blocking UI during category switches and report loads)
- TanStack Query v5 (data fetching and caching)
- Zustand (POS cart state)
- i18next (Dutch/English translations)
- Quagga2 (camera barcode scanner — EAN-13, Code 128, UPC-A)
- Recharts (dashboard charts)
- Laravel Echo (WebSocket client)
- Vite 6 (build tool)

Backend: Laravel 13 (PHP 8.3) — released March 17, 2026
- Laravel AI SDK (officially stable in L13 — text generation, embeddings, vision, agents)
- Laravel Sanctum (API token auth for POS terminals)
- Laravel Fortify + Passkeys (passwordless auth for admin — new in L13)
- Laravel Reverb (native WebSocket server — no Pusher needed)
- Laravel Horizon (queue monitoring dashboard)
- Laravel Telescope (debug, dev only)
- Laravel Excel + DomPDF (report export — SRD formatted, Dutch/English headers)
- Laravel Queues with Redis driver (webhooks, reports, AI jobs, email receipts, sync retries)
- spatie/laravel-permission (RBAC)
- owen-it/laravel-auditing (immutable audit log)
- stancl/tenancy (SaaS multi-tenancy — database-per-tenant)
- JSON:API Resources (built into L13 — used for open integration API)
- PHP 8.3 Attributes (clean model definitions)
- IonCube encoding (source code protection before delivery to clients)

Database: PostgreSQL 16
- pgvector extension (AI product embeddings for semantic search)
- WAL enabled (point-in-time recovery to any specific minute in AST)
- Row-level security for tenant isolation
- AES-256 encryption at rest

Cache / Realtime: Redis 7 + Laravel Reverb

Infrastructure: Docker + Docker Compose (Laravel Sail for local dev)
- Nginx (reverse proxy)
- GitHub Actions (CI/CD — automated tests on every commit)
- Let's Encrypt SSL
- Laravel Nightwatch (production monitoring)

AI Layer: Laravel AI SDK (L13 stable)
- OpenAI GPT-4o (primary model)
- Claude API (Anthropic) as fallback/specialist
- pgvector (product embeddings stored in PostgreSQL)
- Python microservice (future — heavy forecasting with scikit-learn / Prophet)

---

## COMPLETE FEATURE LIST

POS System (Electron app):
- Product grid — tap to add, configurable display by name/photo/both
- Category filter bar
- Products with individual BTW rates, auto-calculated
- BTW-exempt flag per product
- Edit price, qty, BTW rate, discount per line item mid-sale
- Item-level discounts (% or fixed SRD per line item)
- Sale-level discount (% or fixed SRD on entire basket)
- BTW recalculated correctly after all discounts
- Hold Bills (saved to open bills queue, React 19 Activity API keeps pre-rendered)
- Load any open bill instantly
- View today's total sales and count without leaving POS screen
- Add new customer on-the-fly without leaving POS (name, phone, email)
- Search existing customers by name or phone
- Default walk-in customer setting
- Cash payment — on-screen numpad, real-time change calculation
- Card/PIN payment flow
- Mixed payment (part cash, part card)
- Print receipt — ESC/POS to thermal printer (EPSON TM-T20 and compatible)
- Email receipt — bilingual HTML with BTW breakdown
- Receipt customisation per store — header, footer, logo, BTW registration number
- Barcode scanner — USB HID (keyboard wedge, works automatically) + Quagga2 camera
- Manual barcode entry / search bar (8–13 digit string on Enter triggers lookup)
- Barcode & Label Printing page — bulk print to label printer (EAN-13, Code 128, QR)
- On-screen keyboard toggle (for touchscreen-only terminals)
- Date format selector (6 options, Dutch default DD-MM-YYYY)
- Language toggle (Dutch/English, instant, per user)
- Store-level reports: Daily Sales, Monthly Sales, Custom Range, Top Products, Custom Product Report
- X-Report (mid-day snapshot, no register close)
- Z-Report (end of day register close, cash reconciliation, triggers sync)
- All reports export to PDF (Dutch/English headers) and CSV
- Daily USD→SRD rate screen (view, lock, manual override)
- Settings: default BTW, discount, category, customer, barcode symbology, site name

Super Admin Dashboard (web browser):
- Live multi-store overview — real-time SRD totals via WebSocket (Laravel Reverb)
- Per-store cards — revenue, transaction count, avg basket, top product, sync status, online/offline
- Drill down into any store's full transaction list
- Compare store performance side by side
- Consolidated reports — cross-store daily, monthly, custom range
- BTW consolidated report — Belastingdienst Suriname format, all stores combined
- Top Products across entire network
- Rekenkamer audit export — signed PDF, complete transaction history, void details, user attribution, AST timestamps
- Organisation & store management (add, edit, deactivate)
- Centralised product catalogue with optional per-store price overrides
- Push catalogue updates to one or all stores (Reverb WebSocket delivery, seconds)
- User & role management — six roles: Super Admin, Organisation Admin, Store Manager, Cashier, Auditor (read-only), API Integration
- Enforce 2FA requirement per role
- Full audit log — append-only, tamper-proof, all admin actions
- Z-Report / End of Day screen with 7-day history, Submit to Headquarters button, sync status
- Three sync options: A) automatic on Z-Report close (default), B) scheduled nightly at set time, C) manual submit by manager
- API key management and webhook configuration screens
- License management integration (expiry warnings, renewal prompts)

Open Integration API (Layer 3):
- POST /v1/sales — third-party POS pushes sale data, API key auth, JSON:API spec
- POST /v1/sales/batch — offline POS batch upload, idempotent (duplicate sale_ref ignored)
- GET report endpoints — third-party pulls their own data
- Outbound webhooks — sale.created, shift.closed, refund.issued — queue-backed with retry
- OpenAPI/Swagger documentation auto-generated
- Sandbox environment for integration testing

---

## OFFLINE RESILIENCE — FIVE-LAYER SYNC FALLBACK

Layer 1 — Real-time sync (internet available): every sale syncs to cloud within seconds via outbox queue
Layer 2 — Auto retry (internet drops): retry schedule 1min → 5min → 15min → 30min. Yellow "Sync pending — N transactions queued" indicator on manager screen
Layer 3 — Z-Report forced retry: deliberate sync attempt when manager runs Z-Report
Layer 4 — USB encrypted export: AES-256 encrypted .josbin_pos file, manager saves to USB or sends via WhatsApp/email, head office uploads in Super Admin Dashboard — imports exactly as if synced
Layer 5 — Catch-up sync: local server pings every 60s, on internet restore syncs all queued days chronologically. Offline days marked "synced late" in audit trail with sync timestamp.
Mobile data fallback: 4G USB dongle (Digicel/Telesur) as secondary connection on local server — only used for sync payload (50–200KB/day), not for POS operations.

---

## USER HIERARCHY

Your client = Super Admin (full platform access, manages all organisations)
  └── Organisation Admin (manages their organisation only — e.g. head office of a supermarket chain)
        └── Store Manager (manages their assigned store(s) only)
              └── Cashier (POS screen only)
              └── Auditor (read-only — for internal compliance officers / Rekenkamer)
API Integration (machine account for third-party POS systems)
Tax Inspector (Belastingdienst Suriname — cross-organisation read-only, BTW filings only, 2FA mandatory)

Organisation = one customer (e.g. "Supermarkt De Hoop" or "Ministerie van Financiën")
Store = one physical location under an organisation
Product catalogue: centralised by default (one master list, all stores), with optional per-store price overrides for stores in different regions (e.g. Nickerie branch higher transport costs)

Registration flow:
1. Super Admin creates Organisation (name, type, BTW number, language, default BTW rate)
2. Super Admin creates Store(s) under organisation
3. Super Admin creates Organisation Admin account → welcome email sent
4. Organisation Admin imports product catalogue (CSV or manual), creates Store Manager accounts
5. Store Manager creates Cashier accounts, installs Electron app on terminals, store goes live

---

## END OF DAY — Z-REPORT & REGISTER CLOSE

Formal terms: Z-Report = end of day register close. X-Report = mid-day snapshot (no close).

Z-Report screen shows:
- Total sales SRD, transaction count, avg basket, total BTW, payment method breakdown, top 5 products
- Cash reconciliation: system expected vs actual cash counted by manager. Discrepancy flagged red, mandatory note field, logged in audit trail
- 7-day history table: each closed day, total, BTW, sync status. Click to view detail or re-submit failed sync
- Submit to Headquarters button: shows exactly what will be sent, manager confirms, row updates to "Sent ✓ [timestamp]"
- Print Z-Report: to receipt printer as formal document or PDF export for Belastingdienst filing

---

## CODE PROTECTION & LICENSING

Code protection:
- All Laravel PHP files encoded with IonCube before delivery to client — unreadable to humans, runs at full speed inside Docker with IonCube Loader included in container
- Electron binary compiled, DevTools disabled in production build, code-signed (.exe) — Windows warns if tampered
- Field-level database encryption means even direct DB access yields unreadable sensitive data

License system:
- License key issued per installation, bound via hardware fingerprinting (MAC + CPU ID + UUID)
- Checks your license server on startup and every 24 hours
- 72-hour offline grace mode if your license server is temporarily unreachable
- License records: organisation, store count, terminal count, tier, expiry date
- Exceeding licensed terminal count shows "License limit reached" on new terminals

Renewal enforcement timeline:
- 30 days before expiry: yellow banner in dashboard + email to account holder. POS normal.
- 14 days before: amber banner, daily email reminders. POS normal.
- Expiry date: 14-day grace period begins. Full operation continues. Red banner for managers only. Cashiers unaffected.
- Grace period +14 days: SOFT LOCK — new sales blocked. All existing data, reports, BTW exports, Rekenkamer audit access remain fully available. Client's data never held hostage.
- On renewal: instant reactivation, no reinstall needed
- Soft lock +30 days: HARD LOCK — login blocked. Data export tools remain available 90 days.
- License server: separate small Laravel application you manage, fully under your control

---

## DATABASE ENTITIES (KEY TABLES)

organisations: id (uuid), name, type (retail|govt|wholesale), btw_number, currency (SRD), locale (nl|en), is_government, subscription_tier
stores: id, organisation_id (FK), name, address, city, default_btw_rate, receipt_header, receipt_footer, is_active, pos_type (native|external)
users: id, organisation_id (FK), name, email, password (bcrypt-12), role (enum), locale, two_factor_enabled, passkey_credential (json), last_login_at
products: id, organisation_id (FK), category_id (FK), name_nl, name_en, barcode (indexed), price (DECIMAL 12,2 SRD), btw_rate (DECIMAL 5,2), btw_exempt (bool), stock_qty, embedding (vector 1536 pgvector)
sales: id, store_id (FK), cashier_id (FK), customer_id (FK nullable), sale_number, subtotal_srd, discount_srd, btw_srd, total_srd, payment_method (cash|card|mixed), status (completed|voided|held), source (pos|api|import), exchange_rate_used, occurred_at (timestamptz AST)
sale_items: id, sale_id (FK), product_id (FK nullable), product_name_snapshot, unit_price_srd, quantity (DECIMAL 10,3), discount_srd, discount_pct, btw_rate, btw_srd, line_total_srd
customers: id, organisation_id (FK), name (encrypted), phone (encrypted), email (encrypted), id_number (encrypted WBP-S), total_spend_srd, visit_count
audit_logs: id (bigint auto), user_id (FK), organisation_id (FK), event, auditable_type (morphs), auditable_id, old_values (jsonb), new_values (jsonb), ip_address (inet), created_at (immutable timestamptz)
daily_rates: id, date (unique), usd_to_srd (DECIMAL 10,4), raw_rate, markup_pct, source (api|manual), locked_by (FK users nullable), locked_at
api_integrations: id, store_id (FK), pos_system, api_key_hash, webhook_url, webhook_events (jsonb), last_ping_at, is_active

---

## SECURITY ARCHITECTURE (6 LAYERS)

Layer 1 — Identity & Access Control:
- bcrypt cost factor 12 (250ms per brute-force attempt — 10,000 passwords takes 40+ minutes per attacker machine)
- Passkeys (Laravel 13 Fortify) for Super Admin and govt accounts — hardware key or biometrics
- 2FA TOTP (Google/Microsoft Authenticator) — mandatory for Super Admin and all government accounts, cannot be disabled at policy level
- 6 RBAC roles, access denied by default at API level (not just hidden in UI)
- Government data isolated at database query level — not filtered after retrieval
- Session timeout: 15 min POS, 60 min dashboard. Forced logout on role change across all devices within seconds
- Single-device enforcement optional for government accounts
- Geo-alert for government accounts: login from outside Suriname triggers alert (not block)

Layer 2 — Data Encryption:
- AES-256 at rest (full disk + all backup files)
- Field-level encryption for customer personal data (separate application-layer key)
- TLS 1.3 for all transit, older versions explicitly disabled, HSTS configured
- 3-2-1 backup rule, monthly tested restores with verification report
- PostgreSQL WAL — point-in-time recovery to any minute in AST

Layer 3 — Application Security:
- SQL injection structurally impossible (Eloquent ORM parameterised queries only)
- XSS: React auto-escaping + Content Security Policy headers
- CSRF: Laravel default enforcement on all state-changing requests
- Rate limiting: 5 failed logins = 15 min lockout + email alert, 10 = full lock until admin unlock
- API throttle: 1,000 calls/minute per API key
- Progressive login delays (1s, 2s, 4s, 8s...)
- Immutable audit log: append-only, database-level write protection, no user can delete/modify

Layer 4 — Infrastructure:
- Port 443 only open to internet. Port 80 redirects to 443
- SSH: key-only auth, non-standard port, IP whitelist
- Database container has no internet access — isolated Docker private network
- Dutch-language network setup guide provided for local installs

Layer 5 — Suriname Compliance & Certifications:
- Day one: SSL/TLS certificate (Let's Encrypt or DigiCert)
- At launch: OWASP Top 10 compliance report (written, signed, delivered)
- Post-launch: independent penetration test recommended ($2,000–$4,000 USD)
- WBP-S (Wet Bescherming Persoonsgegevens Suriname) full compliance
- Verwerkersovereenkomst in Dutch (Data Processing Agreement) for government clients
- Belastingdienst Suriname: BTW reports in correct format
- Rekenkamer van Suriname: immutable audit export (signed PDF + CSV)
- ISO 27001: built to all 93 controls from day one, formal audit when scale justifies

Layer 6 — Government Department Specific:
- Segregation of duties: no single user creates + approves refunds. Dual approval above configurable SRD threshold
- Digital signatures on exported reports (organisation certificate)
- Rekenkamer-ready audit export format
- Government data in completely isolated database — never on same DB as commercial clients
- Mandatory non-bypassable 2FA for all government users
- Dutch-language incident response plan delivered as physical binder + digital document

---

## SDLC METHODOLOGY

Hybrid approach: Agile sprints for UI and user-facing features (2-week sprints, client sees working software regularly). V-Model gates for critical financial components: BTW engine, audit log, security architecture, API contracts — formal test specification written before code, formal sign-off before shipping.

Testing layers:
1. Unit tests — every BTW calculation, every SRD rounding function, every discount rule. 50+ BTW accuracy scenarios against Belastingdienst requirements. Laravel PHPUnit (backend) + Vitest (frontend).
2. Integration tests — every API endpoint, correct response shape, auth enforcement, DB state. Run on every commit via GitHub Actions. Blocks merge if any test fails.
3. Security tests — OWASP Top 10 before launch. Written compliance report delivered.
4. UAT — client tests on staging with formal checklist. Staging seeded with 200+ Surinamese products and realistic historical sales. Nothing ships to production without client sign-off.
5. Performance tests — 10 concurrent POS terminals, 1,000 transactions/day/store, 50 stores syncing simultaneously. No query >200ms under full load.

---

## AI FEATURES

v1 — Ship at launch:
- Smart product search: pgvector semantic search across Dutch/English product names, handles typos
- Fraud & anomaly detection: queued job after every sale, flags unusual voids/discounts/off-hours activity, alerts manager in Dutch or English
- Weekly AI sales summary: plain-language Monday morning summary per store in manager's language ("Verkoop was 8% lager dan vorige week...")
- Auto product categorisation: AI suggests correct category and BTW rate when manager adds new product

Phase 2 — 3–6 months post-launch:
- Natural language reports: manager types "Toon me de top 10 producten van vorige maand", AI queries DB and returns chart
- Stock reorder prediction: sales velocity analysis, alerts 3 days before stockout
- Invoice OCR: photograph supplier invoice, AI extracts products and creates stock entries
- Smart promotion suggestions: identifies slow-moving products, suggests timed discounts

Future SaaS scale:
- Voice-activated POS (Dutch + Sranantongo)
- Network supplier price benchmarking
- Auto BTW declaration draft for Belastingdienst Suriname

---

## PROJECT PHASES & TIMELINE

Phase 1 — Discovery & Architecture (Weeks 1–2): 112 hours
Requirements confirmation, database schema, API contracts, security architecture, Electron structure, multi-tenancy model, Laravel 13 + React 19.2 project scaffolds, Docker Compose, CI/CD. Sign-off required before Phase 2.

Phase 2 — POS System Build (Weeks 3–7): 440 hours
Full POS system, BTW engine + 50+ unit tests, barcode scanner, Electron packaging, ESC/POS printer, Dutch/English i18n, daily rate lock, receipt generation, store reports, IonCube integration, license check middleware. Sign-off required before Phase 3.

Phase 3 — Super Admin Dashboard + API (Weeks 8–13): 572 hours
Multi-tenancy, Reverb WebSocket, consolidated reports, BTW/Rekenkamer reports, Z-Report/End of Day, five-layer sync fallback including USB export, open integration API + webhooks + OpenAPI docs, license server app, renewal enforcement, AI features v1, pgvector embeddings. Sign-off required before Phase 4.

Phase 4 — Integration, UAT & Go-Live (Weeks 14–18): 324 hours
End-to-end testing, OWASP security testing + report, load testing, IonCube encoding, Electron code signing, staging seeding, client UAT, WBP-S documentation, first store go-live (on-site), staff training (cashiers + managers), 30-day post-launch monitoring.

Total development hours: 1,448 (808 backend / 640 frontend)
Total team capacity: 2,880 hours across 18 weeks — 50% buffer for code review, meetings, rework, and unexpected complexity.

---

## SURINAME-SPECIFIC CONTEXT

- SRD floats freely since June 2021 — Central Bank no longer sets fixed rate
- BTW currently 10%, some products exempt (basic foods, medicine)
- Belastingdienst Suriname = Tax Authority (BTW filings)
- Rekenkamer van Suriname = Court of Audit (government financial accountability)
- WBP-S = Wet Bescherming Persoonsgegevens Suriname (personal data protection law)
- Verwerkersovereenkomst = Data Processing Agreement (required for government clients under WBP-S)
- AST = Atlantic Standard Time (America/Paramaribo, UTC-3) — all timestamps
- Internet reliability varies: stable in Paramaribo, intermittent in Nickerie/Marowijne, unreliable in interior
- Common receipt printer in market: EPSON TM-T20 and compatible ESC/POS
- Mobile carriers: Digicel, Telesur (4G USB dongle fallback for interior stores)
- ExchangeRate-API supports SRD. Frankfurter (ECB) does NOT support SRD — do not use it.
- Hardware fingerprinting in license system uses MAC address + CPU ID + installation UUID

---

## DELIVERABLES COMPLETED IN PLANNING PHASE

The following have already been designed and documented by the senior developer:

1. Full project proposal document (HTML, 17 sections) — covers all features, tech stack comparison (Laravel vs Node vs Python vs Spring Boot across 16 factors), Electron deployment, Z-Report and sync strategy, five-layer offline fallback, user hierarchy, SDLC comparison, security architecture, Suriname compliance certifications, code protection and licensing with renewal timeline, and man hours breakdown

2. Interactive architecture document (HTML, 6 tabs) — system overview, full tech stack layers, entity relationship diagram, use case diagram for all 6 actors, data flow diagrams (POS sale, external API, live dashboard, BTW report), AI integration map

3. Working POS POC (HTML) — fully functional POS prototype with 26 Surinamese products, BTW engine, USB HID + camera barcode scanner, hold bills, discounts, cash numpad with change calculation, Dutch/English toggle, Z-Report view, today's sales, receipt generation, barcode label page, reports page

4. Exchange rate manager widget (HTML) — daily USD→SRD rate fetch, lock, manual override, 7-day history, quick converter (both directions), Laravel 13 implementation code

---

## YOUR ROLE

You are continuing this project. The planning phase is complete. Help the team with any of the following as requested:

- Generate or review Laravel 13 code (models, controllers, migrations, policies, jobs, commands)
- Generate or review React 19.2 + TypeScript components (POS screens, dashboard, forms)
- Generate or review Electron main process code and packaging configuration
- Design or review specific features in detail
- Generate test cases (PHPUnit, Vitest)
- Help with Docker Compose configuration
- Help with IonCube integration and license server architecture
- Help with specific AI feature implementation using Laravel AI SDK
- Generate additional proposal sections or update existing ones
- Answer questions about architecture decisions made during planning
- Help with any Suriname-specific compliance documentation

Always maintain context from this full brief. Always use Laravel 13 patterns, React 19.2 APIs, and the specific tech choices listed above. Always use SRD currency, Dutch/English bilingual output, BTW-correct calculations, and AST timezone.

What would you like to work on?