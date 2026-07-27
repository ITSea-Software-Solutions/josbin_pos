# 15. Android-kassaterminals — de complete gids

Android-kassaterminals (Posiflex RT-serie, Android-tablets en vergelijkbare
apparaten) draaien Josbin POS als **native Android-app** — dezelfde schermen,
dezelfde login en dezelfde serverlogica als de Windows-app, maar het platform
gedraagt zich op een paar punten anders die er in een winkel toe doen. Dit
hoofdstuk bundelt **alles wat Android-specifiek is op één plek**. Zijn uw
kassa's Windows-machines, dan kunt u dit hoofdstuk overslaan.

> **Pilotstatus.** De Android-app is nieuwer dan de Windows-app en wordt nu
> op echte terminals geverifieerd. Plan vóór een eerste livegang op
> Android-hardware een korte testdag: verkopen, printen, lade openen,
> scannen — met uw leverancier erbij.

> **Eerst uitzoomen?** [Hoofdstuk 16](/nl/docs/16-deployment-options) vergelijkt
> alle vier de opzetten (Windows/Android × lokale/cloudserver) met diagrammen.

## 15.1 Het ene denkmodel om te onthouden

**Op Android raakt de terminal alleen de scanner aan. Al het andere loopt
via het netwerk.**

```
                        INTERNET (optioneel — alleen voor
                        hoofdkantoor-sync & licentiecheck)
                            │
                     ┌──────┴──────┐
                     │ WINKELROUTER │  maakt het lokale netwerk
                     └──┬───┬───┬──┘  (werkt ook als internet wegvalt)
             wifi       │   │   │      LAN-kabel
        ┌───────────────┘   │   └───────────────┐
        │                   │                   │
┌───────┴────────┐  ┌───────┴────────┐  ┌───────┴────────┐
│ ANDROID-       │  │ SERVER-PC      │  │ BONPRINTER      │
│ TERMINAL       │  │ (elke Windows- │  │ (LAN-module,    │
│ Josbin POS-app │  │ PC — draait    │  │ poort 9100)     │
│                │  │ het hele       │  │      │ RJ11     │
│  ⌐ USB-dongle  │  │ systeem)       │  │ ┌────┴───────┐  │
│  │ of Bluetooth│  │ 192.168.0.250  │  │ │ GELDLADE    │  │
│ SCANNER        │  │                │  │ └────────────┘  │
└────────────────┘  └────────────────┘  └─────────────────┘
```

Drie gevolgen van dit plaatje:

1. **De bonprinter gaat op het netwerk — of rechtstreeks in de terminal.**
   Vanaf 1.4.1 kan een USB-printer direct op de terminal worden aangesloten
   en eenmalig gekoppeld (§15.9), wat past bij een winkel met één kassa.
   Delen **meerdere kassa's één printer**, dan moet die op het netwerk:
   printers zoals de Posiflex PP-9000 hebben een verwisselbare
   LAN-interfacemodule; daarmee (of met elke Ethernet/wifi-ESC/POS-printer)
   werken bonnen en de geldlade precies zoals op Windows. Een USB-printer
   hoort bij één apparaat.
2. **De geldlade zit nooit aan de terminal.** De RJ11-kabel gaat in de
   **printer**; de app opent de lade met een puls *via* de printer. Geen
   werkende printer → geen lade, op elk platform.
3. **Het lokale netwerk is niet het internet.** De router verbindt terminal,
   server en printer helemaal zelf. Valt het internet weg, dan gaat het
   verkopen door; alleen de hoofdkantoor-sync wacht.

## 15.2 Wat zit waaraan — bekabelingstabel

| Apparaat | Zit aan | Hoe | Opmerkingen |
|---|---|---|---|
| Barcodescanner (bijv. NT-M8) | **De terminal** | USB-dongle in de terminalpoort, of Bluetooth | Gedraagt zich als toetsenbord — niets in te stellen, werkt direct |
| Bonprinter | **De router** (nooit de terminal) | LAN-kabel naar de winkelrouter, printen op poort 9100 | Geef hem een vast/gereserveerd IP (bijv. `192.168.0.251`) |
| Geldlade | **De printer** | RJ11-kabel in de ladepoort van de printer | Opent bij contant/gemengd + de testknop |
| Server-PC | **De router** | LAN-kabel (voorkeur) of wifi | Statisch IP — onze conventie `192.168.0.250` |
| Android-terminal | **De router** | Wifi (de meeste RT-units hebben ook een verborgen RJ45 achter de afneembare achterkap) | Zelfde netwerk als alles hierboven |

## 15.3 De app installeren en bijwerken

**Installeren (eenmalig per terminal):**

1. Open Chrome op de terminal en download de APK — vanuit het eigen
   winkeldashboard (**Dashboard → POS-app → ⬇ Android-app (.apk)** — werkt
   op het winkelnetwerk zonder internet) of via het adres van uw
   leverancier.
2. Tik op het gedownloade bestand. Android vraagt of installaties uit deze
   bron mogen — sta het toe (*Onbekende apps installeren*). Die vraag komt
   maar één keer.
3. Open **Josbin POS** → **⚙ Server** op het inlogscherm → vul het
   serveradres in (meestal `192.168.0.250:8080`) → **Test** → **Opslaan**.
4. Inloggen. Klaar — adres en instellingen worden onthouden.

**Bijwerken:** installeer de nieuwere APK over de oude heen. Instellingen,
serveradres en login blijven bewaard. Automatisch bijwerken is er (nog)
niet — staat er een nieuwe versie op de winkelserver, dan toont de
POS-app-kaart in het dashboard het nieuwe versienummer.

**Meer terminals:** elke extra kassa is dezelfde drie stappen — wifi,
zelfde APK, zelfde serveradres. Alle kassa's delen producten, voorraad en
rapporten via die ene server.

## 15.4 Elke verbinding controleren — vanuit de app zelf

| Wat | Waar controleren | Groen betekent |
|---|---|---|
| Backend-server | Inlogscherm → **⚙ Server → Test** (en de **Online**-indicator op het POS-scherm, live) | De kassa kan verkopen |
| Bonprinter | **Instellingen → Hardware → Test bonprint** | Er print een echte testbon via exact hetzelfde pad als verkoopbonnen |
| Geldlade | **Instellingen → Hardware → Test geldlade** | De lade springt open — het printerpad werkt volledig |
| Labels printen | **Instellingen → Hardware → Test labelprint** | De Android-printdialoog opent met een testlabelvel |
| Scanner | Richt op een willekeurige barcode | Cijfers verschijnen in de zoekbalk — dát is de test |

Blijven de printertests rood: de printer is niet bereikbaar op het netwerk.
Controleer de LAN-kabel en of het IP in **Instellingen → Hardware** klopt
met het echte adres van de printer (print de zelftestpagina — voedknop
ingedrukt houden bij inschakelen — om het IP te zien).

## 15.5 Wat verschilt van de Windows-app

| Mogelijkheid | Windows-app | Android-app |
|---|---|---|
| Bonprinter via USB | ✅ | ✅ vanaf 1.4.0 — op de terminal aansluiten, eenmalig koppelen bij Instellingen → Hardware |
| Bonprinter via netwerk (poort 9100) | ✅ | ✅ |
| Geldlade (via printer) | ✅ | ✅ |
| USB/Bluetooth-barcodescanner | ✅ | ✅ |
| Labels printen | ✅ systeemdialoog | ✅ Android-printdialoog (netwerk-/kantoorprinters die Android kent; rauwe thermische bonprinters verschijnen daar niet) |
| 🔍 Zoek mijn server (netwerkscan) | ✅ | ❌ — typ het adres eenmalig |
| Camera als barcodescanner | ✅ | ❌ voorlopig — gebruik de handscanner |
| Automatisch bijwerken | installer opnieuw draaien | nieuwe APK over de oude installeren |
| App-grootte | ~108 MB | ~4 MB (gebruikt de browserengine van Android zelf) |

Alles wat hier niet staat — verkopen, betalingen, BTW (inclusief
vrijstelling), kortingen, bonnen parkeren, retouren, kassasessies,
Z-rapporten, rapporten, talen — is identiek op beide platforms.

## 15.6 Veldchecklist voor een Android-winkel

- [ ] Server-PC op een **statisch IP** (`192.168.0.250`) — gewone DHCP
      breekt elke kassa na een routerherstart
- [ ] Printer op een **gereserveerd IP** (bijv. `192.168.0.251`), LAN-kabel
      goed vast
- [ ] Lade-RJ11 in de printer, nergens anders in
- [ ] Terminal op de winkelwifi, ⚙ Server-test groen
- [ ] Alle vier de controles uit §15.4 groen
- [ ] Server-PC aan een kleine **UPS**, back-ups ingesteld — die PC is nu
      het kasboek van de winkel
- [ ] Internetplan: stabiele lijn, telefoonhotspot als terugval, of bewust
      offline draaien (de licentiecheck verdraagt 72 uur offline; langere
      periodes gebruiken de USB-exportroute voor hoofdkantoor-sync)
- [ ] Testdag gedaan: verkopen, printen, lade, scannen, retour, Z-rapport

## 15.7 Problemen oplossen

| Symptoom | Oorzaak | Oplossing |
|---|---|---|
| App toont een leeg/wit scherm | De Android WebView van de terminal is sterk verouderd | Open `http://<server>:8091` in Chrome op de terminal — rendert dat, dan rendert de app ook; werk "Android System WebView" bij via de Play Store indien aanwezig |
| ⚙ Server-test faalt, maar de browser op de terminal bereikt hetzelfde adres wél | Verkeerd adresformaat | Vul alleen `IP:poort` in (bijv. `192.168.0.250:8080`) — de app vult de rest zelf aan |
| Achterkant printer toont alleen **voeding + USB + DK** | De USB-interfacekaart is gemonteerd — geen netwerkmogelijkheid. DK is de **lade**-poort (RJ11), geen netwerkpoort; steek er nooit een LAN-kabel in | Bestel de **LAN/Ethernet-interfacekaart voor de PP-9000 (Aura)-serie** bij de hardwareleverancier — twee schroeven, wisselen, klaar. Let op: een USB-naar-Ethernet-*adapter* werkt NIET (die geeft een computer een netwerkpoort, hij maakt een printer niet netwerkgeschikt). Tijdelijk met een Windows-PC: de printerbrug, §15.8 |
| Printertest rood, printer staat aan | Printer niet op het netwerk, of verkeerd IP in Instellingen | Print de zelftestpagina voor het echte IP; controleer de LAN-kabel en de IP-reservering in de router |
| Lade opent niet maar bonnen printen wel | Ladekabel | Steek de RJ11 opnieuw in de ladepoort van de printer (niet de telefoonlijnpoort) |
| "Installatie geblokkeerd" bij het openen van de APK | Toestemming onbekende bronnen | Sta *Onbekende apps installeren* toe voor Chrome zodra Android het vraagt |
| Labeltest opent een dialoog zonder printers | Android toont alleen kantoor-achtige netwerkprinters | Print labels vanaf de PC van de manager — labels zijn een backoffice-taak; bonnen op de kassa werken gewoon |
| Verkopen falen met een serverfout nadat de wifi veranderde | Router heeft nieuwe adressen uitgedeeld | Loop §15.6 na: statisch IP voor de server, gereserveerd IP voor de printer |


## 15.8 Printer met alleen USB + één Windows-PC — de printerbrug

**De situatie:** de winkel heeft een bonprinter met alleen USB (achterop
alleen voeding + USB + DK), de kassa's zijn Android, en er is één
Windows-PC in de zaak. In plaats van te wachten op de LAN-interfacekaart
van de printer kan de Windows-app zich gedragen als de netwerkkaart van de
printer:

```
Android-kassa ──wifi──▶ Windows-PC (Josbin POS-app, ── USB ──▶ printer ──RJ11──▶ lade
                        "Printer delen" AAN, poort 9100)
```

**Instellen (eenmalig, ±10 minuten):**

1. Installeer de Josbin POS Windows-app op de Windows-PC en sluit de
   printer aan via USB.
2. Zorg dat Windows de printer kent: *Instellingen → Bluetooth en
   apparaten → Printers*. Geen Posiflex-driver bij de hand? Voeg hem
   handmatig toe met de driver **"Generic / Text Only"** op de USB-poort —
   voor rauwe bonprints is meer niet nodig.
3. In de Josbin POS-app: **Instellingen → Hardware → type USB → kies de
   printer → Test bonprint** (en Test geldlade). Beide moeten groen zijn
   voordat u verdergaat.
4. Zet **📡 Deze printer delen op het netwerk** aan. De app toont het adres
   van deze pc, bijv. `192.168.0.17:9100`.
5. Op elke Android-kassa: **Instellingen → Hardware → type Netwerk → vul
   dat adres in → Test**. Groen = klaar; bonnen en de lade werken nu vanaf
   elke kassa.

**De spelregels:**

- De Windows-PC moet **aan** staan zodat de andere kassa's kunnen printen —
  beschouw hem als onderdeel van de printer. (Het mag de server-PC van de
  winkel zijn; die staat toch aan.)
- Opdrachten van meerdere kassa's worden automatisch **na elkaar in de rij**
  gezet — twee kassa's die in dezelfde seconde printen krijgen allebei hun
  bon.
- Dit is het antwoord voor **kleine winkels en dag één**. Voor winkels met
  meerdere toonbanken: monteer de LAN-interfacekaart in de printer van elke
  toonbank — de brug is een overbrugging en één storingspunt, niet de
  architectuur.
- De deel-schakelaar overleeft herstarts — de app zet de brug zelf weer aan
  wanneer de pc opstart.


## 15.9 USB-printer rechtstreeks op de terminal *(vanaf 1.4.1)*

Een bonprinter met alleen een USB-kabel heeft geen LAN-kaart of Windows-PC
er tussenin meer nodig: sluit hem op de Android-terminal aan en koppel hem
eenmalig.

::: warning Gebruik 1.4.1 of nieuwer
Op 1.4.0 bleef de printerlijst altijd leeg — de app had van Android geen
USB-toegang gekregen. Vindt **USB-printer verbinden** niets, controleer
dan eerst de versie: **Instellingen → Systeem**.
:::

1. USB-kabel van de printer → de terminal. Printer aan, lade-RJ11 in de
   **DK**-poort van de printer.
2. In Josbin POS: **Instellingen → Hardware → type USB → 🔌 USB-printer
   verbinden**.
3. Kies uw printer uit de lijst. Android vraagt eenmalig of Josbin POS hem
   mag gebruiken — sta dat toe (vink "altijd" aan als dat wordt
   aangeboden).
4. **Test bonprint** en **Test geldlade**. Groen = klaar.

De koppeling blijft behouden als de kabel opnieuw wordt ingestoken en als
de terminal herstart (de printer wordt onthouden op merk/model, niet op de
poort die hij toevallig kreeg).

**Welke route kiezen**

| Situatie | Beste route |
|---|---|
| Eén terminal, één printer, zelfde toonbank | **USB rechtstreeks** — het eenvoudigst, geen netwerk nodig |
| Meerdere kassa's delen één printer | **Netwerkprinter** (LAN-kaart) — een USB-printer hoort bij één apparaat |
| Printer ver van de kassa | Netwerk |

**Als de printer niet verschijnt**

De app vertelt welke van de drie oorzaken het is:

| Wat het scherm zegt | Wat het betekent | Wat te doen |
|---|---|---|
| *Geen USB-apparaten gevonden* | USB werkt, er is niets aangesloten | Controleer of de kabel in een USB-poort van de terminal zit (niet een poort die alleen laadt) en of de printer aanstaat |
| *Deze terminal heeft geen USB-hostpoort* | De terminal kan helemaal geen USB-apparaten aansturen | Gebruik een netwerkprinter, of de printerbrug op een Windows-kassa (§15.6) |
| *USB-printen vereist de Android-app 1.4.1 of nieuwer* | Oudere APK | Installeer de actuele APK via de downloadpagina |
| Apparaat staat er grijs bij als *geen printer* | Het ís geen printer — de regel eronder noemt wat het wél is (toetsenbord/HID = uw scanner, hub, opslag) | Kies de printer; staat de printer zélf grijs, stuur ons die regel dan door |

Vanaf 1.4.1 biedt de terminal ook zelf aan de printer te verbinden zodra u
hem voor het eerst aansluit.

**Scanner en printer op dezelfde terminal** — beide gaan tegelijk in de
USB-poorten van de terminal; ze zitten elkaar niet in de weg. De scanner
hoeft helemaal niet gekoppeld te worden: hij gedraagt zich als een
toetsenbord en wordt overal op het verkoopscherm gelezen, ook direct na het
aantikken van een product in het raster.

**Zelf de APK bouwen** — gereedschap, stap-voor-stap commando's, hoe u
controleert of een build uw wijziging écht bevat, en een release
publiceren: [hoofdstuk 13](/nl/docs/13-dev-workflow).

**Waar de rest staat:** korte installatiestappen in de
[installatiegids §E5](/nl/docs/00-installation-and-setup), welke
winkelopzet bij welke winkel past in
[§7.0 van het offline-hoofdstuk](/nl/docs/07-sync-and-offline), en
licenties in [hoofdstuk 11](/nl/docs/11-license-and-delivery) — een
Android-kassa telt precies zo mee voor de licentie als een Windows-kassa.
