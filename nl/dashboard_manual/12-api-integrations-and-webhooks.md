# Hoofdstuk 12 — API-integraties & Webhooks

**Voor wie:** Organisatiebeheerder (of Super Admin, namens een klant) die een derde-partijsysteem op Josbin POS wil aansluiten. Typische voorbeelden:

- Een externe POS — Lightspeed, Square, een zelfgebouwde kassa — die al op de winkelvloer draait en alleen zijn verkopen in Josbin POS moet pushen voor uniforme BTW-rapportage
- Een webshop die dagelijkse online orders pusht naar het verkoopfeed van een specifieke vestiging
- Een boekhoudtool die dagtotalen ophaalt voor boekhoudsoftware
- Een voorraad- of leveranciersportaal dat een realtime ping nodig heeft elke keer dat een verkoop wordt geboekt

**Wanneer u het nodig heeft:** elke keer dat data *naar* of *uit* Josbin POS moet stromen voor een ander systeem dan de standaard POS-terminal.

**Wat het voorkomt:** dat de manager verkopen handmatig moet overtypen vanuit een tweede systeem, einde-dag-reconciliaties die niet kloppen omdat twee systemen de verkopen van dezelfde winkel apart hebben geteld, en gemiste BTW-regels omdat er iets "buiten" Josbin POS gebeurde.

![12 api-sleutels lijst](screenshots/12-api-keys-list.png)
---

## 12.1 Wat een "integratie" werkelijk is

Een **API-integratie** is een credentialpaar — een lang levende API-sleutel + een optionele webhook-URL — gekoppeld aan **één vestiging**. Het derde-partijsysteem gebruikt de sleutel om elke aanvraag te authenticeren, en Josbin POS gebruikt de webhook-URL om gebeurtenissen de andere kant op te pushen.

```
┌───────────────────────┐                    ┌─────────────────────────────┐
│  Derde-partijsysteem  │                    │   Josbin POS — back-office  │
│  (hun POS / shop)     │                    │   (Laravel + Postgres)      │
│                       │   X-API-Key: sk_…  │                             │
│                       │ ─────────────────► │   POST /api/v1/sales        │
│                       │ ◄───────────────── │   201 Created               │
│                       │                    │                             │
│  Webhook-ontvanger    │   X-JosbinPOS-      │   sale.created webhook      │
│  (hun endpoint)       │   Signature: sha…  │   (Redis-queued, HMAC-signed)│
│                       │ ◄───────────────── │                             │
└───────────────────────┘                    └─────────────────────────────┘
```

Een paar regels die voortvloeien uit het model:

- **Eén integratie = één vestiging.** Als een klant drie filialen heeft en alle drie via dezelfde API-sleutel wil pushen, heeft hij drie integraties nodig. Dit houdt audittrails duidelijk ("bij welke vestiging hoorde deze verkoop?") en voorkomt dat een sleutellek toegang geeft tot een heel netwerk.
- **Een integratie is eigendom van de organisatie.** Organisatiebeheerder ziet en beheert elke integratie in zijn organisatie. Vestigingsmanager **kan** geen sleutels aanmaken of intrekken (die zijn op hoofdkantoor-niveau — zie de rechtenmatrix in Hoofdstuk 1).
- **De API-sleutel is gehasht in rust.** De plain sleutel wordt **eenmalig** getoond bij aanmaak. Niets — niet het dashboard, niet de database, niet leveranciersondersteuning — kan hem herstellen nadat u die banner sluit. Verloren, dan roteren.
- **Het webhook-geheim is ook roteerbaar.** Het geheim roteren laat de API-sleutel werkend; de sleutel roteren geeft een gloednieuwe sleutel uit.
- **Intrekken is soft.** Een integratie deactiveren (`is_active=false`) is alleen omkeerbaar via directe DB-interventie. Het dashboard behandelt intrekken als definitief — opnieuw aanmaken in plaats van opnieuw inschakelen.

---

## 12.2 Een nieuwe API-sleutel uitgeven

**Pad:** Dashboard → **API-integraties** (linkerzijbalk) → **+ Nieuwe sleutel** (rechtsboven).

De modal vraagt om vier dingen:

| Veld | Verplicht | Notities |
|---|:-:|---|
| **Vestiging ID** | ja | UUID van de vestiging waaraan deze integratie is gekoppeld. Kopieer het uit de URL-balk op de vestigingsdetailpagina. Toekomstige versies voegen een keuzemenu toe — voorlopig is het een plak-in. |
| **POS-systeem naam** | ja | Vrije tekst label — bv. `Lightspeed`, `Square`, `WooCommerce`, `Aangepast`. Getoond in de integratielijst en in het auditlogboek wanneer verkopen via deze sleutel binnenkomen. |
| **Webhook URL** | optioneel | HTTPS-endpoint aan de partnerzijde dat event-POSTs zal ontvangen. Laat leeg om uitgaande webhooks volledig uit te schakelen (de partner kan nog steeds *inbellen* met de API-sleutel). |
| **Webhook-gebeurtenissen** | optioneel | Kies uit `sale.created`, `shift.closed`, `refund.issued`. Alleen aangevinkte gebeurtenissen vuren. Standaard is `sale.created`. |

Tik op **Aanmaken**. De pagina springt naar een **heldergroene succesbanner** bovenaan met:

```
sk_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123
```

Dit is de enige keer dat u de plain sleutel zult zien. **Kopieer hem nu** (één klik op de groene knop **Kopiëren**), en lever hem daarna aan de partner via een beveiligd kanaal — versleutelde e-mail, wachtwoordmanager-share, of een telefoongesprek van één vertrouwd contact naar een ander. Slack en sms zijn *geen* veilige kanalen.

> Het webhook-ondertekengeheim wordt op hetzelfde moment gegenereerd als de sleutel, maar het dashboard toont het niet in de aanmaak-flow — het wordt alleen blootgesteld wanneer u het expliciet roteert vanuit de bewerk-modal (§12.4). De meeste integraties hebben het geheim bij aanmaak niet nodig omdat ze alleen verkopen *insturen*, niet webhooks ontvangen. Als de partner het geheim onmiddellijk nodig heeft, open de modal **Webhook bewerken** van de rij en gebruik **Geheim roteren** om er een te genereren en te tonen.

---

## 12.3 De integratielijst

Het hoofdscherm API-integraties is een tabel met één rij per integratie. Kolommen:

| Kolom | Wat het toont |
|---|---|
| **Vestiging** | Vestigingsnaam + de eerste acht tekens van de integratie-UUID (handig voor logzoekopdrachten). |
| **Systeem** | Het POS-systeemlabel dat u bij aanmaak hebt ingetypt. |
| **Webhook URL** | Eerste 40 tekens van de URL, of `—` als geen webhook is geconfigureerd. |
| **Gebeurtenissen** | Gekleurde pilletjes — groen voor `sale.created`, blauw voor `shift.closed`, oranje voor `refund.issued`. |
| **Laatste ping** | Groene stip "Online" als de partner de API binnen de laatste 10 minuten heeft aangeroepen, amber "Inactief" anders, `—` als nog nooit aangeroepen. |
| **Status** | Groen "Actief" of grijs "Ingetrokken". Ingetrokken sleutels kunnen niet authenticeren. |
| (acties) | **Webhook bewerken** (paars) en **Intrekken** (rood), alleen op actieve rijen. |

Een drie-kaarten statistiekenstrook bovenaan totaliseert: totaal sleutels, actief, en ingetrokken.

![12 api-sleutels lijst](screenshots/12-api-keys-list.png)
---

## 12.4 Webhook-configuratie bewerken & het geheim roteren

Tik op **Webhook bewerken** op een actieve rij.

De modal laat u de POS-systeemnaam, de webhook-URL, en de geabonneerde gebeurtenissen wijzigen. Opslaan vuurt niets — de volgende gebeurtenis die aan de integratie wordt geleverd zal eenvoudigweg de nieuwe configuratie gebruiken.

Onder het formulier zit de sectie **Webhook-handtekeningsleutel**, met een enkele amberkleurige knop **Geheim roteren**.

**Het geheim roteren:**

1. Tik op de knop. Een browser-bevestiging vraagt: *"Het oude geheim stopt onmiddellijk met werken. Doorgaan?"*
2. Bevestigen. Het dashboard toont het nieuwe 64-tekens-hex-geheim in een groen paneel.
3. **Kopieer het.** Plak het in de ontvanger-configuratie van de partner — de env-variabele of secret-manager-waarde die zij gebruiken om binnenkomende Josbin POS-webhook-handtekeningen te verifiëren.
4. Sluit de modal.

Totdat de partner zijn ontvanger bijwerkt, zal elke in-flight of toekomstige webhook handtekeningverificatie aan hun kant falen — zij zullen "invalid signature" 401's loggen en wij zullen leveringsfouten loggen (§12.10). Roteer op een rustig moment en stem het van tevoren af met de partner.

> **API-sleutel vs webhook-geheim — verschillende dingen:**
> - **API-sleutel** authenticeert *inkomende* aanroepen van de partner *naar* Josbin POS. Roteren vereist een gloednieuwe sleutel-uitgifte (intrekken + aanmaken) — er is geen in-place rotatie.
> - **Webhook-geheim** authenticeert *uitgaande* webhooks *van* Josbin POS *naar* de partner. Roteren is in-place via de bovenstaande knop; de API-sleutel blijft werken.

---

## 12.5 Een sleutel intrekken

**Wanneer in te trekken:**

- Partnercontract beëindigd
- Sleutel wordt verdacht van lekkage
- Vervangende sleutel al uitgegeven (rolling rotation)

**Om in te trekken:**

1. API-integraties → vind de rij → rode knop **Intrekken**.
2. Bevestig de prompt.

De statusbadge slaat om naar grijs *Ingetrokken*. Binnen seconden:
- Elke verdere `X-API-Key`-aanvraag met die sleutel krijgt `401 Unauthorized — Invalid or inactive API key.`
- De integratie blijft in de lijst (voor auditdoeleinden) maar verliest zijn actieknoppen.
- Hangende webhook-jobs voor deze integratie doen bij volgende poging stil niets.

Er is **geen undo** in de UI. Om dezelfde partner te herstellen, geeft u een nieuwe integratie uit met een nieuwe sleutel.

---

## 12.6 Laag 3 — de Open Integration API-endpoints

Alle Laag-3-endpoints zitten onder `/api/v1/` en authenticeren met de `X-API-Key`-header. Elk endpoint is gekoppeld aan de vestiging van de integratie — er is geen manier om met dezelfde sleutel data van een andere vestiging op te vragen.

Basis-URL op de back-office van de klant: `http://<back-office-ip>:8080/api/v1/`

| Endpoint | Methode | Wat het doet | Limieten |
|---|---|---|---|
| `/sales` | POST | Pusht een enkele verkoop. BTW wordt server-side opnieuw berekend uit de tarieven die u aanlevert. Idempotent op `sale_ref` — opnieuw posten van dezelfde `sale_ref` retourneert het bestaande record. | 1.000 req/min per sleutel |
| `/sales/batch` | POST | Pusht tot 500 verkopen tegelijk (inhaal na offline venster). Elk item idempotent op `sale_ref`. Mislukkingen worden per item gerapporteerd; de batch faalt nooit als geheel. | 500 verkopen/aanvraag, 1.000 req/min |
| `/reports/sales` | GET | Gepagineerde lijst van afgeronde verkopen voor de vestiging van de integratie. Query-parameters: `date_from`, `date_to` (YYYY-MM-DD, max 31-dagen-venster), `per_page` (10–200). | 31-dagen max bereik |
| `/reports/summary` | GET | Geaggregeerde totalen (aantal, totaal SRD, BTW, kortingen, gem. besteding) plus BTW-uitsplitsing per tarief, voor elk datumbereik. Query-parameters: `date_from`, `date_to`. | — |

De volledige OpenAPI/Swagger-specificatie wordt automatisch gegenereerd en geserveerd op:
- `GET /api/v1/openapi.json` — machine-leesbare spec
- `GET /api/v1/docs` — interactieve Swagger UI (geen API-sleutel vereist; nuttig tijdens het bouwen)

### 12.6.1 Authenticatie & fouten

| Status | Wanneer | Body |
|---|---|---|
| `200` | Succesvolle read, of idempotent duplicaat verkoop | gevraagde data |
| `201` | Verkoop voor het eerst aangemaakt | sale resource |
| `401 Unauthorized` | Ontbrekende of verkeerde `X-API-Key` | `{"error":"Unauthorized","message":"…"}` |
| `403 Forbidden` | Integratie ingetrokken of vestiging-mismatch | `{"error":"Forbidden",…}` |
| `422` | Validatiefout of bedrijfsregelschending (`InvalidRange`, `ServerError`) | `{"error":"…","message":"…","errors":{…}}` |
| `429 TooManyRequests` | Boven 1.000 req/min op deze sleutel | `{"error":"TooManyRequests","message":"Rate limit exceeded: 1,000 requests per minute."}` |

De `last_ping_at` van de integratie wordt bijgewerkt bij elke geauthenticeerde aanroep — dat is wat de "Online / Inactief"-indicator in de dashboardlijst voedt.

### 12.6.2 Sandbox vs productie

Wanneer de back-office draait met de sandbox-vlag ingeschakeld (`josbin_pos.sandbox=true`), draagt elke respons een extra header:

```
X-Josbin-Environment: sandbox
```

Vertel uw partner deze header te controleren in hun CI — het is de enige manier voor hen om "ik hit de test-box" te onderscheiden van "ik hit productie" als zij API-tokens delen tussen omgevingen. Productie-responses zetten de header **niet**.

---

## 12.7 POST /v1/sales — een verkoop indienen

Voorbeeld-aanvraag (de kleinste geldige body):

```json
POST /api/v1/sales
Host: back-office.example.com:8080
X-API-Key: sk_ABCDEF…
Content-Type: application/json

{
  "sale_ref":        "WEBSHOP-2026-0001",
  "occurred_at":     "2026-05-26T14:32:18-03:00",
  "payment_method":  "card",
  "items": [
    {
      "product_name": "Volle Melk 1L",
      "unit_price":   12.50,
      "quantity":     2,
      "btw_rate":     10,
      "btw_exempt":   false,
      "discount_srd": 0
    },
    {
      "product_name": "Brood Wit",
      "unit_price":   6.00,
      "quantity":     1,
      "btw_rate":     10,
      "btw_exempt":   true
    }
  ]
}
```

Veldregels:

| Veld | Regel |
|---|---|
| `sale_ref` | Uw referentie. **Moet uniek zijn per vestiging** — zo werkt idempotentie (zie §12.8). Max 100 tekens. |
| `occurred_at` | ISO 8601-tijdstempel. Gebruik AST (`-03:00`) voor nauwkeurigheid; UTC wordt ook geaccepteerd (het systeem converteert bij lezen). |
| `payment_method` | Eén van `cash`, `card`, `mixed`. |
| `items` | Minimaal één. Geen bovengrens per verkoop, maar zeer grote winkelmandjes (>200 items) moeten worden gesplitst. |
| `items.*.btw_rate` | Decimaal — `10` voor 10%, `0` voor vrijgesteld. Het systeem past het opnieuw toe; u hoeft het BTW-bedrag niet vooraf te berekenen. |
| `items.*.btw_exempt` | Wanneer `true`, wordt BTW geforceerd op nul ongeacht `btw_rate`. Gebruikt voor basisvoedingsmiddelen en medicijnen volgens Belastingdienst-regels. |
| `items.*.discount_srd` | Korting per regel in SRD (niet percentage). Afgetrokken van `unit_price × quantity` voor BTW-extractie. |

Respons bij eerste indiening (HTTP 201):

```json
{
  "id":             "0192e1d4-93c2-7c9a-bd11-fb6e2e2c4a90",
  "sale_ref":       "WEBSHOP-2026-0001",
  "store_id":       "0192c8e1-1c30-7c9a-bd11-fb6e2e2c4a90",
  "occurred_at":    "2026-05-26T14:32:18-03:00",
  "payment_method": "card",
  "subtotal_srd":   "31.00",
  "discount_srd":    "0.00",
  "btw_srd":         "2.27",
  "total_srd":     "31.00",
  "status":        "completed",
  "created_at":    "2026-05-26T17:32:18.456Z"
}
```

Een paar afgeleide gedragingen:

- De verkoop wordt aangemaakt met `source = "api"` en `cashier_id = null`. Het auditlogboek, Z-Rapport en BTW-rapport van het dashboard bevatten allemaal API-gebaseerde verkopen.
- De gelocked `exchange_rate_used` van de dag wordt automatisch aan de verkoop gehecht — nuttig wanneer de partner later moet weten welke USD→SRD-koers van toepassing was.
- Webhook `sale.created` vuurt op de wachtrij voor elke actieve integratie in dezelfde organisatie die zich erop heeft geabonneerd (§12.9). Inclusief de partner die de verkoop *heeft gepost* — nuttig voor het ontvangen van een ack.

---

## 12.8 Idempotentie — het `sale_ref`-mechanisme

Netwerkrealiteit: de partner POST `/v1/sales`, de respons gaat verloren, ze proberen opnieuw, en nu heeft Josbin POS twee kopieën van dezelfde verkoop. Zo wordt omzet dubbel geteld. De oplossing:

1. De partner kiest een stabiele, unieke identificatie voor elke verkoop **in hun eigen systeem** — ordernummer, bonnummer, transactie-UUID, wat dan ook. Ze geven het mee als `sale_ref`.
2. Bij elke POST controleert Josbin POS `external_sale_ref` (de kolom waarin `sale_ref` is opgeslagen). Als een verkoop met die `sale_ref` al bestaat voor deze vestiging, retourneert het het bestaande record met **HTTP 200** in plaats van een nieuwe aan te maken.
3. De partner kan zo agressief opnieuw proberen als hij wil — duplicaten worden stilzwijgend opgevangen.

Voor `/v1/sales/batch` scheidt de respons de tellingen:

```json
{
  "created": 47,
  "skipped":  3,
  "failed":   0,
  "errors":  []
}
```

- `created` — eerste-keer-inserts
- `skipped` — idempotente duplicaten (bestaande `sale_ref`)
- `failed` — per-item validatie- of DB-fouten, met `index` en `sale_ref` in de `errors[]`-array

> **`sale_ref` goed benoemen:** voeg een partnerprefix toe (`WEBSHOP-`, `LIGHTSPEED-`, `POS2-`) zodat u in het auditlogboek kunt grep'en op "waar kwam deze verkoop vandaan" zonder tabellen te hoeven joinen.

---

## 12.9 Uitgaande webhooks — de gebeurtenissen

Wanneer er iets server-side gebeurt (een verkoop wordt geboekt, een dienst sluit, een terugbetaling wordt verricht), pusht Josbin POS een HTTP POST naar elke actieve integratie in dezelfde organisatie waarvan de `webhook_events`-lijst die gebeurtenis bevat.

| Gebeurtenis | Vuurt wanneer | Payload bevat |
|---|---|---|
| `sale.created` | Een nieuwe verkoop wordt vastgelegd (POS, API, of import) | sale id, sale_ref, store_id, occurred_at, payment_method, totalen (subtotaal/korting/BTW/totaal), status |
| `shift.closed` | Een Z-Rapport wordt uitgevoerd en de kassasessie wordt gesloten | session id, store_id, register_id, cashier_id, opening_float, closing_cash_counted, expected_cash, discrepancy, totalen |
| `refund.issued` | Een afgeronde verkoop wordt terugbetaald (volledig of gedeeltelijk) | refund id, originele sale id, store_id, terugbetalingsbedrag SRD, reden, refunded_by user id, refunded_at |

Wire-formaat:

```
POST <webhook_url>
Content-Type:           application/json
X-JosbinPOS-Event:      sale.created
X-JosbinPOS-Signature:  sha256=<hex>
X-JosbinPOS-Delivery:   <queue job id>

{
  "event":       "sale.created",
  "store_id":    "0192c8e1-…",
  "occurred_at": "2026-05-26T17:32:18+00:00",
  "data":        { … de gebeurtenis-specifieke payload … }
}
```

### 12.9.1 De handtekening verifiëren (partnerzijde)

Elke webhook draagt `X-JosbinPOS-Signature: sha256=<hex>` waarbij `<hex>` `HMAC-SHA256(raw_body, webhook_secret)` is. Partner-pseudocode:

```python
import hmac, hashlib

expected = 'sha256=' + hmac.new(
    webhook_secret.encode(),
    raw_body,                          # bytes, EXACT zoals ontvangen
    hashlib.sha256,
).hexdigest()

if not hmac.compare_digest(expected, request.headers['X-JosbinPOS-Signature']):
    return Response(status=401)        # handtekening-mismatch — afwijzen
```

Cruciaal:
- Hash de **raw bytes** van de request body, niet een opnieuw geserialiseerde JSON-dict (key-volgorde en whitespace doen ertoe).
- Gebruik een constant-tijdsvergelijking (`hmac.compare_digest` in Python, `crypto.timingSafeEqual` in Node, `hash_equals` in PHP).
- Als de handtekening faalt, retourneer non-2xx. Josbin POS zal opnieuw proberen, dus een echte handtekening-mismatch (geroteerd geheim, mid-rotatie) verdwijnt uiteindelijk zodra de partner zijn geheim bijwerkt.

### 12.9.2 Retry-beleid

Webhook-levering is **wachtrij-gebaseerd** via Redis (Laravel Horizon). Als het endpoint van de partner een non-2xx retourneert (of een timeout heeft op 10 s), wordt de job opnieuw in de wachtrij gezet met exponentiële backoff:

| Poging | Vertraging vóór volgende poging |
|---|---|
| 1 (onmiddellijk) | 1 minuut |
| 2 | 5 minuten |
| 3 | 30 minuten |
| 4 | 2 uur |
| (na 4 mislukkingen) | gedropt, gelogd in `webhook_delivery_log` en Horizon `failed_jobs` |

De partnerzijde moet daarom **idempotent zijn bij ontvangst** — als hun endpoint traag is en wij time-outen, kunnen zij dezelfde payload twee keer verwerken. Gebruik de `X-JosbinPOS-Delivery`-header als dedup-sleutel aan hun kant.

Als veel webhooks achter elkaar falen (hun endpoint is uren plat), krijgt leveranciersondersteuning een alert via Horizon's failed-job-monitor en kan leveringen handmatig opnieuw uitvoeren.

---

## 12.10 Rate limit — 1.000 aanvragen per minuut per sleutel

Elke geauthenticeerde `/v1/*`-aanvraag telt mee voor een per-sleutel teller die elke 60 seconden reset. De cap raken retourneert:

```
HTTP/1.1 429 TooManyRequests
{ "error": "TooManyRequests", "message": "Rate limit exceeded: 1,000 requests per minute." }
```

Praktische notities voor partners:

- **1.000/min ≈ 16/sec.** Genoeg voor elke normale POS of webshop. Eén verkoop per seconde per terminal is al extreem druk.
- **Batch-endpoint telt als één aanvraag** ongeacht hoeveel verkopen het bevat. Voor nachtelijke inhaal van 5.000 verkopen, stuur tien batches van 500 — dat zijn tien aanvragen, niet vijfduizend.
- **GET-rapporten tellen ook.** Elke seconde `/v1/reports/summary` pollen vanuit een dashboardwidget is sowieso onzinnig; 60-seconden pollen of op schema ophalen is genoeg.

Er is geen per-IP of per-organisatie limiet bovenop de per-sleutel-limiet — sleutels zijn de throttle-grens.

---

## 12.11 Webhook-leveringen — waar te kijken als er iets misgaat

| Symptoom | Waar te kijken | Waarschijnlijke oorzaak |
|---|---|---|
| Partner zegt "we hebben de webhook nooit ontvangen" | Dashboard → API-integraties → controleer of de gebeurtenissenlijst van de integratie de gebeurtenis bevat | Gebeurtenis niet geabonneerd |
| Webhook-URL is ingesteld, gebeurtenissen geabonneerd, nog steeds niets | Horizon (`/horizon/jobs`) — zoek "DispatchWebhook" | Hun endpoint retourneert non-2xx (kijk in `webhook_delivery_log`-tabel voor HTTP-status + eerste 500 tekens van hun respons) |
| Ze krijgen de webhook maar wijzen af als "invalid signature" | Ze hashen een *opnieuw geserialiseerde* JSON in plaats van de raw body, OF u heeft het geheim geroteerd en zij hebben het niet bijgewerkt | Beide veelvoorkomend — controleer eerst aan de partnerzijde |
| `sale.created` komt aan maar dezelfde `sale_ref` van de verkoop wordt afgewezen bij POST | De partner heeft deze verkoop al via POST ingediend en de inkomende idempotentie heeft de retry opgevangen. De webhook vuurt *ook* — het is een hoofdkantoor-feed, geen partner-only-feed. | By design |
| Laatste ping toont groen maar geen verkopen komen aan | Ze pollen `/v1/reports/summary` om de connectiviteit te controleren maar posten niet echt verkopen | Vertel ze te POSTEN, niet te GETten |

Voor herhaalde leveringsfouten kan leveranciersondersteuning jobs vanuit Horizon opnieuw uitvoeren en (indien nodig) `storage/logs/laravel.log` op de back-office inspecteren.

---

## 12.12 Snelle referentie

```
SLEUTEL UITGEVEN   API-integraties → + Nieuwe sleutel → invullen → Aanmaken
                   → KOPIEER DE SLEUTEL NU (eenmaal getoond)

WEBHOOK BEWERKEN   API-integraties → rij → Webhook bewerken → opslaan

GEHEIM ROTEREN     Bewerk-webhook-modal → Geheim roteren → KOPIEER HET NIEUWE GEHEIM
                   → werk partnerconfiguratie bij

SLEUTEL INTREKKEN  API-integraties → rij → Intrekken → bevestig
                   → opnieuw aanmaken indien nodig (geen undo)

PARTNER POST       POST  /api/v1/sales            met X-API-Key + sale_ref
PARTNER BATCH      POST  /api/v1/sales/batch      tot 500 per aanroep
PARTNER HAALT OP   GET   /api/v1/reports/sales    ?date_from=…&date_to=…
                   GET   /api/v1/reports/summary  ?date_from=…&date_to=…

OPENAPI SPEC       GET   /api/v1/openapi.json     (geen auth)
SWAGGER UI         GET   /api/v1/docs             (geen auth — verwijs partner hierheen)

RATE LIMIT         1.000 req/min per sleutel. 429 bij overschrijding.
IDEMPOTENTIE       sale_ref uniek per vestiging. Re-POST retourneert bestaande → 200.
SANDBOX            X-Josbin-Environment: sandbox-header op non-prod responses.
```

Voor de architecturale kant van hoe Laag-3 in het hele platform past (het drielaagse model, de BTW-pijplijn, het auditlogboek) zie [`/docs/08-integration-api.md`](../docs/08-integration-api.md). Voor rolgebaseerde toegang tot dit scherm zie [Hoofdstuk 1 — Rollen & rechten](01-roles-and-permissions.md).

---

→ Volgende: [Hoofdstuk 13 — Auditlogboek](13-audit-log.md) *(binnenkort beschikbaar)*
