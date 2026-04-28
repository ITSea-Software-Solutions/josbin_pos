# Chapter 5 — Receipts: Print, PDF, and Email

After every completed sale, the receipt screen appears automatically. This chapter explains all three receipt options.

---

## 5.1 The receipt screen

After payment is accepted, a receipt pop-up appears with these options:

| Button | What it does |
|--------|-------------|
| **Print receipt** (thermal) | Sends to the connected thermal receipt printer |
| **Download PDF** | Opens/downloads a PDF receipt |
| **Email receipt** | Sends the receipt to the customer's email address |
| **New sale** | Closes the receipt and starts a fresh empty cart |

> **Tip:** You can do more than one of these. For example, print the receipt AND email it to the customer.

---

## 5.2 Printing a thermal receipt

Thermal printing sends the receipt directly to your receipt printer (e.g. EPSON TM-T20).

**Requirements:**
- A receipt printer must be connected and configured in Settings (see [Chapter 12](12-settings.md)).
- For network printers: the printer must be on the same local network.
- For USB printers (Windows): the printer must be installed in Windows and selected in Settings.

**Steps:**

1. On the receipt screen, click **Print receipt** (Dutch: *"Thermisch afdrukken"*).
2. The button shows **"Printing…"** briefly.
3. If successful, the button turns green and shows a checkmark.
4. If it fails, the button turns red. Check printer connection and try again.

**What is printed:**
- Store name and address
- Receipt number and date/time (AST timezone)
- Cashier name
- List of all items with unit price, quantity, and line total
- Any discounts applied
- Subtotal, BTW breakdown, total
- Payment method and change given (for cash payments)
- Store footer (e.g. "Thank you for your purchase")
- BTW registration number

---

## 5.3 Downloading a PDF receipt

The PDF receipt has the same content as the thermal receipt but formatted for A4 paper.

1. Click **PDF** on the receipt screen.
2. The PDF opens in a new browser tab or downloads to your computer (depending on browser settings).
3. From there you can save it, print it on a normal printer, or send it yourself.

---

## 5.4 Emailing a receipt

1. Click **Email** on the receipt screen.
2. An email address field appears.
   - If the customer has a saved email address in their profile, it appears automatically.
   - If not, type the customer's email address.
3. Click **Send** (Dutch: *"Verstuur"*).
4. The receipt is sent by the system in the background.
5. The email receipt is fully bilingual — it is sent in the language currently active (Dutch or English).

> **Note:** Email delivery requires the server to have email configured (SMTP settings). Contact your system administrator if emails are not being received.

---

## 5.5 Starting a new sale

1. After handling the receipt, click **New sale** (Dutch: *"Nieuwe verkoop"*).
2. The receipt pop-up closes.
3. The cart is empty and ready for the next customer.

> **Tip:** You can also close the receipt pop-up by clicking × in the corner. The cart will still be cleared.

---

## 5.6 Receipt format explained

```
════════════════════════════════
       SUPERMARKT DE HOOP
     Paramaribo, Suriname
     BTW nr: SR-001234-5
════════════════════════════════
Bon: #2026-00042
Datum: 19-04-2026  14:32 AST
Kassier: Maria Jansen
────────────────────────────────
Melk (1L)         2× SRD  8.50
                      SRD 17.00
Brood volkoren    1× SRD 12.00
                      SRD 12.00
────────────────────────────────
Subtotaal              SRD 29.00
Korting                SRD  0.00
BTW 10%                SRD  2.55
────────────────────────────────
TOTAAL                 SRD 31.55
════════════════════════════════
Betaalmethode: Contant
Ontvangen:     SRD 50.00
Wisselgeld:    SRD 18.45
────────────────────────────────
Bedankt voor uw aankoop!
Bewaar uw bon voor retour.
════════════════════════════════
```

| Section | Description |
|---------|-------------|
| Header | Store name, address, BTW registration number |
| Bon # | Unique receipt number for this store |
| Datum | Date and time in AST (Suriname time) |
| Line items | Each product sold, with quantity and price |
| BTW | Tax amount (10% of the taxable items) |
| Totaal | Total amount charged |
| Payment info | Method, amount tendered, change |
| Footer | Custom message set by the store |
