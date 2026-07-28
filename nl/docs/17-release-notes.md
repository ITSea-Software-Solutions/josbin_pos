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

## 1.5.0 — 28 juli 2026 *(actueel)*

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
