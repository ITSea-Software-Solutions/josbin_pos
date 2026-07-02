# Incident Response Plan — Josbin POS

**Taal:** Nederlands (primair) · English summary at the bottom
**Status:** Template — velden gemarkeerd met [IN TE VULLEN] per installatie invullen
**Eigenaar:** [IN TE VULLEN — verantwoordelijke functionaris leverancier]
**Laatst herzien:** [IN TE VULLEN datum] · **Herzieningscyclus:** jaarlijks + na elk incident

> Dit plan voldoet aan de meldingsverplichtingen onder de **Wet Bescherming Persoonsgegevens Suriname (WBP-S)** en is bedoeld om zowel digitaal als als fysiek bindwerk aan overheids- en enterpriseklanten te leveren, zoals toegezegd in het voorstel (§ beveiliging).

---

## 1. Doel & reikwijdte

Dit plan beschrijft hoe beveiligings- en gegevensincidenten in Josbin POS worden **gedetecteerd, geclassificeerd, ingedamd, verholpen en geëvalueerd**, en hoe betrokkenen en autoriteiten worden geïnformeerd.

Reikwijdte: de volledige Josbin POS-stack — de Electron-kassa-app, het Super Admin-dashboard, de Open Integratie-API (Laag 3), de back-office server (Laravel + PostgreSQL + Redis), en de cloud-/licentieservers.

---

## 2. Rollen & contactpersonen

| Rol | Verantwoordelijkheid | Naam / contact |
|---|---|---|
| **Incident Lead** | Coördineert respons, neemt eindbeslissingen | [IN TE VULLEN] |
| **Technisch verantwoordelijke** | Indamming, forensiek, herstel | [IN TE VULLEN] |
| **Functionaris Gegevensbescherming (FG)** | WBP-S-melding, betrokkenencommunicatie | [IN TE VULLEN] |
| **Klantcontact** | Communicatie richting getroffen organisatie(s) | [IN TE VULLEN] |
| **Leverancier / support** | Vendor-escalatie | `config josbin_pos.vendor` (support@…, +597 …) |

Bij een **overheidsklant** (Belastingdienst, ministerie): de door de klant aangewezen beveiligings-/privacycontactpersoon wordt binnen het onder §6 genoemde tijdvenster op de hoogte gebracht.

---

## 3. Detectie

Signalen die een incident kunnen aanduiden:

- **Auditlog-anomalieën** — het onveranderbare (append-only) auditlog met SHA-256 hashketen (`audit_logs` + de keten-verificatie) valt of toont onverwachte wijzigingen; draai `php artisan audit:verify --all` — een gebroken keten is een sterk manipulatiesignaal.
- **AI-fraude/anomaliedetectie** — de na elke verkoop gedraaide heuristiek markeert ongebruikelijke voids/kortingen/off-hours-activiteit en waarschuwt de manager.
- **Authenticatiesignalen** — herhaalde mislukte logins (rate-limiting/lockout + e-mailalert), geo-alert bij overheidslogin buiten Suriname, sessie-anomalieën.
- **Infrastructuur** — mislukte back-ups, onverwachte containerherstarts, schijf-/certificaatwaarschuwingen (Nightwatch/monitoring), 4xx/5xx-pieken.
- **Externe melding** — een klant, cashier, integrator of onderzoeker meldt iets verdachts.

Elke medewerker die iets verdachts opmerkt meldt dit **onmiddellijk** aan de Incident Lead.

---

## 4. Classificatie (ernst)

| Niveau | Omschrijving | Voorbeeld | Reactietijd (streef) |
|---|---|---|---|
| **P1 — Kritiek** | Bevestigd datalek van persoonsgegevens, of volledige uitval van een productie-installatie | Ongeautoriseerde toegang tot klant-PII; ransomware; DB-verlies | Direct, 24/7 |
| **P2 — Hoog** | Beveiligingszwakte met reële impact, nog geen bevestigd lek | Misbruikte kwetsbaarheid zonder aangetoonde datatoegang | < 4 uur |
| **P3 — Middel** | Beperkte impact, bevat zichzelf grotendeels | Eenmalige accountcompromittering, snel ingedamd | < 1 werkdag |
| **P4 — Laag** | Geen data-/dienstimpact | Verdachte scan, geblokkeerde poging | Regulier |

De classificatie van een **datalek met persoonsgegevens** activeert altijd de WBP-S-meldprocedure (§6).

---

## 5. Responsprocedure

### 5.1 Indamming (Containment)
- Isoleer het getroffen onderdeel (draai de betreffende container af / trek de netwerkverbinding van de back-office; de DB-container zit al op een geïsoleerd Docker-netwerk zonder internet).
- **Rol-/tokenintrekking**: trek Sanctum-tokens in (geforceerde uitlog binnen seconden bij rolwijziging is ingebouwd); reset getroffen wachtwoorden; schakel gecompromitteerde accounts uit.
- Bewaar bewijs vóór wijzigingen (§7).

### 5.2 Eradicatie
- Verwijder de oorzaak (patch, sluit de kwetsbaarheid, verwijder kwaadaardige artefacten).
- Roteer geheimen indien mogelijk gelekt: `APP_KEY`, API-sleutels (`api_integrations`), webhook-secrets (versleuteld opgeslagen), SMTP-/licentiesleutels. **Let op:** rotatie van `APP_KEY` maakt bestaande veldversleutelde data en oude versleutelde back-ups onleesbaar — plan een her-encryptie/migratie.

### 5.3 Herstel (Recovery)
- Herstel vanuit back-up conform het 3-2-1-principe; gebruik **PostgreSQL WAL point-in-time recovery** om terug te zetten tot vlak vóór het incident (tot op de minuut, AST).
- Verifieer integriteit ná herstel: draai `audit:verify --all`, controleer BTW-totalen en recente Z-rapporten, en bevestig dat de hashketen sluitend is.
- Breng de dienst gefaseerd terug; monitor verscherpt gedurende [IN TE VULLEN] uur.

---

## 6. Meldingsverplichtingen (WBP-S)

Bij een **datalek met persoonsgegevens** (klant: naam/telefoon/e-mail/ID-nummer — deze zijn veld-versleuteld opgeslagen; medewerkersgegevens):

1. **Interne melding** aan de FG: direct bij vermoeden.
2. **Beoordeling**: is er sprake van (waarschijnlijke) inbreuk met risico voor betrokkenen? Documenteer de afweging.
3. **Melding aan de toezichthouder / verwerkingsverantwoordelijke**: de Verwerker informeert de Verwerkingsverantwoordelijke (klant) **zonder onredelijke vertraging** en uiterlijk binnen **[IN TE VULLEN — bv. 48 uur]** na ontdekking, zodat de klant aan zijn WBP-S-verplichtingen kan voldoen (zie de Verwerkersovereenkomst).
4. **Betrokkenen**: indien hoog risico, informeer betrokkenen in duidelijke taal (Nederlands) over aard, waarschijnlijke gevolgen en genomen maatregelen.
5. **Registratie**: leg elk incident vast in het incidentregister (§8), ook als er niet extern gemeld hoeft te worden.

---

## 7. Bewijsbewaring & forensiek

- Het **onveranderbare auditlog** (append-only, hashketen, per organisatie gepartitioneerd) is de primaire forensische bron — wie deed wat, wanneer, vanaf welk IP (AST-timestamps).
- Maak vóór herstel een kopie van: relevante logs (Laravel/Nginx/Horizon), de DB-snapshot, en betrokken versleutelde bestanden.
- Wijzig geen bewijs; werk op kopieën. Documenteer de chain-of-custody [IN TE VULLEN procedure].

---

## 8. Evaluatie na incident (Post-mortem)

Binnen **[IN TE VULLEN — bv. 5 werkdagen]** na sluiting:
- Tijdlijn, oorzaakanalyse (root cause), wat werkte / wat niet.
- Concrete verbeteracties met eigenaar + deadline (voeg terugkerende risico's toe aan de gotcha-registry `CLAUDE_WORKING_GUIDE.md §4`).
- Bijwerken van dit plan indien nodig.
- Vastleggen in het **incidentregister** (datum, ernst, betrokken data, melding ja/nee, acties).

---

## 9. English summary

This is the Josbin POS incident-response plan, written primarily in Dutch to serve as the physical + digital binder Surinamese government/enterprise clients require under WBP-S. It covers **detection** (immutable audit-log/hash-chain verification, AI anomaly detection, auth alerts, infra monitoring), **severity classification** (P1–P4), the **response procedure** (containment via container isolation + token/password revocation, eradication + secret rotation, recovery via PostgreSQL WAL point-in-time recovery and 3-2-1 backups with post-restore integrity verification), **WBP-S breach-notification** obligations and timelines (processor notifies the controller without undue delay, [FILL IN] hours), **evidence preservation** (the append-only audit log as primary forensic source), and a **post-incident review** feeding an incident register. Roles, contacts, and exact timelines are marked [IN TE VULLEN] to complete per deployment.
