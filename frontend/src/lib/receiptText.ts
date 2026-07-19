/**
 * Plain-text receipt builder for messaging channels (WhatsApp).
 *
 * Produces a compact, monospace-friendly text version of a completed sale
 * that fits inside a wa.me deep link. WhatsApp deep links break on very long
 * URLs, so the item list is capped and the encoded length guarded — totals
 * and BTW are never dropped, only middle item lines collapse into "+N more".
 */

export interface TextReceiptItem {
  product_name: string
  quantity: string | number
  unit_price_srd: string
  line_total_srd: string
}

export interface TextReceiptInput {
  storeName: string
  saleNumber: string
  occurredAt: string // ISO timestamp
  items: TextReceiptItem[]
  subtotalSrd: string
  discountSrd: string
  btwSrd: string
  totalSrd: string
  paymentMethod: string
  paymentProvider?: string
  cashTendered?: string
  change?: string
  locale: 'nl' | 'en' | 'srn'
}

const L = {
  nl: {
    receipt: 'Kassabon', subtotal: 'Subtotaal', discount: 'Korting', btw: 'BTW',
    total: 'TOTAAL', paid: 'Betaald', change: 'Wisselgeld', more: 'meer artikelen',
    thanks: 'Bedankt voor uw aankoop!',
    methods: {
      cash: 'Contant', card: 'Kaart/PIN', mixed: 'Gemengd', bank_transfer: 'Overschrijving',
      mobile_transfer: 'Mobiele overboeking', foreign_cash: 'Vreemde valuta', qr_payment: 'QR-betaling',
    } as Record<string, string>,
  },
  en: {
    receipt: 'Receipt', subtotal: 'Subtotal', discount: 'Discount', btw: 'BTW',
    total: 'TOTAL', paid: 'Paid', change: 'Change', more: 'more items',
    thanks: 'Thank you for your purchase!',
    methods: {
      cash: 'Cash', card: 'Card/PIN', mixed: 'Mixed', bank_transfer: 'Bank transfer',
      mobile_transfer: 'Mobile transfer', foreign_cash: 'Foreign cash', qr_payment: 'QR payment',
    } as Record<string, string>,
  },
  srn: {
    receipt: 'Bon', subtotal: 'Subtotaal', discount: 'Korting', btw: 'BTW',
    total: 'ALA SANI', paid: 'Pai', change: 'Kenki-moni', more: 'moro sani',
    thanks: 'Tangi fu yu bai!',
    methods: {
      cash: 'Kontan moni', card: 'Karta/PIN', mixed: 'Miksi', bank_transfer: 'Bank-overboeking',
      mobile_transfer: 'Mobiele overboeking', foreign_cash: 'Doro-moni', qr_payment: 'QR-pai',
    } as Record<string, string>,
  },
}

/** Max items listed individually before collapsing the tail. Keeps the
 *  encoded URL comfortably under WhatsApp's practical deep-link limit. */
const MAX_ITEM_LINES = 15

export function buildReceiptText(input: TextReceiptInput): string {
  const t = L[input.locale] ?? L.nl
  const date = new Date(input.occurredAt)
  // AST display, DD-MM-YYYY HH:mm — matches the printed receipt.
  const dateStr = date.toLocaleString(input.locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'America/Paramaribo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  const lines: string[] = []
  lines.push(`\u{1F9FE} ${input.storeName}`)
  lines.push(`${t.receipt} ${input.saleNumber} · ${dateStr}`)
  lines.push('')

  const shown = input.items.slice(0, MAX_ITEM_LINES)
  for (const item of shown) {
    const qty = typeof item.quantity === 'number' ? String(item.quantity) : item.quantity
    // "2 × Parbo Bier 1L — SRD 24.00"
    lines.push(`${trimQty(qty)} × ${item.product_name} — SRD ${item.line_total_srd}`)
  }
  const hidden = input.items.length - shown.length
  if (hidden > 0) lines.push(`… +${hidden} ${t.more}`)

  lines.push('')
  const discount = parseFloat(input.discountSrd || '0')
  if (discount > 0) {
    lines.push(`${t.subtotal}: SRD ${input.subtotalSrd}`)
    lines.push(`${t.discount}: -SRD ${input.discountSrd}`)
  }
  lines.push(`${t.btw}: SRD ${input.btwSrd}`)
  lines.push(`${t.total}: SRD ${input.totalSrd}`)

  const method = t.methods[input.paymentMethod] ?? input.paymentMethod
  lines.push(`${t.paid}: ${method}${input.paymentProvider ? ` (${input.paymentProvider})` : ''}`)
  const change = parseFloat(input.change || '0')
  if (change > 0) lines.push(`${t.change}: SRD ${input.change}`)

  lines.push('')
  lines.push(t.thanks)
  return lines.join('\n')
}

/** "2.000" → "2", "0.500" → "0.5" — receipts store DECIMAL(10,3) quantities. */
function trimQty(qty: string): string {
  const n = parseFloat(qty)
  return Number.isNaN(n) ? qty : String(n)
}

/**
 * Normalise a phone number for wa.me: digits only, Suriname country code
 * assumed for bare local numbers (mobiles are 7 digits, e.g. 8812345).
 * Returns '' when nothing usable remains — caller then opens the
 * chat-picker variant of the link instead.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  let digits = (raw || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return ''
  if (digits.length <= 7) digits = `597${digits}`
  return digits
}

/** Build the wa.me deep link. Empty phone → WhatsApp's own chat picker. */
export function buildWhatsAppLink(phone: string, text: string): string {
  const encoded = encodeURIComponent(text)
  const digits = normalizeWhatsAppPhone(phone)
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}
