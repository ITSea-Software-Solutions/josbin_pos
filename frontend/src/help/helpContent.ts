/**
 * In-app help content for the POS terminal.
 *
 * Short, task-focused "how do I…" steps shown in the Help drawer (the ? button
 * in the top bar). Keep these BRIEF — the long-form lives in the hosted manual,
 * which each topic deep-links to via `guide`. Bilingual (nl/en) to match the
 * per-user language switch.
 *
 * Keyed by the POS screen name so the top-bar Help button can show help for the
 * screen the cashier is currently on. `open-register` is used by the register
 * gate (not a top-bar screen).
 */
export interface HelpTopic {
  /** Path appended to the docs base URL for "Open full guide →". */
  guide: string
  nl: { title: string; intro?: string; steps: string[] }
  en: { title: string; intro?: string; steps: string[] }
}

export const POS_HELP: Record<string, HelpTopic> = {
  pos: {
    guide: 'user_manual/04-making-a-sale',
    en: {
      title: 'Selling — new order, payment & change',
      intro: 'Everything for ringing up a customer.',
      steps: [
        'Add products: tap them in the grid, scan a barcode, or use the search box.',
        'Adjust a line: tap it to change quantity, price, BTW or add a line discount.',
        'Whole-bill discount: use the discount control at the bottom of the cart.',
        'Optional: attach a customer (search, or “+ New” to add one on the spot).',
        'Press Pay (F9). Choose Cash, Card/PIN, Mixed, transfer, foreign cash or QR.',
        'For cash: type the amount received — the change is shown automatically.',
        'Print and/or e-mail the receipt, then New sale (F4) for the next customer.',
        'Not ready to charge? Hold the bill (F2) and load it back later.',
      ],
    },
    nl: {
      title: 'Verkopen — nieuwe bon, betaling & wisselgeld',
      intro: 'Alles om een klant af te rekenen.',
      steps: [
        'Producten toevoegen: tik in het raster, scan een streepjescode of gebruik de zoekbalk.',
        'Regel aanpassen: tik erop voor aantal, prijs, BTW of een regelkorting.',
        'Korting op de hele bon: gebruik de kortingsknop onderaan de winkelwagen.',
        'Optioneel: koppel een klant (zoeken, of “+ Nieuw” om er één toe te voegen).',
        'Druk op Afrekenen (F9). Kies Contant, Pin, Gemengd, overboeking, vreemd geld of QR.',
        'Bij contant: typ het ontvangen bedrag — het wisselgeld verschijnt automatisch.',
        'Druk de bon af en/of e-mail hem, daarna Nieuwe verkoop (F4) voor de volgende klant.',
        'Nog niet afrekenen? Bewaar de bon (F2) en laad hem later terug.',
      ],
    },
  },

  'open-register': {
    guide: 'user_manual/03-register',
    en: {
      title: 'Opening the register',
      steps: [
        'Pick your register (auto-selected if there is only one).',
        'Count the cash already in the drawer and enter it as the opening float.',
        'Confirm — the register opens and you can start selling.',
        'One open session per cashier; your sales are tied to it for the Z-Report.',
      ],
    },
    nl: {
      title: 'De kassa openen',
      steps: [
        'Kies je kassa (automatisch gekozen als er maar één is).',
        'Tel het geld dat al in de la zit en voer het in als beginbedrag (float).',
        'Bevestig — de kassa opent en je kunt beginnen met verkopen.',
        'Eén open sessie per kassier; je verkopen worden eraan gekoppeld voor de Z-rapportage.',
      ],
    },
  },

  'end-of-day': {
    guide: 'user_manual/10-end-of-day',
    en: {
      title: 'End of day — closing the register (Z-Report)',
      intro: 'Closing reconciles the cash and produces the formal day report.',
      steps: [
        'Open End of Day. Review the totals: sales, BTW, payment-method breakdown, top products.',
        'Count the cash drawer and type the counted amount.',
        'If it differs from “expected”, a note is required — explain the difference.',
        'Confirm to close the register and finalise the Z-Report.',
        'Print the Z-Report (or export PDF) for your Belastingdienst records.',
        'X-Report is a mid-day snapshot — it shows totals WITHOUT closing.',
        'Closing also triggers a sync of the day’s sales to Head Office.',
      ],
    },
    nl: {
      title: 'Einde dag — kassa sluiten (Z-rapport)',
      intro: 'Sluiten verrekent het contante geld en maakt het formele dagrapport.',
      steps: [
        'Open Einde dag. Controleer de totalen: omzet, BTW, betaalmethoden, topproducten.',
        'Tel de kassalade en typ het getelde bedrag.',
        'Wijkt het af van “verwacht”, dan is een notitie verplicht — leg het verschil uit.',
        'Bevestig om de kassa te sluiten en het Z-rapport af te ronden.',
        'Druk het Z-rapport af (of exporteer PDF) voor je Belastingdienst-administratie.',
        'X-rapport is een momentopname overdag — toont totalen ZONDER te sluiten.',
        'Sluiten start ook een synchronisatie van de dagverkopen naar het hoofdkantoor.',
      ],
    },
  },

  reports: {
    guide: 'user_manual/11-reports',
    en: {
      title: 'Store reports',
      steps: [
        'Pick a range: Daily, Monthly, or a custom date range.',
        'See total sales, BTW, top products and a custom product report.',
        'Export any report to PDF or CSV (SRD, with Dutch or English headers).',
      ],
    },
    nl: {
      title: 'Winkelrapporten',
      steps: [
        'Kies een periode: Dagelijks, Maandelijks of een aangepast datumbereik.',
        'Bekijk totale omzet, BTW, topproducten en een aangepast productrapport.',
        'Exporteer elk rapport naar PDF of CSV (SRD, met Nederlandse of Engelse koppen).',
      ],
    },
  },

  history: {
    guide: 'user_manual/05a-refunds-and-voids',
    en: {
      title: 'Sales history & refunds',
      steps: [
        'Browse the day’s sales; filter by date.',
        'Tap the printer icon to reprint or e-mail a receipt.',
        'Void a completed sale, or issue a refund (if you have permission).',
        'Refunds restore stock and are recorded in the audit trail.',
      ],
    },
    nl: {
      title: 'Verkoopgeschiedenis & retouren',
      steps: [
        'Blader door de verkopen van de dag; filter op datum.',
        'Tik op het printericoon om een bon opnieuw af te drukken of te e-mailen.',
        'Annuleer een voltooide verkoop, of geef een retour (met de juiste rechten).',
        'Retouren herstellen de voorraad en worden vastgelegd in het auditspoor.',
      ],
    },
  },

  'exchange-rate': {
    guide: 'user_manual/02-daily-setup',
    en: {
      title: 'Daily exchange rate (USD → SRD)',
      steps: [
        'The day’s rate is locked once and used for every sale that day.',
        'View the current rate and a 7-day history.',
        'A manager can override the rate manually if needed.',
        'The rate used is stamped on every sale for the audit trail.',
      ],
    },
    nl: {
      title: 'Dagkoers (USD → SRD)',
      steps: [
        'De dagkoers wordt eenmaal vastgezet en gebruikt voor elke verkoop die dag.',
        'Bekijk de huidige koers en een geschiedenis van 7 dagen.',
        'Een manager kan de koers indien nodig handmatig aanpassen.',
        'De gebruikte koers wordt bij elke verkoop vastgelegd voor het auditspoor.',
      ],
    },
  },

  labels: {
    guide: 'user_manual/12-barcode-labels',
    en: {
      title: 'Barcode & label printing',
      steps: [
        'Select products and a symbology (EAN-13, Code 128 or QR).',
        'Set quantities, then bulk-print to a label printer.',
      ],
    },
    nl: {
      title: 'Streepjescode & labels printen',
      steps: [
        'Selecteer producten en een symbologie (EAN-13, Code 128 of QR).',
        'Stel aantallen in en print in bulk naar een labelprinter.',
      ],
    },
  },

  hardware: {
    guide: 'user_manual/13-settings',
    en: {
      title: 'Hardware setup — printer, cash drawer & scanner',
      intro: 'One-time setup per terminal. Go to Settings → Printer to configure it all.',
      steps: [
        'Receipt printer (thermal): Settings → Printer → choose Network (enter the printer’s IP + port 9100) or USB (enter the Windows printer name). EPSON TM-T20 and compatible ESC/POS printers work.',
        'Test it with “Test print” — a sample receipt should come out. Nothing? Re-check the IP / printer name and that it’s powered on and on the same network.',
        'No thermal printer? Leave it on “None” — the Print button then uses your computer’s normal print dialog, so any installed printer still works (including a thermal one via its Windows driver).',
        'Cash drawer: it plugs into the printer’s drawer port and pops open automatically on a cash sale. Pick the pulse pin (Pin 2 or Pin 5 — try the other if it doesn’t open) and use “Test drawer”.',
        'Auto-print: turn on “Print receipt automatically” so every completed sale prints without a tap.',
        'Barcode scanner: USB scanners are plug-and-play — just scan and the item drops into the cart, no setup. For a phone/camera scan, use the 📷 button on the search bar.',
        'Weighed goods (scales): Settings → Weighed goods — enable and confirm the barcode layout against your scale before using it.',
        'Print barcode labels: open Barcode & Labels, pick products + symbology (EAN-13 / Code 128 / QR), set quantities and bulk-print to a label printer.',
      ],
    },
    nl: {
      title: 'Apparatuur instellen — printer, kassalade & scanner',
      intro: 'Eenmalige instelling per kassa. Ga naar Instellingen → Printer om alles in te stellen.',
      steps: [
        'Bonprinter (thermisch): Instellingen → Printer → kies Netwerk (IP-adres + poort 9100) of USB (Windows-printernaam). EPSON TM-T20 en compatibele ESC/POS-printers werken.',
        'Test met “Testafdruk” — er hoort een voorbeeldbon uit te komen. Niets? Controleer het IP / de printernaam en of hij aanstaat en op hetzelfde netwerk zit.',
        'Geen thermische printer? Laat op “Geen” staan — de Print-knop gebruikt dan het normale printvenster van de computer, dus elke geïnstalleerde printer werkt (ook een thermische via zijn Windows-stuurprogramma).',
        'Kassalade: sluit aan op de ladepoort van de printer en gaat automatisch open bij een contante verkoop. Kies de puls-pin (Pin 2 of Pin 5 — probeer de andere als hij niet opent) en gebruik “Test lade”.',
        'Automatisch printen: zet “Bon automatisch printen” aan zodat elke voltooide verkoop zonder tik afdrukt.',
        'Streepjescodescanner: USB-scanners zijn plug-and-play — gewoon scannen en het artikel valt in de winkelwagen, geen instelling. Voor telefoon/camera: gebruik de 📷-knop bij de zoekbalk.',
        'Gewogen artikelen (weegschalen): Instellingen → Gewogen artikelen — inschakelen en de barcode-indeling met uw weegschaal bevestigen vóór gebruik.',
        'Streepjescodelabels printen: open Streepjescode & labels, kies producten + symbologie (EAN-13 / Code 128 / QR), stel aantallen in en print in bulk naar een labelprinter.',
      ],
    },
  },

  settings: {
    guide: 'user_manual/13-settings',
    en: {
      title: 'Settings',
      steps: [
        'Switch language (Dutch/English) instantly, per user.',
        'Set defaults: BTW rate, category, customer, barcode symbology, date format.',
        'System: toggle the on-screen keyboard, auto-launch, and (manager+) close/restart.',
      ],
    },
    nl: {
      title: 'Instellingen',
      steps: [
        'Wissel direct van taal (Nederlands/Engels), per gebruiker.',
        'Stel standaarden in: BTW-tarief, categorie, klant, streepjescode, datumnotatie.',
        'Systeem: schermtoetsenbord, automatisch starten, en (manager+) afsluiten/herstarten.',
      ],
    },
  },
}
