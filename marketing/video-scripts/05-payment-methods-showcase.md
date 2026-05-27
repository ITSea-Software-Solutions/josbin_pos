# Script 05 — Payment methods showcase

**Goal:** prove Josbin POS handles every payment method a Surinamese shop actually sees — cash, card with reconciliation, bank transfer with awaiting-confirmation lifecycle, mobile wallets, foreign cash with locked rate. Common buyer objection: "does it support \[bank's mobile app\]?" Answer this once in a video, never field the question again.

**POV:** Cashier (`kassa@dehoop.sr / Cashier@2026`) + brief OA cameo (`orgadmin@dehoop.sr / OrgAdmin@2026`) for the confirmation queue.

**Target length:** 4 min 30 s.

**Pre-recording checklist**

- [ ] Demo stack running, POS at `:5173`, dashboard at `:5174`.
- [ ] Cashier already logged in with register open. (Saves 30 s of opener.)
- [ ] Daily exchange rate locked (foreign cash needs this; sale will fail without it).
- [ ] Browser locale nl-NL.
- [ ] Have one OA-logged-in tab ready in the background for the final scene.

---

## Opening hook — 15 s

> "In Suriname a single shop sees cash, PIN card, DSB Mobiel, Hakrinbank Online, Republic Mobile, B2B bank transfer, and sometimes US dollars or euros from tourists — all in the same morning. Most POS systems force you to fudge half of those. Watch what Josbin does."

**On-screen caption:** "Every payment method, no fudging."

---

## Scene 1 — Cash + the basic flow (30 s)

| Click | Narration | Caption |
|---|---|---|
| Build a simple cart, 47.50 SRD | "Cart built — 47 SRD 50." | |
| **Afrekenen** | "Checkout." | |
| Payment modal — three big buttons | "Three on top — cash, card, mixed. *Meer betaalwijzen* — *more methods* — expands the rest." | |
| Click **Contant / Cash** | "Cash." | |
| Type 50 | "Customer hands me 50 SRD. Change is 2 SRD 50." | |
| Click **Voltooien** | "Complete. Drawer opens." | |

---

## Scene 2 — Card with reconciliation (60 s)

| Click | Narration | Caption |
|---|---|---|
| New sale, build cart 120 SRD | "Next customer — 120 SRD." | |
| Checkout → **Pin / Card** | "Card." | |
| Recon step appears | "Now this is the Surinamese-specific bit. After the customer taps their card on the bank's PIN terminal, the cashier optionally captures the bank name, the approval code, and the last 4 digits from the slip." | "Optional recon for daily settlement" |
| Pick **DSB** from dropdown | "Bank — DSB." | |
| Type approval code, last 4 | "Approval code from the slip — last 4." | |
| Click **✓ Voltooien** | "Complete." | |
| (Optional) point at the **Skip & complete** alternative | "If the slip's not out yet, *Skip & complete* — sale still completes. Recon can be filled in later from the dashboard." | "Skip if slip not ready" |
| Mention dashboard benefit | "Why this matters — at the end of the day, the dashboard matches daily card sales against the bank's settlement statement automatically. No manual reconciliation." | "End-of-day card-bank match is automatic" |

---

## Scene 3 — Bank transfer (B2B / government) (60 s)

| Click | Narration | Caption |
|---|---|---|
| New sale 1,200 SRD (B2B amount) | "B2B sale — government department, 1,200 SRD." | |
| Checkout → **Meer betaalwijzen** | "*More methods.*" | |
| Click **Overschrijving / Bank transfer** | "Bank transfer." | |
| Form: provider, reference | "Customer initiates a transfer from their bank app. Cashier captures the provider — Hakrinbank — and the reference number from the customer's confirmation screen." | |
| Click **Voltooien** | "Complete." | |
| Confirmation banner — *Wacht op bevestiging* | "Sale is recorded — but flagged *awaiting confirmation*. The funds haven't actually landed in our account yet. Belastingdienst counts the sale only when payment lands, so we don't include this in today's totals yet." | "Awaiting funds — not yet counted" |
| Receipt prints with awaiting badge | "Receipt prints with that status visible to the customer too." | |

---

## Scene 4 — OA confirms in the pending queue (45 s)

| Click | Narration | Caption |
|---|---|---|
| Switch to OA-logged-in tab | "Switch to the Org Admin." | |
| Sidebar → **Openstaande betalingen** | "*Pending payments* queue — every awaiting-confirmation sale across the org." | |
| The row we just made is at top | "Our 1,200 SRD transfer is right there." | |
| OA checks bank app (off-camera) | "OA checks the bank app — yes, the transfer landed." | |
| Click **✓ Bevestig / Confirm** | "Confirm." | |
| Row drops out of queue, status flips | "Row drops from the queue. Sale now counts in today's totals. *Confirmed by* and *confirmed at* are logged forever." | "Auditable confirmation flow" |

---

## Scene 5 — Mobile transfer (15 s)

Show this briefly — same lifecycle as bank transfer, just a different provider list.

| Click | Narration | Caption |
|---|---|---|
| Back to POS, new sale, checkout → More methods | "Same flow for DSB Mobiel, Hakrinbank Online, Republic Mobile. Customer pays from their app, cashier captures reference, OA confirms when funds land." | "Same lifecycle for mobile wallets" |

---

## Scene 6 — Foreign cash (USD / EUR) (45 s)

| Click | Narration | Caption |
|---|---|---|
| New cart 200 SRD | "Tourist customer wanting to pay in US dollars." | |
| Checkout → More methods → **Vreemde valuta / Foreign cash** | "Foreign cash." | |
| Pick **USD** | "USD." | |
| Show locked daily rate | "System uses today's locked rate — set every morning from ExchangeRate-API, with manual override available. The rate is **locked at the moment of sale** — if it moves later, this sale still has the rate that was current when the customer paid." | "Rate locked per-sale forever" |
| Auto-calculate USD amount | "Auto-calculated USD amount." | |
| Type received USD | "Customer hands me 8 USD." | |
| Change in SRD or USD (configurable) | "Change shows in both currencies — give the SRD." | |
| Complete → receipt | "Receipt shows both amounts — SRD line and USD line — with the rate used." | "Receipt: SRD + USD + rate" |

---

## Closing — 20 s

> "Cash. Card with bank-statement reconciliation. Bank transfer with proper awaiting-confirmation lifecycle. Mobile wallets. Foreign cash with the rate locked per sale forever. No fudging, no spreadsheets, no end-of-day surprises. Built for the way Suriname actually pays."

**Final on-screen caption:** "Every payment method, the way Suriname actually pays."

---

## Post-recording

- Long script — if it runs over 5 min, drop Scene 5 (mobile wallets are essentially the same flow as bank transfer; one mention in narration covers it).
- Title: *"Josbin POS — every Surinamese payment method, properly handled."*
- This is the script most likely to be asked about at sales meetings. Keep one ready to send.
