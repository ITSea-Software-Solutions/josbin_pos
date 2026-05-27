# Videoscripts — record-in-Loom-en-publiceer

Vijf scripts, één per functie. Elk script staat op zichzelf: je kunt één script aan iemand anders geven en die kan opnemen zonder de andere scripts te lezen.

## Waarom deze vijf

| # | Script | Doelgroep | Duur | Opname-POV |
|---|--------|-----------|------|------------|
| 01 | [Dagcyclus: kassa openen → eerste verkoop → Z-Rapport](./01-daily-cycle-cashier.md) | Kassiertrainers, "hoe ziet de kassa eruit?" | 4–5 min | Kassier |
| 02 | [BTW-aangifte → Belastingdienst-inspecteur accepteert](./02-btw-submission.md) | OA + boekhouding + overheidspitch | 5 min | OA → Inspecteur |
| 03 | [Multi-vestiging hoofdkantoor live overzicht](./03-multi-store-hq-overview.md) | OA / executive pitch — het SaaS-verhaal | 3 min | OA / SA |
| 04 | [Belastinginspecteursportaal doorloop](./04-tax-inspector-portal.md) | Belastingdienst Suriname + Rekenkamer-pitch | 4 min | Belastinginspecteur |
| 05 | [Showcase betaalmethodes (kaartrecon, overschrijvingen, vreemde valuta)](./05-payment-methods-showcase.md) | Sales — "ja, we ondersteunen SR-specifieke betalingen" | 4 min | Kassier |

Totaal: ~20 min video die de vijf hoogst-renderende verhalen dekt.

## Opname-setup — doe dit één keer

**Tools.** Loom (gratis variant is prima voor clips onder 5 min — betaald voor langer). Op Mac: QuickTime → Bestand → Nieuwe schermopname werkt ook en geeft je een .mov die je overal kunt uploaden. OBS Studio als je post-productie overlays wilt.

**Browser.** Chrome, vers profiel (geen extensies). Vensterformaat 1366 × 820 — komt overeen met de Playwright-screenshotsuite en ziet er scherp uit bij full-screen afspelen. Zoom 100 %. **Zet eerst de dashboard-taal op `nl-NL`** zodat de tekst op het scherm overeenkomt met wat een Surinaamse kijker ziet.

**Microfoon.** Bedrade headsetmicrofoon waar mogelijk. Ingebouwde MacBook-microfoon is acceptabel als terugval — neem op in een rustige kamer, geen ventilator, geen kinderen. Test met een clip van 10 seconden voordat je de volledige take doet.

**Stack.** Start de demostack vóór de opname:

```bash
docker compose -f docker-compose.demo.yml up -d
cd dashboard && npm run dev          # :5174
cd frontend && npm run dev           # :5173
```

Wacht tot beide servers "ready" tonen, ga dan naar `http://localhost:5174` en controleer of je kunt inloggen als `orgadmin@dehoop.sr / OrgAdmin@2026`. Hetzelfde voor kassier (`kassa@dehoop.sr / Cashier@2026`) op `:5173`.

**Belastinginspecteur-demo (alleen script 04).** 2FA is verplicht voor deze rol. Wis vóór de opname het 2FA-geheim van de inspecteur één keer:

```bash
docker exec josbin_demo_app php artisan tinker --execute='
  $u = \App\Models\User::where("email","belastingdienst@gov.sr")->first();
  $u->two_factor_secret = null;
  $u->two_factor_confirmed_at = null;
  $u->save();
  echo "cleared\n";
'
```

Schakel 2FA na de take weer in. (Productie omzeilt dit nooit — dit is een workaround alleen voor opnames.)

## Narratiestijl

- **Conversationeel, niet corporate.** "Dus ik ben ingelogd als Organisatiebeheerder…" werkt beter dan "De gebruikersrol Organisatiebeheerder…"
- **Noem de gebruikersrol.** Zeg altijd vooraan "als kassier" of "als Organisatiebeheerder" zodat kijkers weten wiens scherm ze zien.
- **Citeer de Nederlandse knoptekst één keer**, zoals een klant het zal zien: *"…ik klik op **Indienen**…"* — zo blijft de opname bruikbaar voor zowel Nederlandstalige als Engelstalige kijkers.
- **Leg het WAAROM uit, niet alleen het WAT.** "Ik vul de bankgoedkeuringscode in zodat de dagelijkse kaartafrekening automatisch klopt met het bankafschrift" — niet "Ik type de goedkeuringscode in."
- **Lees het scherm niet voor.** De kijker kan lezen.
- **Neem opnieuw op als je struikelt.** 3 seconden pauzeren en doorgaan leest prima in de uiteindelijke montage — Loom laat je trimmen. Zeg niet "ehmm laat me het opnieuw proberen."

## Wat op het scherm gaat versus in de narratie

De meeste scripts hebben een driekoloms-structuur:

| **Klik** | **Narratie** | **Caption op het scherm** |
|----------|--------------|---------------------------|

De **caption op het scherm**-kolom is Loom's tekst-overlayfunctie — voeg ze on-the-fly toe, of in post. Houd captions onder de 8 woorden. Ze versterken de narratie zonder ermee te concurreren.

## Opnamevolgorde

Voor elk script:

1. **Lees het hele script één keer stil.** Krijg er gevoel voor.
2. **Lees het hardop voor.** Spot de tongbrekers. Herformuleer ze.
3. **Doe een droogloop met de echte UI.** Klik stilletjes door om er zeker van te zijn dat elk element staat waar het script zegt.
4. **Neem op.** Druk Loom op opnemen, adem in, begin met de openingsregel. Maak je geen zorgen om ehmms — de trim-tool fixt ze.
5. **Bekijk op 1.5× snelheid.** Pakt tempoproblemen die je op 1× niet hoort.
6. **Trim dode momenten, voeg captions toe, deel.**

Als een script lang aanvoelt, splits in twee clips op een natuurlijke pauze. Twee volledig bekeken clips van 2 minuten verslaan één half bekeken clip van 4 minuten.

## De scripts bijwerken

De scripts verwijzen naar UI-element-labels precies zoals ze in de app staan. Als de UI verandert (knoptitel hernoemd, modal herontworpen), werk dan het bijbehorende script bij in dezelfde PR als de UI-wijziging — dezelfde discipline als de gebruikershandleiding (zie `CLAUDE_WORKING_GUIDE.md` §2 surfaces checklist).
