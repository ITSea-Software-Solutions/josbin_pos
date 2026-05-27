# Hoofdstuk 14 — AI-inzichten

**Voor wie:** Vestigingsmanager en Organisatiebeheerder — iedereen die verantwoordelijk is voor het signaleren van ongebruikelijke verkooppatronen, snel inzicht krijgen in de week, of het leven van de kassier achter de toonbank gemakkelijker maken. Kassiers zien dit scherm niet, maar ze profiteren van een van de onderliggende features (slim product zoeken op de POS).

**Wanneer te gebruiken:** Maandagochtend, om de wekelijkse samenvatting te lezen. Telkens wanneer u wilt zien of er iets verdachts is gebeurd op de werkvloer in de laatste 30 dagen. Of: nooit — de features draaien vanzelf. Het scherm is hier zodat de bevindingen van de AI zichtbaar zijn voor mensen.

**Wat het voorkomt:** dat de manager een trage daling in omzet mist, een kassier elke woensdagmiddag stilletjes verkopen annuleert, of personeel door de catalogus jaagt naar "dat ding met de afbeelding van de koe erop" wanneer ze gewoon `koe` hadden kunnen typen en de zoekopdracht *Vleeswaren Halal Rund 500g* had kunnen vinden.

![14 ai-inzichten overzicht](screenshots/14-ai-insights-overview.png)
---

## 14.1 Wat is werkelijk live vs wat staat op de roadmap

Wees hier eerlijk over — er is een verleiding bij AI-features om te veel te beloven. Hier is de opsplitsing.

### Live in deze release (v1)

| Feature | Waar het verschijnt | Hoe het draait |
|---|---|---|
| **Slim product zoeken** | POS-app — typ een paar tekens in de zoekbalk van het winkelmandje | Trigram fuzzy match in PostgreSQL (`pg_trgm`), met pgvector semantische zoekopdracht bedraad zodra embeddings zijn gevuld. Valt terug op plain `ILIKE` als de extensies niet beschikbaar zijn. |
| **Fraude- en anomaliedetectie** | Dashboard → AI-inzichten → sectie Fraude-meldingen | Wachtrij-job na elke voltooide verkoop (Redis). Heuristische regels scoren de verkoop; gemarkeerde verkopen komen in het onveranderlijke auditlogboek terecht en verschijnen hier. |
| **Wekelijkse AI verkoopsamenvatting** | Dashboard → AI-inzichten → sectie Wekelijkse Samenvatting | Geplande opdracht draait elke maandag 08:00 AST per organisatie. Opgeslagen in `ai_summaries`, geserveerd vanaf daar naar het dashboard. |
| **AI-narratief op anomalieën** | Dashboard → AI-inzichten → individuele melding | Best-effort GPT-4o-aanroep wanneer een anomalie wordt gemarkeerd. Valt terug op een gestructureerde "geen narratief"-melding wanneer geen API-sleutel is geconfigureerd. |

### Roadmap — Fase 2 (3–6 maanden na lancering), **nog niet bedraad**

| Feature | Gepland gedrag |
|---|---|
| **Auto-categorisatie bij productaanmaak** | Een knop "Suggestie categorie" op het formulier Product toevoegen stelt een categorie + BTW-tarief voor op basis van de naam (en een Suriname SKU-opzoek). Vandaag heeft het formulier Product toevoegen geen dergelijke knop — zie [Hoofdstuk 4 §4.9](04-catalogue-and-categories.md#49-ai-auto-categorisation). |
| **Rapporten in natuurlijke taal** | Typ *"Toon me de top 10 producten van vorige maand"*, AI bevraagt de DB en retourneert een grafiek. |
| **Voorraadbestel-voorspelling** | Verkoopvelocity-model waarschuwt u 3 dagen vóór stockout. |
| **Factuur-OCR** | Fotografeer leveranciersfactuur, AI extraheert regelitems naar voorraadinvoer. |
| **Slimme promotie-suggesties** | Identificeert traag verkopende artikelen, stelt getimede kortingen voor. |

Als een klant vandaag vraagt naar een Fase 2-feature, is het juiste antwoord *"op de roadmap; niet in deze build"*.

---

## 14.2 Het model — waar een AI-feature werkelijk van afhangt

```
┌─────────────────────────────────────────┐
│  Heuristische laag (draait altijd)      │
│  Trigram-zoek, anomalieregelscoring,    │
│  wekelijkse statistiek-aggregatie       │
└─────────────────────────────────────────┘
                  │
                  ▼ (best-effort)
┌─────────────────────────────────────────┐
│  LLM-laag (wanneer API-sleutel ingest.) │
│  OpenAI GPT-4o (primair)                │
│  Anthropic Claude (fallback/specialist) │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Opslag                                 │
│  - audit_logs.event = 'anomaly_detected'│
│  - ai_summaries (org, week_start)       │
│  - products.embedding (pgvector 1536)   │
└─────────────────────────────────────────┘
```

Twee belangrijke implicaties:

- **Zonder API-sleutel werkt de heuristische laag nog steeds.** Anomalieën worden nog steeds gemarkeerd, weekstatistieken worden nog steeds berekend. U krijgt alleen een deterministisch fallback-narratief ("Weekoverzicht 19-05 – 25-05: SRD 12.450,00 omzet in 423 transacties…") in plaats van een door een model geschreven samenvatting. Zoeken werkt nog steeds als pure trigram + ILIKE.
- **Uitvoertaal volgt de locale van de manager.** Een organisatie met `locale='nl'` krijgt Nederlandse samenvattingen; organisatie met `locale='en'` krijgt Engels. Anomalie-narratieven zijn altijd Nederlands — de fraude-analist-persona is alleen Nederlands by design (het publiek voor een melding in Suriname leest overweldigend Nederlands).

De OpenAI-sleutel staat in `services.openai.key` in de back-office `.env`. Leveranciersondersteuning vult deze in tijdens installatie; roteren is één configuratiewijziging + een `php artisan config:cache`.

---

## 14.3 Het scherm AI-inzichten openen

**Pad:** Dashboard → **AI-inzichten** (linkerzijbalk).

Twee secties stapelen zich op de pagina:

1. **Wekelijkse Samenvatting** (bovenaan) — huidige week vs vorige week, top producten, AI-narratief
2. **Fraude-meldingen (30 dagen)** (onderaan) — lijst van recente anomalie-markeringen

Als u Kassier of Auditor bent, is dit menu-item verborgen — de onderliggende endpoints zijn gegate door `can:ai.insights`, wat alleen Vestigingsmanager en hoger hebben. De URL direct laden retourneert 403.

![14 ai-inzichten wekelijks](screenshots/14-ai-insights-weekly.png)
---

## 14.4 De wekelijkse samenvatting in detail

### Wat wordt samengevat

Elke maandag om 08:00 AST draait een geplande opdracht (`ai:weekly-summary`) voor elke actieve organisatie. Voor elke organisatie berekent het:

- **Deze week** (vorige maandag → vorige zondag, in AST): aantal afgeronde verkopen, totaal SRD, BTW SRD, gemiddelde besteding, aantal annuleringen, contant-vs-pin-verdeling
- **Vorige week** (zelfde venster, verschoven -7 dagen): dezelfde metrieken
- **Percentageverandering** in omzet en aantal transacties
- **Top 5 producten** per SRD-omzet deze week

Deze statistieken worden op de rij opgeslagen ongeacht of de LLM-aanroep slaagt. Het narratief is wat er wel of niet kan zijn.

### Wat het dashboard toont

| Element | Detail |
|---|---|
| **Gegenereerd** datum | Wanneer de samenvatting voor het laatst is geproduceerd. Indien ouder dan 7 dagen, gedraagt de planner zich niet correct — escaleer. |
| **Omzet deze week** kaart | Totaal SRD + percentageverandering vs vorige week (groen omhoog / rood omlaag). |
| **Transacties** kaart | Aantal + verandering vs vorige week. |
| **Gem. besteding** kaart | Gemiddelde verkoopgrootte deze week. |
| **Annuleringen** kaart | Alleen getoond wanneer > 0. Rode tekst. |
| **AI-analyse** paneel | 3–4 zinnen alledaags-taal samenvatting in de taal van de organisatie. Vriendelijke toon, feitelijk, vermeldt trend + top categorieën. |
| **Top producten deze week** | Top 5, met verkochte eenheden en SRD-omzet per item. |

### Wanneer er nog geen samenvatting is

Een gloednieuwe organisatie die zijn eerste maandag nog niet heeft gezien krijgt:

> *"Nog geen samenvatting beschikbaar — de wekelijkse samenvatting wordt elke maandag gegenereerd."*

Trigger het niet handmatig behalve voor testdoeleinden. De leverancier kan een force-run uitvoeren met `php artisan ai:weekly-summary --org=<uuid>` als een klant op dag één ongeduldig is.

### Fallback-narratief wanneer geen API-sleutel is geconfigureerd

Zonder werkende OpenAI-sleutel schrijft het systeem een deterministische samenvatting:

> *"Weekoverzicht 19-05-2026 – 25-05-2026: SRD 12.450,00 omzet in 423 transacties (gemiddeld SRD 29,43 per bon). Dit is 8,2% hoger dan vorige week. 3 annuleringen geregistreerd."*

Klanten krijgen nog steeds waarde; de LLM voegt alleen een vriendelijkere stem toe.

---

## 14.5 Fraude- en anomaliedetectie

Dit is de sectie die zijn waarde verdient. Na **elke** voltooide verkoop draait een wachtrij-job (`DetectSaleAnomaly`) een snelle heuristische controle uit. Als er iets niet klopt, wordt de verkoop gemarkeerd in het auditlogboek en verschijnt hier.

### Wat wordt gecontroleerd

| Regel | Drempel | Waarom het ertoe doet |
|---|---|---|
| **Buiten-uren verkoop** | Vóór 06:00 of na 23:00 AST | Kassiers zouden niet moeten boeken vóór openingstijd of na sluiting. Veelvoorkomend patroon voor een personeelslid dat zijn eigen privé-verkoop door de kassa draait. |
| **Grote korting** | > 30% korting op een enkele verkoop | Manager-goedgekeurde kortingen zijn meestal onder 15%. > 30% is een vriend-van-kassier-transactie of een typfout. |
| **Ongebruikelijk grote winkelmand** | > 2,5 standaardafwijking van het 30-dagen gemiddelde van de vestiging | Een enkele verkoop tien keer groter dan normaal verdient een tweede blik. Kan legitiem zijn (groothandel loopklant), kan een nepverkoop zijn die nooit is terugbetaald. |
| **Annuleringen stapelen zich op** | Dezelfde kassier ≥ 3 geannuleerde verkopen in het laatste uur | Klassieke kassafraude-signatuur — boek nepverkopen voor een vriend, annuleer ze, steek het equivalente contant later in eigen zak. |
| **Nul of negatief totaal op een niet-annulering** | Totaal ≤ 0 | Edge-case maar de moeite waard om op te vangen — meestal een kortingstapelingsbug. |

De eerste twee zijn voor de hand liggend. De derde (winkelmandgrootte z-score) gebruikt het eigen 30-dagen rollend gemiddelde van de vestiging, zodat een drukke supermarkt en een kleine hoekwinkel automatisch afgestemde drempels krijgen — geen handmatige configuratie.

### Hoe een melding eruitziet

Elke gemarkeerde verkoop landt als een kaart met een rode linkerrand:

- **Verkoopnummer** pilletje (bv. `#000-2026-1042`)
- Eén geel pilletje per overeenkomende vlag (bv. `Buiten-uren verkoop om 23:47 AST`)
- Vestiging, kassier, en totaal SRD
- Tijdstempel detectie (AST, geformatteerd in de locale van de manager)
- **AI-narratief** (als de OpenAI-sleutel is geconfigureerd) — 2–3 zinnen in Nederlands van een fraude-analist-persona, die uitlegt wat er verdacht is in alledaagse taal

Voorbeeld-narratief:

> *"Verkoop #000-2026-1042 van SRD 1.847,00 valt op door een grote afwijking van het dagelijks gemiddelde van de winkel (3,2 standaardafwijkingen). De transactie vond plaats om 23:47 — buiten reguliere openingstijden. Aanbevolen: controleer de bonregistratie en bevestig met de kassamedewerker."*

Wanneer de OpenAI-sleutel niet is geconfigureerd, ontbreekt de narratief-regel — de vlaggen zijn op zichzelf nog steeds actiegericht.

### Wanneer er geen vlaggen zijn

> *"Geen afwijkingen gedetecteerd — de afgelopen 30 dagen zijn er geen verdachte transacties gevonden."*

Groen paneel. Dit is de doelstand.

### Wat te doen met een gemarkeerde verkoop

1. Klik op het verkoopnummer — u wordt naar het verkoopdetailscherm gebracht (Hoofdstuk 11 — binnenkort beschikbaar).
2. Bekijk de regelitems, de notitie van de kassier, de andere annuleringen van de kassier die dag.
3. Als het legitiem is (een groothandel loopklant, een goedgekeurde managerkorting, een sluitingstijd-noodgeval), is er geen actie nodig. De vlag blijft voor altijd in het auditlogboek als een vastgelegde "manager beoordeeld, OK".
4. Als het niet legitiem is, volg de [terugbetaling / annulering escalatieprocedure](01-roles-and-permissions.md#13-the-permission-matrix) — en overweeg het kassieraccount onmiddellijk te deactiveren terwijl u onderzoekt (Hoofdstuk 3).

> **Anomalie-vlaggen zijn alleen-toevoegen.** Zodra een verkoop is gemarkeerd, blijft het gemarkeerd. Er is geen "negeren" of "markeren als opgelost"-knop — de auditlogboek-onveranderbaarheidsregel overrideert UX-gemak hier. Vlaggen zijn bewijs, geen takenlijst.

### Toekomst: realtime push

Vandaag verschijnen vlaggen wanneer een manager het scherm AI-inzichten opent. De architectuur ondersteunt een Reverb WebSocket-push (en optionele e-mail), maar de in-app push is nog niet bedraad aan een toastmelding. Op de roadmap.

---

## 14.6 Slim product zoeken — wat er aan de toonbank gebeurt

Deze feature heeft geen UI op het dashboard — het voedt de POS. Hier vermeld voor volledigheid.

Wanneer een kassier in de zoekbalk op de POS typt:

1. Als de invoer 8–13 cijfers is → eerst exacte barcode-match geprobeerd
2. Anders → trigram-gelijkenis (`pg_trgm`) over `name_nl`, `name_en` EN een partiële substring-fallback (`ILIKE %q%`) op namen + barcode
3. Zodra productembeddings zijn gevuld, wordt **pgvector semantisch zoeken** bovenop gelegd — typen `melk` matcht *Volle Melk 1L*, *Halfvolle Melk 1L*, *Magere Melk 1L* zelfs met de volgorde gerangschikt op semantische afstand in plaats van alfabetisch
4. Top 10 resultaten geretourneerd, gesorteerd op trigram-gelijkenis (meest-gelijk eerst)
5. De hele round-trip is < 50 ms — voelt onmiddellijk aan de toonbank

Als de PostgreSQL `pg_trgm`-extensie niet beschikbaar is (bv. een oudere Postgres-image), valt het systeem stil terug op plain `ILIKE`-matching. De kassier merkt het niet; de zoekopdracht wordt gewoon iets minder typfout-tolerant.

**Embeddings-generatie** is op dit moment een handmatige eenmalige operatie (`php artisan products:generate-embeddings`). Leveranciersondersteuning voert het uit na een bulkcatalogus-import. Automatische re-embedding bij bewerken staat op de roadmap.

---

## 14.7 Wat klanten te vertellen

Eerlijke gesprekspunten als een koper vraagt naar AI in de demo:

| Vraag | Eerlijk antwoord |
|---|---|
| *"Gebruikt het echt AI?"* | De samenvattingsnarratieven en de fraude-uitleg zijn geschreven door GPT-4o (met Claude als configureerbare fallback). De fraude-*detectie* zelf is regelgebaseerd, geen AI-blackbox — wat een feature is, geen bug, omdat regels uitlegbaar zijn aan een Belastingdienst-inspecteur. |
| *"Wat als de AI verkeerd is?"* | Het narratief is gelaagd *bovenop* harde cijfers. De cijfers zijn de bron van waarheid; het narratief is een leeshulp. Beide worden opgeslagen, zodat u altijd de onderliggende cijfers kunt auditen. |
| *"Hoe zit het met mijn dataprivacy?"* | De samenvattingsprompt verstuurt geaggregeerde statistieken (geen klantnamen, geen pinpasdata, geen adressen). Het anomalie-narratief verstuurt verkoopnummer + bedrag + kassiernaam. Geen van beide stuurt PII. Als een klant een hard verbod heeft op data die het land verlaat, schakelen we de OpenAI-sleutel volledig uit — ze krijgen nog steeds heuristische vlaggen + deterministische samenvattingen. |
| *"Kunnen we een ander model gebruiken?"* | De service is provider-agnostisch via een HTTP-client-wrapper. OpenAI GPT-4o is de standaard; Claude kan worden ingewisseld voor dezelfde prompts; toekomstige lokale-model-ondersteuning (LM Studio / Ollama) is eenvoudig maar niet in deze build. |
| *"Zal het onze specifieke winkel leren?"* | De anomaliedrempels passen zich automatisch aan elke vestiging's 30-dagen rollend gemiddelde aan. Er is geen per-klant fijngetuned model — dat is geen v1-feature en zal dat waarschijnlijk nooit zijn (kleine data, groot risico). |
| *"Wat kost het ons?"* | OpenAI-gebruik bij v1-features: één wekelijkse samenvattingsaanroep per organisatie per maandag (~1k tokens) plus een anomalie-narratief per gemarkeerde verkoop (~300 tokens). Voor een 50-winkelketen is dat centen per maand. |

---

## 14.8 Operationele checklist

Dingen om te verifiëren na een verse installatie:

- [ ] OpenAI-sleutel staat in de back-office `.env` (`OPENAI_API_KEY=…`) **OF** klant heeft ingestemd met "geen AI-narratieven".
- [ ] Horizon draait zodat `DetectSaleAnomaly`-jobs daadwerkelijk vuren (`php artisan horizon:status`).
- [ ] Scheduler draait zodat `ai:weekly-summary` elke maandag vuurt (`php artisan schedule:list` toont het).
- [ ] PostgreSQL `pg_trgm`-extensie is geïnstalleerd (`CREATE EXTENSION IF NOT EXISTS pg_trgm;`).
- [ ] PostgreSQL `vector`-extensie is geïnstalleerd (`CREATE EXTENSION IF NOT EXISTS vector;`) — vereist voor pgvector semantisch zoeken.
- [ ] Minstens één week verkoopdata bestaat voordat geklaagd wordt over "nog geen samenvatting".

Voor diepere architectuur zie [`/docs/10-jobs-and-schedules.md`](../docs/10-jobs-and-schedules.md). Voor de onderliggende techstack-rationale zie het projectvoorstel §6 "AI Layer".

---

## 14.9 Snelle referentie

```
WEKELIJKSE SAMENVATTING   AI-inzichten → bovenste sectie
                          Draait elke maandag 08:00 AST per organisatie
                          NL- of EN-narratief gebaseerd op org.locale
                          Geen-sleutel fallback: deterministische statzin

ANOMALIE-MELDINGEN        AI-inzichten → onderste sectie
                          Draait na elke voltooide verkoop (in wachtrij)
                          5 heuristische regels, onveranderlijke auditlog-entry
                          NL-narratief wanneer OpenAI-sleutel geconfigureerd

SLIM ZOEKEN               POS-app zoekbalk winkelmandje
                          Barcode → trigram → pgvector → ILIKE-fallback
                          < 50 ms round-trip

GEEN API-SLEUTEL?         Alles werkt nog steeds. Alleen geen LLM-narratieven.
                          Statistieken, vlaggen, zoeken alle onaangetast.

ROADMAP                   Auto-categorisatie, NL→SQL rapporten,
                          voorraadvoorspelling, factuur-OCR, promo-suggesties
```

---

→ Volgende: [Hoofdstuk 15 — Licentiebeheer — UI-overzicht](15-license-management.md)
