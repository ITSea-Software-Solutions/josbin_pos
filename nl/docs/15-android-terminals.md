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

1. **De bonprinter moet op het netwerk zitten.** USB-printen bestaat niet op
   Android — de app biedt het bewust niet aan. Printers zoals de Posiflex
   PP-9000 hebben een verwisselbare LAN-interfacemodule; daarmee (of met
   elke Ethernet/wifi-ESC/POS-printer) werken bonnen en de geldlade precies
   zoals op Windows.
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
| Bonprinter via USB | ✅ | ❌ — alleen netwerkprinter |
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
| Printertest rood, printer staat aan | Printer niet op het netwerk, of verkeerd IP in Instellingen | Print de zelftestpagina voor het echte IP; controleer de LAN-kabel en de IP-reservering in de router |
| Lade opent niet maar bonnen printen wel | Ladekabel | Steek de RJ11 opnieuw in de ladepoort van de printer (niet de telefoonlijnpoort) |
| "Installatie geblokkeerd" bij het openen van de APK | Toestemming onbekende bronnen | Sta *Onbekende apps installeren* toe voor Chrome zodra Android het vraagt |
| Labeltest opent een dialoog zonder printers | Android toont alleen kantoor-achtige netwerkprinters | Print labels vanaf de PC van de manager — labels zijn een backoffice-taak; bonnen op de kassa werken gewoon |
| Verkopen falen met een serverfout nadat de wifi veranderde | Router heeft nieuwe adressen uitgedeeld | Loop §15.6 na: statisch IP voor de server, gereserveerd IP voor de printer |

**Waar de rest staat:** korte installatiestappen in de
[installatiegids §E5](/nl/docs/00-installation-and-setup), welke
winkelopzet bij welke winkel past in
[§7.0 van het offline-hoofdstuk](/nl/docs/07-sync-and-offline), en
licenties in [hoofdstuk 11](/nl/docs/11-license-and-delivery) — een
Android-kassa telt precies zo mee voor de licentie als een Windows-kassa.
