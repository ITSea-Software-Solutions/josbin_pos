# Licentieovereenkomst Josbin POS — WERKCONCEPT (NL)

> ⚠️ **CONCEPT — GEEN JURIDISCH ADVIES.** Dit is een werksjabloon opgesteld
> door het ontwikkelteam zodat de jurist niet vanaf nul begint. Laat het
> door een Surinaamse advocaat toetsen en aanpassen vóór ondertekening.
> Tekst tussen [vierkante haken] moet per klant worden ingevuld.

**Partijen**

1. **Leverancier:** [ITSea / Josbin — volledige bedrijfsnaam, KKF-nummer,
   adres, Paramaribo, Suriname] ("Leverancier");
2. **Licentienemer:** [bedrijfsnaam / overheidsorgaan, KKF- of
   registratienummer, adres] ("Klant").

Samen "Partijen". Deze overeenkomst betreft de programmatuur **Josbin POS**
(kassasysteem, beheerdashboard, winkelserverprogrammatuur, integratie-API en
bijbehorende documentatie — samen de "Programmatuur").

---

## 1. Definities

- **Licentiecertificaat:** de bijlage (Bijlage A) die per installatie
  vastlegt: organisatie, aantal vestigingen, aantal kassaterminals,
  licentieklasse, ingangsdatum, einddatum en vergoeding.
- **Installatie:** één winkelserver met de daaraan gekoppelde
  kassaterminals op één vestigingsadres.
- **Licentieserver:** de door Leverancier beheerde dienst waarmee de
  Programmatuur haar licentiestatus controleert.
- **Klantdata:** alle gegevens die door of voor de Klant in de
  Programmatuur worden ingevoerd of gegenereerd (verkopen, producten,
  klantgegevens, rapporten, auditlogboek).

## 2. Licentieverlening

2.1 Leverancier verleent de Klant een **niet-exclusieve, niet-overdraagbare
licentie** om de Programmatuur te gebruiken voor de eigen bedrijfsvoering,
beperkt tot het aantal vestigingen en kassaterminals in het
Licentiecertificaat.

2.2 De Programmatuur wordt **in licentie gegeven, niet verkocht**. Alle
intellectuele-eigendomsrechten blijven bij Leverancier [en/of diens
toeleverancier van programmatuurontwikkeling].

2.3 Uitbreiding (extra vestiging of terminal) gebeurt via een aangepast
Licentiecertificaat; de Programmatuur toont "licentielimiet bereikt" op
terminals boven het gelicentieerde aantal totdat de uitbreiding is
vastgelegd.

## 3. Wat de Klant niet mag

De Klant zal niet, en staat derden niet toe om:

a. de Programmatuur te kopiëren anders dan voor back-updoeleinden binnen de
   eigen installatie;
b. de Programmatuur te verhuren, te sublicentiëren, door te verkopen of
   anderszins aan derden ter beschikking te stellen;
c. broncode te herleiden, te decompileren of te demonteren, met inbegrip
   van pogingen de versleutelde (IonCube-gecodeerde) bestanden leesbaar te
   maken, behoudens voor zover dwingend recht dit toestaat;
d. de licentiehandhaving (hardwarebinding, licentiecontroles,
   vergrendelingen) te omzeilen, uit te schakelen of te manipuleren;
e. merk-, eigendoms- of auteursrechtvermeldingen te verwijderen.

## 4. Licentiehandhaving en telemetrie

4.1 Elke Installatie is gebonden aan een hardware-vingerafdruk (o.a.
netwerkadres, processor-ID en installatie-ID). Overzetting naar andere
hardware vereist heruitgifte door Leverancier.

4.2 De Programmatuur meldt zich bij opstarten en ten minste dagelijks bij
de Licentieserver. Daarbij worden uitsluitend licentiegegevens verzonden
(licentie-ID, vingerafdruk, aantallen vestigingen/terminals,
programmaversie). **Er worden geen verkoop- of klantgegevens verzonden.**

4.3 Is de Licentieserver tijdelijk onbereikbaar, dan functioneert de
Programmatuur ten minste **72 uur** ongewijzigd door (offline-coulance).

## 5. Looptijd, verlenging en vergrendeling

5.1 De licentie geldt voor de periode in het Licentiecertificaat en wordt
verlengd door tijdige betaling van de verlengingsvergoeding.

5.2 Bij het naderen en verstrijken van de einddatum geldt het volgende
traject, dat de Programmatuur zelf handhaaft:

| Moment | Werking |
|---|---|
| 30 dagen vóór einddatum | Volledige werking; herinnering in het dashboard en per e-mail |
| 14 dagen vóór einddatum | Volledige werking; dagelijkse herinneringen |
| Einddatum → +14 dagen (coulance) | **Volledige werking**, waarschuwing alleen zichtbaar voor beheerders |
| +14 dagen (zachte vergrendeling) | **Nieuwe verkopen geblokkeerd.** Alle bestaande gegevens, rapporten, BTW-exports en audit-exports blijven volledig toegankelijk |
| Zachte vergrendeling +30 dagen (harde vergrendeling) | Aanmelden geblokkeerd; gegevensexport blijft op verzoek beschikbaar gedurende 90 dagen (art. 6) |
| Verlenging (op elk moment) | Onmiddellijke heractivering, zonder herinstallatie |

## 6. Klantdata — eigendom en continuïteit

6.1 **Klantdata is en blijft eigendom van de Klant.**

6.2 Ook bij zachte of harde vergrendeling houdt de Klant recht op export
van de Klantdata in gangbare formaten (CSV/PDF; databasekopie op verzoek).
Bij harde vergrendeling blijft deze exportmogelijkheid ten minste
**90 dagen** beschikbaar. Leverancier houdt Klantdata nooit "in gijzeling"
als drukmiddel anders dan de in art. 5 omschreven functionele
vergrendeling.

6.3 Bij beëindiging verwijdert Leverancier op schriftelijk verzoek de bij
Leverancier aanwezige kopieën van Klantdata, behoudens wettelijke
bewaarplichten.

## 7. Ondersteuning en updates

7.1 Een actieve licentie omvat: [omschrijf: updates en foutherstel,
BTW-/compliance-updates bij gewijzigde regelgeving van de Belastingdienst
Suriname, ondersteuningskanaal en reactietijden — verwijs naar een
SLA-bijlage indien gewenst].

7.2 Updates kunnen op afstand of ter plaatse worden geïnstalleerd;
[installatiewijze en planning per klant invullen].

## 8. Privacy (WBP-S)

8.1 Voor persoonsgegevens in de Programmatuur is de Klant
verwerkingsverantwoordelijke; voor zover Leverancier bij ondersteuning of
beheer persoonsgegevens verwerkt, handelt hij als verwerker.

8.2 Partijen sluiten waar vereist — in ieder geval bij
overheidsopdrachten — een afzonderlijke **Verwerkersovereenkomst**
conform de Wet Bescherming Persoonsgegevens Suriname. [Bijlage B.]

## 9. Controle (audit)

9.1 Leverancier mag naleving van de aantallen (vestigingen/terminals)
vaststellen via de licentietelemetrie van art. 4.

9.2 Bij gerede twijfel mag Leverancier, met redelijke aankondiging van ten
minste [10] werkdagen en tijdens kantooruren, ter plaatse de naleving
controleren, zonder onnodige verstoring van de bedrijfsvoering.

## 10. Garantie en aansprakelijkheid

10.1 Leverancier spant zich in dat de Programmatuur in hoofdzaak
functioneert zoals in de documentatie beschreven, en herstelt gemelde
fouten binnen redelijke termijn. Voor het overige wordt de Programmatuur
geleverd "zoals zij is".

10.2 De totale aansprakelijkheid van Leverancier per jaar is beperkt tot
de door de Klant in de voorafgaande 12 maanden betaalde
licentievergoedingen, behoudens opzet of bewuste roekeloosheid.
[Aansprakelijkheidsregime door advocaat laten toetsen aan Surinaams
recht.]

10.3 Leverancier is niet aansprakelijk voor indirecte schade, gederfde
winst of gevolgschade, noch voor schade door gebruik in strijd met de
documentatie of door niet door Leverancier aangebrachte wijzigingen.

## 11. Beëindiging

11.1 Ieder der Partijen kan de overeenkomst schriftelijk beëindigen bij
een wezenlijke tekortkoming die niet binnen [30] dagen na ingebrekestelling
is hersteld.

11.2 Bij beëindiging eindigt het gebruiksrecht; art. 6 (dataexport),
art. 8 (privacy) en art. 10 (aansprakelijkheid) blijven van kracht.

## 12. Slotbepalingen

12.1 Op deze overeenkomst is **Surinaams recht** van toepassing; geschillen
worden voorgelegd aan de bevoegde rechter te **Paramaribo** [of arbitrage —
keuze door advocaat/partijen].

12.2 Rechten uit deze overeenkomst zijn zonder schriftelijke toestemming
niet overdraagbaar. Nietigheid van een bepaling laat de overige bepalingen
in stand. Deze overeenkomst met bijlagen vormt de volledige afspraak.

---

**Ondertekening**

| | Leverancier | Klant |
|---|---|---|
| Naam | | |
| Functie | | |
| Datum | | |
| Handtekening | | |

**Bijlage A — Licentiecertificaat:** organisatie: [—]; vestigingen: [N];
kassaterminals: [N]; licentieklasse: [—]; ingangsdatum: [—]; einddatum:
[—]; vergoeding: [SRD —] per [jaar]; contactpersoon licenties: [—].

**Bijlage B — Verwerkersovereenkomst** (indien van toepassing, met name
overheidsorganen): [afzonderlijk document].
