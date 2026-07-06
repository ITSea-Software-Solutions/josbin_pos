# Chapter 5a — Refunds and Voids

This chapter shows you how to give money back to a customer for a sale that already completed, and how to cancel a sale that is still being rung up.

There are **two** different things, and Josbin POS handles them differently:

| Situation | What you do | Result |
|---|---|---|
| Customer changed their mind **before payment** — sale still on screen | Remove the line items from the cart (Chapter 4) or **discard the bill** | No sale row created |
| Customer wants money back **after payment** — sale already saved | **Refund** (this chapter) | A new refund row is created, original sale stays |
| You made a typo and need to cancel a completed sale entirely (e.g. wrong items rung) | **Void** (this chapter) | Sale status flips to `voided`, totals removed from reports |

> **Important difference:** A refund creates a **new row** that offsets the original sale. The original stays intact in the audit log and reports. A void marks the original as cancelled — it never happened, as far as totals go. Belastingdienst Suriname expects refunds for after-payment corrections, not voids. Use refunds in normal day-to-day; reserve voids for genuine "this sale should never have existed" cases.

---

## 5a.1 Who can do refunds and voids

| Role | Refund | Void |
|---|---|---|
| Cashier (default) | ❌ — needs manager | ❌ — needs manager |
| Store Manager | ✅ | ✅ |
| Organisation Admin | ✅ | ✅ |

A cashier ringing on the till sees a **"Manager approval required"** prompt when they tap **Refund**. The manager scans their card / enters their PIN / signs in on the same terminal to authorise. Same flow for voids.

This split is deliberate — it satisfies the Suriname audit requirement (Belastingdienst + Rekenkamer) that no single user can both ring up AND reverse a sale.

---

## 5a.2 How to issue a refund

**Path:** POS → **Sales / Verkopen** tab (top of POS screen) → find the sale → click the **↺ Refund / Terugbetalen** button on its row.

### Step 1 — Find the original sale

The Sales tab lists today's sales by default. To find an older one:

- **Date picker** at the top — pick yesterday / a week ago / a specific date.
- **Search box** — type the sale number (e.g. `S-2026-001234`) or the customer's name.
- **Filter by status** — completed / voided / refunded.

Each row shows: time, sale number, customer (if any), total, payment method, and the action buttons.

### Step 2 — Open the Refund modal

Click **↺ Refund / Terugbetalen** on the sale's row.

If you're not a manager: you'll see a **Manager approval** prompt (Dutch: *"Manager goedkeuring vereist"*). Hand the terminal to your manager; they log in, the modal opens.

### Step 3 — Pick what to refund

The modal shows every line on the original sale with its quantity. You can:

- **Full refund** (Dutch: *"Volledige terugbetaling"*) — leave all quantities at their original value; the total refund matches the original total.
- **Partial refund — quantity** (Dutch: *"Gedeeltelijke terugbetaling"*) — type a smaller quantity in the **Refund qty / Aant. terug** column for any line. Common case: customer bought 6 yoghurts, 2 went off, refund 2.
- **Partial refund — entire line** — type `0` for lines you're not refunding; only the ones with qty > 0 are refunded.
- **Cannot refund more than original** — the field caps at the original quantity. The right-hand column updates live to show the refund total in SRD.

> **What about the BTW (VAT)?** Don't worry about it. Josbin POS recalculates the refund BTW from the original line's BTW rate automatically, with discount-then-tax order preserved (same calculation as the original sale). Refund receipt shows the BTW breakdown.

### Step 4 — Reason for refund (required)

The **Reason / Reden** field is required and must be at least 5 characters. Examples:

- `Wrong product taken — customer returned it sealed`
- `Damaged item — see voucher REF-204`
- `Manager approved goodwill refund — long-term customer`

This reason lands in the audit log and the Rekenkamer export. Write it for someone who will read it 6 months from now.

### Step 5 — Confirm

Tap **✓ Confirm refund / Bevestig terugbetaling**. Three things happen:

1. A **refund row** is saved (new sale number, status `refunded`, negative totals).
2. Stock is **added back** automatically for refunded lines (the customer's returning the items).
3. The cash drawer **opens** if the original payment was cash or mixed (you need to give the cash back).
4. A **refund receipt** prints and is shown on screen with the refund number — give the printed copy to the customer.

The Sales tab updates immediately to show the refund row right under the original sale (linked).

---

## 5a.3 Cash drawer behaviour on refunds

| Original payment | What opens |
|---|---|
| Cash | Cash drawer opens — give the cash back |
| Card | Drawer stays closed — you do the card refund on the bank's PIN terminal separately, then mark **Skip & complete** in the recon panel |
| Mixed (cash + card) | Drawer opens for the cash portion; do the card portion separately |
| Bank transfer | Drawer stays closed — refund the customer's bank account separately and record the bank's outbound reference in the refund's note field |
| Mobile transfer | Same as bank transfer |
| Foreign cash | Drawer opens — refund in the same currency at the day's locked rate (no FX gain/loss for the customer) |

> **Card refunds in Suriname:** Our system does not talk to the bank's PIN terminal. You must do the card refund on the terminal first (using the bank's slip), then record it in Josbin POS. The receipt prints "Refunded via card · Bank · Auth #" when the cashier fills in the recon panel on the refund.

---

## 5a.4 How to void a sale

**Use when:** the sale was completely wrong (wrong customer charged, test sale, system test). For "give some money back" use a refund.

**Path:** POS → **Sales / Verkopen** tab → find the sale → click the **✗ Void / Annuleer** button.

### Step 1 — Manager approval

Cashiers see the approval prompt. Managers proceed directly.

### Step 2 — Reason (required)

Same field as refunds — at least 5 characters. Examples:

- `Test sale during morning setup — should not be in reports`
- `Charged the wrong customer — re-rang under correct account`
- `Cashier error — duplicate ring-up`

### Step 3 — Confirm

The sale's status flips to `voided`. Effects:

1. **Totals removed** from daily / monthly / BTW reports — as if the sale never happened.
2. **Stock returned** for all items on the sale.
3. **Cash drawer opens** if the original payment was cash (you owe the customer the cash back) — but only if the void happens **on the same day** as the sale.
4. **Voided sales stay in the audit log** forever with the void reason, voiding user, and timestamp.
5. **Receipt is NOT reprinted** — voids cancel; refunds reverse with paperwork.

> **What changes on the receipt?** Nothing — the original receipt the customer has is still valid paper, but the void in the system means the totals don't count. If the customer asks for a return, they should still see "VOIDED" stamped clearly. Best practice: never void a sale that already had a printed receipt go out the door; use a refund instead.

---

## 5a.5 What about refunding a refund? (Re-rings)

You can't refund a refund. If you made a mistake on the refund itself (wrong items / wrong quantity), do **another** refund on the original sale for the difference, OR void the wrong refund first and start again.

If neither path works (e.g. the original sale is already fully refunded), do a **manual cash adjustment** at the till and document the case in the audit log via the Notes feature. Manager judgement call — Rekenkamer auditors expect to see the paper trail.

---

## 5a.6 Common situations

### "Customer says the product is faulty"
1. Verify the issue (visually inspect, or check the product reference).
2. Open the Sales tab, find their sale, click **↺ Refund**.
3. Pick the faulty line only. Reason: `Faulty product — see issue ref XYZ`.
4. Confirm → give cash back / process card refund / etc.
5. Set the returned item aside in the "to manager" pile. The manager decides return-to-supplier vs scrap.

### "Customer wants to exchange — same value"
Two approaches:
- **Quick:** Ring the new item as a new sale, refund the old one. Two clean transactions, easy to audit.
- **Manual:** Some shops do off-system exchanges of equal value. Josbin POS does NOT support a single "exchange" button by design — too easy to lose track of stock and BTW. Always do two transactions.

### "Customer paid by card — return is more than I have in cash drawer"
Refunds go back **the same way they came in**. Card sales refund to the card via the bank's PIN terminal, not from your cash drawer. If you've accidentally tried to refund cash from a card sale, void the wrong refund and do it properly via the terminal.

### "Sale closed days ago — can I still refund?"
Yes. As long as the day's Z-Report isn't blocked, you can refund any past sale. The refund counts against **today's** totals (not the original day's), with the original day's audit trail preserved on both rows.

### "Customer wants a partial refund on a B2B invoice (bank transfer)"
Process the refund in Josbin POS, then do the outbound bank transfer separately from your bank app. Record the outbound reference in the refund's note: `Outbound transfer ref OUT-2026-05-26-001`. OA confirms when funds leave the account (same Pending Payments flow but inverted — future improvement).

### "Customer has no receipt and I can't find the sale anywhere"
Search §5a.2 properly first — date picker, sale number, customer name. If the sale genuinely cannot be found, a manager can process a **blind return** — see §5a.8. Cashiers: call your manager; you cannot do this one yourself.

---

## 5a.7 What ends up in the audit log

Every refund and void writes an audit_logs entry that an Auditor or Rekenkamer inspector can read:

| Field | Refund | Void |
|---|---|---|
| event | `sale.refunded` | `sale.voided` |
| auditable_id | refund sale id (new row) | original sale id |
| old_values | (null) | `{"status": "completed"}` |
| new_values | `{"refunds_sale_id": "...", "reason": "...", "lines": [...]}` | `{"status": "voided", "reason": "...", "voided_by": "..."}` |
| user_id | the manager who approved | the manager who approved |
| ip_address | terminal IP | terminal IP |
| timestamp | AST timezone | AST timezone |

The dashboard's Audit Log screen ([dashboard_manual/13](../dashboard_manual/13-audit-log.md)) lets the OA / Auditor filter for these events and click into any one to see the full diff.

Blind returns (§5a.8) write their own event, `sale.blind_return`, carrying the reason, the refund total and BTW, the payment method, the line count and the manager who confirmed.

---

## 5a.8 Return without a receipt — blind return

Sometimes a customer brings goods back with **no receipt**, and the sale can't be found on the Sales tab either — wrong day, bought at another branch, or a till that wasn't this one. For that case Josbin POS has the **blind return** (Dutch: *Retour zonder bon*): a return with no original sale behind it.

> **Last resort.** A blind return creates money-out with nothing to check it against, so always work through §5a.2 first: date picker, sale number, customer name. Only fall back to a blind return when the original sale genuinely cannot be found.

### Who can do it

**Managers only.** The blind-return button is visible to Store Managers and Organisation Admins — cashier accounts never see it, and there is no approval prompt to hand over. If a customer arrives at a cashier's till without a findable receipt, the cashier calls the manager, and the manager does the whole thing (or signs in on that terminal).

### How to do it

1. **Build the return in the normal cart.** Add the items the customer is returning exactly as you would for a sale — tap, scan or search (Chapter 4) — and set the quantities to what is actually coming back.
2. **Check the prices.** The cart shows *today's* catalogue price. If the customer paid something different (an old price, a discount at the time), edit the line price — there is no original sale to copy from, so **the prices in the cart are the amounts that will be refunded**.
3. Tap the red **↩ Return without receipt** button at the bottom of the cart panel (below the Pay button — manager accounts only).
4. The window shows the item count and the refund total in red (e.g. **− SRD 45.00**).
5. Pick **Refund via**: cash, card, bank transfer, mobile, or QR wallet (Mopé / Uni5Pay+). Same practicalities as §5a.3 — card and bank refunds are executed on the bank's terminal or bank app; Josbin POS records them.
6. **Reason (required, at least 5 characters).** Tap a quick-reason chip — *Damaged / Expired / Wrong item / Customer request* — or choose *Other* and type your own. Write it for the auditor who reads it in 6 months.
7. Tap **Confirm return**. Hand the customer their money. For cash: the drawer does **not** open automatically on a blind return — open it with the drawer key (or the **Test drawer** button in Settings, Chapter 13 §13.2) and count carefully.

### What happens in the system

1. A **negative sale** is posted with its own sale number, marked internally as `BLIND RETURN:` plus your reason. It counts against **today's** totals.
2. **BTW is extracted from the refund amount** automatically at each line's BTW rate (exempt items stay at SRD 0.00), so the day's BTW report remains correct.
3. **Stock is restored** for every catalogue-linked line — the goods are going back on the shelf.
4. If the manager confirming it has an **open register session** on this till, the return is tied to that session and a cash refund lowers its expected drawer cash automatically.
5. A **heavyweight audit event** `sale.blind_return` is written: manager's name, reason, refund total, BTW, payment method, line count, terminal IP. This is precisely the kind of event Belastingdienst and Rekenkamer auditors zoom in on — a store with many blind returns will be asked why.
6. The return appears on the **Transactions** tab like any sale (negative total); print the PDF receipt from there if the customer wants proof.

> **Whose drawer?** The return is linked to the register session of the **manager who confirms it**. If you (the manager) have no open session on this till and the cash comes out of the *cashier's* drawer, also record a **pay-out** for the same amount on that drawer (Chapter 3 §3.2a, reason e.g. `blind return S-2026-001240`) — otherwise the cashier counts short at close for money you handed out.

> **Daily rate needed:** like a sale, a blind return requires today's USD→SRD rate to be locked. If you see a "no daily rate" message, lock the rate first (top bar → Exchange Rate) and try again.

---

## See also

- [Chapter 4 — Making a sale](04-making-a-sale.md) — the inverse: building a sale up
- [Chapter 5 — Taking payment](05-payment.md) — how the original sale was paid
- [Chapter 10 — End of day](10-end-of-day.md) — refunds and voids on the Z-Report
- [POS user manual ch 11 — Reports](11-reports.md) — finding refunds in the daily report
- [Dashboard manual ch 11 — Z-Reports & Sync](../dashboard_manual/11-z-reports-and-end-of-day-sync.md) — refund attribution in the HQ view
