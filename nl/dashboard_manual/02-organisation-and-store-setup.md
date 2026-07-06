# Hoofdstuk 2 — Organisatie en vestiging opzetten

**Voor wie:** Super Admin (maakt het allereerste record voor een nieuwe klant) en organisatiebeheerder (voegt filialen en kassa's toe onder die organisatie).

Elke login in Josbin POS hoort bij **één organisatie**. Elke transactie hoort bij **één vestiging onder die organisatie**. Elke kassalade hoort bij **één kassa onder die vestiging**. Dit hoofdstuk loopt het opzetten van alle drie door — in de volgorde waarin u het in het echt ook doet.

---

## 2.1 Wat "Organisatie" betekent in Josbin POS

In Josbin POS:

- **Organisatie** = één *klant* van u. Eén juridische entiteit. Eigenaar van haar producten, prijzen, gebruikers en auditspoor. Kan nooit gegevens van een andere organisatie zien.
- **Vestiging** = één *fysieke locatie* onder die organisatie. Heeft een eigen adres, BTW-bonhoofd, kassalades en einde-dag Z-Rapport.
- **Kassa** = één *kassapositie* binnen een vestiging. Een lade + een scherm + een printer.

Twee veelvoorkomende vormen:

| Echte bedrijfsvorm | Hoe het leeft in Josbin POS |
|---|---|
| Supermarktketen "Supermarkt De Hoop NV" met 4 filialen | 1 Organisatie, 4 Vestigingen, ~2 Kassa's per vestiging |
| Eenmanszaak "Toko Anand" | 1 Organisatie, 1 Vestiging, 1 Kassa |
| Overheidsinstelling met hoofdkantoor + 2 satellietkantoren | 1 Organisatie (gemarkeerd als overheid), 3 Vestigingen, elk 1 Kassa |
| Een holding met twee *verschillende* handelsnamen | 2 aparte Organisaties |

> **Vuistregel:** als twee bedrijven aparte BTW-aangiftes doen bij Belastingdienst Suriname, zijn het aparte Organisaties. Doen ze één aangifte, dan zijn ze één Organisatie met meerdere vestigingen.

De Organisatie is ook waar de **hoofdproductcatalogus** leeft. Voeg een product één keer toe op het hoofdkantoor — elke vestiging in die organisatie ziet het direct (Hoofdstuk 4).

---

## 2.2 Een nieuwe Organisatie aanmaken (alleen Super Admin)

Alleen de rol Super Admin kan een nieuwe Organisatie aanmaken. Dit is het **eerste wat u doet** voor elke nieuwe klant.

**Pad:** Dashboard → **Organisaties** (linker zijbalk) → **+ Nieuwe organisatie** (knop rechtsboven).

Een paneel opent met de volgende velden:

| Veld | Wat in te vullen | Opmerkingen |
|---|---|---|
| **Organisatienaam** | Juridische handelsnaam | bv. `Supermarkt De Hoop NV` |
| **BTW-nummer** | Het BTW-registratienummer van de klant van Belastingdienst Suriname | bv. `SR-BTW-123456789`. Optioneel maar sterk aanbevolen — wordt op elke bon afgedrukt |
| **Type** | `Detailhandel` / `Overheid` / `Groothandel` | Bepaalt enkele standaardwaarden en welk pictogram in de lijst verschijnt |
| **Taal** | `Nederlands` of `English` | Standaard UI-taal voor elke gebruiker die in deze org wordt aangemaakt. Elke gebruiker kan haar eigen taal nog steeds wijzigen |
| **Abonnement** | `Starter` / `Professional` / `Enterprise` | Bepaalt licentielimieten. Zet dit gelijk aan wat aan de klant is verkocht |
| **Overheidsinstelling** | Selectievakje | Zie §2.2.1 hieronder — vink dit alleen aan voor daadwerkelijke overheidsinstellingen |

De Surinaamse dollar is de valuta voor elke organisatie — er is geen valutaselector. SRD is vergrendeld op platformniveau.

Tik op **Aanmaken**. De nieuwe organisatie verschijnt bovenaan de lijst met status *Actief* en `0 vestigingen`.

> **Snelle tip over naamgeving:** gebruik de *juridische* naam, niet de marketingnaam. Dus `Supermarkt De Hoop NV` in plaats van enkel `De Hoop`. De BTW-bon en de Rekenkamer-export halen beide uit dit veld.

### 2.2.1 Wat het aanvinken van "Overheidsinstelling" daadwerkelijk vrijschakelt

De `is_government`-vlag wijzigt platformgedrag automatisch — u configureert verder niets. Eenmaal aangevinkt:

- **2FA wordt verplicht en niet-verwijderbaar** voor elke gebruiker in deze org (inclusief kassiers)
- **Terugbetalingen boven een geconfigureerde SRD-drempel** vereisen dubbele goedkeuring (twee managers)
- **Geo-alert** wordt afgevuurd bij elke login van buiten Suriname (alleen alert — blokkeert de login niet)
- **De Rekenkamer-export als ondertekende PDF** wordt ingeschakeld op het Auditlogboek-scherm
- **Super Admin-impersonatie wordt geblokkeerd** — u, de leverancier, kunt niet "inloggen als" iemand in deze org zonder een auditspoorbreuk. De impersonatie-schakelaar in de org-view toont 🔒 *Vergrendeld*.
- **Database-isolatie** — overheidsorganisaties worden voorzien op een aparte database van commerciële klanten (afgehandeld bij deployment, niet in deze UI)

Deze regels zijn vereist door WBP-S (Wet Bescherming Persoonsgegevens Suriname) en de Rekenkamer. Zie Hoofdstuk 1 §1.5 voor de volledige uitleg.

> **Niet lichtvaardig ongedaan te maken.** Eenmaal gemarkeerd als overheid en met data erin, vereist het terugzetten naar commercieel het verplaatsen van data tussen databases. Vink het alleen aan als u zeker bent.

### 2.2.2 Een organisatie later bekijken en bewerken

Klik op een willekeurige rij in de Organisaties-lijst. Een rechterpaneel opent met twee tabs:

- **Gegevens** — alle velden die u hierboven heeft ingesteld, plus het admingebruikersaccount (indien aanwezig), aanmaakdatum en de schakelaar *Super Admin-impersonatie*.
- **Vestigingen** — de lijst van vestigingen onder deze org en de knop **+ Vestiging toevoegen**.

De knop **Bewerken** bovenaan opent het volledige bewerkingsformulier. Alles is bewerkbaar behalve de valuta (altijd SRD). De schakelaar `is_active` uitzetten deactiveert de hele organisatie — geen gebruiker erin kan inloggen tot heractivering.

De knop **Catalogus pushen** zit op **Catalogus → header rechtsboven** (niet op de Organisaties-rij). Die activeert direct een WebSocket-broadcast van de huidige productcatalogus naar elke verbonden POS-terminal in deze org. Gebruik die na een bulkprijswijziging zodat kassiers niet hoeven te wachten op de volgende natuurlijke refresh. Zie [Hoofdstuk 4 §4.8](04-catalogue.md).

---

## 2.3 Vestigingen toevoegen onder een Organisatie

![Vestigingen-scherm — alleen-lezen org-header, vestigingslijst, + Nieuwe vestiging-knop](screenshots/02-stores-screen-oa.png)


**Het Vestigingen-scherm is de OA-thuisbasis voor vestiging-CRUD.** Zijbalk → **Vestigingen**. Alleen zichtbaar voor Super Admin en OA — vestigingsmanagers krijgen dit menu niet.

| Wie ziet wat |
|---|
| **Super Admin** — ziet bovenaan een organisatie-keuzemenu; kies eerst de org, dan de vestigingslijst. Kan aanmaken / hernoemen / deactiveren. Kan dit ook doen via Organisaties → drill-in (de oude SA-only-flow werkt nog steeds). |
| **OA** — ziet een alleen-lezen header-strip met hun organisatienaam + BTW-nummer + type + locale (beheerd door uw Josbin POS-leverancier — mail `support@josbin-pos.sr` om te wijzigen), dan de vestigingslijst. Kan vestigingen aanmaken / hernoemen / deactiveren tot de licentielimiet. |
| **Vestigingsmanager** — ziet het menu **Vestigingen** helemaal **niet**. Vestigingen aanmaken, hernoemen en deactiveren is hoofdkantoorwerk, en de API weigert die acties vanaf een manageraccount (`StorePolicy`). Wat een manager *wél* krijgt is **Vestigingsinstellingen** voor de eigen toegewezen vestiging — zie §2.3.1. |

**Om een vestiging toe te voegen:**

![Modal Vestiging toevoegen — naam, stad, adres, BTW, POS-type](screenshots/02-stores-add-modal.png)

1. Zijbalk → **Vestigingen**.
2. Rechtsboven → **+ Nieuwe vestiging**.
3. Het modal vraagt om: naam, stad, adres, standaard BTW (standaard 10), POS-type (`native` voor Josbin Electron / Android, `external` voor een API-geïntegreerde externe POS).
4. Klik op **Vestiging aanmaken**. De vestiging verschijnt in de lijst met status *Actief*.

**Om diepere instellingen later te bewerken** (logo uploaden, bonhoofd/-voet, BTW-nummer op de bon, live preview): zijbalk → **Vestigingsinstellingen** → kies de vestiging uit het keuzemenu. De voettekst van het Vestigingen-scherm drukt deze hint af.

> **Licentielimiet wordt live afgedwongen.** Als uw licentie 1 vestiging toestaat en u probeert de 2e aan te maken, toont het modal *"Licentielimiet bereikt: 1 vestiging(en). Vraag uw leverancier de licentie uit te breiden."* (HTTP 409 `LICENSE_STORE_LIMIT_REACHED`). De leverancier verhoogt de limiet op Licentiebeheer — zie [Hoofdstuk 15 §15.8](15-license-management.md#158-issuing-a-new-license-super-admin-in-dashboard-path).

> **Waarom het Vestigingen-scherm, niet Organisaties?** De OA bezit per ontwerp precies één organisatie (als uw klant er twee heeft, krijgen ze twee OA's, één per org). De lijstweergave Organisaties, de knop "+ Nieuwe organisatie" en de org-detail-editor zijn allemaal Super Admin-tools. OA's runnen de vestigingen; de org-rij wordt beheerd door de leverancier en is alleen-lezen.

Het modal Vestiging toevoegen vraagt om:

| Veld | Wat in te vullen |
|---|---|
| **Naam vestiging** | De dagelijkse naam van het filiaal — bv. `De Hoop — Paramaribo Centrum` of `Kantoor Nickerie` |
| **Stad** | bv. `Paramaribo`, `Nieuw Nickerie`, `Albina` |
| **Adres** | Straat + nummer — bv. `Domineestraat 12` |
| **Standaard BTW (%)** | Standaard `10` (huidige Suriname VAT). Overschrijf alleen als de vestiging uitsluitend in een niet-standaardtarief handelt |
| **POS-type** | `Josbin POS (native)` als kassiers de Josbin Electron-app gebruiken, of `External POS` als de vestiging een externe kassa gebruikt die verkopen via de API pusht (Hoofdstuk 12) |

Tik op **Aanmaken**. De vestiging verschijnt in de lijst met status *Actief*.

> **U krijgt alleen een naam, stad, adres, BTW en POS-type uit dit snelle-toevoegen-paneel.** Vestigingsspecifieke bonopmaak (header, footer, BTW-nummer, logo) leeft in een apart scherm — zie §2.3.1 — omdat het een live bon-preview en een logo-upload heeft. U kunt daar elk moment naar terug.

### 2.3.1 Vestigingsspecifieke bonopmaak

**Pad:** Dashboard → **Vestigingsinstellingen** (linker zijbalk) → kies de vestiging uit het keuzemenu.

**Wie mag hier bewerken:** Super Admin en OA bewerken elk veld, voor elke vestiging in de org. Een **vestigingsmanager** krijgt dit scherm ook — alleen voor de **eigen toegewezen vestiging** — en kan de operationele velden bewerken: weergavenaam, stad, adres, bonhoofd/-voet, BTW-registratienummer op de bon, het logo en de QR-wallet-afbeeldingen. De ene uitzondering is het **standaard BTW-tarief**: voor een manager is dat grijs gemaakt met de hint *"Wordt door uw organisatie ingesteld"* — belastinginstellingen blijven bij de OA. En het is niet slechts een uitgeschakeld invoerveld: de server verwijdert `default_btw_rate` (plus structurele velden zoals POS-type en actief-status) uit elke opslag die een manager verstuurt, dus omzeilen door het verzoek handmatig te bouwen kan niet.

Dit scherm heeft vier secties plus rechts een live bon-preview die meeloopt terwijl u typt.

**Vestigingsgegevens**
- Vestigingsnaam, stad, adres
- **Standaard BTW-tarief** — wordt gebruikt als voorgesteld tarief bij het toevoegen van een nieuw product

**Bonopmaak**
- **BTW-registratienummer** — verschijnt onderaan elke bon. Surinaamse BTW-bonnen moeten dit tonen voor aankopen die de klant wil terugvragen.
- **Koptekst** — tot 3 regels bovenaan elke bon. Typisch gebruik: handelsnaam, adres, telefoonnummer.
  ```
  Supermarkt De Hoop
  Domineestraat 12, Paramaribo
  Tel: +597 471-000
  ```
- **Voettekst** — tot 3 regels onderaan. Typisch gebruik: bedankboodschap, website, openingstijden.

**Logo op bon**
- Upload een PNG, JPG of SVG, max 2 MB.
- Wordt afgedrukt bovenaan de thermische bon, de gemailde PDF-bon en de HTML-mailbon.
- Een preview-thumbnail verschijnt direct; **Verwijderen** maakt het leeg.

**QR-wallets (Mopé / Uni5Pay+)**
- Eén tegel per wallet-aanbieder: upload de **statische merchant-QR** van uw winkel (de sticker of PDF-afbeelding die u van uw bank / wallet-aanbieder kreeg).
- De kassa toont deze QR groot op het scherm bij een QR-betaling, met het te betalen bedrag ernaast — de klant scant en typt het bedrag in de wallet-app.
- Volledige inrichtingsdoorloop: [Hoofdstuk 22 §22.2](22-payment-methods-and-wallets.md).

Het rechterpaneel toont precies hoe de volgende geprinte bon eruit zal zien. Gebruik het om te controleren of uw koptekst niet overloopt.

Klik op **Wijzigingen opslaan**. De header/footer is live bij de volgende verkoop. Het logo, indien geüpload, treedt in werking nadat de upload-stap is voltooid (een kleine "Geüpload ✓"-indicator verschijnt naast de knop).

> **Elke vestiging heeft zijn eigen bonontwerp.** Paramaribo kan één telefoonnummer tonen, Nickerie een ander. Hetzelfde product verkocht in beide vestigingen drukt dezelfde regel af — alleen header, footer, BTW-nummer en logo verschillen.

---

## 2.4 Kassa's toevoegen onder een vestiging

Een kassa is één kassapositie. De meeste kleine winkels hebben er maar één nodig. Een drukke supermarkt-baan kan er 4-8 hebben.

> **Herinnering wie-doet-wat.** Als manager (of OA) maakt u de **kassa** hier aan — één keer. Daarna **opent elke kassier een sessie** erop aan het begin van de dienst via de POS-app (scherm Kassa openen → kiezen → beginsaldo invoeren). U opent de kassa niet voor hen; dat doen ze zelf. Zie [POS-handleiding — Hfdst. 3 Uw kassa](../user_manual/03-register.md) voor de kassierflow.

**Pad:** Dashboard → **Kassabeheer** (linker zijbalk) → tab **Kassas beheren** → kies de vestiging (alleen Super Admin — OA's zijn beperkt tot hun eigen org).

In de tab *Kassas beheren*:

1. Typ een kassanaam in het invoerveld **+ Nieuwe kassa toevoegen** — bv. `Kassa 1`, `Servicebalie`, `Tabak`.
2. Tik op **Toevoegen**.

De kassa verschijnt in de lijst met een automatisch toegewezen **nummer** (de kleine paarse badge — `1`, `2`, `3`…). Kassiers zien dit nummer in de POS-app bij het kiezen van een kassa aan het begin van hun dienst.

Om een kassa te **hernoemen**: tik op het potloodicoon, bewerk de naam, tik op **Opslaan**. Het nummer blijft hetzelfde — het is een permanente referentie voor het auditlogboek.

Om een kassa te **deactiveren**: tik op het rode prullenbakicoon. Het systeem **weigert** als de kassa momenteel een open sessie heeft — sluit eerst de sessie (of laat een manager die geforceerd sluiten via de tab Sessies). Gedeactiveerde kassa's blijven in het auditlogboek staan maar kunnen niet meer worden gekozen aan het begin van een dienst.

> **Wat is een "sessie"?** Elke keer dat een kassier een kassa opent, maakt die een nieuwe sessie aan — beginsaldo, verkopen, slottelling, allemaal verbonden aan die ene dienst. De tab **Kassasessies** is waar managers open sessies monitoren en heropenverzoeken goedkeuren. Zie Hoofdstuk 11 voor de einde-dag-flow aan de manager-kant.

---

## 2.5 Een vestiging deactiveren

Soms sluit een filiaal, wordt het verbouwd of verkocht. Verwijder het niet — **deactiveer** het. Alle historische verkopen, BTW-rapporten en Rekenkamer-auditgegevens blijven intact en zichtbaar voor auditors. Kassiers kunnen er alleen niet meer in inloggen.

Om te deactiveren: open de organisatie → tab Vestigingen → de vestigingskaart heeft een *Actief*-badge. Vanaf deze release wordt deactivering uitgevoerd door een OA of Super Admin via dezelfde bewerkflow die voor vestigingen wordt gebruikt (`is_active = false`). Eenmaal omgezet, kan geen kassa bij die vestiging worden geopend, maar elk rapport bevat nog steeds haar historische cijfers.

**Heractiveren** is dezelfde schakelaar in omgekeerde richting — handig voor seizoensvestigingen (bv. een marktkraam die alleen in december draait).

> **Hard-verwijder geen vestiging.** Surinaamse wet (en de Rekenkamer) vereisen dat financiële documenten toegankelijk blijven. Soft-deactiveren, altijd. Als een klant volledige verwijdering eist, is dat een leverancier-supportticket — geen self-service-operatie.

---

## 2.5a Het vestigingsdetailscherm — wat HQ per vestiging ziet

Klikken op een vestigingskaart vanaf het **Dashboard** brengt de OA / vestigingsmanager / SA op een live dashboard voor die ene vestiging — specifiek gebouwd voor "wat gebeurt er nu in dit filiaal?" in plaats van de opgetelde org-weergave.

![Vestigingsdetail — hero + 6 KPI-tegels + alertstrook](./screenshots/02-store-detail-hero-kpis.png)

**Van boven naar beneden:**

1. **Hero** — vestigingsnaam + initialen-avatar, online/offline-pil (real-time via Reverb), organisatie + stad + adres, toegewezen manager, BTW-nummer, aantal kassa's. Gaat de vestiging offline, dan toont de hero het laatst-gezien-tijdstip.

2. **Alertstrook** *(alleen wanneer iets actie vereist)* — aantal openstaande bank-/mobiele overboekingen + totaal SRD (geel), producten met lage voorraad in deze vestiging (rood). Is alles gezond, dan verdwijnt de strook.

3. **KPI-strook** — 6 tegels met een accentstreep aan de linkerrand:
   - Omzet vandaag + ▲/▼-delta t.o.v. gisteren
   - Transacties + delta
   - Gemiddelde bongrootte
   - Geïnde BTW
   - Kassa's die nu open zijn
   - Aantal producten met lage voorraad

4. **Uurlijkse staafgrafiek + 7-daagse lijngrafiek** — piekuuranalyse voor vandaag, trend voor de week. Handig voor personeelsbeslissingen ("we pieken op vrijdag altijd tussen 16:00 en 18:00 — zet een extra kassier in").

![Vestigingsdetail — grafieken, topproducten, actieve sessies](./screenshots/02-store-detail-charts-tables.png)

5. **Top 5 producten vandaag + Kassiers in dienst** — naast elkaar.
   - Topproducten tonen medailles (🥇🥈🥉) met aantal + omzet.
   - De lijst kassiers in dienst toont avatar + kassanaam + sinds-wanneer + beginsaldo.

6. **Tabel recente verkopen** — laatste 10 voltooide verkopen met tijd, bonnummer, kassier, betaalmethode-pil, totaal. Dezelfde vorm als de volledige verkooplijst van de OA, alleen ingekort.

7. **Sync-voettekst** — syncstatus-pil, laatste synctijdstip, datum laatste Z-Rapport.

![Vestigingsdetail — recente verkopen + sync-voettekst](./screenshots/02-store-detail-recent-sales.png)

Het scherm ververst elke 60 seconden. SaleCompleted-broadcasts vanaf de POS verhogen de omzet en het transactieaantal van vandaag onmiddellijk, zonder refetch — wanneer de kassier op Voltooien tikt, ziet de OA die dit scherm bekijkt de tegel binnen een seconde bewegen.

---

## 2.6 Een uitgewerkt voorbeeld: Supermarkt De Hoop end-to-end opzetten

Klant: Supermarkt De Hoop NV. Twee filialen (Paramaribo Centrum en Nieuw Nickerie). 3 kassa's in Paramaribo, 1 in Nickerie. Sandra Codrington is de inkoper op het hoofdkantoor.

Hier is de volledige sequentie — wat de **Super Admin** doet, en daarna wat **Sandra (OA)** doet.

### Leverancierkant (Super Admin)

1. **Organisatie aanmaken.**
   Dashboard → Organisaties → + Nieuwe organisatie:
   - Naam: `Supermarkt De Hoop NV`
   - BTW-nummer: `SR-BTW-123456789`
   - Type: Detailhandel
   - Taal: Nederlands
   - Niveau: Professional (komt overeen met wat is geoffreerd)
   - Overheid: niet aangevinkt
   - Aanmaken.

2. **Sandra's licentie uitgeven.**
   Dashboard → **Licentiebeheer** → **+ Licentie uitgeven** → kies `Supermarkt De Hoop NV`, niveau `Professional`, max_stores `2`, max_terminals `4`, valid_from vandaag, valid_until +1 jaar. Uitgeven. *(Pad B — in-dashboard. Pad A via de aparte License Server is voor on-prem IonCube-leveringen; zie [Hoofdstuk 16](16-license-operations.md) §16.4.)*

3. **Sandra's OA-account aanmaken** (behandeld in [Hoofdstuk 3](03-users.md)). Ze krijgt een welkomstmail met de dashboard-link en haar login-e-mailadres; het tijdelijke wachtwoord wordt apart overhandigd via de eenmalige groene banner (zie [Hoofdstuk 3 §3.2](03-users.md)).

4. Overdracht — klaar. Alles hieronder is Sandra's werk.

### Klantkant (Sandra Codrington, OA)

> **Sandra's "eerste dag"-mentaal model** — van inloggen tot verkopen:
> ```
> Inloggen
>    ↓
> Vestigingen (zijbalk) → alleen-lezen org-header bevestigt dat ze in De Hoop zit
>    → + Nieuwe vestiging — voeg Paramaribo Centrum + Nieuw Nickerie toe (licentielimiet = 2)
>    ↓
> Vestigingsinstellingen (zijbalk) → kies een vestiging → upload logo,
>    vul BTW-nummer op bon in, pas header/footer aan (live preview rechts)
>    ↓
> Catalogus (zijbalk) → + Product handmatig, of
>    Import / Export → Excel-template downloaden → invullen → uploaden
>    → knop "📡 Catalogus pushen naar POS" (Catalogus-header, rechtsboven) zodra alles is geladen
>    ↓
> Kassabeheer (zijbalk) → kies vestiging → + Kassa toevoegen voor elke kassa
>    ↓
> Gebruikers (zijbalk) → + Kassiers en vestigingsmanagers toevoegen
>    → kies hun ene toegewezen vestiging uit "Toegewezen vestiging"
>    ↓
> Kassiers loggen in op de POS-app, eenkassier auto-picks, kassa openen, verkopen.
> ```

5. **Inloggen** op de dashboard-URL. Komt op Overzicht met `0 vestigingen, 0 verkopen vandaag`. **Geen Organisaties-menu — dat is alleen voor Super Admin.** Het OA-thuis voor vestigingswerk is **Vestigingen** in de zijbalk, met een alleen-lezen header met de orgnaam + BTW-nummer + type + locale (beheerd door uw Josbin POS-leverancier — mail `support@josbin-pos.sr` voor wijzigingen).

6. **Eerste vestiging toevoegen.**
   Dashboard → **Vestigingen** → **+ Nieuwe vestiging**:
   - Naam: `De Hoop — Paramaribo Centrum`
   - Stad: `Paramaribo`
   - Adres: `Domineestraat 12`
   - Standaard BTW: `10`
   - POS-type: `Josbin POS (native)`
   - Aanmaken. Verschijnt in de lijst als *Actief*.

7. **Paramaribo-bon aanpassen.**
   Dashboard → **Vestigingsinstellingen** → kies `De Hoop — Paramaribo Centrum`:
   - BTW-registratienummer: `SR-BTW-123456789`
   - Koptekst:
     ```
     Supermarkt De Hoop
     Domineestraat 12, Paramaribo
     Tel: +597 471-000
     ```
   - Voettekst:
     ```
     Bedankt voor uw bezoek!
     www.dehoop.sr
     ```
   - Logo: upload `dehoop-logo.png`.
   - Opslaan — live preview rechts weerspiegelt elke wijziging.

8. **Kassa's voor Paramaribo toevoegen.**
   Dashboard → **Kassabeheer** → tab Beheer → vestigingskeuze ingesteld op Paramaribo Centrum:
   - Voeg `Kassa 1` toe
   - Voeg `Kassa 2` toe
   - Voeg `Servicebalie` toe
   Drie rijen verschijnen, genummerd 1, 2, 3.

9. **Tweede vestiging toevoegen.**
   Terug naar **Vestigingen** → **+ Nieuwe vestiging**:
   - Naam: `De Hoop — Nieuw Nickerie`
   - Stad: `Nieuw Nickerie`
   - Adres: `R.P. Bharosstraat 8`
   - Standaard BTW: `10`
   - POS-type: `Josbin POS (native)`
   - Aanmaken.

10. **Nickerie-bon aanpassen.**
    Hetzelfde als stap 7 maar met het adres en telefoonnummer van Nickerie. De Nickerie-vestiging heeft eigen header nodig zodat klanten in Nickerie geen bon krijgen waar het telefoonnummer van Paramaribo op staat.

11. **Nickerie-kassa toevoegen.**
    Kassabeheer → tab Beheer → vestigingskeuze ingesteld op Nieuw Nickerie:
    - Voeg `Kassa 1` toe.

12. **Sanity check.**
    Dashboard → **Vestigingen**. Beide filialen vermeld, beide *Actief*. Kassabeheer-scherm, wisselend tussen de twee vestigingen, toont 3 + 1 = 4 totale kassa's.

13. **Kassiers toevoegen en elk vastpinnen op één vestiging.**
    Dashboard → **Gebruikers** → **+ Nieuwe gebruiker** → rol `Kassier`. Het keuzemenu **Toegewezen vestiging** verschijnt onder de rol — kies precies één.
    - Sharmila Jankipersad → vestiging `De Hoop — Paramaribo Centrum`.
    - Rashied Alibaks → vestiging `De Hoop — Nieuw Nickerie`.
    - Vervangende kassier die beide vestigingen bemant? Maak **twee accounts** aan (één per vestiging). Eén gebruiker, één vestiging — er is geen multi-vestigingtoewijzing en geen impliciete "vrije kassier"-toekenning. Zie [Hoofdstuk 1 §1.3 voetnoot ‡](01-roles-and-permissions.md) voor het waarom.

    Dezelfde picker voor vestigingsmanager: kies de ene vestiging die ze daadwerkelijk runnen.

14. **Kassiers hun POS-installatie + inloggegevens overhandigen.**
    Wanneer Sharmila inlogt op de POS, slaat haar enige toegewezen vestiging de picker automatisch over — ze landt direct op de Kassa openen-gate in Paramaribo. Probeert ze ooit de API voor een Nickerie-kassa, krijgt ze `403 STORE_NOT_ASSIGNED`.

Dat is het — de organisatie is in ongeveer 15 minuten volledig opgezet. Volgende stappen voor Sandra: catalogus laden (Hoofdstuk 4 + bulkimport in Hoofdstuk 5).

---

→ Volgende: [Hoofdstuk 3 — Gebruikers: aanmaken, bewerken, deactiveren](03-users.md)
