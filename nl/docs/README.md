# Josbin POS — Ontwikkelaarsdocumentatie

**Voor:** ontwikkelaars die Josbin POS onderhouden of uitbreiden.
**Bijbehorende docs:** trainingmateriaal voor eindgebruikers staat in [/user_manual/](../user_manual/) (POS-kassier/manager) en [/dashboard_manual/](../dashboard_manual/) (HQ/admin) zodra die geschreven zijn.

Als je het project alleen wilt *draaien*, zie dan de top-level [README.md](../README.md). Deze map is het *waarom* en *hoe* — de architectuur, de flows, en de kaart van waar alles in de code zit.

> **Visueel overzicht** → [`architecture.html`](architecture.html) — single-file interactieve pagina met systeemoverzicht, tech stack, ER-diagram, use cases, sale flow, offline sync, BTW-pipeline, AI en security-lagen. Open in elke browser, of bezoek `/architecture.html` op de docs-site.

---

## Leesvolgorde

Deze docs zijn zo geschreven dat je 1 → 13 kunt lezen om een compleet mentaal model op te bouwen, of naar één doc kunt springen voor een gerichte vraag.

| # | Doc | Wat het behandelt |
|---|---|---|
| 0 | [Installatie- & Setup-gids](00-installation-and-setup.md) | End-to-end runbook: lege server → eerste live verkoop. Lees dit als je voor een nieuwe klant installeert. |
| 1 | [Architectuuroverzicht](01-architecture.md) | Drie lagen, containers, poorten, traffic flow |
| 2 | [Datamodel](02-data-model.md) | Belangrijke entiteiten, relaties, multi-tenancy, money + time conventies |
| 3 | [Auth & rollen](03-auth-and-roles.md) | Sanctum tokens, 2FA-afdwinging, de 6 RBAC-rollen, sessie-timeouts |
| 4 | [Verkooplevenscyclus](04-sale-lifecycle.md) | Een POST /sales-request van begin tot eind doorgelopen |
| 5 | [BTW-pipeline](05-btw-pipeline.md) | Belastingdienst-conforme belastingberekening in bcmath |
| 6 | [Kassa & Z-Rapport](06-register-and-z-report.md) | Open → verkoop → X-Rapport → Sluiten → Z-Rapport → Indienen bij HQ |
| 7 | [Sync & offline-robuustheid](07-sync-and-offline.md) | Vijflaagse fallback inclusief USB AES-256-export |
| 8 | [Open Integration API](08-integration-api.md) | Layer 3 — sale-ingest van derden, webhooks, sandbox |
| 9 | [Realtime broadcasts](09-realtime-broadcasts.md) | Reverb-kanalen en events |
| 10 | [Jobs & schedules](10-jobs-and-schedules.md) | Queues, cron-jobs, AI-achtergrondwerk |
| 11 | [Licentie & delivery](11-license-and-delivery.md) | License server, IonCube-encoding, code signing |
| 12 | [Code map](12-code-map.md) | Feature → bestandsindex |
| 13 | [Development workflow](13-dev-workflow.md) | Veelvoorkomende commando's, debugging, een nieuwe feature toevoegen |

---

## Conventies door alle docs heen

- **Money** is altijd SRD, altijd `DECIMAL(12,2)`, altijd `bcmath`-strings in PHP. Nooit floats. Zie [05-btw-pipeline.md](05-btw-pipeline.md).
- **Time** is altijd AST (`America/Paramaribo`, UTC-3). PostgreSQL `timestamptz`. De frontend rendert via de date-format-voorkeur van de gebruiker.
- **IDs** zijn UUIDs (v4 — random, niet time-sortable; sorteer op `created_at` als je ordening nodig hebt). Sanctum personal access tokens en `audit_logs.id` zijn de uitzonderingen (bigint).
- **Bestandspaden** in code worden geschreven als `backend/app/Http/Controllers/Api/SaleController.php:128` zodat je in je editor naar de exacte regel kunt klikken.
- **Externe docs** die kunnen verouderen worden gelinkt, maar de load-bearing feiten worden inline herhaald.

---

## Wanneer iets niet overeenkomt met de docs

De code is de bron van waarheid. Als je een mismatch vindt:

1. Verifieer tegen de laatste commit (`git log -- backend/app/...`).
2. Als de doc fout is, update hem in dezelfde PR als de code-wijziging. Verouderde docs zijn erger dan geen docs.
3. Als je niet zeker weet wat klopt, [BUILD_STATUS.md](../BUILD_STATUS.md) tracked de huidige per-feature-staat en kan het verklaren.
