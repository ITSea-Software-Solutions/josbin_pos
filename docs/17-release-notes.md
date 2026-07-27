# 17. Release notes — POS app (Windows & Android)

Both till apps are released **together with the same version number** — a
store never has to wonder whether its Windows tills and Android terminals
are on matching software. Every file on the
[download page](http://142.93.88.143:8095/downloads.html) ships with a
`.sha256` file to verify the download (see the
[install guide](/docs/00-installation-and-setup) for how).

**Upgrade rule:** never uninstall first. Close the app (⏻ Exit on the
login screen), run the newer installer / install the newer APK over the
old one — settings, server address and login survive.

## 1.4.3 — 27 July 2026 *(current)*

Printed-receipt fixes, from a real roll of paper.

- **The TOTAL no longer breaks across two lines.** It prints in double-width
  type, but the app was laying it out at normal width, so the printer pushed
  the amount onto the line below the word TOTAL. The one line a customer
  checks is now a single clean line.
- **The date is a Suriname date.** It printed the raw technical timestamp;
  it now reads `27-07-2026 16:42`, in the date order the shop chose, and
  always in Suriname time — even if the terminal's own clock is set to
  another country.
- **The cashier's name prints instead of an internal code.**
- **Long product names wrap instead of being cut off**, so the customer can
  read what they were charged for.
- **BTW is stated once, not twice.** A single-rate sale shows one BTW line;
  a mixed-rate basket lists each rate with its own amount.
- **Amounts line up.** Item prices and totals both read `SRD 12.34`, right
  aligned in one column, and rates print as `10%` rather than `10.00%`.
- **Narrow 58 mm rolls hold their layout** — a long customer name moves to
  its own line instead of chopping the label next to it.

## 1.4.2 — 27 July 2026

- **The USB printer setting now stays selected on Android terminals.** A
  leftover rule from when USB printing was Windows-only quietly switched
  the printer back to "network" every time Settings was opened, undoing
  the pairing that had just been made. Anyone who paired a printer on
  1.4.1 and found it gone again was hitting this.
- **The app version is now shown at the bottom of Settings** (e.g.
  *v1.4.2 · android*), so a terminal can always be identified without
  guesswork about which update it received.
- **Receipts and reports say BTW, never "VAT".** BTW is the tax's name in
  Suriname, so the English receipt, the English reports, the Belastingdienst
  summary and the Rekenkamer export now all use it — matching the Dutch
  side and what the tax authority expects to read.
- **The receipt now prints by itself when the sale is paid**, the same way
  the cash drawer already opens by itself — no tapping Print on every
  sale. Tills that were already on the old default get switched over
  automatically; it can still be turned off under Settings → Printer.

## 1.4.1 — 27 July 2026

- **USB printers now actually appear on Android terminals.** The app was
  never granted USB access by Android, so Settings → Hardware → Connect
  USB printer found nothing however the printer was plugged in. It now
  finds the printer, and plugging one in offers to connect it
  automatically.
- **Scanning after tapping a product works first time.** The scanner is
  now read no matter what was last touched on screen. Before, a tap left
  the keyboard "pointing at" the tapped product, so the next scan either
  did nothing or increased the tapped product's quantity, and the code had
  to be scanned twice.
- **The till feels quicker on Android.** Tapping a product no longer opens
  and closes the on-screen keyboard each time.
- **A printer that cannot be found now explains why** — no USB port on the
  terminal, nothing plugged in, or a device that is not a printer — and
  lists what it did find.
- **Updating an Android terminal is reliable.** Every APK until now
  carried the same internal build number, which could make Android treat a
  newer version as a duplicate and refuse the update.

## 1.4.0 — 27 July 2026

- **USB receipt printers now work directly on Android terminals.** Plug
  the printer into the terminal, pair it once under Settings → Hardware
  → USB → Connect USB printer, and receipts plus the cash drawer work —
  no network card in the printer, no Windows PC in between. See the
  Android chapter §15.9.

## 1.3.3 — 27 July 2026

- **Updating no longer gets stuck.** The installer now closes a running
  Josbin POS by itself. Older versions asked you to close it manually —
  impossible on a till, where the app runs fullscreen with no visible
  close button — and the update dead-ended with *"Josbin POS cannot be
  closed"*.

## 1.3.2 — 27 July 2026

- **Receipt printing and the cash drawer now work on Windows.** Two
  separate faults were fixed: the app used a legacy text-printing command
  that never delivered the printer's control codes, and the receipt data
  was packaged in a form the app could not pass to the printing service at
  all. Both paths — receipts and the drawer pulse — go through Windows'
  raw printing service now. (Windows' own test page always worked, which
  is why the printer looked fine.)
- **Scanning right after tapping a product.** The cursor now returns to
  the search/scan box after every product you tap, so the next scan adds
  that product instead of increasing the quantity of the one you tapped.
- **Hardware tests now say what went wrong** — a failed test in
  Settings → Hardware shows the actual message from Windows or the
  network, instead of only turning red.

- **Receipt printing on Windows fixed.** Receipts and the cash-drawer
  pulse are now sent through Windows' raw printing service. The previous
  build used a legacy text-printing command that never delivered the
  printer's control codes — the printer stayed silent or ejected a blank
  page even though Windows' own test page worked.
- **Hardware tests now say what went wrong.** A failed test in
  Settings → Hardware shows the actual message from Windows (or the
  network), instead of only turning red.

## 1.3.0 — 27 July 2026

First synchronized release: Windows exe and Android APK cut from the same
code. Everything below is on both platforms unless marked.

- **BTW exemption (vrijstelling)** at the till — government and other
  exempt buyers pay ex-BTW prices; mandatory reason on the receipt and in
  the reports.
- **Self-service shift handover** — with the org policy on, the next
  shift opens a closed register with their own float, no manager needed.
- **Hardware test buttons** — test receipt print, cash drawer, and label
  print from Settings → Hardware.
- **Printer bridge** *(Windows)* — share a USB receipt printer on the
  network so Android terminals print through the Windows till.
- **Exit & Log out everywhere** — ⏻ Exit on the login screen and the
  register screens (Windows); ⎋ Log out on every register screen; a
  blocked register never traps the cashier ("Continue on another
  register").
- **Label printing on Android** — the Labels page prints via Android's
  print dialog.
- **🔍 Find my server** *(Windows)* — scans the shop network for the
  store server during setup.
- **Runtime server address** — ⚙ Server on the login screen points any
  till at any server, no rebuild.
- App window and installer now agree on the name **Josbin POS**
  (previously the window title still said "SuraPOS", which made the app
  hard to find in Task Manager).

## Older versions *(superseded — upgrade to 1.3.0)*

| Version | Platform | Date | Notes |
|---|---|---|---|
| 1.1.2 / 1.1.1 / 1.1.0 | Windows | 27 Jul 2026 | Interim builds while the printer bridge and exit buttons landed |
| 1.2.1 / 1.2.0 / 1.1.0 | Android | 26–27 Jul 2026 | Interim builds: exemption UI, handover gate, label printing |
| 1.0.0 | both | 25 Jul 2026 | First field builds for the Suriname office test |
