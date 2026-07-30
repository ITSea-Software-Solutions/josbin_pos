# 20. Split build plan — why, what moves, and what must not break

[Chapter 19](/migration-architecture-plan/19-three-node-architecture) describes the target: three
independent nodes. This chapter is how we get there **without losing anything we
already have**.

Read §20.3 before writing any code. It is the list of things that work today,
and the refactor is only successful if every one of them still works after.

---

## 20.1 Why we are doing this

Four reasons, in the order they matter.

**1. The shop's PC is not our building.** Today a shop install would carry the
whole product: licence issuance, cross-organisation reporting, fleet management.
That machine sits behind someone else's counter and whoever holds it can read
the disk. Encoding slows that down; **not shipping the code ends it**.

**2. Government data must be separate, and we said so.** The compliance position
is that Belastingdienst data never shares a database with commercial clients.
Right now it shares a database with everything. A separate tax node makes the
claim true rather than aspirational.

**3. Offline must be structural, not incidental.** A shop sells with no internet
today because the sale path happens to be local. After the split it is local
*by construction* — there is no admin code in the node that could ever want a
network.

**4. Blast radius.** One database means one bad migration reaches every customer
and the tax authority at once. Three databases means a shop upgrade cannot take
down a filing deadline.

---

## 20.2 What we are building

One repository, one shared domain core, three deployable nodes.

```
backend/
├── domain/                    ← shared, written ONCE
│   ├── Btw/                     rates, exemption, discount-then-BTW order
│   ├── Money/                   SRD decimal, rounding
│   ├── Receipt/                 the receipt builder
│   └── Contracts/               sync + filing payload shapes, versioned
│
├── nodes/
│   ├── Shop/                  ← installed in the shop
│   │   POS · catalogue · registers · sales · customers · local users
│   │   local reports · licence VERIFY · sync client · filing client
│   │
│   ├── Control/               ← we host, one instance
│   │   organisations · licence ISSUE (holds the signing key)
│   │   fleet · consolidated reporting · installer distribution
│   │
│   └── Tax/                   ← Belastingdienst, own database
│       filings · inspector dashboard · disputes · audit export
│
└── config/josbin_node.php     ← which node this build is
```

**Why one repository and not three.** The BTW engine, the money rounding and the
receipt builder must be byte-identical in all three. Three copies drift, and the
day a shop receipt says SRD 122.35 while the Belastingdienst sees 122.34 is a
compliance incident with our client's name on it, not a bug report. One core,
three thin nodes, and the encoded build for each node contains only its own
directory.

The node profile decides which routes register, which migrations run and which
modules load. A shop build physically does not contain `nodes/Control`.

---

## 20.3 The freeze list — what must still work

**220 catalogued features: 193 shipped, 12 partial, 15 not started.** The full
inventory with per-feature status lives in the feature catalogue; this table is
the ownership map, which is the part the split can get wrong.

The dangerous rows are the ones that **split**. A feature owned by one node moves
cleanly. A feature that exists in two nodes is where behaviour quietly goes
missing, because each side assumes the other kept it.

| Area | Rows | Goes to | Risk |
|---|---|---|---|
| **POS — register & sales** | 43 | Shop | Clean move |
| **Catalogue & inventory** | 23 | Shop | Clean move |
| **Settings & device** | 20 | Shop, mostly | ⚠️ **Splits** — org-level policy stays in Control |
| **Reports** | 16 | All three | ⚠️ **Splits 3 ways** — own-store / consolidated / filings |
| **BTW filings** | 29 | Shop files, Tax receives | ⚠️ **Most split area** — 12 of 29 cut in half |
| **Auth & session** | 11 | All three | ⚠️ **Splits 3 ways** — three independent user tables |
| **Licence** | 10 | Control issues, Shop verifies | ⚠️ **Splits** — the whole point of the change |
| **Org & user management** | 10 + 5 | ⚠️ **Splits** | Control owns the org record; Shop owns its own users |
| **Integration API (Layer 3)** | 10 | **Undecided** | ⚠️ See §20.6 |
| **Audit & compliance** | 9 | All three, independently | Each node keeps its own append-only log |
| **Sync & offline** | 8 | Shop client + Control server | ⚠️ **Splits** — it *is* the wire |
| **AI layer** | 7 | ⏸️ **Dropped** | Deferred out of the split entirely — chapter 21 §21.5 |
| **Hardware (printer, drawer, scanner)** | 2 | Shop | Clean move |
| **Customers** | 2 | Shop | Never leaves the shop — WBP-S |

### The nine critical flows

These are end-to-end journeys, and every one must be walked on real hardware
after the split. A green test suite is not evidence for these.

1. New organisation onboarding — *changes most; becomes the activation flow*
2. Cashier opens shift, sells, closes — **must not change at all**
3. Manager closes day (Z-Report) — **must not change at all**
4. Licence lifecycle: issue → expire → renew → soft-lock → hard-lock — *reworked*
5. Offline sale → five-layer fallback recovery — **must not change at all**
6. Reopen-for-next-shift hand-off — **must not change at all**
7. Third-party POS integration — *depends on §20.6*
8. BTW filing to Belastingdienst — *changes; becomes direct submission*
9. Morning recovery, yesterday never closed — **must not change at all**

Five of the nine must come through untouched. If any of them behaves differently
afterwards, the refactor is wrong — not the flow.

### Do not lose the unfinished work

12 features are partial and 15 are unstarted. They are easy to drop in a big
move because nothing fails when they vanish. Carry the catalogue rows across
with their status intact, including the Sranantongo review that is still
outstanding and the deferred sale-number and refund-discount items.

---

## 20.4 The rule for every step

**No step changes behaviour and moves code at the same time.**

A step either:
- moves code with byte-identical behaviour (prove it: the suite passes untouched), or
- changes behaviour in one place with the structure already settled.

Mixing them is how a refactor loses a feature nobody notices for a month.

---

## 20.5 Order of work, with the gate on each

| # | Step | Gate before moving on |
|---|---|---|
| 1 | Extract `domain/` — BTW, money, receipt | Full suite green, **no test edited**. If a test needed changing, behaviour changed. |
| 2 | Carve `nodes/Shop` · `Control` · `Tax`, still one deployment | All 9 flows walked; app still boots as one |
| 3 | Node profile + separate migrations per node | Each node migrates from empty into a working DB |
| 4 | Signed licence: issue in Control, verify in Shop | Flow 4 rewalked; **verify with the network unplugged** |
| 5 | Activation flow + first-admin bootstrap | Flow 1 rewalked end to end on a clean machine |
| 6 | Three build targets, three compose files | A shop build contains no `nodes/Control` code — grep the artifact |
| 7 | Direct BTW filing, shop-signed | Flow 8 rewalked; a filing verifies against the shop's key |

Steps 1–3 are pure refactor and safe to start now. Steps 4–7 need the three open
decisions in [§19.7](/migration-architecture-plan/19-three-node-architecture) answered first.

---

## 20.6 Still undecided

> **Now decided** — see [chapter 21](/migration-architecture-plan/21-migration-record). Per-store nodes with the schema
> intact, degrade-not-lock plus source escrow, we host the tax node as a separate
> system, Layer 3 in the control plane, one control database plus per-shop
> encrypted archives.


Carried forward from chapter 19, plus one this chapter surfaces:

1. **One node per organisation, or per store?** Five branches: one server at head
   office or five? Decides what the licence limits count.
2. **Escrow** — if the vendor disappears, does a shop keep trading?
3. **Who hosts the tax node** — the Belastingdienst, or us on their behalf?
4. **Where does the Layer 3 integration API live?** A third-party POS pushing
   sales: to the shop node on the shop's LAN, or to the control plane over the
   internet? Shop-node means no internet dependency but no fixed public address;
   control-plane means the opposite. This one has no obvious answer and blocks
   10 catalogued features.

---

## 20.7 What we are explicitly not changing

So nobody optimistically "tidies" these mid-refactor:

- **The BTW calculation.** Discount before BTW, exemption handling, rounding —
  moves to `domain/`, unchanged, tests untouched.
- **The receipt.** Layout, ESC/POS bytes, the printed marks.
- **The POS screens.** A cashier's day does not change because the servers did.
- **Money precision.** DECIMAL(12,2), never floating point.
- **AST timestamps.** Every date window stays Suriname time.
- **The audit log's immutability.** Append-only in each node, no exceptions.
