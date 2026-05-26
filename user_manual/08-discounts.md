# Chapter 8 — Discounts

Josbin POS supports discounts at two levels: on individual items and on the entire sale. Both types can be a fixed SRD amount or a percentage.

---

## 8.1 Types of discount

| Type | Where it applies | Example |
|------|-----------------|---------|
| **Item discount** | One specific line in the cart | "10% off the bread" |
| **Sale discount** | The entire cart total | "5% off the whole purchase" |
| **Automatic rule discount** | Applied by the system based on pre-set rules | "Buy 3 get 1 free", "10% off Dairy category on Tuesdays" |

> **Important — BTW rule:** All discounts are applied **before** BTW (tax) is calculated. This is required by Belastingdienst Suriname. The system does this automatically — you do not need to worry about the order.

---

## 8.2 Applying a discount to a single item

1. In the cart panel, find the item you want to discount.
2. Click the item line to open the **Line Item Edit** panel.
3. You will see fields for:
   - **Quantity** — change the quantity if needed
   - **Unit price** — override the price for this sale (e.g. negotiated price)
   - **BTW rate** — override the tax rate for this item
   - **Discount amount (SRD)** — enter a fixed discount in SRD
4. Enter the discount amount or change the price.
5. Click **Save**.
6. The line total updates, and the cart total recalculates with BTW applied correctly.

**Example:**
- Bread is SRD 12.00. Customer has a coupon for SRD 2.00 off.
- Enter `2.00` in the Discount amount field.
- Line total becomes SRD 10.00, and BTW is recalculated on SRD 10.00.

---

## 8.3 Applying a discount to the entire sale

1. In the cart panel, find the **"Sale discount"** button (Dutch: *"Korting op bon"*) — usually a percentage or SRD icon near the total section.
2. Click it to open the Discount panel.
3. Choose the discount type:
   - **Percentage (%)** — e.g. enter `10` for 10% off the total
   - **Fixed amount (SRD)** — e.g. enter `15` for SRD 15.00 off
4. Enter the amount.
5. Click **Apply** (Dutch: *"Toepassen"*).
6. The discount appears in the cart below the subtotal. BTW is recalculated on the discounted amount.

---

## 8.4 Removing a discount

**Item discount:**
1. Click the item line.
2. Set the discount field back to `0`.
3. Click Save.

**Sale discount:**
1. Click the sale discount button again.
2. Clear the amount and click Apply (or click Remove).

---

## 8.5 Automatic discount rules

Managers can set up discount rules in advance (e.g. "10% off all dairy every Tuesday", "Buy 2 Coca-Cola get 1 free"). These apply **automatically** when the conditions are met — the cashier does not need to do anything.

When an automatic rule applies:
- The discount appears on the item line in the cart.
- The label shows the rule name (e.g. "Promotie: 2+1 gratis").
- The automatic discount and any manual discount you add are combined.

If a rule should not apply to a specific customer, you can override it by editing the item discount to zero (step 8.2).

---

## 8.6 Discount shown on receipt

All discounts are shown separately on the receipt:
- Item discounts appear on the item line
- Sale discount appears below the subtotal
- The BTW is calculated on the discounted price (as required by law)

### Worked example — discount-then-BTW order

Belastingdienst Suriname requires BTW to be extracted **after** discounts are applied (not before). Here's exactly how that works in Josbin POS:

```
Cart:
  Rice 5kg            SRD 38.50    (10% BTW)
  Coca-Cola 1.5L      SRD 7.50     (10% BTW)
                      ─────────
  Subtotal            SRD 46.00    (tax-inclusive prices)

Cashier applies 10% sale discount:
  Discount            -SRD 4.60    (10% of 46.00)
                      ─────────
  After discount      SRD 41.40

BTW extracted from the discounted total:
  BTW (10%)            SRD 3.76    (= 41.40 - 41.40/1.10)
  Net (excl. BTW)      SRD 37.64
                      ─────────
  Total to pay         SRD 41.40
```

Three things to notice:

1. The **customer's price didn't change** between "after discount" and "Total to pay" — those are the same number. The BTW line is a *breakdown* of the SRD 41.40, not an addition on top.
2. The BTW amount (SRD 3.76) is **less than 10% of the un-discounted subtotal** (SRD 4.60). That's correct — the discount reduces both the net price AND the BTW proportionally.
3. The opposite order (BTW first, then discount) would **over-tax** the customer by SRD 0.84 on this single sale. Multiplied across a day's transactions, that's real money — and it's not legal under Surinamese BTW rules.

The receipt prints all three numbers: subtotal, discount, BTW. The customer can verify the math.

---

## Common questions about discounts

**Q: Can I give a percentage AND a fixed discount on the same item?**
A: Use the Line Item Edit panel (step 8.2). Enter the combined discount as a single SRD amount.

**Q: Can I reduce the price below zero?**
A: No. The system will not allow a line total or cart total to go negative through discounts.

**Q: Does the discount apply before or after BTW?**
A: Always before. The system handles this automatically and correctly regardless of what you enter.

**Q: Can a cashier give any discount they want?**
A: This depends on the role settings configured by your manager. Cashiers may have a maximum discount limit. If you exceed it, the system may ask for manager approval.
