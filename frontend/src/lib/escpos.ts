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

import { josbinStampBits, STAMP_WIDTH, STAMP_HEIGHT } from '@/lib/receiptStamp'

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
  /** How wide the current font is relative to the normal one. */
  private scale = 1
  constructor(private readonly width: number = 42) {}

  cmd(bytes: number[]): this {
    // Watch for font changes here rather than asking every call site to
    // remember: the column maths silently breaks the moment a caller selects
    // a font and the builder keeps padding to the normal width.
    if (bytes.length === 3 && bytes[0] === ESC && bytes[1] === 0x21) {
      if (bytes[2] === 0x30) this.scale = 2         // double width + height
      else if (bytes[2] === 0x01) this.scale = 0.75 // font B, ~1/3 more chars
      else this.scale = 1
    }
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

  /**
   * Columns available RIGHT NOW, which is not the paper's column count.
   *
   * Double-width characters are twice as wide, so a 42-column roll fits only
   * 21 of them. Padding a double-width line to 42 makes the printer wrap it
   * onto a second line — which is exactly what used to happen to the TOTAL,
   * the one line on the receipt a customer actually checks. Font B (small)
   * is narrower and fits about a third more.
   */
  private effWidth(): number {
    return Math.floor(this.width / this.scale)
  }

  dashes(char = '-', width = this.effWidth()): this {
    return this.line(char.repeat(width))
  }

  /**
   * Left label + right-aligned value.
   *
   * When the pair is too wide — a long customer name on a 58mm roll — the
   * value drops to its own right-aligned line instead of the LABEL being
   * truncated. Chopping the label produced rows like "Custome  Ministerie
   * van Financien", which reads as a typo on a document a customer keeps.
   */
  twoCol(left: string, right: string, width = this.effWidth()): this {
    const pad = width - left.length - right.length
    if (pad >= 1) return this.line(left + ' '.repeat(pad) + right)
    this.line(left)
    return this.line(right.substring(0, width).padStart(width))
  }

  /**
   * Item row: qty | description | amount.
   *
   * A description too long for its column WRAPS onto indented continuation
   * lines rather than being cut off. Chopping "Chicken Breast (1 kg) (10%)"
   * mid-word saves a line and costs the customer the ability to check what
   * they were charged for.
   */
  threeCol(qty: string, desc: string, price: string, width = this.effWidth()): this {
    const qtyW   = 5
    const priceW = 11
    const descW  = width - qtyW - priceW
    const qtyStr   = qty.substring(0, qtyW).padEnd(qtyW)
    const priceStr = price.substring(0, priceW).padStart(priceW)

    const words = desc.split(' ')
    const rows: string[] = []
    let cur = ''
    for (const w of words) {
      // A single word longer than the column is hard-split; nothing else fits.
      if (w.length > descW) {
        if (cur) { rows.push(cur); cur = '' }
        for (let i = 0; i < w.length; i += descW) rows.push(w.substring(i, i + descW))
        continue
      }
      if (!cur) cur = w
      else if (cur.length + 1 + w.length <= descW) cur += ' ' + w
      else { rows.push(cur); cur = w }
    }
    if (cur) rows.push(cur)
    if (!rows.length) rows.push('')

    // The amount belongs on the first row, beside the start of the name.
    this.line(qtyStr + rows[0].padEnd(descW) + priceStr)
    for (const extra of rows.slice(1)) {
      this.line(' '.repeat(qtyW) + extra.padEnd(descW) + ' '.repeat(priceW))
    }
    return this
  }

  /**
   * Print a packed 1-bit bitmap — ESC/POS `GS v 0`.
   *
   * `bits` is MSB-first, ceil(width/8) bytes per row: 1 = burn a dot. The
   * printer takes the width in BYTES and the height in DOTS, both as
   * little-endian 16-bit, which is the detail that silently prints garbage
   * when you get it backwards.
   *
   * Centring is done by padding each row with blank bytes rather than with
   * ESC a 1 — alignment commands apply to text, and several ESC/POS clones
   * ignore them for raster data and left-align the image anyway.
   */
  raster(bits: Uint8Array, widthDots: number, heightDots: number): this {
    const srcBytes = Math.ceil(widthDots / 8)
    // `this.width` counts CHARACTERS, not dots — the print head is 576 dots
    // on 80 mm paper and 384 on 58 mm, which is what the raster command
    // addresses.
    const headBytes = this.width >= 42 ? 72 : 48
    const outBytes = Math.max(headBytes, srcBytes)
    const pad = Math.max(0, Math.floor((outBytes - srcBytes) / 2))

    this.cmd([GS, 0x76, 0x30, 0x00,
      outBytes & 0xff, (outBytes >> 8) & 0xff,
      heightDots & 0xff, (heightDots >> 8) & 0xff])

    for (let y = 0; y < heightDots; y++) {
      for (let i = 0; i < pad; i++) this.buf.push(0x00)
      for (let i = 0; i < srcBytes; i++) this.buf.push(bits[y * srcBytes + i] ?? 0x00)
      for (let i = pad + srcBytes; i < outBytes; i++) this.buf.push(0x00)
    }
    return this
  }

  build(): Uint8Array {
    return new Uint8Array(this.buf)
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Returns the cash drawer kick command bytes (pin 2 — most common). */
export function cashDrawerPulse(pin: 1 | 2 = 1): Uint8Array {
  // INIT first, then the pulse — not the bare 5-byte pulse on its own.
  //
  // A standalone `ESC p 0 25 250` is a naked control fragment with no job
  // prologue. Windows' spooler tolerates it; the Android USB bulk endpoint
  // does not — it returned "USB write failed after 0 of 5 bytes", refusing
  // the transfer outright while the same printer accepted a full receipt
  // moments earlier. Prefixing ESC @ makes it a well-formed minimal job.
  //
  // No trailing line feed on purpose: this is also what the standalone
  // "Test cash drawer" button sends, and a LF would spit blank paper every
  // time someone checks the drawer.
  return new Uint8Array([...CMD.INIT, ...(pin === 1 ? CMD.CASH_DRAWER_1 : CMD.CASH_DRAWER_2)])
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
    btw_exempt_reason?: string | null
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
  /**
   * Kick the cash drawer as part of THIS receipt, on the given pin.
   *
   * The drawer hangs off the printer, so a drawer pulse is a print job. Sent
   * as a second, separate job alongside the receipt it races it — the printer
   * gets two jobs milliseconds apart and one of them is dropped. That is
   * exactly what happened when receipts began printing automatically: the
   * paper came out and the drawer stayed shut. Emitting the pulse at the head
   * of the receipt stream makes it one job the printer sequences itself, so
   * the drawer opens as the receipt starts printing.
   */
  openDrawer?: 1 | 2
  /**
   * Print the Josbin mark at the foot of the receipt, stamp-style. On by
   * default; set false for printers that render raster images poorly, or for
   * a shop that wants text only. (Roughly 5 mm of extra paper per receipt.)
   */
  stamp?: boolean
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
    btw_exempt:     'BTW vrijgesteld',
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
    btw_breakdown:  'BTW Breakdown',
    base:           'Base',
    btw:            'BTW',
    total_btw:      'Total BTW',
    btw_exempt:     'BTW exempt',
    btw_number:     'BTW no.',
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
/**
 * BTW rates arrive as decimals ("10.00", "8.50") because they are money-grade
 * numbers in the database. On paper "10.00%" is noise — print 10% and 8.5%.
 */
function fmtRate(rate: string): string {
  return String(parseFloat(rate))
}

export function buildReceiptBytes(opts: EscPosReceiptOptions): Uint8Array {
  const t   = TRANSLATIONS[opts.locale]
  const { sale, store, stamp } = opts
  const b   = new EscPosBuilder(CHARS_PER_LINE[opts.paperWidth ?? 80])

  b.cmd(CMD.INIT)

  // Drawer first: it should spring the moment the cashier takes the money,
  // not after the paper has finished feeding.
  if (opts.openDrawer) {
    b.cmd(opts.openDrawer === 2 ? CMD.CASH_DRAWER_2 : CMD.CASH_DRAWER_1)
  }

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
        ? `${item.product_name} (${fmtRate(item.btw_rate)}%)`
        : item.product_name
    // Space after SRD, matching the totals block — "SRD32.00" next to
    // "SRD 32.00" three lines down reads as two different currencies.
    const price = `SRD ${item.line_total_srd}`

    b.threeCol(qty, name, price)

    if (parseFloat(item.discount_srd) > 0) {
      b.threeCol('', `  - ${t.discount}`, `-SRD ${item.discount_srd}`)
    }
  }

  b.dashes()

  // ── Totals ─────────────────────────────────────────────────────────────────
  if (parseFloat(sale.discount_srd) > 0) {
    b.twoCol(t.subtotal, `SRD ${sale.subtotal_srd}`)
    b.twoCol(t.discount, `-SRD ${sale.discount_srd}`)
  }

  // The amount due gets its own band: a rule above it and air below, so the
  // eye lands on it instead of reading it as one more line in a column.
  b.dashes()
  b.cmd(CMD.BOLD_ON).cmd(CMD.FONT_LARGE)
  b.twoCol(t.total, `SRD ${sale.total_srd}`)
  b.cmd(CMD.FONT_NORMAL).cmd(CMD.BOLD_OFF)
  b.emptyLine()

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
    // One rate is the normal case — printing "BTW 10%  SRD 0.68" directly
    // above "Total BTW  SRD 0.68" states the same number twice and looks
    // like a mistake. Only break it out when rates actually differ.
    if (rates.length === 1) {
      b.twoCol(`${t.btw} ${rates[0]}%`, `SRD ${sale.btw_srd}`)
    } else {
      b.cmd(CMD.BOLD_ON).line(t.btw_breakdown).cmd(CMD.BOLD_OFF)
      for (const rate of rates.sort((a, z) => a - z)) {
        // Prices are BTW-inclusive, so the tax inside a line total is
        // total × rate / (100 + rate) — the same extraction the BTW engine
        // performs server-side. Line totals are already net of discounts,
        // which is the order Suriname requires.
        const amount = sale.items
          .filter((i) => !i.btw_exempt && parseFloat(i.btw_rate) === rate)
          .reduce((sum, i) => sum + (parseFloat(i.line_total_srd) * rate) / (100 + rate), 0)
        b.twoCol(`  ${t.btw} ${rate}%`, `SRD ${amount.toFixed(2)}`)
      }
      b.twoCol(t.total_btw, `SRD ${sale.btw_srd}`)
    }
    if (sale.btw_exempt_reason) b.line(`${t.btw_exempt}: ${sale.btw_exempt_reason}`)
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

  // ── Stamp ─────────────────────────────────────────────────────────────────
  //
  // The logo sits at the foot of the receipt, printed as an image, the way a
  // rubber stamp lands on a docket. It cannot be a watermark: a thermal head
  // burns one line at a time with no compositing, so there is no "behind the
  // text" to print into. On the A4/PDF receipt it IS a true watermark — see
  // ReceiptService::receiptWatermarkDataUri.
  if (stamp !== false) {
    b.emptyLine()
    b.raster(josbinStampBits(), STAMP_WIDTH, STAMP_HEIGHT)
  }

  // Feed + cut
  b.emptyLine().emptyLine().emptyLine()
  b.cmd(CMD.CUT_PARTIAL)

  return b.build()
}
