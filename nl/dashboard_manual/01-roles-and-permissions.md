# Hoofdstuk 1 — Rollen en rechten: wie mag wat

**Voor wie:** iedereen die gebruikers aanmaakt of Josbin POS voor het eerst inricht. Vooral de Super Admin en de organisatiebeheerder.

Josbin POS heeft **6 gebruikersrollen**. Elke rol ziet een andere set menu's en kan andere acties uitvoeren. De juiste rol kiezen voor elke persoon is de belangrijkste beveiligingsbeslissing die u in het systeem maakt.

Dit hoofdstuk legt uit:
- Wat elke rol in gewone taal doet
- Welke menu's en acties elke rol precies kan gebruiken
- Hoe u de juiste rol kiest bij het toevoegen van een nieuwe gebruiker
- Speciale regels voor overheidsinstellingen en eenmanszaken

![Dashboard-overzicht — wat een OA na inloggen ziet](screenshots/01-overview-landing.png)

---

## 1.1 De zes rollen in één oogopslag

```
SUPER ADMIN  ─── uw Josbin POS-leverancier (degenen die het hebben geïnstalleerd)
   │
   ▼
ORG ADMIN    ─── hoofdkantoor van één organisatie
   │           (bv. de inkoper bij hoofdkantoor "Supermarkt De Hoop")
   ▼
STORE MGR    ─── runt één vestiging
   │           (bv. winkelvloermanager in de vestiging Paramaribo)
   ▼
KASSIER      ─── werkt op de kassa
               (rekent klanten af — gebruikt de POS-app, niet het dashboard)

AUDITOR      ─── alleen-lezen, voor compliancecontroles
                 (bv. inspecteur Belastingdienst, interne accountant)

API INTEG.   ─── machine-naar-machine-account
                 (een externe POS die verkopen pusht via de API)
```

De eerste vier vormen een **hiërarchie** — elke rol kan alles wat eronder zit. Auditor en API-integratie staan ernaast; die zijn voor speciale doeleinden.

---

## 1.2 Wat elke rol daadwerkelijk doet

### 👑 Super Admin (uw leverancier)

Dat zijn **wij — het Josbin POS-team**. Uw klant krijgt deze rol nooit.

**Dagelijks werk:** Josbin POS installeren, nieuwe klantorganisaties onboarden, troubleshooten. Zodra een klant live is en getraind, logt de Super Admin niet meer in tenzij er iets is dat aandacht van de leverancier nodig heeft.

**Kan doen:** alles — organisaties aanmaken, licenties uitgeven, elke vestiging bij elke klant beheren.

> **Beveiligingsnotitie:** Super Admin-accounts moeten 2FA hebben ingeschakeld (het systeem dwingt dit af — zie Hoofdstuk 16). Als u uw Super Admin-wachtwoord aan iemand anders geeft, heeft u in feite de sleutels gegeven tot de gegevens van elke klant.

### 🏢 Organisatiebeheerder (hoofdkantoor)

Dit is het **hoofdkantoor-account** van één klant — bijvoorbeeld de inkoper of operationeel hoofd bij hoofdkantoor "Supermarkt De Hoop". Eigenaar van de hoofdcatalogus.

**Dagelijks werk:**
- Nieuwe producten toevoegen aan de catalogus
- Prijslijst bulkimporteren (CSV / Excel)
- Catalogus-updates pushen naar alle vestigingen
- Vestigingsspecifieke prijsoverschrijvingen instellen (Nickerie verkoopt +5% vanwege transportkosten)
- Nieuwe filialen openen (vestigingen)
- Nieuw personeel aannemen (accounts voor vestigingsmanager + kassier aanmaken)
- Geconsolideerde rapporten over alle filialen bekijken
- API-integratiesleutels uitgeven en intrekken voor externe systemen

**Kan niet doen:** afrekenen aan de kassa (hoofdkantoor verkoopt niet aan de kassa). Andere organisaties beheren (dat is voor de Super Admin).

**Praktijkvoorbeeld:** Sandra Codrington bij hoofdkantoor Supermarkt De Hoop. Zij beslist wat er in het assortiment komt, wat het kost en welke medewerker welke vestiging runt.

### 🏪 Vestigingsmanager (één vestiging)

De **persoon die één fysieke vestiging runt**. Rapporteert aan de OA op het hoofdkantoor.

**Dagelijks werk:**
- 's Ochtends de vestiging openen (de dagkoers instellen)
- Kassiers superviseren — terugbetalingen goedkeuren, verkeerde verkopen annuleren
- Een kassa sluiten als een kassier midden in de dienst vertrekt
- Einde dag: Z-Rapport draaien, kas tellen, indienen bij hoofdkantoor
- Nieuwe kassiers aannemen en trainen (kassieraccounts aanmaken)
- Vestigingsrapporten draaien (BTW, dagelijks, maandelijks)
- Typefouten op individuele producten herstellen

**Kan niet doen:** catalogus bulkimporteren, catalogus pushen, API-sleutels aanmaken (dat zijn hoofdkantoor-taken — eenmanszaken kunnen dit oplossen door dezelfde persoon OA-rechten te geven, zie §1.6).

**Vestigingsgebonden — één vestiging per manager.** Een vestigingsmanager is vastgepind aan precies één vestiging. Stel die in bij het aanmaken van de gebruiker (Gebruikers → rol = vestigingsmanager → kies een vestiging uit het keuzemenu). Een manager toegewezen aan *De Hoop — Paramaribo Centrum* kan geen kassa sluiten, geen terugbetaling goedkeuren en geen Z-Rapport draaien bij *De Hoop — Nickerie*. Heeft u iemand nodig die beide vestigingen beheert, maak dan twee manageraccounts aan (of gebruik OA, dat is organisatiebreed). Zie [Hoofdstuk 3 §3.2.1](03-users.md#321-store-assignment-cashier--store_manager-only) voor de picker + auditspoor.

**Praktijkvoorbeeld:** Rashied Alibaks bij "De Hoop — Paramaribo Centrum". Hij opent de winkel, stelt de USD→SRD-koers van de dag in, zorgt dat alle kassiers hun lades aan het eind van hun dienst sluitend krijgen.

### 🧾 Kassier (aan de kassa)

De **persoon die klanten afrekent** op de POS-terminal.

**Dagelijks werk:**
- Hun kassa openen met het beginsaldo
- Producten scannen of aantikken om aan de winkelwagen toe te voegen
- Contant / pin / gemengde betaling accepteren
- De bon afdrukken of e-mailen
- Een bon vasthouden als een klant meer tijd nodig heeft
- Hun kassa sluiten aan het eind van de dienst, kas tellen

**Kan niet doen:** verkopen van andere kassiers zien (tot einde dag Z-Rapport), terugbetalen (alleen manager), de catalogus zien (zien/verkopen wat er is), rapporten zien anders dan hun eigen prestaties.

**Waar ze werken:** de **POS-app** op de kassa — *niet* het dashboard. Als een kassier inlogt op het dashboard, ziet die alleen de persoonlijke "Mijn Account"-pagina (eigen verkopen, eigen diensten, profiel + wachtwoord).

**Vestigingsgebonden — één vestiging per kassier.** Elke kassier is vastgepind aan precies één vestiging. De POS slaat de vestigingskeuze bij inloggen volledig over en stuurt ze direct naar het scherm Kassa openen van die vestiging. Probeert iemand een kassa te openen in een andere vestiging → *403 STORE_NOT_ASSIGNED*. Werkt dezelfde persoon in twee vestigingen, maak dan twee accounts aan (één per vestiging) — er bestaat geen multi-vestigingkassier en geen "vrije" toewijzing.

**Praktijkvoorbeeld:** Sharmila Jankipersad op Kassa 1 bij "De Hoop — Paramaribo Centrum". Toegewezen aan die ene vestiging. Logt in, picker stuurt automatisch naar Paramaribo, opent haar kassa, verkoopt 8 uur lang, sluit de kassa.

### 👁️ Auditor (alleen-lezen)

Een **alleen-lezen** account voor iemand die de boeken nakijkt — bijvoorbeeld een belastinginspecteur van de Belastingdienst, een nalevingsambtenaar van de Rekenkamer of een interne accountant.

**Kan zien:**
- Alle verkopen (over alle vestigingen in de organisatie)
- Alle BTW-cijfers (en het BTW-rapport in Belastingdienst-formaat)
- Het volledige auditlogboek (elke actie van elke gebruiker, onveranderlijk)
- De Rekenkamer-export als ondertekende PDF
- Alle dagelijkse / maandelijkse rapporten

**Kan niet doen:** bewerken, verwijderen, annuleren, terugbetalen of iets aanmaken. Echt alleen-lezen.

**Praktijkvoorbeeld:** een belastinginspecteur bezoekt het kantoor van De Hoop voor een kwartaalcontrole. Ze krijgt een Auditor-account, leest wat ze nodig heeft, en haar account wordt gedeactiveerd zodra de audit klaar is.

### 🔌 API-integratie (machineaccount)

Geen persoon. Een **machine-naar-machine**-account dat gebruikt wordt wanneer een extern systeem (bv. een externe POS, een voorraadtool, een webshop) verkopen wil pushen naar Josbin POS of rapportagegegevens wil ophalen.

**Kan doen:** de `/api/v1/*`-endpoints aanroepen met een `X-Api-Key`-header. Beperkt tot één specifieke vestiging.

**Kan niet doen:** iets in de dashboard-UI — het is een niet-menselijk account. Als iemand interactief inlogt met de rol API-integratie, weigert het dashboard met "geen UI voor machineaccounts".

**Praktijkvoorbeeld:** de e-commercesite van de klant pusht dagelijkse weborders in de verkoopfeed van een specifieke vestiging via de API.

---

## 1.3 De rechtenmatrix

Concrete lijst van wat elke rol mag aanraken. Elke regel wordt door de backend afgedwongen — het dashboard verbergt alleen menu's die een rol niet mag gebruiken.

| Mogelijkheid | Super Admin | OA | Vestigingsmanager | Kassier | Auditor | API-integ. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Inloggen op het **dashboard** | ✅ | ✅ | ✅ | alleen Mijn Account | ✅ (alleen-lezen) | ❌ |
| Inloggen op de **POS** | (zelden) | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Mijn Account** (eigen verkopen, diensten, wachtwoord) | ✅ | ✅ | ✅ | ✅ | ✅ | n.v.t. |
| **Verkoop afrekenen** | ✅ | ❌ | ✅‡ | ✅‡ | ❌ | ✅ (via API) |
| **Terugbetalen / annuleren** van een verkoop | ✅ | ✅ | ✅‡ | ❌ | ❌ | ❌ |
| **Dagkoers vergrendelen** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Kassa openen / sluiten** | ✅ | ✅ | ✅‡ | ✅‡ | ❌ | ❌ |
| **Z-Rapport draaien** + indienen bij hoofdkantoor | ✅ | ✅ | ✅‡ | ❌ | ❌ | ❌ |
| **Individuele producten bekijken / aanmaken** | ✅ | ✅ | ✅ | alleen bekijken | alleen bekijken | alleen bekijken |
| **Producten verwijderen** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Bulkimport** (CSV / Excel) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Catalogus pushen** naar POS-terminals | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Categorieën** beheren | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Vestigingsspecifieke prijsoverschrijvingen** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Kortingsregels** (aanmaken/bewerken) | ✅ | ✅ | ✅ | alleen bekijken | ❌ | ❌ |
| **Voorraadcorrectie** (ontvangen, afschrijven) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Klanten** (bekijken/aanmaken/bewerken) | ✅ | ✅ | ✅ | bekijken + aanmaken | alleen bekijken | ❌ |
| **Alle vestigingsrapporten** | ✅ | ✅ | ✅ | alleen eigen | ✅ | ❌ |
| **Geconsolideerde cross-vestigingrapporten** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **BTW-rapport** (Belastingdienst-formaat) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Rekenkamer-export als ondertekende PDF** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **AI-inzichten** (weekoverzicht, afwijkingen) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Gebruikers** aanmaken / bewerken | ✅ | ✅ | ✅ (alleen kassiers) | ❌ | ❌ | ❌ |
| **Kassier/manager aan specifieke vestigingen toewijzen** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gebruikers verwijderen | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Vestigingen** aanmaken / bewerken / deactiveren | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Eigen **organisatie alleen-lezen** bekijken (Vestigingen-schermheader) | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Organisaties** aanmaken / bewerken | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **API-sleutels** beheren (uitgeven, intrekken) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Auditlogboek** bekijken | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Licenties** uitgeven / bewerken / intrekken (in-dashboard) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Licentievernieuwing **aanvragen** (leverancier verwerkt) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> ✅ = volledige toegang · bekijken = alleen-lezen · ❌ = geweigerd. Cross-organisatiezichtbaarheid wordt op database-query-niveau geweigerd — een vestigingsmanager van het ene bedrijf kan nooit gegevens van een ander bedrijf zien.
>
> ‡ **Één vestiging per kassier / vestigingsmanager — strikt 1:1.** Elke gebruiker met de rol kassier of vestigingsmanager is vastgepind aan precies één vestiging via het keuzemenu **Toegewezen vestiging** op hun profiel (zie [Hoofdstuk 3 §3.2.1](03-users.md#321-store-assignment-cashier--store_manager-only)). Er is geen impliciete "alle vestigingen in de org"-toekenning en geen multi-vestigingtoewijzing — werkt Anita in beide vestigingen, maak dan twee accounts aan. Afgedwongen op API-laag (`User::canAccessStore`) — `/api/registers/{id}/open`, refund-authz en Z-Rapport-sluiting retourneren allemaal `403 STORE_NOT_ASSIGNED` als een kassier in een andere vestiging probeert te handelen. De POS-vestigingspicker selecteert ook automatisch hun ene toegewezen vestiging bij inloggen, waarmee het keuzescherm wordt overgeslagen.

---

## 1.4 Een gebruiker toevoegen — de juiste rol kiezen

Ga naar **Dashboard → Gebruikers → + Gebruiker toevoegen**.

Het formulier vraagt om:
- **Naam + e-mail** — de echte naam + werk-e-mail van de persoon. De e-mail is ook hun login.
- **Rol** — kies een van de zes hierboven.
- **Organisatie** — automatisch ingesteld op de huidige organisatie (tenzij u Super Admin bent, in welk geval u kiest).
- **Taal** — `nl` (Nederlands) of `en` (Engels). Ze kunnen die zelf later wijzigen.
- **2FA vereist** — laat de standaard staan; die volgt het beleid per rol (Hoofdstuk 16).

Het systeem mailt een welkomstlink met een eenmalige wachtwoordconfiguratie.

### Snelle beslisboom

```
Rekent deze persoon daadwerkelijk verkopen af aan de kassa?
├── Ja → Kassier
└── Nee → Werkt deze persoon fysiek in één specifieke vestiging?
          ├── Ja → Vestigingsmanager
          └── Nee → Beheert deze persoon de catalogus / huurt personeel aan bij hoofdkantoor?
                    ├── Ja → Organisatiebeheerder
                    └── Nee → Doet diegene alleen een compliancecontrole?
                              ├── Ja → Auditor
                              └── Nee → Waarschijnlijk hebt u die persoon niet nodig. Stop en controleer.
```

---

## 1.5 Speciale regels voor overheidsinstellingen

Als uw organisatie is gemarkeerd als **overheid** (`is_government = true` toen u haar aanmaakte), gelden er automatisch extra regels:

- **Elke gebruiker** moet 2FA inschakelen — kan niet worden uitgezet
- **Terugbetalingen boven SRD `<drempel>`** vereisen **dubbele goedkeuring** (twee managers, niet dezelfde persoon)
- **Single-device-afdwinging** is optioneel (één actieve sessie per gebruiker tegelijk)
- **Geo-alert** bij inloggen vanuit buiten Suriname (blokkeert niet, geeft alleen alert)
- De organisatie leeft in een **geïsoleerde database** — nooit op dezelfde server als commerciële klanten
- Het auditlogboek krijgt de **Rekenkamer-export als ondertekende PDF** naast de gewone CSV

Deze zijn vereist door de Surinaamse wet (WBP-S — *Wet Bescherming Persoonsgegevens Suriname*) en door de compliance-regels van de Rekenkamer.

U hoeft niets extra's te doen in het dashboard — het systeem dwingt deze af zodra de organisatie als overheid is gemarkeerd.

---

## 1.6 Het "ik-ben-een-eenmanszaak"-patroon

Als uw klant één hoekwinkel of één café is — dezelfde persoon is inkoper, manager en soms kassier — kan de strikte rolscheiding ongemakkelijk aanvoelen. De schoonste manier om hiermee om te gaan:

| Als u wilt dat deze persoon… | Geef ze deze rol |
|---|---|
| Producten importeert uit Excel ÉN de winkel runt ÉN af en toe afrekent | **Organisatiebeheerder** (één account, volle bevoegdheid) |
| Alleen de winkel runt, nooit importeert | Vestigingsmanager |
| Klanten afrekent aan de kassa op een drukke dag | Maak een aparte **kassier**-account aan — makkelijker dan mixen |

In de praktijk heeft een eenmanszaak-eigenaar vaak **twee** accounts:
- `owner@shop.sr` als organisatiebeheerder (hoofdkantoorwerk — Excel-import, prijsstelling, personeel)
- `kassa-owner@shop.sr` als kassier (wanneer aan de kassa)

…en schakelt daartussen. Dit houdt het auditspoor helder: "de verkoop is afgerekend door het kassieraccount, niet door het adminaccount".

---

## 1.7 Wat als ik de verkeerde rol kies?

Makkelijk te herstellen:
1. Dashboard → **Gebruikers** → klik de gebruiker aan
2. Verander het keuzemenu Rol
3. **Opslaan**

Hun sessies worden binnen seconden automatisch ongeldig gemaakt (geforceerde uitlog op alle apparaten). Bij de volgende inlog hebben ze de view van de nieuwe rol.

> Het **auditlogboek** legt elke rolwijziging vast met de oude en nieuwe rol, wie het wijzigde, en wanneer. Dus als er ooit een dispuut is over toegang, kunt u bewijzen wie wat heeft veranderd.

---

→ Volgende: Hoofdstuk 2 — Organisatie en vestiging opzetten *(binnenkort beschikbaar)*
