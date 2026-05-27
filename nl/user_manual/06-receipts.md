# Hoofdstuk 6 — Bonnen: Afdrukken, PDF en E-mail

Na elke voltooide verkoop verschijnt het bonscherm automatisch. Dit hoofdstuk legt alle drie de bon-opties uit.

---

## 6.1 Het bonscherm

Nadat de betaling is geaccepteerd, verschijnt een bon-pop-up met deze opties:

| Knop | Wat het doet |
|--------|-------------|
| **Bon afdrukken** (thermisch) | Stuurt naar de aangesloten thermische bonprinter |
| **PDF downloaden** | Opent/downloadt een PDF-bon |
| **Bon e-mailen** | Verstuurt de bon naar het e-mailadres van de klant |
| **Nieuwe verkoop** | Sluit de bon en start een verse lege winkelwagen |

> **Tip:** U kunt meer dan een van deze doen. U kunt bijvoorbeeld de bon afdrukken EN naar de klant mailen.

---

## 6.2 Een thermische bon afdrukken

Thermisch afdrukken stuurt de bon direct naar uw bonprinter (bijv. EPSON TM-T20).

**Vereisten:**
- Er moet een bonprinter zijn aangesloten en geconfigureerd in Instellingen (zie [Hoofdstuk 13](13-settings.md)).
- Voor netwerkprinters: de printer moet in hetzelfde lokale netwerk zitten.
- Voor USB-printers (Windows): de printer moet in Windows geïnstalleerd en in Instellingen geselecteerd zijn.

**Stappen:**

1. Klik in het bonscherm op **Bon afdrukken** (Nederlands: *"Thermisch afdrukken"*).
2. De knop toont kort **"Afdrukken…"**.
3. Indien succesvol, wordt de knop groen en toont een vinkje.
4. Als het mislukt, wordt de knop rood. Controleer de printerverbinding en probeer het opnieuw.

**Wat wordt afgedrukt:**
- Naam en adres van de vestiging
- Bonnummer en datum/tijd (AST-tijdzone)
- Naam kassier
- Lijst van alle artikelen met stukprijs, aantal en regeltotaal
- Eventuele toegepaste kortingen
- Subtotaal, BTW-specificatie, totaal
- Betaalmethode en gegeven wisselgeld (bij contante betalingen)
- Voettekst van de vestiging (bijv. "Bedankt voor uw aankoop")
- BTW-nummer

---

## 6.3 Een PDF-bon downloaden

De PDF-bon heeft dezelfde inhoud als de thermische bon, maar is opgemaakt voor A4-papier.

1. Klik op **PDF** in het bonscherm.
2. De PDF opent in een nieuw browsertabblad of wordt naar uw computer gedownload (afhankelijk van browserinstellingen).
3. Van daaruit kunt u hem opslaan, op een normale printer afdrukken of zelf versturen.

---

## 6.4 Een bon e-mailen

1. Klik op **E-mail** in het bonscherm.
2. Een e-mailadresveld verschijnt.
   - Als de klant een opgeslagen e-mailadres in zijn/haar profiel heeft, verschijnt dit automatisch.
   - Zo niet, typ het e-mailadres van de klant.
3. Klik op **Verstuur**.
4. De bon wordt op de achtergrond door het systeem verstuurd.
5. De e-mailbon is volledig tweetalig — hij wordt verzonden in de taal die op dat moment actief is (Nederlands of Engels).

> **Let op:** E-mailbezorging vereist dat de server is geconfigureerd voor e-mail (SMTP-instellingen). Neem contact op met uw systeembeheerder als e-mails niet worden ontvangen.

---

## 6.5 Een nieuwe verkoop starten

1. Klik na het afhandelen van de bon op **Nieuwe verkoop**.
2. De bon-pop-up sluit.
3. De winkelwagen is leeg en klaar voor de volgende klant.

> **Tip:** U kunt de bon-pop-up ook sluiten door op × in de hoek te klikken. De winkelwagen wordt nog steeds leeggemaakt.

---

## 6.6 Bonformaat uitgelegd

```
════════════════════════════════
       SUPERMARKT DE HOOP
     Paramaribo, Suriname
     BTW nr: SR-001234-5
════════════════════════════════
Bon: #2026-00042
Datum: 19-04-2026  14:32 AST
Kassier: Maria Jansen
────────────────────────────────
Melk (1L)         2× SRD  8.50
                      SRD 17.00
Brood volkoren    1× SRD 12.00
                      SRD 12.00
────────────────────────────────
Subtotaal              SRD 29.00
Korting                SRD  0.00
BTW 10%                SRD  2.55
────────────────────────────────
TOTAAL                 SRD 31.55
════════════════════════════════
Betaalmethode: Contant
Ontvangen:     SRD 50.00
Wisselgeld:    SRD 18.45
────────────────────────────────
Bedankt voor uw aankoop!
Bewaar uw bon voor retour.
════════════════════════════════
```

| Sectie | Beschrijving |
|---------|-------------|
| Kop | Naam vestiging, adres, BTW-nummer |
| Bon # | Uniek bonnummer voor deze vestiging |
| Datum | Datum en tijd in AST (Surinaamse tijd) |
| Regels | Elk verkocht product, met aantal en prijs |
| BTW | Belastingbedrag (10% van de belastbare artikelen) |
| Totaal | Totaal in rekening gebrachte bedrag |
| Betaalinfo | Methode, aangeboden bedrag, wisselgeld |
| Voettekst | Aangepast bericht ingesteld door de vestiging |
