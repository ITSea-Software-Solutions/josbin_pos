# 19. Three-node architecture — shop, control, tax

Josbin POS is one product delivered as **three independent nodes**. Each has its
own database, its own installation and its own reason to exist. They talk over
narrow, versioned wires — never by sharing a database.

This chapter is the contract between them. It is a design document: read it
before moving code, and change it before changing the wires.

---

## 19.1 The shape

<svg viewBox="0 0 700 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three nodes: shop node in the shop, control plane in the cloud, tax node at the Belastingdienst, with licence, sync and filing arrows between them" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- Shop node -->
  <rect x="20" y="150" width="200" height="180" rx="12" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="120" y="176" text-anchor="middle" font-size="14" font-weight="700" fill="#111827">🏪 Shop node</text>
  <text x="120" y="195" text-anchor="middle" font-size="11" fill="#6b7280">in the shop, on their PC</text>
  <line x1="36" y1="206" x2="204" y2="206" stroke="#e6ecf5" stroke-width="1.5"/>
  <text x="120" y="224" text-anchor="middle" font-size="11.5" fill="#111827">tills · sales · catalogue</text>
  <text x="120" y="242" text-anchor="middle" font-size="11.5" fill="#111827">registers · customers</text>
  <text x="120" y="260" text-anchor="middle" font-size="11.5" fill="#111827">its own users</text>
  <rect x="36" y="274" width="168" height="24" rx="6" fill="#e9f7ef"/>
  <text x="120" y="291" text-anchor="middle" font-size="11" fill="#1d7a46">✅ sells with no internet</text>
  <text x="120" y="316" text-anchor="middle" font-size="10.5" fill="#6b7280">no admin or licence-server code</text>

  <!-- Control plane -->
  <rect x="265" y="40" width="180" height="150" rx="12" fill="#293371"/>
  <text x="355" y="66" text-anchor="middle" font-size="14" font-weight="700" fill="#ffffff">☁️ Control plane</text>
  <text x="355" y="84" text-anchor="middle" font-size="11" fill="#c9d2ee">you host it</text>
  <line x1="281" y1="95" x2="429" y2="95" stroke="#4a5596" stroke-width="1.5"/>
  <text x="355" y="113" text-anchor="middle" font-size="11.5" fill="#ffffff">organisations · licences</text>
  <text x="355" y="131" text-anchor="middle" font-size="11.5" fill="#ffffff">fleet · consolidated view</text>
  <text x="355" y="149" text-anchor="middle" font-size="11.5" fill="#ffffff">signs licence tokens 🔑</text>
  <text x="355" y="173" text-anchor="middle" font-size="10.5" fill="#c9d2ee">private key never leaves here</text>

  <!-- Tax node -->
  <rect x="490" y="150" width="190" height="180" rx="12" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="585" y="176" text-anchor="middle" font-size="14" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <text x="585" y="195" text-anchor="middle" font-size="11" fill="#5b6b62">Belastingdienst</text>
  <line x1="506" y1="206" x2="664" y2="206" stroke="#cfe0d5" stroke-width="1.5"/>
  <text x="585" y="224" text-anchor="middle" font-size="11.5" fill="#0e1a14">BTW filings only</text>
  <text x="585" y="242" text-anchor="middle" font-size="11.5" fill="#0e1a14">own database</text>
  <text x="585" y="260" text-anchor="middle" font-size="11.5" fill="#0e1a14">cross-organisation view</text>
  <rect x="506" y="274" width="158" height="24" rx="6" fill="#e6efe9"/>
  <text x="585" y="291" text-anchor="middle" font-size="11" fill="#1f6b3b">no commercial data</text>

  <!-- Licence: control -> shop -->
  <line x1="272" y1="140" x2="185" y2="180" stroke="#EF6C00" stroke-width="2.5"/>
  <polygon points="185,180 196,176 194,187" fill="#EF6C00"/>
  <text x="150" y="128" font-size="11" font-weight="600" fill="#EF6C00">signed licence 🔑</text>
  <text x="150" y="142" font-size="10" fill="#6b7280">activation + renewal</text>

  <!-- Sync: shop -> control -->
  <line x1="205" y1="205" x2="290" y2="180" stroke="#293371" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="290,180 279,178 283,189" fill="#293371"/>
  <text x="212" y="232" font-size="11" font-weight="600" fill="#293371">sync ↑</text>
  <text x="212" y="246" font-size="10" fill="#6b7280">totals, Z-reports</text>
  <text x="212" y="259" font-size="10" fill="#6b7280">no customer PII</text>

  <!-- Filing: shop -> tax (direct) -->
  <line x1="222" y1="300" x2="486" y2="300" stroke="#1f6b3b" stroke-width="2.5"/>
  <polygon points="486,300 475,296 475,305" fill="#1f6b3b"/>
  <text x="354" y="292" text-anchor="middle" font-size="11" font-weight="600" fill="#1f6b3b">BTW filing, signed by the shop</text>
  <text x="354" y="318" text-anchor="middle" font-size="10" fill="#6b7280">direct — the control plane is not in the chain of custody</text>

  <!-- Receipt: tax -> control -->
  <line x1="520" y1="150" x2="445" y2="110" stroke="#9aa3b8" stroke-width="1.8" stroke-dasharray="3 4"/>
  <polygon points="445,110 456,110 452,119" fill="#9aa3b8"/>
  <text x="470" y="96" font-size="10" fill="#6b7280">receipt only</text>
  <text x="470" y="108" font-size="10" fill="#6b7280">filed y/n · ref · when</text>
</svg>

Read the arrows, not the boxes — the wires are the architecture:

| Wire | Direction | Carries | Needs internet |
|---|---|---|---|
| **Licence** | control → shop | Signed token: limits, expiry, fingerprint | Only at activation and renewal |
| **Sync** | shop → control | Sale totals, Z-reports, register events | When available; queues when not |
| **Filing** | shop → tax | BTW return, signed by the shop | At filing time |
| **Receipt** | tax → control | Filed yes/no, reference, timestamp — **no amounts** | Best effort |

---

## 19.2 What each node owns

**Shop node** — the only one a shopkeeper ever installs.

Owns tills, sales, catalogue, stock, registers, customers, and its own user
accounts. Sells with no internet, indefinitely, because nothing in the selling
path crosses a wire.

It contains **no admin-side code**: no licence issuance, no cross-organisation
reporting, no fleet management. That machine sits in someone else's building and
whoever holds it can read the disk. Code that is not shipped cannot be read.

**Control plane** — you host it, one instance.

Organisations, licences, the fleet, the consolidated view across a customer's
own stores. Holds the licence **signing key**, which never leaves it.

**Tax node** — the Belastingdienst instance.

BTW filings and nothing else, in its own database. It never holds a shop's
commercial data: no product lines, no customers, no margins.

---

## 19.3 The licence: signed, verified offline

The obvious design is "the shop asks our server whether its key is valid." Do
not build that. It fails two ways that matter:

- Point the node at a server that always answers yes (a hosts-file edit), or
- block the call and live in the grace period forever.

**Instead: the control plane signs, the shop node verifies.**

```
Control plane                          Shop node
─────────────                          ─────────
private key  ──signs──►  LICENCE TOKEN  ──►  public key (baked into the build)
                         ├ organisation id
                         ├ store limit / terminal limit
                         ├ tier
                         ├ expires_at
                         └ hardware fingerprint hash
```

Every boot the node checks the **signature** and the **expiry** — with no
network at all. That inverts the trust model in the right direction:

- Editing the token in the shop's own database breaks the signature.
- Copying the VM to a second machine breaks the fingerprint.
- A forged server cannot mint a token it has no key to sign.
- Offline operation works **by design**, for the whole token lifetime, not by
  the mercy of a grace timer.

The network call stops being about validity and becomes about **renewal and
revocation**: fetch a token with a later expiry, and pull the revoked list.

Two details that are easy to skip and painful later:

- **Clock tampering.** Store the highest server time ever seen. If the local
  clock goes backwards past it, treat the licence as suspect.
- **The key in the database is not a secret.** Assume the customer reads it.
  That is fine — it is signed, not hidden. What must never be near the shop node
  is the *private* key.

---

## 19.4 Activation, once

```
1. You register the organisation in the control plane and issue a licence key.
2. Shop installs the node. First run asks for the key.
3. Node calls the control plane once: key ──► signed licence token.
4. Node verifies the signature, stores the token, records the fingerprint.
5. Node creates the first admin account from the email in the token.
   That admin sets their password locally.
6. Setup complete. From here the shop creates its own stores, tills and users —
   locally, with no central directory.
```

Step 5 is what makes offline honest. There is **no central user table**: shop
users exist only in the shop. Nothing about signing a cashier in requires your
server to be reachable, ever.

---

## 19.5 What deliberately does not cross a wire

- **Customer names, phones, ID numbers.** Encrypted WBP-S data. They stay in the
  shop. The control plane does not need them, and the strongest privacy posture
  is not holding them.
- **Cost prices and margins.** The shop's commercial position is its own.
- **Product lines to the tax node.** A BTW return is totals per rate. Line-level
  detail belongs to the Rekenkamer audit export, on request, not to a routine
  filing.

---

## 19.6 Version tolerance

Shops upgrade on their own schedule, so at any moment the fleet spans several
versions. Every sync and filing payload carries a schema version, and **the
control plane accepts N−2**. This is the thing that bites in year two, not year
one — build it in before there is a fleet.

---

## 19.7 Open decisions

> **Settled since this chapter was written.** All of these are now decided —
> see [chapter 21](/plan/21-migration-record) for the calls and the reasoning. Kept below for the
> record of what was open.


These are not yet settled and are called out so nobody assumes:

1. **One shop node per organisation, or per store?** A chain with five branches:
   one server at head office, or five independent nodes? Changes what "store"
   means in the licence limits.
2. **Escrow.** If the vendor disappears, should a shop keep trading? A permanent
   token issued on request answers it; the decision is commercial.
3. **Tax node hosting.** Does the Belastingdienst run their own instance, or log
   into one you host on their behalf?

---

## 19.8 Order of work

1. Carve the modules — `shop` / `control` / `tax` — over the shared domain core.
   Nothing deploys differently yet; this is pure refactor and must not change
   behaviour.
2. Signed-licence issuance in the control plane, offline verification in the
   node. Replaces the current always-online licence check.
3. Activation flow, including first-admin bootstrap.
4. Three build targets, three databases, three compose files.
5. Move BTW filing to direct submission with shop-side signing.

Step 1 is the one to get right. The BTW engine, the money rounding and the
receipt builder stay in the shared core and are written **once** — three copies
of a tax calculator will drift, and when a shop's receipt and the Belastingdienst
disagree by a cent that is a compliance incident, not a bug report.
