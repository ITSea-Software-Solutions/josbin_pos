# Chapter 13 — Settings

**Who uses this:** Store manager
**Where:** Top bar → Settings (Dutch: *"Instellingen"*)

The Settings screen lets you configure the printer, cash drawer, language, and other store preferences. Changes take effect immediately and are saved automatically.

---

## 13.1 Opening Settings

1. In the top bar, click **Settings** (Dutch: *"Instellingen"*).
2. The Settings screen opens, divided into sections.

---

## 13.2 Printer & cash drawer setup

This is the most important section. Without a correctly configured printer, thermal receipts and the cash drawer will not work.

### Step 1 — Choose connection type

Under **Printer connection** (Dutch: *"Printerverbinding"*), select one of three options:

| Option | When to use |
|--------|------------|
| **None** | No printer connected. PDF receipts only. Cash drawer will not open. |
| **Network** | Printer connected via Ethernet or Wi-Fi (recommended for most setups). |
| **USB** | Printer connected directly by USB cable to this Windows PC. |

### Step 2A — Configure a Network printer

If you selected **Network**:

1. **IP Address** — enter the printer's IP address (e.g. `192.168.1.100`).
   - Find this on the printer's own configuration print (hold the Feed button on most EPSON printers to print a status page).
   - Or check your router's connected devices list.
2. **Port** — leave as `9100` (this is the standard ESC/POS raw port used by all network receipt printers).
3. Click **Save**.

> **Tip:** If you do not know your printer's IP, use a static IP. Ask your IT person to assign a fixed IP to the printer so it never changes.

### Step 2B — Configure a USB printer (Windows only)

If you selected **USB**:

1. Click **Refresh printers** (Dutch: *"Printers vernieuwen"*).
2. A dropdown appears with all printers installed in Windows.
3. Select your receipt printer from the list (e.g. "EPSON TM-T20II").
4. Click **Save**.

> **Tip:** If your printer does not appear, make sure it is installed in Windows first. Go to Windows Settings → Bluetooth & devices → Printers & scanners → Add a printer.

### Step 3 — Configure the cash drawer pin

The cash drawer pin determines which connector the drawer is plugged into on the back of the printer.

| Setting | When to use |
|---------|------------|
| **Pin 2 (most printers)** | Default. Use this unless the drawer does not open. |
| **Pin 5** | Some older printers use Pin 5. Try this if Pin 2 doesn't work. |

### Step 4 — Test the printer, cash drawer and labels

Three test buttons sit below the pin setting. Use them after every change on this page — each shows a green "✓" on success or a red error:

1. **Print test receipt** (Dutch: *"Testbon afdrukken"*) — prints a short sample receipt through exactly the same path a real sale uses. If this prints correctly, sales receipts will too.
2. **Test cash drawer** (Dutch: *"Test kassalade openen"*) — sends the open pulse to the drawer through the printer.
3. **Print test label** (Dutch: *"Testetiket afdrukken"*) — prints a small sample price label. On Windows the print dialog opens (pick your label printer); on an Android terminal the Android print dialog opens. This button also works when the connection type above is **None**, because labels can go to any printer — not just the thermal one.

All three buttons work the same on Windows terminals and Android terminals.

If a test shows Error:
- Check all cable connections, and that the printer is on.
- Receipt or drawer: try the other pin setting (Pin 2 vs Pin 5). On an Android terminal, remember the receipt printer must be connected via the network — USB-only receipt printers are not supported on Android.
- Label: make sure a printer is installed in Windows, or that a print service is enabled on the Android terminal (Android Settings → Printing).

### Step 5 — Auto-print receipts (optional)

Below the drawer test sits the toggle **"Print receipt automatically after each sale"**.

- **Off (default):** the cashier taps **Print** on the receipt screen whenever the customer wants paper.
- **On:** the receipt prints by itself the moment each sale completes — exactly once per sale. With a thermal printer configured it prints silently; with connection type **None** the Windows print dialog opens after every sale instead (which gets old fast — configure the printer first).

This is a per-terminal setting. See [Chapter 6 §6.2](06-receipts.md) for how it behaves on the receipt screen.

---

## 13.3 Language and date format

### Language

1. Find the **Language** section (Dutch: *"Taal"*).
2. Click **Nederlands**, **English**, or **Sranantongo**.
3. The entire interface switches immediately — no restart needed.
4. This preference is saved per user (each cashier can have their own language).

> **Sranantongo is a draft.** The whole POS works in it (receipts sent via
> WhatsApp follow along), but the wording is still being reviewed by native
> speakers — error messages from the server appear in Dutch for now. Spot a
> phrase a Paramaribo cashier would say differently? Tell your manager.

### Date format

The date format affects how dates are shown on receipts, reports, and throughout the interface.

Available formats:

| Format | Example |
|--------|---------|
| DD-MM-YYYY | 19-04-2026 (Dutch default) |
| MM/DD/YYYY | 04/19/2026 (US format) |
| YYYY-MM-DD | 2026-04-19 (ISO format) |
| DD MMM YYYY | 19 Apr 2026 |
| D MMMM YYYY | 19 April 2026 |
| MMM D, YYYY | Apr 19, 2026 |

Select the format that matches your preference or local convention.

---

## 13.3a Appearance — Night or Day

The till screen comes set to **Night**: a dark screen, which is easier on the
eyes in a shop that opens before sunrise and does not glare back at you in a
dim aisle.

**Day** is the light version. Use it where the terminal sits in real daylight
— by a window, under a skylight, or on an outdoor counter — because a dark
screen in bright light turns into a mirror.

1. Open **Settings**.
2. Find the **Appearance** section.
3. Tap **🌙 Night** or **☀ Day**. The whole screen changes at once.

The choice belongs to the terminal, not to the person: it is a property of
where that till stands and what light falls on it, so it stays put when the
next cashier signs in.

---

## 13.4 On-screen keyboard

The on-screen keyboard is a full keyboard displayed at the bottom of the POS screen — useful for touchscreen-only terminals without a physical keyboard.

**To toggle the on-screen keyboard:**
- Click the **keyboard icon** in the top bar. The keyboard slides up from the bottom.
- Click it again (or the × button on the keyboard) to hide it.

The on-screen keyboard can be used for:
- Typing in the search bar
- Entering cash amounts on the payment numpad
- Any text field in the application

---

## 13.5 Store information

This section shows (read-only) the current store information:
- Store name
- Organisation name
- Your user role
- Store ID (reference number)

These can only be changed by the Super Admin. Contact your administrator if anything is incorrect.

---

## 13.6 BTW (tax) defaults

Managers can configure default BTW settings:

| Setting | Description |
|---------|-------------|
| Default BTW rate | Applied to new products if no rate is specified (e.g. 10%) |
| BTW-exempt categories | Categories where all products are automatically exempt |

> **Note:** Individual product BTW rates override the default. Changing the default does not retroactively change existing products.

---

## 13.7 Settings reference table

| Setting | Default | Notes |
|---------|---------|-------|
| Printer type | None | Must be set before printing works |
| Printer IP | (empty) | Network printers only |
| Printer port | 9100 | Do not change unless your printer uses a different port |
| Cash drawer pin | Pin 2 | Change to Pin 5 if drawer doesn't open |
| Auto-print receipt | Off | Per terminal; prints as soon as each sale completes — §13.2 Step 5 |
| Language | Nederlands | Per-user setting |
| Date format | DD-MM-YYYY | Per-user setting |
| Scale barcodes (weighed goods) | Off | §13.9 — confirm the layout against your store's scale before go-live |
| Auto-launch on system boot | Off | Manager+ — see §13.8 |
| Close + Restart buttons | (Manager+) | Visible only to Store Manager and above |

---

## 13.8 System (manager / store manager only)

The **System** tab in Settings is hidden from cashier accounts. It shows three controls that belong to the manager who's responsible for the terminal:

### Auto-launch on system boot

A toggle (off by default). When on, Josbin POS opens automatically when the Windows machine boots — so the terminal is ready for the morning shift without anyone touching the keyboard.

- **Turn it on for terminals that should "just work" every morning** — typical for cash desks
- **Leave it off for back-office machines** — a manager's PC that also runs other software shouldn't auto-launch a full-screen POS

This is per-device (lives in the Windows startup folder via the Electron app). Toggling it off requires Josbin POS to be running once to remove the entry; otherwise delete it manually from Windows: `Win+R` → `shell:startup` → delete the Josbin POS shortcut.

### Restart app

A button (Manager+ only). Closes the Electron window and re-opens it. Used when:

- The catalogue won't refresh and you want a clean reload
- The terminal has been running for days and feels sluggish
- After a manual update where you want to be sure the new code is loaded

> **Restart does NOT log you out.** Your session continues — when the new window opens you're still on the same screen, same store, same register session.

### Close app

A button (Manager+ only). Closes Josbin POS completely (Electron quits). Use at end of day or for maintenance.

> **Closing during an open register?** You'll get a warning. Close your register first (Chapter 3 §3.5) or the next opener won't be able to start a new session on the same register.

Both Close + Restart are manager-gated because a cashier accidentally tapping them mid-line would lose state. The cashier sees no buttons here at all.

---

## 13.9 Weighed goods / scale barcodes

For shops with a **labelling scale** (deli counter, meat, produce): the scale weighs the item and prints a barcode that carries a *value* — the price it calculated, or the weight — instead of identifying a fixed product. Josbin POS can read those labels, so the cashier just scans and the line comes out priced correctly.

**Off by default.** Only enable it if your store actually uses scale labels.

### The settings

| Setting | What it means | Default |
|---|---|---|
| **Read scale barcodes** | Master toggle for the feature | Off |
| **Embedded value** | **Price** — the scale already priced the item; the label carries the amount (SRD). **Weight** — the label carries the weight; the POS multiplies it by the product's catalogue price per kg. | Price |
| **Prefix** | The leading digit(s) that mark a barcode as a scale label. Nearly all scales use **2** (the EAN-13 "in-store" range). | 2 |

### How the label is read

Scale labels are EAN-13 barcodes with this layout (the standard 6 + 5 split):

```
2  123456  01750  C
│  │       │      └ check digit
│  │       └ 5-digit value — price in cents (SRD 17.50) or weight in grams (1.750 kg)
│  └ 6-digit item code — must match the product's barcode in the catalogue
└ prefix (configurable, default 2)
```

Two things must be true for this to work:

1. **The product exists in the catalogue with the 6-digit item code as its barcode** — e.g. barcode `123456` on "Kipfilet per kg", priced per kg. The scale and the catalogue must agree on that code.
2. **The layout matches your scale.** The prefix and the value type (price/weight) are configurable here; the 6 + 5 digit split is fixed to the common standard. Scale brands (Bizerba, CAS, Avery, Digi, …) can be programmed differently — if your scale uses another split, contact your Josbin representative **before** enabling this.

> ⚠️ **Standing rule — test before go-live, every store, every scale.** Print a few labels on the store's actual scale and scan them at the till. Check the product, the weight/price and the line total are exactly right. **A wrong layout does not produce an error — it silently mis-prices every weighed item.** Never switch this on for a store without confirming against that store's own scale, and re-test after anyone reprograms the scale.

### What the cashier sees

Nothing new — that's the point. Scan the label like any barcode ([Chapter 4 §4.1, Method D](04-making-a-sale.md)):

- **Price mode:** the product is added with the label's embedded price as the line price for that weighed item.
- **Weight mode:** the product is added with the weight as the quantity (e.g. `1.750`), priced at catalogue rate × kg.

If the item code isn't found, the normal "product not found" message appears — add the product to the catalogue (with the item code as its barcode) and scan again. Like the other options on this screen, this is a **per-terminal** setting: enable it on every till of the store.

---

## Common problems in Settings

| Problem | Solution |
|---------|----------|
| Printer list is empty (USB mode) | Printer is not installed in Windows. Install via Windows Settings → Printers. |
| Test drawer shows "Error" | Check all cable connections. Try the other pin setting. Check printer power. |
| Settings are not saved after closing | Settings are saved in your browser's local storage. Do not use private/incognito mode. |
| Language reverts to Dutch after login | Language is saved per user per device. Set it again on each device/browser. |
