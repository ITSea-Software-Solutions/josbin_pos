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

## 1.4.0 — 27 juli 2026 *(actueel)*

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
