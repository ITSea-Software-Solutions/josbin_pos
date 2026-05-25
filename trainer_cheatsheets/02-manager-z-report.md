# Store Manager — End of Day (Z-Report)
**Josbin POS · Winkelbeheerder dagafsluiting**

> Run once per trading day, after the **last sale** and after **all cashiers have closed** their registers. Closing the day is final — double-check before tapping.

---

## 📋 Pre-flight checklist / Controle vóór afsluiten

- [ ] **All cashiers closed their registers.** Dashboard → **Registers / Kassabeheer** — every row *Closed*.
- [ ] **All reopen requests resolved.** Amber "Pending approval / Wacht op goedkeuring" count = 0.
- [ ] **All held bills cleared** by cashiers (completed or discarded).
- [ ] **Today's exchange rate locked.** POS top bar → **Exchange Rate / Wisselkoers** shows ✓ Locked.
- [ ] **Cash drawers counted and bagged.** Physical cash in hand.

---

## 📊 Open the screen / Open het scherm

POS top bar → **End of Day / Dagafsluiting**:

```
  ┌──────────────────────────┬──────────────────────────┐
  │ Daily summary            │ Cash reconciliation      │
  │ • Total sales SRD        │ • Expected cash (system) │
  │ • Transaction count      │ • Actual cash (you type) │
  │ • Total BTW              │ • Discrepancy (auto)     │
  │ • Cash / Card totals     │ • Note (if discrepancy)  │
  └──────────────────────────┴──────────────────────────┘
  History (7 days) — recent Z-Reports + sync status
```

Sanity-check the summary first. If anything looks wrong, **do not close** — check Sales History or call the cashier.

---

## 💰 Cash reconciliation / Kasafstemming

1. Count every note + coin across **every** drawer, totalled.
2. **Actual cash counted / Werkelijk kasgeld** — type SRD total (e.g. `4875.50`).
3. **Discrepancy / Verschil** updates instantly:

   | Colour | Meaning |
   |--------|---------|
   | 🟢 `SRD 0.00` | Match ✓ |
   | 🔴 `−SRD x.xx` | Short — less cash than expected |
   | 🔴 `+SRD x.xx` | Over — more cash than expected |

4. **Any discrepancy >SRD 0.01** ⇒ **Discrepancy note / Verschil opmerking** becomes mandatory. Type a reason (NL or EN), e.g. *"Wisselgeld fout bij verkoop #2026-00038"*. Submit button stays disabled until filled.

---

## ✅ Submit the Z-Report

1. Tap **Print Z-Report / Z-rapport afdrukken**.
2. System locks today's figures, syncs to HQ, prints to receipt printer (if configured).
3. Green banner: *"Day closed successfully / Dag succesvol afgesloten"* ✅
4. New row in **History (7 days) / Geschiedenis** with a sync badge:

| Badge | Meaning | Action |
|-------|---------|--------|
| 🟢 **Sent** | Synced to HQ ✓ | Done. |
| 🟡 **Pending** | Queued, auto-retry (1m → 5m → 15m → 30m) | Wait. |
| 🔴 **Failed** | Sync failed | See below. |

---

## 🔄 If sync fails / Als synchronisatie mislukt

**A) Retry from screen:** History row → **Submit to Headquarters / Verzenden naar hoofdkantoor** → confirm.
**B) Wait:** auto-retry resumes when internet returns. Data is safe locally.
**C) USB / WhatsApp / email:** History row → **💾 .josbin_pos** → file downloads (AES-256 encrypted, safe to send). HQ imports via Super Admin Dashboard.

> The day is **closed** the moment you submit locally. Sync status is just about reaching HQ — it never blocks tomorrow's trading.

---

## 🚨 Common issues / Veelvoorkomende problemen

| Situation | What to do |
|-----------|------------|
| Cashier left register open, went home | Dashboard → **Registers / Kassabeheer** → find session → close on their behalf with your cash count + a note. |
| Reopen request from a cashier | Dashboard → **Registers** → amber banner → read reason → **Approve / Goedkeuren** or **Deny / Afwijzen** (denial requires a reason). |
| Discrepancy huge (>SRD 100) | **Don't close.** Recount. Check Sales History for late voids. Call the cashier. Only close once you understand the gap. |
| Closed by mistake | Day is locked — **no undo** by design. Sales History stays accurate; sync can be re-submitted. |
| Z-Report shows yesterday's data | Refresh (top-right ↻). Still wrong? Check the terminal timezone (must be AST / Paramaribo). |
| Need a mid-day snapshot (no close) | POS top bar → **Reports / Rapporten** → **X-Report** tab. View only — never closes the day. |

---

> **Golden rule:** the Z-Report is your formal handover to head office and Belastingdienst Suriname. Count cash physically. Explain every discrepancy in writing. Once submitted, today's books are locked — that's how the audit trail stays trustworthy.
