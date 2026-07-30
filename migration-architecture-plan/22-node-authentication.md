# 22. How the nodes prove who they are

Chapter 19 says which wires exist and what they carry. It does not say how the
receiving end knows the sender is who it claims to be. This chapter does.

Nothing here is built. It is the security design the split depends on, and it is
the part that is expensive to retrofit — a wire shipped without authentication
gets one, later, by breaking every node in the field at once.

---

## 22.1 The shape of the trust

<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three nodes with the authentication on each wire: control signs licence tokens the shop verifies, the shop signs rollups the control plane verifies, and the shop signs BTW filings the tax node verifies against a key enrolled directly with it" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- Control -->
  <rect x="250" y="14" width="200" height="96" rx="11" fill="#293371"/>
  <text x="350" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">☁️ Control plane</text>
  <line x1="266" y1="48" x2="434" y2="48" stroke="#4a5596" stroke-width="1.3"/>
  <text x="350" y="66" text-anchor="middle" font-size="10.5" fill="#ffffff">🔑 licence SIGNING key (private)</text>
  <text x="350" y="83" text-anchor="middle" font-size="10.5" fill="#c9d2ee">registry of node PUBLIC keys</text>
  <text x="350" y="100" text-anchor="middle" font-size="10.5" fill="#c9d2ee">revocation list</text>

  <!-- Shop -->
  <rect x="20" y="215" width="215" height="130" rx="11" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="127" y="240" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">🏪 Shop node</text>
  <line x1="36" y1="250" x2="219" y2="250" stroke="#e6ecf5" stroke-width="1.3"/>
  <text x="127" y="269" text-anchor="middle" font-size="10.5" fill="#111827">🔐 its OWN private key</text>
  <text x="127" y="286" text-anchor="middle" font-size="10.5" fill="#6b7280">generated at activation</text>
  <text x="127" y="303" text-anchor="middle" font-size="10.5" fill="#6b7280">never leaves this machine</text>
  <rect x="36" y="313" width="183" height="22" rx="5" fill="#eef2fb"/>
  <text x="127" y="328" text-anchor="middle" font-size="10" fill="#293371">control's public key baked in</text>

  <!-- Tax -->
  <rect x="465" y="215" width="215" height="130" rx="11" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="572" y="240" text-anchor="middle" font-size="13" font-weight="700" fill="#0e1a14">🏛 Tax node</text>
  <line x1="481" y1="250" x2="664" y2="250" stroke="#cfe0d5" stroke-width="1.3"/>
  <text x="572" y="269" text-anchor="middle" font-size="10.5" fill="#0e1a14">its OWN registry:</text>
  <text x="572" y="286" text-anchor="middle" font-size="10.5" fill="#0e1a14">BTW number → node public key</text>
  <rect x="481" y="296" width="183" height="39" rx="5" fill="#e6efe9"/>
  <text x="572" y="311" text-anchor="middle" font-size="10" fill="#1f6b3b">enrolled by the taxpayer,</text>
  <text x="572" y="326" text-anchor="middle" font-size="10" fill="#1f6b3b">not vouched for by us</text>

  <!-- licence: control -> shop -->
  <line x1="264" y1="104" x2="150" y2="209" stroke="#EF6C00" stroke-width="2.5"/>
  <polygon points="150,209 162,204 160,215" fill="#EF6C00"/>
  <text x="26" y="150" font-size="11" font-weight="600" fill="#EF6C00">① licence token</text>
  <text x="26" y="165" font-size="10" fill="#6b7280">control signs · shop verifies</text>
  <text x="26" y="179" font-size="10" fill="#6b7280">offline, no network</text>

  <!-- rollups: shop -> control -->
  <line x1="215" y1="209" x2="330" y2="116" stroke="#293371" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="330,116 318,120 322,130" fill="#293371"/>
  <text x="232" y="170" font-size="11" font-weight="600" fill="#293371">② rollups</text>
  <text x="232" y="185" font-size="10" fill="#6b7280">shop signs · control verifies</text>
  <text x="232" y="199" font-size="10" fill="#6b7280">+ sequence no. · nonce</text>

  <!-- filing: shop -> tax -->
  <line x1="239" y1="280" x2="461" y2="280" stroke="#1f6b3b" stroke-width="2.5"/>
  <polygon points="461,280 449,276 449,285" fill="#1f6b3b"/>
  <text x="350" y="272" text-anchor="middle" font-size="11" font-weight="600" fill="#1f6b3b">③ BTW filing</text>
  <text x="350" y="295" text-anchor="middle" font-size="10" fill="#6b7280">shop signs · tax verifies · + logged-in human</text>

  <!-- receipt: tax -> control -->
  <line x1="490" y1="212" x2="404" y2="116" stroke="#9aa3b8" stroke-width="1.7" stroke-dasharray="3 4"/>
  <polygon points="404,116 415,117 410,126" fill="#9aa3b8"/>
  <text x="452" y="170" font-size="10.5" font-weight="600" fill="#6b7280">④ receipt only</text>
  <text x="452" y="185" font-size="10" fill="#6b7280">filed j/n · ref · when</text>
  <text x="452" y="199" font-size="10" fill="#6b7280">no amounts</text>

  <!-- footer rule -->
  <line x1="20" y1="372" x2="680" y2="372" stroke="#e6ecf5" stroke-width="1.3"/>
  <text x="350" y="393" text-anchor="middle" font-size="11.5" font-weight="700" fill="#111827">Two keypairs, pointing opposite ways — that is the whole model.</text>
  <text x="350" y="412" text-anchor="middle" font-size="10.5" fill="#6b7280">Control proves itself to the shop with ①. The shop proves itself to control with ② and to tax with ③.</text>
</svg>

Two keypairs, and they are easy to confuse:

| | Private key held by | Signs | Verified by | Answers |
|---|---|---|---|---|
| **Licence key** | Control plane | Licence tokens | Shop node, offline | "Is this licence genuine?" |
| **Node key** | Shop node | Rollups and filings | Control plane, tax node | "Is this really that shop?" |

The licence key is covered in [§19.3](/migration-architecture-plan/19-three-node-architecture). This chapter is about the second one.

---

## 22.2 The node key, and why the node makes it itself

At activation the node **generates its own keypair** and sends only the public
half up. The private key is written to the OS keystore and never transmitted,
never backed up to us, never present in any payload.

That ordering matters. If we generated the pair and shipped it down, we would
hold a key capable of signing as the shop — and a BTW filing signed with it would
be indistinguishable from one the shopkeeper made. D4 says we stay out of the
chain of custody; a vendor-generated signing key would put us straight back in.

**Ed25519** (RFC 8032). Small keys, fast verification on a cheap ARM till, and no
curve or padding parameters to get wrong. The signature is 64 bytes — irrelevant
next to a 50–200 kB daily payload.

---

## 22.3 Sign the payload, not the connection

The obvious answer is mutual TLS: give each node a client certificate. Do not
make that the primary mechanism, for one concrete reason.

**Layer 4 of the sync fallback is a USB stick.** A manager in Nickerie exports
the day, walks it to a machine with internet, or sends it over WhatsApp. Head
office uploads it in the dashboard, and it must import *exactly as if it had
synced*. Transport authentication cannot survive that: the moment the payload is
a file, TLS has already ended and proved nothing about the file.

So the authentication travels **inside** the payload:

```
POST /v1/nodes/{node_id}/rollups
Content-Type: application/json
X-Josbin-Node:      3f2b…          ← which node claims to be speaking
X-Josbin-Signature: ed25519=…      ← detached signature over the canonical body
X-Josbin-Seq:       1184           ← monotonic, per node, never reused
X-Josbin-Schema:    2              ← control accepts N−2 (§19.6)

{ "node_id":"3f2b…", "seq":1184, "nonce":"9c1e…",
  "signed_at":"2026-07-30T09:14:22-03:00",
  "business_date":"2026-07-29",
  "rollups":[ … ], "z_reports":[ … ] }
```

The same bytes, with the same signature, verify whether they arrived over HTTPS,
on a USB stick, or as a WhatsApp attachment. That is the property worth designing
for, and mTLS cannot provide it.

TLS 1.3 still carries the online path — confidentiality and integrity in
transit, HSTS, older versions disabled. mTLS may be added later as defence in
depth. Neither is ever the *only* proof.

::: warning Canonicalise before signing, or nothing verifies.
Sign the bytes of a **canonical** serialisation (JCS, RFC 8785), not whatever
your JSON encoder emitted. Any proxy, any re-serialisation, any map that reorders
its keys silently breaks every signature — and the failure looks like "the node
is compromised", not "the encoder reordered a field."
:::

---

## 22.4 Replay, retries and ordering

In Nickerie a retry after a timeout is the normal case, not the edge case. The
node cannot tell "you never received it" from "you received it and the ack was
lost", so it retries — and must be able to retry forever without double-counting
a day's takings.

- **Monotonic sequence number per node.** Control stores the highest `seq` seen.
  A repeat of a seen `(node_id, seq)` returns the original result and changes
  nothing. Idempotency and replay protection are the same mechanism.
- **Nonce** per payload, so two different payloads can never be byte-identical.
- **`signed_at` is recorded, not enforced.** A node offline for five days
  legitimately submits five days at once. Rejecting on clock skew would break
  exactly the customer the offline design exists for. The sequence number is the
  anti-replay defence; the clock is evidence, not a gate.
- **Gaps are an alert, not an error.** Jumping 1184 → 1190 means five payloads
  are missing or someone is replaying selectively. Accept it, flag it, show it
  on the node's health row.

---

## 22.5 The other direction: the node must authenticate us

A shop's network is not ours. Anyone who can edit a hosts file can point the node
at a server they control.

- **Pin the CA, not the leaf.** Pin our issuing CA's public key. Pinning the leaf
  breaks every node at the next Let's Encrypt renewal, which is a 90-day
  self-inflicted outage.
- **The reply that matters is signed anyway.** A forged control plane can accept
  rollups and learn nothing it did not already have, and it cannot mint a licence
  token without the signing key. That is the point of ① being a signature rather
  than an answer.

---

## 22.6 The tax wire, where we are deliberately not in the middle

The tax node is a different trust domain. It cannot take our word for who a
taxpayer is, because we are the vendor, not the authority.

**Enrolment happens directly, once.** The manager signs into the Belastingdienst
portal with credentials the Belastingdienst issued to that taxpayer, and registers
the node's public key — the fingerprint is shown in the POS and confirmed on the
portal, so a wrong key is visible before it is trusted. The tax node stores
`BTW number → node public key`. The control plane is not consulted and does not
attest to it.

Every filing is then signed over: BTW number, period type and range, totals per
rate, the filing reference, **the id of the human who filed it**, and the hash of
the previous filing for that organisation.

That last pair is what makes a filing hard to repudiate and hard to forge:

- Signed with the node key → provably from that node.
- Carries a logged-in user → a stolen key alone cannot file, because filing
  requires a human session on the node at that moment.
- Chained to the previous filing → a filing cannot be quietly inserted, removed
  or reordered after the fact. The chain already exists (BTW-FILING-11); this
  extends it across the node boundary.

**The tax inspector's own login is unchanged**: their account lives in the tax
node, 2FA is mandatory and cannot be switched off at policy level, and they never
authenticate to a shop or to the control plane. Three nodes, three user tables,
three separate auth realms — which is exactly why the eleven `AUTH-*` features
are marked as splitting in [§21.3](/migration-architecture-plan/21-migration-record).

---

## 22.7 What a stolen disk actually gets you

The private key sits on a Windows PC behind someone's counter. We have already
said, in [§20.1](/migration-architecture-plan/20-split-build-plan), that whoever
holds that machine can read the disk. Pretending the key is safe there would be
dishonest, so here is the real position.

**Reduce the chance:**

- Store the key in the **OS keystore** (DPAPI on Windows), bound to the machine
  account, not as a file next to the config.
- **Hardware fingerprint** in the licence, so a copied VM fails its licence check
  even with the key (§19.3).
- For government sites, a **TPM-backed or smart-card key** removes disk exposure
  entirely. Worth quoting where the deployment justifies it.

**Bound the damage.** The node key is deliberately capable of very little:

| With a stolen node key you CAN | You CANNOT |
|---|---|
| Push fabricated rollups for **that one shop** | Read any other shop's data |
| | Mint or extend a licence — that needs the control private key |
| | File for another BTW number — the tax registry binds key to taxpayer |
| | File at all without a logged-in user session on the node |

**Detect and revoke:**

- Duplicate `seq` arriving from a second source, or a sequence that forks, means
  two things are signing as one node.
- Node health carries last-seen IP and version; a shop that has never left
  Paramaribo suddenly reporting from elsewhere is worth a flag, not a block.
- Control can **revoke a node public key**. The next contact fails, and the shop
  re-enrols with a fresh keypair — the same path as a replaced PC, which is the
  common case anyway.

---

## 22.8 Rotation, because keys outlive their assumptions

Easy to skip; impossible to add later.

- **Put a key id (`kid`) in every licence token and every signature header from
  day one.** A token format with no key id can never rotate — you would have to
  break every node in the field simultaneously to change one key.
- **Node key rotation:** the new public key is submitted signed by the *old* key,
  which proves continuity without a human in the loop. If the old key is lost or
  compromised, that path is closed and it becomes a re-enrolment, deliberately.
- **Control signing key rotation:** builds carry the current and previous public
  keys during an overlap window, so nodes on an older build still verify.

---

## 22.9 The standards this is held to

Not a certification claim — the bar we build to, so the OWASP report and the
WBP-S documentation have something to describe.

| Area | What we hold to |
|---|---|
| Transport | TLS 1.3 only, older versions disabled, HSTS |
| Signatures | Ed25519 (RFC 8032), detached JWS (RFC 7515), canonical JSON (RFC 8785) |
| Key storage | OS keystore; TPM or smart card where the deployment justifies it |
| Archive | AES-256-GCM, key escrowed apart from the archive store (D6) |
| Application | OWASP ASVS L2 for all three nodes; OWASP Top 10 report before go-live |
| Personal data | WBP-S — no customer PII crosses any wire ([§19.5](/migration-architecture-plan/19-three-node-architecture)) |
| Abuse | Per-node rate limits; existing 1,000/min per API key on Layer 3 |
| Audit | Both ends log every accepted **and rejected** payload with node id and sequence |

Two habits matter more than any line in that table: **no wire is ever
authenticated by a shared secret that sits in plain text on a customer's disk**,
and **every payload is verifiable after the fact**, from a file, with no live
connection — because that is the only property that survives the way Suriname
actually connects.

---

## 22.10 What this adds to the build list

On top of N1–N16 in [§21.4](/migration-architecture-plan/21-migration-record):

| # | To build | Node |
|---|---|---|
| N17 | Node keypair generation at activation + OS keystore storage | 🏪 Shop |
| N18 | Payload signing: canonical JSON, detached Ed25519, `kid` header | 🏪 Shop |
| N19 | Signature verification + node public-key registry + revocation | ☁️ Control |
| N20 | Sequence/nonce store — idempotent replay handling, gap alerting | ☁️ Control |
| N21 | CA pinning in the node's HTTP client | 🏪 Shop |
| N22 | Tax-side key enrolment (portal step) + filing signature verification | 🏛 Tax |
| N23 | Filing signature covering totals + user id + previous-filing hash | 🏪 Shop |
| N24 | Key rotation on both wires, including the overlap window | All |

None of it exists today. The wires in chapter 19 are drawn; not one of them is
authenticated yet.
