# Chapter 5 — Taking Payment

Once all products are in the cart, this chapter shows you how to complete the sale.

---

## 4.1 Opening the payment screen

1. Review the cart to make sure all items and the total are correct.
2. Click the **Checkout** button (Dutch: *"Afrekenen"*) at the bottom of the cart panel.
3. The **Payment screen** opens as a pop-up panel.
4. The total due is shown in large text at the top: **SRD XX.XX**

> **Before you proceed:** Make sure today's exchange rate has been set (see [Chapter 2](02-daily-setup.md)). If it has not been set, you will see an error message in Dutch: *"Geen dagkoers beschikbaar."* Ask your manager to set the rate first.

---

## 4.2 Cash payment

1. On the payment screen, click **Cash** (Dutch: *"Contant"*).
2. The cash numpad appears.

**Entering the amount received:**

- Use the on-screen numpad to enter the amount the customer gives you.
- The **change due** is calculated and shown in real time below the display.
- Quick-amount buttons appear at the top (exact amount, rounded amounts like 50, 100, 200 SRD). Click one to fill it in instantly.

**Example:**
- Total due: SRD 47.50
- Customer gives: SRD 50.00
- Change shown: SRD 2.50

**Completing the sale:**

3. Once the cash amount entered is **equal to or greater than the total**, the **Complete** button (Dutch: *"Voltooien"*) becomes active.
4. Click **Complete**.
5. The sale is recorded. The cash drawer opens automatically (if a printer is configured).
6. The receipt screen appears — see [Chapter 6 — Receipts](06-receipts.md).

> **Tip:** If the customer pays the exact amount, click the first quick-amount button which shows the exact total. This saves typing.

---

## 4.3 Card / PIN payment

1. On the payment screen, click **Card** (Dutch: *"Pin"*).
2. The system immediately records the sale as a card payment (no amount to enter — the full total is charged to the card).
3. Process the card payment on your PIN terminal (separate device) as you normally would.
4. Once the PIN terminal confirms payment, the receipt screen appears.

> **Note:** Josbin POS does not control the PIN terminal. You must complete the card transaction on the PIN terminal separately. Only press Complete after the PIN terminal has approved.

---

## 4.4 Mixed payment (part cash, part card)

Use this when a customer pays part of the bill by card and the rest in cash.

1. On the payment screen, click **Mixed** (Dutch: *"Gemengd"*).
2. The numpad appears. Enter the **card amount** — the amount the customer will pay by card.
3. The **remaining cash amount** is calculated automatically and shown.

**Example:**
- Total: SRD 120.00
- Customer pays SRD 100.00 by card
- Remaining to pay in cash: SRD 20.00

4. Process the card amount on your PIN terminal first.
5. Collect the cash for the remaining amount.
6. Click **Complete** (Dutch: *"Voltooien"*).
7. The cash drawer opens. The receipt screen appears.

---

## 4.5 Cash drawer

The cash drawer opens **automatically** after every cash or mixed payment, provided:
- A printer is configured in Settings (see [Chapter 13](13-settings.md))
- The cash drawer is connected to the receipt printer via the RJ11 port

If the drawer does not open:
- Check the cable connection between the drawer and printer.
- Check that the printer is on and connected.
- Open the drawer manually with the key.

The drawer **does not open for card-only payments** — there is no cash to put in.

---

## 4.6 Cancelling a payment in progress

- To go back to the cart from the payment screen, click the **back arrow** (← back) at the top of the payment panel.
- The cart remains unchanged. No sale is recorded.
- To close the payment panel without completing, click the **×** in the top corner.

---

## 4.7 What if payment fails?

If the **"Server error"** message appears after clicking Complete:

1. Note any error message shown (e.g. *"Geen dagkoers beschikbaar"* = no exchange rate set today).
2. Do not press Complete multiple times.
3. Contact your manager.
4. Common causes and solutions:

| Error message | Cause | Solution |
|--------------|-------|----------|
| Geen dagkoers beschikbaar | No exchange rate set for today | Manager must set the exchange rate (Chapter 2) |
| Server error | Server is temporarily unavailable | Wait 30 seconds and try again |
| Connection refused | Local server is not running | Contact IT support |

---

## 4.8 After the sale is complete

Once payment is accepted:
1. The cart is cleared automatically.
2. The cash drawer opens (for cash/mixed payments).
3. The **Receipt screen** opens — see [Chapter 6 — Receipts](06-receipts.md).
4. Today's totals in the top bar update immediately.
