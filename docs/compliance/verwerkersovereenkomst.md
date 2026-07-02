# Verwerkersovereenkomst (VWO)
### Data Processing Agreement — Josbin POS

**Document ID:** JOSBIN-VWO-v1
**Opgesteld conform:** Wet Bescherming Persoonsgegevens Suriname (WBP-S)
**Status:** Sjabloon — velden gemarkeerd met `[IN TE VULLEN]` moeten per klant worden aangevuld
**Taal:** Nederlands (bindend) — English summary in Bijlage E

> **English summary.** This is the Data Processing Agreement (DPA) between the client
> (the *Controller* / Verwerkingsverantwoordelijke) and Josbin (the *Processor* /
> Verwerker) required under the Suriname Personal Data Protection Act (WBP-S). It
> describes the personal data processed by the Josbin POS platform, the purposes,
> the technical and organisational security measures actually implemented in the
> software, sub-processors, data-subject rights (including the built-in right-to-erasure
> endpoint), breach notification and the post-termination data-export guarantee. The
> Dutch text is the legally binding version.

---

## Artikel 1 — Partijen

Deze Verwerkersovereenkomst ("Overeenkomst") wordt aangegaan tussen:

### 1.1 Verwerkingsverantwoordelijke (de "Verantwoordelijke" / de Klant)

| Veld | Waarde |
|---|---|
| Organisatie / handelsnaam | `[IN TE VULLEN]` |
| Rechtsvorm | `[IN TE VULLEN]` |
| KKF-nummer | `[IN TE VULLEN]` |
| BTW-nummer | `[IN TE VULLEN]` |
| Adres | `[IN TE VULLEN]` |
| Vertegenwoordigd door | `[IN TE VULLEN]` (naam, functie) |
| Contactpersoon gegevensbescherming | `[IN TE VULLEN]` (naam, e-mail, telefoon) |

### 1.2 Verwerker (de "Verwerker" / de Leverancier)

| Veld | Waarde |
|---|---|
| Bedrijfsnaam | Josbin *(`config('josbin_pos.vendor.name')`)* |
| E-mail (support / gegevensbescherming) | support@josbin-pos.sr *(`config('josbin_pos.vendor.email')`)* |
| Telefoon | +597 471-0000 *(`config('josbin_pos.vendor.phone')`)* |
| Website | https://josbin-pos.sr *(`config('josbin_pos.vendor.website')`)* |
| Vertegenwoordigd door | `[IN TE VULLEN]` (naam, functie) |

> De vendorgegevens hierboven zijn de standaardwaarden uit de installatieconfiguratie
> (`backend/config/josbin_pos.php` → sleutel `vendor`). Bij een reseller/partner-installatie
> kunnen deze per deployment via `.env` worden overschreven; vul in dat geval de werkelijke
> gegevens in.

Hierna gezamenlijk aangeduid als "Partijen".

**Overwegende dat:**
- de Verantwoordelijke gebruikmaakt van het Josbin POS-platform (kassasysteem, beheerdashboard en integratie-API);
- de Verwerker in dat kader persoonsgegevens verwerkt namens en in opdracht van de Verantwoordelijke;
- Partijen hun verplichtingen onder de WBP-S schriftelijk wensen vast te leggen.

---

## Artikel 2 — Onderwerp, aard en doel van de verwerking

### 2.1 Aard en doel
De Verwerker verwerkt persoonsgegevens uitsluitend ten behoeve van de levering, werking en
ondersteuning van het Josbin POS-platform, te weten:

1. het verwerken van verkooptransacties (kassa) en het koppelen daarvan aan klanten;
2. het beheren van klantprofielen (naam, telefoon, e-mail, ID-nummer);
3. het genereren van bonnen, rapportages en BTW-aangiften voor de Belastingdienst Suriname;
4. het leveren van een onwijzigbaar auditspoor voor de Rekenkamer van Suriname;
5. gebruikers- en toegangsbeheer (kassiers, managers, beheerders);
6. technische ondersteuning, foutopsporing en beveiliging van de dienst.

De Verwerker verwerkt persoonsgegevens **niet** voor eigen doeleinden en niet voor doeleinden
die door de Verantwoordelijke niet zijn opgedragen.

### 2.2 Duur
Deze Overeenkomst geldt zolang de Verwerker persoonsgegevens verwerkt namens de Verantwoordelijke,
en eindigt conform Artikel 11.

---

## Artikel 3 — Categorieën betrokkenen en persoonsgegevens

### 3.1 Categorieën betrokkenen
- Klanten van de Verantwoordelijke (kopers/consumenten);
- Medewerkers/gebruikers van de Verantwoordelijke (kassiers, managers, beheerders, auditors).

### 3.2 Categorieën persoonsgegevens — Klanten

| Gegeven | Bron in het systeem | Bescherming in rust |
|---|---|---|
| Naam | `customers.name` | **Veldniveau-versleuteld** (AES-256) |
| Telefoonnummer | `customers.phone` | **Veldniveau-versleuteld** (AES-256) |
| E-mailadres | `customers.email` | **Veldniveau-versleuteld** (AES-256) |
| ID-nummer (overheids-ID) | `customers.id_number` | **Veldniveau-versleuteld** (AES-256) |
| Bestedingsaggregaten (totaal besteed, bezoekfrequentie) | `customers.total_spend_srd`, `visit_count` | Niet-identificerend (aggregaat) |

> **Technische toelichting (feitelijk geïmplementeerd).** De vier persoonsgegevens hierboven
> worden bij het opslaan versleuteld met `Crypt::encryptString()` (Laravel `APP_KEY`, cipher
> `AES-256-CBC`, zie `backend/config/app.php`) en pas bij het lezen ontsleuteld
> (`backend/app/Models/Customer.php`). Zoeken op naam/telefoon gebeurt via een
> **HMAC-SHA256 blind-index** (`name_hash`, `phone_hash`) zodat een klant kan worden
> teruggevonden **zonder** dat alle records worden ontsleuteld. De database zelf bevat
> daardoor geen leesbare persoonsgegevens.

### 3.3 Categorieën persoonsgegevens — Gebruikers
- Naam, e-mailadres, rol, taalvoorkeur, laatste-inlogtijdstip (`users`).
- Wachtwoorden worden opgeslagen als **bcrypt-hash (cost 12)**, nooit in leesbare vorm.
- 2FA-geheimen en passkey-credentials worden verborgen en **nooit** in het auditspoor
  geschreven (`$auditExclude` in `backend/app/Models/User.php`).

### 3.4 Geen bijzondere persoonsgegevens
Het platform is niet ontworpen voor de verwerking van bijzondere persoonsgegevens
(gezondheid, ras, religie, etc.). De Verantwoordelijke zal dergelijke gegevens niet in
vrije-tekstvelden invoeren.

---

## Artikel 4 — Instructies van de Verantwoordelijke

4.1 De Verwerker verwerkt persoonsgegevens uitsluitend op basis van schriftelijke instructies
van de Verantwoordelijke, waaronder de configuratie en het gebruik van het platform zoals
gedocumenteerd, en deze Overeenkomst.

4.2 Indien de Verwerker van oordeel is dat een instructie in strijd is met de WBP-S, stelt hij
de Verantwoordelijke daarvan onverwijld op de hoogte.

---

## Artikel 5 — Beveiligingsmaatregelen (technisch en organisatorisch)

De Verwerker treft en onderhoudt passende technische en organisatorische maatregelen. De
onderstaande maatregelen zijn **daadwerkelijk in de software geïmplementeerd**; verwijzingen
naar bronbestanden dienen als bewijs.

### 5.1 Toegangsbeveiliging en identiteit
- **Wachtwoord-hashing:** bcrypt cost 12 (`BCRYPT_ROUNDS=12`, `password => 'hashed'` cast).
- **Rolgebaseerde toegangscontrole (RBAC):** zeven rollen (Super Admin, Organisation Admin,
  Store Manager, Cashier, Auditor, API Integration, Tax Inspector) via `spatie/laravel-permission`;
  autorisatie afgedwongen op API-niveau met Policies (`backend/app/Policies/`), niet slechts
  verborgen in de UI. Standaard "deny" — bijv. WBP-S-wissing (`CustomerPolicy::delete`) is
  voorbehouden aan Organisation Admin / Super Admin.
- **Tweefactorauthenticatie (2FA/TOTP):** verplicht en niet uitschakelbaar voor
  overheidsaccounts; afgedwongen door middleware `EnsureTwoFactor`
  (`backend/app/Http/Middleware/EnsureTwoFactor.php`). Per-rol 2FA-beleid instelbaar door
  Super Admin (`SecurityPolicyController`).
- **Sessie-timeout:** afgedwongen door `SessionTimeout`-middleware.
- **Beperking mislukte inlogpogingen:** tweedimensionale throttle — 5 pogingen per 5 min per
  e-mail+IP én 20 per 5 min per IP (`backend/app/Providers/AppServiceProvider.php`,
  `routes/api.php` `throttle:login`); tevens op nginx-niveau (`docker/nginx/default.conf`,
  zone `login` 5 r/m).

### 5.2 Versleuteling
- **Persoonsgegevens in rust:** veldniveau-versleuteling met AES-256 op naam, telefoon,
  e-mail en ID-nummer van klanten (zie Artikel 3.2).
- **API-geheimen in rust:** webhook-secrets versleuteld opgeslagen
  (`ApiIntegration::$casts['webhook_secret' => 'encrypted']`).
- **Transport:** TLS wordt gebruikt voor verkeer tussen dashboard/POS en server. Voor de lokale
  dashboard-toegang is een self-signed HTTPS-variant op poort 8443 beschikbaar
  (`docker/frontends/dashboard-tls.conf`). *Zie Artikel 5.6 — restpunt inzake HSTS/TLS-hardening
  op de lokale HTTP-poort.*
- **Beveiligingsheaders:** actief Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy en Permissions-Policy (`docker/nginx/default.conf`).

### 5.3 Onwijzigbaar auditspoor
- Alle beheeracties en PII-gebeurtenissen worden vastgelegd in `audit_logs` als een
  **cryptografische hashketen** (SHA-256 per rij, gekoppeld aan de vorige rij per organisatie —
  `backend/app/Services/AuditHashService.php`).
- De tabel is **append-only**: `updating` en `deleting` op `AuditLog` retourneren `false`, zodat
  wijzigen/verwijderen op modelniveau onmogelijk is (`backend/app/Models/AuditLog.php`).
- De keten is verifieerbaar met `php artisan audit:verify`.
- **PII-toegang is traceerbaar:** elke individuele klantweergave/-wijziging/-wissing schrijft een
  gebeurtenis (`customer.accessed`, `customer.updated`, `customer.redacted`) met alleen de
  veldnamen — nooit de klare waarden (`CustomerController::auditPii`).

### 5.4 Back-ups en herstel
- Geautomatiseerde **AES-256-versleutelde** database-back-ups: `pg_dump` → gzip → AES-256-CBC,
  met retentie en periodieke hersteltest (`docker/scripts/backup.sh`).
- 3-2-1-back-upprincipe (lokaal + optioneel offsite).

### 5.5 Applicatie- en infrastructuurbeveiliging
- SQL-injectie structureel voorkomen door uitsluitend geparametriseerde Eloquent-queries.
- XSS beperkt door React auto-escaping in combinatie met een strikt CSP.
- CSRF-bescherming standaard afgedwongen door Laravel op alle state-wijzigende verzoeken.
- API-rate-limiting per gebruiker/IP en per API-sleutel.
- Broncodebescherming: PHP-code met IonCube-encoding vóór levering; Electron-binary
  gecompileerd met DevTools uitgeschakeld in productie.

### 5.6 Restpunten inzake beveiliging (transparant)
- **HSTS staat standaard uitgeschakeld** (uitgecommentarieerd) op de nginx-HTTP-poort en dient
  door de upstream-proxy in productie te worden afgedwongen (`docker/nginx/default.conf`).
- **PostgreSQL WAL / point-in-time recovery is niet geactiveerd** in de standaard
  installatieconfiguratie (`wal_level`/`archive_mode` staan op de default-uitgecommentarieerde
  waarden); herstel steunt op de nachtelijke versleutelde `pg_dump`-back-ups (Artikel 5.4).
  Activering van WAL-PITR is een aanbevolen hardening-stap per deployment.

---

## Artikel 6 — Vertrouwelijkheid

6.1 De Verwerker verplicht zich, en zijn personeel en ingeschakelde derden, tot geheimhouding
van alle persoonsgegevens waarvan zij kennisnemen.

6.2 Toegang tot persoonsgegevens is beperkt tot personeel dat deze toegang nodig heeft voor de
uitvoering van deze Overeenkomst (need-to-know).

---

## Artikel 7 — Subverwerkers

### 7.1 Toestemming
De Verantwoordelijke geeft algemene toestemming voor de inschakeling van de hieronder genoemde
subverwerkers. De Verwerker informeert de Verantwoordelijke bij voorgenomen wijzigingen en biedt
de gelegenheid daartegen bezwaar te maken.

### 7.2 Overzicht subverwerkers (feitelijk in gebruik)

| Subverwerker | Dienst | Verwerkte gegevens | Opmerking |
|---|---|---|---|
| ExchangeRate-API | Dagelijkse USD→SRD-koers | **Geen persoonsgegevens** (alleen wisselkoers) | `backend/config/services.php` → `exchangerate_api` |
| OpenAI (GPT-4o) | Fraudedetectie-tekst + wekelijkse AI-samenvatting | Verkoop-/transactiepatronen; **geen** direct identificerende klant-PII | `backend/config/services.php` → `openai`. Alleen actief indien `OPENAI_API_KEY` is ingesteld |
| `[IN TE VULLEN — e-mailprovider (SMTP)]` | Verzending bonnen / systeemmails | Naam, e-mailadres (indien e-mailbon gekozen) | Zie Artikel 7.4 |
| `[IN TE VULLEN — hostingpartij bij cloud-/SaaS-deployment]` | Hosting/infrastructuur | Alle in Artikel 3 genoemde gegevens (versleuteld in rust) | N.v.t. bij on-premise (lokale Docker-server) |

> **Let op — AI-verwerking.** De AI-functies (fraudedetectie, samenvatting) zijn **optioneel** en
> alleen actief wanneer een OpenAI-sleutel is geconfigureerd. Indien de Verantwoordelijke een
> overheidsklant is of geen data-doorgifte aan derden wenst, kan deze functie worden
> uitgeschakeld door de sleutel niet in te stellen. De aanvullende, in het projectvoorstel
> genoemde Claude/Anthropic-fallback en externe monitoring (Nightwatch/Sentry) zijn in de huidige
> codebase **niet** geconfigureerd en dus geen subverwerker.

### 7.3 Verplichtingen subverwerkers
De Verwerker legt aan iedere subverwerker gelijkwaardige gegevensbeschermingsverplichtingen op
als in deze Overeenkomst.

### 7.4 E-mailverzending
Bonnen en systeemmails worden per e-mail verzonden zodra een SMTP-provider is geconfigureerd.
**Standaard is de mailer ingesteld op `log`** (`backend/config/mail.php`, `MAIL_MAILER=log`) —
er worden dan geen mails feitelijk verzonden; de in-app-notificatie is dan de bron van waarheid.
Vul de gekozen SMTP-provider in bij Artikel 7.2.

---

## Artikel 8 — Rechten van betrokkenen

8.1 De Verwerker ondersteunt de Verantwoordelijke bij het vervullen van verzoeken van betrokkenen
(inzage, rectificatie, wissing).

8.2 **Recht op wissing (feitelijk geïmplementeerd).** Het platform bevat een
right-to-erasure-endpoint: `DELETE /api/customers/{customer}`
(`backend/app/Http/Controllers/Api/CustomerController::destroy`). Dit:
- vervangt de naam door een tombstone `"[verwijderd — WBP-S]"`;
- maakt telefoon, e-mail, ID-nummer en de zoek-hashes leeg (`NULL`);
- **behoudt de rij** en de aggregaatteller zodat historische verkopen (die naar `customer_id`
  verwijzen) en fiscale rapportages intact blijven — conform de bewaarplicht voor financiële
  administratie;
- schrijft een `customer.redacted`-gebeurtenis in het onwijzigbare auditspoor.

Deze actie is voorbehouden aan Organisation Admin en Super Admin (`CustomerPolicy::delete`).

8.3 **Recht op inzage/rectificatie.** Inzage en wijziging verlopen via
`GET`/`PUT /api/customers/{customer}`; elke inzage wordt geregistreerd (`customer.accessed`),
elke wijziging met de gewijzigde veldnamen (`customer.updated`).

---

## Artikel 9 — Datalekken (beveiligingsinbreuken)

9.1 De Verwerker stelt de Verantwoordelijke **zonder onredelijke vertraging en uiterlijk binnen
48 uur** na ontdekking van een datalek op de hoogte.

9.2 De melding bevat ten minste: de aard van de inbreuk, de betrokken categorieën en aantallen,
de waarschijnlijke gevolgen en de getroffen/voorgestelde maatregelen.

9.3 De Verantwoordelijke is verantwoordelijk voor eventuele melding aan de toezichthouder en de
betrokkenen conform de WBP-S. De Verwerker verleent daarbij redelijke medewerking.

9.4 Het onwijzigbare auditspoor (Artikel 5.3) dient als bewijsmiddel bij het onderzoek naar een
inbreuk. Zie tevens het Incident Response Plan (`incident-response-plan.md`).

---

## Artikel 10 — Doorgifte buiten Suriname

10.1 Bij een on-premise-installatie (lokale Docker-server) verlaten de persoonsgegevens de
locatie van de Verantwoordelijke in beginsel niet, behoudens de synchronisatie naar het
beheerdashboard en de subverwerkers in Artikel 7.

10.2 Voor doorgifte via subverwerkers buiten Suriname (bv. OpenAI, cloudhosting) zorgt de
Verwerker voor passende waarborgen. Overheidsklanten kunnen doorgifte-gevoelige functies
uitschakelen (Artikel 7.2).

---

## Artikel 11 — Einde overeenkomst, teruggave en vernietiging

11.1 Bij beëindiging draagt de Verwerker, naar keuze van de Verantwoordelijke, alle
persoonsgegevens over of vernietigt deze, tenzij wettelijke bewaarplichten anders vereisen.

11.2 **Data-exportgarantie bij licentievervaldatum (feitelijk geïmplementeerd).** De klantdata
worden nooit gegijzeld. Bij een licentie-*hard lock* blijven de data-export- en
rapportageroutes **90 dagen** toegankelijk; alle overige routes worden geblokkeerd met HTTP 402.
Bij een *soft lock* worden uitsluitend nieuwe verkopen geblokkeerd; rapporten, BTW-exports en
Rekenkamer-audit blijven volledig beschikbaar. Zie
`backend/app/Http/Middleware/EnsureLicenseValid.php`
(`HARD_LOCK_EXEMPT_PATTERNS`, `SOFT_LOCK_BLOCKED_PATTERNS`).

---

## Artikel 12 — Aansprakelijkheid en toepasselijk recht

12.1 Op deze Overeenkomst is het recht van de Republiek Suriname van toepassing.

12.2 Aansprakelijkheid wordt beheerst door de hoofdovereenkomst (licentie-/dienstenovereenkomst)
tussen Partijen.

---

## Artikel 13 — Ondertekening

Aldus overeengekomen en in tweevoud ondertekend.

### Verwerkingsverantwoordelijke (Klant)

| | |
|---|---|
| Naam | `[IN TE VULLEN]` |
| Functie | `[IN TE VULLEN]` |
| Organisatie | `[IN TE VULLEN]` |
| Plaats | `[IN TE VULLEN]` |
| Datum | `[IN TE VULLEN]` |
| Handtekening | ______________________________ |

### Verwerker (Josbin)

| | |
|---|---|
| Naam | `[IN TE VULLEN]` |
| Functie | `[IN TE VULLEN]` |
| Organisatie | Josbin |
| Plaats | `[IN TE VULLEN]` |
| Datum | `[IN TE VULLEN]` |
| Handtekening | ______________________________ |

---

## Bijlage A — Bewaartermijnen

| Gegevenscategorie | Bewaartermijn | Grondslag |
|---|---|---|
| Verkooptransacties, BTW-gegevens | `[IN TE VULLEN — conform fiscale bewaarplicht Belastingdienst Suriname]` | Fiscale bewaarplicht |
| Auditspoor (`audit_logs`) | Onwijzigbaar; niet verwijderbaar gedurende looptijd | Rekenkamer / bewijsvoering |
| Klant-PII na wissingsverzoek | Direct geredigeerd (Artikel 8.2); rij behouden zonder PII | WBP-S recht op wissing |
| Versleutelde back-ups | `[IN TE VULLEN — bv. 30 dagen lokaal]` (`BACKUP_KEEP_DAYS`, default 30) | Herstelbaarheid |

## Bijlage B — Contactpunten

| Rol | Contact |
|---|---|
| Functionaris gegevensbescherming Klant | `[IN TE VULLEN]` |
| Beveiligingscontact Verwerker | support@josbin-pos.sr / +597 471-0000 |

## Bijlage C — Overzicht subverwerkers
Zie Artikel 7.2.

## Bijlage D — Verwijzing implementatiebewijs
De in deze Overeenkomst genoemde maatregelen zijn onderbouwd in de OWASP Top 10-zelfevaluatie
(`owasp-top10-assessment.md`) met verwijzingen naar de daadwerkelijke broncode.

## Bijlage E — English summary
See the boxed summary at the top of this document. The Dutch text is the binding version. Key
implemented safeguards: field-level AES-256 encryption of customer PII; bcrypt-12 password hashing;
mandatory 2FA for government accounts; role-based access control enforced by API policies;
append-only, hash-chained audit log; encrypted nightly backups; a working right-to-erasure
endpoint; and a 90-day post-lock data-export guarantee. Documented residual items: HSTS is not
yet enforced on the local HTTP port and PostgreSQL WAL point-in-time recovery is not enabled in
the default configuration (recovery relies on encrypted nightly dumps).
