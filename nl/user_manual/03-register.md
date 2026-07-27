# Hoofdstuk 3 — Uw Kassa: Openen, Sluiten, Heropenen

**Wie doet dit:** Kassier (openen + sluiten), vestigingsmanager (verzoeken tot heropenen goedkeuren)
**Wanneer:** Openen aan het begin van uw dienst, sluiten aan het eind

Voordat u kunt verkopen, moet u een **kassasessie openen**. Een kassasessie koppelt elke verkoop die u aanslaat aan een specifieke kassalade en een specifieke tijdsperiode. Aan het einde van uw dienst **sluit u de sessie** en het systeem stemt uw kastelling af tegen het verwachte bedrag.

> **Waarom dit belangrijk is:** elke verkoop hoort bij één kassasessie. Als twee kassiers een lade delen, is er telkens maar één sessie tegelijk open. Dat is wat de eindafrekening van uw dienst betekenisvol maakt.

---

## Kassa vs. sessie — wat de woorden betekenen

Mensen halen deze door elkaar. Het zijn **twee verschillende dingen**:

| | **Kassa** | **Kassasessie (een "dienst")** |
|---|---|---|
| Wat het is | De fysieke kassa — één terminal, één kassalade, één printer | De open dienst van één kassier op één kassa |
| Hoe lang het bestaat | Voor altijd (totdat iemand het deactiveert) | Eén dienst (meestal enkele uren, eindigend wanneer u sluit) |
| Wie maakt het aan | **Manager / Organisatiebeheerder** — eenmalig, in het Dashboard | **U, de kassier** — elke dienst, op de POS |
| Waar | Dashboard → Kassa's → Beheer-tabblad → **+ Kassa toevoegen** | POS → Open Kassa-scherm → **Openen** |
| Hoeveel tegelijk | Een vestiging heeft er 1–12 (Kassa 1, Kassa 2, …) | Eén open sessie per kassa tegelijk |

Anders geformuleerd: de **kassa** is de baan vooraan de winkel. De **sessie** is uw dienst achter die baan vandaag. Twee kassiers kunnen Kassa 1 over twee diensten delen (u opent + sluit hem; de volgende kassier opent + sluit hem later opnieuw). Twee kassiers kunnen Kassa 1 *niet tegelijk* delen — daarvoor maakt de manager een tweede kassa aan (Kassa 2).

**U maakt nooit zelf een kassa aan.** Als het **Open Kassa**-scherm geen kassa's toont om uit te kiezen, heeft uw manager ze nog niet aangemaakt — vraag of zij er een toevoegen in Dashboard → Kassa's → Beheer.

---

## 3.1 Uw kassa openen (begin van de dienst)

> **Waar dit gebeurt:** in de **POS-app** op de kassa — niet in het dashboard. Als u op een back-office-computer zit, zoek het pictogram **Josbin POS** op het bureaublad en dubbelklik erop. Als er geen kassa in de buurt is, kan een manager de POS in zijn browser openen via Dashboard → **POS-app openen**.

Nadat u bent ingelogd en uw vestiging heeft gekozen, komt u op het **Open Kassa**-scherm uit.

![Open Kassa-scherm — lijst beschikbare kassa's](screenshots/03-open-register-gate.png)

**Stappen:**

1. **Kies de kassa** die u gaat gebruiken (bijv. *Kassa 1*, *Kassa 2*). De lijst toont alle kassa's die voor uw vestiging zijn ingesteld — tik op degene die u wilt.
   - Als uw vestiging maar **één** kassa heeft, wordt deze stap overgeslagen en gaat u direct naar het beginsaldo.
   - Als een kassa al een open sessie heeft (een andere kassier heeft niet afgesloten), mislukt het openen met een fout. Vraag de andere kassier eerst af te sluiten, of laat een manager de sessie namens hem/haar sluiten.
2. **Voer het beginsaldo in** — het contante geld dat al in de lade zit bij aanvang (bijv. `200.00`).
   - Dit is de "startbank" die de manager 's nachts in de lade heeft achtergelaten of die u uit de kleine kas heeft meegenomen.
   - Gebruik het decimaalteken — `200.00`, niet `200,00`.

   ![Invoer beginsaldo — numpad voor het tellen van startbedrag](screenshots/03-opening-float.png)

3. Tik op **Kassa openen**.

**Wat er daarna gebeurt:**
- De sessie wordt aangemaakt met status *Open*.
- U wordt naar het POS-scherm geleid.
- Uw naam + naam kassa + beginsaldo verschijnen nu in de bovenbalk.

> **Tip:** als u een fout maakt bij het beginsaldo, kunt u dit corrigeren door de sessie direct te sluiten (met hetzelfde bedrag dat u daadwerkelijk telde als de eindafrekening) en een nieuwe te openen met het juiste beginsaldo. Geen verkopen verloren.

---

## 3.2 Tijdens uw dienst

Elke verkoop die u voltooit, wordt automatisch gekoppeld aan uw open kassasessie. U hoeft niets bijzonders te doen — verkoop gewoon.

U kunt de lopende dagtotalen in de bovenbalk controleren:
- **Verkopen vandaag** — lopend SRD-totaal sinds openen.
- **Transacties** — aantal voltooide verkopen.

Als u midden in de dienst van terminal moet wisselen (bijv. printer kapot op Kassa 1), sluit dan eerst de huidige sessie, loop naar Kassa 2 en open daar een nieuwe sessie.

---

## 3.2a Contant geld toevoegen of uitnemen tijdens de dienst (kas in / kas uit)

Er komt soms geld in of uit de lade **buiten een verkoop om**:

| Richting | Heet | Typische redenen |
|---|---|---|
| Contant **in** de lade | **Kas in** | Wisselgeld / kleine biljetten midden in de dienst bijgevuld; eigenaar voegt extra beginsaldo toe |
| Contant **uit** de lade | **Kas uit** | Leverancier contant betaald bij levering; kleine-kas-aankoop; geld naar de bank gebracht (afstorting) |

Neem nooit geld uit de lade om het "gewoon te onthouden" — leg de mutatie vast, anders telt uw lade bij het sluiten een tekort.

**Stappen:**

1. Tik in de bovenbalk op de knop **💵 Kas**. Deze is alleen zichtbaar terwijl uw kassasessie open is.
2. Het venster **Kas in / uit** opent. Kies **↓ Kas in** of **↑ Kas uit**.
3. Voer het **bedrag** in SRD in (bijv. `100.00`).
4. Typ een korte **reden** — verplicht. Voorbeelden: *"leverancier betaald"*, *"wisselgeld bijgevuld"*, *"afstorting bank"*. De knop **Vastleggen** blijft uitgeschakeld totdat u dit invult.
5. Tik op **Vastleggen**. Het venster bevestigt **"Kasmutatie vastgelegd"** en toont het **nieuwe verwachte bedrag** in de lade.

**Wat het verandert:**

- De mutatie wordt opgeslagen op uw kassasessie en weggeschreven naar het auditspoor (event `register.cash_movement`) met uw naam, het bedrag en de reden.
- Het **verwachte contant** bij uw afsluiting (§3.3) past zich automatisch aan:

  > **Verwacht contant** = beginsaldo **+** contant uit verkopen (inclusief het contante deel van gemengde betalingen, minus gegeven wisselgeld) **−** contante terugbetalingen en retouren **+** kas-in **−** kas-uit

- Het afsluitoverzicht toont uw mutaties als aparte regel, zodat u en de manager precies zien waarom er meer of minder in de lade zit dan verkopen alleen zouden verklaren.

> **Wie mag dit vastleggen:** u (de kassier op de open sessie) of een manager. Leg de mutatie vast op het moment dat het geld beweegt — niet uit het geheugen aan het einde van de dienst.

---

## 3.3 Uw kassa sluiten (einde van de dienst)

Wanneer u klaar bent met verkopen voor de dag (of uw dienst), sluit de kassa zodat de volgende kassier (of het einde-dag Z-Rapport) een schoon bedrag heeft om af te stemmen.

**Stappen:**

1. Tik in de bovenbalk op de rode knop **Kassa sluiten**.
2. De modal **Kassa sluiten** opent. Deze heeft 4 stappen die achter elkaar worden getoond.

### Stap 1 — Sessierapport

Toont wat het systeem denkt dat er deze dienst is gebeurd:

| Veld | Wat het betekent |
|-------|--------------|
| Aantal verkopen | Aantal voltooide verkopen |
| Contante verkopen | SRD-bedrag contant betaald |
| Pin-verkopen | SRD-bedrag met pin betaald |
| Totaal BTW | Geheven belasting |
| Beginsaldo | Waarmee u bent begonnen |
| **Verwacht contant** | Beginsaldo + contante verkopen − contante terugbetalingen + kas-in − kas-uit (§3.2a) — dit zou in de lade moeten zitten |

Tik op **Volgende** om het contante geld te tellen.

### Stap 2 — Tel het contante geld

Open de lade en tel elk bankbiljet en muntstuk fysiek.

1. Voer het **werkelijk getelde contant** in het invoerveld in.
2. Als het bedrag afwijkt van het verwachte contant, toont het systeem het **verschil** in rood eronder (bijv. *"SRD 5.00 tekort"* of *"SRD 5.00 overschot"*).
3. **Als er een verschil is, moet u een reden typen in het notitieveld** — bijvoorbeeld *"telfout"* of *"klant kreeg te veel wisselgeld"*. De knop **Controleren en sluiten** blijft uitgeschakeld totdat u dit invult. (Als de telling exact klopt, is de notitie optioneel.)
4. Tik op **Controleren en sluiten** om door te gaan.

> **Het systeem blokkeert u nooit op basis van de omvang van het verschil.** Het registreert het verschil (en uw notitie) voor de manager en het auditlogboek. Kleine verschillen komen voor en zijn normaal — geef gewoon de reden op.

### Stap 3 — Sluiten bevestigen

Bekijk het overzicht. Dit is uw laatste kans om terug te gaan. Tik op **Kassa sluiten** om af te ronden.

### Stap 4 — Bevestiging gesloten

De sessie is nu gesloten. Het scherm toont:
- **Kassa gesloten** ✓ — bevestiging.
- **Definitief getelde contant** en **verschil** indien aanwezig.
- Een knop **Heropenen aanvragen** (zie 3.4) voor het geval u beseft dat er iets mis was.
- Een knop **Venster sluiten** — sluit de modal en logt u uit.

Zodra u op Sluiten tikt, wordt u teruggebracht naar het inlogscherm. De volgende kassier kan inloggen en zijn/haar eigen sessie openen.

---

## 3.4 Heropenen aanvragen (als u te vroeg heeft afgesloten)

Soms sluit u de kassa en realiseert u zich vervolgens dat u een verkoop heeft gemist, verkeerd heeft geteld of moet terugbetalen. U kunt een heropening aanvragen — maar **een manager moet die goedkeuren** voordat de kassa nieuwe transacties accepteert.

**Stappen:**

1. Nadat u heeft afgesloten, heeft het bevestigingsscherm een knop **Heropenen aanvragen**. Tik erop.
2. Voer een duidelijke reden in het Nederlands of Engels in (bijv. *"Klant kwam terug voor retour"*, *"Telfout, kassa niet juist gesloten"*).
3. Tik op **Verzoek versturen**.
4. U ziet **Verzoek ingediend**.

Nu ziet de manager een openstaand verzoek in het Dashboard → scherm **Kassa's** met een oranje banner. Zodra hij/zij goedkeurt, logt u opnieuw in, kiest dezelfde kassa, en de sessie wordt hervat (geen noodzaak om het beginsaldo opnieuw in te voeren).

> **Belangrijk:** als u de app sluit of uitlogt voordat de manager goedkeurt, is dat geen probleem — wanneer u weer inlogt, leidt het systeem u rechtstreeks naar de heropende sessie.

---

## 3.5 Wat te doen als de kassa vastzit

| Symptoom | Oplossing |
|---------|-----|
| Kan geen kassa kiezen — allemaal "in gebruik" | Een andere sessie staat nog open. Vraag de vorige kassier af te sluiten, of laat een manager dat namens hem/haar doen in Dashboard → Kassa's. |
| Vastgelopen op Open Kassa-scherm, geen kassa's vermeld | Er zijn nog geen kassa's voor uw vestiging. Vraag de manager om er een aan te maken in Dashboard → Kassa's → Beheer. |
| Verschil is groot (>SRD 50) | Sluit nog niet. Tel opnieuw. Als het nog steeds niet klopt, bel de manager — er kan een gemiste annulering of terugbetaling zijn. |
| Per ongeluk afgesloten met niet-gesynchroniseerde verkopen | Verkopen worden lokaal opgeslagen en synchroniseren bij heropening of via het Z-Rapport. Geen gegevens verloren. |

---

## 3.6 Snelle referentie — dagelijkse werkstroom

```
OCHTEND
  Inloggen → Vestiging kiezen → Kassa kiezen → Beginsaldo invoeren (bijv. 200.00)
                                                                    │
                                                                    ▼
DIENST                                                  POS-scherm — verkoop de hele dag
                                                                    │
                                                                    ▼
EINDE DIENST
  Bovenbalk → Kassa sluiten → Sessierapport → Tel contant → Bevestig → Gesloten ✓
                                                                    │
                                                       (Optioneel)  │
                                                                    ▼
  Heropenen aanvragen → Manager keurt goed → Doorgaan
```

Het vestigingsbrede **Einde dag / Z-Rapport** (Hoofdstuk 10) is een aparte manageronly-stap die loopt nadat **alle** kassiers hun kassa's hebben gesloten. Verwar de twee niet — uw kassa sluiten ≠ de dag sluiten.

---

## "Gisteren is nog niet afgesloten" — het ochtendscherm

Als een kassa van gisteren open bleef, laat de kassa vandaag pas beginnen als
dat is opgelost — u ziet dan een **"Gisteren is nog niet afgesloten"**-scherm.
Dat is normaal en snel op te lossen:

- **Bent u manager?** Tel daar de la van gisteren, voeg een toelichting toe
  als het bedrag afwijkt van verwacht, en druk op **Gisteren afsluiten** —
  daarna opent de kassa van vandaag. Was de kassa ’s nachts automatisch
  afgesloten, dan ziet u in plaats daarvan een **tel-de-la**-stap (zelfde
  idee, er was nog niet geteld).
- **Bent u kassier?** Alleen een manager kan afsluiten. Het scherm toont een
  **Bel [manager]**-knop (en WhatsApp) als de vestiging die heeft ingesteld —
  tik erop, vraag de manager om gisteren af te sluiten, en druk op
  **Vernieuwen**.

U ziet ook een kleine oranje strook na de **sluitingstijd** van de vestiging
als uw kassa nog open staat — een herinnering om af te sluiten vóór u
weggaat, zodat morgenochtend schoon is. Er verschijnt ook een regel als de
totalen van gisteren nog niet bij het hoofdkantoor zijn; een manager kan
opnieuw proberen, maar het wordt ook vanzelf opnieuw geprobeerd.

---

→ Volgende: [Hoofdstuk 4 — Een verkoop maken](04-making-a-sale.md)

::: tip Ploegwissel zonder beheerder?
Als uw winkel dit heeft ingeschakeld, is een kassa die vandaag **Gesloten**
toont gewoon te openen: selecteer hem, vul **uw eigen** wisselgeld in en
begin uw dienst — de telling van de vorige caissière blijft verzegeld.
Staat er *vraag beheerder*, dan gebruikt uw winkel het strikte model en
start de beheerder de volgende ploeg.
:::

::: tip Geblokkeerd scherm? Twee uitgangen werken altijd
Is het kassascherm geblokkeerd (gisteren niet afgesloten, of uw kassa is
in gebruik), dan heeft u altijd: **→ Doorgaan op een andere kassa** (als
er een andere kassa vrij is — één vastzittende la legt nooit de hele
winkel stil) en **⎋ Uitloggen** (rechtsboven), om te wisselen van
gebruiker of weg te lopen.
:::
