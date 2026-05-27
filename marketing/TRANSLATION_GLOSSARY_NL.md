# Translation Glossary — English → Surinamese Dutch (NL-SR)

Use these exact terms across every translated chapter. Consistency matters more than literary nuance. When a UI button has a Dutch label baked into the app (visible in screenshots), the manual must use that exact label — viewers are looking at the screen, not a dictionary.

## Surinamese context

- The Dutch we write for these docs is **standard Dutch as understood in Suriname** — closer to NL Dutch than Belgian Dutch, but with some local conventions noted below.
- Government / legal / tax terms stay in their Surinamese form (Belastingdienst Suriname, Rekenkamer, BTW, WBP-S).
- Currency stays `SRD` everywhere — never write "Surinaamse dollar" except on first mention in a paragraph that needs to clarify.
- Decimal separator: comma (`SRD 47,50`, not `47.50`). Thousands separator: period (`SRD 1.200`). Note: the *app* still displays `SRD 47.50` because of i18n format — when quoting a UI number in the manual, match what the screen actually shows, even if it's American-style.

## Core POS vocabulary

| English | Dutch | Notes |
|---|---|---|
| Login | Inloggen | Verb form. Noun: "het inloggen" |
| Password | Wachtwoord | |
| Logout / Log out | Uitloggen | |
| Username | Gebruikersnaam | |
| Email | E-mail | |
| User | Gebruiker | |
| Role | Rol | |
| Permission | Rechten / Toestemming | "Rechten" for the noun in admin contexts |
| Settings | Instellingen | |
| Save | Opslaan | |
| Cancel | Annuleren | |
| Edit | Bewerken | |
| Delete | Verwijderen | |
| Search | Zoeken | |
| Filter | Filter / Filteren (verb) | |
| Export | Exporteren | |
| Import | Importeren | |
| Print | Afdrukken | |
| View | Bekijken | |
| Submit | Indienen | "Insturen" only for casual contexts |
| Approve | Goedkeuren | |
| Reject | Afwijzen | |
| Confirm | Bevestigen | |
| Accept | Accepteren | |
| Dispute | Betwisten | Used for BTW filings the inspector contests |
| Resubmit | Opnieuw indienen | |
| Pending | In afwachting / Openstaand | "Openstaand" for queues, "In afwachting" for status |
| Awaiting confirmation | Wacht op bevestiging | |
| Confirmed | Bevestigd | |
| Today | Vandaag | |
| Yesterday | Gisteren | |
| Daily | Dagelijks | |
| Monthly | Maandelijks | |

## Sale-flow vocabulary

| English | Dutch | Notes |
|---|---|---|
| Sale | Verkoop | Plural: Verkopen |
| Cart | Winkelwagen | UI uses "Winkelwagen" |
| Line item | Regel / Regelitem | |
| Quantity | Aantal | |
| Price | Prijs | |
| Total | Totaal | |
| Subtotal | Subtotaal | |
| Receipt | Bon | "Kassabon" for the printed receipt; "Bon" suffices in running prose |
| Checkout | Afrekenen | UI label |
| Complete (the sale) | Voltooien | UI label |
| Cash | Contant | UI label (never "Cash" in NL UI) |
| Card / PIN | Pin / Pinpas | "Pin" is the UI label; "Pinpas" for the physical card |
| Mixed payment | Gemengde betaling / Gemengd | UI uses "Gemengd" |
| Bank transfer | Bankoverschrijving / Overschrijving | UI: "Overschrijving" |
| Mobile transfer / Mobile wallet | Mobiele overschrijving / Mobiel bankieren | UI: "Mobiel bankieren" |
| Foreign cash | Vreemde valuta | UI: "Vreemde valuta" |
| QR payment | QR-betaling | |
| Cash drawer | Kassalade | |
| Change (money back) | Wisselgeld | |
| Discount | Korting | |
| Item-level discount | Korting per regel | |
| Sale-level discount | Korting op totaal | |
| Refund | Terugbetaling | |
| Void | Annulering | (cancellation of a completed sale) |
| Hold bill | Bon vasthouden / Vastgehouden bon | |
| Open bill | Openstaande bon | |
| Customer | Klant | |
| Walk-in customer | Loopklant | |

## Register / End-of-day

| English | Dutch | Notes |
|---|---|---|
| Register / Till | Kassa | |
| Register session | Kassasessie | |
| Opening float | Beginsaldo / Openingsbedrag | "Beginsaldo" preferred |
| Closing cash count | Eindafrekening / Slottelling | UI varies — match the screen |
| Discrepancy | Verschil / Kasverschil | "Kasverschil" for cash specifically |
| End of day | Einde dag | |
| X-Report | X-Rapport | Mid-day snapshot, no close |
| Z-Report | Z-Rapport | End-of-day close |
| Reopen (a register session) | Heropenen | |
| Force-close | Geforceerd sluiten | |

## BTW / Tax / Filings

| English | Dutch | Notes |
|---|---|---|
| BTW | BTW | Same letters, never "VAT" in NL prose |
| BTW-exempt | BTW-vrij / BTW-vrijgesteld | "BTW-vrij" for badges/labels; "BTW-vrijgesteld" in prose |
| BTW rate | BTW-tarief | |
| Submission / Filing | Aangifte | Plural: Aangiftes / Aangiften |
| Tax inspector | Belastinginspecteur | |
| Belastingdienst Suriname | Belastingdienst Suriname | Kept as-is — proper noun |
| Rekenkamer (van Suriname) | Rekenkamer | Kept as-is — proper noun |
| Audit | Audit | English borrowing standard in NL business prose |
| Audit log | Auditlogboek | |
| Tamper-evident | Manipulatiebestendig | |
| Hash chain | Hash-keten | |
| Snapshot | Snapshot / Momentopname | "Snapshot" common in IT contexts |

## Org / Store / User hierarchy

| English | Dutch | Notes |
|---|---|---|
| Organisation | Organisatie | |
| Store / Outlet / Branch | Vestiging | Surinamese supermarkets call branches "vestiging" — UI label |
| HQ / Head office | Hoofdkantoor | |
| Manager | Manager | Or "Vestigingsmanager" when explicit |
| Cashier | Kassier | Plural: Kassiers (or Kassamedewerkers in more formal copy) |
| Org Admin / Organisation Admin | Organisatiebeheerder | Abbreviation: OA stays as OA |
| Super Admin | Super Admin | Stays English even in Dutch UI; the role name is the brand |
| Auditor | Auditor | |
| API Integration | API-integratie | The role/account type |
| Tax Inspector | Belastinginspecteur | Role |

## Catalogue / Stock

| English | Dutch | Notes |
|---|---|---|
| Catalogue | Catalogus | |
| Category | Categorie | |
| Product | Product | |
| Barcode | Barcode / Streepjescode | "Barcode" common in retail |
| Stock | Voorraad | |
| Stock movement | Voorraadmutatie | |
| Stock adjustment | Voorraadcorrectie | |
| Low stock | Lage voorraad | |
| Out of stock | Niet op voorraad | |
| Reorder | Bijbestellen | |
| Bulk import | Bulkimport / Massaal importeren | "Bulkimport" common |
| Per-store override | Vestigingsspecifieke prijs | (for the "override price per store" feature) |

## Reports / Sync / Money

| English | Dutch | Notes |
|---|---|---|
| Report | Rapport | |
| Daily report | Dagrapport | |
| Monthly report | Maandrapport | |
| Custom range | Aangepast bereik | |
| Top products | Top producten | |
| Consolidated report | Geconsolideerd rapport | UI: "Geconsolideerd" |
| Rekenkamer export | Rekenkamer-export | |
| Exchange rate | Wisselkoers | |
| Daily rate (the locked one) | Dagkoers | UI label |
| Sync / Syncing | Synchronisatie / Synchroniseren | |
| Offline mode | Offlinemodus | |
| Queue (sync queue) | Wachtrij | |

## Licensing / Security / Account

| English | Dutch | Notes |
|---|---|---|
| License | Licentie | |
| License tier | Licentieniveau | |
| Expiry date | Vervaldatum | |
| Renew / Renewal | Vernieuwen / Verlenging | |
| Grace period | Aflooptermijn / Respijttermijn | |
| Hard lock | Volledige vergrendeling | |
| Soft lock | Gedeeltelijke vergrendeling | |
| Two-factor auth / 2FA | Tweestapsverificatie / 2FA | Both used |
| Active sessions | Actieve apparaten | UI label — note: "apparaten" not "sessies" |
| Profile & password | Profiel & wachtwoord | UI label |
| My activity | Mijn activiteit | UI label |
| My performance | Mijn prestaties | UI label |
| My shifts | Mijn diensten | UI label |

## Phrases / clichés to avoid awkward direct translation

| English | Better Dutch |
|---|---|
| "Click the button" | "Klik op de knop" (not "Klik de knop") |
| "Open the dropdown" | "Open het keuzemenu" (or just "het dropdown" in IT contexts) |
| "Best practice" | "Beste werkwijze" / "goede praktijk" (depending on tone) |
| "End-to-end" | "End-to-end" stays English in tech contexts; "van begin tot eind" in prose |
| "Workflow" | "Werkstroom" or just "workflow" — both are normal |
| "Walk-through" | "Stappenplan" or "doorloop" |
| "On the fly" | "Direct" / "ter plekke" |
| "Out of the box" | "Standaard" / "uit de doos" |

## Style rules

- **Address the reader as "u"** in formal contexts (manuals, government chapters, BTW), **"je" in casual** contexts (cashier daily training, cheat sheets). Pick one per chapter and stick with it.
- **Imperatives are fine.** "Klik op Afrekenen. Type het bedrag in." reads natural — don't pad with "U kunt nu op Afrekenen klikken."
- **Don't translate brand / product names.** "Josbin POS" stays. "Belastingdienst" stays.
- **Quoted UI labels stay in Dutch** (no English fallback needed since the audience reading the Dutch doc has the Dutch UI). Exception: if the original English chapter quotes both NL and EN — *"Click **Afrekenen** (English: Checkout)"* — the Dutch translation drops the English-fallback parenthetical entirely. Reads cleaner.
- **Code blocks, file paths, JSON keys, terminal commands stay verbatim** — never translate `git commit`, `php artisan migrate`, `POST /api/sales`, table column names like `total_srd`.
- **Image captions: translate.** The `![Caption](path/to.png)` caption text becomes Dutch; the path stays.
- **Cross-reference links to other chapters: rewrite to the NL counterpart.** A link like `[Chapter 4](04-making-a-sale.md)` becomes `[Hoofdstuk 4](04-making-a-sale.md)` — the path is the *same* because both NL and EN versions of ch 4 sit at the same relative position in the `/nl/` mirror tree.
- **External link text: translate.** The URL stays.
- **`> Tip:` / `> Note:` blockquote callouts** become `> Tip:` / `> Let op:` / `> Belangrijk:` etc.

## Common Belastingdienst / Rekenkamer phrases to know

| English | Dutch |
|---|---|
| "BTW payable" | "BTW te betalen" |
| "BTW collected" | "BTW geheven" |
| "Tax period" | "Belastingtijdvak" |
| "Tax return / Filing" | "Aangifte" |
| "Tax authority" | "Belastingdienst" |
| "Audit trail" | "Auditspoor" |
| "Court of Audit" | "Rekenkamer" |
| "Discount-then-tax order" | "Korting-voor-belasting-volgorde" |
| "Tamper detection" | "Manipulatiedetectie" |

## When in doubt

- Match what's on the actual screen. The cashier reading the manual is looking at the screen — manual and screen must agree.
- If a Dutch word doesn't roll off the tongue, ask: would a Surinamese accountant write it that way? Suriname's business Dutch leans practical, not academic.
- Don't invent terminology. If a term isn't in this glossary, either use the most common Dutch IT-business term, or keep the English and italicise it.
