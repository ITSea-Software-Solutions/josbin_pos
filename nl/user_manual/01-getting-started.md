# Hoofdstuk 1 — Aan de slag: Inloggen & Eerste stappen

Dit hoofdstuk legt uit hoe u Josbin POS opent, inlogt en uw weg vindt op het scherm.

---

## 1.1 De applicatie openen

**Op Windows (POS-terminal):**

1. Dubbelklik op het **Josbin POS**-pictogram op het bureaublad.
2. De applicatie opent in volledig scherm. Het inlogscherm verschijnt automatisch.
3. Als Windows een beveiligingswaarschuwing toont ("Unknown publisher"), klik dan op **Toch uitvoeren**. Dit is normaal bij de eerste keer opstarten.

> **Let op:** Josbin POS draait volledig op uw lokale computer. Er is geen internetverbinding nodig om verkopen te verwerken. Internet wordt alleen gebruikt om gegevens te synchroniseren met het hoofdkantoor en om de dagkoers op te halen.

---

## 1.2 Inloggen

Het inlogscherm vraagt om uw **e-mailadres** en **wachtwoord**.

![Inlogscherm — leeg](screenshots/01-login-screen.png)

**Stappen:**

1. Klik op het veld **E-mail** en typ uw e-mailadres (bijv. `kassa@dehoop.sr`).
2. Klik op het veld **Wachtwoord** en typ uw wachtwoord.
3. Klik op de knop **Inloggen** of druk op **Enter** op uw toetsenbord.

![Inlogscherm — ingevuld](screenshots/01-login-filled.png)

**Wat er daarna gebeurt:**
- Als uw gegevens correct zijn, wordt u naar het vestigingsselectiescherm geleid.
- Als het inloggen mislukt, verschijnt er een rode foutmelding. Controleer of Caps Lock niet aanstaat en probeer het opnieuw.
- Na **5 mislukte pogingen** wordt uw account 15 minuten vergrendeld. Neem contact op met uw manager als dit gebeurt.

> **Tip — Touchscreen-terminals:** Tik op het veld waar u wilt typen. Het schermtoetsenbord kan via de werkbalk worden ingeschakeld als u geen fysiek toetsenbord heeft. Zie [Hoofdstuk 13 — Instellingen](13-settings.md) voor hoe u dit configureert.

---

## 1.3 Uw vestiging selecteren

Kassiers en vestigingsmanagers worden door de beheerder die hun account heeft aangemaakt vastgekoppeld aan **één vestiging**. Direct na het inloggen leidt het systeem u automatisch naar het Open Kassa-scherm van die vestiging — het keuzescherm hieronder wordt volledig overgeslagen. Dit is het verwachte gedrag.

![Vestigingsselectiescherm](screenshots/01-store-select.png)

U ziet dit vestigingsselectiescherm alleen als:
- U een Organisatiebeheerder of Super Admin bent (organisatiebrede rollen zien elke vestiging), **of**
- Uw account geen vestigingstoewijzing heeft (een setup-fout — vraag uw beheerder u aan een vestiging toe te wijzen).

Als u het wel ziet: tik of klik op de naam van uw vestiging. Het hoofd-POS-scherm opent direct.

> **Moet u in twee winkels werken?** Vraag uw beheerder om een **tweede account** aan te maken voor de andere vestiging. Eén persoon kan één account per vestiging hebben; u kunt één account niet tussen vestigingen wisselen.

---

## 1.4 De schermindeling begrijpen

Het hoofdscherm is verdeeld in drie gebieden:

```
┌──────────────────────────────────────────────────────────┐
│  BOVENBALK  (navigatie, naam vestiging, dagtotaal)       │
├──────────────────────────────────┬───────────────────────┤
│                                  │                       │
│   PRODUCTRASTER                  │   WINKELWAGENPANEEL   │
│   (links)                        │   (rechts)            │
│                                  │                       │
│   Zoekbalk bovenaan              │   Lijst toegevoegde   │
│   Categorieknoppen daaronder     │   artikelen. Subtot., │
│   Productkaarten vullen de rest  │   BTW, Totaal, knop   │
│                                  │   Afrekenen           │
└──────────────────────────────────┴───────────────────────┘
```

**Bovenbalk** — bevat:
- Naam vestiging en uw naam (linksboven)
- Dagtotaal verkopen en aantal transacties
- Navigatieknoppen: POS, Rapporten, Wisselkoers, Einde dag, Instellingen, Labels
- Knop voor schermtoetsenbord (toetsenbordpictogram)
- Taalkeuze (NL / EN)

**Productraster** — de hoofd-verkoopzone:
- Typ in de zoekbalk om elk product op naam of barcode te vinden
- Klik op een categorieknop om producten te filteren
- Klik of tik op een productkaart om het toe te voegen aan de winkelwagen

**Winkelwagenpaneel** — het lopende totaal rechts:
- Toont elk toegevoegd artikel met prijs en aantal
- Toont subtotaal, BTW-specificatie en totaal in SRD
- Bevat de knop **Afrekenen** om door te gaan naar de betaling
- Bevat de knop **Vasthouden** om de winkelwagen op te slaan en een nieuwe te starten

---

## 1.5 Taal wisselen

Josbin POS is volledig tweetalig — Nederlands en Engels.

1. Zoek de **NL / EN**-knop in de bovenbalk.
2. Klik erop om de gehele interface direct te wisselen.
3. De taalvoorkeur wordt per gebruiker opgeslagen. De volgende keer dat u inlogt, onthoudt het systeem uw keuze.

Bonnen worden afgedrukt in de taal die actief is op het moment van de verkoop.

---

## 1.5a Wat als ik een gele / oranje / rode licentiebanner zie?

Het kan voorkomen dat u een gekleurde banner bovenaan het dashboard ziet wanneer uw winkel inlogt. Deze hoort bij de **Josbin POS-licentie van de vestiging**, niet bij u persoonlijk. Wat elke kleur betekent:

| Banner | Fase | Wat er gebeurt | Wat u doet |
|---|---|---|---|
| 🟢 Geen | Licentie is actief en heeft > 30 dagen over | Normaal gebruik | Niets |
| 🟡 Geel ("30 dagen resterend") | Licentie verloopt binnen 30 dagen | Manager krijgt een dagelijkse e-mailherinnering. POS werkt normaal. | Meld het één keer aan de manager; verder negeren |
| 🟠 Oranje ("14 dagen resterend") | Licentie verloopt binnen 14 dagen | Manager krijgt dagelijkse e-mails. POS werkt normaal. | Meld het vandaag aan de manager |
| 🔴 Rood ("Respijttermijn") | Licentie verlopen, maar de 14-daagse respijttermijn loopt | Volledige POS werkt, maar de manager moet nu verlengen | Vertel het de manager direct aan het begin van uw dienst |
| 🔴 Rood ("Verkopen geblokkeerd") | Respijttermijn verstreken — POS in gedeeltelijke vergrendeling | **U kunt geen nieuwe verkopen voltooien** totdat de licentie is vernieuwd. Bestaande gegevens, rapporten en exports werken nog. | Stop met aanslaan van verkopen. Bel de manager. Zij nemen contact op met Josbin (support@josbin-pos.sr of +597 471-0000). |

> **Waarom dit bestaat:** Suriname ligt ver van het kantoor van de leverancier. Netwerk- of betalingsvertragingen kunnen een winkel onterecht uitsluiten van verkopen. De 30 → 14 → respijt → gedeeltelijke vergrendeling-tijdlijn geeft de manager vier waarschuwingen + 28 dagen van "u kunt nog verkopen" voordat er iets wordt geblokkeerd. Tegen de tijd dat u als kassier ooit "Verkopen geblokkeerd" ziet, heeft de manager al een maand van geel + oranje + rode waarschuwingen gehad — niet uw schuld, niet uw oplossing.

Voor de volledige licentielevenscyclus (acties aan managerzijde, vernieuwingsproces) zie [dashboard-handleiding hfdst 15](../dashboard_manual/15-license-management.md).

---

## 1.6 Uitloggen

1. Klik op uw **naam** of het **uitlog-pictogram** in de bovenbalk.
2. Bevestig het uitloggen.
3. Het inlogscherm verschijnt opnieuw.

> **Belangrijk:** Log altijd uit wanneer u de terminal onbeheerd achterlaat. Het systeem logt u na 15 minuten inactiviteit op het POS-scherm automatisch uit.

---

## Veelvoorkomende problemen bij het opstarten

| Probleem | Oplossing |
|---------|----------|
| Inlogscherm toont "Kan geen verbinding maken met server" | De lokale server draait mogelijk niet. Neem contact op met uw manager of IT-ondersteuning. |
| Wachtwoord wordt geweigerd terwijl u zeker weet dat het correct is | Controleer Caps Lock. Als het nog steeds niet lukt, vraag de manager om het wachtwoord te resetten. |
| Scherm is volledig zwart | Wacht 15 seconden. Als het nog steeds zwart is, sluit en heropen de applicatie. |
| Applicatie wil niet openen | Start de computer opnieuw op en probeer het nog eens. Als het probleem blijft, neem contact op met IT-ondersteuning. |
