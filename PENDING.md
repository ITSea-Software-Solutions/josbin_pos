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
| **Uni5Pay+ merchant-API access** — email UPPS / Southern Commercial Bank. **Draft ready in `PARTNER_OUTREACH.md` §1 (EN+NL) — review & send** | Partner-driven onboarding, no self-serve portal; sending is yours (pick recipient + sender address per the checklist) | Dynamic per-transaction QR at the till (code slot ready, feature-flagged) |
| **Gov-DB wording conversation with the client** — before the first government tender. Talking points ready in `PARTNER_OUTREACH.md` §2 | Proposal says "completely isolated database"; build is single-cluster with org-scoped queries (§4 decision row) — client must renegotiate wording or commission DB-per-tenant | Contract wording matches the system before any tender reviewer or auditor finds the gap |
| **Licence agreement / EULA — draft before first customer install.** The technical protection (IonCube, fingerprint licensing, kill-switch) is built, but no legal document exists that the customer signs. Needs: licensed-not-sold clause, no reverse-engineering/redistribution, per-store+terminal counts, renewal/soft-lock terms mirroring the built enforcement, audit clause; NL primary. Ask the developer to draft the working template, then have a Surinamese lawyer review before signature. | — | user-gated |

## 2. Prod-split day (one working session, when the domain exists)

Fresh droplet → HTTPS + HSTS → deploy licence server + issue pilot licence →
IonCube encoding decision → run `k6 run -e BASE=… scripts/load-test.js` for
the contract ≤200 ms p95 figure → rotate every seeded password → wire Sentry
DSN → detach from the shared `ams_*` box. **New since passkeys shipped:** set
`PASSKEYS_RP_ID=<domain>` and `PASSKEYS_ALLOWED_ORIGINS=https://<dashboard-origin>`
in the backend .env — passkeys need HTTPS + a real domain, so prod-split day
is exactly when the "Sign in with a passkey" button starts appearing.
(Checklist detail: deployment playbook ch 14, Phase 1.)

## 3. Dev backlog (mine, scheduled)

| Item | Size | Notes |
|---|---|---|
| ~~Passkeys for Super Admin / government accounts~~ | done | **Shipped 2026-07-19** — WebAuthn register (My Account) + passwordless login, e2e-proven with a virtual authenticator; lights up for real users on prod-split day (HTTPS + domain, §2) |
| Customer detail view: purchase history + statement export | 1–2 d | User parked it earlier ("will check later") |
| Server-side caching for heavy report endpoints | 1 d | Redis, short TTL — dashboard snappiness at 50 stores |
| D1: per-store sale-number sequence | ½ d | Numbering semantics change — do together with a Z-report review |
| D3: refund discount handling · D5: discount combine rules | ½ d | Edge-case correctness from the June audit |
| pgvector embeddings + semantic product search | 1 d | Blocked on OpenAI credits (row above) |
| ~~Runtime-configurable server URL in the POS desktop app~~ | done | **Shipped 2026-07-19** — "⚙ Server" on the login screen + Settings → System (manager+): test /health, save & restart, reset to default. A wrong baked IP is now a 30-second on-site fix |
| Loyalty / spaarpunten | design first | Not committed |
| Sranantongo native-speaker review | ½ d with a native | Draft srn.json shipped 2026-07-19 (390 keys); the 15 least-certain keys are listed in the generation notes — have a Paramaribo native walk the POS in srn before advertising the language |


## 3b. Watch list — strategic, no code scheduled

| Item | Trigger to act | Where it stands |
|---|---|---|
| Uni5Pay+ / UPPS as a *channel* (partner listing, dynamic-QR API) | Client sends the drafted email (§1) and UPPS replies | Draft ready in `PARTNER_OUTREACH.md` §1 — the send is the whole next step |
| Guyana expansion (second market) | Client decides to pilot via the partner's network | Technical enabler shipped (org-configurable payment pick-lists; MMG/Caripay/Kanoo research in `progress/research-regional-payments-2026-07.md`); GYD multi-currency would be the first real build item |
| BTW e-invoicing mandate in Suriname | Any Belastingdienst announcement of e-invoicing / e-reporting | Nothing to build yet — but if it lands, "the POS that already files correctly" becomes the pitch; check for news each visit/quarter |
| Aggregated market intelligence (consented, category-level, cross-store) | Deliberately parked — revisit only at real SaaS scale, WBP-S counsel first | Long-term prize; do NOT start without a privacy design + client consent framework |

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
