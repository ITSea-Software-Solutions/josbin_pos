# Architecture plan — splitting Josbin POS into three nodes

::: warning This describes where we are going, not what runs today.
Everything in this section is a **plan**. The shipped product is still one
deployment, documented in the [developer docs](/docs/) and the manuals. Nothing
here is installed anywhere yet.
:::

Josbin POS runs today as a single system: one codebase, one database, every role
in the same deployment. That was the right shape for building it and the wrong
shape for selling it — a shop's back-office PC should not carry our licence
server, and Belastingdienst data should not share a database with commercial
clients.

This section is the plan to split it into **three independent nodes**:

| Node | Where it lives | What it does |
|---|---|---|
| 🏪 **Shop** | The shop's own PC | Sells. Owns tills, catalogue, sales, customers, its own users. Works with no internet, indefinitely. |
| ☁️ **Control** | We host it | Organisations, licences, the fleet, the consolidated view. Holds the licence signing key. |
| 🏛 **Tax** | Separate deployment, we host on request | BTW filings only, own database. Never holds commercial data. |

## The seven chapters

**[19. Three-node architecture](/migration-architecture-plan/19-three-node-architecture)** — the target
shape and the contract between the nodes. What each one owns, the four wires
between them, and how a licence gets verified with no network at all. Read this
first; it is the design.

**[20. Split build plan](/migration-architecture-plan/20-split-build-plan)** — how we get there without
losing anything. The freeze list of what must still work, the nine critical
journeys (five of which must not change at all), the seven steps and the gate on
each one.

**[21. Migration record](/migration-architecture-plan/21-migration-record)** — what was actually decided
and why. Six decisions with the reasoning kept, two boundary diagrams, and the
disposition of **all 220 catalogued features**: which move to the shop, which
stay in our cloud, which every node needs its own copy of — and the 70 that
**split across two nodes**, where behaviour goes missing because each side
assumes the other kept it.

**[22. Authentication & security](/migration-architecture-plan/22-node-authentication)** —
how each node proves who it is. Two keypairs pointing opposite ways, why the
signature goes *inside* the payload rather than being the TLS connection, how a
shop files BTW without us sitting in the chain of custody, and an honest account
of what someone gets by walking off with the shop's PC.

**[23. Installs & artifacts](/migration-architecture-plan/23-installs-and-artifacts)** —
what a customer actually receives, which is an image and never the repository.
The three shop setups (a lone Android terminal, a PC in the back, a dedicated
server), how the team clones and runs it, and the plan for a standalone Android
node with a native Kotlin core.

**[24. Release engineering, operations & compliance](/migration-architecture-plan/24-release-and-operations)** —
how a signed image comes to exist and reaches a shop safely, contract tests for
the wires, expand-then-contract migrations, what we promise when things break, and
which compliance documents have to be rewritten once there are three nodes.

**[25. Deployment topologies](/migration-architecture-plan/25-deployment-topologies)** —
the six shapes a shop can be sold, with a connection diagram for each: node in our
cloud or on their premises, one machine or several, and the standalone device with
no Docker at all. Which ones sell offline, which ones must never be sold to the
interior, and how a customer moves between them.

## Where we are

**The AI layer is out of scope.** Seven catalogued features — smart search, fraud
detection, the weekly summary, auto-categorisation and the Phase-2 items — are
deferred out of the split entirely. They need internet, so they could only ever
live in the control plane; the split does not block them and they do not block
the split.

Nothing has been built yet. Chapter 20's steps 1–3 are pure refactor and safe to
start; steps 4–7 depend on the decisions now recorded in chapter 21.

One thing blocks step 1: its gate is *"full suite green, no test edited"*, and
there is currently nowhere that can be run. See
[§21.6](/migration-architecture-plan/21-migration-record).

## What happens to this section

It retires. Once the split is done and the three nodes are what we ship, this
plan stops being a plan — the target architecture becomes the architecture, and it
moves into the developer docs proper. This section exists to be finished and
deleted, not maintained forever.

Until then: **the developer docs describe what runs, this section describes what
we are building.** If the two disagree, the developer docs are right about today.
