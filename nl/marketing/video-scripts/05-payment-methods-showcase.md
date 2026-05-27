# Script 05 — Showcase betaalmethodes

**Doel:** bewijzen dat Josbin POS elke betaalmethode aankan die een Surinaamse winkel daadwerkelijk ziet — contant, pin met afstemming, bankoverschrijving met wacht-op-bevestiging-levenscyclus, mobiele wallets, vreemde valuta met vergrendelde koers. Veelvoorkomende koperstwijfel: "ondersteunt het \[mobiele app van bank\]?" Beantwoord dit één keer in een video, je hoeft de vraag nooit meer te beantwoorden.

**POV:** Kassier (`kassa@dehoop.sr / Cashier@2026`) + korte OA-cameo (`orgadmin@dehoop.sr / OrgAdmin@2026`) voor de bevestigingswachtrij.

**Doelduur:** 4 min 30 s.

**Controle vóór opname**

- [ ] Demostack draait, POS op `:5173`, dashboard op `:5174`.
- [ ] Kassier al ingelogd met open kassa. (Bespaart 30 s opener.)
- [ ] Dagkoers vergrendeld (vreemde valuta heeft dit nodig; verkoop mislukt zonder).
- [ ] Browsertaal nl-NL.
- [ ] Eén OA-ingelogde tab klaar in de achtergrond voor de laatste scène.

---

## Openingshaakje — 15 s

> "In Suriname ziet één winkel contant, pinpas, DSB Mobiel, Hakrinbank Online, Republic Mobile, B2B-bankoverschrijving, en soms US-dollars of euro's van toeristen — allemaal in dezelfde ochtend. De meeste POS-systemen dwingen je om de helft daarvan te knoeien. Kijk wat Josbin doet."

**Caption op het scherm:** "Elke betaalmethode, geen geknoei."

---

## Scène 1 — Contant + de basisflow (30 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Bouw een eenvoudige winkelwagen, 47.50 SRD | "Winkelwagen klaar — 47 SRD 50." | |
| **Afrekenen** | "Afrekenen." | |
| Betaalmodal — drie grote knoppen | "Drie bovenaan — contant, pin, gemengd. *Meer betaalwijzen* opent de rest." | |
| Klik op **Contant** | "Contant." | |
| Type 50 | "Klant overhandigt 50 SRD. Wisselgeld is 2 SRD 50." | |
| Klik op **Voltooien** | "Voltooien. Lade gaat open." | |

---

## Scène 2 — Pin met afstemming (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Nieuwe verkoop, bouw winkelwagen 120 SRD | "Volgende klant — 120 SRD." | |
| Afrekenen → **Pin** | "Pin." | |
| Recon-stap verschijnt | "Nu komt het Surinaams-specifieke stuk. Nadat de klant zijn pinpas op de pinterminal van de bank gehouden heeft, legt de kassier optioneel de banknaam, de goedkeuringscode en de laatste 4 cijfers van de slip vast." | "Optionele recon voor dagelijkse afrekening" |
| Kies **DSB** uit keuzemenu | "Bank — DSB." | |
| Type goedkeuringscode, laatste 4 | "Goedkeuringscode van de slip — laatste 4." | |
| Klik op **✓ Voltooien** | "Voltooien." | |
| (Optioneel) wijs naar het **Overslaan & voltooien**-alternatief | "Als de slip nog niet uit is, *Overslaan & voltooien* — verkoop wordt nog steeds voltooid. Recon kan later vanuit het dashboard ingevuld worden." | "Overslaan als slip niet klaar" |
| Noem dashboard-voordeel | "Waarom dit belangrijk is — aan het einde van de dag matcht het dashboard de dagelijkse kaartverkopen automatisch tegen het afrekeningsoverzicht van de bank. Geen handmatige afstemming." | "Einde-dag kaart-bank-match is automatisch" |

---

## Scène 3 — Bankoverschrijving (B2B / overheid) (60 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Nieuwe verkoop 1.200 SRD (B2B-bedrag) | "B2B-verkoop — overheidsdepartement, 1.200 SRD." | |
| Afrekenen → **Meer betaalwijzen** | "*Meer betaalwijzen.*" | |
| Klik op **Overschrijving** | "Bankoverschrijving." | |
| Formulier: provider, referentie | "Klant initieert een overschrijving vanuit zijn bank-app. Kassier legt de provider vast — Hakrinbank — en het referentienummer van het bevestigingsscherm van de klant." | |
| Klik op **Voltooien** | "Voltooien." | |
| Bevestigingsbanner — *Wacht op bevestiging* | "Verkoop is geregistreerd — maar gemarkeerd als *wacht op bevestiging*. Het geld is nog niet daadwerkelijk op onze rekening binnen. Belastingdienst telt de verkoop pas mee als de betaling binnenkomt, dus we nemen dit nog niet op in de totalen van vandaag." | "Wacht op geld — nog niet meegeteld" |
| Bon drukt af met wachtbadge | "Bon drukt af met die status ook voor de klant zichtbaar." | |

---

## Scène 4 — OA bevestigt in de openstaande wachtrij (45 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Wissel naar OA-ingelogde tab | "Wissel naar de Organisatiebeheerder." | |
| Zijbalk → **Openstaande betalingen** | "*Openstaande betalingen*-wachtrij — elke wacht-op-bevestiging-verkoop over de organisatie heen." | |
| De rij die we net maakten staat bovenaan | "Onze 1.200 SRD-overschrijving staat er meteen." | |
| OA controleert bank-app (buiten beeld) | "OA controleert de bank-app — ja, de overschrijving is binnen." | |
| Klik op **✓ Bevestig** | "Bevestig." | |
| Rij verdwijnt uit wachtrij, status springt | "Rij verdwijnt uit de wachtrij. Verkoop telt nu mee in de totalen van vandaag. *Bevestigd door* en *bevestigd op* worden voor eeuwig vastgelegd." | "Auditeerbare bevestigingsflow" |

---

## Scène 5 — Mobiele overschrijving (15 s)

Toon dit kort — zelfde levenscyclus als bankoverschrijving, alleen een andere providerlijst.

| Klik | Narratie | Caption |
|------|----------|---------|
| Terug naar POS, nieuwe verkoop, afrekenen → Meer betaalwijzen | "Zelfde flow voor DSB Mobiel, Hakrinbank Online, Republic Mobile. Klant betaalt vanuit zijn app, kassier legt referentie vast, OA bevestigt zodra het geld binnenkomt." | "Zelfde levenscyclus voor mobiele wallets" |

---

## Scène 6 — Vreemde valuta (USD / EUR) (45 s)

| Klik | Narratie | Caption |
|------|----------|---------|
| Nieuwe winkelwagen 200 SRD | "Toeristische klant die in US-dollars wil betalen." | |
| Afrekenen → Meer betaalwijzen → **Vreemde valuta** | "Vreemde valuta." | |
| Kies **USD** | "USD." | |
| Toon vergrendelde dagkoers | "Systeem gebruikt de vergrendelde koers van vandaag — elke ochtend ingesteld vanuit ExchangeRate-API, met handmatige override beschikbaar. De koers wordt **vergrendeld op het moment van verkoop** — als hij later beweegt, heeft deze verkoop nog steeds de koers die actueel was toen de klant betaalde." | "Koers per verkoop voor altijd vergrendeld" |
| Auto-berekend USD-bedrag | "Automatisch berekend USD-bedrag." | |
| Type ontvangen USD | "Klant overhandigt 8 USD." | |
| Wisselgeld in SRD of USD (instelbaar) | "Wisselgeld verschijnt in beide valuta — geef de SRD." | |
| Voltooien → bon | "Bon toont beide bedragen — SRD-regel en USD-regel — met de gebruikte koers." | "Bon: SRD + USD + koers" |

---

## Afsluiting — 20 s

> "Contant. Pin met bankafschrift-afstemming. Bankoverschrijving met goede wacht-op-bevestiging-levenscyclus. Mobiele wallets. Vreemde valuta met de koers per verkoop voor altijd vergrendeld. Geen geknoei, geen spreadsheets, geen einde-dag-verrassingen. Gebouwd voor de manier waarop Suriname daadwerkelijk betaalt."

**Laatste caption op het scherm:** "Elke betaalmethode, zoals Suriname echt betaalt."

---

## Na opname

- Lang script — als het over de 5 min loopt, laat Scène 5 vallen (mobiele wallets zijn in wezen dezelfde flow als bankoverschrijving; één vermelding in de narratie dekt het).
- Titel: *"Josbin POS — elke Surinaamse betaalmethode, goed afgehandeld."*
- Dit is het script waarover het meest gevraagd zal worden bij salesgesprekken. Houd er één klaar om te versturen.
