# 16. The four ways to run Josbin POS

Josbin POS always has two halves: the **till** (what the cashier touches) and
the **server** (where the products, sales and reports live). Each half has
two options, and every combination works:

|  | **Server in the shop** (local) | **Server in the cloud** (remote) |
|---|---|---|
| **Windows till** | A — The classic store | B — Windows till, no server PC |
| **Android till** | C — The modern counter | D — The lightest start |

The one question that separates the columns: **when the internet is down,
can I still sell?** Local server: **yes**. Cloud server: **no** (a phone
hotspot bridges short outages).

You choose per store — and you can mix tills freely (§16.6).

## 16.1 Setup A — Windows till + server in the shop *(the classic store)*

The shape most supermarkets choose. Everything lives inside the store;
the internet is only used to send results to head office.

**The server does not have to be a second machine.** A Windows till is a full
PC, so it can run the server software itself alongside the till app — one
box that is the till, the server, and the thing the scanner, printer and cash
drawer plug into. For a one- or two-till shop that is the cheapest complete
setup there is: no extra hardware, nothing on the network to go wrong, and
still fully able to sell with the internet down.

<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Windows till and server PC in the shop, printer and drawer on the local network, internet optional" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="250" y="10" width="140" height="40" rx="8" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="320" y="35" text-anchor="middle" font-size="14" fill="#6b7280">☁️ Internet</text>
  <text x="400" y="35" font-size="11" fill="#EF6C00">optional — sync only</text>
  <line x1="320" y1="50" x2="320" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="3 5"/>
  <rect x="245" y="90" width="150" height="46" rx="8" fill="#293371"/>
  <text x="320" y="118" text-anchor="middle" font-size="14" fill="#ffffff">📡 Shop wi-fi router</text>
  <line x1="120" y1="180" x2="290" y2="136" stroke="#293371" stroke-width="2.5"/>
  <line x1="320" y1="136" x2="320" y2="180" stroke="#293371" stroke-width="2.5"/>
  <line x1="520" y1="180" x2="350" y2="136" stroke="#293371" stroke-width="2.5"/>
  <rect x="30" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="207" text-anchor="middle" font-size="14" fill="#111827">🖥 Windows till</text>
  <text x="120" y="228" text-anchor="middle" font-size="12" fill="#6b7280">scanner plugs in here</text>
  <rect x="240" y="180" width="160" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="320" y="207" text-anchor="middle" font-size="14" fill="#111827">🗄 Server PC</text>
  <text x="320" y="228" text-anchor="middle" font-size="12" fill="#6b7280">any Windows PC</text>
  <rect x="430" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="520" y="203" text-anchor="middle" font-size="14" fill="#111827">🖨 Receipt printer</text>
  <text x="520" y="222" text-anchor="middle" font-size="12" fill="#6b7280">network or USB-to-till</text>
  <line x1="520" y1="252" x2="520" y2="272" stroke="#111827" stroke-width="2"/>
  <text x="527" y="270" font-size="11" fill="#6b7280">RJ11</text>
  <rect x="455" y="272" width="130" height="24" rx="6" fill="#f3f4f6" stroke="#9aa3b8" stroke-width="1.5"/>
  <text x="520" y="289" text-anchor="middle" font-size="12" fill="#111827">💵 Cash drawer</text>
  <rect x="30" y="268" width="240" height="28" rx="6" fill="#e9f7ef"/>
  <text x="150" y="287" text-anchor="middle" font-size="13" fill="#1d7a46">✅ Internet down → selling continues</text>
</svg>

**Two ways to build it**

| | **A1 — all in one** | **A2 — separate server PC** |
|---|---|---|
| Machines | 1 (the till runs everything) | 2 (till + any PC, an old office one is fine) |
| Extra cost | none | ± USD 150–200 if none is spare |
| Suits | 1–2 tills | 3+ tills, or a busy store |
| If that machine dies | the shop stops until it is back | the other tills keep selling |
| Tills sharing the data | all tills point at the till-server's address | all tills point at the server PC |

A2 is the safer shape once a store has several tills, for one reason worth
stating plainly: in A1 the till and the server are the same machine, so
whatever takes one down takes both. That is an acceptable trade for a small
shop and a poor one for a supermarket with four lanes.

- **Needs:** a Windows till. A second PC only if you choose A2.
- **Printer:** USB straight into the till *or* network — both work on Windows.
- **Best for:** any store where "we can't sell" is not acceptable.

## 16.2 Setup B — Windows till + cloud server

No server PC in the shop — the till talks to the cloud over the internet.

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Windows till connecting over the internet to a cloud server" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="420" y="20" width="190" height="60" rx="10" fill="#293371"/>
  <text x="515" y="46" text-anchor="middle" font-size="14" fill="#ffffff">☁️ Cloud server</text>
  <text x="515" y="66" text-anchor="middle" font-size="12" fill="#c7d2fe">products · sales · reports</text>
  <rect x="250" y="120" width="150" height="46" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="325" y="148" text-anchor="middle" font-size="14" fill="#111827">📡 Router</text>
  <line x1="400" y1="130" x2="450" y2="80" stroke="#EF6C00" stroke-width="3"/>
  <text x="440" y="112" font-size="12" fill="#EF6C00">internet — required</text>
  <rect x="30" y="120" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="147" text-anchor="middle" font-size="14" fill="#111827">🖥 Windows till</text>
  <text x="120" y="168" text-anchor="middle" font-size="12" fill="#6b7280">scanner + printer + drawer</text>
  <line x1="210" y1="143" x2="250" y2="143" stroke="#293371" stroke-width="2.5"/>
  <rect x="30" y="212" width="330" height="28" rx="6" fill="#fdecec"/>
  <text x="195" y="231" text-anchor="middle" font-size="13" fill="#b3261e">⛔ Internet down → no selling (hotspot bridges short outages)</text>
</svg>

- **Needs:** only the till and reliable internet. Printer/drawer/scanner
  still work normally — they belong to the till, not the server.
- **Best for:** small city shops with stable internet and no PC to spare.

## 16.3 Setup C — Android till + server in the shop *(the modern counter)*

The Posiflex-style setup: an Android terminal at the counter, a PC in the
back office running the system, everything on the shop's own network.

<svg viewBox="0 0 640 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android terminal on wi-fi with a server PC and a network printer with cash drawer, internet optional" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="250" y="10" width="140" height="40" rx="8" fill="none" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="6 5"/>
  <text x="320" y="35" text-anchor="middle" font-size="14" fill="#6b7280">☁️ Internet</text>
  <text x="400" y="35" font-size="11" fill="#EF6C00">optional — sync only</text>
  <line x1="320" y1="50" x2="320" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="3 5"/>
  <rect x="245" y="90" width="150" height="46" rx="8" fill="#293371"/>
  <text x="320" y="118" text-anchor="middle" font-size="14" fill="#ffffff">📡 Shop wi-fi router</text>
  <line x1="120" y1="180" x2="290" y2="136" stroke="#293371" stroke-width="2.5" stroke-dasharray="7 5"/>
  <text x="160" y="152" font-size="11" fill="#293371">wi-fi</text>
  <line x1="320" y1="136" x2="320" y2="180" stroke="#293371" stroke-width="2.5"/>
  <line x1="520" y1="180" x2="350" y2="136" stroke="#293371" stroke-width="2.5"/>
  <text x="455" y="152" font-size="11" fill="#293371">cable</text>
  <rect x="30" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="207" text-anchor="middle" font-size="14" fill="#111827">📱 Android till</text>
  <text x="120" y="228" text-anchor="middle" font-size="12" fill="#6b7280">scanner + printer plug in</text>
  <rect x="240" y="180" width="160" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="320" y="207" text-anchor="middle" font-size="14" fill="#111827">🗄 Server PC</text>
  <text x="320" y="228" text-anchor="middle" font-size="12" fill="#6b7280">any Windows PC</text>
  <rect x="430" y="180" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="520" y="203" text-anchor="middle" font-size="14" fill="#111827">🖨 Receipt printer</text>
  <text x="520" y="222" text-anchor="middle" font-size="12" fill="#6b7280">USB to the till, or network</text>
  <line x1="520" y1="252" x2="520" y2="272" stroke="#111827" stroke-width="2"/>
  <text x="527" y="270" font-size="11" fill="#6b7280">RJ11</text>
  <rect x="455" y="272" width="130" height="24" rx="6" fill="#f3f4f6" stroke="#9aa3b8" stroke-width="1.5"/>
  <text x="520" y="289" text-anchor="middle" font-size="12" fill="#111827">💵 Cash drawer</text>
  <rect x="30" y="268" width="240" height="28" rx="6" fill="#e9f7ef"/>
  <text x="150" y="287" text-anchor="middle" font-size="13" fill="#1d7a46">✅ Internet down → selling continues</text>
</svg>

- **Needs:** Android terminal(s) + any PC as server + a receipt printer,
  **USB straight into the terminal or on the network** — both work.
- **Printer choice:** USB is simpler and needs no network card. Put the
  printer on the network only when **several tills share one printer** — a
  USB printer belongs to the one terminal it is plugged into. See
  [chapter 15](/docs/15-android-terminals).
- **Best for:** counters with modern Android hardware that still need
  offline resilience.

## 16.4 Setup D — Android till + cloud server *(the lightest start)*

Zero computers in the shop. One Android terminal, straight to the cloud.

<svg viewBox="0 0 640 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android terminal connecting over the internet to a cloud server" style="max-width:640px;width:100%;height:auto;font-family:sans-serif">
  <rect x="420" y="20" width="190" height="60" rx="10" fill="#293371"/>
  <text x="515" y="46" text-anchor="middle" font-size="14" fill="#ffffff">☁️ Cloud server</text>
  <text x="515" y="66" text-anchor="middle" font-size="12" fill="#c7d2fe">products · sales · reports</text>
  <rect x="250" y="120" width="150" height="46" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="325" y="148" text-anchor="middle" font-size="14" fill="#111827">📡 Router</text>
  <line x1="400" y1="130" x2="450" y2="80" stroke="#EF6C00" stroke-width="3"/>
  <text x="440" y="112" font-size="12" fill="#EF6C00">internet — required</text>
  <rect x="30" y="120" width="180" height="72" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="147" text-anchor="middle" font-size="14" fill="#111827">📱 Android till</text>
  <text x="120" y="168" text-anchor="middle" font-size="12" fill="#6b7280">scanner + printer + drawer</text>
  <line x1="210" y1="143" x2="250" y2="143" stroke="#293371" stroke-width="2.5" stroke-dasharray="7 5"/>
  <rect x="30" y="212" width="330" height="28" rx="6" fill="#fdecec"/>
  <text x="195" y="231" text-anchor="middle" font-size="13" fill="#b3261e">⛔ Internet down → no selling (hotspot bridges short outages)</text>
</svg>

- **Needs:** the terminal, wi-fi, reliable internet, and a receipt printer
  plugged into the terminal by USB (or on the wi-fi, if tills share one).
  The cash drawer cables into the printer as always.
- **Best for:** the smallest shops taking their very first step — upgrade
  to setup C later by adding any PC, without touching the hardware on the
  counter.

## 16.5 Choosing in three questions

| Question | If **yes** | If **no** |
|---|---|---|
| 1. Must you be able to sell when the internet is down? | Server in the shop (A or C) | Cloud is fine (B or D) |
| 2. Is there any Windows PC in the shop (even an old one)? | It can be the server — A2 or C costs no new hardware | A Windows till can be its own server (A1); otherwise cloud (B/D), or ± USD 150–200 for a mini-PC |
| 3. Which tills do you have? | Windows machines → A/B · Android terminals → C/D | Buying new? Both platforms are fully supported — decide on hardware preference, not software |

**Rules that hold in every setup:**

- The **scanner** always plugs into the till and just works.
- The **cash drawer** always cables into the **printer** — never into a
  computer (see [chapter 15 §15.1](/docs/15-android-terminals) for why).
- The **printer** can be **USB into the till or on the network, on both
  Windows and Android**. USB direct on Android has been supported since
  version 1.4. Choose network only when several tills must share one printer.
- The **dashboard** needs no extra machine anywhere — any browser on the
  network (or on the internet, for cloud setups) opens it.

## 16.6 Mixing — one store, both till types

The four setups are per-*store* choices, not contracts. A store can run a
**Windows till and an Android till side by side on the same server** — they
share products, stock, registers and reports, because the server is the
single source of truth and every till is just a screen onto it. A chain can
likewise run setup A in the flagship store and setup D in a kiosk.

**One planning note:** *moving* an existing store between columns — local
server ↔ cloud — is a data migration (the sales history must move with it).
It's routine, but it's scheduled work with your vendor, not a setting on
the till. Pick the column per store with a year's horizon, not a week's.

**Where to go deeper:** offline behaviour hour-by-hour in
[chapter 7](/docs/07-sync-and-offline) · everything Android in
[chapter 15](/docs/15-android-terminals) · install steps in the
[install guide](/docs/00-installation-and-setup).
