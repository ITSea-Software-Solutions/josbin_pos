# 10 — Jobs, schedules & notificaties

Alles wat buiten een web-request draait: de queued jobs, het cron-schema, en de queued database-notificaties achter de in-app-bel. Queue-driver is Redis; de workers zijn Laravel Horizon.

Eerst de topologie, want die verklaart de deploy-gotcha onderaan: **Horizon draait in zijn eigen `horizon`-container** (`docker-compose.yml:129`, `command: php artisan horizon`), de cron-loop in zijn eigen `scheduler`-container (`schedule:run` elke 60 s, met een boot-time `rates:ensure-today` zodat een vers opgestarte stack een koers heeft vóór de eerste verkoop). Geen van beide deelt een PHP-proces met `app`.

---

## Queued jobs

| Job | Queue | Trigger | Retry |
|---|---|---|---|
| `RecordStockMovements` | `default` | Dispatched bij **void / refund / blind-return** (`Api\SaleController:480,688,818`) om voorraad te herstellen + ledger-rijen te schrijven | `tries 3`, backoff `30s/2m/10m` |
| `DetectSaleAnomaly` | `ai` | Na elke voltooide verkoop, `->delay(5s)` (`Api\SaleController:406`) | `tries 3`, `timeout 60` |
| `DispatchWebhook` | `default` | `dispatchIfActive` bij `/v1/sales`-ingest (`sale.created`) — zie [h. 8](08-integration-api.md) | `tries 4`, backoff `1m/5m/30m/2u` |

Aantekeningen:

- **Verkoop-voorraad is *niet* queued.** `StockMovementService::recordSale` draait synchroon binnen de DB-transactie van de verkoop — een queue-storing kan verkoop en voorraad niet meer desynchroniseren. De queued job dekt alleen de void/refund-herstelpaden.
- `DetectSaleAnomaly` draait heuristische regels (korting > 30%, buiten openingstijden, buitensporige mand, >3 voids/uur door één kassier, >2σ van het 30-dagen-vestigingsgemiddelde) plus een optionele GPT-4o-narrative, en schrijft geflagde verkopen naar de audit log als `anomaly_detected`.
- `DetectSaleAnomaly` draait op de eigen `ai`-queue; de Horizon-supervisor consumeert `['default', 'ai']`. (Een eerdere build vermeldde alleen `default`, waardoor anomaly-jobs onverwerkt bleven — opgelost 2026-07-06; stoppen anomaly-meldingen ooit, controleer dan eerst de queue-lijst van de supervisor en bounce daarna de `horizon`-container — zie de deploy-notitie hieronder.)

---

## Queued notificaties — `database` + `mail`

`backend/app/Notifications/`. De vier BTW-aangifte-notificaties drijven de review-loop uit [h. 5](05-btw-pipeline.md):

| Notificatie | Ontvangers | Afgevuurd door |
|---|---|---|
| `BtwFilingSubmitted` | Alle actieve `tax_inspector`-gebruikers | Nieuwe **maandelijkse** aangifte (daily/weekly pingen niet — die zouden de bel spammen van een inspecteur wiens formele cyclus maandelijks is) |
| `BtwFilingResubmitted` | Alle actieve `tax_inspector`-gebruikers | Elke `supersede` (een gecorrigeerde aangifte beantwoordt een dispuut — altijd pingen) |
| `BtwFilingDisputed` | Belastingplichtige-kant: de actieve OA's van de org + de oorspronkelijke indiener | Inspecteur betwist (draagt de reden) |
| `BtwFilingAccepted` | Dezelfde belastingplichtige-set | Inspecteur accepteert (enkel of bulk — bulk stuurt er één per geaccepteerde rij, na de transactie-commit) |

Alle vier zijn `ShouldQueue` met `via() = ['database', 'mail']`. Die combinatie is een bewust isolatie-ontwerp, geen gemak:

- **Queued** → de web-request van de inspecteur (of OA) wacht nooit op SMTP, en een mail-/queue-hapering kan de accept/dispute/file-actie zelf nooit laten falen. De controller-helpers (`notifyTaxpayer` / `notifyInspectors`) wikkelen het versturen bovendien in try/catch — notificatie-levering is per contract best-effort.
- **Twee kanalen, per job geïsoleerd** → Laravel queuet één job per ontvanger×kanaal, dus een falende `mail`-job kan de `database`-rij (bel) voor niemand onderdrukken.
- Praktisch gevolg: **de in-app-bel is de bron van waarheid.** De droplet heeft momenteel geen echte `MAIL_*`-credentials, dus het `mail`-kanaal levert pas als SMTP geconfigureerd is — het `database`-kanaal werkt hoe dan ook. Check de SMTP-config vóórdat je "de e-mail is niet aangekomen" gaat debuggen.

De `toDatabase`-payload draagt tweetalige `title`/`message` (`nl`/`en`), de aangifte-`reference`, periode, bedrag en een `link` — de bel rendert in de locale van de gebruiker zonder server-rondgang.

`WelcomeCredentials` (welkom nieuwe gebruiker) is ook `ShouldQueue` maar **alleen mail** (`via() = ['mail']`) — login-URL + e-mailadres, bewust nooit het wachtwoord, en geen bel-item.

Rijen staan in de standaard Laravel-`notifications`-tabel (`2026_06_15_000001`, uuid-PK + notifiable morphs).

---

## De in-app-bel

`NotificationController` (`backend/app/Http/Controllers/Api/NotificationController.php`) — drie endpoints, elke geauthenticeerde rol, elke query gebouwd op `$request->user()->notifications()` zodat een gebruiker nooit andermans rijen kan lezen of muteren:

| Method | Path | Retourneert |
|---|---|---|
| `GET` | `/api/notifications` | Laatste 30 + `unread_count` |
| `POST` | `/api/notifications/{id}/read` | Markeert er één gelezen (404 als niet de jouwe), verse `unread_count` |
| `POST` | `/api/notifications/read-all` | Markeert alles gelezen, `unread_count: 0` |

Frontend: `dashboard/src/components/shared/NotificationBell.tsx` — badge + dropdown + markeer-(alles-)gelezen + doorklik naar de `link`, **pollend elke 60 s** (`refetchInterval: 60000`). Polling, geen Reverb: een minuut notificatie-latency is prima, en de bel moet werken op installaties waar de WebSocket-poort dicht is. (Echte realtime-events zijn [h. 9](09-realtime-broadcasts.md).)

---

## Scheduled commands

`backend/routes/console.php` — allemaal gepind op `America/Paramaribo` (AST), langlopende met `runInBackground()->withoutOverlapping()`:

| Tijd (AST) | Command | Doet |
|---|---|---|
| 06:00 dagelijks | `rates:lock` | Haal + lock de USD→SRD van vandaag via ExchangeRate-API (de enige bron — Frankfurter/ECB heeft geen SRD). Failure gelogd. |
| elke 30 min | `rates:ensure-today` | Idempotent vangnet — maak de koers van vandaag alsnog aan als 06:00 gemist is (container-restart, API-storing), zodat een verkoop nooit 422't met `NO_DAILY_RATE`. |
| 00:05 dagelijks | `license:check --force` | Valideer tegen de license server; failure = offline-grace-pad ([h. 11](11-license-and-delivery.md)). |
| 03:00 dagelijks | `sanctum:prune-expired --hours=24` | Token-opschoning. |
| ma 08:00 | `ai:weekly-summary` | Manager-samenvatting per vestiging in hun locale; valt terug op een kale statistiek-narrative zonder OpenAI-key. |

---

## Horizon

Dashboard op `/horizon`, gegate door de `viewHorizon`-gate (`app/Providers/HorizonServiceProvider.php`). Gefaalde jobs landen op de Failed-tab met payload + exception; webhook-leveringsfouten uit [h. 8](08-integration-api.md) verschijnen hier met hun resterende retries.

### Deploy note — bounce de juiste container bij deploy

Horizon draait in zijn **eigen `horizon`-container**, niet in `app`. Dus:

```bash
docker compose exec app php artisan horizon:terminate   # ✗ "No processes to terminate" — doet niets
docker compose restart horizon                          # ✓ worker herstart met verse code
# of: docker compose exec -T horizon php artisan horizon:terminate
```

Een verouderde worker blijft oude code draaien en **ziet nieuw toegevoegde queued classes nooit** — een deploy die een job/notificatie hierboven toevoegt of wijzigt moet de `horizon`-container bouncen, anders "lukken" aangiften terwijl er nooit een notificatie materialiseert. ( Demo- en sandbox-stacks hebben hun eigen `horizon`-containers — bounce elke stack waarnaar je gedeployed hebt.)

---

## Waar elk stuk zit

```
Jobs
├── RecordStockMovements            backend/app/Jobs/RecordStockMovements.php
├── DetectSaleAnomaly               backend/app/Jobs/DetectSaleAnomaly.php
└── DispatchWebhook                 backend/app/Jobs/DispatchWebhook.php

Notificaties
├── BtwFiling{Submitted,Resubmitted,Disputed,Accepted}   backend/app/Notifications/
├── WelcomeCredentials              backend/app/Notifications/WelcomeCredentials.php
├── NotificationController          backend/app/Http/Controllers/Api/NotificationController.php
├── notifications-tabel             2026_06_15_000001_create_notifications_table.php
└── NotificationBell (frontend)     dashboard/src/components/shared/NotificationBell.tsx

Schedule & workers
├── routes/console.php              de cron-tabel hierboven
├── config/horizon.php              supervisor-1 → ['default']
├── horizon-container               docker-compose.yml:129
└── scheduler-container             docker-compose.yml:158
```

---

→ Volgende: [11 — Licentie & delivery-pipeline](11-license-and-delivery.md)
