# 21. Migratie naar de architectuur met drie knooppunten

Het beslissingsregister en de bestemming per functie voor het opsplitsen van
Josbin POS in drie knooppunten. [Hoofdstuk 19](/nl/migration-architecture-plan/19-three-node-architecture)
is de doelvorm en [hoofdstuk 20](/nl/migration-architecture-plan/20-split-build-plan) de volgorde van
werken — **dit hoofdstuk is wat is besloten en waar elke functie landt.**

Niets hierin is een voorstel. Dit zijn vastgestelde keuzes, met de onderbouwing
bewaard zodat een latere lezer een beslissing van een toevalligheid kan
onderscheiden.

---

## 21.1 Genomen beslissingen

### D1 — Eén knooppunt per winkel, en het schema blijft zoals het is

Eén winkel, één database, één knooppunt. Kassamedewerkers zijn logins op dat
knooppunt; elke Windows-machine in de winkel kan de Docker-server draaien en de
kassa's verbinden er via het winkelnetwerk mee.

**Maar `organisation_id` en `store_id` blijven in het schema**, met precies één
rij in elk. Het is verleidelijk ze weg te halen; het is verkeerd om dat te doen:

- Die kolommen lopen door 65 migraties en door vrijwel alle opgeleverde functies.
  Ze verwijderen is een enorme wijziging waarvan de enige opbrengst netheid is —
  en het zou de vrieslijst in één keer breken.
- De synchronisatie blijft vanzelf adresseerbaar: het beheerknooppunt weet al
  voor welke organisatie en welke vestiging een knooppunt spreekt.
- Een winkel die later twee winkels wordt, of een keten die een knooppunt per
  filiaal wil, heeft dan geen migratie nodig.

**Vereenvoudig de installatie, niet het schema.** Dat is wat de eerste stappen
een zuivere herstructurering laat blijven.

*Gevolg om op te plannen:* één database per winkel, met alleen totalen die
omhoog gaan, betekent dat een defecte schijf de handelsgeschiedenis van die
winkel meeneemt. Automatische lokale back-up en de bestaande USB-export horen
bij de installatie, niet als bijzaak erna.

### D2 — Sluit een betalende klant nooit buiten, en bied echte escrow

Two mechanisms, for two different fears.

**Afschalen, niet buitensluiten (standaardgedrag).** Kan een knooppunt de
licentieserver maanden niet bereiken *en* is het token verlopen, dan gaat het
naar alleen-lezen. Rapporten, exports en BTW-aangiften blijven werken; alleen
nieuwe verkopen stoppen. De gegevens van de klant worden nooit gegijzeld — dat
was al het uitgangspunt, en hiermee zit het in de structuur.

**Broncode-escrow (voor de overheidsopdracht).** De broncode in bewaring bij een
agent in Paramaribo, vrij te geven bij vastgelegde gebeurtenissen — faillissement
van de leverancier, of een vastgelegde periode zonder reactie op support. Een
ministerie zal hierom vragen; het antwoord klaar hebben is meer waard dan wat het
papierwerk kost.

Er is commercieel ook een **eeuwigdurend licentietoken**. Dat is geen
noodprocedure en geen apart mechanisme — het is hetzelfde ondertekende token,
uitgegeven zonder einddatum, bewust verstrekt aan het einde van een contract of
als betaalde variant. Voor de winkel verandert er niets: dezelfde sleutel,
hetzelfde activatiescherm, dezelfde offlinecontrole. Het blijft gebonden aan de
hardwarevingerafdruk, dus een uitgelekt eeuwigdurend token is voor niemand
anders een gratis licentie.

### D3 — Wij hosten het belastingknooppunt, als een werkelijk apart systeem

Hosten mag niet stilletjes "dezelfde Postgres, ander schema" worden — dat zou de
nalevingsbelofte onwaar maken. Apart betekent:

- Een **eigen database-instantie**, niet een schema binnen de commerciële
- Een **eigen applicatie-installatie**, eigen inloggegevens en eigen back-ups
- **Geen netwerkroute** vanuit de commerciële omgeving — minimaal een apart
  Docker-netwerk, liefst een aparte VPS
- Een eigen auditlog, inclusief elke keer dat ons team er iets aanraakt

**Hiermee worden wij verwerker voor de Belastingdienst onder de WBP-S.** De
verwerkersovereenkomst is dan geen papierwerk meer, maar juist datgene wat het
hosten rechtmatig maakt. Onderhoudstoegang moet op naam staan, gelogd worden en
in tijd begrensd zijn — geen permanente root-login.

Het versterkt ook het argument voor rechtstreeks aangeven (D4): de machine
hosten *én* in het aangiftepad zitten zou ons dubbel blootstellen.

### D4 — BTW wordt rechtstreeks aangegeven, ondertekend door de winkel

Winkel → belastingknooppunt, ondertekend door de winkel, zodat aantoonbaar is
dat de aangifte van hen is en ongewijzigd. Terug naar het beheerknooppunt komt
alleen een **ontvangstbevestiging**: ingediend ja/nee, referentie, tijdstip —
**geen bedragen**. Wij beheren de machine zonder in de bewijsketen van de
aangifte te zitten.

### D5 — Laag 3 hoort bij het beheerknooppunt, en is niet het winkelnetwerk

Dit zijn verschillende dingen, en ze verwarren leidt tot echte misverstanden:

| | Wat het is | Internet |
|---|---|---|
| **Winkelnetwerk** | *Onze* kassa's → *hun* lokale server | **Nooit nodig.** |
| **Laag 3-API** | Kassasoftware van *iemand anders* → Josbin | Van hen, niet van de winkel |

Laag 3 is de open integratie-API — de kassa van een **andere leverancier** die
zijn verkopen bij ons aanlevert voor consolidatie en BTW. Dat heeft niets te
maken met een kassamedewerker die een verkoop aanslaat.

Het in het beheerknooppunt zetten kost de winkel niets en **haalt** code uit het
offlineknooppunt weg. Een winkelknooppunt heeft geen vast publiek adres; je kunt
een integrator niet vragen een wisselend IP-adres te ontdekken, en die wil één
endpoint en één sleutel in plaats van één per winkel. Is een winkel offline, dan
houdt het beheerknooppunt de aangeleverde verkoop vast en stuurt die later door —
omgekeerd is er geen enkel herstel.

### D6 — Één beheerdatabase plus versleutelde archieven per winkel

Geen database per organisatie. Het winkelknooppunt is nu de **bron van
waarheid**; onze cloud houdt een afgeleide kopie, en die kopie dient twee doelen
die tegengestelde opslag willen.

**Control database** (one, org-scoped rows) — organisations, licences, node
status, dagtotalen, Z-rapporten, BTW-bevestigingen, onze eigen medewerkers-
accounts. Dit is alles wat het dashboard nodig heeft: een vloot van 200 winkels
is megabytes per jaar, en geconsolideerd rapporteren is één gewone query.

**Versleuteld archief per winkel** (objectopslag, geen database) — de nachtelijke
versleutelde dump van het knooppunt, geüpload wanneer internet dat toelaat.
Goedkoop, nooit te migreren, en voor ons onleesbaar — dat is een eigenschap, geen
beperking.

Een database per klant was de juiste keuze toen onze cloud alles bevatte. Nu is
het de verkeerde: 200 organisaties zouden 200 migraties per release betekenen,
leesbare kopieën van de klantgegevens van elke winkel vereisen (waarmee de keuze
dat persoonsgegevens lokaal blijven wordt teruggedraaid), en rapporteren over
vestigingen heen zou een uitwaaiering worden in plaats van een `WHERE`.
Row-level security op één beheerdatabase geeft dezelfde isolatie zonder die berg
schema's.

*Het aandachtspunt:* ligt de archiefsleutel alleen bij de winkel en raken zij die
kwijt, dan is de back-up waardeloos en krijgen wij de schuld. Houden wij hem, dan
verdampt "wij kunnen uw gegevens niet zien". Praktische middenweg — versleutel per
winkel, bewaar de sleutel in het beheerknooppunt **los van de archiefopslag**, log
elk gebruik, en zet het in de verwerkersovereenkomst.

---

## 21.2 De twee grenzen die tellen

**Offlinegrens — wat een verkoop werkelijk raakt**

<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three tills on the shop LAN connect to a local Docker server; internet is optional and used only for activation, licence renewal, sync and BTW filing" style="max-width:680px;width:100%;height:auto;font-family:sans-serif">
  <rect x="14" y="14" width="360" height="228" rx="12" fill="#f7f9fc" stroke="#293371" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="30" y="36" font-size="12" font-weight="700" fill="#293371">SHOP LAN — no internet required</text>
  <rect x="34" y="52" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="77" text-anchor="middle" font-size="12" fill="#111827">🖥 Till 1</text>
  <rect x="34" y="102" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="127" text-anchor="middle" font-size="12" fill="#111827">🖥 Till 2</text>
  <rect x="34" y="152" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="177" text-anchor="middle" font-size="12" fill="#111827">📱 Till 3</text>
  <line x1="130" y1="72" x2="212" y2="118" stroke="#293371" stroke-width="2"/>
  <line x1="130" y1="122" x2="212" y2="124" stroke="#293371" stroke-width="2"/>
  <line x1="130" y1="172" x2="212" y2="130" stroke="#293371" stroke-width="2"/>
  <rect x="212" y="94" width="146" height="62" rx="10" fill="#293371"/>
  <text x="285" y="118" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="285" y="136" text-anchor="middle" font-size="10.5" fill="#c9d2ee">any Windows PC + Docker</text>
  <rect x="34" y="204" width="324" height="26" rx="6" fill="#e9f7ef"/>
  <text x="196" y="222" text-anchor="middle" font-size="12" fill="#1d7a46">✅ sale · receipt · drawer · Z-report — all local</text>
  <line x1="374" y1="125" x2="424" y2="125" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="4 4"/>
  <text x="399" y="116" text-anchor="middle" font-size="10" fill="#6b7280">optional</text>
  <rect x="424" y="30" width="240" height="190" rx="12" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.8"/>
  <text x="544" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="#6b7280">☁️ INTERNET — when it exists</text>
  <text x="440" y="80" font-size="11.5" fill="#111827">• activation ·········· once, a few kB</text>
  <text x="440" y="104" font-size="11.5" fill="#111827">• licence renewal ····· rarely, a few kB</text>
  <text x="440" y="128" font-size="11.5" fill="#111827">• sync upward ········· 50–200 kB/day</text>
  <text x="440" y="152" font-size="11.5" fill="#111827">• BTW filing ·········· monthly</text>
  <text x="440" y="176" font-size="11.5" fill="#111827">• encrypted backup ···· nightly, queues</text>
  <rect x="438" y="188" width="212" height="24" rx="6" fill="#fdf1e7"/>
  <text x="544" y="205" text-anchor="middle" font-size="11" fill="#b35400">none of these blocks a sale</text>
</svg>

**Opslaggrens — wat onze cloud werkelijk bewaart**

<svg viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The shop node is the system of record; rollups go to one control database and encrypted archives go to object storage" style="max-width:680px;width:100%;height:auto;font-family:sans-serif">
  <rect x="14" y="66" width="164" height="78" rx="10" fill="#293371"/>
  <text x="96" y="94" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="96" y="112" text-anchor="middle" font-size="10.5" fill="#c9d2ee">SYSTEM OF RECORD</text>
  <text x="96" y="130" text-anchor="middle" font-size="10.5" fill="#c9d2ee">every sale, every line</text>
  <line x1="178" y1="92" x2="286" y2="60" stroke="#293371" stroke-width="2.5"/>
  <polygon points="286,60 275,59 279,69" fill="#293371"/>
  <text x="196" y="72" font-size="10.5" font-weight="600" fill="#293371">rollups</text>
  <line x1="178" y1="120" x2="286" y2="152" stroke="#1d7a46" stroke-width="2.5"/>
  <polygon points="286,152 275,143 279,153" fill="#1d7a46"/>
  <text x="192" y="147" font-size="10.5" font-weight="600" fill="#1d7a46">encrypted dump</text>
  <rect x="290" y="14" width="216" height="92" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="398" y="36" text-anchor="middle" font-size="12.5" font-weight="700" fill="#111827">Control database — ONE</text>
  <text x="304" y="56" font-size="11" fill="#111827">organisations · licences · nodes</text>
  <text x="304" y="74" font-size="11" fill="#111827">daily_rollups · z_reports</text>
  <text x="304" y="92" font-size="11" fill="#111827">btw_receipts · control_users</text>
  <rect x="290" y="118" width="216" height="80" rx="10" fill="#ffffff" stroke="#1d7a46" stroke-width="2.5"/>
  <text x="398" y="140" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0e1a14">Object storage</text>
  <text x="304" y="160" font-size="11" fill="#0e1a14">one encrypted archive per shop</text>
  <text x="304" y="178" font-size="11" fill="#0e1a14">never migrated · we cannot read it</text>
  <rect x="522" y="30" width="144" height="60" rx="8" fill="#eef1f9"/>
  <text x="594" y="52" text-anchor="middle" font-size="11" fill="#293371">megabytes a year</text>
  <text x="594" y="70" text-anchor="middle" font-size="11" fill="#293371">for 200 shops</text>
  <rect x="522" y="128" width="144" height="60" rx="8" fill="#e9f7ef"/>
  <text x="594" y="150" text-anchor="middle" font-size="11" fill="#1d7a46">disaster recovery</text>
  <text x="594" y="168" text-anchor="middle" font-size="11" fill="#1d7a46">key escrowed apart</text>
</svg>

---

## 21.3 Elke functie, en waar die heen gaat

**220 gecatalogiseerde functies** — elke rij uit de functiecatalogus, inclusief de
13 overkoepelende die bij geen enkel gebied horen. De aantallen zijn waar het om
gaat:

| Bestemming | Aantal | Betekenis |
|---|---|---|
| 🏪 **Shop** | **97** | Verhuist schoon naar het knooppunt |
| ⚠️ **Splits** | **70** | Bestaat in twee knooppunten — **hier raakt gedrag verloren** |
| ☁️ **Control** | **23** | Blijft in onze cloud |
| ◆ **All three** | **18** | Elk knooppunt heeft een eigen exemplaar nodig |
| 🏛 **Tax** | **12** | Richting Belastingdienst; verhuist in één geheel |

**70 is het getal om je zorgen over te maken.** Een functie die naar één
knooppunt verhuist, werkt daarna of werkt zichtbaar niet. Bij een functie die
splitst gaat elke kant ervan uit dat de andere het gedrag heeft behouden, en
niemand merkt het een maand lang.

Het zwaarst getroffen gebied is de BTW-aangifte: 12 van de 29 functies splitsen,
en dat is precies de plek waar fout zitten geen bugmelding is maar een
nalevingsbevinding.

Statuskolom: ✅ opgeleverd · 🟡 gedeeltelijk · 🔲 nog niet begonnen.

De kolommen **ID** en **Functie** staan bewust in het Engels: ze zijn de sleutel
naar de functiecatalogus en de code, en vertalen zou die verwijzing breken.

### Kassa — kassa & verkoop  ·  43 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `POS-01` | Auto-route to single assigned store (skip picker) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-02` | Open register with cash float | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-03` | Auto-select single register on open | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-04` | Multi-cashier concurrent selling on different registers | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-05` | Register session close (per-shift) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-06` | Manager re-opens closed register for next shift | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-07` | Add to cart by tap / barcode / search | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-08` | Edit line price / qty / BTW / discount mid-sale | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-09` | Item-level discount (% or fixed SRD) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-10` | Sale-level discount (% or fixed SRD) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-11` | Cash payment + numpad + change calc | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-12` | Card/PIN payment | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-12a` | Card payment reconciliation fields (bank / approval / last-4 / terminal ref) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13` | Mixed payment (cash + card) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13a` | Mixed-payment reconciliation panel (collapsible, when card portion > 0) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13b` | bank_transfer payment method (B2B / government invoiced sales) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13c` | mobile_transfer payment method (DSB Mobiel, Hakrinbank Online, etc.) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13d` | foreign_cash payment method (USD/EUR with locked daily rate) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13e` | Pending-payments queue + OA confirmation flow (with audit log) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13f` | QR-wallet payments (Mopé / Uni5Pay+) — POS step + instant till-confirmation +… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-13g` | QR webhook endpoint stub (HMAC-ready, feature-flagged off) | 🟡 | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-14` | ESC/POS thermal receipt print | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-15` | Cash drawer pulse on cash sale | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-15a` | Manual cash in/out (pay-in / pay-out) during shift → adjusts Z-Report expecte… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-16` | PDF receipt download | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-17` | Email receipt (bilingual HTML) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-17a` | Receipt via WhatsApp — wa.me deep link with a compact text receipt (items ≤15… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-18` | Hold bill / restore later | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-19` | Void sale (manager approval) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-20` | Refund sale (partial or full) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-20a` | Return without original sale (blind return) — manager-gated, BTW extracted, s… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-21` | On-the-fly customer add (name / phone / email) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-22` | Today's sales total + count on POS toolbar | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-23` | Language toggle (NL ↔ EN) instant | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-24` | On-screen keyboard toggle (touchscreen) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-25` | POS auto-launch on system boot | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-26` | Close + Restart buttons (manager-gated) | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-27` | Settings persist per-device | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-28` | Daily USD→SRD rate lock screen | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-29` | Manual rate override | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-30` | Morning recovery — "Yesterday was never closed" gate: stale previous-day sess… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-31` | Closing-time nudge — per-store closing_time: amber POS strip past closing, on… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |
| `POS-32` | Opt-in overnight auto-close — per-store auto_close_enabled+auto_close_time: f… | ✅ | 🏪 Shop | Verkooppad. Verlaat het knooppunt nooit. |

### Assortiment & voorraad  ·  23 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `CAT-01` | Product CRUD (centralised by default) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-02` | Category CRUD (icon + sort_order + i18n) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-03` | Per-product BTW rate + exempt flag | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-04` | Per-store price override | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-05` | Bulk import (CSV) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-06` | Bulk import (Excel/XLSX) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-07` | Import template download | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-08` | 📡 Push catalogue to POS (WebSocket broadcast) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-09` | Product image upload (JPEG/PNG/WebP, 2 MB max) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-10` | Per-store stock via product_stocks table | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-11` | Stock movement ledger (append-only, decremented in the sale transaction) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-11b` | Oversell policy per org (block_oversell, default OFF = allow + track negative) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-12` | Stock-history endpoint per product | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-13` | Low-stock threshold (low_stock_threshold per product) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-14` | Low-stock alert badge on dashboard | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-15` | Low-stock badge on POS product grid | 🟡 | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-16` | Discount rules (product / category / cart) | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-17` | Barcode scanner — USB/Bluetooth HID (keyboard wedge). Enter-lookup accepts nu… | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-18` | Barcode scanner — camera (Quagga2) on the dashboard product form. Requires a … | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-18a` | Barcode scanner — camera on the POS (📷 next to search): same reader set, acce… | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-19` | Product table — click-to-sort columns (name/SKU/category/price/cost/BTW/stock… | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-19` | Bulk barcode label printing — platform-routed print: Android → native PrintMa… | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |
| `CAT-20` | Weighed-goods / scale barcodes (embedded price or weight EAN-13) — configurab… | ✅ | 🏪 Shop | Assortiment is lokaal; de push van het hoofdkantoor komt via synchronisatie. |

### Instellingen & apparaat  ·  24 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `SET-01` | Printer config UI (network TCP / USB / Android PrintManager) + paper width 80… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-01a` | Thermal receipts encode CP858 (ESC t 19) — é/ë/ó/ñ print correctly on ESC/POS… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-02` | Org-configurable payment pick-lists: wallets / card banks / transfer banks / … | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-02` | Cash drawer pin config (Pin 2 / Pin 5) | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-03` | Hardware test buttons — test receipt (real buildReceiptBytes→printEscPos sale… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-04` | Date format selector (6 options, NL default DD-MM-YYYY) | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-05` | Default BTW rate / category / customer | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-06` | Barcode symbology default (EAN-13 / Code 128 / UPC-A) | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-07` | Site name customisation (POS top bar) | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-08` | Vendor contact (Josbin name/email/phone) on all "contact support" surfaces | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-10` | POS installer download from the store's OWN dashboard (GET /installer metadat… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `HW-x` | Printer bridge — Windows app shares its USB receipt printer on TCP 9100 ("📡 S… | ✅ | 🏪 Shop | Printer, kassalade, scanner — fysiek lokaal. |
| `REG-x` | Self-service shift handover (org policy, default off) — with it on, the next … | ✅ | 🏪 Shop | De levensloop van de kassa is lokaal. |
| `SALE-13` | Sale-level BTW exemption (vrijstelling) — govt/diplomatic/export buyers pay e… | ✅ | 🏪 Shop | Verkooppad. |
| `SET-12` | Native Android POS app (Capacitor 8, minSdk 24) for Android till terminals (P… | 🟡 | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-11` | Server-address panel on the POS-app screen — shows the exact address a till m… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-09` | Role-aware sectioned dashboard navigation (industry-standard SaaS admin layou… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-10` | Runtime-configurable server address — josbin_server_url localStorage override… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-11` | Sranantongo POS UI (draft) — third language srn, 390 keys, fallback srn→nl→en… | 🟡 | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-12` | Per-store end-of-day settings — closing_time, auto_close_enabled, auto_close_… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-13` | Night / Day screen theme (per till, not per user — a property of where the te… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-14` | User menu on the POS top bar — tap your name for role, store, language (NL/EN… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `SET-15` | Drawn product glyphs — 15 category illustrations replace the single 📦 on tile… | ✅ | 🏪 Shop | Apparaatinstellingen lokaal; organisatiebeleid in Beheer. |
| `HW-y` | **Direct USB printing on Android** (USB Host API, native plugin) | ✅ | 🏪 Shop | Kassahardware. Verlaat het knooppunt nooit. |

### Rapporten  ·  16 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `REP-01` | Daily sales report (per store) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-02` | Monthly sales report | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-03` | Custom date-range report | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-04` | Top products by revenue | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-05` | X-Report (mid-day snapshot, no close) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-06` | Z-Report (end-of-day close + cash recon) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-07` | Z-Report 7-day history | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-08` | Z-Report submit to HQ (manual force-sync) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-09` | BTW report (per-store, Belastingdienst format) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-10` | BTW report (consolidated cross-store) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-11` | Rekenkamer audit export (signed PDF + CSV) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-12` | Report PDF export (daily / monthly / custom, store-level) — was 500-broken si… | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-13` | Cross-store consolidated dashboard (live SRD totals via WebSocket) | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-14` | Custom product report builder | 🟡 | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-15` | Payment-method × bank/provider breakdown on daily / monthly / custom reports | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |
| `REP-16` | Platform Overview panel for Super Admin (cross-tenant KPIs, licence health bu… | ✅ | ⚠️ Splits | Eigen vestiging / geconsolideerd / aangiften — drie plekken. |

### BTW-aangiften aan de Belastingdienst  ·  29 functies

Het meest gesplitste gebied van het product, en de reden dat het
belastingknooppunt bestaat. Zestien van de negenentwintig verhuizen in één
geheel — twaalf worden in tweeën gedeeld, en één heeft in elk knooppunt een
eigen exemplaar nodig.

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `BTW-FILING-01` | `tax_inspector` role — cross-organisation, read-only, BTW-only | ✅ | 🏛 Tax | De rol heeft geen betekenis in een winkel of in beheer. Ze bestaat in één knooppunt. |
| `BTW-FILING-02` | Mandatory 2FA for tax_inspector (government account) | ✅ | 🏛 Tax | Het beleid reist mee met de rol, dus naar het belastingknooppunt. |
| `BTW-FILING-03` | Daily BTW submission | ✅ | ⚠️ **Splits** | Winkel rekent en ondertekent; belasting ontvangt. Twee helften, twee knooppunten. |
| `BTW-FILING-04` | Monthly BTW submission (formal filing) | ✅ | ⚠️ **Splits** | Dezelfde verbinding als bij dagelijks. Alleen de periode verschilt. |
| `BTW-FILING-05` | Preview totals before filing (dry-run) | ✅ | 🏪 Shop | Leest de eigen verkopen van de winkel. Gaat nooit over een verbinding. |
| `BTW-FILING-06` | Snapshot totals at filing time (never recomputed) | ✅ | 🏪 Shop | De momentopname maakt een aangifte verdedigbaar. Die wordt aan winkelzijde genomen. |
| `BTW-FILING-07` | Sale-ID traceability per filing (jsonb array) | ✅ | 🏪 Shop | Verkoop-ID’s zijn winkellokaal. Het belastingknooppunt krijgt totalen per tarief, geen regels — zie 19.5. |
| `BTW-FILING-08` | Auto-generated filing reference (BTW-YYYY-MM-ORG-DAY-NNN) | ✅ | ⚠️ **Splits** | De winkel maakt hem aan; belasting moet hem als sleutel behandelen. Beide kanten moeten het voor altijd over het formaat eens zijn. |
| `BTW-FILING-09` | Idempotency: one filing per (org, period_type, range) | ✅ | ⚠️ **Splits** | Vandaag handhaaft één database dit. Na de splitsing moeten **beide** kanten dat doen — een nieuwe poging na een time-out is het normale geval, niet de uitzondering. |
| `BTW-FILING-10` | Tax inspector accept / dispute workflow | ✅ | ⚠️ **Splits** | Het besluit valt in het belastingknooppunt; de winkel moet de uitkomst vernemen over een verbinding die dagen uit kan liggen. |
| `BTW-FILING-11` | Hash chain (tamper-evident, continues audit trail pattern) | ✅ | ⚠️ **Splits** | De keten begint aan winkelzijde en moet aan belastingzijde kloppen. Zijn de twee het ooit oneens over wát gehasht wordt, dan is de manipulatiedetectie schijn. |
| `BTW-FILING-12` | Cross-org list for inspector + SA; own-org for OA; **own-store for SM** | ✅ | ⚠️ **Splits** | Eén query met drie bereiken wordt drie queries in drie knooppunten. De winkel heeft altijd maar één organisatie, dus twee van de drie bereiken verdwijnen daar. |
| `BTW-FILING-13` | Audit log entries for every transition (`btw.submitted/accepted/disputed`) | ✅ | ◆ All three | Elk knooppunt logt de overgangen die het zag. Geen van de logs is alleen volledig, en dat hoort zo. |
| `BTW-FILING-14` | Resubmission via `superseded` status (recompute totals, audit-logged) | ✅ | ⚠️ **Splits** | De winkel vervangt, belasting moet de vervanging aannemen — en niet twee keer. |
| `BTW-FILING-15a` | Tax Inspector dashboard — KPI landing | ✅ | 🏛 Tax | Richting inspecteur. Verhuist in één geheel. |
| `BTW-FILING-15b` | Submission detail view — per-store / per-source-POS / per-payment-method / per-rate | ✅ | 🏛 Tax | Leest alleen wat de aangifte meebracht. Er hoeft niets extra over te gaan. |
| `BTW-FILING-15c` | Enhanced filters — org dropdown, source POS, search by reference | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-15d` | Click-row → detail and click-tile → filtered-list navigation | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-15e` | Source POS attribution (Josbin native vs Layer-3 third-party) | ✅ | ⚠️ **Splits** | De herkomst wordt bij binnenkomst gestempeld — en volgens D5 komt aanlevering door derden binnen in **beheer**, niet in de winkel. Beheer moet dus stempelen wat belasting toont. |
| `BTW-FILING-15` | Belastingdienst PDF export of accepted filings | 🔲 | 🏛 Tax | Nog niet begonnen. Verlies dit niet in de verhuizing — een inspecteursexport is een wettelijke vereiste, geen extraatje. |
| `BTW-FILING-16` | Late-filing oversight — cadence, overdue nudge, Remind, escalation | ✅ | ⚠️ **Splits** | De inspecteur stelt de frequentie in en escaleert; de **winkel** moet gepord worden. Dat vraagt een verbinding die er tussen die twee knooppunten nu niet is. |
| `BTW-FILING-17` | Inspector **bulk-accept** (per-row authorised, partial-failure reporting) | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-18` | Expanded list filters — year, min/max amount, sort | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-19` | **CSV export** of the filtered submission list | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-20` | **Weekly** period type alongside daily / monthly | ✅ | ⚠️ **Splits** | Een periodebegrip dat over een geversioneerde verbinding gedeeld wordt. Een vierde periode later toevoegen betekent een N−2-migratie aan beide kanten. |
| `BTW-FILING-21` | **In-app notification bell** — filing, resubmit, dispute | ✅ | ⚠️ **Splits** | De gebeurtenissen ontstaan in het ene knooppunt en worden in het andere gelezen. Vandaag is het één tabel. |
| `BTW-FILING-22` | Org filter populated for cross-org roles | ✅ | 🏛 Tax | Richting inspecteur. |
| `BTW-FILING-23` | **Store Manager filing is store-scoped** | ✅ | 🏪 Shop | In een knooppunt per vestiging (D1) is dit geen bereikregel meer, maar het enige wat het knooppunt kán. |
| `BTW-FILING-24` | Official **Belastingdienst government portal** — gov-branded login, flag identity | ✅ | 🏛 Tax | Stond gecatalogiseerd als een tweede BTW-FILING-16; omgenummerd. Verhuist in één geheel. |

### Authenticatie & sessie  ·  11 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `AUTH-01` | Password login + Sanctum token | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-02` | TOTP 2FA (Google Authenticator) | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-03` | Per-role 2FA policy (SA configures which roles must use 2FA) | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-04` | Recovery codes (8, single-use) | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-05` | Geo-alert for government login from outside Suriname | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-06` | Single-device enforcement for govt accounts | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-07` | Token rotation (/auth/refresh) | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-08` | Logout / logout-all-devices | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-09` | Rate limiting + progressive lockout | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-10` | Passkey login (WebAuthn) — register/list/remove in My Account, usernameless p… | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |
| `AUTH-11` | Forced re-login on role change | ✅ | ⚠️ Splits | Drie onafhankelijke gebruikerstabellen, één per knooppunt. |

### Organisatie- & gebruikersbeheer  ·  17 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `ORG-01` | Create / edit / deactivate organisation | ✅ | ☁️ Control | Het organisatierecord hoort bij de licentie. |
| `ORG-02` | Stores screen — OA manages stores; Store Manager no longer sees the Stores me… | ✅ | ☁️ Control | Het organisatierecord hoort bij de licentie. |
| `ORG-03` | Create / edit / deactivate store (under org) | ✅ | ☁️ Control | Het organisatierecord hoort bij de licentie. |
| `ORG-04` | Licence-gated store creation (LICENSE_REQUIRED / EXPIRED / LIMIT_REACHED) | ✅ | ☁️ Control | Het organisatierecord hoort bij de licentie. |
| `ORG-05` | Per-store receipt template (logo + header + footer) | ✅ | ☁️ Control | Het organisatierecord hoort bij de licentie. |
| `USER-01` | Create / edit / deactivate user with role | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-02` | Strict 1:1 user-to-store pin (cashier + store_manager) | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-03` | Org-scoped roles ignore store_id | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-04` | Welcome email on user create | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-05` | Reset 2FA on a user | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-06` | View licence info on user row | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-07` | My Account — Profile + password (every role) | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-08` | My Account — Performance + Shifts tabs (ring-up roles only) | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-09` | My Account — Activity log (own logins, own audit trail) | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `USER-10` | My Account — Active sessions + revoke (with audit log) | ✅ | ⚠️ Splits | De winkel bezit haar eigen gebruikers; Beheer bezit de onze. |
| `CUST-01` | Customer detail view — profile + aggregates (spend / visits / last visit) + p… | ✅ | 🏪 Shop | WBP-S-gegevens. Gaan nooit omhoog. |
| `CUST-02` | Customer statement export — date range (default 90 d), PDF + CSV, netted tota… | ✅ | 🏪 Shop | WBP-S-gegevens. Gaan nooit omhoog. |

### Licentiebeheer  ·  10 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `LIC-01` | Issue licence (in-dashboard, Path B) | ✅ | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-02` | List / edit / revoke licence | ✅ | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-03` | Licence renewal request workflow | ✅ | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-04` | Renewal status banners (warning_30 / 14 / grace / soft_lock / hard_lock) | ✅ | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-05` | Hardware fingerprint binding (MAC + CPU + UUID) | 🟡 | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-06` | Daily validation against licence server (24h + 72h offline grace) | 🔲 | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-07` | Soft-lock blocks new sales | 🟡 | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-08` | Hard-lock blocks login | 🔲 | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-09` | Licence certificate generator (printable / email) | ✅ | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |
| `LIC-10` | Separate licence server app | 🔲 | ⚠️ Splits | Beheer GEEFT UIT en ondertekent; Winkel CONTROLEERT offline. |

### Synchronisatie & offline (5-laags terugval)  ·  8 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `SYNC-01` | Layer 1 — Real-time sync (every sale → cloud within seconds) | 🟡 | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-02` | Layer 2 — Auto retry (1m / 5m / 15m / 30m schedule) | 🟡 | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-03` | Layer 3 — Z-Report forced retry / submit-to-HQ | ✅ | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-04` | Layer 4 — USB encrypted export (.josbin_pos file, AES-256+HMAC) | ✅ | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-05` | Layer 5 — Catch-up sync on internet restore | 🟡 | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-06` | Mobile data dongle fallback (Digicel/Telesur 4G) | 🔲 | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-07` | Offline sale buffering (POS keeps selling without internet) | ✅ | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |
| `SYNC-08` | Yesterday-sync notice at the register gate — non-blocking "not at HQ yet" str… | ✅ | ⚠️ Splits | Dit IS de verbinding: cliënt in Winkel, server in Beheer. |

### Open integratie-API (laag 3)  ·  10 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `API-01` | API key issuance + rotation | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-02` | POST /v1/sales — single sale push | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-03` | POST /v1/sales/batch — batch upload (idempotent via external_sale_ref) | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-04` | GET /v1/reports/sales — third-party pulls own data | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-05` | Outbound webhooks (sale.created, shift.closed, refund.issued) | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-06` | HMAC webhook signing (X-JosbinPOS-Signature: sha256=…) | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-07` | Webhook secret rotation | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-08` | OpenAPI 3.0 spec auto-generated | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-09` | Per-API-key rate limiting (1000/min) | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |
| `API-10` | Sandbox environment (separate stack, X-Josbin-Environment: sandbox) | ✅ | ☁️ Control | Kassa van derden levert hier aan — zie §21.4. |

### Audit & naleving  ·  9 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `AUD-01` | Append-only audit log (DB-level no-delete) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-02` | Audit log viewer (filters, search, JSON diff) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-03` | SHA-256 hash chain (tamper-evidence) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-04` | Successful-login audit events | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-05` | Store-assignment change audit | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-06` | Customer field-level encryption (WBP-S) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-07` | Customer search by HMAC-SHA256 (no partial search by design) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-08` | Rekenkamer audit export (full transaction trail, signed PDF) | ✅ | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |
| `AUD-09` | Verwerkersovereenkomst PDF template (NL) | 🔲 | ◆ All three | Elk knooppunt houdt een eigen alleen-toevoegen-log. |

### AI-laag  ·  7 functies

| ID | Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|---|
| `AI-01` | Smart product search (pgvector semantic) | 🟡 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-02` | Fraud anomaly detection (queued post-sale) | 🟡 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-03` | Weekly AI sales summary | 🔲 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-04` | Auto product categorisation + BTW suggestion on add | 🔲 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-05` | Natural-language reports (Phase 2) | 🔲 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-06` | Stock reorder prediction (Phase 2) | 🔲 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |
| `AI-07` | Invoice OCR (Phase 2) | 🔲 | ☁️ Control | Heeft internet nodig; kan niet in een offlineknooppunt wonen. |

---

### Overkoepelend  ·  13 functies

Geen enkel gebied is hier eigenaar van, en juist daarom vallen ze bij een grote
verhuizing weg: er gaat niets zichtbaar stuk als ze verdwijnen.

| Functie | Nu | Gaat naar | Opmerking |
|---|---|---|---|
| Dutch ↔ English UI parity | ✅ | ◆ All three | Nu drie interfaces. Een tekst die je in één knooppunt toevoegt, staat niet in de andere. |
| SRD currency throughout | ✅ | ◆ All three | Woont in `domain/Money`. Eén keer schrijven, anders lopen bonnen en aangiften een cent uiteen. |
| AST timezone (America/Paramaribo) | ✅ | ◆ All three | Elk datumbereik in alle drie de knooppunten. Een UTC-daggrens dient stilletjes een dag BTW verkeerd in. |
| BTW (discount-then-tax) order | ✅ | ◆ All three | `domain/Btw`, 56 tests, **één exemplaar**. Dit is de belangrijkste regel van de hele opsplitsing. |
| Tenant isolation (cross-org leak prevention) | ✅ | ⚠️ **Splits** | Draait om: een winkelknooppunt heeft precies één klant, dus de huidige afscherming is daar dood gewicht en in beheer en belasting dragend. Dood gewicht is gevaarlijk — niemand test het, en dan krijgt een keten een tweede organisatie. |
| Idempotency keys for external API | ✅ | ☁️ Control | Volgt laag 3 naar beheer (D5). |
| Append-only audit log | ✅ | ◆ All three | Drie ketens. Geen ervan is het hele verhaal, en de Rekenkamer-export moet dat vermelden. |
| 5-layer offline fallback | ✅ | ⚠️ **Splits** | Cliënt in de winkel, server in beheer. Dit **is** de verbinding. |
| IonCube source protection | 🔲 | ◆ All three | Drie geëncodeerde builds in plaats van één — en de winkelbuild is degene die echt telt, want dat is de enige op iemand anders zijn schijf. |
| Electron code signing (Windows) | 🔲 | 🏪 Shop | Alleen de winkel levert een desktopprogramma. |
| OWASP Top 10 audit | 🔲 | ◆ All three | Drie aanvalsoppervlakken om te auditen, niet één. Omvang en kosten verdrievoudigen; zeg dat vóór je een prijs geeft. |
| WBP-S compliance certification | 🔲 | ◆ All three | En D3 voegt een verwerkersrelatie toe die er nu niet is. De documentatie is geen kopie-plak over drie knooppunten. |
| Report-endpoint caching (`ReportCache`) | ✅ | ⚠️ **Splits** | Cachesleutels hebben bereik platform / organisatie / organisatie+vestiging. Het platformbereik heeft in een winkelknooppunt geen betekenis — een sleutel die stil botst is een manager die de cijfers van een andere vestiging leest. |

---

## 21.4 Wat GEBOUWD moet worden — zonder dit is de opsplitsing niet klaar

Niets hiervan bestaat vandaag. De migratie is niet klaar zolang dat zo is.

| # | Te bouwen | Waarom | Knooppunt |
|---|---|---|---|
| N1 | Licentie **ondertekenen** — sleutelpaar, tokens aanmaken, intrekkingslijst | Vervangt de altijd-online controle | ☁️ Control |
| N2 | Licentie **offline controleren** — publieke sleutel ingebakken, signatuur + einddatum bij opstarten | De veiligheid van het hele model | 🏪 Shop |
| N3 | Hardwarevingerafdruk vastleggen en binden | Voorkomt het klonen van een VM | 🏪 Shop |
| N4 | Monotone vastlegging van servertijd | Voorkomt klok terugzetten om de einddatum te ontwijken | 🏪 Shop |
| N5 | **Activatieflow** — sleutel → controleren → eerste beheerder aanmaken | Geen centrale gebruikersadministratie nodig | Beide |
| N6 | Afschalen naar alleen-lezen in plaats van harde blokkade | D2: sluit een betalende klant nooit buiten | 🏪 Shop |
| N7 | Totalen synchroniseren — opbouwen, wachtrij, herhalen, versiestempel | Voedt het hele beheerdashboard | 🏪 Shop |
| N8 | Totalen innemen, met acceptatie van N−2 payloadversies | De vloot omvat permanent meerdere versies | ☁️ Control |
| N9 | Nachtelijk versleuteld archief + uploaden zodra er internet is | Het herstelverhaal uit D6 | 🏪 Shop |
| N10 | Archiefsleutel in bewaring, los van de archieven, elk gebruik gelogd | Maakt de belofte in de verwerkersovereenkomst waar | ☁️ Control |
| N11 | Statusregister van knooppunten — versie, laatst gezien, licentiestatus | Je kunt geen vloot ondersteunen die je niet ziet | ☁️ Control |
| N12 | **Aangiftesignatuur** aan winkelzijde | D4: aantoonbaar van hen, ongewijzigd | 🏪 Shop |
| N13 | Opslag van aangiftebevestigingen — referentie en tijdstip, geen bedragen | D4: blijf buiten de bewijsketen | ☁️ Control |
| N14 | Knooppuntprofiel — routes, migraties en modules per knooppunt | Maakt drie builds uit één repository | Alle |
| N15 | Drie buildtargets + artefactcontrole dat Winkel geen Beheer-code bevat | De poort van stap 6 in hoofdstuk 20 | Build |
| N16 | Een testpad dat daadwerkelijk draait | Zie §21.6 — de poort hangt hiervan af | Build |

## 21.5 Wat we bewust overslaan

- **`organisation_id` / `store_id` weghalen.** D1. De opbrengst is netheid; de
  prijs is de vrieslijst.
- **Een database per organisatie.** D6. Het goede antwoord op de oude vraag, het
  verkeerde op deze.
- **Laag 3 die *in* het assortiment of de voorraad van een winkel schrijft.**
  Alleen verkopen aanleveren wordt ondersteund. Opnieuw bekijken als iemand er
  echt om vraagt.
- **Een donker thema voor het dashboard.** Staat los van de opsplitsing, en het
  donkere palet kwam niet door de validatie. Hoort niet in dit werk.
- **Opnieuw aan de BTW-engine, de bonbytes, de geldprecisie, de AST-verwerking of
  de onveranderlijkheid van het auditlog zitten.** Hoofdstuk 20 §20.7. Ze
  verhuizen; ze veranderen niet.

## 21.6 Bekende blokkade vóór stap 1

De poort van stap 1 in hoofdstuk 20 is *"de volledige suite groen, geen test
aangepast"*. **Er is nu nergens waar dat aangetoond kan worden.** De suite start
lokaal niet — de testconfiguratie wijst de databasehost naar de containernaam, en
de debugvoorziening die alleen voor ontwikkeling is faalt buiten de
applicatieomgeving — en de productiecontainer heeft geen testrunner, omdat een
productie-installatie de ontwikkelafhankelijkheden weglaat.

Los dat eerst op (N16). Een herstructurering waarvan het enige vangnet een
testrun is die niemand kan uitvoeren, is geen veilige herstructurering.
