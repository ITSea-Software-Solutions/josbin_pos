# Chapter 4 — Making a Sale

This chapter covers everything that happens before payment — adding products, changing quantities, searching, and using a barcode scanner.

---

## 3.1 Adding products to the cart

There are four ways to add a product:

### Method A — Tap/click from the product grid

1. The product grid fills most of the screen with product cards.
2. Find the product you want and **click or tap** it once.
3. The product is added to the cart on the right. Each click adds one more unit.

### Method B — Use a category filter

1. Category buttons appear as a horizontal row above the product grid.
2. Click a category (e.g. "Dranken", "Zuivel", "Vlees") to show only products in that category.
3. Click the product to add it.
4. Click **"All"** (Dutch: *"Alles"*) to go back to all products.

### Method C — Search by name

1. Click the **search bar** at the top of the product grid.
2. Type the product name (or part of it). The grid updates in real time as you type.
3. Click the product from the filtered results to add it.

> **Tip:** The search understands partial names and works in both Dutch and English. Typing "aardappel" and "potato" will both find the same product.

### Method D — Scan a barcode

**USB barcode scanner (keyboard wedge):**
1. Point the scanner at the product barcode.
2. The scanner automatically adds the product to the cart. No clicking needed.
3. The scanner works like a keyboard — it "types" the barcode and presses Enter.

**Manual barcode entry:**
1. Click the search bar.
2. Type the 8–13 digit barcode number.
3. Press **Enter**. If the barcode matches a product, it is added to the cart.

**Camera barcode scanner (Quagga2):**
1. If your terminal has a camera, the camera scanner may be enabled in Settings.
2. Point the camera at the barcode.
3. When detected, the product is added automatically.

---

## 3.2 Changing the quantity

**Adding more of the same item:**
- Simply click the product card again. Each click adds one unit.

**Setting an exact quantity:**
1. Find the item in the cart (right side of screen).
2. Click the **quantity number** on that line item.
3. A line item edit panel opens.
4. Change the quantity to the number you want.
5. Click **Save** or press **Enter**.

**Setting a fractional quantity (weight/bulk items):**
- Quantities support decimal values. For example, enter `1.5` for 1.5 kg.

---

## 3.3 Removing an item from the cart

1. Find the item in the cart panel.
2. Click the **× (delete)** button or trash icon on that line.
3. The item is removed and the total is recalculated.

To remove all items at once, click the **Clear cart** button at the bottom of the cart panel.

---

## 3.4 Understanding the cart panel

The cart panel on the right shows:

```
Item name                   Qty    Unit price   Line total
────────────────────────────────────────────────────────
Melk (1L)                   2×     SRD 8.50     SRD 17.00
Brood volkoren              1×     SRD 12.00    SRD 12.00
────────────────────────────────────────────────────────
Subtotal                                        SRD 29.00
Discount                                        SRD  0.00
BTW (10%)                                       SRD  2.55  ← tax
────────────────────────────────────────────────────────
TOTAL                                           SRD 31.55
```

- **Subtotal** — the sum of all line totals before any discount
- **Discount** — any discount applied (see [Chapter 8 — Discounts](08-discounts.md))
- **BTW** — the tax amount (already included in the total — shown for transparency)
- **Total** — the amount the customer pays

> **Note on BTW:** The total already includes BTW. The BTW line is shown for information only, not as an extra charge. BTW-exempt products (basic foods, medicine) show SRD 0.00 BTW.

---

## 3.5 Viewing today's totals

The **top bar** always shows today's running totals without leaving the POS screen:

- **Total sales** — total SRD taken in sales today
- **Transaction count** — number of completed sales today

These numbers update instantly after each completed sale.

---

## 3.6 What happens if a product is not found?

If a barcode or search returns no result:
- The search bar turns red or shows "No products found".
- The product is not in the catalogue. Contact your manager to add it.

You can still sell an unlisted product by:
1. Adding any product to the cart.
2. Editing the name and price on the line item (see [Chapter 8 — Discounts](08-discounts.md) for line item editing).

---

## Common problems

| Problem | Solution |
|---------|----------|
| Product grid is empty | Check that a store is selected. Check internet/server connection. |
| Barcode scanner adds wrong product | The barcode may be for a different product. Check the catalogue. |
| Product shows SRD 0.00 price | The product was not priced correctly. Contact manager. |
| Cart total seems wrong | Check for unexpected discounts. Click each item to review prices. |
