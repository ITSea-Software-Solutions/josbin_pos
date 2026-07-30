# Migration kickoff — start a new session from here

Internal. Not published — excluded from the docs site.

Paste this file (or point at it) at the start of a new thread. It carries
everything decided about splitting Josbin POS into three nodes, so the new
session begins with the conclusions rather than re-deriving them.

---

## 1. Read these first, in this order

| | Where | What it is |
|---|---|---|
| Plan, ch 19–25 | `migration-architecture-plan/` · live at `http://142.93.88.143:8095/migration-architecture-plan` | The whole target architecture, decisions, and build list |
| `CLAUDE_WORKING_GUIDE.md` | repo root | How we work — surfaces checklist §2, journeys §3, gotcha registry §4 (now through G-058) |
| `FEATURES_AND_FLOWS.md` | repo root | 220 catalogued features with status. The disposition table in ch 21 is generated from it |
| `HANDOVER.md` | repo root | Live infra, ports, secret locations (names only), standing rules |

The seven plan chapters:

- **19 — Three-node architecture.** Target shape, the four wires, offline licence verification.
- **20 — Split build plan.** Freeze list, nine critical journeys (five must not change), seven steps with a gate each.
- **21 — Migration record.** Decisions D1–D6 with reasoning, two boundary diagrams, all 220 features dispositioned.
- **22 — Authentication & security.** Two keypairs, payload signing, the tax wire, what a stolen disk gets you.
- **23 — Installs & artifacts.** What a customer receives, three shop shapes, the standalone Android node.
- **24 — Release engineering, operations & compliance.** CI releases, update channel, contract tests, migrations, RTO/RPO, what compliance docs must become.
- **25 — Deployment topologies.** The six shapes a shop can be sold (T1–T6), a connection diagram each, which sell offline, relay-vs-re-sign, and the transitions between them.

---

## 2. The decisions, in one paragraph each

**D1 — One node per shop, schema unchanged.** One shop, one database, one node;
cashiers are logins on it. But `organisation_id` and `store_id` **stay** in the
schema with one row each — they thread through 65 migrations and most shipped
features, and removing them would break the freeze list for tidiness. Collapse the
deployment, not the schema.

**D2 — Degrade, don't lock out.** An expired, long-offline node goes read-only:
reports, exports and BTW filings keep working, only new sales stop. Plus source
escrow with a Paramaribo agent for the government deal. A perpetual token is the
same signed token with no expiry, sold deliberately — not a rescue procedure.

**D3 — We host the tax node, genuinely separately.** Own database instance, own
deployment, no network route from the commercial stack. This makes us a **WBP-S
data processor for the Belastingdienst** — maintenance access must be named,
logged and time-boxed.

**D4 — BTW filed direct, shop-signed.** Shop → tax node. Only a receipt comes back
to control: filed y/n, reference, timestamp, **no amounts**. We operate the machine
without sitting in the chain of custody.

**D5 — Layer 3 lives in the control plane.** Layer 3 is a *third party's* POS
pushing sales in — not the shop LAN. Putting it in control removes code from the
offline node and gives integrators one endpoint instead of one per shop.

**D6 — One control database + per-shop encrypted archives.** Not database-per-org.
The shop is the system of record; control holds rollups (megabytes a year for 200
shops) and object storage holds per-shop encrypted dumps we cannot read. Archive
key escrowed in control, **separately from the archive store**, every use logged.

Later decisions, in ch 23–25: one repo; images not repos to customers; one Android
APK with two modes; native Kotlin node with the React UI over the bridge;
standalone is single-till and licence-enforced; six deployment topologies of which
**T1/T2 (cloud-hosted node) cannot sell offline** and must not go to the interior;
our cloud may relay a filing but must never re-sign it.

---

## 3. Where the work actually stands

**Nothing is built.** The plan is written and deployed; not one line of the split
exists. Steps 1–3 of ch 20 are pure refactor and safe to start.

**Blockers before step 1:**

1. **N16 — there is no working test path.** `phpunit.xml` forces `DB_HOST=postgres`
   so the suite won't boot locally, and the production container has no test runner
   (`--no-dev` strips PHPUnit). Step 1's gate is *"full suite green, no test
   edited"*, which currently cannot be proven anywhere.
2. **N29/N30 — BTW drift already in the shipped product.** `cartStore.ts`
   implements discount-then-BTW in TypeScript (JS floats, `Math.min`, 24 vitest)
   alongside `BtwCalculationService` (bcmath strings, 56 PHPUnit). Never tested
   against each other. Harmless today only because the backend recomputes and
   wins; fatal in standalone mode where the on-device number *is* the books.
3. **N37/N38 — releases are built on a laptop.** CI runs tests and produces no
   artifacts. This already shipped a stale APK once (G-054).

Recommended order: fix 1, 2 and 3 **before** step 1. Each fixes something already
wrong, independent of the split.

---

## 4. Repo and branching — settled

- **One repo.** Not three. Three copies of the BTW engine is the failure mode ch 20
  exists to prevent.
- **No long-lived split branch.** Steps 1–3 are behaviour-preserving by design, so
  they land on main in sequence, one short-lived branch per step, CI green to merge.
- Step 4+ hides behind the node profile (`JOSBIN_NODE`), defaulting to `all`.
- **Rename-only commits** — never move and edit a file in the same commit.
- Tag `pre-split` at 1.8.0 before step 1.
- Today the team commits straight to main (0 merge commits in the last 50). For
  this work, branch per step.

---

## 5. What to discuss in the new thread

Open, and worth deciding before code:

1. **Do we start with the three pre-work items** (N16 test path, N29/N30 BTW
   vectors, N37/N38 CI releases), or go straight at step 1?
2. **RTO/RPO numbers** in §24.5 are proposed, not agreed. They belong in a contract.
3. **Standalone Android** is the largest item in the plan and needs Kotlin
   capability the team does not currently have — hire, train, or defer?
4. **Registry choice** for signed images (ghcr.io is the pragmatic default given
   GitHub Actions is already in use).
5. **Tax node hosting terms** with the Belastingdienst — D3 says we host, but the
   processor agreement does not exist yet.
6. Longstanding, unrelated to the split: Super Admin privacy / break-glass access
   never approved; recovery codes are decorative (validated `size:6`, never checked
   against stored codes); SMTP credentials, Windows code-signing cert, LAN card and
   domain are all user-gated.

---

## 6. Standing constraints — carry these into any session

- **Never echo git tokens.** Pipe through `sed -E 's#(ghp_|github_pat_)[A-Za-z0-9_]+#***#g'`.
- **Client-facing docs never mention** the AI development process, internal task
  numbers, or gotcha IDs. The client's customers must not know it is AI-built.
  Product-runtime AI mentions are fine.
- **Secrets** live only in the droplet's `backend/.env` + root `.env` and the
  password manager. Never committed, never printed.
- **Push to origin BEFORE server-side deploy.**
- Internal portal login is team-only.
- The droplet is `142.93.88.143` — API 8080, dashboard 8090, POS web 8091, docs 8095.
- Commit messages with quotes/`**` must be passed via `-F <file>`, not `-m` — shell
  quoting has silently swallowed three commits in one session.

---

## 7. The number that matters

Of 220 catalogued features: 97 move cleanly to the shop, 16 stay in control, 12 are
Belastingdienst-facing, 18 need a copy in every node, 7 are dropped (the AI layer).

**70 split across two nodes.** That is where behaviour goes missing, because each
side assumes the other kept it. Twelve of those are in BTW filing, where being
wrong is a compliance finding rather than a bug report.
