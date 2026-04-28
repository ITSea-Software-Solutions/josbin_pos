# Chapter 11 — Barcode & Label Printing

**Who uses this:** Manager, stock/warehouse staff
**Where:** Top bar → Labels (Dutch: *"Etiketten"*)

Use this screen to print product price labels with barcodes for shelf labelling, stock marking, or price display.

---

## 11.1 Opening the Labels screen

1. In the top bar, click **Labels** (Dutch: *"Etiketten"*).
2. The Labels screen opens with two panels:
   - **Left panel** — product list and selection
   - **Right panel** — label settings and print button

---

## 11.2 Finding and selecting products

**Search for products:**
1. Click the search bar at the top of the product list.
2. Type a product name or barcode. The list filters as you type.
3. Clear the search to see all products again.

**Select individual products:**
1. Find the product in the list.
2. Click the **checkbox** on the left side of the product row.
3. A checkmark appears and the row highlights purple.
4. Repeat for every product you want to label.

**Select all filtered products at once:**
1. Use the search bar to filter to a category or name if needed.
2. Click the **Select all** button (Dutch: *"Alles selecteren"*) above the list.
3. All currently visible products are selected.

**Clear selection:**
1. Click the **Clear all** button (Dutch: *"Deselecteren"*) to uncheck everything.

---

## 11.3 Setting the quantity of labels per product

Each selected product has a **quantity field** on the right side of its row.

1. Click the number field for a product.
2. Type the number of labels you want (e.g. `10` to print 10 labels for that product).
3. Press Tab or click another field to confirm.

The **label summary** in the right panel updates to show the total number of labels that will be printed.

---

## 11.4 Choosing the barcode type

In the right settings panel, under **Barcode type** (Dutch: *"Type streepjescode"*):

| Option | Best for |
|--------|---------|
| **EAN-13** | Standard retail products with a 13-digit barcode. Most shelf scanners read this. |
| **Code 128** | Internal products, custom codes, or any text/number up to 20 characters. |
| **QR** | Products that need a QR code instead of a barcode (e.g. for phone scanning). |

**How to choose:**
- If your products already have EAN-13 barcodes (the standard barcode on most packaged goods), select **EAN-13**.
- For in-house products or items without a standard barcode, use **Code 128** — it works with any characters.
- Use **QR** only if your customers or staff use phone-based QR scanners.

> **Note:** All barcodes are generated directly on your computer — no internet connection is needed.

---

## 11.5 Choosing the label size

Under **Label size** (Dutch: *"Etiketgrootte"*), three sizes are available:

| Size | Physical dimensions | Best for |
|------|---------------------|---------|
| **36 × 24 mm** | Small — about the size of a stamp | Small product stickers, spice jars |
| **50 × 30 mm** | Medium — standard retail shelf label | Most everyday products |
| **60 × 40 mm** | Large — plenty of space for name and price | Large items, easy-read labels for elderly customers |

Select the size that matches the label paper loaded in your label printer.

---

## 11.6 Showing/hiding name and price on the label

Two checkboxes control what appears on each label:

| Checkbox | What it controls |
|----------|-----------------|
| **Show name** (Dutch: *"Naam tonen"*) | Prints the product name above the barcode |
| **Show price** (Dutch: *"Prijs tonen"*) | Prints the SRD price below the barcode |

Both are checked by default. Uncheck either one if you do not want it on the label.

**Example label with both enabled:**
```
┌────────────────────┐
│  Melk (1L)         │  ← product name
│  ||||||||||||||||  │  ← barcode graphic
│  8 712345 678901   │  ← barcode number
│  SRD 8.50          │  ← price
└────────────────────┘
```

---

## 11.7 Printing the labels

1. Make sure at least one product is selected (the print button shows the total count, e.g. "Print (24)").
2. Click the **Print** button (Dutch: *"Afdrukken"*).
3. A short pause occurs while the system generates all barcodes (this happens locally on your computer).
4. Your browser's or system's **print dialog** opens automatically.
5. Select your label printer from the printer list.
6. Set the paper size to match your label paper.
7. Click **Print** in the dialog.

> **Tip:** Label printers typically need to be set as the default printer in Windows. Once set as default, the correct printer is usually pre-selected in the dialog.

**If the print dialog opens but nothing prints:**
- Check that the correct printer is selected.
- Check that the label paper is loaded correctly.
- Try printing one label first to verify alignment before doing a large batch.

---

## 11.8 Label printer setup tips

Josbin POS sends labels to any printer installed in Windows — it is not limited to thermal printers. Common label printers:

- **Zebra ZD-series** — popular in retail, uses ZPL or direct thermal labels
- **Dymo LabelWriter** — compact, good for small quantities
- **Brother QL-series** — fast, multiple label sizes available
- Any **A4 sheet label** printer — print on A4 sheets of peel-off labels

For best results, configure the label printer in Windows before using this screen. Set the paper size in the print dialog to exactly match your label sheet dimensions.

---

## Common problems

| Problem | Solution |
|---------|----------|
| Barcodes appear as numbers only (no graphic) | This was a known bug, now fixed. Make sure you are on the latest version. |
| Labels are the wrong size | Check that the label size in the right panel matches the paper in your printer, and that the printer paper size is set correctly in the print dialog. |
| Product is not in the list | The product may not be in the catalogue for this store. Contact your manager. |
| EAN-13 barcode looks wrong | EAN-13 requires a 12-digit number (system calculates the 13th check digit). Products without a proper barcode will use a generated code. |
