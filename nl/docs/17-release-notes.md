# 17. Releasenotities — POS-app (Windows & Android)

Beide kassa-apps verschijnen **samen met hetzelfde versienummer** — een
winkel hoeft zich nooit af te vragen of de Windows-kassa's en de
Android-terminals op gelijke software draaien. Elk bestand op de
[downloadpagina](http://142.93.88.143:8095/downloads.html) heeft een
`.sha256`-bestand om de download te controleren (zie de
[installatiegids](/nl/docs/00-installation-and-setup) voor hoe).

**Upgraderegel:** nooit eerst de-installeren. Sluit de app (⏻ Afsluiten
op het inlogscherm), draai de nieuwere installer / installeer de nieuwere
APK over de oude — instellingen, serveradres en login blijven bewaard.

## 1.5.8 — 28 juli 2026 *(actueel)*

- **Betaling voltooien is bereikbaar zonder scrollen.** Op een kassascherm was
  de contant-stap hoger dan het scherm, waardoor de knop die het geld aanneemt
  onder de rand viel. Het bedrag, het wisselgeld en het toetsenblok staan nu
  naast elkaar in plaats van onder elkaar — de hele stap past ruim, en het
  toetsenblok ligt onder de duim van de kassamedewerker.
- **Etiketten en Wisselkoers zijn nu managerschermen.** Schaplabels worden in
  één keer geprint door wie de goederen geprijsd heeft, en de dagkoers wordt
  één keer voor de hele winkel vastgezet — geen van beide is werk van een
  kassamedewerker, en het kassamenu is er korter door. (Wie vreemde valuta
  aanneemt, krijgt de vastgezette dagkoers nog steeds automatisch toegepast.)
- **Het schermtoetsenbord is weg op Android-terminals**, waar een tik in een
  invoerveld het eigen toetsenbord van de tablet al oproept — het was een
  tweede toetsenbord bovenop het eerste. Op Windows blijft het, want een kassa
  met alleen een aanraakscherm heeft misschien geen andere manier om te typen.
  De bijbehorende schakelaar in Instellingen is verwijderd: die was nooit ergens
  op aangesloten.

## 1.5.7 — 28 juli 2026

- **Eén afbeelding voor het hele platform, onderaan elke bon.** In te stellen
  via Gebruikers → *Stempel onderaan de bon (hele platform)* in het dashboard —
  alleen Super Admin. Hij geldt voor elke winkel die er zelf geen heeft
  geüpload, dus hij hoeft niet per winkel te worden ingesteld en is later te
  wijzigen zonder aan een kassa te komen. Een wijziging is bij de volgende bon
  al van kracht, en elke wijziging staat in het auditlogboek.

## 1.5.6 — 28 juli 2026

- **De bon print nu meteen.** Er zat 3 à 5 seconden tussen het afronden van een
  verkoop en het moment dat er iets bij de printer gebeurde. De kassa vroeg de
  server om de verkoop die hij *net had gekregen* — en dat twee keer, één keer
  voor de verkoop en één keer voor de winkelgegevens — voordat hij de bon kon
  samenstellen. Hij gebruikt nu wat hij al heeft, en de winkelgegevens blijven
  tussen verkopen bewaard in plaats van bij elke klant opnieuw opgehaald.
- **Een winkel kan een eigen afbeelding onderaan de bon zetten.**
  Dashboard → Winkelinstellingen → *Stempel onderaan de bon*. Hij print als een
  stempel op een bonnetje. Thermische printers kennen geen grijstinten, dus een
  egaal beeldmerk met veel contrast werkt het best. Geen upload betekent geen
  afbeelding — standaard wordt er niets geprint.

## 1.5.5 — 28 juli 2026

**De geldlade op Android-terminals — de echte oorzaak, gevonden.**

Het ladesignaal werd als *tweede* opdracht verstuurd, vlak na de bon. Elke
verzending naar een USB-printer op Android neemt de printer exclusief in beslag
en laat hem daarna weer los, dus die tweede verzending pakte de printer terug
terwijl hij de bon nog aan het printen was. Dat midden in het printen doen loopt
het datakanaal van de printer vast, en eenmaal vastgelopen weigert hij alles —
daarom meldde de terminal dezelfde "printer weigerde de overdracht", of het
signaal nu 5 of 10 bytes was, terwijl volledige bonnen prima bleven printen. De
omvang was nooit het punt, en de bedrading evenmin.

- **Het ladesignaal reist nu mee ín de bon** — één verzending, dus er is geen
  tweede die geweigerd kan worden. De printer opent de lade zodra hij begint te
  printen.
- **Een vastgelopen printer maakt zichzelf nu los.** Loopt het datakanaal toch
  vast, dan stuurt de app de standaard USB-herstelopdracht en probeert het
  tweemaal opnieuw — en lukt het dan nog niet, dan meldt hij de USB-kabel los en
  weer vast te maken, want dat is wat het werkelijk verhelpt.
- **Het ladesignaal duurt vier keer zo lang** (200 ms, was 50 ms). De oude
  waarde geldt volgens de printerfabrikant voor een 12V-lade; deze kassa's
  hebben meestal 24V-lades, die hun grendel in die tijd vaak niet omkrijgen.
- **Instellingen → Hardware → Geldlade zoeken** probeert zeven verschillende
  ladesignalen achter elkaar — beide aansluitpennen, drie pulslengtes, en de
  variant voor printers die een signaal zonder papier negeren — elke 2,5
  seconde één, met op het scherm welke er gaat. Tik bij het nummer dat de lade
  opent op *Gebruik deze* en de kassa onthoudt het.
- **De QR-code en het Josbin-logo staan niet meer op de geprinte bon.** De
  afbeelding onderaan is nu die van de winkel zelf; geen upload, geen
  afbeelding.

## 1.5.4 — 28 juli 2026

- **Het signaal naar de geldlade duurt nu vier keer zo lang.** Het was 50 ms,
  de waarde die de printerfabrikant opgeeft voor een 12V-lade; de lades onder
  deze kassa's zijn meestal 24V en krijgen hun grendel in die tijd vaak niet
  om. Het signaal werd correct verstuurd en aangenomen — de lade had simpelweg
  geen tijd om te bewegen, zonder ook maar ergens een foutmelding. Nu 200 ms.
- **Instellingen → Hardware → Geldlade zoeken.** Blijft een lade toch dicht,
  dan stuurt dit zeven verschillende ladesignalen achter elkaar — beide
  aansluitpennen, drie pulslengtes, en de variant voor printers die een
  signaal zonder papier negeren — elke 2,5 seconde één, met op het scherm
  welke er gaat. Kijk naar de lade, tik bij het nummer dat hem opent op
  *Gebruik deze*, en de kassa onthoudt het. Eén test in plaats van gokwerk.
- **De QR-code en het Josbin-logo staan niet meer op de geprinte bon.** De
  afbeelding onderaan is nu die van de winkel zelf; kassa's zonder geüploade
  afbeelding printen er geen.

## 1.5.3 — 28 juli 2026

- **Een controle-QR op elke bon met een BTW-nummer.** Daarin staan het
  BTW-nummer van de winkel plus bonnummer, tijd, totaal en BTW-bedrag — zo is
  het papier in de hand van de klant te vergelijken met de verkoop die het
  systeem heeft vastgelegd. Een bon waarvan de bedragen na het printen zijn
  aangepast, klopt niet meer. Dat is een uitspraak over de belasting op de bon
  die daadwerkelijk te toetsen is, en dat is voor een klant meer waard dan een
  logo.
- **Een winkel kan een eigen stempel uploaden** voor onderaan de bon
  (Instellingen → bonafbeelding van de winkel). Wie niets uploadt, krijgt het
  Josbin-beeldmerk. Een kassa die zijn winkelserver niet kan bereiken, print
  nog steeds een bon met stempel — het terugvalbeeldmerk zit in de app.

## 1.5.2 — 28 juli 2026

- **Geldlade op Android-terminals.** Het ladesignaal werd verstuurd als een
  kaal commando van vijf bytes zonder opdrachtkop. Windows accepteerde dat;
  de Android-USB-verbinding weigerde het botweg — met "0 van 5 bytes
  geschreven" op een printer die net een volledige bon had geprint. Het
  signaal gaat nu als een volwaardige printopdracht, en een overdracht die
  de printer weigert omdat hij nog bezig is, wordt één keer opnieuw
  geprobeerd.
- **Terugkeren naar uw eigen open kassa meldt niet meer dat de kassa in
  gebruik is.** Sluit u de app, logt u uit, of herstart de kassa midden in
  uw dienst, dan komt u nu gewoon weer in uw eigen dienst terecht. De open
  lade van een andere kassamedewerker blijft beschermd.
- **Een Vernieuwen-knop op de kassalijst**, zodat een kassa ziet dat een
  collega zijn lade heeft gesloten zonder uit- en weer in te loggen.
- **Transacties kan weer alles met een bon.** De 🖨-knop bij een eerdere
  verkoop opende alleen de PDF — een klant die terugkwam voor een papieren
  exemplaar kon er geen krijgen. Er opent nu een bonmenu: opnieuw printen op
  de printer van de winkel, PDF, e-mail of WhatsApp.
- **De WhatsApp-bon wordt vanzelf aangeboden** als de klant bij de verkoop een
  telefoonnummer heeft achtergelaten: één knop op het bonscherm, al aan die
  klant geadresseerd. Managers zetten het uit via Instellingen → Printer. Het
  is één tik, niet volautomatisch — WhatsApp accepteert machineberichten
  alleen via de betaalde Business API van Meta, dus de kassamedewerker drukt
  in WhatsApp zelf op verzenden.
- **Het Josbin-beeldmerk print nu onderaan de bon**, als een stempel op een
  bonnetje. (Op papier kan het niet *achter* de tekst staan — een thermische
  printer brandt regel voor regel en heeft niets om overheen te leggen. De
  A4-/PDF-bon heeft wél een echt watermerk.) Uit te zetten via Instellingen →
  Printer.

## 1.5.1 — 28 juli 2026

- **Een geldlade die niet opengaat, vertelt nu waarom.** Hij faalde in
  stilte: de kassa gooide het antwoord van de lade helemaal weg, waardoor
  een lade die nooit openging er precies zo uitzag als een die dat wél deed
  — daarom kostte dit meerdere pogingen. De melding staat nu op het
  bonscherm, naast het printresultaat.
- **De lade wacht tot de bon de printer heeft verlaten** voordat hij klopt.
  Een bon die door Windows is aangenomen is niet hetzelfde als papier dat
  eruit is, en de puls kwam nog midden in het printen aan.
- **Het bonscherm heeft nog twee knoppen: Opnieuw printen en Nieuwe
  verkoop.** PDF, e-mail en WhatsApp gebruikt u later, over een verkoop die
  al gebeurd is — die verhuizen naar Transacties, waar u eerst de juiste
  verkoop opzoekt.
- **Een bewering op het inlogscherm gecorrigeerd.** Er stond "volledig
  offline", en dat was te veel gezegd. De kassa heeft zijn winkelserver
  nodig — die staat alleen ín de winkel, dus internet is niet vereist. Dat
  staat er nu ook zo.

## 1.5.0 — 28 juli 2026

**Nieuwe uitstraling.** De kassa en het dashboard dragen nu de eigen
kleuren van Josbin, overgenomen van de website in plaats van benaderd: het
diepe teal, het oranje en het marineblauw. De kassa blijft donker omdat een
winkel voor zonsopgang opengaat en een wit scherm op dat uur een lamp is;
het dashboard op kantoor blijft licht. Allebei in één oogopslag hetzelfde
product.

- **De Josbin-vleugel is nu het app-icoon** op Windows en Android, het
  browsericoon op elke pagina en het beeldmerk op beide inlogschermen. De
  vorige versie droeg een volledig verkeerd logo.
- **Op elk inlogscherm staat een vierkleurenbalk** — cyaan, magenta, geel
  en zwart, de inkten die een pers aanbrengt.
- **Een mislukte bon vertelt nu waarom.** In plaats van een rode
  "printfout" zonder uitleg toont het scherm de echte melding van Windows
  of van de printerverbinding — bijvoorbeeld dat de printer op zijn adres
  niet bereikbaar was. Dat scheelt tussen zelf oplossen in een minuut en
  moeten bellen.
- **De bon probeert het zelf opnieuw.** De eerste verkoop van de dag
  mislukte wanneer de printer 's nachts had geslapen; hij probeert het nu
  drie keer over ongeveer zeven seconden voordat hij een probleem meldt.

## 1.4.5 — 27 juli 2026

- **De automatische bon mislukt niet meer bij de eerste poging.** De kassa
  stuurde het geldladesignaal en de bon op hetzelfde moment naar de printer;
  die kon er maar één aan, waardoor de bon een fout meldde en de lade dicht
  bleef — en handmatig op Printen tikken wél werkte. Het ladesignaal gaat nu
  *na* de bon, nooit tegelijk, en een bon die alsnog mislukt probeert het
  zelf één keer opnieuw.
- **De lade gaat ook open als de bon niet print.** De klant geeft hoe dan
  ook contant geld.

## 1.4.4 — 27 juli 2026

- **De geldlade gaat weer open bij contante verkopen.** Doordat bonnen
  vanaf 1.4.2 automatisch printen, stuurde de kassa het ladesignaal en de
  bon vrijwel gelijktijdig naar de printer, waarna de printer er één liet
  vallen — de bon kwam eruit, de lade bleef dicht. Het ladesignaal reist nu
  mee ín de bon, dus de printer handelt ze op volgorde af en de lade springt
  open zodra het printen begint. Een latere herdruk opent de lade niet meer.
- **Het betaalscherm begint schoon bij elke verkoop.** Het ontvangen bedrag
  van de vorige klant bleef staan, omdat het betaalvenster opnieuw opende op
  de contant-stap in plaats van de methodelijst. Eén tik op Voltooien kon
  wisselgeld uitbetalen dat op andermans biljet was berekend.
- **Het Josbin-beeldmerk is nu het app-icoon** op Windows en Android.

## 1.4.3 — 27 juli 2026

Verbeteringen aan de geprinte bon, getest op echt bonpapier.

- **TOTAAL valt niet meer over twee regels.** Het wordt in dubbele breedte
  geprint, maar de app rekende met de normale breedte, waardoor het bedrag
  onder het woord TOTAAL belandde. De regel die de klant controleert is nu
  één nette regel.
- **De datum is een Surinaamse datum.** Voorheen stond er de ruwe technische
  tijdcode; nu leest u `27-07-2026 16:42`, in de datumvolgorde die de winkel
  heeft gekozen, en altijd in Surinaamse tijd — ook als de klok van de
  terminal op een ander land staat.
- **De naam van de kassamedewerker staat op de bon** in plaats van een
  interne code.
- **Lange productnamen lopen door op een volgende regel** in plaats van
  afgekapt te worden.
- **BTW staat er één keer, niet twee keer.** Bij één tarief één BTW-regel;
  bij gemengde tarieven elk tarief met het eigen bedrag.
- **Bedragen staan recht onder elkaar.** Artikelprijzen en totalen lezen
  allebei `SRD 12,34`, en tarieven printen als `10%` in plaats van `10.00%`.
- **Smalle 58 mm-rollen houden hun opmaak** — een lange klantnaam gaat naar
  een eigen regel in plaats van het label ernaast af te kappen.

## 1.4.2 — 27 juli 2026

- **De USB-printerinstelling blijft nu staan op Android-terminals.** Een
  overgebleven regel uit de tijd dat USB-printen alleen op Windows werkte,
  zette de printer bij elk bezoek aan Instellingen stilletjes terug op
  "netwerk", waardoor de zojuist gemaakte koppeling verdween. Wie op 1.4.1
  een printer koppelde en hem daarna kwijt was, liep hiertegenaan.
- **De appversie staat nu onderaan Instellingen** (bijv. *v1.4.2 ·
  android*), zodat altijd vaststaat welke versie op een terminal draait.
- **Bonnen en rapporten zeggen BTW, nooit "VAT".** BTW is de naam van de
  belasting in Suriname, dus ook de Engelstalige bon, de Engelstalige
  rapporten, het Belastingdienst-overzicht en de Rekenkamer-export
  gebruiken die term nu — gelijk aan de Nederlandse kant en aan wat de
  Belastingdienst verwacht te lezen.
- **De bon wordt nu vanzelf geprint zodra de verkoop betaald is**, net
  zoals de geldlade al vanzelf opengaat — geen Print meer aantikken bij
  elke verkoop. Kassa's die nog op de oude standaard stonden worden
  automatisch omgezet; uitzetten kan nog steeds via Instellingen →
  Printer.

## 1.4.1 — 27 juli 2026

- **USB-printers verschijnen nu daadwerkelijk op Android-terminals.** De
  app kreeg van Android nooit toegang tot USB, waardoor Instellingen →
  Hardware → USB-printer verbinden niets vond, hoe de printer ook was
  aangesloten. Hij vindt de printer nu wél, en bij het aansluiten wordt
  automatisch aangeboden hem te verbinden.
- **Scannen na het aantikken van een product lukt direct.** De scanner
  wordt nu gelezen ongeacht wat er als laatste is aangeraakt. Voorheen
  bleef het toetsenbord "gericht" op het aangetikte product, waardoor de
  volgende scan niets deed of het aantal van het aangetikte product
  verhoogde, en de code twee keer gescand moest worden.
- **De kassa voelt sneller op Android.** Bij het aantikken van een product
  klapt het schermtoetsenbord niet meer telkens open en dicht.
- **Een printer die niet gevonden wordt, legt nu uit waarom** — geen
  USB-poort op de terminal, niets aangesloten, of een apparaat dat geen
  printer is — en toont wat er wél gevonden is.
- **Bijwerken van een Android-terminal is betrouwbaar.** Elke APK tot nu
  toe had hetzelfde interne buildnummer, waardoor Android een nieuwere
  versie als duplicaat kon zien en de update kon weigeren.

## 1.4.0 — 27 juli 2026

- **USB-bonprinters werken nu rechtstreeks op Android-terminals.** Sluit
  de printer op de terminal aan, koppel hem eenmalig via Instellingen →
  Hardware → USB → USB-printer verbinden, en bonnen én de geldlade
  werken — zonder netwerkkaart in de printer en zonder Windows-PC er
  tussen. Zie het Android-hoofdstuk §15.9.

## 1.3.3 — 27 juli 2026

- **Bijwerken loopt niet meer vast.** De installer sluit een draaiende
  Josbin POS nu zelf af. Oudere versies vroegen u de app handmatig te
  sluiten — onmogelijk op een kassa, waar de app schermvullend draait
  zonder zichtbare sluitknop — en de update liep vast met *"Josbin POS
  kan niet worden gesloten"*.

## 1.3.2 — 27 juli 2026

- **Bonprinten en de geldlade werken nu op Windows.** Er waren twee
  losse fouten: de app gebruikte een oud tekst-printcommando dat de
  stuurcodes van de printer nooit doorgaf, én de bongegevens zaten in een
  vorm die de app helemaal niet aan de printdienst kon doorgeven. Beide
  paden — bonnen en de ladepuls — lopen nu via de raw-printdienst van
  Windows. (De testpagina van Windows zelf werkte altijd al, daardoor
  leek de printer in orde.)
- **Scannen direct na het aantikken van een product.** De cursor springt
  na elke tik op een product terug naar het zoek-/scanveld, zodat de
  volgende scan dát product toevoegt in plaats van het aantal te verhogen
  van het product dat u aantikte.
- **Hardwaretests tonen nu de oorzaak** — een mislukte test bij
  Instellingen → Hardware toont het echte bericht van Windows of het
  netwerk in plaats van alleen rood te kleuren.

- **Bonprinten op Windows hersteld.** Bonnen en de ladepuls gaan nu via
  de raw-printdienst van Windows. De vorige versie gebruikte een oud
  tekst-printcommando dat de stuurcodes van de printer nooit doorgaf — de
  printer bleef stil of gaf een blanco vel, terwijl de testpagina van
  Windows zelf wél werkte.
- **Hardwaretests tonen nu de oorzaak.** Een mislukte test bij
  Instellingen → Hardware toont het echte bericht van Windows (of van het
  netwerk) in plaats van alleen rood te kleuren.

## 1.3.0 — 27 juli 2026

Eerste gesynchroniseerde release: Windows-exe en Android-APK uit dezelfde
code. Alles hieronder geldt voor beide platforms tenzij anders vermeld.

- **BTW-vrijstelling** op de kassa — overheids- en andere vrijgestelde
  kopers betalen prijzen exclusief BTW; verplichte reden op de bon en in
  de rapporten.
- **Zelfstandige ploegwissel** — met het organisatiebeleid aan opent de
  volgende ploeg een gesloten kassa met eigen wisselgeld, zonder
  beheerder.
- **Hardware-testknoppen** — test bonprint, geldlade en labelprint vanuit
  Instellingen → Hardware.
- **Printerbrug** *(Windows)* — deel een USB-bonprinter op het netwerk
  zodat Android-terminals via de Windows-kassa printen.
- **Afsluiten & Uitloggen overal** — ⏻ Afsluiten op het inlogscherm en de
  kassaschermen (Windows); ⎋ Uitloggen op elk kassascherm; een
  geblokkeerde kassa sluit de caissière nooit op ("Doorgaan op een andere
  kassa").
- **Labels printen op Android** — de Labelpagina print via de
  Android-printdialoog.
- **🔍 Zoek mijn server** *(Windows)* — scant het winkelnetwerk naar de
  winkelserver tijdens de installatie.
- **Serveradres instelbaar** — ⚙ Server op het inlogscherm wijst elke
  kassa naar elke server, zonder herbouw.
- Appvenster en installer gebruiken nu allebei de naam **Josbin POS**
  (eerder toonde de venstertitel nog "SuraPOS", waardoor de app in
  Taakbeheer moeilijk te vinden was).

## Oudere versies *(vervangen — upgrade naar 1.3.0)*

| Versie | Platform | Datum | Opmerkingen |
|---|---|---|---|
| 1.1.2 / 1.1.1 / 1.1.0 | Windows | 27 jul 2026 | Tussenbuilds tijdens de printerbrug en afsluitknoppen |
| 1.2.1 / 1.2.0 / 1.1.0 | Android | 26–27 jul 2026 | Tussenbuilds: vrijstellings-UI, ploegwissel, labels printen |
| 1.0.0 | beide | 25 jul 2026 | Eerste veldbuilds voor de kantoortest in Suriname |
