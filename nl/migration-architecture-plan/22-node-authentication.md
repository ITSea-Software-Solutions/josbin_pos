# 22. Hoe de knooppunten bewijzen wie ze zijn

Hoofdstuk 19 zegt welke verbindingen er zijn en wat ze vervoeren. Het zegt niet
hoe de ontvangende kant weet dat de afzender is wie hij beweert te zijn. Dit
hoofdstuk wel.

Niets hiervan is gebouwd. Dit is het beveiligingsontwerp waar de opsplitsing van
afhangt, en juist het deel dat duur is om achteraf toe te voegen — een verbinding
die zonder authenticatie live gaat, krijgt die later door elk knooppunt in het
veld tegelijk te breken.

---

## 22.1 De vorm van het vertrouwen

<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three nodes with the authentication on each wire: control signs licence tokens the shop verifies, the shop signs rollups the control plane verifies, and the shop signs BTW filings the tax node verifies against a key enrolled directly with it" style="max-width:700px;width:100%;height:auto;font-family:sans-serif">
  <!-- Control -->
  <rect x="250" y="14" width="200" height="96" rx="11" fill="#293371"/>
  <text x="350" y="38" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">☁️ Beheerknooppunt</text>
  <line x1="266" y1="48" x2="434" y2="48" stroke="#4a5596" stroke-width="1.3"/>
  <text x="350" y="66" text-anchor="middle" font-size="10.5" fill="#ffffff">🔑 licentie-ONDERTEKENSLEUTEL (privé)</text>
  <text x="350" y="83" text-anchor="middle" font-size="10.5" fill="#c9d2ee">register van PUBLIEKE knooppuntsleutels</text>
  <text x="350" y="100" text-anchor="middle" font-size="10.5" fill="#c9d2ee">intrekkingslijst</text>

  <!-- Shop -->
  <rect x="20" y="215" width="215" height="130" rx="11" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="127" y="240" text-anchor="middle" font-size="13" font-weight="700" fill="#111827">🏪 Winkelknooppunt</text>
  <line x1="36" y1="250" x2="219" y2="250" stroke="#e6ecf5" stroke-width="1.3"/>
  <text x="127" y="269" text-anchor="middle" font-size="10.5" fill="#111827">🔐 zijn EIGEN privésleutel</text>
  <text x="127" y="286" text-anchor="middle" font-size="10.5" fill="#6b7280">gemaakt bij de activatie</text>
  <text x="127" y="303" text-anchor="middle" font-size="10.5" fill="#6b7280">verlaat deze machine nooit</text>
  <rect x="36" y="313" width="183" height="22" rx="5" fill="#eef2fb"/>
  <text x="127" y="328" text-anchor="middle" font-size="10" fill="#293371">publieke sleutel van beheer ingebakken</text>

  <!-- Tax -->
  <rect x="465" y="215" width="215" height="130" rx="11" fill="#ffffff" stroke="#1f6b3b" stroke-width="2.5"/>
  <text x="572" y="240" text-anchor="middle" font-size="13" font-weight="700" fill="#0e1a14">🏛 Belastingknooppunt</text>
  <line x1="481" y1="250" x2="664" y2="250" stroke="#cfe0d5" stroke-width="1.3"/>
  <text x="572" y="269" text-anchor="middle" font-size="10.5" fill="#0e1a14">een EIGEN register:</text>
  <text x="572" y="286" text-anchor="middle" font-size="10.5" fill="#0e1a14">BTW-nummer → publieke sleutel</text>
  <rect x="481" y="296" width="183" height="39" rx="5" fill="#e6efe9"/>
  <text x="572" y="311" text-anchor="middle" font-size="10" fill="#1f6b3b">aangemeld door de belastingplichtige,</text>
  <text x="572" y="326" text-anchor="middle" font-size="10" fill="#1f6b3b">niet door ons gewaarborgd</text>

  <!-- licence: control -> shop -->
  <line x1="264" y1="104" x2="150" y2="209" stroke="#EF6C00" stroke-width="2.5"/>
  <polygon points="150,209 162,204 160,215" fill="#EF6C00"/>
  <text x="26" y="150" font-size="11" font-weight="600" fill="#EF6C00">① licentietoken</text>
  <text x="26" y="165" font-size="10" fill="#6b7280">beheer ondertekent · winkel controleert</text>
  <text x="26" y="179" font-size="10" fill="#6b7280">offline, geen netwerk</text>

  <!-- rollups: shop -> control -->
  <line x1="215" y1="209" x2="330" y2="116" stroke="#293371" stroke-width="2.5" stroke-dasharray="5 4"/>
  <polygon points="330,116 318,120 322,130" fill="#293371"/>
  <text x="232" y="170" font-size="11" font-weight="600" fill="#293371">② totalen</text>
  <text x="232" y="185" font-size="10" fill="#6b7280">winkel ondertekent · beheer controleert</text>
  <text x="232" y="199" font-size="10" fill="#6b7280">+ volgnummer · nonce</text>

  <!-- filing: shop -> tax -->
  <line x1="239" y1="280" x2="461" y2="280" stroke="#1f6b3b" stroke-width="2.5"/>
  <polygon points="461,280 449,276 449,285" fill="#1f6b3b"/>
  <text x="350" y="272" text-anchor="middle" font-size="11" font-weight="600" fill="#1f6b3b">③ BTW-aangifte</text>
  <text x="350" y="295" text-anchor="middle" font-size="10" fill="#6b7280">winkel ondertekent · belasting controleert · + ingelogde mens</text>

  <!-- receipt: tax -> control -->
  <line x1="490" y1="212" x2="404" y2="116" stroke="#9aa3b8" stroke-width="1.7" stroke-dasharray="3 4"/>
  <polygon points="404,116 415,117 410,126" fill="#9aa3b8"/>
  <text x="452" y="170" font-size="10.5" font-weight="600" fill="#6b7280">④ alleen bevestiging</text>
  <text x="452" y="185" font-size="10" fill="#6b7280">ingediend j/n · ref · wanneer</text>
  <text x="452" y="199" font-size="10" fill="#6b7280">geen bedragen</text>

  <!-- footer rule -->
  <line x1="20" y1="372" x2="680" y2="372" stroke="#e6ecf5" stroke-width="1.3"/>
  <text x="350" y="393" text-anchor="middle" font-size="11.5" font-weight="700" fill="#111827">Twee sleutelparen, tegengesteld gericht — dat is het hele model.</text>
  <text x="350" y="412" text-anchor="middle" font-size="10.5" fill="#6b7280">Beheer bewijst zich aan de winkel met ①. De winkel bewijst zich aan beheer met ② en aan belasting met ③.</text>
</svg>

Twee sleutelparen, en ze zijn makkelijk door elkaar te halen:

| | Privésleutel bij | Ondertekent | Gecontroleerd door | Beantwoordt |
|---|---|---|---|---|
| **Licentiesleutel** | Beheerknooppunt | Licentietokens | Winkelknooppunt, offline | "Is deze licentie echt?" |
| **Knooppuntsleutel** | Winkelknooppunt | Totalen en aangiften | Beheerknooppunt, belastingknooppunt | "Is dit werkelijk die winkel?" |

De licentiesleutel staat in [§19.3](/nl/migration-architecture-plan/19-three-node-architecture).
Dit hoofdstuk gaat over de tweede.

---

## 22.2 De knooppuntsleutel, en waarom het knooppunt die zelf maakt

Bij de activatie **genereert het knooppunt zijn eigen sleutelpaar** en stuurt
alleen de publieke helft omhoog. De privésleutel gaat naar de sleutelopslag van
het besturingssysteem en wordt nooit verzonden, nooit bij ons geback-upt, en komt
in geen enkele payload voor.

Die volgorde is wezenlijk. Zouden wij het paar genereren en naar beneden sturen,
dan hielden wij een sleutel die als de winkel kan ondertekenen — en een
BTW-aangifte daarmee ondertekend zou niet te onderscheiden zijn van één die de
winkelier zelf deed. D4 zegt dat wij buiten de bewijsketen blijven; een door de
leverancier gegenereerde sleutel zet ons er meteen weer in.

**Ed25519** (RFC 8032). Kleine sleutels, snelle controle op een goedkope
ARM-kassa, en geen curve- of padding-parameters om fout te kiezen. De signatuur
is 64 bytes — verwaarloosbaar naast een dagelijkse payload van 50–200 kB.

---

## 22.3 Onderteken de payload, niet de verbinding

Het voor de hand liggende antwoord is wederzijdse TLS: geef elk knooppunt een
clientcertificaat. Maak dat niet het primaire mechanisme, om één concrete reden.

**Laag 4 van de terugval is een USB-stick.** Een manager in Nickerie exporteert
de dag, loopt ermee naar een machine met internet, of stuurt hem via WhatsApp.
Het hoofdkantoor uploadt het bestand in het dashboard, en het moet importeren
*precies alsof het gesynchroniseerd was*. Transportauthenticatie overleeft dat
niet: zodra de payload een bestand is, is TLS allang afgelopen en heeft het niets
over dat bestand bewezen.

De authenticatie reist dus **binnenin** de payload mee:

```
POST /v1/nodes/{node_id}/rollups
Content-Type: application/json
X-Josbin-Node:      3f2b…          ← welk knooppunt beweert te spreken
X-Josbin-Signature: ed25519=…      ← losse signatuur over de canonieke body
X-Josbin-Seq:       1184           ← monotoon, per knooppunt, nooit hergebruikt
X-Josbin-Schema:    2              ← beheer accepteert N−2 (§19.6)

{ "node_id":"3f2b…", "seq":1184, "nonce":"9c1e…",
  "signed_at":"2026-07-30T09:14:22-03:00",
  "business_date":"2026-07-29",
  "rollups":[ … ], "z_reports":[ … ] }
```

Dezelfde bytes, met dezelfde signatuur, valideren of ze nu over HTTPS binnenkwamen,
op een USB-stick, of als WhatsApp-bijlage. Dát is de eigenschap om voor te
ontwerpen, en wederzijdse TLS kan die niet leveren.

TLS 1.3 draagt nog steeds het onlinepad — vertrouwelijkheid en integriteit
onderweg, HSTS, oudere versies uitgeschakeld. Wederzijdse TLS kan er later bij
als extra laag. Geen van beide is ooit het *enige* bewijs.

::: warning Canonicaliseer vóór het ondertekenen, anders klopt er niets.
Onderteken de bytes van een **canonieke** serialisatie (JCS, RFC 8785), niet wat
je JSON-encoder toevallig uitspuwde. Elke proxy, elke herserialisatie, elke map
die sleutels herordent breekt stil elke signatuur — en de storing ziet eruit als
"het knooppunt is gecompromitteerd", niet als "de encoder heeft een veld
verplaatst".
:::

---

## 22.4 Herhaling, nieuwe pogingen en volgorde

In Nickerie is een nieuwe poging na een time-out het normale geval, niet de
uitzondering. Het knooppunt kan "je hebt het nooit ontvangen" niet onderscheiden
van "je hebt het ontvangen en de bevestiging ging verloren", dus probeert het
opnieuw — en het moet eindeloos opnieuw kunnen proberen zonder een dagomzet
dubbel te tellen.

- **Monotoon volgnummer per knooppunt.** Beheer bewaart de hoogste geziene
  `seq`. Een herhaling van een al gezien `(node_id, seq)` geeft het oorspronkelijke
  antwoord terug en verandert niets. Idempotentie en herhalingsbescherming zijn
  hetzelfde mechanisme.
- **Nonce** per payload, zodat twee verschillende payloads nooit byte-identiek
  kunnen zijn.
- **`signed_at` wordt vastgelegd, niet afgedwongen.** Een knooppunt dat vijf
  dagen offline was, dient terecht vijf dagen tegelijk in. Afwijzen op
  klokafwijking zou precies de klant breken voor wie het offline-ontwerp bestaat.
  Het volgnummer is de verdediging tegen herhaling; de klok is bewijs, geen poort.
- **Gaten zijn een signaal, geen fout.** Een sprong van 1184 → 1190 betekent dat
  vijf payloads ontbreken of dat iemand selectief herhaalt. Aannemen, markeren, en
  tonen op de statusregel van het knooppunt.

---

## 22.5 De andere kant op: het knooppunt moet ons authenticeren

Het netwerk van een winkel is niet van ons. Wie een hosts-bestand kan aanpassen,
kan het knooppunt naar een eigen server wijzen.

- **Pin de CA, niet het eindcertificaat.** Pin de publieke sleutel van onze
  uitgevende CA. Het eindcertificaat pinnen breekt elk knooppunt bij de volgende
  Let's Encrypt-vernieuwing — een storing die je jezelf elke 90 dagen aandoet.
- **Het antwoord dat ertoe doet is toch ondertekend.** Een nagemaakt
  beheerknooppunt kan totalen aannemen en leert daarmee niets nieuws, en het kan
  geen licentietoken maken zonder de ondertekensleutel. Dát is de reden dat ① een
  signatuur is en geen antwoord.

---

## 22.6 De belastingverbinding, waar wij bewust niet tussen zitten

Het belastingknooppunt is een ander vertrouwensdomein. Het kan ons niet op ons
woord geloven over wie een belastingplichtige is, want wij zijn de leverancier,
niet de autoriteit.

**Aanmelden gebeurt rechtstreeks, één keer.** De manager logt in op het portaal
van de Belastingdienst met inloggegevens die de Belastingdienst aan die
belastingplichtige heeft verstrekt, en registreert daar de publieke sleutel van
het knooppunt — de vingerafdruk staat in de kassa en wordt op het portaal
bevestigd, zodat een verkeerde sleutel zichtbaar is vóór hij vertrouwd wordt. Het
belastingknooppunt bewaart `BTW-nummer → publieke sleutel`. Het beheerknooppunt
wordt niet geraadpleegd en staat nergens borg voor.

Elke aangifte wordt vervolgens ondertekend over: BTW-nummer, periodesoort en
-bereik, totalen per tarief, de aangiftereferentie, **het id van de mens die hem
indiende**, en de hash van de vorige aangifte van die organisatie.

Die laatste twee maken een aangifte moeilijk te ontkennen én moeilijk te
vervalsen:

- Ondertekend met de knooppuntsleutel → aantoonbaar van dat knooppunt.
- Draagt een ingelogde gebruiker → een gestolen sleutel alleen kan niet aangeven,
  want aangifte doen vereist op dat moment een menselijke sessie op het knooppunt.
- Geketend aan de vorige aangifte → een aangifte kan achteraf niet stil worden
  ingevoegd, verwijderd of van volgorde veranderd. Die keten bestaat al
  (BTW-FILING-11); dit trekt hem door over de knooppuntgrens heen.

**De login van de belastinginspecteur zelf verandert niet**: dat account woont in
het belastingknooppunt, 2FA is verplicht en kan op beleidsniveau niet uit, en de
inspecteur authenticeert nooit bij een winkel of bij het beheerknooppunt. Drie
knooppunten, drie gebruikerstabellen, drie gescheiden authenticatiedomeinen —
precies de reden dat de elf `AUTH-*`-functies in
[§21.3](/nl/migration-architecture-plan/21-migration-record) als splitsend staan.

---

## 22.7 Wat een gestolen schijf werkelijk oplevert

De privésleutel staat op een Windows-pc achter iemands toonbank. In
[§20.1](/nl/migration-architecture-plan/20-split-build-plan) staat al dat wie die
machine in handen heeft, de schijf kan lezen. Doen alsof de sleutel daar veilig is
zou oneerlijk zijn, dus hier de werkelijke positie.

**Verklein de kans:**

- Bewaar de sleutel in de **sleutelopslag van het besturingssysteem** (DPAPI op
  Windows), gebonden aan het machineaccount, niet als bestand naast de config.
- **Hardwarevingerafdruk** in de licentie, zodat een gekopieerde VM zakt voor de
  licentiecontrole, zelfs mét de sleutel (§19.3).
- Voor overheidslocaties haalt een **TPM- of smartcard-sleutel** de blootstelling
  op schijf helemaal weg. De moeite waard om te offreren waar de installatie dat
  rechtvaardigt.

**Begrens de schade.** De knooppuntsleutel kan bewust heel weinig:

| Met een gestolen knooppuntsleutel KUN je | Je kunt NIET |
|---|---|
| Verzonnen totalen indienen voor **die ene winkel** | De gegevens van een andere winkel lezen |
| | Een licentie maken of verlengen — dat vraagt de privésleutel van beheer |
| | Aangifte doen voor een ander BTW-nummer — het register bindt sleutel aan belastingplichtige |
| | Überhaupt aangifte doen zonder ingelogde gebruikerssessie op het knooppunt |

**Detecteren en intrekken:**

- Een dubbele `seq` uit een tweede bron, of een volgnummerreeks die zich splitst,
  betekent dat twee dingen als één knooppunt ondertekenen.
- De knooppuntstatus draagt laatst geziene IP en versie; een winkel die
  Paramaribo nooit verliet en ineens van elders meldt, verdient een markering,
  geen blokkade.
- Beheer kan een **publieke knooppuntsleutel intrekken**. Het volgende contact
  faalt en de winkel meldt zich opnieuw aan met een nieuw sleutelpaar — hetzelfde
  pad als bij een vervangen pc, wat toch al het normale geval is.

---

## 22.8 Rotatie, want sleutels leven langer dan hun aannames

Makkelijk over te slaan; onmogelijk later toe te voegen.

- **Zet vanaf dag één een sleutel-id (`kid`) in elk licentietoken en elke
  signatuurheader.** Een tokenformaat zonder sleutel-id kan nooit roteren — je
  zou elk knooppunt in het veld tegelijk moeten breken om één sleutel te wisselen.
- **Rotatie van de knooppuntsleutel:** de nieuwe publieke sleutel wordt ingediend,
  ondertekend met de *oude*, wat continuïteit bewijst zonder mens in de lus. Is de
  oude sleutel kwijt of gecompromitteerd, dan is dat pad dicht en wordt het bewust
  een nieuwe aanmelding.
- **Rotatie van de ondertekensleutel van beheer:** builds dragen tijdens een
  overlapperiode de huidige én de vorige publieke sleutel, zodat knooppunten op een
  oudere build blijven valideren.

---

## 22.9 De normen waaraan dit voldoet

Geen certificeringsclaim — de lat waarnaar we bouwen, zodat het OWASP-rapport en
de WBP-S-documentatie iets te beschrijven hebben.

| Gebied | Waar we ons aan houden |
|---|---|
| Transport | Alleen TLS 1.3, oudere versies uit, HSTS |
| Signatures | Ed25519 (RFC 8032), detached JWS (RFC 7515), canonical JSON (RFC 8785) |
| Sleutelopslag | Sleutelopslag van het OS; TPM of smartcard waar de installatie dat rechtvaardigt |
| Archief | AES-256-GCM, sleutel in bewaring los van de archiefopslag (D6) |
| Applicatie | OWASP ASVS L2 voor alle drie de knooppunten; OWASP Top 10-rapport vóór livegang |
| Personal data | WBP-S — no customer PII crosses any wire ([§19.5](/nl/migration-architecture-plan/19-three-node-architecture)) |
| Misbruik | Snelheidslimieten per knooppunt; bestaande 1.000/min per API-sleutel op laag 3 |
| Audit | Beide kanten loggen elke geaccepteerde **en geweigerde** payload met knooppunt-id en volgnummer |

Twee gewoonten wegen zwaarder dan welke regel in die tabel ook: **geen enkele
verbinding wordt ooit geauthenticeerd met een gedeeld geheim dat leesbaar op de
schijf van een klant staat**, en **elke payload is achteraf te valideren**, vanuit
een bestand, zonder live verbinding — want dat is de enige eigenschap die overleeft
hoe Suriname werkelijk verbindt.

---

## 22.10 Wat dit toevoegt aan de bouwlijst

Bovenop N1–N16 in [§21.4](/nl/migration-architecture-plan/21-migration-record):

| # | Te bouwen | Knooppunt |
|---|---|---|
| N17 | Sleutelpaar genereren bij activatie + opslag in de OS-sleutelopslag | 🏪 Shop |
| N18 | Payload ondertekenen: canonieke JSON, losse Ed25519, `kid`-header | 🏪 Shop |
| N19 | Signatuurcontrole + register van publieke knooppuntsleutels + intrekking | ☁️ Control |
| N20 | Opslag van volgnummers/nonces — idempotente herhaling, signalering van gaten | ☁️ Control |
| N21 | CA-pinning in de HTTP-client van het knooppunt | 🏪 Shop |
| N22 | Sleutelaanmelding aan belastingzijde (portaalstap) + controle van de aangiftesignatuur | 🏛 Tax |
| N23 | Aangiftesignatuur over totalen + gebruikers-id + hash van de vorige aangifte | 🏪 Shop |
| N24 | Sleutelrotatie op beide verbindingen, inclusief de overlapperiode | All |

Niets hiervan bestaat vandaag. De verbindingen in hoofdstuk 19 zijn getekend;
geen enkele is al geauthenticeerd.
