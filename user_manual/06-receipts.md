# Chapter 6 — Receipts: Print, PDF, and Email

After every completed sale, the receipt screen appears automatically. This chapter explains all three receipt options.

---

## 6.1 The receipt screen

After payment is accepted, a receipt pop-up appears with these options:

| Button | What it does |
|--------|-------------|
| **Print receipt** | Always available. Prints silently to the thermal printer when one is configured; otherwise opens the normal print dialog with the same receipt |
| **Download PDF** | Opens/downloads a PDF receipt |
| **Email receipt** | Sends the receipt to the customer's email address |
| **New sale** | Closes the receipt and starts a fresh empty cart |

> **Tip:** You can do more than one of these. For example, print the receipt AND email it to the customer.

---

## 6.2 Printing a thermal receipt

Thermal printing sends the receipt directly to your receipt printer (e.g. EPSON TM-T20).

**Requirements:**
- A receipt printer must be connected and configured in Settings (see [Chapter 13](13-settings.md)).
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

**No thermal printer configured?** The Print button still works: it opens the normal Windows print dialog with the exact same receipt, so you can print to any printer installed on the machine — an A4 office printer, or even a thermal printer through its Windows driver. Configuring a thermal printer in Settings just makes printing silent and instant.

### Printing automatically

If customers at your store always get a paper receipt, turn on **auto-print** so you don't have to tap Print a few hundred times a day:

1. Go to **Settings → Printer & cash drawer → "Print receipt automatically after each sale"** (see [Chapter 13 §13.2](13-settings.md)). It is **off by default** and is a per-terminal setting.
2. With auto-print on, the receipt prints **the moment the receipt screen appears** — exactly once per sale.
3. With a thermal printer configured it prints silently in the background; without one, the print dialog opens after each sale instead.
4. The **Print** button stays available for reprints — customer wants a second copy, paper jammed, printer was off.

---

## 6.3 Downloading a PDF receipt

The PDF receipt has the same content as the thermal receipt but formatted for A4 paper.

1. Click **PDF** on the receipt screen.
2. The PDF opens in a new browser tab or downloads to your computer (depending on browser settings).
3. From there you can save it, print it on a normal printer, or send it yourself.

---

## 6.4 Emailing a receipt

1. Click **Email** on the receipt screen.
2. An email address field appears.
   - If the customer has a saved email address in their profile, it appears automatically.
   - If not, type the customer's email address.
3. Click **Send** (Dutch: *"Verstuur"*).
4. The receipt is sent by the system in the background.
5. The email receipt is fully bilingual — it is sent in the language currently active (Dutch or English).

> **Note:** Email delivery requires the server to have email configured (SMTP settings). Contact your system administrator if emails are not being received.

---

## 6.5 Starting a new sale

1. After handling the receipt, click **New sale** (Dutch: *"Nieuwe verkoop"*).
2. The receipt pop-up closes.
3. The cart is empty and ready for the next customer.

> **Tip:** You can also close the receipt pop-up by clicking × in the corner. The cart will still be cleared.

---

## 6.6 Receipt format explained

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


---

## Receipt via WhatsApp

Suriname runs on WhatsApp — so the receipt screen has a **💬 Receipt via
WhatsApp** button next to Print and Email:

1. After completing a sale, tap **Receipt via WhatsApp**.
2. Type the customer's number (e.g. `8812345` — the `+597` is added
   automatically), or tap the **Use customer number** chip when the sale has
   a customer attached. You can also leave it empty and pick the chat inside
   WhatsApp yourself.
3. Tap **Open WhatsApp**. WhatsApp opens with a ready-made text receipt —
   store name, receipt number, items, BTW and total — in the till's current
   language. Just press send.

> The message is a text summary for the customer's convenience. The formal
> receipt stays the printed / PDF one — nothing changes for your BTW
> records. Very long receipts list the first 15 items and add "+N more".

## Language: Sranantongo (draft)

Settings → Language now offers **🇸🇷 Sranantongo** alongside Nederlands and
English — the whole POS switches instantly, and receipts sent via WhatsApp
follow. The translation is a first draft: spot something a Paramaribo
cashier would say differently? Tell your manager — corrections are welcome.
(API error messages fall back to Dutch for now.)
