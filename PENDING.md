# PENDING — open points, decisions & backlog

> INTERNAL (srcExcluded; served only behind the password on /internal/).
> The single list of everything that is not done yet and who it waits on.
> Update in the same commit as whatever resolves a row. Last: 2026-07-19.

## 1. Waiting on Sagar / the client (accounts & decisions)

| Item | Why it waits | Unblocks |
|---|---|---|
| **DigitalOcean firewall** — inbound TCP 8080/8090/8091/8095/8443/6001 | Panel access only | Public URLs reachable without VPN tricks |
| **Domain name decision** | Purchase + DNS are yours | HTTPS/HSTS day, port-free URLs, camera scanning in browsers, cookie security |
| **SMTP credentials** (any transactional provider) | Your account | Receipt/welcome/BTW e-mails actually deliver |
| **OpenAI billing credits** | Your platform.openai.com account | Anomaly detection, weekly AI summaries, then pgvector embeddings |
| **Error-tracking account** (Sentry free tier is fine) | Your sign-up → DSN | Alerting when something breaks; wiring is minutes once the DSN exists |
| **Code-signing certificate — yes/no** | Budget decision (~$100–400/yr) | No SmartScreen warning on the POS installer for partner-performed installs |
| **Off-site backup bucket** (DO Spaces/S3) | Your account | Automated 3rd copy via the `OFFSITE_CMD` hook (today: laptop pulls) |
| **On-site visit date** | Travel planning | Playbook Phase 2 (hardware day, edge-case script, training) |
| **Uni5Pay+ merchant-API access** — email UPPS / Southern Commercial Bank | Partner-driven onboarding, no self-serve portal | Dynamic per-transaction QR at the till (code slot ready, feature-flagged) |

## 2. Prod-split day (one working session, when the domain exists)

Fresh droplet → HTTPS + HSTS → deploy licence server + issue pilot licence →
IonCube encoding decision → run `k6 run -e BASE=… scripts/load-test.js` for
the contract ≤200 ms p95 figure → rotate every seeded password → wire Sentry
DSN → detach from the shared `ams_*` box. (Checklist detail: deployment
playbook ch 14, Phase 1.)

## 3. Dev backlog (mine, scheduled)

| Item | Size | Notes |
|---|---|---|
| Passkeys for Super Admin / government accounts | 2–3 d | Spec'd (Fortify; users.passkey_credential column exists) |
| Customer detail view: purchase history + statement export | 1–2 d | User parked it earlier ("will check later") |
| Server-side caching for heavy report endpoints | 1 d | Redis, short TTL — dashboard snappiness at 50 stores |
| D1: per-store sale-number sequence | ½ d | Numbering semantics change — do together with a Z-report review |
| D3: refund discount handling · D5: discount combine rules | ½ d | Edge-case correctness from the June audit |
| pgvector embeddings + semantic product search | 1 d | Blocked on OpenAI credits (row above) |
| Runtime-configurable server URL in the POS desktop app | 1 d | Today the API address is baked at build time (`VITE_API_URL`) — the field runbook works around it with the standard store-server IP convention; a first-launch "server address" screen would remove the rebuild-per-IP case entirely |
| Loyalty / spaarpunten | design first | Not committed |

## 4. Decisions needed before the first government client

| Decision | Options |
|---|---|
| **Government data isolation model** | The proposal says "completely isolated database"; the implementation is single-DB with strict org scoping (stancl/tenancy installed but never activated). Either activate DB-per-tenant for govt orgs (1–2 wks) or align the contract wording with the client. |
| **`*_srd` money-column naming if a non-SRD market ever signs** | Keep (labels driven by `organisations.currency`) vs schema rename (churn). Decision only needed at that point. |

## 5. Standing reminders

- Scale barcode layout must be verified against the client's REAL scale
  before enabling (silent mis-pricing risk).
- Demo passwords are public in the repo README — never reuse them on any
  production stack (rotation is a go-live gate).
- VitePress `srcExclude` guards the public docs site — any new internal
  root-level `.md` must be added there (HANDOVER, PENDING, AUDIT_FINDINGS,
  CLAUDE* are covered).
