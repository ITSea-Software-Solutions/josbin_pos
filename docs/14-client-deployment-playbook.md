# 14 — Client Deployment Playbook

> The path from "works on our demo server" to "the partner sells and installs
> it at real stores". Companion to the step-by-step
> [Installation & Setup Guide](/docs/00-installation-and-setup) — that guide
> is *how to install one store*; this playbook is *how to run the whole
> rollout*: preparation, the on-site visit, and the repeatable kit the
> partner uses for every next customer.

## 1. The three deployment shapes

| Shape | What runs where | When |
|---|---|---|
| **Cloud-only** | Everything on one server; stores use it over the internet | Demos, evaluation, very small pilots with reliable internet |
| **Local + cloud sync** *(the product's real architecture)* | Per store: one back-office PC runs the Docker stack (Laravel + PostgreSQL + Redis); terminals talk to it over the LAN. The cloud runs the Super Admin dashboard, licence server and Belastingdienst portal; stores sync Z-reports and sales to it | Production stores — selling continues with **zero internet** |
| **Local-only** | The store stack without cloud sync configured | Single small shop, no head office |

All three come from the same codebase and the same compose files — the shape
is decided by configuration, not by builds.

## 2. Phase 1 — Preparation (before anyone travels)

| ✔ | Item | Notes |
|---|---|---|
| ☐ | **Production cloud split from demo** | fresh droplet/VM, clean `.env`, empty seed — the demo box stays a sandbox |
| ☐ | **Domain + HTTPS on 80/443** | reverse-proxy with subdomains (`beheer.…`, `docs.…`, `api.…`) + Let's Encrypt. Also eliminates the entire class of "VPN/firewall eats port 8090" support calls |
| ☐ | **Windows POS installer built & tested** | `cd frontend && npm run build:win` → `Josbin POS-…-Setup.exe`. Unsigned = SmartScreen warning (acceptable while the delivery team installs personally); a code-signing certificate removes it for partner-performed installs |
| ☐ | **SPA dists built with the right environment** | the dashboard/POS web bundles bake `VITE_*` values (API URL, WebSocket host, docs URL) **at build time** — always build via `scripts/deploy-server.sh` or after `set -a; source deploy.env; set +a`. A plain `vite build` produces localhost-flavoured bundles |
| ☐ | **Licence server live + pilot licence issued** | activate → validate → expiry/grace behaviour verified end-to-end (dashboard manual ch 15–16) |
| ☐ | **SMTP credentials configured** | receipts / welcome mails / BTW notifications stay silent without them; the in-app bell works regardless |
| ☐ | **Exchange-rate API key set** | `EXCHANGERATE_API_KEY` in the backend `.env`; daily lock at 06:00 AST + half-hourly self-heal take over from there |
| ☐ | **Backups on** | one cron line installs `scripts/backup.sh` (nightly dump + weekly base snapshot + WAL archiving = to-the-minute recovery); prove it with `scripts/backup-restore-test.sh` and pull the off-site copy via `scripts/pull-backup.sh` (guide Part I) |
| ☐ | **Load test on the production box** | `k6 run -e BASE=… scripts/load-test.js` — the ≤200 ms p95 budget must be measured on the real server, not a laptop |
| ☐ | **Seeded demo passwords rotated** | the README demo logins are public in the repo — rotate every account on the production stack before any real data exists |
| ☐ | **Offline USB install kit** | assume the store's internet is bad *during* install: Docker Desktop installer · pre-pulled images (`docker save` tarballs) · repo bundle + `.env` template · POS `Setup.exe` · printed Dutch install guide |
| ☐ | **Dress rehearsal on a clean Windows machine** | walk the Installation Guide start → finish as if on-site; fix every place it drifts. The single highest-value pre-trip step |
| ☐ | **IonCube encoding** | only when code lands on hardware the delivery team does not control; skip for a self-managed pilot |

## 3. Phase 2 — The on-site visit (4–5 days)

**Bring:** the USB kit, a spare barcode scanner, spare printer + RJ11 drawer
cable, a 4G dongle (Digicel/Telesur) for the sync fallback, and a UPS
recommendation for the server PC.

| Day | Focus |
|---|---|
| **1 — Install** | Server PC: stack up from USB, licence activated, organisation + store + users created, catalogue imported (their Excel → the importer). Terminals: `Setup.exe`, auto-start on boot, pointed at the local server. Wallet QRs uploaded, card-terminal mode = standalone. |
| **2 — Hardware, one device at a time** | EPSON TM-T20 test print (BTW layout + logo) · cash-drawer kick via printer · USB scanner on real shelf products (EAN-13 + Code 128) · **labelling scale: verify the embedded-barcode layout against their actual scale before enabling — a wrong layout silently mis-prices** · real Mopé/Uni5Pay+ sticker vs the on-screen QR · bank PIN terminal cashier flow + slip-copy. |
| **3 — Edge-case script** | Pull the network cable mid-sale → keep selling → watch sync layers 1–5 recover (incl. USB export/import) · kill the printer mid-receipt · two terminals selling the last unit of one product · refund + blind return · Z-report with cash in/out and a forced discrepancy · BTW filing → dispute → resubmit round-trip with the inspector account · licence-expiry banners (test licence expiring tomorrow). |
| **4 — Training + soft go-live** | Cashiers 15 min (use the simulated PIN terminal); manager: Z-report, pending payments, stock; owner: dashboard, reports, BTW. Then real sales with the delivery team shadowing. |
| **5 — Buffer + signed handover checklist** | Loose ends, printed cheat sheets, support contacts. |

## 4. Phase 3 — The partner's repeatable "new customer kit"

Every next store the partner sells follows the same five steps — no
developers involved:

1. **Create the Organisation** in the cloud dashboard (manual ch 2)
2. **Issue the licence** — tier = store + terminal count (ch 15–16)
3. **Hand over the install kit** — USB + printed guide (or perform the install)
4. **Walk the go-live checklist** — Parts A–H of the Installation Guide,
   including hardware tests and the first end-to-end sale
5. **Monthly routine** — licence renewals, backup check, docs site for help

Escalation path: printed cheat sheets → the in-app Help drawer → docs site
→ partner's support line → ITSea.

## 5. Go-live gate (all boxes, every store)

☐ Licence active and validated ☐ Today's exchange rate locked
☐ Test sale printed + emailed ☐ Drawer opens ☐ Scanner scans shelf product
☐ Scale layout verified on *their* scale (if used) ☐ Wallet QR shows on POS
☐ Offline pull-the-plug test passed ☐ Z-report closed + synced to HQ
☐ Backup ran last night **and this month's restore drill passed**
☐ Demo/seed passwords rotated ☐ Manager can reach the docs site
