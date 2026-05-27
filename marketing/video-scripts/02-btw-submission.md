# Script 02 — BTW filing → Belastingdienst inspector accepts

**Goal:** show the killer differentiator vs every other POS in Suriname — formal BTW submission from the dashboard, reviewed and accepted by a Belastingdienst tax inspector inside the same platform. End the BTW filing pain point in one demo.

**POV:** Org Admin (`orgadmin@dehoop.sr / OrgAdmin@2026`) → Tax Inspector (`belastingdienst@gov.sr / Inspector@2026`).

**Target length:** 5 min.

**Pre-recording checklist**

- [ ] Demo stack running, dashboard at `http://localhost:5174`.
- [ ] Browser locale nl-NL.
- [ ] **Clear the tax inspector's 2FA secret** (see `README.md` — without this you can't reach the inspector dashboard in a clean recording).
- [ ] Some sales seeded for yesterday or earlier this month so the *Bereken totalen* preview shows real numbers, not zeros. Run the demo seeder if the data feels thin.
- [ ] No existing BTW submission for the period you're going to file — the system blocks duplicates, which is correct behaviour but boring in a demo.

---

## Opening hook — 15 s

> "Every retailer in Suriname has to file BTW to Belastingdienst. Today that's spreadsheets, manual re-keying, and back-and-forth phone calls when the numbers don't match. I'm going to file a month's BTW from Josbin POS in 30 seconds — and then switch to the tax inspector's account and accept it. Same platform. Audit trail end-to-end."

**On-screen caption:** "From filing to accepted in 5 minutes."

---

## Scene 1 — File the submission as OA (90 s)

| Click | Narration | Caption |
|---|---|---|
| Logged in as OA, sidebar visible | "I'm the Org Admin of Supermarkt De Hoop. I click *BTW-aangiftes* — BTW submissions — in the sidebar." | |
| Click **BTW-aangiftes / BTW Submissions** | "This is the filings list. Existing submissions show with status badges — Filed, Accepted, Disputed, Superseded. Empty for now." | |
| Click **+ Nieuwe aangifte / + New submission** | "New submission." | |
| Modal: pick **Maandelijks / Monthly** | "Monthly — that's the legal cycle Belastingdienst expects. Daily is also there for shops who want extra transparency." | "Daily option available too" |
| Date picker pre-fills last month | "It pre-fills last month, 1st to last day. Belastingdienst won't accept partial months — the picker enforces that." | |
| Click **🔍 Bereken totalen / Compute totals** | "*Compute totals* — this is a dry run. The system reads every completed sale in that month and shows me what would be filed." | |
| Preview shows count, total, BTW | "Sales count — total revenue — taxable vs exempt — BTW due. Nothing saved yet." | |
| Type optional note | "Optional note for the inspector — for example, *'Eén Z-rapport ontbreekt, volgt'* — one missing Z-report, will follow. They read this." | |
| Click **✓ Indienen / File** | "File it." | |
| Green confirmation banner with REF | "Reference number assigned. The exact list of sale IDs is locked into the row — Rekenkamer can walk back from this filing to every source sale row-by-row." | "Snapshot is locked — never re-computed" |
| List now shows the new row | "And there it is — status *Filed*, waiting for the inspector." | |

---

## Scene 2 — Switch to the tax inspector (15 s)

| Click | Narration | Caption |
|---|---|---|
| Click user chip → **Uitloggen** | "Log out." | |
| Login as `belastingdienst@gov.sr` | "Log in as the Belastingdienst tax inspector. Notice the role mandates 2FA in production — I've cleared it for this recording only." | "2FA mandatory in production" |
| Land on BTW Dashboard | "The inspector lands directly on a BTW dashboard — they don't see catalogue, customers, prices, anything else. Just BTW filings across every taxpayer on the platform." | "Inspector sees only BTW" |

---

## Scene 3 — Inspector reviews + accepts (90 s)

| Click | Narration | Caption |
|---|---|---|
| BTW Dashboard with KPI tiles | "Four KPIs — filings this period, accepted, disputed, awaiting review. Sparkline shows the last 30 days at a glance." | |
| Click **BTW-aangiftes** in sidebar | "Go to the submissions list." | |
| List shows filings from multiple orgs | "Filings from every organisation, sorted by most recent. Filter by status, period, organisation, source." | |
| Click filter dropdown **Bron / Source** | "Source filter. This is forward-looking — taxpayers might use Josbin POS, but they might also use a third-party POS pushing data through our open API. Inspector can split the view by which system filed it." | "Future-proof for mixed POS estates" |
| Click row → **Bekijken / View** | "Drill into our De Hoop filing." | |
| Detail screen shows breakdowns | "Detail view — same total the OA saw, but broken down per store, per payment method, per BTW rate. And the source POS column — for now everything came from Josbin native." | "Per-store, per-method, per-rate" |
| Click **✓ Accepteer / Accept** | "Numbers check out — accept." | |
| Modal — optional note | "Optional inspector note — *'Geverifieerd tegen bankafschriften'* — verified against bank statements." | |
| Click confirm | "Confirm." | |
| Status flips to Accepted | "Status flips to *Accepted*. Hash chain advances — tamper evidence built in. Audit log records the inspector's id and timestamp." | "Tamper-evident hash chain" |

---

## Scene 4 — OA sees the accepted status (20 s)

| Click | Narration | Caption |
|---|---|---|
| Log out + back in as OA | "Back to the Org Admin to confirm they see it." | |
| Sidebar → BTW-aangiftes | "BTW submissions." | |
| Same row now shows Accepted badge | "Same row — now *Accepted*. With the inspector's note visible." | |
| Hover the audit timestamp | "And the timestamp + inspector id are in the audit log forever — nobody can quietly edit this row." | |

---

## Closing — 20 s

> "Five minutes — from a pile of sales rows to a Belastingdienst-accepted filing, with an audit trail that Rekenkamer can pull tomorrow. No spreadsheets. No re-keying. No back-and-forth phone calls. That's what Josbin POS does that no other POS in Suriname currently does."

**Final on-screen caption:** "Belastingdienst filing — built in. Not bolted on."

---

## Post-recording

- Re-enable the tax inspector's 2FA immediately. Re-record only if you need a re-take; do not leave the demo stack with 2FA off.
- Trim, caption, share.
- Title: *"Josbin POS — File BTW to Belastingdienst in 30 seconds."*
