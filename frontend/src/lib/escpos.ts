/**
 * ESC/POS command builder — pure TypeScript, no external dependencies.
 *
 * Builds raw byte arrays for:
 *   - Receipt printing (matches the Blade receipt template)
 *   - Cash drawer kick (ESC p command)
 *   - Paper cut
 *
 * Reference: EPSON ESC/POS Command Reference (TM-T20 compatible)
 */

// ── ESC/POS byte constants ──────────────────────────────────────────────────

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

const CMD = {
  // Init + select code page 858 (ESC t 19). Printers boot in CP437 (USA), where
  // Latin accents don't exist — without this every é/ë/ó prints as box-drawing
  // garbage. CP858 (= CP850 + €) covers Dutch, Spanish and Portuguese and is
  // supported by Epson TM series and the ESC/POS clones (Xprinter, 3nStar,
  // Rongta, Bixolon, Citizen, …).
  INIT:           [ESC, 0x40, ESC, 0x74, 19],
  ALIGN_LEFT:     [ESC, 0x61, 0x00],
  ALIGN_CENTER:   [ESC, 0x61, 0x01],
  ALIGN_RIGHT:    [ESC, 0x61, 0x02],
  BOLD_ON:        [ESC, 0x45, 0x01],
  BOLD_OFF:       [ESC, 0x45, 0x00],
  UNDERLINE_ON:   [ESC, 0x2d, 0x01],
  UNDERLINE_OFF:  [ESC, 0x2d, 0x00],
  FONT_NORMAL:    [ESC, 0x21, 0x00],
  FONT_LARGE:     [ESC, 0x21, 0x30],   // double width + height
  FONT_SMALL:     [ESC, 0x21, 0x01],
  CUT_FULL:       [GS,  0x56, 0x42, 0x00],
  CUT_PARTIAL:    [GS,  0x56, 0x42, 0x01],
  // Cash drawer pin 2: ESC p 0 t1 t2
  CASH_DRAWER_1:  [ESC, 0x70, 0x00, 0x19, 0xfa],
  // Cash drawer pin 5: ESC p 1 t1 t2
  CASH_DRAWER_2:  [ESC, 0x70, 0x01, 0x19, 0xfa],
}

// ── Character encoding (code page 858) ──────────────────────────────────────
//
// The printer is switched to CP858 in INIT, so text bytes must be CP858 —
// NOT Latin-1: the byte values differ (é is 0xE9 in Latin-1 but 0x82 in
// CP858). Unmapped characters fall back to their base letter (ñ→n only when
// CP858 lacks them — it doesn't) or '?'.

const CP858: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86,
  'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d,
  'Ä': 0x8e, 'Å': 0x8f, 'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94,
  'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b,
  '£': 0x9c, 'Ø': 0x9d, '×': 0x9e, 'ƒ': 0x9f, 'á': 0xa0, 'í': 0xa1, 'ó': 0xa2,
  'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, '®': 0xa9,
  '½': 0xab, '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf, 'Á': 0xb5, 'Â': 0xb6,
  'À': 0xb7, '©': 0xb8, '¢': 0xbd, '¥': 0xbe, 'ã': 0xc6, 'Ã': 0xc7, '¤': 0xcf,
  'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, '€': 0xd5, 'Í': 0xd6,
  'Î': 0xd7, 'Ï': 0xd8, '¦': 0xdd, 'Ì': 0xde, 'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2,
  'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'µ': 0xe6, 'þ': 0xe7, 'Þ': 0xe8, 'Ú': 0xe9,
  'Û': 0xea, 'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed, '¯': 0xee, '´': 0xef, '±': 0xf1,
  '¾': 0xf3, '¶': 0xf4, '§': 0xf5, '÷': 0xf6, '°': 0xf8, '¨': 0xf9, '·': 0xfa,
  '¹': 0xfb, '³': 0xfc, '²': 0xfd,
}

/** Encode one character to a CP858 byte: ASCII passthrough → mapped accent →
 *  diacritic-stripped base letter → '?'. Exported for tests. */
export function encodeCp858Char(ch: string): number {
  const code = ch.charCodeAt(0)
  if (code < 0x80) return code
  if (ch in CP858) return CP858[ch]
  const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (base.length === 1 && base.charCodeAt(0) < 0x80) return base.charCodeAt(0)
  return 0x3f // '?'
}

// ── Byte builder helpers ────────────────────────────────────────────────────

/** 80 mm paper prints 42 columns (Font A); 58 mm paper prints 32. */
export type PaperWidth = 58 | 80
export const CHARS_PER_LINE: Record<PaperWidth, number> = { 58: 32, 80: 42 }

class EscPosBuilder {
  private buf: number[] = []
  constructor(private readonly width: number = 42) {}

  cmd(bytes: number[]): this {
    this.buf.push(...bytes)
    return this
  }

  // Encode text as CP858 (covers Dutch/Spanish/Portuguese: ë é ó ú ñ ç …)
  text(str: string): this {
    for (const ch of str) this.buf.push(encodeCp858Char(ch))
    return this
  }

  line(str = ''): this {
    return this.text(str).cmd([LF])
  }

  emptyLine(): this {
    return this.cmd([LF])
  }

  dashes(char = '-', width = this.width): this {
    return this.line(char.repeat(width))
  }

  // Left text + right-aligned value in fixed width
  twoCol(left: string, right: string, width = this.width): this {
    const pad = width - left.length - right.length
    if (pad < 1) {
      return this.line(left.substring(0, width - right.length - 1) + ' ' + right)
    }
    return this.line(left + ' '.repeat(pad) + right)
  }

  // Three column: qty | description | price
  threeCol(qty: string, desc: string, price: string, width = this.width): this {
    const qtyW  = 5
    const priceW = 10
    const descW = width - qtyW - priceW
    const qtyStr   = qty.substring(0, qtyW).padEnd(qtyW)
    const priceStr = price.substring(0, priceW).padStart(priceW)
    const descStr  = desc.substring(0, descW).padEnd(descW)
    return this.line(qtyStr + descStr + priceStr)
  }

  build(): Uint8Array {
    return new Uint8Array(this.buf)
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Returns the cash drawer kick command bytes (pin 2 — most common). */
export function cashDrawerPulse(pin: 1 | 2 = 1): Uint8Array {
  return new Uint8Array(pin === 1 ? CMD.CASH_DRAWER_1 : CMD.CASH_DRAWER_2)
}

/** Returns a full-cut command. */
export function paperCut(partial = false): Uint8Array {
  return new Uint8Array(partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL)
}

export interface EscPosReceiptOptions {
  sale: {
    sale_number: string
    occurred_at: string
    cashier_name: string
    customer_name?: string
    payment_method: string
    payment_provider?: string
    payment_reference?: string
    subtotal_srd: string
    discount_srd: string
    total_srd: string
    btw_srd: string
    cash_tendered?: string
    change?: string
    exchange_rate_used?: string
    total_usd?: string
    items: {
      product_name: string
      quantity: string
      unit_price_srd: string
      line_total_srd: string
      discount_srd: string
      btw_rate: string
      btw_exempt: boolean
    }[]
  }
  store: {
    name: string
    receipt_header?: string
    receipt_footer?: string
    btw_number?: string
  }
  locale: 'nl' | 'en'
  /** 58 = 32 chars/line (compact printers), 80 = 42 chars/line. Default 80. */
  paperWidth?: PaperWidth
}

const TRANSLATIONS = {
  nl: {
    receipt:        'KASSABON',
    receipt_no:     'Bon nr.',
    date:           'Datum',
    cashier:        'Kassamedewerker',
    customer:       'Klant',
    qty:            'Aant.',
    description:    'Omschrijving',
    amount:         'Bedrag',
    subtotal:       'Subtotaal',
    discount:       'Korting',
    total:          'TOTAAL',
    btw_breakdown:  'BTW Specificatie',
    base:           'Basis',
    btw:            'BTW',
    total_btw:      'Totaal BTW',
    btw_number:     'BTW-nr.',
    payment:        'Betaalmethode',
    cash:           'Contant',
    card:           'Pin / Kaart',
    mixed:          'Contant + Pin',
    bank_transfer:  'Overschrijving',
    mobile_transfer:'Mobiel bankieren',
    foreign_cash:   'Vreemde valuta',
    qr_payment:     'QR-wallet',
    paid_via:       'Betaald via',
    cash_tendered:  'Ontvangen',
    change:         'Wisselgeld',
    exempt:         'vrijgesteld',
    rate:           'Koers',
    thank_you:      'Bedankt voor uw bezoek!',
    powered_by:     'Josbin POS',
  },
  en: {
    receipt:        'RECEIPT',
    receipt_no:     'Receipt no.',
    date:           'Date',
    cashier:        'Cashier',
    customer:       'Customer',
    qty:            'Qty',
    description:    'Description',
    amount:         'Amount',
    subtotal:       'Subtotal',
    discount:       'Discount',
    total:          'TOTAL',
    btw_breakdown:  'VAT Breakdown',
    base:           'Base',
    btw:            'VAT',
    total_btw:      'Total VAT',
    btw_number:     'VAT no.',
    payment:        'Payment',
    cash:           'Cash',
    card:           'Card / PIN',
    mixed:          'Cash + Card',
    bank_transfer:  'Bank transfer',
    mobile_transfer:'Mobile banking',
    foreign_cash:   'Foreign cash',
    qr_payment:     'QR wallet',
    paid_via:       'Paid via',
    cash_tendered:  'Tendered',
    change:         'Change',
    exempt:         'exempt',
    rate:           'Rate',
    thank_you:      'Thank you for your visit!',
    powered_by:     'Josbin POS',
  },
}

/**
 * Build a complete ESC/POS receipt byte array from sale data.
 * Returns Uint8Array ready to send to the printer.
 */
export function buildReceiptBytes(opts: EscPosReceiptOptions): Uint8Array {
  const t   = TRANSLATIONS[opts.locale]
  const { sale, store } = opts
  const b   = new EscPosBuilder(CHARS_PER_LINE[opts.paperWidth ?? 80])

  b.cmd(CMD.INIT)

  // ── Header ─────────────────────────────────────────────────────────────────
  b.cmd(CMD.ALIGN_CENTER).cmd(CMD.BOLD_ON).cmd(CMD.FONT_LARGE)
  b.line(store.name)
  b.cmd(CMD.FONT_NORMAL).cmd(CMD.BOLD_OFF)

  if (store.receipt_header) {
    store.receipt_header.split('\n').forEach((l) => b.line(l.trim()))
  }

  b.emptyLine()
  b.cmd(CMD.ALIGN_LEFT)
  b.dashes('=')

  // ── Sale info ──────────────────────────────────────────────────────────────
  b.twoCol(t.receipt_no, sale.sale_number)
  b.twoCol(t.date,       sale.occurred_at)
  b.twoCol(t.cashier,    sale.cashier_name)
  if (sale.customer_name) b.twoCol(t.customer, sale.customer_name)

  b.dashes()

  // ── Items ──────────────────────────────────────────────────────────────────
  b.cmd(CMD.UNDERLINE_ON)
  b.threeCol(t.qty, t.description, t.amount)
  b.cmd(CMD.UNDERLINE_OFF)

  for (const item of sale.items) {
    const qty  = `${parseFloat(item.quantity).toString()}x`
    const name = item.btw_exempt
      ? `${item.product_name} (${t.exempt})`
      : parseFloat(item.btw_rate) > 0
        ? `${item.product_name} (${item.btw_rate}%)`
        : item.product_name
    const price = `SRD${item.line_total_srd}`

    b.threeCol(qty, name, price)

    if (parseFloat(item.discount_srd) > 0) {
      b.threeCol('', `  - ${t.discount}`, `-${item.discount_srd}`)
    }
  }

  b.dashes()

  // ── Totals ─────────────────────────────────────────────────────────────────
  if (parseFloat(sale.discount_srd) > 0) {
    b.twoCol(t.subtotal, `SRD ${sale.subtotal_srd}`)
    b.twoCol(t.discount, `-SRD ${sale.discount_srd}`)
  }

  b.cmd(CMD.BOLD_ON).cmd(CMD.FONT_LARGE)
  b.twoCol(t.total, `SRD ${sale.total_srd}`)
  b.cmd(CMD.FONT_NORMAL).cmd(CMD.BOLD_OFF)

  if (sale.payment_method === 'cash' || sale.payment_method === 'mixed') {
    if (sale.cash_tendered) b.twoCol(t.cash_tendered, `SRD ${sale.cash_tendered}`)
    if (sale.change)        b.twoCol(t.change,        `SRD ${sale.change}`)
  }

  b.dashes()

  // ── BTW breakdown ──────────────────────────────────────────────────────────
  if (parseFloat(sale.btw_srd) > 0) {
    // Rate label comes from the actual items — BTW is configurable per product,
    // so a hardcoded percentage would lie the day a custom rate is used.
    const rates = [...new Set(
      sale.items
        .filter((i) => !i.btw_exempt && parseFloat(i.btw_rate) > 0)
        .map((i) => parseFloat(i.btw_rate)),
    )]
    const rateLabel = rates.length === 1 ? `${t.btw} ${rates[0]}%` : t.btw
    b.cmd(CMD.BOLD_ON).line(t.btw_breakdown).cmd(CMD.BOLD_OFF)
    b.twoCol(rateLabel, `SRD ${sale.btw_srd}`)
    b.twoCol(t.total_btw, `SRD ${sale.btw_srd}`)
    if (store.btw_number) b.line(`${t.btw_number}: ${store.btw_number}`)
    b.dashes()
  }

  // ── USD equivalent ─────────────────────────────────────────────────────────
  if (sale.total_usd && sale.exchange_rate_used && parseFloat(sale.exchange_rate_used) > 0) {
    b.cmd(CMD.ALIGN_RIGHT).cmd(CMD.FONT_SMALL)
    b.line(`~ USD ${sale.total_usd} (${t.rate}: ${sale.exchange_rate_used} SRD/USD)`)
    b.cmd(CMD.FONT_NORMAL).cmd(CMD.ALIGN_LEFT)
  }

  // ── Payment method ────────────────────────────────────────────────────────
  const pmLabel: Record<string, string> = {
    cash: t.cash, card: t.card, mixed: t.mixed,
    bank_transfer: t.bank_transfer, mobile_transfer: t.mobile_transfer,
    foreign_cash: t.foreign_cash, qr_payment: t.qr_payment,
  }
  b.cmd(CMD.ALIGN_CENTER)
  b.line(`${t.payment}: ${pmLabel[sale.payment_method] ?? sale.payment_method}`)
  // Wallet / transfer detail — which provider and (when captured) which
  // transaction, so the customer copy carries the reconciliation trail too.
  if (sale.payment_provider) {
    b.line(`${t.paid_via}: ${sale.payment_provider}${sale.payment_reference ? ` (${sale.payment_reference})` : ''}`)
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  b.emptyLine()
  if (store.receipt_footer) {
    store.receipt_footer.split('\n').forEach((l) => b.line(l.trim()))
  }
  b.cmd(CMD.BOLD_ON).line(t.thank_you).cmd(CMD.BOLD_OFF)
  b.cmd(CMD.FONT_SMALL).line(t.powered_by).cmd(CMD.FONT_NORMAL)

  // Feed + cut
  b.emptyLine().emptyLine().emptyLine()
  b.cmd(CMD.CUT_PARTIAL)

  return b.build()
}
