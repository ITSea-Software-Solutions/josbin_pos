import { describe, it, expect } from 'vitest'
import { buildReceiptText, buildWhatsAppLink, normalizeWhatsAppPhone } from '../receiptText'

const baseSale = {
  storeName: 'De Hoop — Paramaribo',
  saleNumber: 'S-2026-000123',
  occurredAt: '2026-07-19T14:30:00-03:00',
  items: [
    { product_name: 'Parbo Bier 1L', quantity: '2.000', unit_price_srd: '12.00', line_total_srd: '24.00' },
    { product_name: 'Roti Kip', quantity: '1.000', unit_price_srd: '35.00', line_total_srd: '35.00' },
  ],
  subtotalSrd: '59.00',
  discountSrd: '0.00',
  btwSrd: '5.36',
  totalSrd: '59.00',
  paymentMethod: 'cash',
  change: '1.00',
  locale: 'nl' as const,
}

describe('buildReceiptText', () => {
  it('renders a Dutch receipt with store, items, BTW, total and change', () => {
    const text = buildReceiptText(baseSale)
    expect(text).toContain('De Hoop — Paramaribo')
    expect(text).toContain('Kassabon S-2026-000123')
    expect(text).toContain('2 × Parbo Bier 1L — SRD 24.00')
    expect(text).toContain('BTW: SRD 5.36')
    expect(text).toContain('TOTAAL: SRD 59.00')
    expect(text).toContain('Betaald: Contant')
    expect(text).toContain('Wisselgeld: SRD 1.00')
    expect(text).toContain('Bedankt voor uw aankoop!')
  })

  it('shows AST wall-clock time (14:30, not shifted)', () => {
    expect(buildReceiptText(baseSale)).toContain('14:30')
  })

  it('hides subtotal/discount lines when discount is zero, shows them when set', () => {
    expect(buildReceiptText(baseSale)).not.toContain('Korting')
    const discounted = buildReceiptText({ ...baseSale, discountSrd: '5.00' })
    expect(discounted).toContain('Subtotaal: SRD 59.00')
    expect(discounted).toContain('Korting: -SRD 5.00')
  })

  it('translates to English and Sranantongo', () => {
    const en = buildReceiptText({ ...baseSale, locale: 'en' })
    expect(en).toContain('TOTAL: SRD 59.00')
    expect(en).toContain('Paid: Cash')
    const srn = buildReceiptText({ ...baseSale, locale: 'srn' })
    expect(srn).toContain('ALA SANI: SRD 59.00')
    expect(srn).toContain('Tangi fu yu bai!')
  })

  it('collapses long item lists into "+N more" but never drops totals', () => {
    const manyItems = Array.from({ length: 40 }, (_, i) => ({
      product_name: `Product ${i + 1}`, quantity: '1.000', unit_price_srd: '1.00', line_total_srd: '1.00',
    }))
    const text = buildReceiptText({ ...baseSale, items: manyItems })
    expect(text).toContain('Product 15')
    expect(text).not.toContain('Product 16')
    expect(text).toContain('… +25 meer artikelen')
    expect(text).toContain('TOTAAL: SRD 59.00')
  })

  it('shows the payment provider when present', () => {
    const text = buildReceiptText({ ...baseSale, paymentMethod: 'qr_payment', paymentProvider: 'Mopé' })
    expect(text).toContain('QR-betaling (Mopé)')
  })
})

describe('normalizeWhatsAppPhone', () => {
  it('keeps full international numbers, digits only', () => {
    expect(normalizeWhatsAppPhone('+597 881-2345')).toBe('5978812345')
  })
  it('prefixes 597 for bare 7-digit Suriname mobiles', () => {
    expect(normalizeWhatsAppPhone('8812345')).toBe('5978812345')
  })
  it('strips 00 international prefix', () => {
    expect(normalizeWhatsAppPhone('005978812345')).toBe('5978812345')
  })
  it('returns empty for garbage', () => {
    expect(normalizeWhatsAppPhone('abc')).toBe('')
    expect(normalizeWhatsAppPhone('')).toBe('')
  })
})

describe('buildWhatsAppLink', () => {
  it('targets the chat when a phone is given', () => {
    const link = buildWhatsAppLink('8812345', 'Hallo')
    expect(link).toBe('https://wa.me/5978812345?text=Hallo')
  })
  it('falls back to the chat picker with no phone', () => {
    const link = buildWhatsAppLink('', 'Bon')
    expect(link).toBe('https://wa.me/?text=Bon')
  })
  it('URL-encodes the receipt text', () => {
    const link = buildWhatsAppLink('', 'TOTAAL: SRD 59.00\nTangi!')
    expect(link).toContain(encodeURIComponent('TOTAAL: SRD 59.00\nTangi!'))
    expect(link).not.toContain(' ')
  })
})

// ── serverConfig (kept in this file to avoid a new vitest environment spin-up) ──
import { normalizeServerUrl } from '../serverConfig'

describe('normalizeServerUrl', () => {
  it('adds scheme and /api to a bare host:port', () => {
    expect(normalizeServerUrl('192.168.0.250:8080')).toBe('http://192.168.0.250:8080/api')
  })
  it('strips trailing slashes before appending /api', () => {
    expect(normalizeServerUrl('http://192.168.0.250:8080/')).toBe('http://192.168.0.250:8080/api')
  })
  it('leaves a complete https base untouched', () => {
    expect(normalizeServerUrl('https://pos.example.sr/api')).toBe('https://pos.example.sr/api')
  })
  it('returns empty for blank input', () => {
    expect(normalizeServerUrl('   ')).toBe('')
  })
})
