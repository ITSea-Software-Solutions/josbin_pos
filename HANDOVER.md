# HANDOVER — continuity, access & current-state map

> **Purpose:** everything needed to continue this project from a **fresh
> machine, fresh Claude account, or a new developer** — the knowledge that is
> NOT derivable from the code itself. The git repo *is* the software and most
> of the documentation; this file is the map of what lives around it: live
> infrastructure, access dependencies, secret locations (never values), and
> the current status snapshot.
>
> INTERNAL — this file is in the docs-site `srcExclude` list and must never
> be published to the client docs site (same rule as `CLAUDE*.md`).

**Last verified:** 2026-07-18 (container list checked live via `docker ps`).

---

## 1. Bootstrap on a new machine (10 minutes)

1. `git clone https://github.com/ITSea-Software-Solutions/josbin_pos.git`
   (private repo, org **ITSea-Software-Solutions** — any GitHub account with
   repo access works; nothing is tied to one laptop's token).
2. Open Claude Code in the repo root → `CLAUDE.md` auto-loads (product spec),
   then read `CLAUDE_WORKING_GUIDE.md` (how we work, gotcha registry),
   `FEATURES_AND_FLOWS.md` (what exists), and this file (where it runs).
3. `cp deploy.env.example deploy.env` — the example ships the **real values
   of the current test droplet**, so for the existing server no editing is
   needed.
4. Add your SSH public key to the droplet (see §3 — this is the one true
   physical dependency).
5. Local dev: `bash scripts/dev.sh up` (demo stack on :8082 with seeded
   logins — table in `README.md`). Deploy: `bash scripts/deploy-server.sh`
   — **never** a bare `vite build` (G-032: SPA builds bake `VITE_*` URLs at
   build time).

## 2. Live infrastructure

One DigitalOcean droplet, IP **142.93.88.143**, repo cloned at
`/var/www/html`, run by `docker compose -f docker-compose.yml
-f docker-compose.prod.yml -f docker-compose.frontends.yml`
(project `josbin_pos`):

| Service | Container | Public port |
|---|---|---|
| Backend API (nginx → PHP-FPM) | `josbin_pos_nginx` / `_app` | **8080** |
| Super Admin dashboard | `josbin_dashboard_web` | **8090** |
| Dashboard over TLS (self-signed) | `josbin_dashboard_tls` | **8443** |
| POS web app | `josbin_pos_web` | **8091** |
| Docs site (manuals + marketing pages) | `josbin_docs_web` | **8095** |
| Reverb WebSocket | `josbin_pos_reverb` | **6001** |
| PostgreSQL 16 / PgBouncer / Redis 7 | `_postgres` / `_pgbouncer` / `_redis` | internal only |
| Horizon (queues: `default` + `ai`) / Scheduler | `_horizon` / `_scheduler` | internal only |

Facts that bite if forgotten:

- **Ports 80/443 on this droplet belong to a DIFFERENT project** (`ams_*`
  containers — unrelated client app). The production domain plan (playbook
  `docs/14-client-deployment-playbook.md` Phase 1) therefore means either a
  fresh production droplet (recommended) or routing subdomains through the
  existing `ams_nginx`.
- **DigitalOcean Cloud Firewall** currently blocks the 8xxx/8443 ports from
  the public internet intermittently (SSH + 80 pass, localhost fine). Fix is
  in the DO panel (inbound TCP 8080/8090/8091/8095/8443/6001) — panel access
  only, no API token on file.
- **The three stacks (live / demo / sandbox) are LOCAL-dev concepts** of
  `scripts/dev.sh` (`-p josbin_pos` :8080, `-p josbin_demo` :8082,
  `-p josbin_sandbox` :8091). The droplet runs only the live stack. Any
  migration/seeder/env change must be applied to every stack currently up
  (standing rule — see §6).
- **The license server (`license-server/`) is NOT deployed yet** — the app is
  complete in-repo with its own compose file, but no container runs anywhere.
  Deploying it + issuing the pilot licence is a Phase-1 playbook item.
- No domain, no public TLS yet — IP + ports only. Docs/marketing links shared
  with the client use `http://142.93.88.143:8095/…`.

## 3. What git does NOT carry — back these up

The repo makes code + docs portable. These five things live outside git; if
this laptop dies, these are what you'd actually lose:

| # | Item | Lives where today | How to make it laptop-independent |
|---|---|---|---|
| 1 | **SSH private key** for `root@142.93.88.143` | `~/.ssh/` on this laptop | Add a 2nd key from any machine: `ssh-copy-id root@142.93.88.143` (needs an existing session), or paste the new pubkey into `~/.ssh/authorized_keys` via the DO console. Keep a copy in the password manager. |
| 2 | **Droplet `backend/.env`** (all runtime secrets, incl. `APP_KEY`) | `/var/www/html/backend/.env` on the droplet only | `ssh root@142.93.88.143 'cat /var/www/html/backend/.env'` → store the output in the password manager. **`APP_KEY` is critical**: it encrypts customer PII fields; losing it makes that data unrecoverable. |
| 3 | **GitHub access** | Personal token baked into this laptop's git remote | Repo is under the org — grant collaborators / issue a new token from any account with access. Never commit or echo tokens. |
| 4 | **DigitalOcean account** | User's DO login (firewall, console, snapshots) | Already account-based, not laptop-based. Enable droplet backups/snapshots in the panel. |
| 5 | **`deploy.env`** | Repo root, gitignored | Recreatable in seconds from `deploy.env.example` (which contains the real test-droplet values). |

(Claude's local session memory is a sixth item, but as of 2026-07-18 its
content is mirrored into this file + `CLAUDE_WORKING_GUIDE.md`, so it is
convenience, not a dependency.)

## 4. Secrets inventory (names + where — values NEVER in git)

All in droplet `/var/www/html/backend/.env` unless noted. After editing:
`docker compose … exec app php artisan config:cache` (and bounce `horizon`
if queued classes read it — G-026).

| Env var | Purpose | Reissue / notes |
|---|---|---|
| `APP_KEY` | Laravel crypt — **encrypts customer PII fields** | Cannot be reissued without losing encrypted data. Back it up (§3.2). |
| `DB_PASSWORD` | PostgreSQL | Rotate via compose env + `ALTER ROLE`. |
| `EXCHANGERATE_API_KEY` | Daily USD→SRD rate (v6.exchangerate-api.com) | User's exchangerate-api.com account (set 2026-07-17, working). |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AI features (weekly summary, anomaly detection, categorisation) | User's platform.openai.com account. Model pinned `gpt-4o-2024-11-20`. **Account has no billing credits yet → API returns 429 and AI features silently skip** (by design, `AiService::isConfigured`). |
| `MAIL_*` | Outbound email (receipts, welcome, BTW notifications) | **Not configured** — email is wired but does not deliver; the in-app bell is the source of truth. Any transactional SMTP provider works. |
| `REVERB_APP_KEY` etc. | WebSocket auth | Semi-public (baked into SPA bundles); regenerate + redeploy SPAs together. |
| License-server `.env` | (when deployed) its own APP_KEY + DB + signing keys | Not yet live — create at deploy time, then add to the §3.2 backup. |

## 5. Status snapshot — 2026-07-18

*(Snapshot only. The living record is `FEATURES_AND_FLOWS.md` + the
changelog in `CLAUDE_WORKING_GUIDE.md` §10. `BUILD_STATUS.md` is historical,
frozen at 2026-05-25.)*

**Where the build stands:** Phases 1–3 functionally complete and deployed to
the test droplet; Phase-4 hardening in progress. Recent highlights: 7 payment
methods incl. Mopé/Uni5Pay+ static-QR wallets (per-store QR upload + on-screen
display + attestation/pending-confirmation flow) and 3-mode card terminals
(manual / simulated / ECR-ready); PDF report exports fixed + pinned by tests;
full docs site (EN+NL manuals, dev docs, deployment playbook ch 14, visual
card-payments guide); navy/orange rebrand; marketing promo/teaser/videos
pages; exchange-rate + OpenAI keys wired. 2026-07-18: dependency
freshness/security sweep (Laravel 13.20, Electron 41.7, 0 npm vulns in both
SPAs, spatie/permission 8 deliberately held) + hardware-compatibility batch
(CP858 thermal encoding, 58 mm paper, widened scanner symbologies, POS
camera scanner, install-guide §F0 device matrix).

**Blocked on the user (deployment gating list):**

| Item | Why it waits |
|---|---|
| DO firewall inbound rules for 8080/8090/8091/8095/8443/6001 | Panel access only — public URLs unreachable until then |
| OpenAI billing credits | 429 on every call; AI features skip until funded |
| SMTP credentials | No email delivery until set |
| Domain name decision | Then: prod droplet (or subdomain routing past `ams_*`), Let's Encrypt, port-free URLs |
| Code-signing certificate (yes/no) | Unsigned `.exe` shows SmartScreen warning |
| On-site visit date | Triggers the playbook Phase-2 rehearsal + travel kit |

**Deferred dev backlog:** task #126 `DailyRateService` updateOrCreate race on
first-sale-of-day; #127 = D1 per-store sale_number sequence, D3 refund
discount handling, D5 discount combine; customer purchase-history/detail view
+ statement export; loyalty; pgvector product embeddings (semantic search);
ECR terminal integration (waiting on a Surinamese bank exposing a protocol);
PSP QR webhook (stub exists behind a flag).

**Go-live caveat:** the droplet still uses the seeded demo passwords
(`README.md` table). Rotate the Super Admin password before any real client
data exists.

## 6. Standing working rules (user-given, permanent)

Full reasoning in `CLAUDE_WORKING_GUIDE.md`; the short list:

1. **No internal/AI references in anything client-facing** (manuals, docs/,
   help, marketing, EN+NL): never mention `CLAUDE*`, `FEATURES_AND_FLOWS`,
   gotcha IDs, task numbers, or the AI-assisted process. Product-runtime AI
   (AI-insights chapter, Anthropic as subprocessor in the
   Verwerkersovereenkomst) is fine. Sweep before shipping:
   `grep -rniE "CLAUDE|G-0[0-9]{2}|WORKING_GUIDE|FEATURES_AND_FLOWS|task #[0-9]" user_manual nl/user_manual dashboard_manual nl/dashboard_manual docs nl/docs`
2. **Docs in sync, same commit** — README / BUILD_STATUS-successors / install
   guide / manual chapter / VitePress sidebar move together with the change.
3. **Smoke-test before "done"** — apply migrations/seeders/env to every
   running stack; walk the actual UI as the affected role; phrase results as
   "fixed, please verify".
4. **Brand palette** — navy `#293371` + orange `#EF6C00` (from the Josbin
   logo). Never reintroduce the old violet `#7c3aed`. Belastingdienst
   inspector theme stays official green/gold. Marketing dark pages use blue
   `#1f9bde` + orange.
5. **Deploy only via `scripts/deploy-server.sh`** (env-baked SPA builds,
   health checks). Bounce the `horizon` container whenever queued classes or
   config change.
6. **Never echo secrets/tokens** into chat, logs, or commits (git remote URLs
   through `sed -E 's#ghp_[A-Za-z0-9_]+#ghp_***#g'`).

## 7. Document precedence (who wins when they disagree)

1. `CLAUDE.md` — product spec (auto-loaded every session)
2. `HANDOVER.md` — this file: infra, access, current state
3. `CLAUDE_WORKING_GUIDE.md` — engineering discipline + gotcha registry §4
4. `FEATURES_AND_FLOWS.md` — living feature inventory + flows
5. `docs/` — dev docs (architecture, data model, install guide, playbook…)
6. `dashboard_manual/` + `user_manual/` (+ `nl/` mirrors) — **client-facing**
7. `BUILD_STATUS.md`, `AUDIT_FINDINGS_*.md` — historical records, frozen
