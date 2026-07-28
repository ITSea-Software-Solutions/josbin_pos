import { describe, expect, it } from 'vitest'
import { saleToEscPosOptions, saleToReceiptText, printLocale, textLocale } from '@/lib/saleReceipt'
import type { Sale, Store } from '@/types/models'

// A saved sale as GET /sales/{id} returns it — cashier and customer loaded.
function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'e6f1c0aa-0000-4000-8000-000000000001',
    store_id: 'store-1',
    cashier_id: '9d3b7a11-dead-4beef-8000-feedfacecafe',
    cashier: { id: '9d3b7a11-dead-4beef-8000-feedfacecafe', name: 'Anna Kromodihardjo' },
    customer_id: null,
    sale_number: 'S-0042',
    subtotal_srd: '110.00',
    discount_srd: '0.00',
    btw_srd: '10.00',
    total_srd: '110.00',
    payment_method: 'cash',
    status: 'completed',
    source: 'pos',
    exchange_rate_used: '38.5000',
    occurred_at: '2026-07-28T14:05:00-03:00',
    items: [
      {
        id: 'i1', sale_id: 'e6f1c0aa-0000-4000-8000-000000000001',
        product_id: 'p1', product_name_snapshot: 'Parbo Bier 1L',
        unit_price_srd: '55.00', quantity: '2.000', discount_srd: '0.00',
        discount_pct: '0.00', btw_rate: '10.00', btw_srd: '10.00',
        line_total_srd: '110.00',
      },
    ],
    ...overrides,
  } as Sale
}

const store = {
  name: 'Josbin Store',
  receipt_header: 'Paramaribo',
  receipt_footer: 'Tot ziens!',
  settings: { receipt_btw_number: 'BTW-99887' },
  organisation: { btw_number: 'BTW-00000' },
} as unknown as Store

describe('saleReceipt — the fields that kept regressing', () => {
  // Both of these shipped wrong once: the receipt printed the raw cashier
  // UUID, and a raw ISO timestamp. They were fixed in the sale popup only —
  // Transactions built its own options object. Hence one shared builder.
  it('prints the cashier NAME, never the id', () => {
    const opts = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY',
    })
    expect(opts.sale.cashier_name).toBe('Anna Kromodihardjo')
    expect(opts.sale.cashier_name).not.toContain('-4000-')
  })

  it('prints a Suriname day-first date, not the ISO timestamp', () => {
    const opts = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY',
    })
    expect(opts.sale.occurred_at).toMatch(/^28-07-2026 \d{2}:\d{2}$/)
    expect(opts.sale.occurred_at).not.toContain('T')
  })

  it('prefers the store BTW number over the organisation one', () => {
    const opts = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY',
    })
    expect(opts.store.btw_number).toBe('BTW-99887')
  })
})

describe('saleReceipt — a reprint is not a fresh sale', () => {
  it('omits cash tendered and change when they are not supplied', () => {
    // A reprint an hour later has no idea what note the customer handed over;
    // printing "Change SRD 0.00" would be a statement, and a false one.
    const opts = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY',
    })
    expect(opts.sale.cash_tendered).toBeUndefined()
    expect(opts.sale.change).toBeUndefined()
  })

  it('emits no drawer pulse unless one is explicitly asked for', () => {
    const plain = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY',
    })
    expect(plain.openDrawer).toBeUndefined()

    const withDrawer = saleToEscPosOptions({
      sale: makeSale(), store, lang: 'nl', dateFormat: 'DD-MM-YYYY', openDrawer: 1,
    })
    expect(withDrawer.openDrawer).toBe(1)
  })
})

describe('saleReceipt — locales', () => {
  it('paper falls back to Dutch for Sranantongo; the WhatsApp text does not', () => {
    // There is no srn receipt layout, but receiptText.ts does carry srn.
    expect(printLocale('srn')).toBe('nl')
    expect(textLocale('srn')).toBe('srn')
    expect(printLocale('en-GB')).toBe('en')
    expect(textLocale('en-GB')).toBe('en')
  })

  it('builds a WhatsApp text carrying the totals and the BTW', () => {
    const text = saleToReceiptText(makeSale(), 'Josbin Store', 'nl')
    expect(text).toContain('Josbin Store')
    expect(text).toContain('S-0042')
    expect(text).toContain('Parbo Bier 1L')
    expect(text).toContain('BTW: SRD 10.00')
    expect(text).toContain('TOTAAL: SRD 110.00')
  })
})
