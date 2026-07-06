# Hoofdstuk 5 — Betaling aannemen

Zodra alle producten in de winkelwagen staan, laat dit hoofdstuk u zien hoe u de verkoop voltooit.

**Beschikbare betaalmethoden** (drie standaard bovenaan, drie aanvullende onder **Meer betaalwijzen** voor minder gangbare situaties):

| Methode | Wanneer gebruiken | Gaat de kassalade open? |
|---|---|---|
| 💵 **Contant** | Klant betaalt in SRD-contanten | ✅ Ja |
| 💳 **Pin** | Klant betaalt via een externe bank-PIN-terminal | ❌ Nee |
| 🔀 **Gemengd** | Deels contant + deels pin | ✅ Ja (voor het contante deel) |
| 🏦 **Overschrijving** | B2B / overheid — klant maakt over naar uw bankrekening; OA bevestigt wanneer de middelen binnenkomen | ❌ Nee (verkoop gemarkeerd als "wacht op bevestiging") |
| 📱 **Mobiel bankieren** | DSB Mobiel, Hakrinbank Online, Republic Mobile, enz. — klant betaalt via zijn/haar bank-app | ❌ Nee (zelfde levenscyclus als bankoverschrijving) |
| 💱 **Vreemde valuta** | Klant betaalt in USD of EUR — systeem vergrendelt de dagkoers en toont beide bedragen op de bon | ✅ Ja |
| 🔳 **QR-wallet** | Mopé of Uni5Pay+ — klant scant de winkel-QR en betaalt in de wallet-app; de bevestiging verschijnt binnen enkele seconden op uw wallet-apparaat | ❌ Nee |

> **Over pin-reconciliatie** (de optionele velden na Pin): als u de banknaam + goedkeuringscode + laatste 4 cijfers van de slip van de klantterminal invult, kan de OA dagelijkse pin-verkopen koppelen aan het afrekeningsoverzicht van de bank op het dashboard. **Overslaan & afronden** is prima als de slip nog niet uit is — de verkoop wordt sowieso voltooid. Hetzelfde voor bank-/mobiele overschrijvingen — aanbieder + referentie zijn vereist zodat de OA de middelen kan vinden wanneer ze binnenkomen.

---

## 5.1 Het betaalscherm openen

1. Bekijk de winkelwagen om zeker te zijn dat alle artikelen en het totaal kloppen.
2. Klik op de knop **Afrekenen** onderaan het winkelwagenpaneel.
3. Het **Betaalscherm** opent als een pop-uppaneel.
4. Het te betalen totaal staat in grote letters bovenaan: **SRD XX.XX**

> **Voordat u doorgaat:** Zorg dat de wisselkoers van vandaag is ingesteld (zie [Hoofdstuk 2](02-daily-setup.md)). Als deze niet is ingesteld, ziet u de melding: *"Geen dagkoers beschikbaar."* Vraag uw manager eerst de koers in te stellen.

---

## 5.2 Contante betaling

1. Klik in het betaalscherm op **Contant**.
2. De contant-numpad verschijnt.

**Het ontvangen bedrag invoeren:**

- Gebruik de numpad op het scherm om het bedrag in te voeren dat de klant u geeft.
- Het **wisselgeld** wordt in real time berekend en onder het display getoond.
- Bovenaan verschijnen snelbedragknoppen (exact bedrag, afgeronde bedragen als 50, 100, 200 SRD). Klik op één om het direct in te vullen.

**Voorbeeld:**
- Te betalen totaal: SRD 47.50
- Klant geeft: SRD 50.00
- Wisselgeld getoond: SRD 2.50

**De verkoop voltooien:**

3. Zodra het ingevoerde contante bedrag **gelijk aan of groter is dan het totaal**, wordt de knop **Voltooien** actief.
4. Klik op **Voltooien**.
5. De verkoop wordt vastgelegd. De kassalade gaat automatisch open (als er een printer is geconfigureerd).
6. Het bonscherm verschijnt — zie [Hoofdstuk 6 — Bonnen](06-receipts.md).

> **Tip:** Als de klant het exacte bedrag betaalt, klik op de eerste snelbedragknop die het exacte totaal toont. Dat scheelt typen.

---

## 5.3 Pin-betaling

1. Klik in het betaalscherm op **Pin**.
2. Het systeem registreert de verkoop direct als een pinbetaling (geen bedrag in te voeren — het volledige totaal wordt op de pas in rekening gebracht).
3. Verwerk de pinbetaling op uw PIN-terminal (apart apparaat) zoals u dat normaal doet.
4. Zodra de PIN-terminal de betaling bevestigt, verschijnt het bonscherm.

> **Let op:** Josbin POS bestuurt de PIN-terminal niet. U moet de pintransactie apart op de PIN-terminal voltooien. Druk pas op Voltooien nadat de PIN-terminal heeft goedgekeurd.

---

### Een pinapparaat koppelen (pinterminal)

Drie modi, in te stellen onder **Instellingen → Pinterminal (kaartbetalingen)**:

1. **Losse bankterminal (standaard — zo werkt Suriname vandaag).** Het
   pinapparaat van de bank staat naast de kassa en is *niet* met de kassa
   verbonden. U tikt het bedrag op het bankapparaat in, de klant betaalt
   daar, en u rondt de kaartverkoop in de kassa af — desgewenst met de
   bongegevens (bank, autorisatiecode, laatste 4, terminal-referentie) zodat
   de beheerder de pinverkopen kan matchen met het bankafschrift.
2. **Gesimuleerde terminal (demo / training).** De kassa toont een knop
   **"Stuur SRD … naar pinterminal"**; een virtuele terminal keurt na ±2
   seconden goed en vult de reconciliatievelden automatisch. Voor het trainen
   van kassiers of demonstraties — er beweegt geen echt geld.
3. **Directe koppeling (ECR) — toekomst.** Een echte kabel-/netwerkkoppeling
   waarbij de kassa het bedrag naar de terminal stuurt en de goedkeuring
   automatisch terugkrijgt, vereist het ECR-terminalprotocol van de acquiring
   bank. Geen Surinaamse bank biedt dit vandaag publiek aan; het koppelpunt
   in de kassa is klaar. Biedt uw bank het aan, neem dan contact op met
   ITSea om het te activeren.

## 5.4 Gemengde betaling (deels contant, deels pin)

Gebruik dit wanneer een klant een deel van de rekening met pin betaalt en de rest contant.

1. Klik in het betaalscherm op **Gemengd**.
2. De numpad verschijnt. Voer het **pin-bedrag** in — het bedrag dat de klant met pin betaalt.
3. Het **resterende contante bedrag** wordt automatisch berekend en getoond.

**Voorbeeld:**
- Totaal: SRD 120.00
- Klant betaalt SRD 100.00 met pin
- Resterend contant te betalen: SRD 20.00

4. Verwerk het pin-bedrag eerst op uw PIN-terminal.
5. Neem het contante geld voor het resterende bedrag aan.
6. Klik op **Voltooien**.
7. De kassalade gaat open. Het bonscherm verschijnt.

---

## 5.5 Kassalade

De kassalade gaat **automatisch** open na elke contante of gemengde betaling, mits:
- Er een printer is geconfigureerd in Instellingen (zie [Hoofdstuk 13](13-settings.md))
- De kassalade via de RJ11-poort op de bonprinter is aangesloten

Als de lade niet opengaat:
- Controleer de kabelverbinding tussen de lade en de printer.
- Controleer of de printer aan en aangesloten is.
- Open de lade handmatig met de sleutel.

De lade **gaat niet open bij alleen-pin-betalingen** — er is geen contant geld om in te leggen.

---

## 5.6 Een lopende betaling annuleren

- Om terug te gaan naar de winkelwagen vanuit het betaalscherm, klik op de **terugpijl** (← terug) bovenaan het betaalpaneel.
- De winkelwagen blijft ongewijzigd. Er wordt geen verkoop vastgelegd.
- Om het betaalpaneel te sluiten zonder te voltooien, klik op de **×** in de hoek.

---

## 5.7 Wat als de betaling mislukt?

Als de melding **"Serverfout"** verschijnt nadat u op Voltooien heeft geklikt:

1. Noteer eventuele foutmeldingen (bijv. *"Geen dagkoers beschikbaar"*).
2. Druk niet meerdere keren op Voltooien.
3. Neem contact op met uw manager.
4. Veelvoorkomende oorzaken en oplossingen:

| Foutmelding | Oorzaak | Oplossing |
|--------------|-------|----------|
| Geen dagkoers beschikbaar | Geen wisselkoers ingesteld voor vandaag | Manager moet de wisselkoers instellen (Hoofdstuk 2) |
| Serverfout | Server tijdelijk niet beschikbaar | Wacht 30 seconden en probeer opnieuw |
| Verbinding geweigerd | Lokale server draait niet | Neem contact op met IT-ondersteuning |

---

## 5.8 Nadat de verkoop is voltooid

Zodra de betaling is geaccepteerd:
1. De winkelwagen wordt automatisch leeggemaakt.
2. De kassalade gaat open (bij contante/gemengde betalingen).
3. Het **Bonscherm** opent — zie [Hoofdstuk 6 — Bonnen](06-receipts.md).
4. De dagtotalen in de bovenbalk worden direct bijgewerkt.

## 5.9 QR-wallet-betaling (Mopé / Uni5Pay+)

QR-wallets zijn dé alledaagse scan-en-betaal-methode in Suriname. Zo werkt het aan de kassa:

1. Tik op **🔳 QR-wallet (Mopé / Uni5Pay+)** in het betaalscherm.
2. Kies de wallet — **de winkel-QR verschijnt op het kassascherm** (indien geüpload, zie inrichting hieronder) samen met het te betalen bedrag. De klant scant hem rechtstreeks van het scherm — of van de fysieke sticker — en typt het bedrag in de wallet-app. *De QR is statisch: hij identificeert uw winkel, dus het bedrag voert de klant altijd zelf in.*
3. Binnen enkele seconden verschijnt **'betaling ontvangen'** op uw wallet-apparaat (de winkeltelefoon/-tablet met de merchant-app).
4. Kies de wallet (**Mopé** / **Uni5Pay+** / Anders), typ eventueel het transactie-ID uit de merchant-app over, en laat **'Betaling ontvangen — bevestigd op het wallet-apparaat'** aangevinkt.
5. Tik op **QR-betaling afronden** — de verkoop is direct voltooid, de kassalade blijft dicht.

> **Melding vertraagd?** Vink het bevestigingsvakje uit vóór het afronden. De verkoop wordt dan geregistreerd als *wacht op bevestiging* en uw beheerder keurt hem later goed via **Dashboard → Openstaande betalingen** — dezelfde route als een bankoverschrijving.

> **Eenmalige inrichting — QR op het kassascherm tonen:** een Org Admin of Vestigingsmanager uploadt de wallet-QR (de afbeelding die u van uw bank/wallet-aanbieder kreeg) via **Dashboard → Vestigingen → Instellingen → QR-wallets**, één keer per wallet per vestiging. Zonder upload werkt de flow ook — de klant scant dan de sticker bij de kassa.

> **Volledige flow & randgevallen** (vertraagde bevestiging, terugbetaalregels, externe kassa's, toekomstige automatische bevestiging): zie het ontwikkeldocument *QR-wallet betalingen — flow & use cases* (`docs/qr-payment-flow.md`).

> **Dagelijkse afstemtip voor managers:** vergelijk het dagtotaal **QR-wallet** op het Z-rapport met het merchant-portaal van de wallet zelf. Het optionele transactie-ID per verkoop maakt het matchen van individuele betalingen eenvoudig.
