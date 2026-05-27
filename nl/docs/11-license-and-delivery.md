# 11 — Licentie & delivery-pipeline

Licensing beschermt de business van de vendor. Het ontwerp beschermt de *data* van de client zodat ze nooit gegijzeld worden: zelfs als een licentie verloopt, blijft elke BTW-aangifte, Rekenkamer-export en raw CSV toegankelijk. Dit hoofdstuk loopt de volledige pipeline door — van het uitgeven van een licentie op een aparte Laravel-server, via het IonCube-encoden van de backend en het code-signen van de Electron-installer, tot de dagelijkse validatie-pings die bepalen of banners, soft-lock of hard-lock van toepassing zijn.

---

## 11.1 De drie dingen die Josbin POS beschermen

| Layer | Wat het regelt | Zit in |
|---|---|---|
| **License system** | WIE de software mag draaien, HOE LANG, op HOEVEEL terminals | `/license-server` (aparte Laravel-app) + `backend/app/Services/LicenseService.php` |
| **IonCube code protection** | Mensen kunnen de PHP-source die geleverd wordt aan de client niet lezen | `scripts/encode-ioncube.sh` + `docker/php/Dockerfile:39` |
| **Electron code signing** | Windows kan verifiëren dat de `.exe` van de vendor komt | `frontend/package.json:73` + `frontend/build/entitlements.mac.plist` |

De drie zijn onafhankelijk. Een client kan de encoded source legaal kopen, maar die zou niet draaien zonder een geldige licentie. Een gelekte installer zou activatie tegen de license server weigeren. Een nagemaakte `.exe` zou SmartScreen activeren omdat de signature niet matcht.

---

## 11.2 De license server (aparte Laravel-app)

De license server zit op `/license-server` en draait als zijn eigen applicatie — aparte database, aparte deploy, aparte auth. De vendor bedient hem; geen enkele client heeft er ooit toegang toe.

### Waarom apart

| Waarom | Consequentie |
|---|---|
| Vendor regelt de bron van waarheid | Een client kan `License::computeStatus()` niet patchen om altijd `active` te retourneren |
| Kleinere blast radius | Een bug in de POS kan geen licentiedata lekken; een bug in de license server kan geen live kassa beïnvloeden |
| Onafhankelijke uptime | License server kan 72 u down zijn zonder één verkoop te stoppen (offline grace, §11.4) |
| Buiten Suriname | License-keys / billing-data niet onderhevig aan lokale server-beslag |

### Schema

Drie tabellen. Geverifieerd tegen de migrations.

`licenses` — één rij per klant-organisatie. `license-server/database/migrations/2026_05_23_000001_create_licenses_table.php:17`

| Kolom | Type | Opmerkingen |
|---|---|---|
| `id` | uuid | primary |
| `license_key_hash` | string, unique | SHA-256 van de raw key; de raw key wordt nooit opgeslagen |
| `license_key_prefix` | string | bv. `JOSBIN-AB12` — alleen voor weergave |
| `organisation_name` | string | |
| `contact_email` | string nullable | |
| `tier` | string | `basic` \| `standard` \| `enterprise` (gevalideerd in `Admin\LicenseController::TIERS`) |
| `max_stores` | uint | hard cap |
| `max_terminals` | uint | hard cap, afgedwongen bij activatie |
| `valid_from`, `valid_until` | date | renewal timeline leest uit `valid_until` |
| `is_active` | bool | |
| `revoked_at`, `revoked_reason` | timestamptz, string | non-null = revoked |
| `notes` | text | interne notities van de vendor |

`license_activations` — één rij per installatie gebonden aan een licentie. `…000002_create_license_activations_table.php:18`

| Kolom | Type | Opmerkingen |
|---|---|---|
| `id` | uuid | primary |
| `license_id` | uuid FK | cascade delete |
| `installation_key` | string, unique | per-installatie-token, verzonden op elke `/api/validate`-call |
| `hardware_mac`, `hardware_cpu`, `hardware_uuid` | string nullable | raw identifiers |
| `hardware_fingerprint` | string nullable, indexed | SHA-256 van lowercased `mac\|cpu\|uuid` |
| `hostname` | string nullable | |
| `last_ip` | string nullable | |
| `last_validated_at`, `activated_at` | timestamptz | |
| `is_active` | bool | het deactiveren van een activatie rapporteert `invalid` aan de POS |

`license_validations` — append-only auditlogboek van elke check-in. `…000003_create_license_validations_table.php:16`

| Kolom | Type | Opmerkingen |
|---|---|---|
| `id` | bigint auto | |
| `license_id`, `activation_id` | uuid nullable | FK op waarde, geen constraint (log overleeft deletes) |
| `installation_key_prefix` | string | **alleen eerste 12 chars** — volledige key wordt nooit gelogd |
| `status_returned` | string | wat de server aan de POS vertelde |
| `hardware_match` | bool nullable | resultaat van fingerprint-vergelijking |
| `ip`, `hostname` | string nullable | |
| `created_at` | timestamptz | |

### Endpoints

Alle routes geverifieerd in `license-server/routes/api.php`.

```
PUBLIC (called by POS installations)
  POST /api/activate     first-time bind
  POST /api/validate     daily check

ADMIN (vendor only, X-Admin-Key header)
  GET  /api/admin/licenses
  POST /api/admin/licenses
  GET  /api/admin/licenses/{id}
  POST /api/admin/licenses/{id}/renew
  POST /api/admin/licenses/{id}/revoke
```

De admin-guard is `AdminApiKey` (`license-server/app/Http/Middleware/AdminApiKey.php:15`) — een constant-time `hash_equals` tegen `LICENSE_ADMIN_KEY` uit `.env`. Geen user-accounts, geen sessie, geen UI.

### Tier-definities

Er is **geen** tier-seeder nog; de tier-naam is gewoon een string-kolom met drie toegestane waardes. Concrete store/terminal-caps leven per licentie individueel:

| Tier | Typisch gebruik | Caps per licentie opgeslagen |
|---|---|---|
| `basic` | enkele vestiging, enkele kassa | `max_stores` en `max_terminals` gezet op moment van uitgifte |
| `standard` | kleine keten | hetzelfde — gezet per licentie |
| `enterprise` | multi-regio-ketens, govt | hetzelfde — gezet per licentie |

De geseede demo-licentie (`DatabaseSeeder.php:14`) geeft `JOSBIN-DEMO-DEMO-DEMO-DEMO` uit op `standard`, 3 vestigingen, 10 terminals. Echte licenties worden uitgegeven via het admin-endpoint met caps gekozen op verkoopmoment.

### License-key-formaat

Gegenereerd in `Admin\LicenseController::generateLicenseKey()`. Formaat:

```
JOSBIN-XXXX-XXXX-XXXX-XXXX
```

- 4 groepen van 4 karakters
- Alfabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — 32 chars, geen ambigue `0/O/1/I`
- ≈ 20 bits per groep, ≈ 80 bits totaal — collision-safe, brute-force-onpraktisch
- Opgeslagen alleen als SHA-256-hash; de raw key wordt **precies één keer** aan de vendor geretourneerd in de `POST /api/admin/licenses`-response en nooit meer (`Admin\LicenseController.php:64`)

---

## 11.3 Hardware-fingerprint-binding

De fingerprint wordt op twee plekken berekend die moeten overeenkomen.

**Electron-kant** — `frontend/electron/main.ts:198`:

```ts
ipcMain.handle('license:fingerprint', async () => {
  // MAC — first non-internal interface
  // CPU — sha256(cpus()[0].model + hostname).substring(0,16)
  // UUID — crypto.randomUUID(), persisted to userData/install.uuid
})
```

De UUID wordt eenmaal geschreven bij de eerste launch en gelezen bij elke volgende launch — hij overleeft reboots en Electron-upgrades maar wordt vernietigd als userData wordt gewist.

**Server-kant** — `LicenseActivation::fingerprint()` op `license-server/app/Models/LicenseActivation.php:43`:

```php
return hash('sha256', strtolower(implode('|', array_filter([$mac, $cpu, $uuid]))));
```

Twee dingen om op te merken:
- `array_filter` slaat null-waardes over — slechts twee van drie identifiers verzenden produceert nog steeds een geldige fingerprint (nuttig voor VMs zonder stabiele MAC).
- De hash is deterministisch; dezelfde hardware produceert altijd dezelfde fingerprint.

### Waarom gebonden bij activatie

`ActivationController::activate()` dwingt het hardware-contract af:

1. Als dezelfde fingerprint al actief is op deze licentie → retourneer de bestaande `installation_key` (idempotent). `ActivationController.php:55`
2. Anders check `$license->terminalLimitReached()` tegen `max_terminals`. `ActivationController.php:67`
3. Als onder de cap, voeg een nieuwe activatie-rij in en retourneer een verse `installation_key`. `ActivationController.php:74`

Eén licentie × N terminals, waarbij N is vastgelegd op verkoopmoment. De 11e kassa op een 10-terminal-licentie krijgt:

```json
HTTP 403
{ "error": "LicenseLimitReached",
  "message": "License limit reached — this license permits 10 terminal(s). Contact Josbin POS to upgrade." }
```

### Wat gebeurt er wanneer hardware verandert

| Scenario | Effect | Oplossing |
|---|---|---|
| MAC verandert (nieuwe NIC) maar CPU + UUID matchen | Fingerprint verandert; `/api/validate` retourneert `hardware_match: false` | Vendor deactiveert de oude activatie-rij in DB; client doet activatie opnieuw |
| Moederbord vervangen (CPU-model verandert) | Hetzelfde als boven | Zelfde flow |
| Volledige herinstallatie — userData gewist | Nieuwe UUID wordt gegenereerd; nieuwe fingerprint; `/api/activate` verbruikt een nieuw terminal-slot | Als bij cap, vendor deactiveert het verloren slot eerst, daarna activeert client opnieuw |
| VM-clonen | Beide VMs produceren dezelfde fingerprint tot het UUID-bestand uit elkaar loopt | Gedetecteerd via duplicate validations vanaf verschillende IPs in `license_validations` |

Er is momenteel **geen self-service "re-bind"-endpoint** — bij ontwerp. Een vendor-support-touch is vereist, wat ook het moment is waarop billing/identity opnieuw geverifieerd wordt.

---

## 11.4 De validatie-levenscyclus

```
┌─ POS terminal startup ───────────────────────────────────────┐
│  Electron loads → renderer calls /api/auth/me                │
│  EnsureLicenseValid middleware fires                         │
│  LicenseService::getStatus() → Redis cache hit? → done       │
│                              → miss → POST /api/validate     │
│                                       to license server      │
└──────────────────────────────────────────────────────────────┘

┌─ 00:05 AST every day ────────────────────────────────────────┐
│  scheduler container runs: php artisan license:check --force │
│  LicenseService::forceCheck() bypasses cache, hits server    │
│  Status update broadcast on Reverb if changed                │
│  routes/console.php:27                                       │
└──────────────────────────────────────────────────────────────┘
```

### Wat de main backend doet

`EnsureLicenseValid`-middleware (`backend/app/Http/Middleware/EnsureLicenseValid.php:23`) is toegevoegd aan de `api`-groep in `backend/bootstrap/app.php:27`. Elke geauthenticeerde API-request gaat erdoorheen. Niet-geauthenticeerde requests (login, public endpoints) slaan de check over.

`LicenseService::getStatus()` (`backend/app/Services/LicenseService.php:39`) retourneert één van deze strings, gecached in Redis onder `license:status` voor 24 uur:

| Status | Betekenis | EnsureLicenseValid-actie |
|---|---|---|
| `active` | Alles in orde | doorlaten; header `X-License-Status: active` |
| `warning_30` | 30 dagen tot verval | doorlaten; banner getoond door `LicenseBanner.tsx` |
| `warning_14` | 14 dagen tot verval | doorlaten; banner |
| `grace` | Verlopen ≤ 14 dagen | doorlaten; rode banner |
| `soft_lock` | Verlopen 14–44 dagen | blokkeer `POST /api/sales` en `POST /api/sales/hold` (402); alle andere passeren |
| `hard_lock` | Verlopen > 44 dagen | blokkeer alles behalve `HARD_LOCK_EXEMPT_PATTERNS` (402) |
| `invalid` | Revoked / inactief | behandeld als `hard_lock` |
| `not_found` | Onbekende installation-key | behandeld als `hard_lock` |

Een geblokkeerde request retourneert HTTP 402 met een tweetalig bericht en een machine-readable code:

```json
{
  "message":        "Licentie verlopen. Nieuwe verkopen geblokkeerd. Neem contact op voor verlenging.",
  "message_en":     "License expired. New sales blocked. Contact Josbin POS to renew.",
  "code":           "LICENSE_SOFT_LOCK",
  "license_status": "soft_lock"
}
```

### Local cache + 72-uurs offline grace

Geverifieerd in `LicenseService::offlineFallback()` (`backend/app/Services/LicenseService.php:124`):

```
internet drops → POST /api/validate throws
            ↓
first failure → set license:offline_grace_ends = now+72h
              → return 'active'  (grace assumed)
            ↓
subsequent failures within 72h → still return 'active'
            ↓
after 72h     → fall back to local License row's
                computeRenewalStatus() — uses last-known valid_until
                stored in backend's own License table
```

De cache wordt vergeten bij elke succesvolle server-response. Een flaky connection die op enig moment terugkomt reset het 72-uurs-venster.

### Dev-veiligheidsluik

`LicenseService::getStatus()` short-circuit naar `'active'` wanneer `app()->isLocal()` true is of `installation_key` leeg is (`backend/app/Services/LicenseService.php:42`). Dit betekent dat ontwikkelaar-machines nooit de middleware triggeren. Productie zet `APP_ENV=production` en `JOSBIN_POS_INSTALLATION_KEY=<inst_...>` zodat de echte check loopt.

### Reverb broadcast

`license:check --force` wordt gescheduled om 00:05 AST 's nachts (`backend/routes/console.php:27`). Wanneer de status verandert, broadcast `LicenseWarning` (`backend/app/Events/LicenseWarning.php`) op de org- en store-private-channels met tweetalige NL/EN-berichten ingebakken in `broadcastWith()`. Het dashboard en de manager-terminals tonen een banner binnen seconden zonder polling.

---

## 11.5 Renewal-afdwingings-tijdlijn

De enige tijdlijn waar de client om geeft. Elke drempel hieronder is geverifieerd in `license-server/app/Models/License.php:65` (`computeStatus`), `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS`, en `LicenseBanner.tsx`.

| Fase | Trigger | Kassier ziet | Manager ziet | Data |
|---|---|---|---|---|
| **−60 d** | CRM-reminder van vendor (buiten-band — niet in code) | niets | niets | volledige toegang |
| **−30 d** (`warning_30`) | ≤ 30 dagen tot verval | niets | gele banner: "Licentie verloopt over 30 dagen…" + e-mail | volledige toegang |
| **−14 d** (`warning_14`) | ≤ 14 dagen tot verval | niets | amber banner + dagelijkse reminder-e-mails | volledige toegang |
| **Verval-dag** | `valid_until` voorbij | niets | banner intensiveert | volledige toegang |
| **Verval → +14 d** (`grace`) | post-verval ≤ 14 dagen | niets — verkopen werken normaal | rode banner: "noodperiode actief. Verkopen gaan door" | volledige toegang |
| **+14 → +44 d** (`soft_lock`) | post-verval 14–44 dagen | nieuwe sale-poging → on-screen fout "Nieuwe verkopen geblokkeerd" | rode vette banner: "Nieuwe verkopen geblokkeerd. Verleng nu om te heractiveren" | **alle rapporten, exports, BTW-aangiftes, auditlogs blijven toegankelijk** |
| **+44 d verder** (`hard_lock`) | post-verval > 44 dagen | login faalt met 402 `LICENSE_HARD_LOCK` | login faalt ook — maar de export-routes hieronder lossen nog op | 90-dagen-venster voor data-export (zie §11.6) |
| **+44 + 90 d** | Vendor-policy (handmatig) | — | — | License server admin-endpoint staat hard delete toe |

Twee consequenties die het melden waard zijn:

1. **De grace-periode is de werkelijke gijzelaar-bescherming.** Een kassa die zijn licentie verliest bevriest nooit middenin een klant; het worst case is "volgende verkoop geblokkeerd" op het scherm *na* het afronden van de huidige winkelwagen. De kassier komt nooit vast te zitten met een klant aan de balie.
2. **Data-toegang overleeft sales-toegang met 30+90 dagen.** Zelfs in hard lock heeft de client drie maanden om alles te extraheren voordat enige data wordt aangeraakt. Ter vergelijking: de meeste cloud-POSes blokkeren export op de dag dat een abonnement verloopt.

---

## 11.6 De "client nooit gegijzeld"-belofte

De exempt-route-lijst zit in `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS` (`backend/app/Http/Middleware/EnsureLicenseValid.php:26`):

```php
private const HARD_LOCK_EXEMPT_PATTERNS = [
    'api/reports',          // all reports — daily, monthly, BTW, Rekenkamer
    'api/sales/*/receipt',  // re-print any past receipt
    'api/auth/logout',      // can always sign out cleanly
    'api/auth/me',          // session info — so the UI can render
    'api/rates',            // daily USD→SRD history — useful for audits
];
```

| Wat beschikbaar blijft in hard lock | Waar | Gebruikt voor |
|---|---|---|
| `GET /api/reports/daily`, `/monthly`, `/custom-range` | `ReportController` | dag-op-dag sales-reconciliatie |
| `GET /api/reports/btw` | `ReportController` | Belastingdienst Suriname-aangiftes |
| `GET /api/reports/rekenkamer` | `ReportController` | signed PDF voor government audit |
| `GET /api/reports/export` (CSV) | `ReportController` | raw export van elke transactie |
| `GET /api/sales/{id}/receipt` | `SaleController` | her-print elke eerdere bon als PDF |
| `GET /api/rates` | `RateController` | gelockte dagelijkse USD→SRD-geschiedenis |

Wat **niet** exempt is in hard lock: alles dat data aanmaakt, wijzigt of verwijdert. Het systeem gaat read-only op de dag dat de hard lock toeslaat. Dit is ook de dag dat de 90-dagen-data-export-klok start.

### Data-ownership-clausule (contracttaal om op te nemen)

> Alle sales-, customer-, product-, BTW- en audit-data aangemaakt door de client gedurende de licentietermijn blijft eigendom van de client. In geval van licentie-verval, niet-verlenging of beëindiging van de commerciële relatie behoudt de client lees- en export-toegang tot alle historische data voor minimaal negentig (90) dagen vanaf de datum van hard-lock. De vendor zal, op verzoek, een volledige SQL-dump en CSV-export leveren binnen veertien (14) werkdagen zonder extra kosten.

Deze clausule bestaat omdat de encoded source en license-afdwinging in principe gelezen zouden kunnen worden als "wij regelen jullie data". De exempt-route-lijst hierboven is het technische bewijs dat we dat niet doen.

---

## 11.7 IonCube-encoding

### Wat het doet

IonCube transformeert leesbare PHP-source in een binaire stream die de IonCube Loader uitvoert op volle snelheid binnen PHP-FPM. Er is geen decoder — de encoded files zijn niet encrypted-to-plaintext; ze zijn compiled-to-opcodes met een extra integrity-laag. Reverse-engineering is onpraktisch (een betaalde commerciële decoder-service bestaat, maar produceert alleen gedeeltelijke pseudo-source; geen menselijk leesbaar origineel is te herstellen).

### Loader (gratis) vs encoder (betaald)

| Component | Kosten | Waar draait hij |
|---|---|---|
| **IonCube Loader** | Gratis, vendor-redistributable | Elke container van de client — ingebakken op `docker/php/Dockerfile:39` |
| **IonCube Encoder voor PHP 8.3** | Betaalde commerciële licentie (eenmalige aankoop van vendor) | Alleen vendor's build-machine, **nooit op een client-server** |

De vendor betaalt eenmalig voor de encoder. Elke client krijgt de Loader gratis, ingebakken in de image — ze installeren niets extra.

### Loader-install (geverifieerd)

`docker/php/Dockerfile:39` is arch-aware zodat zowel x86-64 productie-servers als arm64-dev-machines dezelfde image bouwen:

```dockerfile
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64)  url='…ioncube_loaders_lin_x86-64.tar.gz' ;; \
      aarch64) url='…ioncube_loaders_lin_aarch64.tar.gz' ;; \
      …
    cp "/tmp/ioncube/ioncube_loader_lin_8.3.so" "$ext_dir/ioncube_loader_lin_8.3.so"; \
    printf 'zend_extension=ioncube_loader_lin_8.3.so\n' > /usr/local/etc/php/conf.d/00-ioncube.ini; \
    php -v | grep -qi ioncube   # build fails if loader did not register
```

De finale `grep` is een hard build-time check — een kapotte loader voorkomt dat de image getagd wordt.

### Encoding-workflow (delivery-tijd)

`scripts/encode-ioncube.sh`. Draait op vendor's machine, **niet** op de client-server.

```
SRC = ./backend
OUT = ./dist/backend-encoded

ENCODER_FLAGS = (
  -o $OUT
  --php-target-version 8.3
  --ignore vendor       # third-party — restored by composer install
  --ignore node_modules
  --ignore storage      # writable runtime state
  --ignore tests        # not shipped
  --ignore .git
  --ignore .env         # never copied; client supplies their own
  --no-doc-comments
)

ioncube_encoder8.3 $SRC ${ENCODER_FLAGS[@]}
```

Het script doet een pre-flight check dat de encoder bestaat op PATH (of op `$IONCUBE_ENCODER`) en bailt uit met een duidelijke melding indien niet (`scripts/encode-ioncube.sh:35`).

### Wat wordt encoded vs niet

| Pad | Encoded? | Waarom |
|---|---|---|
| `backend/app/**.php` | ja | het gros van onze source — controllers, services, models, jobs |
| `backend/database/**.php`, `backend/routes/**.php`, `backend/config/**.php`, `backend/bootstrap/**.php`, `backend/public/**.php` | ja | ook onze source |
| `backend/vendor/**` | **nee** | third-party, al gelicentieerd; client runt `composer install --no-dev --optimize-autoloader` opnieuw |
| `backend/tests/**` | nee | niet geleverd |
| `backend/storage/**` | nee | runtime state, moet writable zijn |
| `backend/.env` | nee | client levert eigen |
| `frontend/dist/**` (Electron renderer) | n.v.t. | Vite-output is al geminificeerd, mangled JS bundles |
| `frontend/dist-electron/main.js` | n.v.t. | idem |
| `dashboard/dist/**` | n.v.t. | idem |

Dus de beschermde laag is PHP. De React-frontends zijn alleen beschermd door minificatie + de Electron-code-signature; dat is industry-normaal voor browser-targeted JS.

### Verificatie

De CI-suite (`.github/workflows/backend.yml`) draait op de *un-encoded* source. De aanbevolen pre-delivery-check is om dezelfde testsuite te draaien op de *encoded* output: zet de production-image Docker-stack op gericht op `dist/backend-encoded`, run `php artisan test` binnen de container. Pass = het encoded artefact is functioneel identiek.

Dit is gedocumenteerd in `scripts/README.md:97` (het zit niet in CI bij policy — IonCube-credentials zouden nooit op een runner moeten zitten).

---

## 11.8 Electron code signing

### Waarom

Windows SmartScreen en Defender waarschuwen luid bij unsigned `.exe`-bestanden ("Windows protected your PC…"). Kassiers die die waarschuwing zien zullen niet installeren — en terecht. Een gesigneerde installer:

1. Toont de geverifieerde naam van de vendor in de UAC-prompt.
2. Omzeilt de SmartScreen-reputation-gate (met een EV-cert) of bouwt reputatie op de tijd (OV).
3. Laat Windows tampering detecteren — wijzig één byte en de signature breekt.

macOS is strenger — zonder notarization weigert de app simpelweg te openen op Catalina+.

### Certificaten

| Platform | Cert-type | Bron | Per-build secret |
|---|---|---|---|
| Windows | OV- of EV-code-signing `.pfx` | DigiCert / Sectigo (≈ $300–$600/jr OV, $600–$1000/jr EV) | `CSC_LINK`, `CSC_KEY_PASSWORD` |
| macOS | "Developer ID Application" `.p12` | Apple Developer Program ($99/jr) | `CSC_LINK`, `CSC_KEY_PASSWORD` |
| macOS notarization | Apple ID + app-specific password | Apple Developer Program | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |

`scripts/README.md:46` documenteert de volledige env-var-checklist. Secrets komen nooit in de repo; electron-builder pikt ze alleen op build-time op.

### Build-config (geverifieerd)

`frontend/package.json:73` — het `build`-blok dat electron-builder leest:

```jsonc
"win": {
  "target": "nsis",
  "icon": "resources/icon.ico",
  "signingHashAlgorithms": ["sha256"],
  "requestedExecutionLevel": "requireAdministrator"
},
"nsis": {
  "oneClick": false,
  "allowToChangeInstallationDirectory": true,
  "installerLanguages": ["Dutch", "English"]
},
"mac": {
  "target": ["dmg", "zip"],
  "icon": "resources/icon.icns",
  "category": "public.app-category.business",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": true
}
```

Build-scripts (`frontend/package.json:13`):

```
npm run build:win   →   electron-vite build && electron-builder --win --x64
npm run build:mac   →   electron-vite build && electron-builder --mac
```

Als de signing-env-vars niet zijn ingesteld, produceert electron-builder een **unsigned** build en slaat notarization over — nuttig voor lokale QA maar nooit voor client-delivery.

### macOS-entitlements (geverifieerd)

`frontend/build/entitlements.mac.plist` declareert wat de hardened runtime moet toestaan:

| Entitlement | Waarom |
|---|---|
| `com.apple.security.cs.allow-jit` | V8 (Electron) JIT-compileert JS |
| `com.apple.security.cs.allow-unsigned-executable-memory` | V8 writable+executable pages |
| `com.apple.security.cs.allow-dyld-environment-variables` | electron-builder packaging |
| `com.apple.security.cs.disable-library-validation` | Native modules kunnen laden |
| `com.apple.security.device.camera` | Quagga2 barcodescanner |
| `com.apple.security.network.client` | API-calls naar back-office + cloud |

Notarization gebeurt automatisch binnen `electron-builder --mac` wanneer de Apple-env-vars aanwezig zijn — `frontend/package.json:104` zet `"notarize": true`.

### Iconen (eenmalige setup)

Momenteel ontbrekend in de repo:

- `frontend/resources/icon.ico` (Windows, 256×256)
- `frontend/resources/icon.icns` (macOS)

Deze moeten toegevoegd worden voor de eerste release-build. Gedocumenteerd in `scripts/README.md:52`.

---

## 11.9 End-to-end-delivery-flow

Wat het team van de vendor doet voor een nieuwe client, van uitgegeven licentie tot draaiende kassa.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. ISSUE LICENSE                                                         │
│    curl -X POST $LICENSE_SERVER/api/admin/licenses \                     │
│      -H "X-Admin-Key: $LICENSE_ADMIN_KEY" \                              │
│      -d '{"organisation_name":"Supermarkt De Hoop",                      │
│           "tier":"standard","max_stores":3,"max_terminals":10,           │
│           "valid_from":"2026-05-25","valid_until":"2027-05-25"}'         │
│    ──→ save the returned license_key (shown ONCE)                        │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 2. PREPARE CLIENT BACKEND .env                                           │
│    JOSBIN_POS_LICENSE_SERVER_URL=https://license.josbin-pos.sr           │
│    JOSBIN_POS_INSTALLATION_KEY=        (left blank until step 6)         │
│    + DB creds, exchange rate key, app key, etc.                          │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 3. IONCUBE-ENCODE THE BACKEND                                            │
│    IONCUBE_ENCODER=/opt/ioncube/ioncube_encoder8.3 \                     │
│      scripts/encode-ioncube.sh dist/backend-encoded                      │
│    ──→ ./dist/backend-encoded is shipped (vendor/ restored client-side)  │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 4. CODE-SIGN THE ELECTRON APP                                            │
│    export CSC_LINK=/secure/josbin-codesign.pfx                           │
│    export CSC_KEY_PASSWORD=...                                           │
│    cd frontend && npm run build:win                                      │
│    ──→ ./frontend/release/Josbin POS Setup x.y.z.exe                     │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 5. HAND OVER                                                             │
│    a. Backend bundle to the client's back-office PC (Docker compose up)  │
│    b. .exe installer to each terminal                                    │
│    c. License key in a sealed envelope to the store manager              │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 6. FIRST LAUNCH (per terminal)                                           │
│    Electron starts → 'license:fingerprint' handler runs                  │
│      mac  = first non-internal NIC                                       │
│      cpu  = sha256(cpu model + hostname)[0..16]                          │
│      uuid = userData/install.uuid (created on first run)                 │
│    Setup screen asks for the license key                                 │
│    Backend POST /api/activate to license server                          │
│    ──→ installation_key returned, written to backend .env                │
│    ──→ status "active" cached for 24h                                    │
│    POS is live                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 7. ONGOING                                                               │
│    Every day at 00:05 AST: scheduler runs license:check --force          │
│    On status change: LicenseWarning broadcast → managers see banner      │
│    On revocation / expiry: timeline of §11.5 takes over                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 11.10 De license server bedienen

### Waar draait hij

Een standalone Laravel 13-app (`license-server/`) met zijn eigen Postgres-instance. Aanbevolen deploy:

- Kleine VPS (1 vCPU / 2 GB is genoeg — handelt duizenden validatie-calls/dag af)
- TLS via Let's Encrypt (`license.josbin-pos.sr`)
- nginx → php-fpm (gebruik niet `php artisan serve` in productie)
- Buiten Suriname (zodat een lokale server-beslag geen license-control kan leveragen)

### Backups

Standaard Postgres-backup is voldoende. De data is klein (KB/licentie) en het enige "verlies"-scenario dat pijn doet is het verliezen van de `license_key_hash`-rijen — clients met geldige keys zouden opnieuw activeren maar nieuwe konden niet worden uitgegeven. Dagelijkse encrypted dumps naar off-region S3 dekken het af.

### Dagelijkse operatie

| Taak | Commando |
|---|---|
| Issue een licentie | `POST /api/admin/licenses` (curl-voorbeeld in `license-server/README.md:165`) |
| List alle licenties | `GET /api/admin/licenses` |
| Inspecteer één | `GET /api/admin/licenses/{id}` — retourneert actieve activaties + laatst-geziene IPs/hostnames |
| Verleng (extend `valid_until`) | `POST /api/admin/licenses/{id}/renew` — heractiveert direct, geen herinstall |
| Revoke (non-betaling, breach) | `POST /api/admin/licenses/{id}/revoke` — installaties rapporteren `invalid` bij volgende 24-u-check |

### Monitoring

De `license_validations`-tabel is een append-only log van elke check-in. Nuttige queries:

```sql
-- Installations not seen in 7 days (possibly offline or uninstalled)
SELECT l.organisation_name, a.hostname, MAX(v.created_at)
FROM license_validations v
JOIN license_activations a ON a.id = v.activation_id
JOIN licenses l            ON l.id = v.license_id
GROUP BY l.organisation_name, a.hostname
HAVING MAX(v.created_at) < now() - interval '7 days';

-- Hardware fingerprint mismatches (possible cloned VM or hardware change)
SELECT * FROM license_validations
WHERE hardware_match = false
ORDER BY created_at DESC LIMIT 100;
```

Een simpele cron + e-mail-script bovenop deze geeft de vendor een vroeg-waarschuwings-kanaal zonder een volle observability-stack op te zetten.

### Tests

`license-server/tests/Feature/LicenseFlowTest.php` dekt: activate-dan-validate happy path, idempotent re-activatie op dezelfde hardware, terminal-limit-afdwinging, onbekende installation-key, revoked licentie, soft-lock-status op +21 dagen, admin-key-guard. Run met `php artisan test` binnen de license-server-app.

---

## 11.11 Wat de client te vertellen tijdens sales

Een korte FAQ voor het gesprek dat altijd opkomt.

**"Wat gebeurt er als het internet eruit valt?"**

De POS blijft draaien. De license-check heeft een 72-uurs offline-grace-venster (`backend/app/Services/LicenseService.php:25`). Als de license server zelf onbereikbaar is, blijft elke kassa drie volle dagen operationeel voordat het systeem het lokaal gecachte licentie-record gaat controleren — wat zelf jaren geldig kan zijn. Een normale één-dag-Telesur-outage in Nickerie is onzichtbaar voor de kassier.

**"Wat als Josbin POS uit business gaat?"**

Het contract moet een source-code-escrow-clausule bevatten (third-party escrow-agent houdt de un-encoded source; vrijgegeven bij vendor-faillissement of breach). Zelfs zonder escrow werken de data-export-endpoints in §11.6 onbeperkt tegen de eigen database van de client — geen deel van de data van de client leeft alleen op vendor-infrastructuur. De license server die zwart wordt triggert de 72-uurs-grace, dan de local-DB-fallback in `offlineFallback()`.

**"Kan ik een vierde kassa boven mijn gelicentieerde aantal toevoegen?"**

Nee. `ActivationController.php:67` checkt `terminalLimitReached()` voor het aanmaken van een activatie. Het activatie-request van de vierde kassa retourneert HTTP 403 `LicenseLimitReached`. Om de cap te verhogen, geeft de vendor een nieuwe licentie uit (of breidt de bestaande uit) met een hogere `max_terminals` en de client activeert opnieuw — de fingerprints van de bestaande terminals blijven behouden.

**"Wat als de hardware van een terminal faalt — verlies ik dat licentie-slot?"**

Nee. Neem contact op met de vendor; de activatie-rij van de dode terminal wordt gedeactiveerd (`is_active = false`); de vervangende machine activeert in het vrijgekomen slot. De flow is bewust handmatig — het is het moment waarop de vendor verifieert dat het verzoek legitiem is, geen sluwe manier om extra kassa's op te spinnen.

**"Kunnen jullie onze sales-data lezen vanaf jullie kant?"**

Nee. De license server kent alleen de SHA-256-hash van de license-key, de per-installatie `installation_key`, hardware-fingerprints en IP/hostname-strings. Hij ziet nooit sale-rijen, customer-data of iets uit de Postgres van de client. De validatie-payload zijn de vier velden getoond in `LicenseService::validateWithServer()` (`backend/app/Services/LicenseService.php:90`).

**"Als we stoppen met betalen, verliezen we dan onze data?"**

Nee. Soft lock (§11.5) blokkeert nieuwe verkopen, maar elk rapport, BTW-aangifte, Rekenkamer-export en CSV-download werkt nog. Hard lock blokkeert nieuwe logins, maar de routes in `EnsureLicenseValid::HARD_LOCK_EXEMPT_PATTERNS` blijven 90 dagen werken — genoeg tijd om een volledige SQL-dump en CSV van elke transactie te extraheren. Daarna verplicht de contract-clausule in §11.6 de vendor om te assisteren met export.

**"Kan ik de back-office-server naar een nieuwe machine verplaatsen?"**

Ja — de backend is een Docker-stack. Zet dezelfde stack omhoog op de nieuwe machine, restore de Postgres-backup, kopieer de `.env` (die `JOSBIN_POS_INSTALLATION_KEY` bevat). De license server ziet dezelfde installation-key en blijft valideren. Terminals zijn niet beïnvloed — ze praten met de hostname van de back-office-server, niet met de license server.

---

→ Volgende: [12 — Code map](12-code-map.md)
