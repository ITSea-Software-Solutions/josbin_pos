# QR-wallet betalingen (Mopé / Uni5Pay+) — flow & use cases

> **Audience:** developers + trainers. For the cashier-facing steps see the
> User Manual, [Chapter 5.9](/user_manual/05-payment#_5-9-qr-wallet-payment-mope-uni5pay).
> Laatst bijgewerkt: 2026-07-06.

## 1. Hoe QR-betalen in Suriname werkt (context)

Mopé (Hakrinbank) en Uni5Pay+ zijn de gangbare scan-to-pay wallets. Een winkel
krijgt van de wallet-aanbieder een **statische merchant-QR** (sticker / PDF).
Belangrijk om te begrijpen:

- **De QR is statisch** — hij identificeert de *winkel*, niet de transactie.
  Er zit **geen bedrag** in. De klant scant, typt zelf het bedrag in de
  wallet-app en bevestigt.
- **Bevestiging gebeurt op het merchant-apparaat** — de telefoon/tablet van de
  winkel met de merchant-app toont binnen seconden "betaling ontvangen".
  Dit apparaat staat naast de kassa; het is *niet* de kassa zelf.
- Er is (nog) **geen publieke merchant-API** bij deze aanbieders. Josbin POS
  kan dus geen dynamische QR met bedrag genereren en geen automatische
  bevestiging ontvangen. Dat is bewust ontworpen als een toekomstige
  uitbreiding — zie §6.

Josbin POS ondersteunt dit model volledig: de kassa **toont** de statische QR
op het scherm, **registreert** de betaling met wallet + transactie-ID, en de
kassier **attesteert** de ontvangst die hij op het merchant-apparaat ziet.

## 2. Eenmalige inrichting (per vestiging)

| Stap | Wie | Waar |
|---|---|---|
| 1. Merchant-account aanvragen bij Mopé (Hakrinbank) en/of Uni5Pay+ | Winkeleigenaar | bij de bank/aanbieder |
| 2. Ontvangen QR (sticker/PDF) als afbeelding bewaren (PNG/JPG) | Winkeleigenaar | — |
| 3. QR uploaden per wallet | Org Admin of Vestigingsmanager | **Dashboard → Vestigingen → (vestiging) → Instellingen → QR-wallets** |
| 4. Merchant-apparaat (telefoon met merchant-app) naast de kassa leggen | Winkel | kassa |

Zonder stap 3 werkt de flow ook — de klant scant dan de fysieke sticker; de
kassa toont een hint waar de QR te uploaden is.

Technisch: de upload landt in `storage/app/public/wallet-qrs/{store}/{slug}.{ext}`
en het pad in `stores.settings['wallet_qrs'][provider]`
(endpoint `POST /api/stores/{store}/wallet-qr`, raster-only — SVG geweigerd
wegens stored-XSS via same-origin `/storage`). De SPA-nginxen proxyen
`/storage` naar de backend.

## 3. Hoofdflow — betaling aan de kassa (happy path)

```
Kassier                    POS                     Klant                Merchant-apparaat
   │  🔳 QR-wallet knop      │                        │                        │
   ├────────────────────────>│                        │                        │
   │  kies wallet (Mopé)     │ toont winkel-QR groot  │                        │
   │                         │ + "SRD 83,50"          │                        │
   │                         ├───────────────────────>│  scant QR van scherm   │
   │                         │                        │  typt 83,50 in app     │
   │                         │                        │  bevestigt             │
   │                         │                        ├───────────────────────>│
   │                         │                        │      "betaling         │
   │   ziet notificatie      │                        │       ontvangen ✓"     │
   │<─────────────────────────────────────────────────────────────────────────┤
   │  (optioneel) TX-ID overtypen                     │                        │
   │  ✓ "Betaling ontvangen" aangevinkt laten         │                        │
   │  → QR-betaling afronden │                        │                        │
   ├────────────────────────>│ sale: qr_payment,      │                        │
   │                         │ provider=Mopé,         │                        │
   │                         │ payment_confirmed_at   │                        │
   │                         │ = nu (kassier-attest)  │                        │
   │                         │ → bon (toont wallet    │                        │
   │                         │   + ref + geen wisselgeld)                      │
```

Resultaat in de database (`sales`): `payment_method='qr_payment'`,
`payment_provider='Mopé'`, `payment_reference='MP-…'` (optioneel),
`payment_confirmed_at`/`payment_confirmed_by` gezet, `status='completed'`.
Geen kassalade, geen wisselgeld (bewust: `change=0` voor niet-contante stappen).

## 4. Alternatieve flows

### 4a. Melding blijft uit (netwerk traag / app hapert)
Kassier vinkt **"Betaling ontvangen"** UIT → verkoop wordt geregistreerd als
*wacht op bevestiging* (`payment_confirmed_at = NULL`). De klant kan gaan; de
Org Admin ziet de verkoop in **Dashboard → Openstaande betalingen** (label
🔳 QR-wallet) en bevestigt zodra het geld op het merchant-portaal zichtbaar is
(`POST /sales/{id}/confirm-payment`, OA-only — een kassier kan dit niet).

### 4b. Terugbetaling
- Een **onbevestigde** QR-verkoop kan **niet** worden terugbetaald (422
  `refund_unconfirmed_payment`): nooit geld eruit voor geld dat nooit
  bevestigd binnenkwam. Eerst bevestigen, dan refunden.
- Een refund van een bevestigde QR-verkoop draagt provider + referentie mee
  (netto per wallet in de reconciliatie) en wordt zelf direct als bevestigd
  gestempeld — geld-uit heeft niets te "bevestigen" en mag de OA-wachtrij
  niet vervuilen. De terugbetaling zelf gebeurt buiten Josbin om, in de
  merchant-app van de wallet.

### 4c. Externe kassa's (Layer-3 API)
`POST /v1/sales` accepteert `payment_method=qr_payment` + `payment_provider`
/ `payment_reference`. API-verkopen arriveren **voor-bevestigd** — het externe
systeem is de bron van waarheid voor zijn eigen kassa. Zie de OpenAPI-spec
(`/api/v1/openapi.json`).

### 4d. Wallet zonder geüploade QR / "Anders"
De stap werkt zonder afbeelding (klant scant de fysieke sticker). Bij een
onbekende wallet kiest de kassier **Anders** en typt de naam — rapportage
groepeert dan op die naam.

## 5. Waar het geld zichtbaar is (controle & afstemming)

| Plek | Wat |
|---|---|
| Bon (thermisch/PDF/e-mail) | "QR-wallet · Betaald via: Mopé (MP-…)" |
| X/Z-rapport + dagafsluiting | aparte QR-wallet-regel; **telt niet mee** in verwacht kasgeld |
| Z-rapport (opgeslagen + HQ-sync) | `qr_payment_total_srd` kolom |
| Dashboard → Rapporten | QR-wallet in betaalmethoden-verdeling + per-provider reconciliatie (`bank_breakdown`) |
| PDF-exports (winkel + geconsolideerd) | QR-regel wanneer gebruikt (ook negatief bij refund-zware periodes) |

**Dagelijkse controle (aanrader voor managers):** vergelijk het QR-dagtotaal
op het Z-rapport met het merchant-portaal van de wallet. Het transactie-ID per
verkoop maakt stuksgewijs matchen mogelijk. Dit is het compenserende control
voor het feit dat de kassier de ontvangst attesteert (er is geen API-bewijs).

## 6. Toekomst: dynamische QR + automatische bevestiging (PSP-integratie)

Voorbereid maar uitgeschakeld tot een aanbieder een merchant-API openstelt:

- `sales.qr_payload` (opaque, 1 KB) — voor een door de PSP gegenereerde
  transactie-QR mét bedrag.
- `POST /api/qr-payments/webhook` — bestaat al, achter feature-flag
  `josbin_pos.qr_webhooks_enabled` (default uit; ongeauthenticeerd geweigerd
  met 503 `QR_WEBHOOKS_DISABLED`). Zodra Mopé/Uni5Pay+ webhooks leveren:
  flag aan, HMAC-verificatie erin, en `payment_confirmed_at` wordt door de
  webhook gezet in plaats van door kassier-attest.

Wat er dan verandert voor de kassier: niets typen, geen vinkje — de kassa
rondt zelf af zodra de webhook binnenkomt.

## 7. Code-kaart

| Laag | Bestand |
|---|---|
| POS-stap + QR-weergave | `frontend/src/components/pos/PaymentModal.tsx` (step `qr_payment`) |
| Sale-registratie + attest | `backend/app/Http/Controllers/Api/SaleController.php` (`payment_confirmed`, alleen voor `qr_payment`) |
| QR-upload per vestiging | `backend/app/Http/Controllers/Api/StoreController.php` (`uploadWalletQr`/`deleteWalletQr`) + `dashboard/src/screens/StoreSettingsScreen.tsx` |
| OA-bevestigingswachtrij | `SaleController::pendingPaymentsQueue` / `confirmPayment` + `dashboard/src/screens/PendingPaymentsScreen.tsx` |
| Refund-regels | `SaleController::refund` (blokkeert onbevestigd; stempelt refund-rij) |
| Webhook-stub | `QrPaymentWebhookController` + config `qr_webhooks_enabled` |
| Tests | `QrPaymentScaffoldingTest`, `V1PaymentMethodsTest`, `StoreWalletQrTest`, `ReportPdfExportTest` |
