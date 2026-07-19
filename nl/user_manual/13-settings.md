# Hoofdstuk 13 — Instellingen

**Wie gebruikt dit:** Vestigingsmanager
**Waar:** Bovenbalk → Instellingen

Met het scherm Instellingen kunt u de printer, kassalade, taal en andere vestigingsvoorkeuren configureren. Wijzigingen worden direct van kracht en automatisch opgeslagen.

---

## 13.1 Instellingen openen

1. Klik in de bovenbalk op **Instellingen**.
2. Het scherm Instellingen opent, onderverdeeld in secties.

---

## 13.2 Printer- en kassalade-installatie

Dit is de belangrijkste sectie. Zonder een correct geconfigureerde printer werken thermische bonnen en de kassalade niet.

### Stap 1 — Kies het verbindingstype

Selecteer onder **Printerverbinding** een van de drie opties:

| Optie | Wanneer te gebruiken |
|--------|------------|
| **Geen** | Geen printer aangesloten. Alleen PDF-bonnen. Kassalade gaat niet open. |
| **Netwerk** | Printer aangesloten via Ethernet of Wi-Fi (aanbevolen voor de meeste installaties). |
| **USB** | Printer direct via USB-kabel aangesloten op deze Windows-pc. |

### Stap 2A — Een netwerkprinter configureren

Als u **Netwerk** heeft geselecteerd:

1. **IP-adres** — voer het IP-adres van de printer in (bijv. `192.168.1.100`).
   - Vind dit op de eigen configuratie-afdruk van de printer (houd de Feed-knop ingedrukt op de meeste EPSON-printers om een statuspagina af te drukken).
   - Of controleer de lijst met aangesloten apparaten van uw router.
2. **Poort** — laat staan op `9100` (dit is de standaard ESC/POS raw-poort die door alle netwerkbonprinters wordt gebruikt).
3. Klik op **Opslaan**.

> **Tip:** Als u het IP-adres van uw printer niet weet, gebruik dan een statisch IP. Vraag uw IT-medewerker om een vast IP aan de printer toe te wijzen, zodat dit nooit verandert.

### Stap 2B — Een USB-printer configureren (alleen Windows)

Als u **USB** heeft geselecteerd:

1. Klik op **Printers vernieuwen**.
2. Er verschijnt een keuzemenu met alle printers die in Windows zijn geïnstalleerd.
3. Selecteer uw bonprinter in de lijst (bijv. "EPSON TM-T20II").
4. Klik op **Opslaan**.

> **Tip:** Als uw printer niet verschijnt, zorg er dan voor dat deze eerst in Windows is geïnstalleerd. Ga naar Windows-instellingen → Bluetooth & apparaten → Printers & scanners → Een printer toevoegen.

### Stap 3 — Configureer de kassalade-pin

De kassalade-pin bepaalt op welke connector de lade is aangesloten op de achterkant van de printer.

| Instelling | Wanneer te gebruiken |
|---------|------------|
| **Pin 2 (de meeste printers)** | Standaard. Gebruik dit tenzij de lade niet open gaat. |
| **Pin 5** | Sommige oudere printers gebruiken Pin 5. Probeer dit als Pin 2 niet werkt. |

### Stap 4 — Test de kassalade

1. Klik op de knop **Lade testen**.
2. Het systeem stuurt een puls naar de printer.
3. Als correct geconfigureerd, gaat de kassalade open.
4. De knop toont "Geopend ✓" in groen, of "Fout" in rood.

Als het Fout toont:
- Controleer alle kabelverbindingen.
- Probeer de andere pin-instelling (Pin 2 vs Pin 5).
- Zorg ervoor dat de printer aan en aangesloten is.

### Stap 5 — Bonnen automatisch afdrukken (optioneel)

Onder de ladetest staat de schakelaar **"Bon automatisch afdrukken na elke verkoop"**.

- **Uit (standaard):** de kassier tikt op **Bon afdrukken** in het bonscherm wanneer de klant papier wil.
- **Aan:** de bon wordt vanzelf afgedrukt op het moment dat elke verkoop wordt voltooid — precies één keer per verkoop. Met een geconfigureerde thermische printer gebeurt dit geluidloos; met verbindingstype **Geen** opent in plaats daarvan na elke verkoop het Windows-afdrukvenster (dat gaat snel vervelen — configureer eerst de printer).

Dit is een instelling per terminal. Zie [Hoofdstuk 6 §6.2](06-receipts.md) voor hoe dit zich gedraagt op het bonscherm.

---

## 13.3 Taal en datumnotatie

### Taal

1. Zoek de sectie **Taal**.
2. Klik op **Nederlands**, **English** of **Sranantongo**.
3. De hele interface schakelt direct — geen herstart nodig.
4. Deze voorkeur wordt per gebruiker opgeslagen (elke kassier kan zijn eigen taal hebben).

> **Sranantongo is een concept.** De hele kassa werkt erin (WhatsApp-bonnen volgen mee), maar de formulering wordt nog door moedertaalsprekers nagekeken — foutmeldingen van de server verschijnen voorlopig in het Nederlands. Ziet u een zin die een kassier in Paramaribo anders zou zeggen? Meld het uw manager.

### Datumnotatie

De datumnotatie bepaalt hoe datums worden weergegeven op bonnen, rapporten en in de hele interface.

Beschikbare notaties:

| Notatie | Voorbeeld |
|--------|---------|
| DD-MM-YYYY | 19-04-2026 (Nederlandse standaard) |
| MM/DD/YYYY | 04/19/2026 (Amerikaanse notatie) |
| YYYY-MM-DD | 2026-04-19 (ISO-notatie) |
| DD MMM YYYY | 19 Apr 2026 |
| D MMMM YYYY | 19 April 2026 |
| MMM D, YYYY | Apr 19, 2026 |

Selecteer de notatie die overeenkomt met uw voorkeur of lokale conventie.

---

## 13.4 Schermtoetsenbord

Het schermtoetsenbord is een volledig toetsenbord dat onderaan het POS-scherm wordt weergegeven — handig voor terminals met alleen touchscreen zonder fysiek toetsenbord.

**Om het schermtoetsenbord in/uit te schakelen:**
- Klik op het **toetsenbordpictogram** in de bovenbalk. Het toetsenbord schuift omhoog vanaf de onderkant.
- Klik er opnieuw op (of de × knop op het toetsenbord) om het te verbergen.

Het schermtoetsenbord kan worden gebruikt voor:
- Typen in de zoekbalk
- Invoeren van contante bedragen op het betalingstoetsenbord
- Elk tekstveld in de applicatie

---

## 13.5 Vestigingsinformatie

Deze sectie toont (alleen-lezen) de huidige vestigingsinformatie:
- Vestigingsnaam
- Organisatienaam
- Uw gebruikersrol
- Vestigings-ID (referentienummer)

Deze kunnen alleen worden gewijzigd door de Super Admin. Neem contact op met uw beheerder als er iets niet klopt.

---

## 13.6 BTW-standaardinstellingen

Managers kunnen standaard BTW-instellingen configureren:

| Instelling | Beschrijving |
|---------|-------------|
| Standaard BTW-tarief | Toegepast op nieuwe producten als er geen tarief is opgegeven (bijv. 10%) |
| BTW-vrije categorieën | Categorieën waar alle producten automatisch zijn vrijgesteld |

> **Let op:** Individuele product-BTW-tarieven overschrijven de standaard. Het wijzigen van de standaard wijzigt bestaande producten niet met terugwerkende kracht.

---

## 13.7 Referentietabel instellingen

| Instelling | Standaard | Opmerkingen |
|---------|---------|-------|
| Printertype | Geen | Moet worden ingesteld voordat afdrukken werkt |
| Printer-IP | (leeg) | Alleen netwerkprinters |
| Printerpoort | 9100 | Wijzig niet tenzij uw printer een andere poort gebruikt |
| Kassalade-pin | Pin 2 | Wijzig naar Pin 5 als de lade niet open gaat |
| Bon automatisch afdrukken | Uit | Per terminal; drukt af zodra elke verkoop is voltooid — §13.2 Stap 5 |
| Taal | Nederlands | Instelling per gebruiker |
| Datumnotatie | DD-MM-YYYY | Instelling per gebruiker |
| Weegschaal-barcodes (gewogen artikelen) | Uit | §13.9 — bevestig de indeling met de weegschaal van uw vestiging vóór ingebruikname |
| Auto-start bij opstarten systeem | Uit | Manager+ — zie §13.8 |
| Knoppen Sluiten + Herstarten | (Manager+) | Alleen zichtbaar voor Vestigingsmanager en hoger |

---

## 13.8 Systeem (alleen manager / vestigingsmanager)

Het tabblad **Systeem** in Instellingen is verborgen voor kassiersaccounts. Het toont drie bedieningselementen die toebehoren aan de manager die verantwoordelijk is voor de terminal:

### Auto-start bij opstarten systeem

Een schakelaar (standaard uit). Indien aan, opent Josbin POS automatisch wanneer de Windows-machine opstart — zodat de terminal klaar is voor de ochtendshift zonder dat iemand het toetsenbord hoeft aan te raken.

- **Zet het aan voor terminals die elke ochtend "gewoon moeten werken"** — typisch voor kassa's
- **Laat het uit voor back-office-machines** — een pc van een manager waarop ook andere software draait, mag geen schermvullende POS automatisch starten

Dit is per apparaat (leeft in de Windows-opstartmap via de Electron-app). Het uitschakelen vereist dat Josbin POS eenmaal draait om de vermelding te verwijderen; anders verwijdert u deze handmatig uit Windows: `Win+R` → `shell:startup` → verwijder de snelkoppeling van Josbin POS.

### App herstarten

Een knop (alleen Manager+). Sluit het Electron-venster en opent het opnieuw. Gebruikt wanneer:

- De catalogus niet wil vernieuwen en u wilt een schone herlaadbeurt
- De terminal al dagen draait en traag aanvoelt
- Na een handmatige update waarbij u zeker wilt weten dat de nieuwe code is geladen

> **Herstarten logt u NIET uit.** Uw sessie gaat door — wanneer het nieuwe venster opent, bent u nog steeds op hetzelfde scherm, dezelfde vestiging, dezelfde kassasessie.

### App sluiten

Een knop (alleen Manager+). Sluit Josbin POS volledig (Electron stopt). Gebruik aan het einde van de dag of voor onderhoud.

> **Sluiten tijdens een geopende kassa?** U krijgt een waarschuwing. Sluit eerst uw kassa (Hoofdstuk 3 §3.5), anders kan de volgende opener geen nieuwe sessie starten op dezelfde kassa.

Zowel Sluiten + Herstarten zijn manager-beperkt omdat een kassier die er per ongeluk op tikt midden in een verkoop de status zou verliezen. De kassier ziet hier helemaal geen knoppen.

---

## 13.9 Gewogen artikelen / weegschaal-barcodes

Voor winkels met een **etiketteerweegschaal** (vleeswarenafdeling, vlees, groente en fruit): de weegschaal weegt het artikel en drukt een barcode af die een *waarde* bevat — de berekende prijs, of het gewicht — in plaats van een vast product aan te duiden. Josbin POS kan die etiketten inlezen, zodat de kassier alleen maar scant en de regel correct geprijsd verschijnt.

**Standaard uit.** Schakel dit alleen in als uw winkel daadwerkelijk weegschaaletiketten gebruikt.

### De instellingen

| Instelling | Wat het betekent | Standaard |
|---|---|---|
| **Weegschaal-barcodes inlezen** | Hoofdschakelaar voor de functie | Uit |
| **Ingebedde waarde** | **Prijs** — de weegschaal heeft het artikel al geprijsd; het etiket bevat het bedrag (SRD). **Gewicht** — het etiket bevat het gewicht; de POS vermenigvuldigt dit met de catalogusprijs per kg van het product. | Prijs |
| **Prefix** | Het begincijfer (of de begincijfers) dat een barcode als weegschaaletiket markeert. Vrijwel alle weegschalen gebruiken **2** (het EAN-13 "in-store"-bereik). | 2 |

### Hoe het etiket wordt gelezen

Weegschaaletiketten zijn EAN-13-barcodes met deze indeling (de standaard 6 + 5-verdeling):

```
2  123456  01750  C
│  │       │      └ controlecijfer
│  │       └ 5 cijfers waarde — prijs in centen (SRD 17.50) of gewicht in grammen (1,750 kg)
│  └ 6 cijfers artikelcode — moet overeenkomen met de barcode van het product in de catalogus
└ prefix (instelbaar, standaard 2)
```

Twee dingen moeten kloppen om dit te laten werken:

1. **Het product staat in de catalogus met de 6-cijferige artikelcode als barcode** — bijv. barcode `123456` op "Kipfilet per kg", geprijsd per kg. De weegschaal en de catalogus moeten het over die code eens zijn.
2. **De indeling komt overeen met uw weegschaal.** De prefix en het waardetype (prijs/gewicht) zijn hier instelbaar; de 6 + 5-cijferverdeling ligt vast op de gangbare standaard. Weegschaalmerken (Bizerba, CAS, Avery, Digi, …) kunnen anders geprogrammeerd zijn — gebruikt uw weegschaal een andere verdeling, neem dan contact op met uw Josbin-contactpersoon **voordat** u dit inschakelt.

> ⚠️ **Vaste regel — test vóór ingebruikname, elke vestiging, elke weegschaal.** Druk een paar testetiketten af op de eigen weegschaal van de winkel en scan ze aan de kassa. Controleer of het product, het gewicht/de prijs en het regeltotaal precies kloppen. **Een verkeerde indeling geeft geen foutmelding — hij beprijst elk gewogen artikel geruisloos verkeerd.** Zet dit nooit aan voor een vestiging zonder te bevestigen met de weegschaal van die vestiging zelf, en test opnieuw nadat iemand de weegschaal heeft geherprogrammeerd.

### Wat de kassier ziet

Niets nieuws — dat is juist de bedoeling. Scan het etiket zoals elke barcode ([Hoofdstuk 4 §4.1, Methode D](04-making-a-sale.md)):

- **Prijsmodus:** het product wordt toegevoegd met de ingebedde prijs van het etiket als regelprijs voor dat gewogen artikel.
- **Gewichtsmodus:** het product wordt toegevoegd met het gewicht als aantal (bijv. `1.750`), geprijsd tegen catalogusprijs × kg.

Wordt de artikelcode niet gevonden, dan verschijnt de normale melding "product niet gevonden" — voeg het product toe aan de catalogus (met de artikelcode als barcode) en scan opnieuw. Net als de andere opties op dit scherm is dit een instelling **per terminal**: schakel hem in op elke kassa van de vestiging.

---

## Veelvoorkomende problemen in Instellingen

| Probleem | Oplossing |
|---------|----------|
| Printerlijst is leeg (USB-modus) | Printer is niet geïnstalleerd in Windows. Installeer via Windows-instellingen → Printers. |
| Lade testen toont "Fout" | Controleer alle kabelverbindingen. Probeer de andere pin-instelling. Controleer de stroomvoorziening van de printer. |
| Instellingen worden niet opgeslagen na sluiten | Instellingen worden opgeslagen in de lokale opslag van uw browser. Gebruik geen privé/incognitomodus. |
| Taal keert na inloggen terug naar Nederlands | Taal wordt opgeslagen per gebruiker per apparaat. Stel het opnieuw in op elk apparaat/browser. |
