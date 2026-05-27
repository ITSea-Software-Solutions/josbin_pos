# Hoofdstuk 3 — Gebruikers: aanmaken, bewerken, deactiveren

**Voor wie:** Super Admin, organisatiebeheerder, vestigingsmanager — iedereen die personeel aanneemt, bevordert, overplaatst of laat uitstromen.

De juiste **rol** kiezen is behandeld in Hoofdstuk 1. Dit hoofdstuk gaat over de mechanica: waar u klikt, wat u typt, hoe de welkomstmail werkt en wat er gebeurt als iemand vertrekt.

---

## 3.1 Wie mag wie aanmaken

Het systeem dwingt drie regels af op elke gebruikersbeheer-actie — zelfs als een knop niet verborgen is, weigert de API de operatie. De checks leven in `UserPolicy`:

- U kunt **alleen gebruikers in uw eigen organisatie beheren** (Super Admin is de enige uitzondering).
- U kunt **alleen gebruikers strikt onder uw rol** in de hiërarchie beheren.
- U **kunt uzelf niet verwijderen** (uzelf deactiveren is ook een slecht idee — u sluit uzelf buiten).

De hiërarchie:

```
Super Admin    (niveau 0 — leverancier)
   │
   ▼
Org Admin      (niveau 1 — hoofdkantoor)
   │
   ▼
Vestigingsmanager  (niveau 2 — filiaal)
   │
   ▼
Kassier            (niveau 3)
Auditor            (niveau 3)
API-integratie     (niveau 3)
```

In de praktijk geeft dit:

| Als u een… bent | U kunt aanmaken / bewerken | U kunt niet aanraken |
|---|---|---|
| **Super Admin** | Iedereen, overal | (niets — volledige reikwijdte) |
| **OA** | Vestigingsmanagers, kassiers, auditors, API-integratieaccounts — binnen uw organisatie | Andere OA's, Super Admins, gebruikers in *andere* organisaties |
| **Vestigingsmanager** | Kassiers (en auditors / API-integratie als uw klantstructuur die op filiaalniveau plaatst) binnen uw organisatie | Andere vestigingsmanagers, OA, Super Admin |
| **Kassier / auditor / API** | Niemand | Iedereen |

> **U kunt geen gelijke degraderen.** Een OA die de rol van een andere OA probeert te wijzigen krijgt een 403 van de API. Dat is opzettelijk — het stopt dat één hoofdkantoor-admin een ander stilletjes buitensluit. Als dit moet gebeuren, is het een Super Admin-taak.

---

## 3.2 Een nieuwe gebruiker stap voor stap aanmaken

**Pad:** Dashboard → **Gebruikers** (linker zijbalk) → **Gebruiker aanmaken** (knop rechtsboven).

Het modal Gebruiker aanmaken opent. Velden:

| Veld | Verplicht | Opmerkingen |
|---|:-:|---|
| **Volledige naam** | ✅ | Echte juridische naam. Verschijnt op de bon als kassiersnaam. |
| **E-mailadres** | ✅ | Hun werk-e-mail. Dit is ook hun login. Moet uniek zijn over het hele platform. |
| **Rol** | ✅ | Kies uit de zes. Een eenregelige hint verschijnt onder het keuzemenu met uitleg over wat die rol mag. |
| **Organisatie** | ⚠️ | Verplicht voor OA, vestigingsmanager, kassier, auditor, API-integratie. Verborgen voor Super Admin (platformniveau, geen org). Voor niet-Super Admin-makers is het veld vergrendeld op uw eigen org. |
| **Taal** | ✅ | `Nederlands` of `English`. Standaard UI-taal. De gebruiker kan dit veranderen op het scherm Mijn Account. |
| **Tijdelijk wachtwoord** | ✅ | Min. 8 tekens. Tik op **Genereer** voor een sterke willekeurige. Het oogje-icoon toont/verbergt de waarde. |
| **Welkom-e-mail versturen** | optioneel | Standaard aan. Mailt de gebruiker de login-URL + hun inloggegevens. |

Tik op **Gebruiker aanmaken**.

### 3.2.1 Vestigingstoewijzing (alleen cashier + store_manager)

![Gebruikersformulier met het keuzemenu Toegewezen vestiging voor een kassierrol](screenshots/03-user-form-store-picker.png)

Wanneer u **Kassier** of **Vestigingsmanager** als rol kiest, verschijnt onder de rolkeuze een extra keuzemenu **Toegewezen vestiging**. Het toont elke vestiging in de organisatie — kies precies één. **Eén gebruiker, één vestiging.**

> **Waar u het resultaat ziet:** de Gebruikerslijst toont een kolom **Vestiging** met de vestigingsnaam voor elke kassier/manager, *n.v.t.* voor org-scoped rollen en een gele ⚠️ *Geen vestiging*-waarschuwing voor elke kassier/manager met een ontbrekende toewijzing (data-invoerfout — repareer via Bewerken). Kassiers en managers zien ook hun eigen toewijzing op hun **Mijn Account**-paginakop (*"📍 Toegewezen aan De Hoop — Paramaribo Centrum"*), zodat ze die kunnen bevestigen zonder het u te vragen. Het Bewerken-modal vult hetzelfde keuzemenu vooraf in met wat al is ingesteld — een gebruiker bewerken wist de vestigingsverbinding niet langer stilzwijgend.

**Regels:**

- **Kies precies één vestiging** waar de gebruiker werkt. De kassier ziet alleen die vestiging op de POS (de chooser kiest die automatisch bij inloggen), en `register-open` retourneert *403 STORE_NOT_ASSIGNED* als ze proberen een kassa te openen in een andere vestiging. De Z-Rapport-sluiting en refund-goedkeuringsendpoints dwingen dezelfde check af voor vestigingsmanagers.
- **Verplicht voor kassier + vestigingsmanager.** De knop Aanmaken / Opslaan blijft uitgeschakeld totdat u een vestiging kiest. De backend geeft ook een 422 bij een aanmaak met een ontbrekende of ongeldige `store_id` voor deze rollen.
- **Verboden voor org-scoped rollen** (OA, auditor, Super Admin, API-integratie). De picker is voor hen verborgen en de backend wijst elke `store_id`-waarde af met een 422. Ze opereren per ontwerp op orgniveau — geen eigen vestiging.
- **Iemand nodig op twee vestigingen?** Maak twee accounts aan (één per vestiging). Er is geen multi-vestigingtoewijzing en geen "vrije kassier"-patroon — dat is een bewuste beslissing om auditattributie helder te houden en stille cross-vestiging-verkopen te voorkomen.

Vastgelegd in het auditlogboek als `user.store_assigned` met de van→naar-delta, door wie en wanneer. Zo kan een Rekenkamer-auditor bewijzen "deze kassier was alleen toegewezen aan De Hoop — Paramaribo Centrum op 12 mei 2026, verplaatst naar De Hoop — Nickerie op 23 mei 2026".

Wanneer u de rol van een vestigingsgebonden gebruiker wijzigt naar een org-scoped rol (bv. een vestigingsmanager promoveren tot OA), wist het dashboard automatisch de nu betekenisloze `store_id` en logt de backend de wijziging. Later weer degraderen vereist dat u opnieuw een vestiging kiest.

### Nadat de gebruiker is aangemaakt

Een groene bevestigingsbanner verschijnt bovenaan het Gebruikers-scherm met de e-mail en het wachtwoord in platte tekst, plus een knop **Kopieer inloggegevens**. **Toon dit één keer aan de gebruiker, en niet meer dan dat.** Het platte-tekst wachtwoord wordt nooit meer getoond — verliezen ze het, dan reset u het (§3.7).

De gebruiker moet het tijdelijke wachtwoord bij eerste login wijzigen. Ze kunnen op dat moment ook verplicht 2FA inschrijven als het beleid dat eist (§3.9).

### De juiste rol kiezen — snelle herinnering

| De persoon die u toevoegt… | Kies deze rol |
|---|---|
| Beheert de catalogus, prijzen, alle filialen op hoofdkantoor | Organisatiebeheerder |
| Runt één specifieke vestiging, superviseert daar kassiers | Vestigingsmanager |
| Staat aan een kassa, rekent klanten af | Kassier |
| Belastingdienst / Rekenkamer-inspecteur, interne accountant | Auditor (alleen-lezen) |
| Externe POS of e-commercesysteem dat verkopen pusht | API-integratie |
| Een andere leverancier-engineer | Super Admin (zeldzaam — alleen voor uw eigen team) |

De volledige rolreferentie staat in Hoofdstuk 1.

> **Eén persoon, één account.** Weersta de verleiding om een account te delen tussen twee kassiers "voor vandaag even". Elke verkoop wordt toegeschreven aan de ingelogde gebruiker, en het auditlogboek vertrouwt daarop. Delen twee mensen een login, dan kunt u niet vertellen wie een terugbetaling heeft afgerekend.

---

## 3.3 Een bestaande gebruiker bewerken

**Pad:** Dashboard → Gebruikers → klik de knop **Bewerken** op de rij van de gebruiker.

Het modal Gebruiker bewerken opent met alles vooringevuld. U kunt wijzigen:

- Naam, e-mail
- Rol (zie §3.4 hieronder — dit heeft neveneffecten)
- Organisatie (alleen Super Admin — verplaatst een gebruiker tussen orgs)
- Taal
- Status — *Actief* / *Inactief* (dit is hetzelfde als de knop Deactiveren op de tabelrij; zie §3.5)
- **Nieuw wachtwoord** — optioneel. Laat leeg om het huidige te behouden.

Tik op **Wijzigingen opslaan**.

> **E-mailwijzigingen propageren onmiddellijk.** De volgende login van de gebruiker moet de nieuwe e-mail gebruiken. Is de gebruiker op dit moment ingelogd, dan blijft hun bestaande sessie werken — maar de volgende keer dat ze uitloggen, hebben ze de nieuwe e-mail nodig om weer in te loggen. Vertel het ze.

---

## 3.4 Iemands rol midden in de dienst wijzigen

Rolwijzigingen treden in werking **zodra u op Opslaan klikt**. Het systeem maakt de bestaande sessies van de gebruiker binnen seconden ongeldig — ze worden geforceerd uitgelogd op elk apparaat waarop ze zijn ingelogd. Hun volgende login toont hen de view van de nieuwe rol.

Gebruik dit wanneer:
- Een kassier wordt gepromoveerd tot vestigingsmanager
- Een vestigingsmanager tijdelijk hoofdkantoor-werk dekt (geef ze OA voor de week, daarna degraderen)
- Een audit van een auditor voorbij is (degradeer naar gedeactiveerde staat — of gewoon deactiveren)

De wijziging wordt geregistreerd in het auditlogboek: oude rol, nieuwe rol, wie wijzigde, wanneer, IP-adres. Komt er ooit een dispuut, dan kunt u bewijzen wie wie heeft gepromoveerd en wanneer.

> **Wees voorzichtig met kassier → manager.** Een kassier die midden in hun dienst wordt gepromoveerd terwijl hun kassa open is, behoudt de open sessie. De sessieattributie verandert niet — verkopen die die dag al zijn afgerekend, tonen nog steeds als "afgerekend door kassier X" omdat dat is wat ze toen waren. Hun *volgende* verkoop toont onder de nieuwe rol.

---

## 3.5 Deactiveren vs verwijderen

**Deactiveren** (`is_active = false`) is wat u **99% van de tijd** wilt:

- De gebruiker kan niet meer inloggen.
- Hun historische verkopen, terugbetalingen, kassasessies, auditlog-vermeldingen zijn allemaal bewaard — ze tonen voor altijd "afgerekend door Sharmila Jankipersad".
- U kunt ze met één klik heractiveren als ze terugkomen.
- Er gaat geen data verloren. Geen rapporten breken.

**Hard verwijderen** is beperkt: alleen Super Admin en OA kunnen verwijderen, en zelfs dan alleen gebruikers onder hen in de hiërarchie. De dashboard-UI toont momenteel alleen de deactiveer-knop op elke rij — hard verwijderen is voorbehouden aan leverancier-support (`DELETE /api/users/{id}` via API-sleutel), omdat het neveneffecten heeft op historische rapportage die een menselijke beoordeling vereisen.

**Om te deactiveren vanuit de Gebruikerslijst:**

1. Vind de rij van de gebruiker.
2. Tik op de rode knop **Deactiveren**.
3. Bevestig de prompt.

De statusbadge van de rij wisselt naar grijs *Inactief*. De open dashboard- of POS-sessies van de gebruiker worden binnen seconden beëindigd.

**Om te heractiveren**: dezelfde knop, nu groen en gelabeld **Activeren**.

---

## 3.6 Wat gebeurt er met de data van een gebruiker bij deactivering

| Data | Wat er gebeurt | Waarom |
|---|---|---|
| **Eerdere verkopen** die ze hebben afgerekend | Tonen nog steeds hun naam. Tellen nog steeds mee in BTW-rapporten, Z-Rapporten, Top Kassier-rangschikkingen. | Vereist door Belastingdienst en Rekenkamer — bonnen kunnen niet retroactief worden afgemeld. |
| **Eerdere kassasessies** | Nog steeds vermeld onder hun naam in de geschiedenis van het Kassabeheer-scherm. | Verschillen moeten traceerbaar blijven naar de kassier die die lade telde. |
| **Auditlog-vermeldingen** die zij hebben getriggerd | Onaangeroerd. Alleen toevoegen. | Manipulatiebestendig per ontwerp — zie Hoofdstuk 13. |
| **Openstaande vastgehouden bonnen** | Worden verweesd — zichtbaar voor andere kassiers in dezelfde vestiging die ze kunnen oppakken. | Klant wil zijn vastgehouden bon nog steeds afgerekend hebben. |
| **2FA-geheim + apparaat** | Bij volgende heractivering gewist (ze schrijven zich opnieuw in). | Schoon opnieuw uitgegeven als ze ooit terugkomen. |
| **Inlogmogelijkheid** | Onmiddellijk ingetrokken. | Het hele punt van deactivering. |

> **Deactivering is de juiste zet voor mensen die vertrekken.** Weersta de drang om "op te ruimen" door ze te verwijderen. De winkelvloer draaide nog steeds op hun diensten — die diensten moeten in de boeken blijven leven.

---

## 3.7 Het wachtwoord van een gebruiker resetten

Zowel Super Admin als OA (en vestigingsmanager, binnen hun organisatie, voor gebruikers onder hen) kunnen een wachtwoord resetten.

**Pad:** Dashboard → Gebruikers → **Bewerken** van de gebruiker → scroll naar **Nieuw wachtwoord** → typ er een of tik op **Reset** om automatisch te genereren → **Opslaan**.

Het nieuwe wachtwoord treedt onmiddellijk in werking. De bestaande sessie van de gebruiker blijft werken totdat ze uitloggen — op dat punt hebben ze het nieuwe wachtwoord nodig om weer in te loggen. **Communiceer het nieuwe wachtwoord buiten de band met hen** (persoonlijk, telefonisch, via een versleuteld kanaal). E-mail is niet ideaal omdat e-mail zelf meestal onversleuteld is tijdens transit.

> **Reset is niet hetzelfde als "wachtwoord vergeten".** Vanaf deze release is er geen self-service "wachtwoord vergeten"-link op het inlogscherm — een manager moet resetten namens de gebruiker. Kan een kassier niet inloggen, dan belt die de vestigingsmanager. Kan een vestigingsmanager niet inloggen, dan belt die de OA. Kan een OA niet inloggen, dan handelt de Super Admin (uw leverancier-support) het af.

---

## 3.8 Self-service: wat gebruikers zelf kunnen doen

Iedereen, ongeacht rol, kan:

- Hun eigen **wachtwoord** op elk moment wijzigen
- Hun eigen **naam** en **e-mail** bijwerken
- Hun eigen UI-**taal** wisselen tussen `nl` en `en` (direct — geen uitloggen)
- Hun eigen **2FA** inschrijven of opnieuw inschrijven (als beleid het vereist voor hun rol)
- Hun eigen **prestaties**-statistieken zien (kassiers: eigen verkopen vandaag, deze week, deze maand)

Dit alles leeft in **Mijn Account** — zie Hoofdstuk 18 voor de gebruikerskant-doorloop. De dashboardnavigatie heeft een `Mijn Account`-entry onderaan de zijbalk (kassiers zien *alleen* deze entry als ze inloggen op het dashboard — al het andere is voor hen verborgen).

---

## 3.9 2FA-installatie, vanuit het perspectief van de gebruiker

Tweestapsverificatie is vereist voor sommige rollen (altijd Super Admin en alle gebruikers in overheidsinstellingen; configureerbaar voor de overige via het paneel **Tweestapsverificatie per rol** bovenaan het Gebruikers-scherm — alleen Super Admin).

Wanneer een gebruiker wiens rol 2FA vereist voor het eerst inlogt nadat het beleid is ingeschakeld:

1. **Ze loggen in met e-mail + tijdelijk wachtwoord.**
2. Het systeem **stuurt ze door naar het 2FA-inschrijvingsscherm** in plaats van het dashboard.
3. Het scherm toont een QR-code. Ze scannen die met **Google Authenticator**, **Microsoft Authenticator**, **Authy** of een andere TOTP-app op hun telefoon.
4. Het scherm vraagt om de 6-cijferige code uit de app om het apparaat te bevestigen.
5. Het scherm toont **herstelcodes** — afdrukbare eenmalige back-upcodes voor als ze de telefoon kwijtraken. Ze moeten deze opslaan (we raden aan twee kopieën te printen — één in de kluis van de manager, één in hun eigen portemonnee).
6. Ze worden naar het dashboard gebracht.

Bij elke volgende login, na e-mail + wachtwoord, krijgen ze een prompt "Voer de 6-cijferige code uit uw authenticator-app in".

> **Wat gebeurt als ze de telefoon verliezen?** Ze gebruiken een herstelcode. Hebben ze ook de herstelcodes verloren, dan moet een admin die ze mag beheren (volgens §3.1) hun 2FA resetten — wat het geheim wist en bij de volgende login herinschrijving forceert. Er is geen "sla 2FA even over"-optie. Dat is per ontwerp.

Voor Super Admin- en overheidsgebruikers kan 2FA door niemand worden uitgeschakeld — zelfs niet door een andere Super Admin. Het systeem dwingt dit af op API-niveau. Voor configureerbare rollen kan een admin het beleid uitschakelen in het Gebruikers-scherm → 2FA-paneel; bestaande 2FA-inschrijvingen blijven maar nieuwe gebruikers in die rollen worden niet gedwongen in te schrijven.

### Wat de 2FA-kolom in de gebruikerstabel u vertelt

De kolom **2FA** in de Gebruikerslijst toont een groene ✓ *Actief*-badge voor elke gebruiker die inschrijving heeft voltooid. Een streepje (`—`) betekent dat ze nog niet zijn ingeschreven — ofwel omdat hun rol het niet vereist, ofwel omdat ze een gloednieuw account zijn dat stap 2 van de bovenstaande inschrijvingsflow nog niet heeft bereikt.

De header van het Gebruikers-scherm heeft ook een snelle statistiekrij: **Met 2FA**-aantal, naast totaal aantal gebruikers en actieve gebruikers. Handig om aan een compliance-auditor te bewijzen dat alle mensen die 2FA zouden moeten hebben, het ook hebben.

---

## 3.10 Snelreferentie — dagelijkse gebruikersbeheer-acties

```
AANNEMEN          Gebruikers → + Gebruiker aanmaken → formulier invullen → Inloggegevens persoonlijk overhandigen
BEVORDEREN        Gebruikers → Bewerken → Rol wijzigen → Opslaan (geforceerde uitlog binnen seconden)
WACHTWOORD RESETTEN Gebruikers → Bewerken → Nieuw wachtwoord → Reset/typen → Opslaan → gebruiker buiten de band vertellen
ORG OVERPLAATSEN  (alleen Super Admin) Gebruikers → Bewerken → Organisatie wijzigen → Opslaan
DEACTIVEREN       Gebruikersrij → Deactiveren-knop → bevestigen → grijze badge
HERACTIVEREN      Gebruikersrij → Activeren-knop → bevestigen → groene badge
```

Voor rolbeslissingen, zie Hoofdstuk 1.
Voor auditspoor-forensisch onderzoek ("wie heeft de rol van Rashied vorige dinsdag gewijzigd?"), zie Hoofdstuk 13.

---

→ Volgende: [Hoofdstuk 4 — Productcatalogus en categorieën](04-catalogue-and-categories.md)
