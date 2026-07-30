# 23. One repo, many artifacts — what actually gets installed

Chapter 20 settled that the three nodes live in **one repository**. This chapter
answers the question that follows immediately: if it is one repo, what does a
customer actually receive?

Not the repo. Never the repo.

---

## 23.1 Three shapes a shop can take

<svg viewBox="0 0 700 330" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three shop setups: a single Android terminal running standalone, a small shop with a Windows PC running the node and two tills as clients, and a supermarket with a dedicated server and many tills" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- A: kiosk -->
  <rect x="14" y="34" width="205" height="250" rx="11" fill="#ffffff" stroke="#EF6C00" stroke-width="2.5"/>
  <text x="116" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">A · One till, no PC</text>
  <rect x="66" y="52" width="102" height="128" rx="9" fill="#fff6ee" stroke="#EF6C00" stroke-width="1.6"/>
  <text x="117" y="76" text-anchor="middle" font-size="24">📱</text>
  <text x="117" y="100" text-anchor="middle" font-size="11.5" font-weight="700" fill="#111827">Android terminal</text>
  <text x="117" y="120" text-anchor="middle" font-size="10.5" fill="#b35400">IS the shop node</text>
  <text x="117" y="137" text-anchor="middle" font-size="10.5" fill="#6b7280">own database</text>
  <text x="117" y="154" text-anchor="middle" font-size="10.5" fill="#6b7280">on the device</text>
  <text x="117" y="171" text-anchor="middle" font-size="10.5" fill="#6b7280">printer over USB</text>
  <text x="116" y="204" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ sells with nothing else</text>
  <text x="116" y="221" text-anchor="middle" font-size="10.5" fill="#6b7280">market stall · kiosk</text>
  <text x="116" y="238" text-anchor="middle" font-size="10.5" fill="#6b7280">one-person shop</text>
  <rect x="30" y="250" width="173" height="24" rx="6" fill="#fdecdc"/>
  <text x="116" y="266" text-anchor="middle" font-size="10" fill="#b35400">single till only — see §23.10</text>

  <!-- B: small shop -->
  <rect x="240" y="34" width="205" height="250" rx="11" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="342" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">B · A PC in the back</text>
  <rect x="262" y="52" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.4"/>
  <text x="298" y="72" text-anchor="middle" font-size="16">📱</text>
  <text x="298" y="90" text-anchor="middle" font-size="9.5" fill="#111827">till</text>
  <rect x="350" y="52" width="72" height="46" rx="7" fill="#eef2fb" stroke="#293371" stroke-width="1.4"/>
  <text x="386" y="72" text-anchor="middle" font-size="16">🖥</text>
  <text x="386" y="90" text-anchor="middle" font-size="9.5" fill="#111827">till</text>
  <line x1="298" y1="100" x2="330" y2="140" stroke="#293371" stroke-width="1.6"/>
  <line x1="386" y1="100" x2="354" y2="140" stroke="#293371" stroke-width="1.6"/>
  <text x="342" y="119" text-anchor="middle" font-size="9.5" fill="#6b7280">shop LAN</text>
  <rect x="270" y="142" width="145" height="66" rx="9" fill="#293371"/>
  <text x="342" y="164" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">🗄 Any Windows PC</text>
  <text x="342" y="182" text-anchor="middle" font-size="10.5" fill="#c9d2ee">Docker · shop node</text>
  <text x="342" y="199" text-anchor="middle" font-size="10.5" fill="#c9d2ee">the books live here</text>
  <text x="342" y="228" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ tills are thin clients</text>
  <text x="342" y="248" text-anchor="middle" font-size="10.5" fill="#6b7280">2–5 tills · today's model</text>
  <text x="342" y="265" text-anchor="middle" font-size="10.5" fill="#6b7280">shop · bakery · pharmacy</text>

  <!-- C: supermarket -->
  <rect x="466" y="34" width="220" height="250" rx="11" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="576" y="24" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">C · Dedicated server</text>
  <rect x="482" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="511" y="78" text-anchor="middle" font-size="15">🖥</text>
  <rect x="548" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="577" y="78" text-anchor="middle" font-size="15">🖥</text>
  <rect x="614" y="52" width="58" height="40" rx="6" fill="#eef7f1" stroke="#1f6b3b" stroke-width="1.3"/>
  <text x="643" y="78" text-anchor="middle" font-size="15">🖥</text>
  <text x="576" y="108" text-anchor="middle" font-size="9.5" fill="#6b7280">6–20 tills + manager screens</text>
  <line x1="576" y1="114" x2="576" y2="142" stroke="#1f6b3b" stroke-width="1.6"/>
  <rect x="496" y="144" width="160" height="64" rx="9" fill="#1f6b3b"/>
  <text x="576" y="166" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">🗄 Server box</text>
  <text x="576" y="184" text-anchor="middle" font-size="10.5" fill="#cfe0d5">same shop node image</text>
  <text x="576" y="201" text-anchor="middle" font-size="10.5" fill="#cfe0d5">UPS · nightly archive</text>
  <text x="576" y="230" text-anchor="middle" font-size="10.5" fill="#1d7a46">✅ same software as B</text>
  <text x="576" y="250" text-anchor="middle" font-size="10.5" fill="#6b7280">bigger box, more tills</text>
  <text x="576" y="267" text-anchor="middle" font-size="10.5" fill="#6b7280">supermarket · government</text>

  <text x="350" y="308" text-anchor="middle" font-size="11" fill="#6b7280">B and C are the same install on different hardware. A is a different thing — the node runs ON the till.</text>
  <text x="350" y="324" text-anchor="middle" font-size="10.5" font-weight="600" fill="#111827">All three sell with no internet. All three sync and file when they have it.</text>
</svg>

| | Who it is for | Shop node runs on | Tills |
|---|---|---|---|
| **A · Standalone** | Market stall, kiosk, one-person shop | **The Android terminal itself** | 1, and it is the same device |
| **B · Small shop** | 2–5 tills, no IT staff | Any Windows PC with Docker | Android and/or Electron, thin clients |
| **C · Supermarket** | 6+ tills, government | A dedicated box, UPS-backed | Same clients as B |

B and C are the same software on different hardware, and they are what exists
today. **A does not exist yet** and is the largest single item in this plan.

---

## 23.2 What a customer receives — an image, not a repository

Today `deploy-server.sh` ships backend code by running `git fetch && git reset
--hard` on the server, and the container bind-mounts the source. That is
acceptable for our own droplet. It must never be how a shop is installed: it
would put the whole repository — control plane, licence server and all — on a
machine behind someone else's counter, which is the exact thing
[§20.1](/migration-architecture-plan/20-split-build-plan) says we are avoiding.

**The repository is a development artifact. The image is the product.**

```
one repository
      │
      ├── CI builds three images, each from its own build context
      │      shop    = domain/ + nodes/Shop      IonCube-encoded, signed
      │      control = domain/ + nodes/Control
      │      tax     = domain/ + nodes/Tax
      │
      ├── signed, pushed to a private registry, referenced by DIGEST
      │
      └── the shop receives:  docker-compose.yml  +  .env  +  image@sha256:…
                              docker compose pull && docker compose up -d

          no git · no source · no composer · no build tools
```

The shop image cannot contain `nodes/Control` because those files were never in
its build context. That is checkable rather than promised, and chapter 20's step-6
gate is exactly this check: grep the built artifact for any Control path and fail
the build if it is there.

**For a shop with no usable internet**, no registry is needed at the shop at all:

```
docker save josbin/shop@sha256:… -o josbin-shop-1.9.0.tar     ← at our end
… USB stick, alongside the installer …
docker load -i josbin-shop-1.9.0.tar                          ← at the shop
```

Same signed artifact, offline. It is the same shape as sync Layer 4, which the
product already relies on.

---

## 23.3 How the team clones and runs it

Developers clone the one repo and get everything, which is the point.

```
git clone …/josbin_pos && cd josbin_pos
cp .env.example .env
docker compose up -d              # all three nodes in one deployment
```

Through steps 1–3 of the build plan there is nothing to choose: the app boots as
one deployment exactly as it does today. From step 3 onward a node profile
selects which routes register, which migrations run and which modules load:

```
JOSBIN_NODE=all       # default — the development shape, everything in one
JOSBIN_NODE=shop      # what a shop runs
JOSBIN_NODE=control   # what we run
JOSBIN_NODE=tax       # what the Belastingdienst instance runs
```

`all` stays the default forever, because a developer who has to run three stacks
to reproduce a bug will stop reproducing bugs.

---

## 23.4 On Windows, the node and the till are two different installs

This confuses people, so state it plainly. In setup B, one PC often runs both,
but they are unrelated artifacts:

| Artifact | What it is | Contains |
|---|---|---|
| **Docker stack** | The shop node — the server, the database, the books | Encoded PHP, Postgres, Redis |
| **`Josbin POS.exe`** | A till. A client, nothing more | React UI, points at a server URL |

The `.exe` never contains the node. Uninstalling it loses nothing; the books are
in Docker. Reinstalling it on another PC and pointing it at the same LAN address
is a five-minute job — which is exactly the property you want when a till dies
mid-Saturday.

---

## 23.5 On Android, one APK with two modes

Today's app is Capacitor: the React UI running in a WebView, talking HTTP to a
shop node. It already reads its server address at runtime (`serverConfig.ts`,
`ServerConfigModal`, LAN discovery), so re-pointing a till is a settings change,
not a rebuild. **That client stays exactly as it is** — it is what setups B and C
run, and it works.

Standalone extends the same choice:

```
First run  →  Where is your data?
              ○ A server on this network      → client mode  (setups B and C)
                  [ Find my server ]  or  http://192.168.1.20:8080
              ○ On this device                → standalone   (setup A)
```

**One APK, both modes.** Not two apps — and that comes from this project's own
history: two similar-looking APKs create exactly the field question that has
already cost us a day, *which build is actually on this terminal?* One artifact,
one version number, mode shown in Settings and in the profile menu. In client mode
the on-device node simply never starts.

---

## 23.6 Standalone mode is a new capability, not a toggle

Be honest about the size of this. Today the till is a **thin client**: no local
database, nothing queued. Every sale is posted to the shop node, and a till that
cannot reach its node cannot sell. The five-layer offline fallback is the *node*
queueing to our cloud — it has never been the *till* queueing to the node.

So standalone is not a flag over existing code. It is the shop node's server-side
behaviour, reimplemented to run on the device:

| Concern | Setup B (today) | Setup A (standalone) |
|---|---|---|
| Database | Postgres in Docker | **Room / SQLite on the device** |
| Sale, register, Z-report logic | Laravel | **Native Kotlin on the device** |
| BTW calculation | `BtwCalculationService` | **See §23.8 — the hard part** |
| Background sync | Laravel queue + scheduler | **WorkManager + foreground service** |
| Node private key (ch 22) | A file on a readable disk | **Android Keystore — hardware-backed** |
| Printer, drawer, scanner | USB from the till | Unchanged — already native Java |
| Licence | Signed token, verified offline | Same, fingerprint = Android ID + install UUID |
| Filing and sync clients | On the node | Same contracts, running on the device |
| NL / EN / Sranantongo | Unchanged | Unchanged |

What standalone deliberately does **not** get: multiple tills. An Android device
is a poor server for other tills — the OS may sleep it, drop its network or kill
the process. A shop needing a second till moves to setup B. See §23.10.

---

## 23.7 What is native, and what stays React

You asked for a whole app in Java/Kotlin on top of the WebView client. I agree
with the direction and would draw the line in a specific place: **make the node
native, keep the UI shared.**

| Layer | Language | Why |
|---|---|---|
| Node: database, sale/register/Z-report logic, sync, filing, licence, key storage | **Kotlin** | Needs Room, WorkManager, a foreground service and the Keystore. None of that is reachable from a WebView, and all of it must survive the OS deciding your app is idle. |
| Hardware: printer, drawer, scanner | **Java/Kotlin** | Already is — `UsbPrinterPlugin` |
| UI: POS screens, settings, reports, receipts, three languages | **React, in the WebView** | One codebase across Electron, web and Android. Rebuilding it in Compose duplicates 43 POS features plus settings and reports, for a team with no Android developer. |

In standalone mode the React UI talks to the native node over the Capacitor
bridge instead of over HTTP. That is the same client-server shape as setup B,
collapsed onto one device, with the bridge where the LAN used to be. The screens
do not know the difference, which is exactly what makes them reusable.

**The strongest argument for going native is not speed — it is the Keystore.**
[§22.7](/migration-architecture-plan/22-node-authentication) has to concede that
on a Windows PC the node's private key sits on a readable disk, and the best we
can do is bound the damage. On Android, a Keystore key with StrongBox or TEE
backing **cannot be extracted from the device at all**. A standalone Android node
is therefore the most secure deployment shape in the product, not the least — and
that is worth saying to a government buyer.

**On rebuilding the UI natively too:** the evidence does not currently support it.
The sluggishness reported from the shop floor was diagnosed and fixed, and the
cause was a focus-stealing scanner input, not WebView rendering. If measurement
later shows a specific screen is genuinely too slow on the terminal — the product
grid is the likely candidate — rebuild *that screen* in Compose behind the same
bridge. Rebuilding all of it up front spends the team's whole capacity on a
problem that has not been demonstrated.

---

## 23.8 The BTW engine in three languages — the real problem

Chapter 20 says the BTW engine must exist **once**, because three copies drift and
a one-cent disagreement between a receipt and a filing is a compliance incident.
Standalone mode appears to violate that directly: PHP cannot run on the terminal,
so the calculation has to exist in Kotlin too — and in TypeScript wherever the
cart shows a running total.

**It already does.** `frontend/src/store/cartStore.ts` implements discount-then-BTW
today, with 24 vitest cases, alongside the backend's `BtwCalculationService` and
its 56 PHPUnit cases. Two implementations, tested separately, never against each
other. Right now that is survivable because the backend recomputes and wins — the
frontend number is only what the cashier sees while ringing.

In standalone mode there is no backend to correct anything: **the on-device
number becomes the books.** With a native node that number is Kotlin's, which
makes three implementations of the same tax rule — PHP, TypeScript, Kotlin.

Worse, they do not calculate the same way. The backend uses bcmath strings
throughout. The cart store uses JavaScript floats and `Math.min`. Those agree on
almost every basket and disagree on some — which is a rounding-error hunt through
a shop's monthly BTW return, months later, with the Belastingdienst waiting.

**The fix is a shared conformance suite, not a shared language.**

- One canonical set of BTW vectors — inputs and exact expected outputs — living in
  `domain/Btw/vectors/`, versioned with the engine.
- **Every** implementation runs them in CI: PHPUnit, vitest and JUnit all read
  the same file. A vector that passes in one language and fails in another fails
  the build. This is what makes a third implementation survivable rather than
  reckless.
- The TypeScript side moves to decimal arithmetic (`decimal.js` or bigint minor
  units) rather than floats, so the two can agree at all.
- New rate, new exemption, new discount rule → **a new vector first**, then both
  implementations.

That converts "written once" from a location claim into a **behavioural** one,
which is what actually matters. And it is worth doing whether or not standalone
ships, because the second implementation already exists and is already untested
against the first.

If you would rather have literally one implementation, the option is compiling the
domain core to WebAssembly and calling it from both runtimes. It genuinely solves
it, and it costs more than the conformance suite in build complexity, hiring and
debuggability. My recommendation is vectors now, WASM only if the vectors keep
finding disagreements. With three languages in play the case for WASM gets
stronger, and it is the thing to revisit if Kotlin and PHP start diverging.

---

## 23.9 On a tablet, the device is the books

In setup A the shop's entire trading history lives on a terminal that can be
dropped, stolen, factory-reset, or taken home by a departing employee. That is a
materially worse position than a PC in a back room, and the install must treat it
that way:

- **Encrypted archive after every Z-report**, not merely nightly — the window of
  loss should be one shift, not one day.
- **Upload whenever there is any connectivity**, including a phone hotspot.
  Payload is small; opportunistic is fine.
- **Android full-disk encryption required**, and a device passcode enforced at
  setup. The POS refuses standalone mode without one.
- **App-private storage**, never external or cache directories, so Android's
  low-storage reclaim cannot take the database.
- **Say it out loud in the install guide and on screen**: this device is your
  bookkeeping. The USB export exists and a shopkeeper should know how to use it.

---

## 23.10 Licence: standalone is one till, and there is a way out

A standalone node is a shop node. Two standalone tablets in one shop would be
**two nodes, two databases, two separate sets of books** — no combined Z-report, no
single BTW return, two organisations as far as the control plane can tell. That is
not a configuration mistake to be documented; it is a licence-enforced constraint.

- The licence token carries the node's mode. Standalone tokens are issued for
  **one terminal**.
- Activating a second standalone node under the same organisation is refused by
  the control plane, with a message that says what to do instead.
- **The way out is a supported migration**, not a rebuild: export the device's
  encrypted archive, install setup B on a PC, import, and re-point the tablet as
  a client. The tablet keeps its data until the import verifies. This path must
  exist before standalone ships, because the shops that adopt A are precisely the
  shops that grow into B.

---

## 23.11 What must be built

On top of N1–N24:

| # | To build | Where |
|---|---|---|
| N25 | Three Dockerfiles / build contexts + CI release job | Build |
| N26 | Image signing, digest pinning, `docker save` offline bundle | Build |
| N27 | Artifact check: shop image contains no Control code | Build |
| N28 | Node profile switch (`JOSBIN_NODE`) — routes, migrations, modules | All |
| N29 | **BTW conformance vectors**, run by PHPUnit, vitest *and* JUnit | Build |
| N30 | Decimal arithmetic in the frontend money path (retire floats) | 🏪 Shop |
| N31 | On-device schema + migrations (Room) | 📱 Kotlin |
| N32 | Sale / register / Z-report logic on device | 📱 Kotlin |
| N32b | Bridge API — the React UI's client, pointed at the native node | 📱 Kotlin + UI |
| N32c | Node key in the Android Keystore (StrongBox/TEE where present) | 📱 Kotlin |
| N32d | WorkManager sync + foreground service so the OS cannot idle it out | 📱 Kotlin |
| N33 | Standalone mode: first-run choice, licence binding, mode display | 📱 Kotlin + UI |
| N34 | Per-Z-report encrypted archive + opportunistic upload | 📱 Kotlin |
| N35 | Filing and sync clients running on the device | 📱 Kotlin |
| N36 | Standalone → setup B migration (export, import, re-point) | 📱 + ☁️ |

N29 and N30 are worth doing **now**, ahead of the split and ahead of standalone.
They fix a drift risk that exists in the shipped product today.
