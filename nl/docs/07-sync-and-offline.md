# 7 — Sync & offline — hoe een winkel blijft verkopen zonder internet

De korte versie:

- **Verkopen heeft nooit internet nodig.** Elke kassa praat met een server
  *in de winkel zelf*, over het eigen netwerk (kabel/wifi). Scannen,
  afrekenen, printen, lade openen, kassa afsluiten — alles werkt met de
  internetkabel eruit, onbeperkt lang.
- **Internet is alleen voor extra's**: het dashboard bereiken van buiten de
  winkel, de dagkoers automatisch ophalen, licentiecontroles en
  e-mailbonnen. Elk daarvan valt netjes terug (details hieronder).
- **De dagcijfers naar het hoofdkantoor krijgen** kan langs meerdere routes
  — van één tik op Verzenden tot een versleuteld USB-bestand dat via
  WhatsApp reist. Een offline dag verandert *hoe de cijfers reizen*, nooit
  *of de winkel kan draaien*.

---

## 7.1 Waarom offline werkt: wat waar geïnstalleerd wordt

Dit wordt bepaald bij de installatie (zie de
[installatiehandleiding](00-installation-and-setup.md)) en is de basis van
het hele offline-verhaal:

```
        DE WINKEL (alles om te verkopen)                   BUITEN
┌─────────────────────────────────────────────┐
│  Back-office-pc — de WINKELSERVER           │      ┌──────────────┐
│  (Docker: database, API, wachtrijen, WS)    │ ← →  │   Internet   │
│                    ▲  ▲  ▲                  │ alleen│ (optioneel) │
│        winkel-LAN  │  │  │                  │ voor └──────────────┘
│   ┌────────┐ ┌────────┐ ┌─────────┐         │ extra's
│   │ Kassa 1│ │ Kassa 2│ │ Manager │         │
│   │Electron│ │Electron│ │ scherm  │         │
│   └────────┘ └────────┘ └─────────┘         │
└─────────────────────────────────────────────┘
```

- De **winkelserver** bevat de database — producten, prijzen, verkopen,
  kassa's, gebruikers. Dit is de bron van de waarheid.
- Elke **kassa** wijst naar het LAN-adres van die server (conventie:
  `192.168.0.250`) — bereikbaar of het pand nu internet heeft of niet.
- Het **dashboard** draait op dezelfde server, dus een manager op het
  winkelnetwerk ziet altijd live cijfers — met of zonder internet.

| Werkt met de internetkabel eruit | Heeft internet nodig |
|---|---|
| Verkopen, alle 7 betaalregistraties, bonnen (print/PDF) | E-mail-/WhatsApp-bonnen die het pand verlaten |
| Barcodes scannen, kortingen, retouren, bonnen parkeren | Het dashboard openen van *buiten* de winkel |
| Kassa openen/sluiten, X/Z-rapporten, kasmutaties | De USD→SRD-dagkoers automatisch ophalen |
| Product- en prijswijzigingen op het lokale dashboard | Dagelijkse licentiecontrole (coulanceregels: §7.4) |
| Alle rapporten over lokale data | Cataloguspushes vanaf een hoofdkantoor elders |

## 7.2 De reis van een verkoop (waarom er nooit iets verloren gaat)

1. De kassier scant en rekent af.
2. De verkoop wordt **eerst vastgelegd in de database van de winkelserver**
   — totalen, BTW, betaalmethode, kassakoppeling. Dit is de enige stap die
   móét slagen, en die gebeurt volledig binnen het pand.
3. De bon print; de lade gaat open; de kassa is klaar voor de volgende
   klant.
4. *Ná* die vastlegging reizen kopieën verder (naar hoofdkantoor, webhooks,
   e-mail) zodra er een route beschikbaar is.

Omdat stap 2 nooit internet gebruikt, kan een internetstoring geen verkoop
blokkeren of kwijtraken. De nachtelijke back-up (en wekelijkse volledige
snapshot) van de winkelserver beschermt de lokale database zelf.

## 7.3 De dag naar het hoofdkantoor — de routes, stap voor stap

Twee installatievormen zijn van belang:

**Vorm A — één vestiging (de standaardinstallatie van vandaag).** Het
dashboard draait op de winkelserver; de eigenaar opent het in de winkel
(altijd live) of via internet vanuit huis (dan moet de winkel op dat moment
online zijn). Er valt niets te "syncen" — er is één database.

**Vorm B — meerdere vestigingen met een cloud-hoofdkantoor.** Elke
vestiging heeft een eigen server; het hoofdkantoor heeft een
cloud-dashboard dat alles samenvoegt. Data moet reizen. Daarvoor is de
ladder met vijf lagen:

| Laag | Wat er gebeurt | U doet | Beschikbaar |
|---|---|---|---|
| **1 — Realtime push** | Elke verkoop wordt binnen seconden na vastlegging naar de cloud gekopieerd | Niets | Roadmap — gaat aan bij de eerste multi-vestiging-clouduitrol |
| **2 — Automatisch opnieuw proberen** | Internetdip → kopieën in de wachtrij proberen opnieuw na 1 m → 5 m → 15 m → 30 m; het managerscherm toont geel *"Sync wacht — N transacties in de rij"* | Niets | Roadmap (zelfde uitrol als laag 1) |
| **3 — Z-Rapport verzenden** | Bij het afsluiten van de dag: **Verzenden naar hoofdkantoor** — een bewuste verzending van de dagtotalen; de regel springt naar *Verzonden ✓* met tijdstempel | Eén tik bij dagafsluiting, of opnieuw proberen vanuit het Z-Rapportenscherm (het ochtendscherm biedt ook een knop als gisteren niet aankwam) | **✓ Vandaag** |
| **4 — Versleuteld USB-/WhatsApp-bestand** | De manager exporteert een **AES-256-versleuteld `.josbin_pos`-bestand** van elke gewenste periode; het reist per USB-stick, WhatsApp of e-mail; het hoofdkantoor uploadt het in het dashboard en het landt precies alsof het gesynct was | Exporteren → versturen → HK importeert. Klik-voor-klik: dashboardhandleiding h. 11 §11.5 | **✓ Vandaag — de offline-reddingslijn** |
| **5 — Inhaalsync** | Als het internet na dagen offline terugkomt, wordt alles in de wachtrij automatisch gepusht, oudste dag eerst, gemarkeerd als "laat gesynct" in het auditlogboek | Niets | Roadmap (zelfde uitrol als laag 1) |

> **De eerlijke één-zin voor klanten:** vandaag bereiken de cijfers van een
> vestiging het hoofdkantoor aan het einde van de dag met één tik (laag 3),
> of als versleuteld bestand dat reist zoals een telefoon dat kan (laag 4)
> — beide end-to-end bewezen. De live feed per verkoop (lagen 1/2/5) zit in
> het datamodel en wordt uitgerold bij de eerste cloud-multi-vestiging-
> installatie. Zie
> [offline-fallback-verification.md](offline-fallback-verification.md)
> voor wat precies getest is.

## 7.4 Hoe een internetstoring er in de praktijk uitziet

- **Aan de kassa's: niets.** Geen banner, geen vertraging — kassiers merken
  het meestal niet eens.
- **Dagkoers:** de koers die 's ochtends vergrendeld is blijft de hele dag
  geldig. Valt de storing over het ophaalmoment van 06:00, dan blijft de
  laatst vergrendelde koers van kracht tot een manager handmatig een nieuwe
  vergrendelt (Koersscherm → handmatig). Vreemde-valutabetalingen blijven
  werken op de vergrendelde koers.
- **Licentie:** de controle draait dagelijks en verdraagt **72 uur**
  onbereikbaarheid zonder enig effect; ook daarna blijft een geldige
  licentie gewoon verkopen — er verschijnt alleen een waarschuwingsbanner.
  (Volledige coulanceladder: dev-docs h. 11.)
- **E-mailbonnen:** komen in de wachtrij en worden verstuurd zodra de
  verbinding terug is; print- en PDF-bonnen merken niets. WhatsApp-bonnen
  hebben de databundel van de *klant* nodig, niet die van de winkel.
- **Dashboard op afstand:** de eigenaar thuis kan het dashboard van de
  winkel niet bereiken zolang de winkel offline is — de winkel zelf merkt
  daar niets van. (Dit is vorm A; in vorm B toont het cloud-dashboard de
  vestigingskaart als *offline* met laatst-gezien-tijd.)

## 7.5 Vestigingen in het binnenland — de 4G-terugvaloptie

Voor installaties in Nickerie / Marowijne / het binnenland met onbetrouwbaar
vast internet is een **4G-USB-dongle (Digicel of Telesur)** op de
winkelserver de aanbevolen tweede route. Het is een instelling op
besturingssysteemniveau (de app ziet alleen "internet is weer bereikbaar")
en de datapakketten zijn piepklein — een Z-Rapport is 50–200 KB, dus zelfs
een zwak 4G-signaal verwerkt een maand handel met ruimte over. De
installatievraag is: *waar zit de netwerkaansluiting, hoe stabiel is die,
en is er een 4G-back-up?* Het antwoord bepaalt hoe vaak het USB-bestand van
laag 4 routine wordt in plaats van uitzondering.

## 7.6 Waar u de syncstatus ziet

| Wie | Waar | Wat u ziet |
|---|---|---|
| Kassier | — | Niets om te controleren — verkopen is altijd lokaal |
| Vestigingsmanager | **Einde dag → Z-Rapporten** | Per dag: *wachtend / verzonden ✓ / mislukt / niet vereist*, met een knop om opnieuw te verzenden |
| Vestigingsmanager | Ochtend-kassascherm | Een melding van één regel als de totalen van gisteren het hoofdkantoor niet bereikt hebben, met een knop om opnieuw te proberen |
| Hoofdkantoor | Vestigingskaarten op het overzicht | Online/offline per vestiging met laatst-gezien-tijd, en **Openstaande betalingen** voor overboekingen die op bevestiging wachten |

## 7.7 Veelgestelde vragen

**Kan een verkoop verloren gaan als het internet midden in een betaling
uitvalt?** Nee. De verkoop wordt op de winkelserver vastgelegd vóór al het
andere; internet zit nooit in dat pad.

**Hoe lang kunnen we offline blijven?** Voor verkopen: onbeperkt. Voor
licentiecontroles: 72 uur volledig geruisloos, daarna alleen een
waarschuwingsbanner. Voor rapportage aan een hoofdkantoor elders: Z-Rapport
verzenden zodra u weer online bent, of het USB-bestand op elk moment.

**Komen prijswijzigingen binnen tijdens offline?** Wijzigingen op het eigen
dashboard van de winkel gelden direct (zelfde server). Pushes vanaf een
hoofdkantoor *elders* komen binnen zodra de verbinding terug is.

**Werken QR-wallet-betalingen offline?** De kassakant wel — vastleggen en
bevestigen is lokaal. De wallet-app van de klant heeft *zijn of haar*
mobiele data nodig om te betalen, los van het internet van de winkel.

**Is het USB-bestand veilig als de stick kwijtraakt?** Het bestand is
AES-256-versleuteld en voorzien van een integriteitshandtekening; zonder
het sleutelmateriaal van de organisatie is het onleesbaar. Een verloren
stick kost u alleen de stick.

**Wat beschermt de winkelserver zelf?** Nachtelijke databaseback-ups met
een venster van 14 dagen plus wekelijkse volledige snapshots, bewaard op de
server (en extern opgehaald zodra de winkel online is). Herstellen wordt
geoefend, niet aangenomen.

---

→ Verwant: [Kassa & Z-Rapport-levenscyclus](06-register-and-z-report.md) ·
[dashboardhandleiding h. 11 — Z-Rapporten & sync, incl. USB klik-voor-klik](../dashboard_manual/11-z-reports-and-end-of-day-sync.md) ·
[offline-fallback-verification.md](offline-fallback-verification.md) ·
terug naar het [overzicht](README.md)
