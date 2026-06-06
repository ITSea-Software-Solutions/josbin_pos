/**
 * In-app help content for the Super Admin / management Dashboard.
 *
 * Short, task-focused steps shown in the Help drawer (the ? button in the
 * header). Long-form lives in the hosted Dashboard Manual, deep-linked via
 * `guide`. Bilingual (nl/en). Keyed by the dashboard screen id so the header
 * Help button shows help for the screen you're on.
 */
export interface HelpTopic {
  guide: string
  nl: { title: string; intro?: string; steps: string[] }
  en: { title: string; intro?: string; steps: string[] }
}

export const DASH_HELP: Record<string, HelpTopic> = {
  overview: {
    guide: 'dashboard_manual/',
    en: { title: 'Live overview', intro: 'Your real-time pulse across every store.', steps: [
      'Each card is a store: today’s revenue, transactions, avg basket, BTW, online/offline, sync status.',
      'Click a store to drill into its full detail and recent sales.',
      'Figures update live as sales come in.',
    ] },
    nl: { title: 'Live overzicht', intro: 'Realtime beeld van al je vestigingen.', steps: [
      'Elke kaart is een vestiging: omzet vandaag, transacties, gem. bon, BTW, online/offline, sync-status.',
      'Klik op een vestiging voor het volledige detail en recente verkopen.',
      'Cijfers werken live bij naarmate verkopen binnenkomen.',
    ] },
  },

  organisations: {
    guide: 'dashboard_manual/02-organisation-and-store-setup',
    en: { title: 'Organisations & stores', intro: 'An organisation is one customer; a store is one location under it.', steps: [
      'New organisation: name, type (retail/govt/wholesale), BTW number, language, default BTW%.',
      'Open an organisation to add its store(s): address, city, receipt header/footer.',
      'Use “Push catalogue” to send catalogue updates to all the org’s tills in seconds.',
      'Deactivate stops all that org’s logins and sales (a styled confirm tells you the impact).',
    ] },
    nl: { title: 'Organisaties & vestigingen', intro: 'Een organisatie is één klant; een vestiging is één locatie eronder.', steps: [
      'Nieuwe organisatie: naam, type (retail/overheid/groothandel), BTW-nummer, taal, standaard BTW%.',
      'Open een organisatie om vestiging(en) toe te voegen: adres, stad, bonkop/-voet.',
      '“Catalogus pushen” stuurt catalogusupdates in seconden naar alle kassa’s van de org.',
      'Deactiveren stopt alle logins en verkopen van die org (een bevestiging toont de impact).',
    ] },
  },

  stores: {
    guide: 'dashboard_manual/02-organisation-and-store-setup',
    en: { title: 'Stores', steps: [
      'Each store belongs to one organisation and has its own register(s) and stock.',
      'Edit address, city and the receipt header/footer/logo per store.',
      'Optional per-store price overrides handle higher-cost regions (e.g. Nickerie).',
    ] },
    nl: { title: 'Vestigingen', steps: [
      'Elke vestiging hoort bij één organisatie en heeft eigen kassa(s) en voorraad.',
      'Bewerk adres, stad en de bonkop/-voet/logo per vestiging.',
      'Optionele prijsoverrides per vestiging vangen duurdere regio’s op (bijv. Nickerie).',
    ] },
  },

  users: {
    guide: 'dashboard_manual/03-users',
    en: { title: 'Users & roles', intro: 'Six roles, least-privilege by default.', steps: [
      'New user: name, e-mail, role, language. Cashiers & Store Managers are tied to ONE store.',
      'Roles: Super Admin · Org Admin · Store Manager · Cashier · Auditor (read-only) · Tax Inspector.',
      'Enforce 2FA per role; government accounts always require it.',
      'Deactivate to revoke access instantly across all devices.',
    ] },
    nl: { title: 'Gebruikers & rollen', intro: 'Zes rollen, standaard minimale rechten.', steps: [
      'Nieuwe gebruiker: naam, e-mail, rol, taal. Kassiers & Vestigingsmanagers horen bij ÉÉN vestiging.',
      'Rollen: Super Admin · Org Admin · Vestigingsmanager · Kassier · Auditor (alleen-lezen) · Belastinginspecteur.',
      'Forceer 2FA per rol; overheidsaccounts vereisen het altijd.',
      'Deactiveer om toegang direct op alle apparaten in te trekken.',
    ] },
  },

  licenses: {
    guide: 'dashboard_manual/15-license-management',
    en: { title: 'Licences', intro: 'A licence is issued per installation and bound to the hardware.', steps: [
      'Each licence sets the store + terminal limits, tier and expiry date.',
      'Exceeding the terminal count shows “License limit reached” on new tills.',
      'Renewal warnings appear 30 and 14 days before expiry; data is never held hostage.',
      'On renewal, reactivation is instant — no reinstall.',
    ] },
    nl: { title: 'Licenties', intro: 'Een licentie wordt per installatie uitgegeven en aan de hardware gebonden.', steps: [
      'Elke licentie bepaalt de vestiging- + terminallimieten, tier en vervaldatum.',
      'Bij overschrijding van het terminalaantal verschijnt “Licentielimiet bereikt” op nieuwe kassa’s.',
      'Verlengwaarschuwingen verschijnen 30 en 14 dagen vóór verval; data wordt nooit gegijzeld.',
      'Bij verlenging is heractivatie direct — geen herinstallatie.',
    ] },
  },

  catalogue: {
    guide: 'dashboard_manual/04-catalogue-and-categories',
    en: { title: 'Product catalogue', intro: 'One master list per organisation, shared by all stores.', steps: [
      'Add a product: names (NL/EN), price, BTW% (or BTW-exempt for basics/medicine), category.',
      'Org Admins & Store Managers also set the cost price (used for profit reports).',
      'Bulk import from CSV or Excel; add variants (size/colour/flavour) when needed.',
      'Changes push live to every till.',
    ] },
    nl: { title: 'Productcatalogus', intro: 'Eén masterlijst per organisatie, gedeeld door alle vestigingen.', steps: [
      'Product toevoegen: namen (NL/EN), prijs, BTW% (of BTW-vrij voor basis/medicijnen), categorie.',
      'Org Admins & Vestigingsmanagers stellen ook de inkoopprijs in (voor winstrapporten).',
      'Bulk-import uit CSV of Excel; voeg varianten toe (maat/kleur/smaak) indien nodig.',
      'Wijzigingen worden live naar elke kassa gepusht.',
    ] },
  },

  'btw-submissions': {
    guide: 'dashboard_manual/20-btw-submissions-belastingdienst',
    en: { title: 'BTW filings (Belastingdienst)', intro: 'Generate and submit your VAT filing.', steps: [
      'New filing: pick a period (daily/monthly/custom). The system totals taxable vs exempt and BTW due.',
      'Each filing is hash-chained to your previous one — tamper-evident for the Belastingdienst.',
      'Review the figures (Belastingdienst format), export the PDF, then Submit.',
      'The Tax Inspector reviews and Accepts or Disputes; if disputed, correct & supersede (refile).',
    ] },
    nl: { title: 'BTW-aangiften (Belastingdienst)', intro: 'Genereer en verstuur je BTW-aangifte.', steps: [
      'Nieuwe aangifte: kies een periode (dag/maand/aangepast). Het systeem telt belast vs vrijgesteld en verschuldigde BTW.',
      'Elke aangifte is via een hash-keten gekoppeld aan de vorige — manipulatiebestendig voor de Belastingdienst.',
      'Controleer de cijfers (Belastingdienst-formaat), exporteer de PDF en verstuur.',
      'De inspecteur beoordeelt en Accepteert of Betwist; bij betwisting: corrigeer & vervang (opnieuw indienen).',
    ] },
  },

  'tax-dashboard': {
    guide: 'dashboard_manual/21-tax-inspector',
    en: { title: 'Tax Inspector dashboard', steps: [
      'Cross-organisation, read-only view of all submitted BTW filings (2FA required).',
      'Filter by organisation, period and status; open a filing for the per-store source breakdown.',
      'Accept a correct filing, or Dispute with a note explaining the issue.',
    ] },
    nl: { title: 'Inspecteur-dashboard', steps: [
      'Organisatie-overschrijdend, alleen-lezen overzicht van alle ingediende BTW-aangiften (2FA vereist).',
      'Filter op organisatie, periode en status; open een aangifte voor de bronuitsplitsing per vestiging.',
      'Accepteer een correcte aangifte, of Betwist met een notitie die het probleem uitlegt.',
    ] },
  },

  reports: {
    guide: 'dashboard_manual/10-reports',
    en: { title: 'Reports', steps: [
      'Consolidated, BTW and Profit & margin reports across the whole organisation.',
      'Use the store filter to drill into one branch or view all stores together.',
      'Export to PDF/CSV; all day-boundaries use Suriname time (AST).',
    ] },
    nl: { title: 'Rapporten', steps: [
      'Geconsolideerde, BTW- en Winst & marge-rapporten over de hele organisatie.',
      'Gebruik het vestigingsfilter om in te zoomen op één vestiging of alles samen te zien.',
      'Exporteer naar PDF/CSV; alle daggrenzen gebruiken Surinaamse tijd (AST).',
    ] },
  },

  stock: {
    guide: 'dashboard_manual/08-stock-management',
    en: { title: 'Stock management', steps: [
      'Pick a store (or view the org-wide total) to see per-store stock.',
      'Adjust stock with a reason; the change is recorded in the movement history.',
      'Low-stock items are flagged so you can reorder in time.',
    ] },
    nl: { title: 'Voorraadbeheer', steps: [
      'Kies een vestiging (of bekijk het org-totaal) voor voorraad per vestiging.',
      'Pas voorraad aan met een reden; de wijziging wordt vastgelegd in de bewegingshistorie.',
      'Lage-voorraad-artikelen worden gemarkeerd zodat je op tijd kunt bijbestellen.',
    ] },
  },

  customers: {
    guide: 'dashboard_manual/09-customers',
    en: { title: 'Customers', steps: [
      'Search, view and edit customers. Personal data is encrypted (WBP-S).',
      'Org Admins can “Erase” a customer (right to be forgotten) — PII is redacted, totals kept.',
    ] },
    nl: { title: 'Klanten', steps: [
      'Zoek, bekijk en bewerk klanten. Persoonsgegevens zijn versleuteld (WBP-S).',
      'Org Admins kunnen een klant “Wissen” (recht op vergetelheid) — PII wordt geredigeerd, totalen blijven.',
    ] },
  },

  'z-reports': {
    guide: 'dashboard_manual/11-z-reports-and-end-of-day-sync',
    en: { title: 'Z-Reports & sync', steps: [
      'Cross-store end-of-day history with totals, BTW and sync status.',
      'Re-submit a failed sync, or import a USB export from an offline store.',
    ] },
    nl: { title: 'Z-rapporten & sync', steps: [
      'Vestiging-overschrijdende einde-dag-historie met totalen, BTW en sync-status.',
      'Dien een mislukte sync opnieuw in, of importeer een USB-export van een offline vestiging.',
    ] },
  },

  registers: {
    guide: 'dashboard_manual/19-registers',
    en: { title: 'Registers', steps: [
      'See each store’s registers and their open/closed status.',
      'Reopen a closed register for the next shift when needed.',
    ] },
    nl: { title: 'Kassa’s', steps: [
      'Bekijk de kassa’s van elke vestiging en hun open/gesloten status.',
      'Heropen indien nodig een gesloten kassa voor de volgende dienst.',
    ] },
  },

  'api-keys': {
    guide: 'dashboard_manual/12-api-integrations-and-webhooks',
    en: { title: 'API keys & webhooks', steps: [
      'Issue an API key so a third-party POS can push sales to Josbin.',
      'Configure webhook URL + events (sale.created, shift.closed, refund.issued).',
      'Rotate the webhook secret or revoke a key from here (both are confirmed).',
    ] },
    nl: { title: 'API-sleutels & webhooks', steps: [
      'Geef een API-sleutel uit zodat een externe kassa verkopen naar Josbin kan sturen.',
      'Configureer webhook-URL + events (sale.created, shift.closed, refund.issued).',
      'Roteer het webhook-geheim of trek een sleutel in vanaf hier (beide met bevestiging).',
    ] },
  },

  'audit-log': {
    guide: 'dashboard_manual/13-audit-log',
    en: { title: 'Audit log', steps: [
      'Append-only, tamper-evident record of every meaningful action.',
      'Filter by event, user or date; search within the changes.',
      'Feeds the signed Rekenkamer export.',
    ] },
    nl: { title: 'Auditlog', steps: [
      'Alleen-toevoegen, manipulatiebestendig logboek van elke betekenisvolle actie.',
      'Filter op gebeurtenis, gebruiker of datum; zoek binnen de wijzigingen.',
      'Voedt de ondertekende Rekenkamer-export.',
    ] },
  },
}
