# PARTNER OUTREACH — Uni5Pay+ email draft + government-DB wording

> INTERNAL (srcExcluded; served only behind the password on /internal/).
> Two prepared conversations for the client: §1 a ready-to-send partnership
> email to UPPS / Southern Commercial Bank (English + Dutch — review, fill
> placeholders, send); §2 talking points for proactively renegotiating the
> "isolated database" wording before the first government tender. Every
> factual claim in §1 comes from the verified
> `progress/research-regional-payments-2026-07.md`; every claim in §2 is
> verified against the actual codebase. Deliberately no overclaiming: no
> Uni5Pay+ integration exists yet — the email requests documentation and
> sandbox access only.

---

## 1. Uni5Pay+ / UPPS partnership email

**Why this email:** Uni5Pay+ (operated by UPPS = Southern Commercial Bank +
SPSB + Telesur) is the one Surinamese wallet with a documented POS/ECR
integration — the register computes the amount and shows a dynamic
per-transaction QR — plus a payment API, hosted gateway and production
deployments (EBS, SWM, Telesur). Onboarding is partner-driven via SCB/UPPS;
there is no self-serve developer portal, which is why this has to be an
email. Our POS already carries their **static** wallet-QR flow (per-store QR
upload, on-screen display, cashier confirmation, org-configurable wallet
lists) and has a feature-flagged slot ready for the dynamic-QR + callback
flow.

### 1.1 Before you send — checklist

- [ ] **Recipient:** find the right UPPS / SCB partnership or merchant-
      integrations contact — start at uni5pay.sr's contact page or via the
      client's own SCB account manager. (No named contact is on file in our
      research — do not guess an address.)
- [ ] Fill every **[bracketed]** placeholder: sender name, role, company,
      phone, email.
- [ ] **Sending address:** the client's business domain reads far stronger
      than a personal mailbox; ITSea can be CC'd for the technical thread.
- [ ] **Attachment:** optionally a one-pager (product overview + a photo of
      the wallet-QR screen at the till) — keeps the email itself short. Do
      not attach internal docs.
- [ ] **Language:** Dutch first for SCB/UPPS (Suriname); include or offer
      the English version for any international reviewer.

### 1.2 English draft (≈250 words)

> **Subject: Partnership request — Josbin POS × Uni5Pay+ (merchant QR API
> + partner listing)**
>
> Dear UPPS / Southern Commercial Bank team,
>
> I am [name], [role] at [company], the team behind **Josbin POS** — a
> point-of-sale and multi-store management platform built in and for
> Suriname (Dutch/English, SRD, BTW-compliant, offline-capable), aimed at
> supermarkets, retail chains and government departments.
>
> Josbin POS already supports Uni5Pay+ at the till today: each store
> uploads its wallet QR, the register displays it on screen for the
> customer to scan, and the cashier confirms the payment before the sale
> closes — with the accepted wallet list configurable per organisation.
> Merchants running our registers are already bringing transactions to the
> Uni5Pay+ network.
>
> We would like to take this to the integration Uni5Pay+ documents for
> POS/ECR: the register computes the amount and displays a dynamic,
> per-transaction QR, with electronic payment confirmation replacing manual
> cashier checks. Our platform has this integration slot built and
> feature-flagged, ready to develop against your API.
>
> Concretely, we request:
>
> 1. **Merchant/POS API documentation** for dynamic QR payment requests
>    and payment-status callbacks;
> 2. **Sandbox or test-merchant access**, so we can build and certify the
>    integration before any live merchant uses it;
> 3. A conversation about a **partner listing** — Josbin POS as a
>    Uni5Pay+-integrated register, and Uni5Pay+ as the recommended wallet
>    to our merchants.
>
> We understand onboarding runs through SCB/UPPS rather than a self-serve
> portal, and we are happy to follow your process. Could you connect us
> with the right person for merchant integrations?
>
> Kind regards,
> [name] · [role], [company] · [phone] · [email]

### 1.3 Dutch draft (≈250 woorden)

> **Onderwerp: Samenwerkingsverzoek — Josbin POS × Uni5Pay+
> (merchant-QR-API + partnervermelding)**
>
> Geacht team van UPPS / Southern Commercial Bank,
>
> Ik ben [naam], [functie] bij [bedrijf], het team achter **Josbin POS** —
> een kassa- en filiaalbeheersysteem, gebouwd in en voor Suriname
> (Nederlands/Engels, SRD, BTW-conform, werkt ook offline), gericht op
> supermarkten, retailketens en overheidsdiensten.
>
> Josbin POS ondersteunt Uni5Pay+ vandaag al aan de kassa: elke winkel
> uploadt zijn wallet-QR, de kassa toont die op het scherm zodat de klant
> kan scannen, en de kassier bevestigt de betaling voordat de verkoop wordt
> afgesloten — met de lijst van geaccepteerde wallets instelbaar per
> organisatie. Winkeliers die met onze kassa's werken, brengen dus nu al
> transacties naar het Uni5Pay+-netwerk.
>
> Graag zetten wij de stap naar de integratie die Uni5Pay+ voor POS/ECR
> documenteert: de kassa berekent het bedrag en toont een dynamische
> transactie-QR, met elektronische betaalbevestiging in plaats van
> handmatige controle door de kassier. Ons platform heeft deze integratie
> als voorbereide, afschakelbare module klaarstaan.
>
> Concreet vragen wij:
>
> 1. **Merchant-/POS-API-documentatie** voor dynamische QR-betaalverzoeken
>    en statusmeldingen (callbacks);
> 2. **Toegang tot een sandbox- of testomgeving**, zodat wij de integratie
>    kunnen bouwen en certificeren vóór livegang bij een winkelier;
> 3. Een gesprek over een **partnervermelding** — Josbin POS als
>    Uni5Pay+-geïntegreerde kassa, en Uni5Pay+ als aanbevolen wallet
>    richting onze winkeliers.
>
> Wij begrijpen dat onboarding via SCB/UPPS verloopt en volgen graag uw
> proces. Kunt u ons in contact brengen met de juiste persoon voor
> merchant-integraties?
>
> Met vriendelijke groet,
> [naam] · [functie], [bedrijf] · [telefoon] · [e-mail]

---

## 2. Government-DB wording — talking points for the client

**Background (internal, honest):** the original proposal promised
*"government data in completely isolated database"*. What is actually built
is a **single PostgreSQL 16 cluster** where every organisation's data —
government or commercial — is separated by organisation-scoped queries
enforced at the API layer, with hardened foreign keys, field-level
encryption of customer personal data, and an append-only, hash-chained
audit log. That is a strong design, but it is not what those five words
say. The client should renegotiate the wording **proactively, before the
first government tender** — a gap discovered by a tender reviewer or
auditor costs trust; a gap the vendor raises first builds it. Talking
points, each verified against the code:

1. **Name the gap plainly.** "The proposal says 'completely isolated
   database'. What we deliver today is one database cluster in which every
   government organisation's data is logically isolated: every single query
   the system runs is filtered to the requesting user's organisation. We
   want the contract to say what the system does."

2. **Isolation is enforced where data is read — not filtered afterwards.**
   Every API query carries the organisation filter at the database-query
   level (verified across the backend controllers: each list/lookup scopes
   on the authenticated user's `organisation_id`, and cross-organisation
   access to a single record is rejected by a same-org guard). Access is
   deny-by-default via roles; the Tax Inspector and Auditor roles are
   read-only; 2FA is enforceable per role. There is no code path that
   fetches another organisation's rows and hides them in the UI.

3. **Tamper-evidence is stronger than a separate database alone would
   give.** The audit log is append-only **at the database level**:
   PostgreSQL triggers reject any UPDATE, DELETE or TRUNCATE on
   `audit_logs` (schema-hardening migration of 2026-07-19), and every row
   is hash-chained — each entry stores the previous row's hash, so any
   alteration anywhere in history breaks the chain and is detectable. For
   the Rekenkamer's actual goal — proving records were not tampered with —
   this exceeds what a physically separate database with an ordinary audit
   table provides.

4. **Personal data is unreadable even with direct database access.**
   Customer name, phone, email and ID number are encrypted field-level
   (AES-256-CBC) with an application key that is not stored in the
   database — WBP-S-aligned. Financial history is protected against
   deletion at the schema level (RESTRICT foreign keys: sales, Z-reports,
   register sessions and cash movements cannot be cascade-deleted), and
   the cluster has WAL-based point-in-time recovery with nightly backups
   and a monthly, logged restore drill.

5. **True physical isolation exists as a priced option — describe it
   honestly.** The multi-tenancy package (stancl/tenancy) is installed and
   the platform was architected for database-per-tenant from day one;
   activating a **dedicated database (or a fully dedicated server) per
   government organisation** is estimated at 1–2 weeks of engineering,
   plus a *permanent* operational surcharge: separate migrations, backups,
   restore drills and monitoring per government database, and hosting
   costs for dedicated hardware. Offer it as a contract tier for
   departments that require physical separation — priced, not pretended.

6. **Propose replacement wording rather than a deletion.** Suggested
   clause: *"Government data is logically isolated per organisation,
   enforced in every database query, protected by database-level
   append-only, hash-chained audit logging and field-level encryption of
   personal data. A physically dedicated database per government
   organisation is available as a contract option."* Every word of that is
   true of the running system today — which is exactly what makes it
   defensible in front of the Rekenkamer.

**One boundary:** until the wording is aligned (or DB-per-tenant is
activated and priced), do not sign a government contract containing the
original "completely isolated database" sentence.
