# 24. Release engineering, operations and compliance

Chapter 23 says a customer receives a signed image. This chapter is how that image
comes to exist, how it reaches them safely, and what changes in the compliance
paperwork once there are three nodes instead of one.

It is the least glamorous chapter in the plan and the one whose absence is most
visible to a government buyer.

---

## 24.1 Releases are built by CI, not on a laptop

Four workflows run tests today. **Not one of them produces an artifact.** Every
`.exe`, every `.apk`, every deployed bundle is built on a developer machine and
pushed from there.

That has already cost a release. Version 1.7.0's APK shipped a stale web bundle
because a local build step failed silently and the packaging step carried on
regardless — the artifact looked fine, was signed, was installed, and contained
the previous version's screens.

```
   commit ──► CI ──► build ──► test ──► SBOM ──► sign ──► registry (by digest)
                                                            │
                                                            ├─► our droplet
                                                            ├─► registry pull, for shops with internet
                                                            └─► docker save → USB, for shops without
```

What changes:

- **Every artifact is built in CI**, from a tagged commit, or it is not a release.
- **An SBOM per release** (CycloneDX), attached to the release. Increasingly asked
  for in government procurement, and nearly free once the pipeline exists.
- **Provenance**: the build records which commit, which workflow run, which
  inputs. "Which code is this shop running" becomes answerable from a digest.
- **Artifact verification is a build step, not a habit.** The existing
  `verify-artifacts.sh` — which unzips the real `.apk`/`.asar` and greps for
  markers that must be present — becomes a required CI gate rather than something
  a person remembers to run after being burned once.

Also worth ending regardless of the split: bind-mounting source in production and
`git reset --hard` on the server both mean the running code is not a pinned,
reproducible artifact, and cannot be rolled back to precisely.

---

## 24.2 The update channel is an attack path

Nothing currently says how a shop node gets an update once it is behind someone's
counter. That is the highest-value target in the whole system: compromise it and
you reach every shop at once, with our name on the package.

- **Images signed** (cosign), **verified by the node before applying**. The
  verification must work from a file, so the USB path is not a bypass — the same
  property chapter 22 requires of payloads.
- **Pinned by digest, never by a floating tag.** `:latest` means "whatever the
  registry says today", which is exactly what an attacker wants it to mean.
- **Staged rollout**: our own droplet, then a pilot shop, then the fleet. With 200
  shops a bad release should reach one of them, not all of them.
- **A documented rollback for the application, and a forward-fix for the
  database.** You can put yesterday's image back; you cannot un-run a migration in
  the field. That asymmetry is why §24.4 exists.

---

## 24.3 The wires need their own tests

The split's characteristic failure is not a crash. It is control and shop quietly
disagreeing about what a payload means, six weeks apart, with no test that could
have noticed.

- **Golden payload fixtures per schema version**, stored with the contract in
  `domain/Contracts/`. One file per wire per version.
- **Both sides test against the fixtures**, not against each other's live code:
  the shop's builder must produce them, the control plane's ingest must accept
  them.
- **A version matrix in CI** that proves §19.6's promise: build N ingests
  fixtures from N, N−1 and N−2. That promise is currently prose, and prose does
  not fail a build.
- A fixture is **added before** the code that changes a payload, in the same way
  §24.7 wants a BTW vector added before a rate change.

This is the concrete reason the missing test path (N16) has to be fixed first. The
gate on step 1 is "suite green, no test edited" — and there is nowhere to run it.

---

## 24.4 Migrations: expand, then contract

Three databases upgrading on independent schedules, on machines we do not own,
with no realistic way to roll a schema back in a shop.

**Forward-only, and never destructive in the same release as the code change:**

1. **Expand** — add the new column or table. Old code ignores it, new code writes
   it. Ship. Both versions run happily side by side.
2. Backfill, verify.
3. **Contract** — a *later* release drops the old column, once every node in the
   fleet is past the expand release.

Because the fleet spans versions permanently, the contract step's precondition is
a fleet-wide check, not a calendar date: the node health register (N11) has to say
nobody is still on the old schema.

**Every step in chapter 20 needs a written rollback criterion before it starts** —
what specifically would make us stop, and what we would do. A gate that only says
what "done" looks like is half a gate.

---

## 24.5 What we promise when it breaks

None of these numbers exist today, and government procurement asks for them
directly. Proposed, to be agreed rather than assumed:

| Node | RPO — how much data can be lost | RTO — how fast back up | How |
|---|---|---|---|
| **Shop (PC)** | ≤ 24h | ≤ 4h with a spare PC | Nightly encrypted archive + local backup; documented restore |
| **Shop (standalone Android)** | ≤ 1 shift | ≤ 2h onto a replacement device | Archive after every Z-report (§23.9) |
| **Control** | ≤ 15 min | ≤ 2h | Postgres WAL, point-in-time recovery, already in place |
| **Tax** | ≤ 15 min | ≤ 4h | Same, plus a filing backlog that can be replayed |

A number nobody has rehearsed is a guess. Each one needs a restore that has
actually been performed and timed — the existing monthly restore test is the right
habit, extended to each node and to a standalone device.

---

## 24.6 The compliance documents change shape

Three documents exist: an incident-response plan, an OWASP Top 10 assessment, and
the verwerkersovereenkomst with its retention table. They describe **one
deployment**, and the incident-response plan does not mention nodes at all.

They stay accurate for the shipped product and must not be edited to describe an
architecture that does not exist. The post-split versions live here, and replace
the live documents on the day the split ships.

**What actually changes:**

- **Who is breached, and who tells whom.** A breach in a shop node is the shop's
  data, on the shop's machine, with us as supplier. A breach in the control plane
  is our systems and their derived data. A breach in the tax node is a government
  system **we operate as a processor** — D3 puts us in a role we have never been
  in, with notification duties running to the Belastingdienst on a clock.
- **Retention becomes per-node and per-data-class.** The shop holds full sales
  history for the statutory period; control holds rollups indefinitely and PII
  never; tax holds filings under its own statutory rules; archives have their own
  clock and their own deletion. One table cannot describe that.
- **The OWASP assessment triples in scope**, and the pen test with it — see §24.7.
- **The verwerkersovereenkomst gains a second relationship.** Today it covers
  commercial clients. After D3 there is a second processor agreement, with the
  Belastingdienst, covering a system we host for them — including named,
  logged, time-boxed maintenance access rather than a standing administrator
  account.

---

## 24.7 The cheap ones, none of which exist

Individually small. Collectively they are most of what a security questionnaire
asks about.

| | What | Why now |
|---|---|---|
| **Pen test scope** | Test the **wires**, not just the two UIs: forge a rollup, replay one, file for another BTW number, tamper with an archive | A pen test of the part already hardened proves the least |
| **Dependency policy** | Dependabot or Renovate, plus a written patch SLA by severity | The dependency audit was a one-off; freshness decays from the day it ran |
| **OSS attribution** | A NOTICE file in every installer | Shipping Laravel and node modules to customers carries attribution duties. IonCube encoding does not remove them |
| **`security.txt`** | RFC 9116, on the public site | A researcher with no way to report a bug posts it instead |
| **No PII in logs** | An explicit rule, plus a CI grep on log statements | WBP-S. A customer name in a log file is a copy of personal data nobody inventoried |
| **Clock discipline** | NTP on the node; every clock adjustment written to the audit log | "What time did this sale happen" is legally material in a fiscal system, and §19.3 already tracks monotonic server time for licensing |
| **BTW vectors** | §23.8 — one vector file, three test runners | The drift risk is in the shipped product **today** |

---

## 24.8 Fiscalisation: be ready, do not build it yet

Several countries certify POS software directly — Germany's KassenSichV requires a
tamper-proof technical security device, France's NF525 requires certified
immutability of sales records. **Suriname has no such requirement**, and building
for one that does not exist would be speculative.

But the shape of the product is already most of the way there: an append-only
audit log with a SHA-256 hash chain, gapless per-store sale numbering, immutable
Z-reports, and — after chapter 22 — filings signed by the shop and chained to the
previous filing.

The posture to hold, and to say out loud to the Belastingdienst: **if Suriname
introduces certification, this is a conformance exercise, not a rebuild.** That is
a competitive position worth having in writing, and it costs nothing to maintain
as long as nobody weakens the chain for convenience.

---

## 24.9 What must be built

On top of N1–N36:

| # | To build | Where |
|---|---|---|
| N37 | CI release pipeline — build, test, SBOM, sign, publish by digest | Build |
| N38 | `verify-artifacts.sh` promoted to a required CI gate | Build |
| N39 | Update-channel signing + node-side verification, incl. the offline bundle | 🏪 + ☁️ |
| N40 | Staged rollout: droplet → pilot shop → fleet | ☁️ Control |
| N41 | Wire contract fixtures + N−2 version matrix in CI | Build |
| N42 | Expand/contract migration discipline + fleet-wide schema check before contract | All |
| N43 | Rollback criterion written for each of chapter 20's seven steps | Plan |
| N44 | RTO/RPO agreed, and a rehearsed restore per node | Ops |
| N45 | Incident-response plan, retention matrix and DPA rewritten per node | Compliance |
| N46 | Pen test scoped to the wires | Compliance |
| N47 | Dependency policy, OSS NOTICE, `security.txt`, no-PII-in-logs check | Build |
| N48 | NTP discipline + clock adjustments in the audit log | 🏪 Shop |

N37, N38 and the BTW vectors from §23.8 are the three worth doing **before** step 1
of the build plan. Each of them fixes something that is already wrong.
