# Chapter 5 — Taking Payment

Once all products are in the cart, this chapter shows you how to complete the sale.

**Payment methods available** (three standard at the top, three more under **More payment methods… / Meer betaalwijzen** for less-common situations):

| Method | When to use | Cash drawer opens? |
|---|---|---|
| 💵 **Cash / Contant** | Customer pays in SRD cash | ✅ Yes |
| 💳 **Card / PIN / Pin/Card** | Customer pays via external bank PIN terminal | ❌ No |
| 🔀 **Mixed / Gemengd** | Part cash + part card | ✅ Yes (for cash portion) |
| 🏦 **Bank transfer / Overschrijving** | B2B / government — customer transfers to your bank account; OA confirms when funds land | ❌ No (sale marked "awaiting confirmation") |
| 📱 **Mobile transfer / Mobiel bankieren** | DSB Mobiel, Hakrinbank Online, Republic Mobile, etc. — customer pays via their banking app | ❌ No (same lifecycle as bank transfer) |
| 💱 **Foreign cash / Vreemde valuta** | Customer pays in USD or EUR — system locks today's rate and shows both amounts on the receipt | ✅ Yes |
| 🔳 **QR wallet / QR-wallet** | Mopé or Uni5Pay+ — customer scans your store QR and pays in the wallet app; confirmation appears on your wallet device within seconds | ❌ No |

> **About card reconciliation** (the optional fields after Card / PIN): if you fill in the bank name + approval code + last 4 digits from the customer's terminal slip, the OA can match daily card sales against the bank's settlement statement on the dashboard. **Skip & complete / Overslaan & afronden** is fine if the slip isn't out yet — the sale completes either way. Same for bank/mobile transfers — provider + reference are required so OA can find the funds when they land.

---

## 5.1 Opening the payment screen

1. Review the cart to make sure all items and the total are correct.
2. Click the **Checkout** button (Dutch: *"Afrekenen"*) at the bottom of the cart panel.
3. The **Payment screen** opens as a pop-up panel.
4. The total due is shown in large text at the top: **SRD XX.XX**

> **Before you proceed:** Make sure today's exchange rate has been set (see [Chapter 2](02-daily-setup.md)). If it has not been set, you will see an error message in Dutch: *"Geen dagkoers beschikbaar."* Ask your manager to set the rate first.

---

## 5.2 Cash payment

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

## 5.3 Card / PIN payment

1. On the payment screen, click **Card** (Dutch: *"Pin"*).
2. The system immediately records the sale as a card payment (no amount to enter — the full total is charged to the card).
3. Process the card payment on your PIN terminal (separate device) as you normally would.
4. Once the PIN terminal confirms payment, the receipt screen appears.

> **Note:** Josbin POS does not control the PIN terminal. You must complete the card transaction on the PIN terminal separately. Only press Complete after the PIN terminal has approved.

---

### Connecting a card machine (PIN terminal)

> 🎬 **Visual guide for non-technical readers:** [Card payments — step by step](/card-payments.html) — animated walkthrough of the till flow, the built-in practice terminal, and going live with a real bank machine.

Three modes, set under **Settings → Card / PIN terminal**:

1. **Standalone bank terminal (default — how Suriname works today).** The
   bank's PIN device sits next to the till and is *not* cabled to the POS.
   You key the amount into the bank device, the customer pays there, and you
   complete the card sale in the POS — optionally copying the slip details
   (bank, approval code, last 4, terminal ref) so the administrator can match
   the day's card sales against the bank settlement statement.
2. **Simulated terminal (demo / training).** The POS shows a
   **"Send SRD … to PIN terminal"** button; a virtual terminal approves after
   ~2 seconds and fills the reconciliation fields automatically. Use it to
   train cashiers or demonstrate the integrated flow — no real money moves.
3. **Direct link (ECR) — future.** A real cable/network link where the POS
   sends the amount to the terminal and receives the approval automatically
   requires the acquiring bank's ECR terminal protocol. No Surinamese bank
   offers this publicly yet; the POS has the integration slot ready. When
   your bank offers it, contact ITSea to activate.

## 5.4 Mixed payment (part cash, part card)

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

## 5.5 Cash drawer

The cash drawer opens **automatically** after every cash or mixed payment, provided:
- A printer is configured in Settings (see [Chapter 13](13-settings.md))
- The cash drawer is connected to the receipt printer via the RJ11 port

If the drawer does not open:
- Check the cable connection between the drawer and printer.
- Check that the printer is on and connected.
- Open the drawer manually with the key.

The drawer **does not open for card-only payments** — there is no cash to put in.

---

## 5.6 Cancelling a payment in progress

- To go back to the cart from the payment screen, click the **back arrow** (← back) at the top of the payment panel.
- The cart remains unchanged. No sale is recorded.
- To close the payment panel without completing, click the **×** in the top corner.

---

## 5.7 What if payment fails?

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

## 5.8 After the sale is complete

Once payment is accepted:
1. The cart is cleared automatically.
2. The cash drawer opens (for cash/mixed payments).
3. The **Receipt screen** opens — see [Chapter 6 — Receipts](06-receipts.md).
4. Today's totals in the top bar update immediately.

## 5.9 QR wallet payment (Mopé / Uni5Pay+)

QR wallets are the everyday scan-to-pay method in Suriname. The flow at the till:

1. Tap **🔳 QR wallet (Mopé / Uni5Pay+)** on the payment screen.
2. Pick the wallet — **the store's QR appears on the POS screen** (when uploaded, see setup below) together with the amount due. The customer scans it straight from the screen — or from the physical sticker — and types the amount in their wallet app. *The QR is static: it identifies your store, so the amount is always entered by the customer.*
3. Within seconds, **"payment received"** appears on your wallet device (the store phone/tablet with the merchant app).
4. Pick the wallet (**Mopé** / **Uni5Pay+** / Other), optionally type the transaction ID from the merchant app, and leave **"Payment received — confirmed on the wallet device"** ticked.
5. Tap **Complete QR payment** — the sale completes immediately, no cash drawer involved.

> **Notification delayed?** Untick the confirmation box before completing. The sale is then recorded as *awaiting confirmation* and your administrator approves it later from **Dashboard → Pending payments** — same flow as a bank transfer.

> **One-time setup — show the QR on the POS screen:** an Org Admin or Store Manager uploads the wallet QR (the image your bank/wallet provider issued) via **Dashboard → Stores → Settings → QR wallets**, once per wallet per store. Without it the flow still works — the customer scans the counter sticker instead.

> **Full flow & edge cases** (delayed confirmation, refund rules, external POS, future automatic confirmation): see the developer doc *QR-wallet betalingen — flow & use cases* (`docs/qr-payment-flow.md`).

> **Daily reconciliation tip for managers:** compare the day's **QR wallet** total on the Z-Report with the wallet's own merchant portal. The optional transaction ID on each sale makes matching individual payments easy.
