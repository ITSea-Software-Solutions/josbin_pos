# Chapter 3 — Your Register: Open, Close, Reopen

**Who does this:** Cashier (open + close), Store Manager (approve reopen requests)
**When:** Open at the start of your shift, close at the end

Before you can sell, you must **open a register session**. A register session links every sale you ring up to a specific cash drawer and a specific time period. At end of shift, you **close the session** and the system reconciles your cash count against the expected amount.

> **Why this matters:** every sale belongs to one register session. If two cashiers share a drawer, only one session is open at a time. This is what makes the end-of-shift cash count meaningful.

---

## 3.1 Opening your register (start of shift)

After you log in and pick your store, you land on the **Open Register** screen.

**Steps:**

1. **Pick the register** you'll be using (e.g. *Kassa 1*, *Kassa 2*). The list shows all registers configured for your store — tap the one you want.
   - If your store has only **one** register, this step is skipped and you go straight to the opening float.
   - If a register already has an open session (another cashier didn't close), opening will fail with an error. Ask them to close first, or have a manager close it on their behalf.
2. **Enter the opening float** — the cash already in the drawer when you start (e.g. `200.00`).
   - This is the "starting bank" the manager left in the drawer overnight or that you brought from petty cash.
   - Use the decimal point — `200.00`, not `200,00`.
3. Tap **Open Register**.

**What happens next:**
- The session is created with status *Open*.
- You're taken to the POS screen.
- Your name + register name + opening float now show in the top bar.

> **Tip:** if you make a mistake on the opening float, you can fix it by closing the session immediately (with the same number you actually counted as the closing cash) and opening a new one with the correct float. No sales lost.

---

## 3.2 During your shift

Every sale you complete is automatically tied to your open register session. You don't need to do anything special — just sell.

You can check the day's running totals in the top bar:
- **Today's sales** — running SRD total since opening.
- **Transactions** — count of completed sales.

If you need to switch terminals mid-shift (e.g. printer broke on Kassa 1), close the current session first, walk over to Kassa 2, and open a new session there.

---

## 3.3 Closing your register (end of shift)

When you've finished selling for the day (or your shift), close the register so the next cashier (or end-of-day Z-Report) has a clean number to reconcile.

**Steps:**

1. In the top bar, tap the red **Close register** button (Dutch: *"Kassa sluiten"*).
2. The **Close Register** modal opens. It has 4 steps shown one after the other.

### Step 1 — Session report

Shows what the system thinks happened this shift:

| Field | What it means |
|-------|--------------|
| Sales count | Number of completed sales |
| Cash sales | SRD amount paid in cash |
| Card sales | SRD amount paid by card |
| Total BTW | Tax collected |
| Opening float | What you started with |
| **Expected cash** | Opening float + cash sales (this is what should be in the drawer) |

Tap **Next** to count the cash.

### Step 2 — Count the cash

Open the drawer and count every note and coin physically.

1. Enter the **actual cash counted** in the input field.
2. If the number differs from the expected cash, the system shows the **discrepancy** in red below (e.g. *"SRD 5.00 tekort"* = short, *"SRD 5.00 overschot"* = surplus).
3. **If there is a discrepancy, you must type a reason in the notes field** — for example *"telfout"* (counting error) or *"klant kreeg te veel wisselgeld"* (customer was given too much change). The **Review and close** button stays disabled until you fill it in. (If the count matches exactly, the note is optional.)
4. Tap **Review and close** to continue.

> **The system never blocks you for the size of the discrepancy.** It records the difference (and your note) for the manager and the audit log. Small differences happen and are normal — just say why.

### Step 3 — Confirm close

Review the summary. This is your last chance to go back. Tap **Close register** to finalise.

### Step 4 — Closed confirmation

The session is now closed. The screen shows:
- **Kassa gesloten** ✓ — confirmation.
- **Final cash counted** and **discrepancy** if any.
- A **Request reopen** button (see 3.4) in case you realise something was wrong.
- A **Close window** button — closes the modal and logs you out.

Once you tap Close, you're returned to the login screen. The next cashier can log in and open their own session.

---

## 3.4 Requesting a reopen (if you closed too early)

Sometimes you close the register and then realise you missed a sale, miscounted, or need to refund. You can request a reopen — but **a manager must approve it** before the register accepts new transactions.

**Steps:**

1. After closing, the confirmation screen has a **Request reopen** button. Tap it.
2. Enter a clear reason in Dutch or English (e.g. *"Klant kwam terug voor retour"* — customer returned for a refund, *"Telfout, kassa niet juist gesloten"* — counting error, register was closed wrongly).
3. Tap **Send request**.
4. You see **Verzoek ingediend** (*"Request submitted"*).

Now the manager sees a pending request in the Dashboard → **Registers** screen with an amber banner. Once they approve, you log back in, pick the same register, and the session resumes (no need to re-enter opening float).

> **Important:** if you close the app or log out before the manager approves, that's OK — when you log back in, the system will route you straight to the reopened session.

---

## 3.5 What to do if the register is stuck

| Symptom | Fix |
|---------|-----|
| Can't pick a register — all show "in use" | Another session is still open. Ask the previous cashier to close, or have a manager close it for them in Dashboard → Registers. |
| Stuck on Open Register screen, no registers listed | No registers exist for your store yet. Ask manager to create one in Dashboard → Registers → Manage. |
| Discrepancy is huge (>SRD 50) | Don't close yet. Recount. If still off, call the manager — there may be a missing void or refund. |
| Closed by accident with sales not synced | Sales are saved locally and will sync when reopened or via Z-Report. No data lost. |

---

## 3.6 Quick reference — daily flow

```
MORNING
  Log in → Pick store → Pick register → Enter opening float (e.g. 200.00)
                                                                    │
                                                                    ▼
SHIFT                                                  POS screen — sell all day
                                                                    │
                                                                    ▼
END OF SHIFT
  Top bar → Close register → Session report → Count cash → Confirm → Closed ✓
                                                                    │
                                                       (Optional)   │
                                                                    ▼
  Request reopen → Manager approves → Continue
```

The store-level **End of Day / Z-Report** (Chapter 10) is a separate manager-only step that runs after **all** cashiers have closed their registers. Don't confuse the two — closing your register ≠ closing the day.

---

→ Next: [Chapter 4 — Making a Sale](04-making-a-sale.md)
