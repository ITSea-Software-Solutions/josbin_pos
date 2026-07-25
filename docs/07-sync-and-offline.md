# 7 — Sync & offline — how a store keeps selling without internet

The short version:

- **Selling never needs the internet.** Every till talks to a server *inside
  the store* over the store's own network cable/Wi-Fi. Scan, pay, print,
  open the drawer, close the register — all of it works with the internet
  cable unplugged, indefinitely.
- **The internet is only used for extras**: reaching the dashboard from
  outside the store, fetching the daily exchange rate, licence checks and
  e-mail receipts. Each of those degrades gracefully (details below).
- **Getting the day's numbers to head office** has multiple routes — from
  one-click submit to an encrypted USB file that travels by WhatsApp. An
  offline day changes *how the numbers travel*, never *whether the store
  can trade*.

---

## 7.0 Which setup fits which store?

Same product, three ways to run it. Pick per store — you can move up later
(moving is a planned data migration, see the install guide).

| Store | Setup | Internet needed to sell? | Cost |
|---|---|---|---|
| 1 till, nothing else | **Cloud-only** — the till connects to the cloud server over the internet | **Yes** — no internet, no sales (a phone hotspot bridges most outages; a sale is a few KB) | Zero hardware |
| 1–2 tills + *any* PC in the shop | **Local server** — the shop's own PC (an ordinary Windows PC is fine) runs the whole system; tills connect over the shop wi-fi/LAN | **No** — the local network keeps working when the internet drops | The PC you already have |
| Multiple tills / multiple stores | **Local server per store + cloud dashboard** — the full setup this chapter describes | **No** for selling; internet only for head-office sync | Back-office PC per store |

Two facts that make the middle option bigger than it looks:

- **The "server" is just a PC.** If the shop has any Windows PC — the owner's
  office machine, an old desktop — the Josbin POS server stack runs on it and
  the store is fully offline-capable. "No server budget" usually means "didn't
  know the old PC counts".
- **The local network is not the internet.** The shop's wi-fi router connects
  the till, the server PC and the printer to each other all by itself. When
  the internet feed dies, that local network — and selling — carries on.

The one setup that truly depends on the internet is cloud-only. It is the
right choice for a small Paramaribo shop with stable internet and no PC; for
everywhere else, put the server in the shop.

## 7.1 Why offline works: what gets installed where

This is decided at installation (see the
[installation guide](00-installation-and-setup.md)) and is the root of the
whole offline story:

```
        THE STORE (everything needed to sell)              OUTSIDE
┌─────────────────────────────────────────────┐
│  Back-office PC — the STORE SERVER          │      ┌──────────────┐
│  (Docker: database, API, queues, WebSocket) │ ← →  │   Internet   │
│                    ▲  ▲  ▲                  │ only │  (optional)  │
│         store LAN  │  │  │                  │ for  └──────────────┘
│   ┌────────┐ ┌────────┐ ┌─────────┐         │ extras
│   │ Till 1 │ │ Till 2 │ │ Manager │         │
│   │Electron│ │Electron│ │ screen  │         │
│   └────────┘ └────────┘ └─────────┘         │
└─────────────────────────────────────────────┘
```

- The **store server** holds the database — products, prices, sales,
  registers, users. It is the system of record.
- Every **till** is pointed at that server's LAN address (convention:
  `192.168.0.250`) — reachable whether or not the building has internet.
- The **dashboard** runs on the same server, so a manager on the store
  network always sees live numbers — again, internet or not.

| Works with the internet unplugged | Needs the internet |
|---|---|
| Selling, all 7 payment recordings, receipts (print/PDF) | E-mail / WhatsApp receipts leaving the building |
| Barcode scanning, discounts, refunds, hold bills | Opening the dashboard from *outside* the store |
| Register open/close, X/Z-reports, cash movements | Fetching the day's USD→SRD rate automatically |
| Product & price edits on the local dashboard | Daily licence check (see grace rules, §7.4) |
| All reports over local data | Catalogue pushes from a remote head office |

## 7.2 A sale's journey (why nothing is ever lost)

1. The cashier scans and takes payment.
2. The sale is **committed to the store server's database first** — totals,
   BTW, payment method, register link. This is the only step that must
   succeed, and it happens entirely inside the building.
3. Receipt prints; drawer opens; the till is ready for the next customer.
4. *Downstream* of that commit, copies travel onwards (to head office,
   webhooks, e-mail) whenever a route is available.

Because step 2 never involves the internet, an internet outage cannot lose
or block a sale. The nightly backup (and weekly full snapshot) of the store
server protects the local database itself.

## 7.3 Getting the day to head office — the routes, step by step

Two deployment shapes matter:

**Shape A — single site (today's standard install).** The dashboard lives
on the store server; the owner opens it in the store (always live) or over
the internet from home (needs the store to be online at that moment).
There is nothing to "sync" — there is one database.

**Shape B — multi-store with a cloud head office.** Each store has its own
server; head office has a cloud dashboard aggregating all of them. Data
must travel. That's what the five-layer ladder is for:

| Layer | What happens | You do | Available |
|---|---|---|---|
| **1 — Real-time push** | Each sale is copied to the cloud within seconds of committing | Nothing | Roadmap — activates with the first multi-store cloud deployment |
| **2 — Auto-retry** | Internet blip → queued copies retry at 1 m → 5 m → 15 m → 30 m; the manager screen shows a yellow *"Sync pending — N transactions queued"* | Nothing | Roadmap (same rollout as Layer 1) |
| **3 — Z-Report submit** | Closing the day offers **Submit to head office** — a deliberate send of the day's totals; the row flips to *Sent ✓* with a timestamp | One tap at day close, or retry from the Z-Reports screen (the morning register screen also offers a retry if yesterday didn't arrive) | **✓ Today** |
| **4 — Encrypted USB / WhatsApp file** | The manager exports an **AES-256 encrypted `.josbin_pos` file** of any date range; it travels on a USB stick, via WhatsApp or e-mail; head office uploads it in the dashboard and it lands exactly as if it had synced | Export → send → HQ imports. Click-by-click: dashboard manual ch. 11 §11.5 | **✓ Today — the offline lifeline** |
| **5 — Catch-up** | When internet returns after days offline, everything queued pushes automatically, oldest day first, marked "synced late" in the audit trail | Nothing | Roadmap (same rollout as Layer 1) |

> **The honest one-liner for customers:** today, a store's numbers reach
> head office at end of day with one tap (Layer 3), or as an encrypted file
> that travels any way a phone can (Layer 4) — both proven end-to-end. The
> per-sale live feed (Layers 1/2/5) is built into the data model and ships
> with the first cloud multi-store rollout. See
> [offline-fallback-verification.md](offline-fallback-verification.md) for
> exactly what was tested.

## 7.4 What an internet outage actually looks like, hour by hour

- **At the tills: nothing.** No banner, no slowdown — cashiers usually
  don't notice.
- **Exchange rate:** the rate locked this morning stays valid all day. If
  the outage spans the 06:00 fetch, the last locked rate remains in force
  until a manager locks a new one manually (Rate screen → override).
  Foreign-cash payments keep working on the locked rate.
- **Licence:** checks run daily and tolerate **72 hours** unreachable
  without any effect; even past that, a valid licence keeps selling — only
  a warning banner appears. (Full grace ladder: dev docs ch. 11.)
- **E-mail receipts:** queued and sent when the connection returns; print
  and PDF receipts are unaffected. WhatsApp receipts need the *customer's*
  phone to have data, not the store.
- **Remote dashboard access:** the owner at home can't reach the store's
  dashboard while the store is offline — the store itself is unaffected.
  (This is Shape A; in Shape B the cloud dashboard shows the store's card
  as *offline* with its last-seen time.)

## 7.5 Stores in the interior — the 4G fallback

For Nickerie / Marowijne / interior installs where wired internet is
unreliable, a **4G USB dongle (Digicel or Telesur)** on the store server is
the recommended second path. It's operating-system-level (the app just sees
"internet reachable again") and the payloads are tiny — a Z-Report is
50–200 KB, so even a weak 4G signal moves a month of trade. The install
checklist question is: *where is the network drop, what's its uptime, and
is there a 4G backup?* The answer decides how often Layer 4's USB file is
the store's routine instead of its exception.

## 7.6 Where to see the sync state

| Who | Where | What you see |
|---|---|---|
| Cashier | — | Nothing to check — selling is always local |
| Store manager | **End of Day → Z-Reports** | Per day: *pending / sent ✓ / failed / not required*, with a re-submit button |
| Store manager | Morning register screen | A one-line notice if yesterday's totals haven't reached head office, with a retry button |
| Head office | Store cards on the overview | Online/offline per store with last-seen time, and **Pending payments** for transfers awaiting confirmation |

## 7.7 FAQ

**Can a sale be lost if the internet dies mid-payment?** No. The sale
commits to the store server before anything else happens; the internet is
never in that path.

**How long can we stay offline?** For selling: indefinitely. For licence
checks: 72 h fully silent, then a warning banner only. For reporting to a
remote head office: Z-Report submit when back online, or the USB file
anytime.

**Do price changes arrive while offline?** Edits made on the store's own
dashboard apply instantly (same server). Pushes from a *remote* head
office arrive when the connection returns.

**Do QR-wallet payments work offline?** The POS side, yes — recording and
attestation are local. The customer's wallet app needs *their* mobile data
to pay, which is independent of the store's internet.

**Is the USB file safe if the stick is lost?** The file is AES-256
encrypted and integrity-signed; without the organisation's key material it
is unreadable. Losing the stick loses nothing but the stick.

**What protects the store server itself?** Nightly database backups with a
14-day window plus weekly full snapshots, kept on the server (and pulled
off-site once the store is online). Restores are drilled, not assumed.

---

→ Related: [Register & Z-Report lifecycle](06-register-and-z-report.md) ·
[dashboard manual ch. 11 — Z-Reports & sync, incl. the USB click-by-click](../dashboard_manual/11-z-reports-and-end-of-day-sync.md) ·
[offline-fallback-verification.md](offline-fallback-verification.md) ·
back to the [overview](README.md)
