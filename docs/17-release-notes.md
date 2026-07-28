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

## 1.5.7 — 28 July 2026 *(current)*

- **One image for the whole platform, at the foot of every receipt.** Set it
  under Users → *Receipt footer stamp (whole platform)* in the dashboard —
  Super Admin only. It applies to every store that has not uploaded its own,
  so it does not have to be set store by store, and it can be changed later
  without touching any till. Changing it reaches the shop floor on the next
  receipt, and every change is recorded in the audit log.

## 1.5.6 — 28 July 2026

- **The receipt now prints straight away.** There was a 3–5 second pause
  between finishing a sale and anything happening at the printer. The till was
  asking the server for the sale it had *just been given* — twice over, once
  for the sale and once for the shop's details — before it could compose the
  ticket. It now uses what it already has, and the shop's details are kept
  between sales rather than fetched again for every customer.
- **A store can put its own image at the foot of the receipt.**
  Dashboard → Store settings → *Receipt footer stamp*. It prints like a stamp
  on a docket. Thermal printers have no greys, so a flat, high-contrast mark
  works best. No upload means no image — nothing is printed by default.

## 1.5.5 — 28 July 2026

**The cash drawer on Android terminals — the actual cause, found.**

The drawer signal was being sent as a *second* job just after the receipt.
Every send to a USB printer on Android takes exclusive hold of the printer and
lets go again afterwards, so that second send was grabbing the printer back
while it was still physically printing the receipt. Doing that mid-print jams
the printer's data channel, and once jammed it rejects everything — which is
why the terminal reported the same "printer refused the transfer" whether the
signal was 5 bytes or 10, while full receipts kept printing perfectly. The
size was never the point, and neither was the wiring.

- **The drawer signal now travels inside the receipt itself** — one send, so
  there is no second one to be rejected. The printer opens the drawer as it
  starts printing.
- **A jammed printer now un-jams itself.** If the data channel does stall, the
  app issues the standard USB reset for it and retries, twice, before giving
  up — and if it still fails it says to unplug and replug the cable, which is
  the one thing that actually fixes it.
- **The drawer signal is four times longer** (200 ms, was 50 ms). The old value
  is the printer manufacturer's figure for a 12 V drawer; these tills usually
  have 24 V drawers, which often will not throw their latch that fast.
- **Settings → Hardware → Find my cash drawer** tries seven different drawer
  signals in turn — both wiring pins, three pulse lengths, and the variant for
  printers that ignore a signal with no paper attached — one every 2.5 seconds,
  showing which is going. Tap *Use this* on the number that opens the drawer
  and the till remembers it.
- **The QR code and the Josbin logo are off the printed receipt.** The footer
  image is now the shop's own upload; no upload means no image.

## 1.5.4 — 28 July 2026

- **The cash drawer signal is now four times longer.** It was 50 ms, which is
  the printer manufacturer's figure for a 12 V drawer; the drawers under these
  tills are usually 24 V and often will not throw their latch that fast. The
  signal was being sent and accepted correctly — the drawer simply never had
  enough time to move, with no error anywhere to explain it. It is now 200 ms.
- **Settings → Hardware → Find my cash drawer.** If a drawer still stays shut,
  this sends seven different drawer signals in turn — both wiring pins, three
  pulse lengths, and the variant for printers that ignore a signal with no
  paper attached — one every 2.5 seconds, showing which one is going. Watch
  the drawer, tap *Use this* on the number that opens it, and the till
  remembers it. It replaces guesswork with one test.
- **The QR code and the Josbin logo are off the printed receipt.** The footer
  image is now the shop's own, uploaded by the shop; tills with no image
  uploaded print no image.

## 1.5.3 — 28 July 2026

- **A verification QR on every receipt with a BTW number.** It carries the
  shop's BTW registration number together with the receipt number, time,
  total and BTW amount — so the paper in a customer's hand can be checked
  against the sale the system recorded. A receipt whose figures were altered
  after printing stops matching. That is a claim about the tax on the bill
  that can actually be tested, which is worth more to a customer than a badge.
- **A store can upload its own stamp** for the foot of the receipt
  (Settings → the store's receipt image). Shops that upload nothing get the
  Josbin mark. A till that cannot reach its shop server still prints a stamped
  receipt — the fallback mark is built into the app.

## 1.5.2 — 28 July 2026

- **Cash drawer on Android terminals.** The drawer signal was being sent as
  a bare five-byte command with no job header. Windows accepted that; the
  Android USB connection refused it outright — reporting "0 of 5 bytes
  written" on a printer that had just printed a full receipt. The signal is
  now sent as a complete print job, and a transfer the printer rejects
  because it is still busy is retried once.
- **Returning to your own open till no longer says the register is in use.**
  If you close the app, log out, or the till restarts mid-shift, choosing
  your register now puts you straight back into your own shift. Another
  cashier's open drawer is still protected.
- **A Refresh button on the register list**, so a till can see a colleague
  closing their drawer without logging out and back in.
- **Transactions can do everything with a receipt again.** The 🖨 button on a
  past sale opened the PDF and nothing else — a customer who came back for a
  paper copy could not be given one. It now opens receipt options: reprint on
  the shop's own printer, PDF, e-mail, or WhatsApp.
- **The WhatsApp receipt is offered by itself** when the customer on the sale
  left a phone number: one button on the receipt screen, already addressed to
  them. Managers can switch it off under Settings → Printer. It is one tap,
  not hands-off — WhatsApp only accepts machine-sent messages through Meta's
  paid Business API, so the cashier still presses send in WhatsApp.
- **The Josbin mark now prints at the foot of the receipt**, like a stamp on a
  docket. (On paper it cannot sit *behind* the text — a thermal printer burns
  one line at a time and has nothing to composite into. The A4 / PDF receipt
  does carry a proper watermark.) Switchable off under Settings → Printer.

## 1.5.1 — 28 July 2026

- **A cash drawer that does not open now says why.** It failed silently:
  the till discarded the drawer's answer entirely, so a drawer that never
  opened looked exactly like one that did — which is why this took several
  attempts to pin down. The message now appears on the receipt screen next
  to the print result.
- **The drawer waits for the receipt to clear the printer** before it knocks.
  A receipt being accepted by Windows is not the same as the paper being
  out, and the pulse was still arriving mid-print.
- **The receipt screen is down to two buttons: Reprint and New sale.** PDF,
  e-mail and WhatsApp were things you reach for later about a sale that
  already happened — they are moving to Transactions, where you can find the
  right sale first.
- **Corrected a claim on the sign-in screen.** It read "fully offline",
  which overstated it. The till needs its store server — that server just
  sits in the shop, so no internet is required. It now says so plainly.

## 1.5.0 — 28 July 2026

**New look.** The till and the dashboard now carry Josbin's own colours,
taken from the company's website rather than approximated: the deep teal
ground, the orange, and the navy. The till stays dark because a shop opens
before sunrise and a white screen at that hour is a lamp; the office
dashboard stays light. Both are the same product at a glance.

- **The Josbin wing is now the app icon** on Windows and Android, the
  browser icon on every page, and the mark on both sign-in screens. The
  previous build carried the wrong logo entirely.
- **A four-colour bar sits on each sign-in card** — cyan, magenta, yellow
  and black, the inks a press lays down.
- **A failed receipt now says why.** Instead of a red "print error" with no
  explanation, the screen shows the actual message from Windows or from the
  printer connection — for example that the printer could not be reached at
  its address. That is the difference between a shop fixing it in a minute
  and having to call.
- **The receipt retries by itself.** The first sale of the day used to fail
  when the printer had slept overnight; it now tries again three times over
  about seven seconds before reporting a problem.

## 1.4.5 — 27 July 2026

- **The automatic receipt no longer fails on the first try.** The till was
  sending the cash-drawer signal and the receipt to the printer at the same
  instant; the printer could only take one, so the receipt reported an error
  and the drawer stayed shut — and tapping Print by hand then worked. The
  drawer signal is now sent *after* the receipt has gone, never alongside
  it, and a receipt that still fails retries itself once.
- **The drawer opens even if the receipt fails to print.** The customer is
  handing over cash either way.

## 1.4.4 — 27 July 2026

- **The cash drawer opens again on cash sales.** Making receipts print
  automatically (1.4.2) meant the till sent the drawer pulse and the receipt
  to the printer at almost the same moment, and the printer dropped one of
  them — paper came out, drawer stayed shut. The drawer signal now travels
  inside the receipt itself, so the printer handles them in order and the
  drawer springs as printing starts. A later reprint no longer re-opens it.
- **The payment screen starts clean on every sale.** The amount received
  from the previous customer stayed on screen, because the payment window
  reopened on the cash step instead of the method list. One tap on Complete
  could pay out change calculated from someone else's banknote.
- **The Josbin mark is now the app icon** on Windows and Android.

## 1.4.3 — 27 July 2026

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
