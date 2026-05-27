# Josbin POS — Dashboard-handleiding

**Versie 1.0 | Mei 2026**

Deze handleiding is voor **gebruikers op het hoofdkantoor** van Josbin POS — de mensen die met het Super Admin Dashboard werken op `http://<uw-server>:5174`. Doorgaans zijn dat:

- Het **hoofdkantoor** van een supermarktketen
- De **winkeleigenaar** van een eenmanszaak
- De **systeembeheerder** van een overheidsinstelling
- De **auditor van de Belastingdienst** die een compliancecontrole uitvoert

Technische kennis is niet nodig. Het dashboard doet het zware werk; deze handleiding legt uit waar u op klikt en waarom.

> **Niet de juiste handleiding?** Kassiers en winkelmedewerkers raadplegen in plaats daarvan de [POS-handleiding](../user_manual/).

---

## Hoe u deze handleiding gebruikt

Elk hoofdstuk behandelt één onderdeel van het dashboard. Lees 1 → 18 als u nieuw bent met Josbin POS; of spring direct naar het hoofdstuk dat u nodig hebt.

| # | Hoofdstuk | Voor wie |
|---|-----------|----------|
| 1 | [Rollen en rechten — wie mag wat](01-roles-and-permissions.md) | Iedereen die gebruikers aanmaakt |
| 2 | [Organisatie en vestiging opzetten](02-organisation-and-store-setup.md) | Super Admin, OA |
| 3 | [Gebruikers — aanmaken, bewerken, deactiveren](03-users.md) | OA, vestigingsmanager |
| 4 | [Productcatalogus en categorieën](04-catalogue-and-categories.md) | OA, vestigingsmanager |
| 5 | [Bulkimport (CSV / Excel)](05-bulk-import-csv-excel.md) | OA |
| 6 | [Prijzen en vestigingsspecifieke overschrijvingen](06-pricing-and-per-store-overrides.md) | OA |
| 7 | [Kortingsregels](07-discount-rules.md) | OA, vestigingsmanager |
| 8 | [Voorraadbeheer](08-stock-management.md) | OA, vestigingsmanager |
| 9 | [Klanten](09-customers.md) | OA, vestigingsmanager |
| **10** | **[Rapporten — dagelijks, maandelijks, BTW, Rekenkamer](10-reports.md)** | **Iedereen behalve kassier** |
| **11** | **[Z-Rapporten en einde-dag-synchronisatie](11-z-reports-and-end-of-day-sync.md)** | **Vestigingsmanager + OA** |
| 12 | [API-integraties en webhooks](12-api-integrations-and-webhooks.md) | OA |
| 13 | [Auditlogboek](13-audit-log.md) | OA, auditor |
| 14 | [AI-inzichten](14-ai-insights.md) | OA, vestigingsmanager |
| 15 | [Licentiebeheer — UI-overzicht](15-license-management.md) | Super Admin |
| **16** | **[Licentie-operatie — verkoop, installatie, vernieuwing, herstel](16-license-operations.md)** | **Leverancier (u) + IT-contactpersoon van de klant** |
| 17 | [Beveiligingsbeleid (2FA per rol)](17-security-policy.md) | Super Admin |
| 18 | [Mijn Account — uw profiel, wachtwoord, prestaties](18-my-account.md) | Iedereen |
| 19 | [Kassabeheer / Registers — fysieke kassa's, sessies, heropenflow](19-registers.md) | Manager+ |
| 20 | [BTW-aangiftes — formele aangiftes aan Belastingdienst Suriname](20-btw-submissions-belastingdienst.md) | OA, SM, Inspecteur, SA |
| 21 | [Belastinginspecteur-rol — Belastingdienst cross-org toegang](21-tax-inspector.md) | SA (aanmaken), Inspecteur (gebruiken) |

Alle hoofdstukken zijn nu geschreven.

---

## Snelreferentie — wie logt waar in

| U bent… | Waar u inlogt | Wat u kunt |
|---|---|---|
| **Kassier** | POS-app op de kassa (`http://localhost:5173` in dev) | Verkopen, betaling aannemen, bonnen vasthouden, eigen prestaties bekijken in Mijn Account |
| **Vestigingsmanager** | Dashboard (`http://localhost:5174`) | Vestiging runnen, terugbetalingen goedkeuren, kassa's sluiten, rapporten draaien |
| **OA** | Dashboard | Vestigingen, catalogus, gebruikers beheren; bulkimport; catalogus pushen naar alle POS-terminals |
| **Super Admin** | Dashboard | Alle organisaties en licenties beheren (alleen leverancier) |
| **Auditor** | Dashboard | Alleen-lezen toegang tot verkopen, BTW, auditlogboek |
| **API-integratie** | Machine-naar-machine, geen UI | Externe POS pusht verkopen via `/api/v1/*` |

---

## Belangrijke termen

| Term | Betekenis |
|------|-----------|
| **Organisatie** | Eén klant van Josbin POS — bijvoorbeeld *Supermarkt De Hoop NV*. Bezit één of meer vestigingen en een hoofdcatalogus. |
| **Vestiging** | Eén fysieke winkel / filiaal onder een organisatie. Heeft eigen kassa('s), kassalade(s), voorraadtelling. |
| **Kassa** | Eén fysieke kassapositie in een vestiging — één terminal + lade + printer. Een vestiging kan er meerdere hebben. |
| **Catalogus** | De hoofdlijst van producten die een organisatie verkoopt. Centraal beheerd door het hoofdkantoor. |
| **BTW** | Suriname VAT (momenteel 10%). |
| **SRD** | Surinaamse dollar — alle prijzen, totalen, rapporten. |
| **Z-Rapport** | Einde-dag vestigingsafsluiting. Vergrendelt de verkopen van de dag, synchroniseert naar hoofdkantoor. |
| **Rekenkamer** | Rekenkamer van Suriname — ondertekende PDF-export van volledige transactiegeschiedenis voor compliance. |

---

## Hulp nodig?

Neem contact op met uw Josbin POS-ondersteuningscontact. Voor technische problemen die een ontwikkelaar nodig hebben, zie de [Ontwikkelaarsdocumentatie](../docs/).
