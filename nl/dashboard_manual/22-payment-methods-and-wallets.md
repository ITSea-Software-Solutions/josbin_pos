# Hoofdstuk 22 — Betaalmethoden, QR-wallets & openstaande betalingen

Josbin POS registreert zeven betaalmethoden. Dit hoofdstuk behandelt de
dashboard-kant voor de Organisatiebeheerder / Vestigingsmanager: QR-wallets
instellen, de wachtrij openstaande betalingen, en waar elke methode in de
rapporten terugkomt.

## 22.1 De zeven betaalmethoden

| Methode | Direct afgerond aan de kassa? | Dashboard-rol |
|---|---|---|
| 💵 Contant | ✅ | — |
| 💳 Pin / Kaart | ✅ | reconciliatierapport (per bank) |
| 🔀 Gemengd | ✅ | — |
| 🏦 Overschrijving | ❌ *wacht op bevestiging* | **u bevestigt zodra het geld binnen is** |
| 📱 Mobiel bankieren | ❌ *wacht op bevestiging* | **u bevestigt zodra het geld binnen is** |
| 💱 Vreemde valuta (USD/EUR) | ✅ | dagkoers-audittrail |
| 🔳 QR-wallet (Mopé / Uni5Pay+) | ✅ als de kassier de wallet-melding bevestigt; ❌ als dat niet lukt | QR-instelling + incidentele bevestiging |

## 22.2 QR-wallets — eenmalige inrichting per vestiging

Mopé en Uni5Pay+ geven uw winkel een **statische merchant-QR** (sticker /
PDF). Upload hem één keer en de kassa toont hem full-screen bij elke
QR-betaling, met het te betalen bedrag ernaast:

1. **Vestigingen → (vestiging) → Instellingen → QR-wallets (Mopé / Uni5Pay+)**
2. Upload per wallet de QR-afbeelding (PNG/JPG — de afbeelding van uw bank)
3. Klaar — kassiers zien hem direct; hier ook vervangen of verwijderen

> De QR identificeert uw *winkel*, niet de transactie — de klant typt het
> bedrag altijd zelf in de wallet-app. De kassa herhaalt het exacte totaal
> naast de QR zodat er niets fout wordt overgetypt.

Vestigingsmanagers kunnen dit voor hun eigen vestiging; Organisatiebeheerders
voor alle vestigingen.

## 22.3 Openstaande betalingen — overschrijvingen en vertraagde QR-betalingen bevestigen

**Dashboard → Openstaande betalingen** toont elke verkoop die nog *wacht op
bevestiging*: bankoverschrijvingen, mobiel-bankieren-overboekingen, en
QR-wallet-verkopen waarbij de kassier de wallet-melding niet kon verifiëren
(label 🔳 QR-wallet).

Per regel ziet u de aanbieder, het betalingskenmerk van de klant, de naam van
de betaler (overschrijvingen) en het bedrag. Zodra het geld zichtbaar is op
uw bankafschrift of wallet-merchantportaal drukt u op **Bevestigen** — de
verkoop krijgt uw naam en tijdstip (vastgelegd in het auditlogboek).

Twee beveiligingen om te kennen:

- **Terugbetalen is geblokkeerd** zolang een verkoop op bevestiging wacht —
  er gaat nooit geld de la uit voor geld dat nooit bevestigd binnenkwam.
- Alleen OA-niveau kan bevestigen; kassiers kunnen hun eigen overboekingen
  niet goedkeuren (functiescheiding).

## 22.4 Waar het geld terugkomt

- **Rapporten → betaalmethoden-verdeling** — alle zeven methoden, getoond
  wanneer gebruikt (ook negatieve totalen in refund-zware periodes, zodat de
  verdeling altijd optelt tot het totaal).
- **Rapporten → reconciliatie** — pin- en overboeking/wallet-regels per bank
  / aanbieder, voor afstemming met bankafschriften en wallet-portalen.
- **Z-Rapporten** — elke dagafsluiting bewaart nu alle zeven methodetotalen
  en stuurt ze mee naar het hoofdkantoor.

> **Dagelijkse gewoonte voor QR-wallets:** vergelijk het QR-wallet-totaal op
> het Z-rapport met het merchantportaal van de wallet zelf. Transactie-ID's
> per verkoop maken stuksgewijs matchen mogelijk.

## 22.5 Pinapparaten (kaartbetalingen)

Kaartbetalingen lopen via de **losse pinterminal van de bank** naast de kassa
— de kassier tikt het bedrag in, de klant betaalt op het bankapparaat, en de
kassa registreert de verkoop (plus optionele bongegevens voor reconciliatie).
Er is bewust **nog geen directe kabel tussen kassa en terminal**: daarvoor is
het ECR-terminalprotocol van de acquiring bank nodig, en geen Surinaamse bank
stelt dat vandaag publiek beschikbaar. De kassa heeft het koppelpunt al klaar
(inclusief een gesimuleerde terminal voor demo's en training — zie
kassahandleiding §5.3); biedt uw bank ECR-integratie aan, neem dan contact op
met ITSea om het te activeren.

## 22.6 Verdieping

Ontwikkelaars en trainers: het volledige flowdocument — inclusief vertraagde
bevestiging, terugbetaalregels, de externe-kassa-API en de toekomstige
PSP-integratie — staat onder **Ontwikkelaarsdocs → QR-wallet betalingen
(flow & use cases)**.
