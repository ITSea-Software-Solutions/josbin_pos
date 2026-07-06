# Chapter 10 — End of Day: Z-Report & Cash Reconciliation

**Who does this:** Store manager (or authorised supervisor)
**When:** At the end of every trading day, after the last sale

The Z-Report formally closes the register for the day. It:
- Locks the day's sales figures
- Records the cash count
- Sends (syncs) all sales data to headquarters
- Creates an immutable audit record

> **Important:** The Z-Report can only be run once per day. Make sure all sales for the day are completed before closing.

---

## 10.1 Opening the End of Day screen

1. In the top bar, click **End of Day** (Dutch: *"Dagafsluiting"*).
2. The End of Day screen opens with two sections: **Today's Summary** and **Cash Reconciliation**.

---

## 10.2 Reviewing today's summary

Before closing, review the summary to make sure the numbers look correct:

| Field | What it means |
|-------|--------------|
| Total sales (SRD) | Total revenue for the day |
| Transaction count | Number of completed sales |
| Total BTW | Total tax collected |
| Cash total | Sales paid in cash |
| Card total | Sales paid by card |

If any number looks wrong, do not close the day yet. Review recent sales or contact your manager.

---

## 10.3 Cash reconciliation — counting the cash

Cash reconciliation is the process of comparing the cash in the drawer against what the system expects.

> **What does the system expect?** The Z-Report's expected cash is the day's **net cash sales**: everything paid fully in cash, minus cash refunds and returns. It does **not** include your opening float (that's why you don't count it — see Step 1), the cash portion of mixed payments, or pay-ins/pay-outs recorded at a register during the day ([Chapter 3 §3.2a](03-register.md)). Those movements reconcile automatically when each cashier closes their **register session** — at day level you reference them in the note when they explain a difference.

**Step 1 — Count the cash in the drawer**

Count every note and coin in the cash drawer. Do not include:
- Change float (the starting cash you put in the drawer this morning)
- Personal money

Write down or remember the total.

**Step 2 — Enter the actual cash amount**

1. In the Cash Reconciliation section, find the **"Actual cash"** field (Dutch: *"Werkelijk kasgeld"*).
2. Click the field and type the total cash you counted (e.g. `487.50`).
3. The **Discrepancy** line appears immediately:
   - **Green** = counts match ✓
   - **Red** = there is a difference

**Discrepancy examples:**

| Expected | Actual | Discrepancy | Meaning |
|---------|--------|------------|---------|
| SRD 500.00 | SRD 500.00 | SRD 0.00 ✓ | Perfect match |
| SRD 500.00 | SRD 495.00 | − SRD 5.00 | Cash short (possible error or theft) |
| SRD 500.00 | SRD 502.00 | + SRD 2.00 | Cash over (change error) |
| SRD 500.00 | SRD 400.00 | − SRD 100.00 | A **recorded pay-out** (e.g. SRD 100 supplier paid from the drawer, Chapter 3 §3.2a) — not missing money. Name the movement in the note and the count is explained. |

> **Pay-ins and pay-outs:** cash movements recorded during the shift auto-reconcile on each cashier's register-session close, but the day-level expected figure above does **not** subtract them — a recorded SRD 100 pay-out therefore still shows here as −100. That is fine: point to it in the note (*"pay-out leverancier, zie kassasessie Kassa 1"*) and the discrepancy is accounted for. An **unrecorded** pay-out, on the other hand, looks exactly like missing cash — which is why Chapter 3 §3.2a insists you record every movement the moment it happens.

**Step 3 — If there is a discrepancy: add a note**

If the discrepancy is more than SRD 0.01 (i.e. not a rounding difference), a **Note** field appears automatically.

1. Type an explanation in the note field. Examples:
   - *"Shortfall waarschijnlijk door wisselgeld fout bij sale #2026-00038"*
   - *"Overschot — onbekende oorzaak, wordt onderzocht"*
2. The note is saved in the audit log and visible to management.
3. The note is **required** before you can close. You cannot skip it.

---

## 10.4 Closing the Z-Report

1. Once the actual cash amount is entered and any required note is written:
2. Click **Close day / Print Z-Report** (Dutch: *"Dag afsluiten / Z-rapport afdrukken"*).
3. The system:
   - Locks today's figures
   - Attempts to sync data to headquarters
   - Prints the Z-Report to the receipt printer (if configured)
4. The button turns green and shows: *"Day closed successfully"* (Dutch: *"Dag succesvol afgesloten"*).

> **Warning:** This action cannot be undone. Double-check your cash count before closing.

---

## 10.5 The 7-day history table

Below the cash reconciliation section, a history table shows the last 7 closed days:

| Column | Description |
|--------|-------------|
| Date | The date of that closed day |
| Total sales | Revenue for that day |
| Total BTW | Tax collected |
| Status | Sync status (see below) |
| Export button | Download the data as a .josbin_pos file |

**Sync status meanings:**

| Status | Colour | Meaning |
|--------|--------|---------|
| Sent ✓ | Green | Data has been successfully sent to headquarters |
| Pending | Yellow | Waiting to sync (e.g. no internet right now) |
| Failed | Red | Sync failed — needs attention |

---

## 10.6 What to do if sync fails (status = Failed or Pending)

Josbin POS has **five layers of sync** so a day's data is never trapped on a single terminal. You don't have to memorise them — but knowing they exist explains why "Failed" usually fixes itself.

**Layer 1 — real-time:** every sale you ring tries to push to the cloud within seconds. Quiet success, no UI noise.

**Layer 2 — auto retry on a schedule:** if Layer 1 fails (internet drop), the system retries the failed batch at **1 minute → 5 minutes → 15 minutes → 30 minutes**. You don't do anything — the yellow "Sync pending — N transactions queued" indicator on your manager screen tells you it's working through the backlog.

**Layer 3 — forced retry on Z-Report close:** when you tap **Submit to Headquarters**, the system attempts the sync *right now*, with all queued days, in chronological order. This is the deliberate "I want this to land NOW" path. The button works even if Layer 2 has been quietly retrying — you're telling it to try once more, immediately.

**Layer 4 — USB encrypted export:** if Layers 1–3 all fail (extended outage, dongle dead), use the manual export path below. AES-256 encrypted file, safe to send via email or WhatsApp.

**Layer 5 — catch-up on internet restore:** the local server pings the cloud every 60 seconds. As soon as the internet comes back, **all queued days sync automatically in chronological order**, with each marked "synced late" in the audit log + sync timestamp. You don't have to re-tap anything; you'll see the row colour flip from yellow to green on its own.

### What you should actually do

**If status = Pending:** ignore it for 30 minutes. Layer 2 is retrying. If still pending after that, check the internet connection — restoring it triggers Layer 5 automatically.

**If status = Failed (after 30+ min):**

**Option A — Tap Submit to Headquarters again:** Layer 3 forced retry. Often works because Layer 2 has been quietly fixing the backlog and only the most recent submission stayed red.

**Option B — Wait for internet to restore:** Layer 5 picks it up automatically when connectivity returns.

**Option C — Export to USB and deliver manually (Layer 4):**
1. In the history table, find the day with the failed sync.
2. Click the **💾 .josbin_pos** button on that row.
3. A `.josbin_pos` file downloads to your computer.
4. Save this file to a USB drive.
5. Deliver the USB to head office, or send the file via WhatsApp/email.
6. Head office uploads the file in the Super Admin Dashboard.

> **Important:** The `.josbin_pos` file is encrypted (AES-256). It is safe to send via email or WhatsApp.

> **Did you know:** discrepancy notes you typed during cash reconciliation are visible to your manager in the audit log — even if the day's sync to HQ is delayed. So "I'll explain this discrepancy when I get back to head office" already happened; the note is already there. Type carefully.

---

## 10.7 X-Report — mid-day snapshot

The X-Report gives you a snapshot of sales so far **without closing the day**.

1. In the top bar, go to **Reports** (see [Chapter 11](11-reports.md)).
2. Click the **X-Report** tab.
3. Current totals appear with a yellow banner confirming this is not a close.

The X-Report is used by managers to check mid-day performance. It does not affect the Z-Report or end-of-day figures.

---

## End-of-day checklist

Before leaving for the night, go through this checklist:

- [ ] All held bills have been completed or cleared
- [ ] All cash pay-ins / pay-outs were recorded with a reason ([Chapter 3 §3.2a](03-register.md))
- [ ] Actual cash in drawer has been counted
- [ ] Cash reconciliation has been entered
- [ ] Discrepancy note added if needed
- [ ] Z-Report has been closed
- [ ] Sync status is "Sent ✓" (green)
- [ ] Cash drawer is closed and secured
- [ ] POS terminal screen is locked or application is closed
