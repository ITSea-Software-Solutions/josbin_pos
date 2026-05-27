# Hoofdstuk 17 — Beveiligingsbeleid: Tweestapsverificatie per rol

**Voor wie:** Alleen Super Admin. Het 2FA-per-rol-beleid is een platformbrede controle — niemand anders op het platform kan dit lezen of wijzigen.

**Wanneer te gebruiken:** bij installatietijd (stel de standaarden in voor het risicobeleid van de klant), bij het onboarden van een nieuwe rol van gebruikers (bepaal of kassiers 2FA krijgen), en elke keer dat een beveiligingsincident of audit-aanbeveling tot een aanscherping leidt.

**Wat het voorkomt:** de geleidelijke drift waarbij wachtwoord-only logins worden toegelaten in rollen die zinvolle toegang hebben. Zodra een Kassier- of Auditor-account is gecompromitteerd, is de blast-radius reëel — Kassier kan betalingen aannemen, Auditor kan elk BTW-cijfer lezen. 2FA is de goedkoopste mitigatie die er is.

> _Screenshot placeholder: `dashboard_manual/screenshots/17-2fa-policy-panel.png`._
> _Vereist Super Admin-vastlegging — het 2FA-beleidspaneel wordt alleen weergegeven voor Super Admins; het demo SA-account heeft 2FA afgedwongen, dus dit wordt handmatig vastgelegd._
---

## 17.1 De hiërarchie: altijd-vereist, overheid-vereist, configureerbaar

Drie categorieën accounts, op 2FA-vereiste:

| Categorie | Rollen erin | Kan de Super Admin 2FA uitschakelen? |
|---|---|---|
| **Altijd vereist** | Super Admin | **Nee.** Hard-coded in `User::TWO_FACTOR_ALWAYS_ROLES`. Verwijderen vereist een codewijziging + een redeploy. |
| **Overheid altijd vereist** | *Elke* gebruiker die behoort tot een organisatie met `is_government = true`, ongeacht rol | **Nee.** Vereist door WBP-S- en Rekenkamer-regels. Auto-afgedwongen zodra de `is_government`-vlag van de organisatie is ingesteld. |
| **Configureerbaar per rol** | Organisatiebeheerder, Vestigingsmanager, Kassier, Auditor | **Ja.** Super Admin toggelt individueel via dit scherm. |

API-integratie-accounts verschijnen helemaal niet — ze authenticeren via `X-API-Key`, niet TOTP. Het hele concept van "2FA voor een API-sleutel" is een ander probleem (sleutelrotatie + IP-allowlisting), behandeld in [Hoofdstuk 12](12-api-integrations-and-webhooks.md).

```
Super Admin                ─── 2FA hard-coded AAN, kan niet worden uitgeschakeld
Overheid-org-gebruikers    ─── 2FA geforceerd AAN voor elke rol in de organisatie
                               (ingesteld op organisatieniveau, zie Hoofdstuk 2)
Organisatiebeheerder       ─── Configureerbaar per platformbeleid
Vestigingsmanager          ─── Configureerbaar per platformbeleid
Kassier                    ─── Configureerbaar per platformbeleid
Auditor                    ─── Configureerbaar per platformbeleid
API-integratie             ─── Niet van toepassing (machine-account, API-sleutel-auth)
```

De interactie is **OR**, niet AND. Een gebruiker heeft 2FA vereist als:

```
required = is in TWO_FACTOR_ALWAYS_ROLES
        OR behoort tot een overheidsorganisatie
        OR hun rol is in two_factor_required_roles beleidsinstelling
```

---

## 17.2 Waar het beleid woont

Het beleid is opgeslagen onder één sleutel in de `app_settings`-tabel:

| Sleutel | Type | Voorbeeld |
|---|---|---|
| `two_factor_required_roles` | JSON-array van rolstrings | `["organisation_admin", "store_manager"]` |

Lezen:
- API: `GET /api/settings/two-factor-policy` (alleen Super Admin — retourneert anders 403)
- Backend: `AppSetting::get('two_factor_required_roles', [])`

Schrijven:
- API: `PUT /api/settings/two-factor-policy` met `{ "two_factor_required_roles": ["…"] }` (alleen Super Admin)
- Validatie verwijdert elke rol die niet in de configureerbare set zit, dus de API accepteert geen `["super_admin"]` (al verplicht) of `["api_integration"]` (niet van toepassing)
- Elke wijziging wordt geregistreerd in het onveranderlijke auditlogboek via de `Auditable`-trait van het `AppSetting`-model — oude waarde, nieuwe waarde, wie het wijzigde, wanneer, van waar

Er is **geen per-organisatie** 2FA-beleid. Het is platformbreed. De granulariteit is: "in het hele platform, welke rollen moeten 2FA gebruiken?" De twee uitzonderingen (altijd-vereist, overheid-altijd-vereist) worden bovenop gelaagd.

---

## 17.3 Het paneel openen

**Pad:** Dashboard → **Gebruikers** → scroll naar het paneel **🔐 Tweestapsverificatie per rol** bovenaan de pagina.

Het paneel is standaard ingeklapt. Klik op de header om uit te klappen.

Wanneer uitgeklapt ziet u:

1. Een uitlegregel: *"Super Admins en alle accounts van overheidsorganisaties zijn altijd verplicht — dit kan niet worden uitgeschakeld."*
2. Een lijst van **altijd-vereiste** rollen, elk met een paars pilletje: *"🔒 Altijd verplicht"*. Geen toggle — deze zijn alleen-lezen en nooit deactiveerbaar.
3. Een lijst van **configureerbare** rollen, elk met een schakelaar. Paars = aan, grijs = uit.
4. Knop **Beleid opslaan** (alleen actief wanneer er niet-opgeslagen wijzigingen zijn).
5. Een knop **Herstellen** om niet-opgeslagen wijzigingen te verwerpen.
6. Statusbevestiging bij opslaan: *"✓ Beleid opgeslagen"*.

> _Screenshot placeholder: `dashboard_manual/screenshots/17-2fa-policy-panel.png`._
> _Vereist Super Admin-vastlegging — het 2FA-beleidspaneel wordt alleen weergegeven voor Super Admins; het demo SA-account heeft 2FA afgedwongen, dus dit wordt handmatig vastgelegd._
Als u geen Super Admin bent, is het hele paneel verborgen (de API-aanroep retourneert 403 voordat het paneel wordt weergegeven).

---

## 17.4 De rol-voor-rol beslistabel

Dit is wat de meeste Super Admins willen weten: "voor welke rollen moet ik het vakje aanvinken?" Enkele eerlijke standaarden:

| Rol | Standaard AAN? | Reden |
|---|:-:|---|
| **Super Admin** | verplicht | Dit account compromitteren = elke klantdata compromitteren. Niet-onderhandelbaar. |
| **Organisatiebeheerder** | **AAN** | Bezit de mastercatalogus, neemt personeel aan + ontslaat, ziet elke omzet van elke vestiging. Zelfde blast radius als een CFO-lek. |
| **Vestigingsmanager** | **AAN** | Kan verkopen annuleren/terugbetalen, Z-Rapporten uitvoeren, klant-PII zien. De wrijving waard. |
| **Kassier** | **UIT** (standaard) voor retail; **AAN** voor overheidsafdelingen | Kassiers loggen vele keren per dag in/uit op gedeelde kassa-hardware. TOTP bij elke login vertraagt de wachtrij. Trade-off alleen de moeite waard voor high-trust omgevingen. |
| **Auditor** | **AAN** voor overheidsaudits; **UIT** voor toevallige externe accountants | Alleen-lezen betekent niet laag-risico — een auditor-account lekt elk BTW-cijfer, elke klantnaam (versleuteld maar identificeerbaar in aggregatie), elk Rekenkamer-relevant detail. |
| **Overheidsgebruikers (elke rol)** | altijd AAN | Hard-coded — zie §17.5. |
| **API-integratie** | n.v.t. | Authenticeert via `X-API-Key`. Zie [Hoofdstuk 12](12-api-integrations-and-webhooks.md). |

Voor een **gloednieuwe installatie** is de aanbeveling: zet Organisatiebeheerder + Vestigingsmanager + Auditor aan. Laat Kassier uit tenzij de klant specifiek vraagt. Herzie na de eerste 30 dagen op basis van wat personeel werkelijk doet aan de toonbank.

---

## 17.5 Overheidsorganisaties — de automatische uitzondering

Wanneer een organisatie wordt aangemaakt met `is_government = true` (zie Hoofdstuk 2 — Organisatie- & vestiging-setup), **wordt elke gebruiker die tot die organisatie behoort gedwongen in 2FA, ongeacht het platformbeleid.**

Dit omvat:

- Organisatiebeheerder → verplicht
- Vestigingsmanager → verplicht
- Kassier → verplicht (ja, zelfs aan de toonbank)
- Auditor → verplicht (vooral voor Rekenkamer-compliance-medewerkers)

De Super Admin **kan** dit niet overrulen. De `is_government`-vlag wordt eerst gecontroleerd in `User::requires2FA()` en short-circuits de beleidslookup:

```
if (always_role || is_government_user) {
    return true;          // 2FA vereist, geen ontsnapping
}
// alleen dan het beleid raadplegen
```

De reden: WBP-S (Wet Bescherming Persoonsgegevens Suriname) en de Verwerkersovereenkomst die we tekenen voor overheidsklanten vereisen expliciet **verplichte niet-omzeilbare 2FA** op elk account dat toegang heeft tot overheidsdata. De bypass bouwen zou contractbreuk zijn.

Kruislink: zie Hoofdstuk 1 §1.5 voor het bredere overheidsorganisatie-compliancepakket (single-device enforcement-optie, geo-alerts, geïsoleerde database, etc.).

---

## 17.6 Wat gebeurt er met gebruikers wanneer het beleid verandert

### Een rol toevoegen aan de vereiste lijst

1. Super Admin vinkt "Kassier" aan (bijvoorbeeld), slaat op.
2. Het auditlogboek registreert de wijziging.
3. **Geen bestaande kassier wordt gedwongen uitgelogd.** Hun huidige sessie blijft geldig.
4. De **volgende keer** dat een kassier inlogt, detecteert de loginflow dat zij nog geen 2FA hebben ingeschreven en presenteert het **2FA-inschrijfscherm** voordat zij de login kunnen voltooien:
   - Toon QR-code
   - Kassier scant deze met Google Authenticator / Microsoft Authenticator / Authy
   - Kassier voert de 6-cijferige code in om te bevestigen
   - 2FA is nu gebonden aan hun account
5. Vanaf die login eist elke login (inclusief sessieverfrissing na timeout) de TOTP-code.

### Een rol verwijderen uit de vereiste lijst

1. Super Admin vinkt "Kassier" uit, slaat op.
2. Bestaande kassiers die al hebben ingeschreven in 2FA **behouden** hun 2FA-setup — de beleidswijziging maakt het optioneel, niet verwijderd.
3. Zij kunnen het zelf uitschakelen via Mijn account → Profiel (Hoofdstuk 18), of aan laten staan.
4. Nieuwe kassiers aangemaakt na de wijziging krijgen niet de 2FA-inschrijfprompt.

De asymmetrie is opzettelijk: het versoepelen van beleid verzwakt nooit stilletjes een bestaand account.

### Een 2FA van één gebruiker resetten (verloren-telefoon-scenario)

Het beleidspaneel reset individuele gebruikers niet. Om de 2FA-token van één gebruiker te resetten (bv. zij hebben hun telefoon verloren en de recovery codes), ga naar **Gebruikers → rij → Reset 2FA**-knop. Dat geeft de inschrijf-QR opnieuw uit bij volgende login. Auditgelogd met de identiteit van de aanvrager.

---

## 17.7 Wat 2FA werkelijk vereist van gebruikers

Aan de eindgebruikerszijde, met 2FA ingeschakeld, is de loginflow:

1. **Loginscherm** — e-mail + wachtwoord (zoals vandaag).
2. **2FA-uitdaging** — *"Voer de 6-cijferige code in uit uw authenticator-app"*.
3. Gebruiker opent Google Authenticator / Microsoft Authenticator / Authy / 1Password, vindt de *Josbin POS*-entry, leest de 6-cijferige code, typt deze.
4. Login voltooid.

Recovery codes (10 enkelvoudig-gebruik 8-tekens codes) worden **eenmaal** getoond bij inschrijving. De gebruiker moet ze ergens veilig opslaan — wanneer zij de telefoon verliezen, zijn dit hoe ze weer binnenkomen zonder helpdesk-betrokkenheid.

Passkeys (FIDO2 / WebAuthn) worden ook ondersteund voor Super Admin en overheidsaccounts via Laravel Fortify. Het 2FA-per-rol-beleid onderscheidt op dit moment geen "TOTP" van "passkey" — beide tellen als de tweede factor. Zie het ontwikkelaarsdocument over Laravel Fortify voor de passkey-flow.

---

## 17.8 Auditen — wie wat heeft gewijzigd

Elke wijziging aan het 2FA-beleid wordt geschreven naar het onveranderlijke auditlogboek. Kijk daar om vragen te beantwoorden zoals:

- *"Wanneer hebben we 2FA ingeschakeld voor kassiers?"*
- *"Wie heeft auditor-beveiliging afgelopen kwartaal verminderd?"*
- *"Heeft iemand het beleid gewijzigd tijdens het incidentvenster?"*

In het dashboard: **Auditlogboek → filter op `auditable_type = "AppSetting"`** (Hoofdstuk 13 — binnenkort beschikbaar). Elke rij toont:

- De gebruiker die op Opslaan klikte
- IP-adres
- Oude `value` (bv. `["organisation_admin"]`)
- Nieuwe `value` (bv. `["organisation_admin", "store_manager"]`)
- Tijdstempel in AST

Omdat het auditlogboek alleen-toevoegen is met database-niveau schrijfbeveiliging, kan geen Super Admin (zelfs niet degene die de wijziging heeft gemaakt) de entry bewerken of verwijderen.

---

## 17.9 Veelvoorkomende beleidspatronen

| Klanttype | Aanbevolen beleid |
|---|---|
| **Single-shop eigenaar, één Organisatiebeheerder + één Kassier-account, geen audits** | Organisatiebeheerder AAN, Kassier UIT, Auditor UIT, Vestigingsmanager UIT (indien niet gebruikt). De eigenaar krijgt de wrijving; de kassa blijft snel. |
| **Mid-size supermarktketen, 5+ vestigingen, 50+ kassiers** | Organisatiebeheerder AAN, Vestigingsmanager AAN, Auditor AAN, Kassier UIT. Manager-niveau controles zijn wat telt; kassier-2FA is operationeel pijnlijk op schaal. |
| **Overheidsministerie** | Wat u ook instelt, het is *allemaal AAN* automatisch. Controleer gewoon of de `is_government`-vlag correct is ingesteld op de organisatie; het beleidspaneel hoeft niet te worden aangeraakt voor alleen-overheid-implementaties. |
| **Gemengde commerciële + overheids-tenant** | Gebruikers van overheidsorganisatie auto-2FA. Voor de commerciële organisaties, beslis per platformbeleid (aanbeveling Organisatiebeheerder + Vestigingsmanager AAN). |
| **Belastingdienst-auditor die parachuteert in voor een kwartaaloverzicht** | Auditor AAN. Het account bestaat voor een paar dagen; één TOTP-inschrijving is een kleine prijs voor alleen-lezen toegang tot BTW-data. |

---

## 17.10 Wat dit paneel NIET doet

Om tijd te besparen:

- **Per-organisatie 2FA-beleid** — niet ondersteund. Het platformbeleid is van toepassing op alle niet-overheidsorganisaties gelijk. Overheidsorganisaties worden geforceerd AAN; niet-overheidsorganisaties volgen het platformbeleid.
- **Per-gebruiker 2FA-override** — niet ondersteund. Als u *deze ene* kassier 2FA wilt laten gebruiken wanneer het beleid UIT is voor kassiers, kan de gebruiker het vrijwillig inschakelen vanuit Mijn account → Profiel. Er is geen admin "forceer aan voor deze gebruiker"-toggle.
- **Tijdgebaseerde 2FA-uitzonderingen** — niet ondersteund. Geen "sla 2FA over tijdens openingsuren" of "sla 2FA over op deze IP-range". 2FA is ofwel vereist voor de rol of niet.
- **Geografische 2FA** — niet ondersteund. (Geo-alert op login van buiten Suriname *is* een overheidsorganisatie-feature, maar het is een alert, geen step-up-auth-uitdaging.)
- **Adaptieve risicogebaseerde 2FA** — niet ondersteund. Geen "alleen prompt voor 2FA op onbekende apparaten". Ofwel vereist de rol het altijd, of nooit.
- **WebAuthn-only beleid** — niet ondersteund. Passkeys tellen als 2FA, maar het beleid kan niet zeggen "TOTP niet meer acceptabel, alleen passkeys". Op de roadmap.

Dit zijn opzettelijke vereenvoudigingen. Elke "slimme" 2FA-controle voegt een manier toe waarop een aanvaller een bypass kan social-engineeren.

---

## 17.11 Snelle referentie

```
PANEEL OPENEN       Dashboard → Gebruikers → 🔐 Tweestapsverificatie per rol
                    (alleen Super Admin — anders verborgen)

ALTIJD AAN          Super Admin (hard-coded)
                    Alle gebruikers van elke is_government = true-org

CONFIGUREERBAAR     Organisatiebeheerder, Vestigingsmanager, Kassier, Auditor
                    (elk met een onafhankelijke toggle)

BELEID WIJZIGEN     Rol(len) toggelen → Beleid opslaan
                    Auditgelogd. Bestaande sessies blijven werken tot
                    volgende login, dan wordt 2FA-inschrijving afgedwongen.

API ENDPOINTS       GET /api/settings/two-factor-policy   (lezen)
                    PUT /api/settings/two-factor-policy   (bijwerken)

RESET ÉÉN GEBRUIKER Gebruikers → rij → Reset 2FA → volgende login prompts re-enrollment
                    (gebruik wanneer een gebruiker zijn telefoon verliest)

WAAR OPGESLAGEN     app_settings.value = JSON-array van rolstrings
                    Sleutel: two_factor_required_roles
```

Voor per-gebruiker 2FA-setup, recovery codes, en hoe u uw eigen 2FA kunt uitschakelen wanneer het optioneel is voor uw rol, zie [Hoofdstuk 18 — Mijn account](18-my-account.md). Voor de bredere beveiligingsarchitectuur (bcrypt cost factor, geo-alerts, single-device enforcement, versleutelde PII), zie het projectvoorstel §13 "Security Architecture".

---

→ Volgende: [Hoofdstuk 18 — Mijn account](18-my-account.md)
