# 20. Bouwplan voor de opsplitsing — waarom, wat verhuist, en wat niet mag breken

[Hoofdstuk 19](/nl/plan/19-three-node-architecture) beschrijft het doel: drie
zelfstandige knooppunten. Dit hoofdstuk gaat over hoe we daar komen **zonder iets
te verliezen wat we al hebben**.

Lees §20.3 vóór u code schrijft. Het is de lijst van wat vandaag werkt, en de
herstructurering is pas geslaagd als dat alles daarna nog steeds werkt.

---

## 20.1 Waarom we dit doen

Vier redenen, in de volgorde waarin ze tellen.

**1. De pc van de winkel is niet ons gebouw.** Vandaag zou een winkelinstallatie
het hele product meenemen: licentie-uitgifte, rapportage over organisaties heen,
vlootbeheer. Die machine staat achter iemand anders zijn toonbank, en wie hem in
handen heeft, kan de schijf lezen. Encoderen vertraagt dat; **de code niet
meeleveren beëindigt het**.

**2. Overheidsgegevens moeten apart staan, en dat hebben we gezegd.** Het
nalevingsstandpunt is dat gegevens van de Belastingdienst nooit een database
delen met commerciële klanten. Op dit moment delen ze een database met alles. Een
apart belastingknooppunt maakt die belofte waar in plaats van bedoeld.

**3. Offline moet structureel zijn, niet toevallig.** Een winkel verkoopt vandaag
zonder internet omdat het verkooppad nu eenmaal lokaal is. Na de opsplitsing is
het lokaal *door constructie* — er zit geen beheercode in het knooppunt die ooit
een netwerk zou willen.

**4. Schadebereik.** Één database betekent dat één slechte migratie elke klant én
de Belastingdienst tegelijk raakt. Drie databases betekent dat een winkelupdate
geen aangiftedeadline kan omleggen.

---

## 20.2 Wat we bouwen

Één repository, één gedeelde domeinkern, drie uitrolbare knooppunten.

```
backend/
├── domain/                    ← gedeeld, ÉÉN KEER geschreven
│   ├── Btw/                     tarieven, vrijstelling, korting-dan-BTW
│   ├── Money/                   SRD decimaal, afronding
│   ├── Receipt/                 de bonopbouw
│   └── Contracts/               vorm van sync- en aangiftepayloads, geversioneerd
│
├── nodes/
│   ├── Shop/                  ← geïnstalleerd in de winkel
│   │   kassa · assortiment · kassasessies · verkopen · klanten · eigen gebruikers
│   │   eigen rapporten · licentie CONTROLEREN · synccliënt · aangiftecliënt
│   │
│   ├── Control/               ← wij hosten dit, één exemplaar
│   │   organisaties · licentie UITGEVEN (bewaart de ondertekensleutel)
│   │   vloot · geconsolideerde rapportage · distributie van installers
│   │
│   └── Tax/                   ← Belastingdienst, eigen database
│       aangiften · inspecteursdashboard · bezwaren · auditexport
│
└── config/josbin_node.php     ← welk knooppunt deze build is
```

**Waarom één repository en niet drie.** De BTW-engine, de geldafronding en de
bonopbouw moeten in alle drie byte-identiek zijn. Drie exemplaren lopen uiteen, en
de dag dat een winkelbon SRD 122,35 zegt terwijl de Belastingdienst 122,34 ziet,
is dat een nalevingsincident met de naam van onze klant erop — geen bugmelding.
Één kern, drie dunne knooppunten, en de geëncodeerde build van elk knooppunt
bevat alleen zijn eigen map.

Het knooppuntprofiel bepaalt welke routes worden geregistreerd, welke migraties
draaien en welke modules laden. Een winkelbuild bevat `nodes/Control` fysiek niet.

---

## 20.3 De vrieslijst — wat moet blijven werken

**220 gecatalogiseerde functies: 193 opgeleverd, 12 gedeeltelijk, 15 nog niet
begonnen.** De volledige inventarisatie met status per functie staat in de
functiecatalogus; deze tabel is de eigendomskaart, en dat is het deel dat de
opsplitsing fout kan doen.

De gevaarlijke rijen zijn die welke **splitsen**. Een functie die van één
knooppunt is, verhuist schoon. Een functie die in twee knooppunten bestaat, is de
plek waar gedrag stil verdwijnt, omdat elke kant aanneemt dat de andere het heeft
behouden.

| Gebied | Rijen | Gaat naar | Risico |
|---|---|---|---|
| **Kassa — kassa & verkoop** | 43 | Winkel | Schone verhuizing |
| **Assortiment & voorraad** | 23 | Winkel | Schone verhuizing |
| **Instellingen & apparaat** | 24 | Winkel, grotendeels | ⚠️ **Splitst** — organisatiebeleid blijft in Beheer |
| **Rapporten** | 16 | Alle drie | ⚠️ **Splitst in drieën** — eigen vestiging / geconsolideerd / aangiften |
| **BTW-aangiften** | 29 | Winkel dient in, Belasting ontvangt | ⚠️ **Meest gesplitste gebied** — 12 van de 29 in tweeën |
| **Authenticatie & sessie** | 11 | Alle drie | ⚠️ **Splitst in drieën** — drie onafhankelijke gebruikerstabellen |
| **Licentie** | 10 | Beheer geeft uit, Winkel controleert | ⚠️ **Splitst** — precies waar deze wijziging om gaat |
| **Organisatie- & gebruikersbeheer** | 17 | ⚠️ **Splitst** | Beheer bezit het organisatierecord; Winkel bezit haar eigen gebruikers |
| **Integratie-API (laag 3)** | 10 | Beheer | Zie hoofdstuk 21, D5 |
| **Audit & naleving** | 9 | Alle drie, elk apart | Elk knooppunt houdt een eigen alleen-toevoegen-log |
| **Synchronisatie & offline** | 8 | Cliënt in Winkel + server in Beheer | ⚠️ **Splitst** — dit *is* de verbinding |
| **AI-laag** | 7 | Beheer | Heeft internet nodig; kan niet in een offlineknooppunt wonen |
| **Hardware (printer, lade, scanner)** | 2 | Winkel | Schone verhuizing |
| **Klanten** | 2 | Winkel | Verlaat de winkel nooit — WBP-S |

### De negen kritieke doorlopen

Dit zijn end-to-end-trajecten, en elk ervan moet na de opsplitsing op echte
hardware doorlopen worden. Een groene testsuite is hiervoor geen bewijs.

1. Nieuwe organisatie in gebruik nemen — *verandert het meest; wordt de activatieflow*
2. Kassamedewerker opent dienst, verkoopt, sluit af — **mag helemaal niet veranderen**
3. Manager sluit de dag af (Z-rapport) — **mag helemaal niet veranderen**
4. Levensloop van de licentie: uitgifte → verlopen → verlengen → zachte blokkade → harde blokkade — *herzien*
5. Offline verkoop → herstel via de vijflaagse terugval — **mag helemaal niet veranderen**
6. Overdracht bij volgende dienst — **mag helemaal niet veranderen**
7. Integratie met kassa van derden — *hoort nu bij Beheer, zie hoofdstuk 21, D5*
8. BTW-aangifte aan de Belastingdienst — *verandert; wordt rechtstreeks indienen*
9. Ochtendherstel: gisteren is nooit afgesloten — **mag helemaal niet veranderen**

Vijf van de negen moeten ongewijzigd doorkomen. Gedraagt een ervan zich daarna
anders, dan is de herstructurering fout — niet het traject.

### Verlies het onafgemaakte werk niet

12 functies zijn gedeeltelijk en 15 nog niet begonnen. Ze zijn makkelijk kwijt te
raken bij een grote verhuizing, want er gaat niets stuk als ze verdwijnen. Neem de
catalogusrijen mee met hun status intact, inclusief de nog openstaande
Sranantongo-review en de uitgestelde punten rond verkoopnummers en
kortingen bij retour.

---

## 20.4 De regel voor elke stap

**Geen enkele stap verandert gedrag en verplaatst code tegelijk.**

Een stap doet één van twee dingen:
- code verplaatsen met byte-identiek gedrag (bewijs: de suite slaagt onaangeraakt), of
- op één plek gedrag veranderen, met de structuur al vastgelegd.

Die twee mengen is hoe een herstructurering een functie verliest die niemand een
maand lang mist.

---

## 20.5 Volgorde van werken, met de poort per stap

| # | Stap | Poort vóór verder |
|---|---|---|
| 1 | `domain/` uitsnijden — BTW, geld, bon | Volledige suite groen, **geen test aangepast**. Moest een test wijken, dan is gedrag veranderd. |
| 2 | `nodes/Shop` · `Control` · `Tax` uitsnijden, nog één uitrol | Alle 9 trajecten doorlopen; de app start nog als één geheel |
| 3 | Knooppuntprofiel + aparte migraties per knooppunt | Elk knooppunt migreert van leeg naar een werkende database |
| 4 | Ondertekende licentie: uitgeven in Beheer, controleren in Winkel | Traject 4 opnieuw doorlopen; **controleer met de netwerkkabel eruit** |
| 5 | Activatieflow + eerste beheerder aanmaken | Traject 1 volledig doorlopen op een schone machine |
| 6 | Drie buildtargets, drie compose-bestanden | Een winkelbuild bevat geen `nodes/Control`-code — controleer het artefact |
| 7 | Rechtstreekse BTW-aangifte, ondertekend door de winkel | Traject 8 opnieuw doorlopen; een aangifte valideert tegen de sleutel van de winkel |

Stap 1 tot en met 3 zijn zuivere herstructurering en kunnen nu al beginnen. Stap 4
tot en met 7 hangen af van de beslissingen die inmiddels in
[hoofdstuk 21](/nl/plan/21-migration-record) zijn vastgelegd.

---

## 20.6 Inmiddels besloten

> Dit waren de openstaande punten. Ze zijn nu beslist — zie
> [hoofdstuk 21](/nl/plan/21-migration-record) voor de keuzes en de onderbouwing:
> knooppunten per vestiging met het schema intact, afschalen in plaats van
> buitensluiten plus broncode-escrow, wij hosten het belastingknooppunt als apart
> systeem, laag 3 in het beheerknooppunt, en één beheerdatabase plus versleutelde
> archieven per winkel.

Hieronder bewaard als vastlegging van wat openstond:

1. **Eén knooppunt per organisatie, of per vestiging?** Vijf filialen: één server
   op het hoofdkantoor of vijf? Bepaalt wat de licentielimieten tellen.
2. **Escrow** — als de leverancier verdwijnt, blijft een winkel dan handelen?
3. **Wie host het belastingknooppunt** — de Belastingdienst, of wij namens hen?
4. **Waar hoort de integratie-API van laag 3?** Een kassa van derden die verkopen
   aanlevert: naar het winkelknooppunt op het winkelnetwerk, of naar het
   beheerknooppunt over internet? Het winkelknooppunt betekent geen
   internetafhankelijkheid maar ook geen vast publiek adres; het beheerknooppunt
   precies omgekeerd.

---

## 20.7 Wat we uitdrukkelijk niet veranderen

Zodat niemand deze dingen halverwege de herstructurering optimistisch "opruimt":

- **De BTW-berekening.** Korting vóór BTW, omgang met vrijstelling, afronding —
  verhuist naar `domain/`, ongewijzigd, tests onaangeraakt.
- **De bon.** Opmaak, ESC/POS-bytes, de gedrukte markeringen.
- **De kassaschermen.** De dag van een kassamedewerker verandert niet omdat de
  servers veranderd zijn.
- **Geldprecisie.** DECIMAL(12,2), nooit een floating point.
- **AST-tijdstempels.** Elk datumbereik blijft Surinaamse tijd.
- **De onveranderlijkheid van het auditlog.** Alleen toevoegen, in elk knooppunt,
  zonder uitzondering.
