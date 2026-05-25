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

## 9.1 Opening the End of Day screen

1. In the top bar, click **End of Day** (Dutch: *"Dagafsluiting"*).
2. The End of Day screen opens with two sections: **Today's Summary** and **Cash Reconciliation**.

---

## 9.2 Reviewing today's summary

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

## 9.3 Cash reconciliation — counting the cash

Cash reconciliation is the process of comparing the cash in the drawer against what the system expects.

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

**Step 3 — If there is a discrepancy: add a note**

If the discrepancy is more than SRD 0.01 (i.e. not a rounding difference), a **Note** field appears automatically.

1. Type an explanation in the note field. Examples:
   - *"Shortfall waarschijnlijk door wisselgeld fout bij sale #2026-00038"*
   - *"Overschot — onbekende oorzaak, wordt onderzocht"*
2. The note is saved in the audit log and visible to management.
3. The note is **required** before you can close. You cannot skip it.

---

## 9.4 Closing the Z-Report

1. Once the actual cash amount is entered and any required note is written:
2. Click **Close day / Print Z-Report** (Dutch: *"Dag afsluiten / Z-rapport afdrukken"*).
3. The system:
   - Locks today's figures
   - Attempts to sync data to headquarters
   - Prints the Z-Report to the receipt printer (if configured)
4. The button turns green and shows: *"Day closed successfully"* (Dutch: *"Dag succesvol afgesloten"*).

> **Warning:** This action cannot be undone. Double-check your cash count before closing.

---

## 9.5 The 7-day history table

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

## 9.6 What to do if sync fails (status = Failed or Pending)

The system has automatic retry. It will try again at 1 min → 5 min → 15 min → 30 min intervals.

If it still shows Failed after 30 minutes:

**Option A — Wait for internet to restore:**
The system retries automatically. When internet returns, it will sync.

**Option B — Export to USB and deliver manually:**
1. In the history table, find the day with the failed sync.
2. Click the **💾 .josbin_pos** button on that row.
3. A `.josbin_pos` file downloads to your computer.
4. Save this file to a USB drive.
5. Deliver the USB to head office, or send the file via WhatsApp/email.
6. Head office uploads the file in the Super Admin Dashboard.

> **Important:** The `.josbin_pos` file is encrypted (AES-256). It is safe to send via email or WhatsApp.

---

## 9.7 X-Report — mid-day snapshot

The X-Report gives you a snapshot of sales so far **without closing the day**.

1. In the top bar, go to **Reports** (see [Chapter 11](11-reports.md)).
2. Click the **X-Report** tab.
3. Current totals appear with a yellow banner confirming this is not a close.

The X-Report is used by managers to check mid-day performance. It does not affect the Z-Report or end-of-day figures.

---

## End-of-day checklist

Before leaving for the night, go through this checklist:

- [ ] All held bills have been completed or cleared
- [ ] Actual cash in drawer has been counted
- [ ] Cash reconciliation has been entered
- [ ] Discrepancy note added if needed
- [ ] Z-Report has been closed
- [ ] Sync status is "Sent ✓" (green)
- [ ] Cash drawer is closed and secured
- [ ] POS terminal screen is locked or application is closed
