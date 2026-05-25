# Chapter 13 — Settings

**Who uses this:** Store manager
**Where:** Top bar → Settings (Dutch: *"Instellingen"*)

The Settings screen lets you configure the printer, cash drawer, language, and other store preferences. Changes take effect immediately and are saved automatically.

---

## 12.1 Opening Settings

1. In the top bar, click **Settings** (Dutch: *"Instellingen"*).
2. The Settings screen opens, divided into sections.

---

## 12.2 Printer & cash drawer setup

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

### Step 4 — Test the cash drawer

1. Click the **Test drawer** button (Dutch: *"Lade testen"*).
2. The system sends a pulse to the printer.
3. If configured correctly, the cash drawer opens.
4. The button shows "Opened ✓" in green, or "Error" in red.

If it shows Error:
- Check all cable connections.
- Try the other pin setting (Pin 2 vs Pin 5).
- Make sure the printer is on and connected.

---

## 12.3 Language and date format

### Language

1. Find the **Language** section (Dutch: *"Taal"*).
2. Click **Nederlands** for Dutch or **English** for English.
3. The entire interface switches immediately — no restart needed.
4. This preference is saved per user (each cashier can have their own language).

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

## 12.4 On-screen keyboard

The on-screen keyboard is a full keyboard displayed at the bottom of the POS screen — useful for touchscreen-only terminals without a physical keyboard.

**To toggle the on-screen keyboard:**
- Click the **keyboard icon** in the top bar. The keyboard slides up from the bottom.
- Click it again (or the × button on the keyboard) to hide it.

The on-screen keyboard can be used for:
- Typing in the search bar
- Entering cash amounts on the payment numpad
- Any text field in the application

---

## 12.5 Store information

This section shows (read-only) the current store information:
- Store name
- Organisation name
- Your user role
- Store ID (reference number)

These can only be changed by the Super Admin. Contact your administrator if anything is incorrect.

---

## 12.6 BTW (tax) defaults

Managers can configure default BTW settings:

| Setting | Description |
|---------|-------------|
| Default BTW rate | Applied to new products if no rate is specified (e.g. 10%) |
| BTW-exempt categories | Categories where all products are automatically exempt |

> **Note:** Individual product BTW rates override the default. Changing the default does not retroactively change existing products.

---

## 12.7 Settings reference table

| Setting | Default | Notes |
|---------|---------|-------|
| Printer type | None | Must be set before printing works |
| Printer IP | (empty) | Network printers only |
| Printer port | 9100 | Do not change unless your printer uses a different port |
| Cash drawer pin | Pin 2 | Change to Pin 5 if drawer doesn't open |
| Language | Nederlands | Per-user setting |
| Date format | DD-MM-YYYY | Per-user setting |

---

## Common problems in Settings

| Problem | Solution |
|---------|----------|
| Printer list is empty (USB mode) | Printer is not installed in Windows. Install via Windows Settings → Printers. |
| Test drawer shows "Error" | Check all cable connections. Try the other pin setting. Check printer power. |
| Settings are not saved after closing | Settings are saved in your browser's local storage. Do not use private/incognito mode. |
| Language reverts to Dutch after login | Language is saved per user per device. Set it again on each device/browser. |
