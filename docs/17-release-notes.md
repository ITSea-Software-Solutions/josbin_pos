# 17. Release notes — POS app (Windows & Android)

Both till apps are released **together with the same version number** — a
store never has to wonder whether its Windows tills and Android terminals
are on matching software. Every file on the
[download page](http://142.93.88.143:8095/downloads/) ships with a
`.sha256` file to verify the download (see the
[install guide](/docs/00-installation-and-setup) for how).

**Upgrade rule:** never uninstall first. Close the app (⏻ Exit on the
login screen), run the newer installer / install the newer APK over the
old one — settings, server address and login survive.

## 1.3.0 — 27 July 2026 *(current)*

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
