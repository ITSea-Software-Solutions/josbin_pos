# Architectuurplan — Josbin POS opsplitsen in drie knooppunten

::: warning Dit beschrijft waar we naartoe gaan, niet wat er vandaag draait.
Alles in dit onderdeel is een **plan**. Het opgeleverde product is nog één
installatie, beschreven in de [ontwikkelaarsdocs](/nl/docs/) en de handleidingen.
Niets hiervan is ergens geïnstalleerd.
:::

Josbin POS draait vandaag als één systeem: één codebase, één database, elke rol in
dezelfde installatie. Dat was de juiste vorm om het te bouwen en de verkeerde vorm
om het te verkopen — de backofficepc van een winkel hoort onze licentieserver niet
te dragen, en gegevens van de Belastingdienst horen geen database te delen met
commerciële klanten.

Dit onderdeel is het plan om het op te splitsen in **drie onafhankelijke
knooppunten**:

| Knooppunt | Waar het staat | Wat het doet |
|---|---|---|
| 🏪 **Winkel** | Op de pc van de winkel | Verkoopt. Bezit kassa's, assortiment, verkopen, klanten en eigen gebruikers. Werkt onbeperkt zonder internet. |
| ☁️ **Beheer** | Wij hosten dit | Organisaties, licenties, de vloot, het geconsolideerde beeld. Bewaart de ondertekensleutel van de licentie. |
| 🏛 **Belasting** | Aparte installatie, op verzoek door ons gehost | Alleen BTW-aangiften, eigen database. Bevat nooit commerciële gegevens. |

## De drie hoofdstukken

**[19. Drie knooppunten](/nl/migration-architecture-plan/19-three-node-architecture)** — de doelvorm en
het contract tussen de knooppunten. Wat elk knooppunt bezit, de vier verbindingen
ertussen, en hoe een licentie volledig zonder netwerk gecontroleerd wordt. Lees
dit eerst; dit is het ontwerp.

**[20. Bouwplan opsplitsing](/nl/migration-architecture-plan/20-split-build-plan)** — hoe we daar komen
zonder iets te verliezen. De vrieslijst van wat moet blijven werken, de negen
kritieke trajecten (waarvan vijf helemaal niet mogen veranderen), de zeven stappen
en de poort bij elke stap.

**[21. Migratieregister](/nl/migration-architecture-plan/21-migration-record)** — wat er werkelijk is
besloten en waarom. Zes beslissingen met de onderbouwing erbij, twee
grensdiagrammen, en de bestemming van **alle 220 gecatalogiseerde functies**:
welke naar de winkel gaan, welke in onze cloud blijven, waarvan elk knooppunt een
eigen exemplaar nodig heeft — en de 70 die **over twee knooppunten splitsen**,
waar gedrag verdwijnt omdat elke kant aanneemt dat de andere het heeft behouden.

## Waar we staan

Er is nog niets gebouwd. Stap 1 tot en met 3 van hoofdstuk 20 zijn zuivere
herstructurering en kunnen beginnen; stap 4 tot en met 7 hangen af van de
beslissingen die nu in hoofdstuk 21 staan.

Eén ding blokkeert stap 1: de poort is *"de volledige suite groen, geen test
aangepast"*, en er is nu nergens waar dat kan draaien. Zie
[§21.6](/nl/migration-architecture-plan/21-migration-record).

## Wat er met dit onderdeel gebeurt

Het verdwijnt. Zodra de opsplitsing klaar is en de drie knooppunten zijn wat we
leveren, is dit plan geen plan meer — de doelarchitectuur wordt dan de
architectuur, en verhuist naar de ontwikkelaarsdocs zelf. Dit onderdeel bestaat om
afgemaakt en verwijderd te worden, niet om eeuwig onderhouden te worden.

Tot die tijd: **de ontwikkelaarsdocs beschrijven wat draait, dit onderdeel
beschrijft wat we bouwen.** Spreken die twee elkaar tegen, dan hebben de
ontwikkelaarsdocs gelijk over vandaag.
