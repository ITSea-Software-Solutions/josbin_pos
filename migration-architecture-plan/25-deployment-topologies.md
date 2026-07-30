# 25. Deployment topologies — every shape a shop can be sold

Six ways a shop can run Josbin POS. They differ in one question only: **where does
the shop node live?** Everything else — tills, printers, sync, filing — follows
from that answer.

Chapter 23 sketched three of these. This chapter is the full set, with the
trade-off each one carries and who it should be sold to.

---

## 25.1 The one rule that decides everything

> **Whoever holds the shop node holds the books, and a till can only sell while it
> can reach the node.**

Read every diagram below through that sentence. The topologies where the node sits
in our cloud are the ones where a dropped connection stops the shop selling.

---

## 25.2 T1 — Cloud node, Android till

<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="An Android till in the shop connecting over the internet to a shop node hosted in our cloud, which in turn reaches the control plane and the tax node" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="30" width="180" height="120" rx="10" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="102" y="24" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6b7280">THE SHOP</text>
  <rect x="52" y="52" width="100" height="66" rx="8" fill="#eef2fb" stroke="#293371" stroke-width="1.6"/>
  <text x="102" y="78" text-anchor="middle" font-size="18">📱</text>
  <text x="102" y="98" text-anchor="middle" font-size="10.5" fill="#111827">Android till</text>
  <text x="102" y="112" text-anchor="middle" font-size="9" fill="#6b7280">printer on USB</text>
  <text x="102" y="140" text-anchor="middle" font-size="9.5" fill="#b91c1c">no local data at all</text>

  <line x1="196" y1="90" x2="286" y2="90" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="6 4"/>
  <polygon points="286,90 274,86 274,95" fill="#b91c1c"/>
  <text x="241" y="76" text-anchor="middle" font-size="10" font-weight="700" fill="#b91c1c">internet</text>
  <text x="241" y="110" text-anchor="middle" font-size="9.5" fill="#b91c1c">every single sale</text>

  <rect x="290" y="14" width="396" height="160" rx="10" fill="#f7f9fc" stroke="#293371" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="488" y="9" text-anchor="middle" font-size="10.5" font-weight="700" fill="#293371">OUR CLOUD</text>
  <rect x="306" y="52" width="130" height="66" rx="8" fill="#293371"/>
  <text x="371" y="76" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="371" y="93" text-anchor="middle" font-size="9.5" fill="#c9d2ee">we host it</text>
  <text x="371" y="108" text-anchor="middle" font-size="9.5" fill="#c9d2ee">the books live HERE</text>
  <line x1="440" y1="72" x2="486" y2="60" stroke="#293371" stroke-width="1.6"/>
  <polygon points="486,60 475,58 478,67" fill="#293371"/>
  <rect x="490" y="38" width="182" height="40" rx="7" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="581" y="55" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <text x="581" y="69" text-anchor="middle" font-size="9" fill="#6b7280">rollups · fleet · licences</text>
  <line x1="440" y1="100" x2="486" y2="114" stroke="#1f6b3b" stroke-width="1.6"/>
  <polygon points="486,114 475,108 477,117" fill="#1f6b3b"/>
  <rect x="490" y="98" width="182" height="40" rx="7" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="581" y="115" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="581" y="129" text-anchor="middle" font-size="9" fill="#5b6b62">BTW filings, shop-signed</text>
</svg>

The shop owns a terminal and nothing else. No PC, no Docker, no server to
maintain, no backup to forget.

::: danger This shape cannot sell offline.
The till holds no data. When the connection drops, the shop stops trading. That is
the opposite of the promise the rest of this product is built on, and it is
acceptable **only** where the internet genuinely is reliable — parts of Paramaribo,
and nowhere in the interior. Say so at the point of sale, in writing.
:::

Also worth being clear internally: **if we host the node, we hold that shop's
books and their customer PII.** D6 deliberately keeps personal data out of our
cloud. T1 puts it back in, for that customer. That is a WBP-S processing
relationship with its own agreement, its own retention clock and its own breach
exposure — not merely a hosting choice.

**Sell to:** market stalls and small shops in Paramaribo with fibre, that want zero
IT. **Never sell to:** Nickerie, Marowijne, the interior.

---

## 25.3 T2 — Cloud node, Windows till

<svg viewBox="0 0 700 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One or more Windows tills running the Electron app in the shop, connecting over the internet to a shop node hosted in our cloud" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="200" height="130" rx="10" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.6" stroke-dasharray="4 3"/>
  <text x="112" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#6b7280">THE SHOP</text>
  <rect x="28" y="46" width="80" height="56" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="68" y="70" text-anchor="middle" font-size="16">🖥</text>
  <text x="68" y="90" text-anchor="middle" font-size="9.5" fill="#111827">.exe till</text>
  <rect x="118" y="46" width="80" height="56" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="158" y="70" text-anchor="middle" font-size="16">🖥</text>
  <text x="158" y="90" text-anchor="middle" font-size="9.5" fill="#111827">.exe till</text>
  <text x="112" y="122" text-anchor="middle" font-size="9.5" fill="#6b7280">Electron clients · printers on USB</text>
  <text x="112" y="140" text-anchor="middle" font-size="9.5" fill="#b91c1c">no local data · no Docker</text>

  <line x1="216" y1="80" x2="306" y2="80" stroke="#b91c1c" stroke-width="2.5" stroke-dasharray="6 4"/>
  <polygon points="306,80 294,76 294,85" fill="#b91c1c"/>
  <text x="261" y="68" text-anchor="middle" font-size="10" font-weight="700" fill="#b91c1c">internet</text>
  <text x="261" y="100" text-anchor="middle" font-size="9.5" fill="#b91c1c">every sale</text>

  <rect x="310" y="14" width="376" height="150" rx="10" fill="#f7f9fc" stroke="#293371" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="498" y="9" text-anchor="middle" font-size="10.5" font-weight="700" fill="#293371">OUR CLOUD</text>
  <rect x="326" y="48" width="126" height="62" rx="8" fill="#293371"/>
  <text x="389" y="72" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="389" y="89" text-anchor="middle" font-size="9.5" fill="#c9d2ee">the books live HERE</text>
  <line x1="456" y1="66" x2="500" y2="54" stroke="#293371" stroke-width="1.6"/>
  <polygon points="500,54 489,52 492,61" fill="#293371"/>
  <rect x="504" y="34" width="168" height="36" rx="7" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="588" y="57" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <line x1="456" y1="94" x2="500" y2="108" stroke="#1f6b3b" stroke-width="1.6"/>
  <polygon points="500,108 489,102 491,111" fill="#1f6b3b"/>
  <rect x="504" y="90" width="168" height="36" rx="7" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="588" y="113" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
</svg>

Identical to T1 with a different till. The same warning applies with the same
force: **no internet, no trading.**

The one practical advantage over T1 is that a Windows till can be promoted later —
install Docker on it and it becomes T4 without new hardware. Worth knowing when a
Paramaribo customer's connection turns out to be worse than they claimed.

---

## 25.4 T3 — On-prem node on a back-office PC, Android tills

<svg viewBox="0 0 700 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Android tills on the shop LAN talking to a Windows PC running Docker, which reaches our cloud and the tax node only when internet is available" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="330" height="160" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="177" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">THE SHOP — everything needed to sell is inside this box</text>
  <rect x="28" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="66" y="64" text-anchor="middle" font-size="15">📱</text>
  <text x="66" y="83" text-anchor="middle" font-size="9" fill="#111827">till</text>
  <rect x="114" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="152" y="64" text-anchor="middle" font-size="15">📱</text>
  <text x="152" y="83" text-anchor="middle" font-size="9" fill="#111827">till</text>
  <rect x="200" y="42" width="76" height="52" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="238" y="64" text-anchor="middle" font-size="15">🖥</text>
  <text x="238" y="83" text-anchor="middle" font-size="9" fill="#111827">till</text>
  <line x1="66" y1="96" x2="150" y2="122" stroke="#293371" stroke-width="1.6"/>
  <line x1="152" y1="96" x2="168" y2="122" stroke="#293371" stroke-width="1.6"/>
  <line x1="238" y1="96" x2="188" y2="122" stroke="#293371" stroke-width="1.6"/>
  <text x="290" y="112" text-anchor="middle" font-size="9.5" fill="#6b7280">shop LAN — no internet</text>
  <rect x="96" y="124" width="150" height="52" rx="8" fill="#293371"/>
  <text x="171" y="145" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff">🗄 Windows PC + Docker</text>
  <text x="171" y="162" text-anchor="middle" font-size="9.5" fill="#c9d2ee">shop node · the books</text>

  <line x1="250" y1="150" x2="360" y2="150" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="360,150 349,146 349,155" fill="#9aa3b8"/>
  <text x="305" y="140" text-anchor="middle" font-size="9.5" font-weight="600" fill="#6b7280">when there is internet</text>
  <text x="305" y="172" text-anchor="middle" font-size="9" fill="#1d7a46">queues when there is not</text>

  <rect x="364" y="34" width="322" height="60" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="525" y="55" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <text x="525" y="72" text-anchor="middle" font-size="9" fill="#6b7280">rollups · Z-reports · fleet health · licence renewal</text>
  <text x="525" y="86" text-anchor="middle" font-size="9" fill="#6b7280">no customer PII ever</text>
  <rect x="364" y="120" width="322" height="60" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="525" y="141" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="525" y="158" text-anchor="middle" font-size="9" fill="#5b6b62">BTW filings, signed by the shop</text>
  <text x="525" y="172" text-anchor="middle" font-size="9" fill="#5b6b62">totals per rate — never line detail</text>
  <line x1="300" y1="160" x2="360" y2="150" stroke="#1f6b3b" stroke-width="0"/>
</svg>

**The default, and the one the product was designed for.** Sells all day with the
internet down. Any Windows machine will do — it does not have to be a server, and
it does not have to be new.

**Sell to:** almost everyone. Shops, bakeries, pharmacies, anywhere with 2–5 tills.

---

## 25.5 T4 — One Windows machine that is both node and till

<svg viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A single Windows PC running both Docker with the shop node and the Electron till, reaching our cloud and the tax node when internet is available" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="300" height="132" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="162" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">THE SHOP — one machine</text>
  <rect x="34" y="42" width="256" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="162" y="62" text-anchor="middle" font-size="14">🖥</text>
  <text x="162" y="80" text-anchor="middle" font-size="9.5" fill="#111827">Josbin POS.exe — the till</text>
  <line x1="162" y1="90" x2="162" y2="100" stroke="#293371" stroke-width="1.6"/>
  <text x="220" y="99" text-anchor="middle" font-size="8.5" fill="#6b7280">localhost</text>
  <rect x="34" y="102" width="256" height="46" rx="7" fill="#293371"/>
  <text x="162" y="122" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff">🗄 Docker — the shop node</text>
  <text x="162" y="138" text-anchor="middle" font-size="9" fill="#c9d2ee">same machine, same books</text>

  <line x1="318" y1="92" x2="392" y2="92" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="392,92 381,88 381,97" fill="#9aa3b8"/>
  <text x="355" y="82" text-anchor="middle" font-size="9" fill="#6b7280">when online</text>

  <rect x="396" y="28" width="290" height="50" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="541" y="48" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <text x="541" y="64" text-anchor="middle" font-size="9" fill="#6b7280">rollups · fleet · licence</text>
  <rect x="396" y="106" width="290" height="50" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="541" y="126" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="541" y="142" text-anchor="middle" font-size="9" fill="#5b6b62">BTW filings, shop-signed</text>
</svg>

T3 collapsed onto one box. The `.exe` talks to `localhost` instead of a LAN
address; nothing else differs. Fully offline-capable.

**The one thing to warn the shop about:** this machine is now the till *and* the
books. If a cashier switches it off at closing, sync and the nightly archive do not
run. The auto-start setting and the archive schedule matter more here than
anywhere else.

**Sell to:** single-till shops that already have a Windows PC and want offline
trading — the honest alternative to T1 and T2.

---

## 25.6 T5 — Several Windows machines, one of them designated as the node

<svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Several Windows tills on a shop LAN, one of which is designated to run Docker and the shop node, reaching our cloud when online" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="330" height="152" rx="10" fill="#ffffff" stroke="#1f6b3b" stroke-width="2"/>
  <text x="177" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1d7a46">THE SHOP</text>
  <rect x="28" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="64" y="60" text-anchor="middle" font-size="14">🖥</text>
  <text x="64" y="78" text-anchor="middle" font-size="8.5" fill="#111827">till</text>
  <rect x="110" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="146" y="60" text-anchor="middle" font-size="14">🖥</text>
  <text x="146" y="78" text-anchor="middle" font-size="8.5" fill="#111827">till</text>
  <rect x="192" y="40" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.5"/>
  <text x="228" y="60" text-anchor="middle" font-size="14">📱</text>
  <text x="228" y="78" text-anchor="middle" font-size="8.5" fill="#111827">till</text>
  <line x1="64" y1="88" x2="140" y2="114" stroke="#293371" stroke-width="1.5"/>
  <line x1="146" y1="88" x2="160" y2="114" stroke="#293371" stroke-width="1.5"/>
  <line x1="228" y1="88" x2="180" y2="114" stroke="#293371" stroke-width="1.5"/>
  <text x="292" y="104" text-anchor="middle" font-size="9" fill="#6b7280">shop LAN</text>
  <rect x="76" y="116" width="180" height="52" rx="8" fill="#293371"/>
  <text x="166" y="136" text-anchor="middle" font-size="10.5" font-weight="700" fill="#ffffff">🗄 ONE designated PC</text>
  <text x="166" y="152" text-anchor="middle" font-size="9" fill="#c9d2ee">Docker · shop node · the books</text>
  <text x="166" y="164" text-anchor="middle" font-size="8.5" fill="#EF6C00">it may also be a till</text>

  <line x1="260" y1="142" x2="350" y2="142" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="350,142 339,138 339,147" fill="#9aa3b8"/>
  <text x="305" y="133" text-anchor="middle" font-size="9" fill="#6b7280">when online</text>

  <rect x="356" y="30" width="330" height="52" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="521" y="51" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <text x="521" y="68" text-anchor="middle" font-size="9" fill="#6b7280">rollups · consolidated view across the org's stores</text>
  <rect x="356" y="112" width="330" height="52" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="521" y="133" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="521" y="150" text-anchor="middle" font-size="9" fill="#5b6b62">one filing per organisation</text>
</svg>

Any machine *can* host it. Exactly **one** must, and it has to be a decision
written down, not a habit.

::: warning Never run two nodes in one shop, and never fail over automatically.
Two nodes writing sales for the same store means duplicate sale numbers, two
Z-reports for one day, and two BTW returns that do not reconcile. Recovery means
merging books by hand.

If the designated PC dies, the answer is a **documented promotion**: restore the
latest archive onto another machine, re-point the tills, re-activate the licence
on the new fingerprint. Minutes, and deterministic. Automatic failover would turn
a dead PC into corrupted books.
:::

**Sell to:** shops that already have several PCs and no appetite for buying a
server. Same software as T3.

---

## 25.7 T6 — Standalone, no Docker, its own database (future)

<svg viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A single Android terminal or Windows PC running everything locally with its own embedded database, syncing to our cloud and the tax node when online" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <rect x="12" y="26" width="300" height="130" rx="10" fill="#ffffff" stroke="#EF6C00" stroke-width="2.2"/>
  <text x="162" y="20" text-anchor="middle" font-size="10.5" font-weight="700" fill="#b35400">ONE DEVICE — nothing else at all</text>
  <rect x="34" y="42" width="120" height="98" rx="8" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="94" y="68" text-anchor="middle" font-size="20">📱</text>
  <text x="94" y="90" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111827">Android</text>
  <text x="94" y="106" text-anchor="middle" font-size="8.5" fill="#6b7280">native Kotlin node</text>
  <text x="94" y="120" text-anchor="middle" font-size="8.5" fill="#6b7280">Room / SQLite</text>
  <text x="94" y="134" text-anchor="middle" font-size="8.5" fill="#b35400">key in the Keystore</text>
  <rect x="168" y="42" width="122" height="98" rx="8" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="229" y="68" text-anchor="middle" font-size="20">🖥</text>
  <text x="229" y="90" text-anchor="middle" font-size="9.5" font-weight="700" fill="#111827">Windows</text>
  <text x="229" y="106" text-anchor="middle" font-size="8.5" fill="#6b7280">Electron + embedded DB</text>
  <text x="229" y="120" text-anchor="middle" font-size="8.5" fill="#6b7280">no Docker to install</text>
  <text x="229" y="134" text-anchor="middle" font-size="8.5" fill="#b35400">one .exe, one install</text>

  <line x1="318" y1="90" x2="392" y2="90" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="5 4"/>
  <polygon points="392,90 381,86 381,95" fill="#9aa3b8"/>
  <text x="355" y="80" text-anchor="middle" font-size="9" fill="#6b7280">when online</text>

  <rect x="396" y="28" width="290" height="50" rx="8" fill="#ffffff" stroke="#293371" stroke-width="1.5"/>
  <text x="541" y="48" text-anchor="middle" font-size="10.5" font-weight="700" fill="#111827">☁️ Control plane</text>
  <text x="541" y="64" text-anchor="middle" font-size="9" fill="#6b7280">rollups · licence · encrypted archive</text>
  <rect x="396" y="104" width="290" height="50" rx="8" fill="#ffffff" stroke="#1f6b3b" stroke-width="1.5"/>
  <text x="541" y="124" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="541" y="140" text-anchor="middle" font-size="9" fill="#5b6b62">BTW filings, shop-signed</text>
</svg>

**Documented now, built later.** No Docker, no server, no LAN — install one app and
sell. The lowest-friction install in the product and the highest-effort to build,
because the shop node's server logic has to be reimplemented on the device: Kotlin
for Android, and for Windows an embedded database inside the Electron app.

Both are **single-till and licence-enforced** — two standalone devices in one shop
would be two sets of books. See [§23.10](/migration-architecture-plan/23-installs-and-artifacts).

Detail for the Android side is in
[chapter 23](/migration-architecture-plan/23-installs-and-artifacts). The Windows
variant follows the same rules and the same BTW conformance vectors.

---

## 25.8 Side by side

| | Node lives | Sells offline | Books held by | Tills | Docker | Sell to |
|---|---|---|---|---|---|---|
| **T1** | Our cloud | ❌ **No** | **Us** | 1+ Android | no | Paramaribo, reliable fibre, zero IT |
| **T2** | Our cloud | ❌ **No** | **Us** | 1+ Windows | no | Same, upgradeable to T4 later |
| **T3** | Shop's PC | ✅ Yes | The shop | Android + Windows | yes | **The default** |
| **T4** | The till itself | ✅ Yes | The shop | 1 Windows | yes | Single-till, has a PC |
| **T5** | One designated PC | ✅ Yes | The shop | Several Windows | yes | Has PCs, no server |
| **T6** | The device | ✅ Yes | The shop | 1 | **no** | Future — lowest friction |

Four of the six sell with no internet. The two that do not are the two where we
hold the node — which is the same sentence as §25.1, read from the other end.

---

## 25.9 Relaying through our cloud is fine. Re-signing is not.

You noted that in every topology the shop may reach us and we then reach the tax
node. That works, with one boundary that must not be crossed.

- ✅ **Relay is fine.** Our infrastructure may carry, queue and forward a filing —
  useful when a shop's connection is too poor to reach the tax node directly, or
  when the tax node is down and something has to hold the submission.
- ❌ **Re-signing is not.** We never open a filing, recompute it, or sign it as
  ourselves. D4 keeps us out of the chain of custody, and chapter 22 is what makes
  that survive a relay: the signature is over the **payload**, so it stays valid
  through any number of hops and proves the filing is the shop's, unaltered, no
  matter whose wire carried it.

That is the whole reason chapter 22 signs payloads rather than connections. A
relay we cannot tamper with is an operational convenience; a relay we *could*
tamper with would be a compliance problem.

---

## 25.10 Moving between shapes

Customers change. Connections turn out worse than promised, shops grow, tills get
added. These are the transitions worth supporting properly:

| From → to | Why it happens | What it takes |
|---|---|---|
| **T1/T2 → T3/T4** | Internet turned out unreliable | Export from the cloud node, install locally, import, re-point tills. **The one we will need most.** |
| **T4 → T3** | Second till arrives | Move Docker to a back-office PC, or leave it and add tills; both work |
| **T4 → T5** | More PCs, still no server | Designate the host, re-point the others |
| **T3 → T5** | Back-office PC replaced | Documented promotion — §25.6 |
| **T6 → T3** | Standalone shop grows | Export the archive, install, import, re-point the device as a till (§23.10) |
| **T3 → T1/T2** | Shop wants out of IT entirely | Upload the archive, we restore into a hosted node |

Every one of them is the same three moves — **export, import, re-point** — which is
why the encrypted archive and the import path are load-bearing infrastructure and
not a backup feature. Build them once, well.

---

## 25.11 What this adds to the build list

| # | To build | Where |
|---|---|---|
| N49 | Hosted shop-node tenancy for T1/T2 — provisioning, isolation, its own DPA | ☁️ Control |
| N50 | Offline-incapable warning surfaced in-product for T1/T2, not just in the contract | 🏪 + ☁️ |
| N51 | Designated-node enforcement: refuse a second node per store, detect two | ☁️ Control |
| N52 | Documented node promotion: restore archive → re-point tills → re-activate licence | 🏪 + ☁️ |
| N53 | Topology recorded on the node and reported in fleet health | 🏪 → ☁️ |
| N54 | Migration tooling: export → import → re-point, exercised for every row in §25.10 | All |
| N55 | Standalone Windows — Electron with an embedded database, no Docker | 🖥 Standalone |

N51 and N52 matter earlier than they look. The first shop that puts Docker on two
machines "for redundancy" will not tell us, and will discover the problem at the
end of a trading day.
