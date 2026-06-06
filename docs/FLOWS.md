# Josbin POS — System Flows

> Plain-language map of how Josbin POS works end to end — onboarding a customer,
> ringing a sale, closing the day, syncing offline, and generating &
> submitting **BTW** (Surinaamse VAT) reports to the **Belastingdienst** tax
> inspector.
>
> **Two formats, one source of truth:**
> - **`docs/flows.html`** — open in any browser; polished, styled, for customers & staff (no internet-free note: it loads Mermaid from a CDN on first open).
> - **This file (`docs/FLOWS.md`)** — renders inline on GitHub; for the team. Paste any block into <https://mermaid.live> to export SVG/PNG.

**Suriname terms:** BTW = VAT (10%, some items exempt) · Belastingdienst = Tax Authority · Rekenkamer = Court of Audit · WBP-S = data-protection law · SRD = Surinamese Dollar (exact decimals) · AST = America/Paramaribo (UTC−3) · Z-Report = end-of-day register close.

---

## 1 · The big picture

Four phases take a new shop from zero to filing VAT. Everything else is a zoom-in on one of these.

```mermaid
flowchart TD
  subgraph P1["① Onboarding & setup"]
    a1["Super Admin creates the Organisation<br/>(name, type, BTW number, language, default BTW%)"] --> a2["Creates Store(s) + issues a Licence"]
    a2 --> a3["Creates the Org Admin (welcome email)"]
    a3 --> a4["Org Admin imports catalogue (CSV/Excel)<br/>& creates Store Managers"]
    a4 --> a5["Store Manager creates Cashiers<br/>& installs POS on each till"]
  end
  subgraph P2["② Daily selling"]
    b1["Cashier signs in, picks store, opens register"] --> b2["Rings sales (BTW auto, stock down)"]
  end
  subgraph P3["③ End of day"]
    c1["Z-Report: count cash, reconcile, close"] --> c2["Syncs to Head Office"]
  end
  subgraph P4["④ Reporting & tax"]
    d1["Dashboard: consolidated, profit & BTW reports"] --> d2["Org Admin generates a BTW filing"]
    d2 --> d3["Submits it · Tax Inspector accepts / disputes"]
  end
  P1 --> P2 --> P3 --> P4
  P4 -. "next period" .-> P2
```

---

## 2 · Actors & the three layers

Access is denied by default and enforced on the server — not just hidden in the UI.

```mermaid
flowchart LR
  SA["Super Admin (Josbin vendor)"] --> DASH
  OA["Organisation Admin"] --> DASH
  SM["Store Manager"] --> POS
  SM --> DASH
  CA["Cashier"] --> POS["Layer 1 — Store POS (per till)"]
  AU["Auditor (read-only)"] --> DASH["Layer 2 — Super Admin Dashboard (cloud)"]
  TI["Tax Inspector (Belastingdienst · 2FA)"] --> DASH
  API["API Integration (3rd-party POS)"] --> INT["Layer 3 — Open Integration API"]
  POS -. "sync" .-> DASH
  INT -. "sales in" .-> DASH
```

| Role | Scope |
|------|-------|
| **Super Admin** | Josbin (vendor). Every org, licences, catalogue pushes. |
| **Organisation Admin** | One customer's head office. Catalogue, users, reports, BTW filings. |
| **Store Manager** | Their store(s). Registers, stock, store reports, Z-Reports. |
| **Cashier** | The till only. Ring sales, take payment, print receipts. |
| **Auditor** | Read-only across the org. |
| **Tax Inspector** | Belastingdienst. Cross-org, read-only, BTW filings only. **2FA mandatory.** |
| **API Integration** | Machine account so a third-party POS can push sales. |

---

## 3 · Onboarding a new customer

```mermaid
flowchart TD
  s1["Super Admin creates Organisation<br/>name · type · BTW number · language · default BTW%"] --> s2["Creates Store(s)<br/>address · city · receipt header/footer"]
  s2 --> s3["Issues a Licence (store + terminal limits, expiry)"]
  s3 --> s4["Creates Org Admin account → welcome email"]
  s4 --> s5{"Org Admin signs in"}
  s5 --> s6["Imports catalogue (CSV/Excel)<br/>names NL/EN · price · BTW% · exempt · cost"]
  s5 --> s7["Creates Store Manager accounts (one store each)"]
  s7 --> s8["Store Manager creates Cashier accounts"]
  s8 --> s9["Installs POS on each till<br/>(licence checked, terminal registered)"]
  s6 --> s10["Store goes live — ready to sell"]
  s9 --> s10
```

> **Catalogue is centralised** — one master list per org; optional per-store price overrides for higher-cost regions (e.g. Nickerie). Updates push to all tills in seconds over WebSocket.

---

## 4 · A sale at the till

**Money rule:** discounts are applied first, **then** BTW is extracted — the order Suriname law requires.

```mermaid
flowchart TD
  l1["Cashier signs in (2FA for govt accounts)"] --> l2{"Store chosen?"}
  l2 -- "no" --> l3["Pick store (auto if only one)"]
  l2 -- "yes" --> l4{"Register open?"}
  l3 --> l4
  l4 -- "no" --> l5["Open register (opening float)"]
  l4 -- "yes" --> l6["Add products: tap / scan / search"]
  l5 --> l6
  l6 --> l7["Optional: line & basket discounts, attach customer"]
  l7 --> l8["BTW engine: discount first → extract BTW per line<br/>(exempt lines charge 0)"]
  l8 --> l9{"Payment method"}
  l9 --> pm["Cash · Card/PIN · Mixed<br/>Bank / Mobile transfer · Foreign cash · QR"]
  pm --> l10["Lock today's USD→SRD rate (self-healing)"]
  l10 --> l11["ONE DB transaction:<br/>save sale + items · snapshot cost & profit · reduce stock"]
  l11 --> l12["Receipt: thermal print (ESC/POS) and/or bilingual email"]
  l11 -. "background" .-> bg["Live dashboard update · fraud AI check · queued for sync"]
```

- **Rate never missing** — self-heals: already locked → rate API → carry forward yesterday → configured static fallback. Locked rate stamped on every sale.
- **No silent oversell** — stock drops inside the sale transaction (not a flaky job). Default allows honest negative stock; a store can switch to strict block-oversell.
- **Profit captured at sale time** — cost & profit snapshotted per line, so reports stay correct if cost changes later.

---

## 5 · End of day — Z-Report & cash reconciliation

```mermaid
flowchart TD
  z1["Open End of Day"] --> z2["X-Report (optional) — mid-day snapshot, no close"]
  z1 --> z3["Z-Report: totals · BTW · payment mix · top 5"]
  z3 --> z4["Count the cash drawer"]
  z4 --> z5{"Counted = expected?"}
  z5 -- "no" --> z6["Discrepancy in red · note mandatory · logged to audit"]
  z5 -- "yes" --> z7["Close register · Z-Report finalised"]
  z6 --> z7
  z7 --> z8["Print Z-Report / export PDF"]
  z7 --> z9["Forced sync attempt to Head Office"]
  z9 -. "see §6" .-> z10["Dashboard: 7-day history, sync status, re-submit"]
```

---

## 6 · Five-layer offline resilience

Selling never depends on the internet. Data finds its way to HQ via whichever layer is available.

```mermaid
flowchart TD
  start(["Sale completed"]) --> q["Local outbox queue"]
  q --> net{"Internet available?"}
  net -- "yes" --> L1["① Real-time sync (seconds)"]
  net -- "no" --> L2["② Auto-retry 1m→5m→15m→30m · yellow 'N pending'"]
  L2 --> L3["③ Z-Report forced retry at day close"]
  L3 --> down{"Still offline?"}
  down -- "yes" --> L4["④ USB export: AES-256 .josbin_pos → WhatsApp/email → uploaded at HQ"]
  down -- "no" --> L5["⑤ Catch-up sync on reconnect (chronological, 'synced late' in audit)"]
  L4 --> L5
  L1 --> done(["HQ dashboard up to date"])
  L5 --> done
```

> A **4G USB dongle** (Digicel / Telesur) is a backup link — used only for the tiny sync payload (50–200 KB/day), never for selling.

---

## 7 · Reporting — store, network, profit

```mermaid
flowchart LR
  sales[("Sales + sale items<br/>SRD · BTW · cost · AST time")]
  sales --> r1["Store reports (POS): daily · monthly · custom · top products"]
  sales --> r2["Dashboard — Consolidated: cross-store revenue, BTW, payment mix"]
  sales --> r3["Dashboard — Profit & margin: revenue − cost, by store, loss-makers"]
  sales --> r4["Dashboard — BTW report (Belastingdienst format): taxable vs exempt"]
  sales --> r5["Rekenkamer audit export: signed PDF + CSV"]
  r4 --> btw["→ feeds the BTW filing (§8)"]
```

> A **store filter** drills consolidated / BTW / profit reports down to one branch, or the whole org at once. All reports honour the AST day-boundary and export to PDF/CSV (NL or EN headers).

---

## 8 · BTW report → submission → Tax Inspector

The headline compliance journey.

### 8a · Generate & submit

```mermaid
flowchart TD
  g1["Org Admin opens BTW Submissions, picks a period"] --> g2["System aggregates sale items in that AST window<br/>taxable · exempt · BTW due · per store"]
  g2 --> g3["Creates a BTW Submission + SHA-256 hash<br/>linked to the org's previous filing (a chain)"]
  g3 --> g4["Org Admin reviews (Belastingdienst format) & exports PDF"]
  g4 --> g5["Submit to Belastingdienst"]
  g5 --> g6["Appears on the Tax Inspector's dashboard"]
```

### 8b · The life of a filing

```mermaid
stateDiagram-v2
  [*] --> Draft: Org Admin generates
  Draft --> Submitted: submit to Belastingdienst
  Submitted --> Accepted: inspector accepts
  Submitted --> Disputed: inspector disputes (with a note)
  Disputed --> Superseded: Org Admin corrects & refiles
  Superseded --> Submitted: new filing links to the original
  Accepted --> [*]
```

### 8c · Who does what, in order

```mermaid
sequenceDiagram
  autonumber
  actor OA as Org Admin
  participant SYS as Josbin server
  actor TI as Tax Inspector
  OA->>SYS: Generate BTW filing for period
  SYS->>SYS: Aggregate sale items (AST), split taxable vs exempt
  SYS->>SYS: Hash-chain the filing to the org's last one
  OA->>SYS: Submit to Belastingdienst
  SYS-->>TI: Filing appears (cross-org, read-only, 2FA)
  TI->>SYS: Review figures + source breakdown
  alt Figures correct
    TI->>SYS: Accept
    SYS-->>OA: Marked Accepted (filed)
  else Problem found
    TI->>SYS: Dispute + note
    SYS-->>OA: Marked Disputed
    OA->>SYS: Correct & supersede (refile)
    SYS-->>TI: New filing (links to original)
  end
```

> **Why the hash chain matters.** Each filing carries a SHA-256 fingerprint of itself plus the previous filing's, **per organisation**. Change any historical figure and the chain breaks — so the Belastingdienst and Rekenkamer can trust the record wasn't altered after the fact. Day boundaries use AST, so a 23:30 sale counts on the correct day.

---

## 9 · The compliance backbone (always on)

These run underneath every flow above — not a screen, but how the system behaves on every write.

```mermaid
flowchart TD
  act["Any meaningful action<br/>(sale, void, refund, login, rate lock, user change, BTW filing)"] --> aud["Append-only audit log<br/>SHA-256 hash chain · tamper-evident · per org"]
  act --> pii{"Touches customer PII?"}
  pii -- "yes" --> enc["Encrypted at rest (WBP-S): name · phone · email · ID"]
  enc --> erase["Right to erasure: redact PII, keep totals"]
  act --> rate["Daily rate locked & immutable (manual override only)"]
  aud --> rk["→ Rekenkamer export (signed)"]
  aud --> verify["audit:verify proves the chain is intact"]
```

- **Immutable audit trail** — hash-chained, append-only; no user can edit/delete a row without breaking the chain.
- **PII encryption (WBP-S)** — customer data encrypted field-by-field; erasure on request keeps sales history intact.
- **Code & licence protection** — PHP IonCube-encoded, desktop app code-signed, hardware-bound licence checked on start + every 24 h.

---

*All money in SRD · all times in AST (America/Paramaribo) · BTW per Belastingdienst Suriname.*
