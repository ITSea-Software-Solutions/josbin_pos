# 17. Releasenotities — POS-app (Windows & Android)

Beide kassa-apps verschijnen **samen met hetzelfde versienummer** — een
winkel hoeft zich nooit af te vragen of de Windows-kassa's en de
Android-terminals op gelijke software draaien. Elk bestand op de
[downloadpagina](http://142.93.88.143:8095/downloads/) heeft een
`.sha256`-bestand om de download te controleren (zie de
[installatiegids](/nl/docs/00-installation-and-setup) voor hoe).

**Upgraderegel:** nooit eerst de-installeren. Sluit de app (⏻ Afsluiten
op het inlogscherm), draai de nieuwere installer / installeer de nieuwere
APK over de oude — instellingen, serveradres en login blijven bewaard.

## 1.3.0 — 27 juli 2026 *(actueel)*

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
