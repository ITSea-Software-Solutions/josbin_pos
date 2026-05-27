# Script 03 — Multi-store HQ live overview

**Goal:** the SaaS / "we're more than one till" pitch. Convince a multi-store retailer that the head office gets real value out of moving from per-store spreadsheets to a single live dashboard.

**POV:** Organisation Admin (`orgadmin@dehoop.sr / OrgAdmin@2026`). Optional cameo: Super Admin Platform Overview at the end (skip if SA 2FA isn't cleared — it doesn't break the story).

**Target length:** 3 min.

**Pre-recording checklist**

- [ ] Demo stack with **at least 2 stores** seeded under one organisation. If only 1 exists, add a second from the Stores screen before recording.
- [ ] Some sales rung up today across both stores so the dashboard isn't all zeros. Easiest: run two POS dev tabs as cashiers on different stores, ring 3–4 sales each.
- [ ] Both POS windows minimised but not closed — you'll use them in the live-update scene.
- [ ] Browser locale nl-NL.

---

## Opening hook — 10 s

> "If you've got more than one store, head office is usually a day behind. Reports come in on Excel by email, by the time you've consolidated them it's 3 PM and the discrepancy you needed to act on this morning is now this week's problem. Here's what real-time looks like."

**On-screen caption:** "Multi-store visibility — live."

---

## Scene 1 — The OA overview (60 s)

| Click | Narration | Caption |
|---|---|---|
| Logged in as OA, on Dashboard overview | "Org Admin home for Supermarkt De Hoop. Two stores so far — Paramaribo central and Nickerie." | |
| Per-store cards visible | "Each store gets a card. Revenue today. Transaction count. Average basket. Last sync. Online or offline indicator." | |
| Hover one card → drill in | "Click a card — full transaction list for that store." | |
| Back to overview | "Back out." | |
| Show top-products tile | "Top product across the whole network — Bruine Bonen this week." | "Cross-store top sellers in one view" |
| Show consolidated total | "Consolidated revenue and BTW — head office number, not five store-level numbers I need to add up myself." | |

---

## Scene 2 — Live updates via Reverb WebSocket (60 s)

| Click | Narration | Caption |
|---|---|---|
| Dashboard overview in foreground | "Watch the Paramaribo card. I'm going to ring a sale at that till right now." | |
| Switch to POS window (Paramaribo cashier) | "Cashier rings up 2 items, 50 SRD total, cash." | |
| Quick: 2 clicks, checkout, cash, complete | (Don't narrate the till — say "and complete" to bridge) | |
| Switch back to dashboard | "Back to HQ — Paramaribo's card just incremented. No refresh. Reverb WebSocket pushed it." | "Live — no refresh button" |
| Repeat for Nickerie (optional) | "Same thing for Nickerie." | |
| Both cards updated | "Head office sees it the moment the cashier hits Complete. That's the difference between watching your business happen and reading about it tomorrow." | |

---

## Scene 3 — Drill into reports (45 s)

| Click | Narration | Caption |
|---|---|---|
| Sidebar → **Rapporten / Reports** | "Reports — daily, monthly, custom range, BTW, Rekenkamer." | |
| Click **Geconsolideerd / Consolidated** | "Consolidated view across all stores." | |
| Show date picker, payment-method breakdown | "Picks any date range. Shows payment method × bank breakdown — so daily card settlement matches the bank statement without manual sifting." | "Cards × bank — auto-reconciled" |
| Click **PDF export** | "PDF — Dutch or English headers, depending on the viewer's language." | |
| Show downloaded PDF first page | "Drops into the manager's downloads. Same format every time, ready to share." | |

---

## Scene 4 (optional) — SA Platform Overview (15 s)

Only run this if SA 2FA is cleared, otherwise skip.

| Click | Narration | Caption |
|---|---|---|
| Log out, log in as Super Admin | "Super Admin — the platform owner — sees one level up: every organisation, every store, every licence." | |
| Platform Overview panel visible | "Active orgs, active stores, sales today across the entire platform. Useful when you're running this for multiple customers." | |

---

## Closing — 15 s

> "The shift here is from looking at your business yesterday to looking at your business right now. Whether you're running two stores or twenty, head office sees what's happening as it happens — and the cashier doesn't have to change a single thing about how they work."

**Final on-screen caption:** "Real-time. Every store. No re-keying."

---

## Post-recording

- The live-update scene is the money shot. If the WebSocket didn't fire fast enough on the take, just re-record that scene; you can splice it in.
- Title: *"Josbin POS — Multi-store live, no refresh."*
