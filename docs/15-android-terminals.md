# 15. Android POS terminals — the complete guide

Android till terminals (Posiflex RT series, Android tablets, similar devices)
run Josbin POS as a **native Android app** — same screens, same login, same
server logic as the Windows app, but the platform behaves differently in a
few ways that matter in a shop. This chapter collects **everything
Android-specific in one place**. If your tills are Windows machines, you can
skip it entirely.

> **Pilot status.** The Android app is newer than the Windows app and is
> being verified on real terminals now. Before a first go-live on Android
> hardware, plan a short test day: sell, print, open the drawer, scan —
> with your supplier present.

> **Zooming out first?** [Chapter 16](/docs/16-deployment-options) compares all
> four setups (Windows/Android × local/cloud server) with diagrams.

## 15.1 The one mental model to keep

**On Android, the terminal touches nothing but the scanner. Everything else
happens over the network.**

```
                        INTERNET (optional — only for
                        head-office sync & licence check)
                            │
                     ┌──────┴──────┐
                     │  SHOP ROUTER │  creates the local network
                     └──┬───┬───┬──┘  (works even when internet is down)
             wi-fi      │   │   │      LAN cable
        ┌───────────────┘   │   └───────────────┐
        │                   │                   │
┌───────┴────────┐  ┌───────┴────────┐  ┌───────┴────────┐
│ ANDROID        │  │ SERVER PC      │  │ RECEIPT PRINTER │
│ TERMINAL       │  │ (any Windows   │  │ (LAN module,    │
│ Josbin POS app │  │ PC — runs the  │  │ port 9100)      │
│                │  │ whole system)  │  │      │ RJ11     │
│  ⌐ USB dongle  │  │ 192.168.0.250  │  │ ┌────┴───────┐  │
│  │ or Bluetooth│  │                │  │ │ CASH DRAWER │  │
│ SCANNER        │  │                │  │ └────────────┘  │
└────────────────┘  └────────────────┘  └─────────────────┘
```

Three consequences follow from this picture:

1. **The receipt printer must be network-attached.** USB printing does not
   exist on Android — the app deliberately doesn't offer it. Printers like
   the Posiflex PP-9000 take a swap-in LAN interface module; with that
   fitted (or any Ethernet/Wi-Fi ESC/POS printer), receipts and the cash
   drawer behave exactly as on Windows.
2. **The cash drawer never connects to the terminal.** Its RJ11 cable goes
   into the **printer**; the app opens it by sending a pulse *through* the
   printer. No working printer → no drawer, on every platform.
3. **The local network is not the internet.** The router connects the
   terminal, the server and the printer to each other all by itself. When
   the internet feed drops, selling continues; only head-office sync waits.

## 15.2 What connects where — wiring table

| Device | Connects to | How | Notes |
|---|---|---|---|
| Barcode scanner (e.g. NT-M8) | **The terminal** | USB dongle in the terminal's port, or Bluetooth pairing | Behaves as a keyboard — zero configuration, works instantly |
| Receipt printer | **The router** (never the terminal) | LAN cable to the shop router, raw printing on port 9100 | Give it a fixed/reserved IP (e.g. `192.168.0.251`) |
| Cash drawer | **The printer** | RJ11 cable into the printer's drawer port | Opens on cash/mixed sales + the Test button |
| Server PC | **The router** | LAN cable (preferred) or wi-fi | Static IP — our convention `192.168.0.250` |
| Android terminal | **The router** | Wi-fi (most RT units also have a hidden RJ45 behind the snap-off back cover) | Joins the same network as everything above |

## 15.3 Installing and updating the app

**Install (once per terminal):**

1. On the terminal, open Chrome and download the APK — from the store's own
   dashboard (**Dashboard → POS app → ⬇ Android app (.apk)** — works on the
   shop LAN with no internet) or from the address your vendor provides.
2. Tap the downloaded file. Android asks to allow installs from this source
   — allow it (*Install unknown apps*). This question appears only once.
3. Open **Josbin POS** → **⚙ Server** on the login screen → enter the store
   server address (usually `192.168.0.250:8080`) → **Test** → **Save**.
4. Log in. Done — the address and settings are remembered.

**Update:** install the newer APK over the old one. Settings, server address
and login survive. There is no auto-update on Android (yet) — when a new
version is placed on the store server, the dashboard's POS-app card shows
the new version number.

**More terminals:** every extra till is the same three steps — join the
wi-fi, install the same APK, point at the same server address. All tills
share products, stock and reports through that one server.

## 15.4 Checking every connection — from the app itself

| What | Where to check | Green means |
|---|---|---|
| Backend server | Login screen → **⚙ Server → Test** (and the **Online** pill on the POS header, live) | The till can sell |
| Receipt printer | **Settings → Hardware → Test receipt print** | A real test ticket prints via the exact path sales use |
| Cash drawer | **Settings → Hardware → Test cash drawer** | The drawer pops — printer path is fully working |
| Label printing | **Settings → Hardware → Test label print** | Android's print dialog opens with a test label sheet |
| Scanner | Point it at any barcode | Digits appear in the search bar — that *is* the test |

If the printer tests stay red: the printer is not reachable on the network.
Check the LAN cable, then verify its IP in **Settings → Hardware** matches
the printer's actual address (print the printer's self-test page — hold its
feed button on power-on — to see its IP).

## 15.5 What is different from the Windows app

| Capability | Windows app | Android app |
|---|---|---|
| Receipt printer via USB | ✅ | ❌ — network printer only |
| Receipt printer via network (port 9100) | ✅ | ✅ |
| Cash drawer (via printer) | ✅ | ✅ |
| USB/Bluetooth barcode scanner | ✅ | ✅ |
| Label printing | ✅ system dialog | ✅ Android print dialog (network/office printers Android knows; raw thermal receipt printers don't appear there) |
| 🔍 Find my server (network scan) | ✅ | ❌ — type the address once |
| Camera as barcode scanner | ✅ | ❌ for now — use the handheld scanner |
| Auto-update | installer re-run | install new APK over old |
| App size | ~108 MB | ~4 MB (uses Android's own browser engine) |

Everything not listed — selling, payments, BTW (including vrijstelling),
discounts, hold bills, refunds, registers, Z-reports, reports, languages —
is identical on both platforms.

## 15.6 Field checklist for an Android store

- [ ] Server PC on a **static IP** (`192.168.0.250`) — plain DHCP breaks
      every till after a router reboot
- [ ] Printer on a **reserved IP** (e.g. `192.168.0.251`), LAN cable seated
- [ ] Drawer RJ11 in the printer, not in anything else
- [ ] Terminal on the shop wi-fi, ⚙ Server tested green
- [ ] All four checks in §15.4 green
- [ ] Server PC on a small **UPS**, backups configured — that PC is now the
      store's book of record
- [ ] Internet plan: stable line, phone hotspot as fallback, or planned
      offline operation (the licence check tolerates 72 hours offline;
      longer stretches use the USB export route for head-office sync)
- [ ] Test day done: sell, print, drawer, scan, refund, Z-report

## 15.7 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| App shows a blank/white screen | The terminal's Android WebView is very outdated | Open `http://<server>:8091` in the terminal's Chrome — if that renders, the app will too; update "Android System WebView" via the Play Store if present |
| ⚙ Server Test fails, but the terminal's browser can reach the same address | Wrong address format | Enter `IP:port` only (e.g. `192.168.0.250:8080`) — the app adds the rest itself |
| Printer back panel shows only **power + USB + DK** | The USB interface board is fitted — no network capability. DK is the **drawer** port (RJ11), not a network port; never plug a LAN cable into it | Order the **LAN/Ethernet interface card for the PP-9000 (Aura) series** from the hardware supplier — a two-screw swap. Note: a USB-to-Ethernet *adapter* does NOT work (those give computers a network port, they don't make a printer networked) |
| Printer test red, printer powered on | Printer not on the network, or wrong IP in Settings | Print the printer's self-test page for its real IP; check the LAN cable and the reserved-IP setting in the router |
| Drawer doesn't open but receipts print | Drawer cable | Reseat the RJ11 in the printer's drawer port (not the phone-line port) |
| "Install blocked" when opening the APK | Unknown-sources permission | Allow *Install unknown apps* for Chrome when Android asks |
| Label test opens a dialog with no printers | Android only lists office-style network printers | Print labels from the manager's PC instead — labels are a back-office job; receipts on the till are unaffected |
| Sales fail with a server error after the wi-fi changed | Router handed out new addresses | Re-check §15.6: static IP for the server, reserved IP for the printer |

**Where the rest lives:** quick install steps in the
[install guide §E5](/docs/00-installation-and-setup#e5-android-terminals-posiflex-rt-series-tablets),
which store setup fits which shop in
[§7.0 of the offline chapter](/docs/07-sync-and-offline), and licensing in
[chapter 11](/docs/11-license-and-delivery) — an Android till occupies a
licence slot exactly like a Windows till.
