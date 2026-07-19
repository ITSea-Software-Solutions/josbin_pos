# Chapter 3 — Your Register: Open, Close, Reopen

**Who does this:** Cashier (open + close), Store Manager (approve reopen requests)
**When:** Open at the start of your shift, close at the end

Before you can sell, you must **open a register session**. A register session links every sale you ring up to a specific cash drawer and a specific time period. At end of shift, you **close the session** and the system reconciles your cash count against the expected amount.

> **Why this matters:** every sale belongs to one register session. If two cashiers share a drawer, only one session is open at a time. This is what makes the end-of-shift cash count meaningful.

---

## Register vs. session — what the words mean

People mix these up. They are **two different things**:

| | **Register (a.k.a. Kassa)** | **Register session (a "shift")** |
|---|---|---|
| What it is | The physical till — one terminal, one cash drawer, one printer | One cashier's open shift on one register |
| How long it lives | Forever (until someone deactivates it) | One shift (typically a few hours, ending when you close) |
| Who creates it | **Manager / Org Admin** — once, in the Dashboard | **You, the cashier** — every shift, on the POS |
| Where | Dashboard → Registers → Manage tab → **+ Add register** | POS → Open Register screen → **Open** |
| How many at once | A store has 1–12 (Kassa 1, Kassa 2, …) | One open session per register at a time |

Put differently: the **register** is the lane at the front of the shop. The **session** is your shift behind that lane today. Two cashiers can share Kassa 1 across two shifts (you open + close it; the next cashier opens + closes it again later). Two cashiers cannot share Kassa 1 *at the same time* — for that, the manager creates a second register (Kassa 2).

**You never create a register yourself.** If the **Open Register** screen shows you no registers to pick from, your manager hasn't created them yet — ask them to add one in Dashboard → Registers → Manage.

---

## 3.1 Opening your register (start of shift)

> **Where this happens:** in the **POS app** on the till — not the dashboard. If you're on a back-office computer, look for the **Josbin POS** icon on the desktop and double-click. If you don't have a till nearby, a manager can open the POS in their browser via Dashboard → **POS-app openen / Open POS app**.

After you log in and pick your store, you land on the **Open Register** screen.

![Open Register screen — list of available registers](screenshots/03-open-register-gate.png)

**Steps:**

1. **Pick the register** you'll be using (e.g. *Kassa 1*, *Kassa 2*). The list shows all registers configured for your store — tap the one you want.
   - If your store has only **one** register, this step is skipped and you go straight to the opening float.
   - If a register already has an open session (another cashier didn't close), opening will fail with an error. Ask them to close first, or have a manager close it on their behalf.
2. **Enter the opening float** — the cash already in the drawer when you start (e.g. `200.00`).
   - This is the "starting bank" the manager left in the drawer overnight or that you brought from petty cash.
   - Use the decimal point — `200.00`, not `200,00`.

   ![Opening float entry — numpad for counting starting cash](screenshots/03-opening-float.png)

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

## 3.2a Adding or removing cash mid-shift (pay-in / pay-out)

Money sometimes enters or leaves the drawer **outside of a sale**:

| Direction | Called | Typical reasons |
|---|---|---|
| Cash **into** the drawer | **Pay in** (Dutch: *Kas in*) | Change / small notes topped up mid-shift; owner adds extra float |
| Cash **out of** the drawer | **Pay out** (Dutch: *Kas uit*) | Supplier paid cash on delivery; petty-cash purchase; cash taken to the bank (bank drop) |

Never take money out and "just remember it" — record the movement, or your drawer will count short at close.

**Steps:**

1. In the top bar, tap the **💵 Cash** button (Dutch: *Kas*). It is only visible while your register session is open.
2. The **Cash in / out** window opens. Pick **↓ Pay in** or **↑ Pay out**.
3. Enter the **amount** in SRD (e.g. `100.00`).
4. Type a short **reason** — required. Examples: *"leverancier betaald"* (supplier paid), *"wisselgeld bijgevuld"* (change topped up), *"afstorting bank"* (bank drop). The **Record** button stays disabled until you fill it in.
5. Tap **Record**. The window confirms **"Cash movement recorded"** and shows the **new expected cash** in the drawer.

**What it changes:**

- The movement is saved on your register session and written to the audit trail (event `register.cash_movement`) with your name, the amount and the reason.
- The **expected cash** for your close (§3.3) adjusts automatically:

  > **Expected cash** = opening float **+** cash from sales (including the cash part of mixed payments, minus change given) **−** cash refunds and returns **+** pay-ins **−** pay-outs

- The close summary lists your movements as their own line, so you and the manager can see exactly why the drawer holds more or less than sales alone would suggest.

> **Who can record one:** you (the cashier on the open session) or a manager. Record the movement at the moment the cash moves — not from memory at the end of the shift.

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
| **Expected cash** | Opening float + cash sales − cash refunds + pay-ins − pay-outs (§3.2a) — what should be in the drawer |

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

## "Yesterday was never closed" — the morning screen

If a register from yesterday was left open, the POS won't let today start
until it's dealt with — you'll see a **"Yesterday was never closed"** screen.
This is normal and quick to fix:

- **You're a manager?** Count yesterday's drawer right there, add a note if
  the amount differs from expected, and press **Close yesterday** — today's
  register opens straight after. If the register was auto-closed overnight,
  you instead see a **count-the-drawer** step (same idea, no cash was counted
  yet).
- **You're a cashier?** Only a manager can close it. The screen shows a
  **Call [manager]** button (and WhatsApp) if the store set those up — tap it,
  ask the manager to close yesterday, then press **Refresh**.

You'll also see a small amber strip past the store's **closing time** if your
register is still open — a reminder to close it before you leave, so tomorrow
morning is clean. A one-line note also appears if yesterday's totals haven't
reached head office yet; a manager can retry, but it also retries on its own.

---

→ Next: [Chapter 4 — Making a Sale](04-making-a-sale.md)
