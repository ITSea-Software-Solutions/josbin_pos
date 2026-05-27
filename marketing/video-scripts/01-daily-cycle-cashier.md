# Script 01 — Daily cycle: open register → first sale → Z-Report

**Goal:** show a cashier's full day in one continuous take. Demystifies the till for trainers, store managers shopping the product, and clients who want to picture what their staff will actually do.

**POV:** Cashier (`kassa@dehoop.sr / Cashier@2026`).

**Target length:** 4 min 30 s.

**Pre-recording checklist**

- [ ] Demo stack running, POS at `http://localhost:5173`.
- [ ] Browser locale set to nl-NL. Window 1366 × 820, zoom 100 %.
- [ ] No register is open for today (close any from yesterday's run).
- [ ] Daily rate is locked for today — visit Dashboard → Daily Rate as OA if it isn't. (Sale completion fails without it; you don't want that on the recording.)
- [ ] A few products with photos seeded. The Suriname demo seeder does this — just confirm the grid looks populated.
- [ ] Loom record button armed. Window selected, not "whole screen" (avoid the dock).

---

## Opening hook — 10 s

> "If you walk into a Surinamese supermarket at 8 in the morning, the first thing the cashier does is open the till. I'm going to take you through a complete day in 4 minutes — opening the register, ringing up a customer, and closing out at the end of the day for Belastingdienst."

**On-screen caption:** "A cashier's day in 4 minutes."

---

## Scene 1 — Login & open register (60 s)

| Click | Narration | Caption |
|---|---|---|
| Login screen visible | "So I'm logging in as a cashier called Kassa De Hoop. Same screen any cashier sees on a Windows till anywhere in Suriname." | |
| Type email + password, click **Inloggen** | "Password — and I'm in. Notice the language is Dutch by default. One click in the corner switches to English if the cashier prefers." | |
| Land on Open Register screen | "The system knows there's no open register on this till yet, so it parks me here." | |
| Pick register from dropdown (or auto-selected) | "I pick *Kassa 1*. If there's only one, it auto-selects." | "Auto-selects when there's only one" |
| Type opening float: 200 | "Opening float — the cash already in the drawer. I put SRD 200." | |
| Click **Openen / Open** | "And we're open." | |

---

## Scene 2 — Build the cart (75 s)

| Click | Narration | Caption |
|---|---|---|
| Product grid visible | "This is the main POS screen. Products by category on the left. Cart on the right. Total at the bottom." | |
| Click 2× a category (Zuivel / Dairy) | "Customer's buying yoghurt and bread. I tap the yoghurt twice — two cartons in the cart." | |
| Click Bread category, then bread product | "Bread once." | |
| Show the BTW column on the cart | "Notice the cart shows the BTW per line — that's the Suriname VAT. Currently 10 percent. Some items like basic foodstuffs are BTW-exempt and the system handles that automatically per product." | "BTW handled per product" |
| Click discount icon on a line | "Customer's a regular — I'll give them 5 SRD off the bread. Click the line, enter discount." | |
| Confirm discount applied + total updates | "Discount applies, BTW recalculates correctly *after* the discount — that's the Belastingdienst order, not a guess." | "Discount-then-BTW = correct order" |

---

## Scene 3 — Take payment (45 s)

| Click | Narration | Caption |
|---|---|---|
| Click **Afrekenen / Checkout** | "Customer's ready to pay. Checkout." | |
| Payment modal opens, three big buttons | "Three options up front — cash, card, mixed. There are more under *Meer betaalwijzen* but 90 percent of sales go cash or card." | |
| Click **Contant / Cash** | "Customer's paying cash." | |
| Type 50, see change | "I type the amount received — 50. Change shows immediately — 2 SRD 50." | |
| Click **Voltooien / Complete** | "Complete." | "Drawer opens automatically" |
| Receipt preview appears | "Receipt prints to the thermal printer. Drawer pops open. Done." | |
| Print receipt | "Customer gets their receipt — bilingual, with the BTW breakdown Belastingdienst wants to see." | |

---

## Scene 4 — End of day Z-Report (90 s)

| Click | Narration | Caption |
|---|---|---|
| Back on POS screen, click ☰ menu | "End of the day. Cashier opens the menu." | |
| Click **Z-Rapport / Z-Report** | "Z-Report — that's the formal day-close." | |
| Z-Report screen shows totals | "System shows what it thinks happened today — sales count, total SRD, BTW collected, payment breakdown." | |
| Cash count input | "Manager counts the physical cash in the drawer and types the actual number here." | |
| Show discrepancy field if different | "If it's off, the system flags it red and asks for a note. That note lands in the audit log forever." | "Audit log records every variance" |
| Click **Sluit dag / Close day** | "Close. The day is now immutable — no more sales can be rung against today." | |
| Sync indicator confirms | "If there's internet, it syncs to head office in seconds. If there isn't, it queues and retries — five separate fallback layers, all the way down to a USB stick that the manager can carry to a place that has WiFi." | "5 sync fallback layers — never lose a sale" |

---

## Closing — 20 s

> "That was a complete cashier day, opening to closing — and every step from the BTW calculation to the audit log is exactly what Belastingdienst Suriname and the Rekenkamer expect to see when they ask. No spreadsheets, no manual re-keying, no compliance surprises."

**Final on-screen caption:** "Josbin POS — built for Suriname."

---

## Post-recording

- Trim opening "ok, recording" and closing tail.
- Add the captions if Loom didn't pick them up live.
- Set title: *"Josbin POS — A cashier's full day in 4 minutes."*
- Share link in the demo deck.
