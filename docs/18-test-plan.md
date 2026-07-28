# 18. Test plan — what is tested, and how

This is the register of everything Josbin POS is tested against. It has two
halves, and they answer two different questions:

| | **Part A — Automated** | **Part B — Manual** |
|---|---|---|
| Answers | "Did this change break anything?" | "Does the shop floor actually work?" |
| Runs | On every code change, unattended | Before a release, and at a new store |
| Takes | About 4 minutes | About 90 minutes for the full pass |
| Proves | The rules still hold | A person can do the job |

Neither replaces the other. Automated tests catch a BTW rounding error in
milliseconds and will never notice that a button is unreachable on a 600-pixel
screen. Manual testing notices that immediately and cannot re-check 371 tax
scenarios before lunch.

::: tip Printing this
Part B is written to be printed. Use your browser's print function — the
navigation and search are hidden automatically, and each section starts on
its own page. Tick the boxes by hand, sign the bottom of each section, keep
the sheets.
:::

**Keeping it current:** every new feature adds its manual cases here in the
same change that adds the feature. A feature with no row in Part B is not
finished. See §18.7.

---

## 18.1 Part A — Automated tests

These run on every push, in a clean environment built from scratch, before any
change can be merged. A red result blocks the merge; nobody can wave it
through.

### What runs

| Suite | Count | Duration | What it covers |
|---|---:|---:|---|
| Backend (PHPUnit) | **371 tests · 1,276 assertions** | ~47 s | Every rule about money, tax, access and audit |
| Till app (Vitest) | **156 tests** | ~1 s | Receipt bytes, cart maths, scanner, barcodes, dates |
| Dashboard (Vitest + type check) | type-safe build | ~40 s | Compiles with no type errors |
| End-to-end smoke | 1 full run | ~3 min | A real stack, booted from nothing, sells something |
| Dependency audit | every package | ~20 s | Known vulnerabilities in anything we depend on |
| Code style (PSR-12) | whole backend | ~15 s | One consistent style |

Totals are current as of version 1.5.8 and grow with each release.

### The end-to-end smoke test

The one that matters most to a non-developer. On every change, a machine:

1. Boots a complete stack from nothing — database, server, cache, WebSockets
2. Runs every database migration
3. Seeds an organisation, store, products, users
4. Logs in as a cashier
5. Opens a register with a cash float
6. Adds products to a cart and completes a real sale
7. Checks the BTW, the totals and the stock movement are all correct
8. Reads back the sale, the receipt and the report
9. Scans the server log for any error line
10. Tears the whole stack down again

If any step fails, the build is red. This is the test that proves the product
still *works*, not merely that its parts compile.

### What the backend suite covers, by area

| Area | Tested behaviour |
|---|---|
| **BTW & money** | Rate per product, exempt goods, discounts applied before tax is extracted, mixed-rate baskets, SRD rounding, filings, overdue reminders |
| **Sales & refunds** | Sale creation, per-store receipt numbering under concurrency, refunds, returns with no original receipt, product variants, selling more than is in stock |
| **Payments** | Cash, card with bank reconciliation, mixed, bank transfer, mobile transfer, foreign currency, QR wallets |
| **Registers & cash** | Opening float, shift handover, cash in/out, Z-Report close, cash-count discrepancies, forgotten sessions closed overnight |
| **Reports** | Day boundaries in Suriname time, caching, PDF export, profit, list totals |
| **Audit & compliance** | Append-only log, tamper detection, chain completeness, inspector scope, export guardrails |
| **Access control** | Role permissions, store assignment, cross-organisation isolation, token scope, passkeys, login throttling |
| **Customers & privacy** | Purchase history, erasure on request (WBP-S) |
| **Licensing** | Expiry states, store-count limits, installer access |
| **Catalogue** | Product fields, variants, the till's product feed |
| **Exchange rate** | Daily lock, self-healing when the source is unreachable |

### Running them yourself

```bash
docker compose exec app php artisan test
```

```bash
cd frontend && npm run test:run
```

---

## 18.2 Part B — Manual test checklist

Work top to bottom. Each row is one action and one thing that must be true
afterwards. If a row fails, write what happened in the Notes column — "did not
work" is not a report, "drawer stayed shut, no message on screen" is.

**Tester:** ________________  **Date:** ____________  **Version:** __________

**Store / terminal:** _________________________  **Hardware:** ______________

### A. Signing in and opening the till

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| A1 | Open the app | Sign-in screen, shop name correct | ☐ | |
| A2 | Sign in with a wrong password | Refused, clear message | ☐ | |
| A3 | Sign in five times wrong | Locked out with a wait message | ☐ | |
| A4 | Sign in correctly as a cashier | Register list appears | ☐ | |
| A5 | Tap ↻ Refresh on the register list | List reloads, no error | ☐ | |
| A6 | Open a register with a cash float | POS screen, float recorded | ☐ | |
| A7 | Close the app, reopen, sign in again | Back in the *same* shift, no "already open" | ☐ | |
| A8 | Try to open a register another cashier holds | Refused, says who has it | ☐ | |
| A9 | Switch the language to Dutch | Whole screen changes, no restart | ☐ | |

### B. Selling

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| B1 | Tap a product | Added to cart, total updates | ☐ | |
| B2 | Tap the same product again | Quantity becomes 2, not a second line | ☐ | |
| B3 | Scan a barcode with the scanner | Correct product added, **first scan** | ☐ | |
| B4 | Tap a product, then scan | Scan still works, no double-add | ☐ | |
| B5 | Scan an unknown barcode | Says not found, cart unchanged | ☐ | |
| B6 | Search a product by name | Matches appear as you type | ☐ | |
| B7 | Change a line's quantity | Total and BTW both update | ☐ | |
| B8 | Remove a line | Gone, total corrected | ☐ | |
| B9 | Apply a discount to one line | Line total drops, BTW recalculated on the **discounted** amount | ☐ | |
| B10 | Apply a discount to the whole basket | Same, across every line | ☐ | |
| B11 | Add a BTW-exempt product | No BTW on that line, others unaffected | ☐ | |
| B12 | Filter by category | Only that category shows | ☐ | |
| B13 | Clear the cart | Empty, total zero | ☐ | |

### C. Taking payment

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| C1 | Open the payment screen | Amount due matches the cart | ☐ | |
| C2 | Look at the cash step | **Complete Payment is visible without scrolling** | ☐ | |
| C3 | Type an amount on the keypad | Change calculates as you type | ☐ | |
| C4 | Tap a quick-amount button | Fills that amount, change correct | ☐ | |
| C5 | Enter less than the total | Complete stays disabled | ☐ | |
| C6 | Complete a cash sale | Receipt screen, change shown large | ☐ | |
| C7 | Start the next sale, open payment | **Previous amount is gone** | ☐ | |
| C8 | Pay by card | Sale records as card, bank fields optional | ☐ | |
| C9 | Pay part cash, part card | Both amounts recorded, split correct | ☐ | |
| C10 | Pay by QR wallet | Store QR shown with the amount | ☐ | |
| C11 | Open "More payment methods" | Bank transfer, mobile, foreign cash appear | ☐ | |
| C12 | Cancel a payment part-way | Back to the cart, nothing recorded | ☐ | |

### D. Receipt, printer and cash drawer

> Needs the real printer and drawer connected.

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| D1 | Complete a cash sale | Receipt prints by itself | ☐ | |
| D2 | Watch the drawer on that sale | **Opens as printing starts** | ☐ | |
| D3 | Read the printed receipt | Shop name, date **day-first**, cashier's **name** | ☐ | |
| D4 | Check the TOTAL line | One line, not split across two | ☐ | |
| D5 | Check the BTW block | Stated once per rate, amounts add up | ☐ | |
| D6 | Check a long product name | Wraps, not cut off | ☐ | |
| D7 | Tap Reprint | Prints again, **drawer does NOT open** | ☐ | |
| D8 | Turn the printer off, sell | Failure says *why*, in words | ☐ | |
| D9 | Turn it back on, tap Reprint | Prints | ☐ | |
| D10 | Sale with a customer who has a phone | WhatsApp button shown, pre-addressed | ☐ | |
| D11 | Settings → Hardware → Test drawer | Drawer opens, no paper fed | ☐ | |
| D12 | Settings → Hardware → Test receipt | Test slip prints | ☐ | |
| D13 | With a footer image set, print | Image stamped at the foot | ☐ | |

### E. Customers, held bills, refunds

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| E1 | Add a new customer mid-sale | Saved, attached, no screen change | ☐ | |
| E2 | Search a customer by phone | Found | ☐ | |
| E3 | Hold a bill with a name | Moves to Open Bills, cart clears | ☐ | |
| E4 | Serve another customer, reload the held bill | Comes back complete | ☐ | |
| E5 | Refund one line of a past sale | Stock returns, refund recorded | ☐ | |
| E6 | Void a sale | Reason required, sale marked voided | ☐ | |
| E7 | Check a voided sale in reports | Excluded from takings, visible in audit | ☐ | |

### F. Transactions and reprints

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| F1 | Open Transactions | Today's sales listed | ☐ | |
| F2 | Search a receipt number | Found | ☐ | |
| F3 | Change the date | That day's sales | ☐ | |
| F4 | Tap 🖨 on a sale | **Options: reprint, PDF, e-mail, WhatsApp** | ☐ | |
| F5 | Reprint from there | Paper comes out | ☐ | |
| F6 | Open the PDF | Opens, matches the paper | ☐ | |
| F7 | E-mail it | Confirms sent *(needs mail configured)* | ☐ | |
| F8 | WhatsApp it | WhatsApp opens with the receipt text | ☐ | |

### G. End of day

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| G1 | Open Z-Report as a manager | Totals match the day's sales | ☐ | |
| G2 | Check payment breakdown | Cash / card / other split correctly | ☐ | |
| G3 | Enter the counted cash, matching | Closes clean | ☐ | |
| G4 | Enter cash that does *not* match | Discrepancy shown red, **note required** | ☐ | |
| G5 | Print the Z-Report | Prints as a formal document | ☐ | |
| G6 | Try to close the same day twice | Refused | ☐ | |
| G7 | Look at the 7-day history | Past closes listed with sync status | ☐ | |

### H. Who can see what

> Sign in as each role in turn. This protects the shop's money and its data.

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| H1 | Cashier: look at the menu | **No Labels, no Exchange rate, no End of day** | ☐ | |
| H2 | Cashier: try to reach the exchange rate | Not reachable | ☐ | |
| H3 | Cashier: open Reports | Own store only | ☐ | |
| H4 | Manager: look at the menu | Labels, Exchange rate, End of day all present | ☐ | |
| H5 | Manager: open another store's data | Not possible | ☐ | |
| H6 | Org admin: open the dashboard | Own organisation's stores only | ☐ | |
| H7 | Org admin: look for another organisation | Not visible anywhere | ☐ | |
| H8 | Auditor: try to change anything | Read-only throughout | ☐ | |
| H9 | Super admin: sign in | Two-factor demanded | ☐ | |

### I. Dashboard (office)

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| I1 | Open the dashboard | Store cards with today's takings | ☐ | |
| I2 | Complete a sale on the till | Dashboard total rises **without reloading** | ☐ | |
| I3 | Open a store's detail | Full transaction list | ☐ | |
| I4 | Compare two stores | Side-by-side figures | ☐ | |
| I5 | Run a BTW report | Belastingdienst format, figures correct | ☐ | |
| I6 | Export a report to PDF | Downloads, opens, readable | ☐ | |
| I7 | Export to CSV | Opens in a spreadsheet | ☐ | |
| I8 | Add a product | Appears on the till | ☐ | |
| I9 | Import a product file | Rows imported, errors listed | ☐ | |
| I10 | Change a price | Till shows the new price | ☐ | |
| I11 | Add a user | Can sign in with the role given | ☐ | |
| I12 | Open the audit log | Shows who did what, when | ☐ | |
| I13 | Upload the platform footer image | Appears on the next printed receipt | ☐ | |

### J. Working without internet

> The point of the product. Test it deliberately.

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| J1 | Unplug the shop's internet | Till keeps selling | ☐ | |
| J2 | Sell several items offline | All complete normally | ☐ | |
| J3 | Look at the manager screen | Yellow "sync pending, N queued" | ☐ | |
| J4 | Print offline | Prints | ☐ | |
| J5 | Restore the internet | Queue clears by itself | ☐ | |
| J6 | Check the dashboard | Offline sales all present | ☐ | |
| J7 | Export a day to USB | File written | ☐ | |
| J8 | Import that file at head office | Imports as if it had synced | ☐ | |

### K. The hardware itself

| # | Do this | Must happen | ✓ | Notes |
|---|---|---|:-:|---|
| K1 | Unplug and replug the printer's USB | Reconnects, prints | ☐ | |
| K2 | Restart the terminal | App starts by itself, printer still paired | ☐ | |
| K3 | Scan 20 barcodes quickly | All 20 land, none missed | ☐ | |
| K4 | Print a sheet of shelf labels | Barcodes scan back correctly | ☐ | |
| K5 | Run a till for a full day | No slowdown, no restart needed | ☐ | |

**Section result:** Pass ☐ Fail ☐  **Signature:** ____________________

---

## 18.3 What "passed" means

A release is signed off when:

- Every automated suite is green
- Every Part B row is ticked, or has a written, accepted reason
- Anything that failed is either fixed or recorded as a known limitation the
  client has seen

A release is **not** signed off on "it mostly worked".

## 18.4 When a test fails

1. Write down exactly what you saw, including any message on screen — the exact
   words matter more than anything else in the report
2. Note what you did immediately before
3. Note the version and whether it is Windows or Android
4. If it happens once and not again, say so — intermittent faults are real
   faults and are the hardest to find later

The single most useful thing a tester can add is whether the same action
**works in isolation but fails in sequence.** That one observation narrows a
fault faster than any amount of description.

## 18.5 Testing at a new store

Before a store goes live, run at minimum: **A, B, C, D, G, H, J.** These cover
the paths that lose money or block trading. The rest can follow in the first
week.

## 18.6 What is not covered here

Stated plainly, so nobody assumes otherwise:

- **Load and stress testing** is separate — see the operations documentation
- **Security testing** against the OWASP Top 10 is a separate exercise with its
  own report
- **Automated on-screen testing** of the till app (clicking through screens
  unattended) is not in place. Screen behaviour is covered by Part B, by a
  person. Worth adding as the product grows.

## 18.7 Keeping this document alive

When a feature is added or changed:

1. Add or update its rows in Part B **in the same change**
2. Add the automated test that guards the rule, if the rule is about money,
   tax, access or data
3. Update the counts in §18.1 when a release goes out

A feature with no manual case and no automated test is not finished, however
well it demonstrates.
