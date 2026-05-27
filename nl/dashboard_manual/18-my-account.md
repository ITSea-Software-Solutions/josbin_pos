# Hoofdstuk 18 — Mijn account

**Voor wie:** elke geauthenticeerde gebruiker — Super Admin, Organisatiebeheerder, Vestigingsmanager, Kassier, Auditor. **Ja, ook kassiers en auditors.** Dit is het enige dashboardgebied dat beschikbaar is voor rollen die anders niets te zoeken hebben in het dashboard.

**Wanneer u het nodig heeft:** om uw wachtwoord te wijzigen, de interfacetaal te wisselen, te controleren hoe u (persoonlijk) vandaag heeft gepresteerd, of uw recente diensten op te halen om te herinneren wat er op dinsdag is gebeurd. Nieuwe medewerkers openen het op hun eerste dag om te bevestigen dat hun profiel correct is.

**Wat het voorkomt:** de manager die om 19:00 wordt gebeld omdat iemand zijn wachtwoord vergeten is (zij kunnen zelf bedienen), en de ongemakkelijke teambrede e-mail met de vraag "wat was mijn sluitingscontant op de 14e?" (zij kunnen het zelf opzoeken).

![18 mijn account tabs](screenshots/18-my-account-tabs.png)
---

## 18.1 De strikte scoping-regel

Allereerst: **elk endpoint achter Mijn account scopet alleen naar de aanroepende gebruiker.** Er is geen parameter, geen padsegment, geen body-veld dat u laat vragen naar "iemand anders zijn" prestaties of diensten. De backend leest alleen `$request->user()` en negeert alles wat dit tegenspreekt.

Praktisch gevolg: een kassier die de Mijn account-pagina laadt, ziet zijn eigen verkopen — maar als hij `curl /api/me/sales-summary` aanroept met het sessietoken van een andere gebruiker, krijgt hij *die* gebruikersdata. Er is geen manier om over te kijken.

Voor "alle kassierprestaties naast elkaar zien" op hoofdkantoorniveau, is dat een ander scherm en een ander recht — zie [Hoofdstuk 1](01-roles-and-permissions.md) voor de matrix, en het (komende) rapporten-hoofdstuk voor de manager-zijde view.

---

## 18.2 Mijn account openen

**Pad:** Dashboard → rechtsboven gebruikersavatar → **Mijn account** (of de naam van de gebruiker in de hoek — beide gaan naar dezelfde plek).

Voor rollen die geen echt dashboard hebben (Kassier, Auditor onder bepaalde configuraties), routeert inloggen ze *automatisch* naar Mijn account als landingspagina. Zij kunnen niet ergens anders heen navigeren; dit is hun volledige dashboardweergave.

De paginakop toont:

- Een gekleurde initialen-avatar (`Sandra Codrington` → `SC`)
- Volledige naam
- Rollabel, in de locale van de gebruiker (`Organisatiebeheerder` of `Organisation Admin`)
- E-mailadres

Daaronder een drie-tabs-strook:

1. **Mijn prestaties** (standaard)
2. **Mijn diensten**
3. **Profiel & wachtwoord**

Klik tussen ze — geen page reload.

---

## 18.3 Tab 1 — Mijn prestaties

**Voor:** iedereen die persoonlijk verkopen boekt (Kassier, soms Vestigingsmanager) of zijn persoonlijke verkooptoeschrijving in één oogopslag wil zien.

Drie gevensterde kaarten bovenaan:

| Kaart | Venster | Getoonde metrieken |
|---|---|---|
| **Vandaag** | Middernacht AST → nu | Totaal SRD, aantal verkopen, gemiddelde besteding, BTW SRD |
| **Deze week** | Vorige maandag → nu | Dezelfde metrieken |
| **Deze maand** | 1e van de maand → nu | Dezelfde metrieken |

Elke kaart is groot (SRD-cijfer prominent), met het aantal, gemiddelde besteding, en BTW-totaal in kleinere tekst eronder.

Onder de kaarten: **🏆 Topproduct deze maand** — een enkele gemarkeerde kaart met:

- De productnaam (snapshot op het moment van verkoop — overleeft zelfs als het product later wordt hernoemd)
- Eenheden verkocht deze maand door deze gebruiker
- Totale omzet SRD deze maand van dit product

> De prestatietoeschrijving gebruikt `sales.cashier_id`. Als een kassier tussen kassa's of vestigingen beweegt tijdens de periode, volgt hun prestatie hen — het is niet kassa-gescopet, het is gebruiker-gescopet. Verkopen gepusht via de Open Integration API (Hoofdstuk 12) hebben `cashier_id = null` en verschijnen nooit in iemands individuele prestaties.

Voor rollen die nooit verkopen boeken (Organisatiebeheerder, Auditor, Super Admin), tonen de kaarten nullen en is de top-product-kaart afwezig. Dat is normaal — de data is er gewoon niet voor die rollen.

![18 mijn prestaties](screenshots/18-my-performance.png)
---

## 18.4 Tab 2 — Mijn diensten

**Voor:** elke gebruiker die een kassa heeft geopend of gesloten (Kassier het vaakst; Vestigingsmanager wanneer zij de kassa hebben gedekt).

Toont de **laatste 30 kassasessies** in uw bezit, nieuwste eerst.

| Kolom | Wat het toont |
|---|---|
| **Geopend** | Open-tijdstempel, geformatteerd als datum + tijd |
| **Kassa** | Kassanaam + vestigingsnaam, bv. *Kassa 1 · De Hoop — Paramaribo Centrum* |
| **Status** | Gekleurd pilletje — **Open** (groen), **Gesloten** (grijs), **Heropenen?** (amber — manager heeft gevraagd deze sessie te heropenen, zie Hoofdstuk 11) |
| **Geteld (SRD)** | Contant geteld bij sluiting, of `—` indien nog open |
| **Verschil** | Verschil tussen verwacht vs geteld. Negatief = tekort (rood), positief = overschot (groen), nul = schoon (grijs, streep) |

Verschillen worden hier expliciet getoond zodat de kassier zijn eigen geschiedenis ziet van hoe accuraat zijn kastellingen zijn geweest. Een patroon (consistent SRD 5 tekort) is in één oogopslag zichtbaar.

> Sessies ouder dan de laatste 30 worden niet gepagineerd in deze weergave — by design, dit is "uw recente dagen" niet "uw volledige audithistorie". Auditors en managers kunnen de volledige set ophalen uit het auditlogboek (Hoofdstuk 13, binnenkort beschikbaar).

---

## 18.4a Tab 3 — Mijn activiteit (ook org-gescopete rollen)

SA, OA, Auditor, API-integratie, en tax_inspector boeken geen verkopen — maar zij nemen nog wel *administratieve* acties die het waard zijn om te zien. Het tabblad **Mijn activiteit** toont de eigen entries van de gebruiker uit het platform-auditlogboek: wie zij hebben bewerkt, wanneer, vanaf welk IP, en de vóór/na van de wijziging.

![Mijn account — Activiteit-tab](./screenshots/18-my-account-activity.png)

De lijst:
- 100 meest recente gebeurtenissen die de gebruiker zelf heeft getriggerd (oudere gebeurtenissen leven in het volledige auditlogboek — Hoofdstuk 13)
- Elke rij toont gebeurtenisnaam, doeltype+id, AST-tijdstempel, en IP
- Klik op een rij om de oud → nieuw-diff uit te klappen (zelfde vorm als de OA ziet in het globale auditlogboek)

Dit is de eigen persoonlijke verantwoordingsoppervlakte van de gebruiker — "wat heb ik vorige week gedaan?" — en een snelle sanity check voordat iets gevoeligs wordt gedaan ("heb ik Sandra die toestemming al verleend, of stond ik op het punt?").

> Kassier en Vestigingsmanager zien dit tabblad *ook*, naast de tabbladen Mijn prestaties + Mijn diensten hierboven — nuttig wanneer de manager vergeten is welke overrule-notitie hij om 14:00 heeft getypt.

---

## 18.4b Tab 4 — Actieve apparaten

Een lijst van elk apparaat dat momenteel als u is ingelogd, met de optie om er een in te trekken. Dezelfde rijdata die de OA ziet in de platformbrede sessiemanager, gescopet op uw eigen gebruiker.

![Mijn account — Actieve apparaten-tab](./screenshots/18-my-account-sessions.png)

| Kolom | Wat het toont |
|---|---|
| Apparaat | Browser + OS-sniff vanuit de user-agent ("Chrome op macOS", "Edge op Windows 11") |
| Locatie | IP + benaderende stad (Paramaribo, Nickerie, etc.) |
| Laatst gezien | Meest recente aanvraag van dit token, AST |
| Status | "Huidige sessie"-markering voor degene waarop u nu zit |
| Actie | Knop **Beëindig** — invalideert het token onmiddellijk |

Uw eigen huidige sessie intrekken logt u direct uit (u landt terug op het loginscherm). Trek een andere rij in om een verouderd apparaat te doden, een vergeten cafébrowser, of een tablet die u bent kwijtgeraakt — zonder uw wachtwoord te hoeven wijzigen.

> **Beveiligingshygiëne-tip:** als u een rij ziet van een IP / apparaat dat u niet herkent, trek het in EN wijzig uw wachtwoord (Profiel-tab hieronder). E-mail vervolgens Josbin-support — wij controleren het auditlogboek voor wat die sessie heeft gedaan.

---

## 18.5 Tab 5 — Profiel & wachtwoord

Twee kaarten naast elkaar:

### 18.5.1 Profielkaart

| Veld | Bewerken | Notities |
|---|:-:|---|
| **Naam** | ja | Vrije tekst, 2–120 tekens. Gebruikt op bonnen als "Kassamedewerker: `<naam>`" en in het auditlogboek. |
| **E-mail** | ja | Gebruikt voor login en wachtwoord-reset. Moet platformbreed uniek zijn. |
| **Taal** | ja | `nl` of `en` — directe per-gebruiker switch, geen restart. Direct opgeslagen bij formulierverzending. |

Opslaan met **Profiel opslaan**. Bij succes verschijnt een groene `✓ Opgeslagen`-bevestiging gedurende 2 seconden. De header erboven wordt bijgewerkt om de nieuwe naam + e-mail + locale weer te geven; het i18n-bundel slaat direct om als u de locale heeft gewijzigd.

Het formulier staat **geen** bewerking toe van:

- `role` — alleen een admin (Organisatiebeheerder of hoger) kan de rol van een gebruiker wijzigen, via Gebruikers-scherm. Zie [Hoofdstuk 3](03-users.md).
- `organisation_id` — vast bij aanmaak; wijzigen vereist Super Admin-interventie.
- `is_active` — gecontroleerd door admins, niet de gebruiker zelf.
- `is_super_admin` — idem.

Probeer een van deze te PATCHen via de API als niet-admin en het verzoek dropt stil het veld; het gebruikersrecord is ongewijzigd voor die sleutel.

### 18.5.2 Wachtwoordwijzigingskaart

| Veld | Vereist | Validatie |
|---|:-:|---|
| **Huidig wachtwoord** | ja | Herinvoer vereist. Moet overeenkomen met de huidige `bcrypt`-hash van de gebruiker. |
| **Nieuw wachtwoord** | ja | Minimaal 10 tekens, moet letters EN cijfers bevatten (Laravel `Password::min(10)->letters()->numbers()`). |
| **Herhaal nieuw wachtwoord** | ja | Moet gelijk zijn aan het nieuwe wachtwoord. |

Validatie vindt client-side plaats (knop is grijs totdat alle drie zijn ingevuld en de twee nieuwe-wachtwoord-velden overeenkomen) en server-side. Server-side fouten retourneren JSON met het specifieke fout-veld.

Tik op **Wachtwoord wijzigen**. Bij succes:

> *"✓ Wachtwoord gewijzigd. Andere apparaten zijn uitgelogd."*

Wat er net is gebeurd op de server:

1. Huidig wachtwoord geverifieerd tegen de opgeslagen bcrypt-hash (cost factor 12).
2. Nieuw wachtwoord gehasht met hetzelfde algoritme en opgeslagen.
3. **Elk Sanctum-token dat de gebruiker bezit wordt ingetrokken BEHALVE degene gebruikt voor dit verzoek.** Elk ander apparaat waar de gebruiker op was ingelogd (een tablet thuis, een tweede laptop, de kassa) is nu uitgelogd en moet het nieuwe wachtwoord opnieuw invoeren om door te gaan.
4. Het sessietoken in *dit* browsertabblad blijft werken — geen ongemakkelijke "u bent uitgelogd uit de browser waarin u net op Opslaan heeft geklikt".

Als het huidige wachtwoord verkeerd is, retourneert de server:

> *"Het huidige wachtwoord is onjuist."*

…in rood onder de wachtwoordkaart. Geen tokens worden ingetrokken, niets wordt gewijzigd.

![18 wachtwoordwijziging](screenshots/18-password-change.png)
---

## 18.6 Hoe zit het met 2FA-inschrijving?

Tweestapsinschrijving voor gebruikers die vereist zijn (of zich hebben aangemeld) gebeurt op het **loginscherm** — niet op de Mijn account-pagina. Wanneer 2FA vereist is voor de rol van de gebruiker en zij hebben nog geen secret gebonden, omleidt de loginflow via:

1. QR-code weergave
2. Authenticator-app pairing
3. Eerste 6-cijferige code-verificatie
4. Recovery codes EENMAAL getoond

Daarna daagt elke volgende login hen uit voor de TOTP-code.

Om **vrijwillig in te schrijven** wanneer de rol het niet vereist, of om 2FA **uit te schakelen** wanneer het niet beleidsvereist is voor de rol: dat woont in een aparte **Beveiliging** sub-sectie op het gebruikersprofiel — momenteel uitrolling (gerefereerd in `dashboard/src/screens/TwoFactorScreen.tsx`). Wanneer live, verwacht een *"Tweestapsverificatie"*-toggle op dit Profiel-tabblad.

Voor het beleid dat bepaalt of 2FA vereist is voor *uw* rol, zie [Hoofdstuk 17 — Beveiligingsbeleid](17-security-policy.md). Voor verloren-telefoon-herstel, neem contact op met uw Organisatiebeheerder — zij kunnen uw 2FA resetten op **Gebruikers → rij → Reset 2FA**.

---

## 18.7 Wat andere gebruikers zien als zij snuffelen

Een korte notitie over de strikte-scoping-belofte, gedemonstreerd met curl. Ingelogd als een Kassier:

```bash
# Hun eigen data — werkt
curl -s -H "Authorization: Bearer $CASHIER_TOKEN" \
     http://localhost:8080/api/me/sales-summary
# → 200 OK met hun persoonlijke cijfers

# Probeer toegang te krijgen tot /api/users/{some_other_user}/sales-summary — zo'n route bestaat niet
curl -s -H "Authorization: Bearer $CASHIER_TOKEN" \
     http://localhost:8080/api/users/00000000-…/sales-summary
# → 404 Not Found (route bestaat niet by design)

# Probeer een ander gebruikersprofiel te PATCHen via het users-endpoint
curl -s -X PATCH -H "Authorization: Bearer $CASHIER_TOKEN" \
     http://localhost:8080/api/users/00000000-…
# → 403 Forbidden (kassier heeft geen users.* recht)
```

De /me-endpoints zijn het enige self-service-oppervlak. Zij gebruiken `$request->user()` exclusief en accepteren geen user-id-invoer.

---

## 18.8 Per-rol verschillen — wat is verborgen

| Tab | Super Admin | OA | Vestigingsmanager | Kassier | Auditor |
|---|:-:|:-:|:-:|:-:|:-:|
| Mijn prestaties | toont nullen (verkoopt niet) | toont nullen | toont hun kassaverkopen wanneer zij dekken | volledig | toont nullen |
| Mijn diensten | leeg | leeg | hun dek-diensten | volledig | leeg |
| Profiel | volledig | volledig | volledig | volledig (soms het enige scherm dat zij zien) | volledig |

Functioneel zijn de tabbladen voor iedereen hetzelfde. De inhoud verschilt omdat de onderliggende data verschilt.

---

## 18.9 Veelvoorkomende vragen

**V: Ik heb mijn e-mail gewijzigd. Werkt de welkomstmail voor het oude adres?**
A: Nee — het oude e-mailadres is weg op het moment dat u opslaat. Gebruik het nieuwe e-mailadres bij de volgende login. Als u zich vertypte, vraag een admin om het voor u te resetten via het Gebruikers-scherm.

**V: Ik heb mijn wachtwoord gewijzigd maar ik ben nog steeds ingelogd op mijn tablet thuis.**
A: Nee, dat bent u niet. De sessie van de tablet thuis werd ingetrokken op het moment dat u opsloeg. Vernieuw de tablet — hij stuurt u terug naar het loginscherm.

**V: Mijn taal is omgeslagen maar de bonnen die ik net heb afgedrukt zijn nog in de oude taal.**
A: Bonnen gebruiken de **vestiging**'s bontemplate-taal, niet die van u. Om de bontaal te wisselen, wijzigt een Organisatiebeheerder de locale van de vestiging (Hoofdstuk 2).

**V: Ik heb een dienst gesloten met een verschil. Kan ik het van hieruit bewerken om de telling te corrigeren?**
A: Nee. Diensten zijn alleen-toevoegen. Eenmaal gesloten wordt het verschil permanent geregistreerd in het auditlogboek. Als een hertelling het contant vindt, registreert de manager een *aparte* contante aanpassing — zij herschrijven de geschiedenis niet. Zie Hoofdstuk 11 (binnenkort beschikbaar).

**V: Ik ben een kassier en het dashboard toont alleen Mijn account, niets anders.**
A: Dat klopt. Kassiers hebben geen andere dashboardmenu's by design — zie [Hoofdstuk 1 §1.2](01-roles-and-permissions.md#12-what-each-role-actually-does). Hun dagelijks werk is op de POS-app.

---

## 18.10 Snelle referentie

```
MIJN ACCOUNT OPENEN  Dashboard → rechtsboven gebruikersavatar → Mijn account

TABS                 1. Mijn prestaties        — Vandaag / Week / Maand verkopen
                     2. Mijn diensten          — Laatste 30 kassasessies
                     3. Profiel & wachtwoord   — Naam / e-mail / taal / wachtwoord

PROFIEL BEWERKEN     Profiel-tab → wijzig naam / e-mail / Taal → Profiel opslaan
                     Locale slaat direct om. Rol/org zijn HIER NIET bewerkbaar.

WACHTWOORD WIJZIGEN  Profiel-tab → huidig + nieuw + herhalen → Wachtwoord wijzigen
                     ≥ 10 tekens, letters + cijfers vereist
                     Alle ANDERE apparaten worden automatisch uitgelogd
                     De browser waarin u heeft opgeslagen blijft ingelogd

API ENDPOINTS        GET   /api/me/sales-summary
                     GET   /api/me/shifts
                     PATCH /api/me/profile      (alleen naam / e-mail / locale)
                     POST  /api/me/password     (huidig + nieuw + new_confirmation)

SCOPE-REGEL          Elk /me-endpoint gebruikt $request->user() alleen.
                     Geen user-id-parameter bestaat. Geen cross-user lek mogelijk.

KASSIER LOGIN        Kassiers die landen op het dashboard zien ALLEEN deze pagina.
                     Andere menu's zijn verborgen.
```

Voor 2FA-inschrijving en het per-rol-beleid dat controleert of u verplicht bent het te gebruiken, zie [Hoofdstuk 17 — Beveiligingsbeleid](17-security-policy.md). Voor admin-zijdige gebruikersbeheer (aanmaken, deactiveren, rol wijzigen, 2FA resetten namens een gebruiker), zie [Hoofdstuk 3 — Gebruikers](03-users.md).

---

→ Volgende: einde van Dashboard Handleiding v1. Zie de [Ontwikkelaarsdocumentatie](../docs/) voor de technische kant, of [Trainer Spiekbriefjes](../trainer_cheatsheets/) voor één-pagina afdrukbare referenties.
