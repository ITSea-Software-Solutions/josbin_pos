import { describe, expect, it } from 'vitest'
import {
  buildReceiptBytes,
  cashDrawerPulse,
  paperCut,
  encodeCp858Char,
  type EscPosReceiptOptions,
} from '@/lib/escpos'

// ── Helpers ────────────────────────────────────────────────────────────────

function bytesToLatin1(bytes: Uint8Array): string {
  // Decode as Latin-1 so escpos.ts's 1-byte-per-char encoding round-trips.
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i])
  return out
}

function indexOfSubsequence(haystack: Uint8Array, needle: number[]): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function makeReceiptOptions(
  overrides: Partial<EscPosReceiptOptions> = {}
): EscPosReceiptOptions {
  return {
    locale: 'nl',
    store: {
      name: 'Supermarkt De Hoop',
      receipt_header: 'Paramaribo',
      receipt_footer: 'Tot ziens!',
      btw_number: 'BTW-001234',
    },
    sale: {
      sale_number: 'S-0001',
      occurred_at: '2026-05-26 10:15',
      cashier_name: 'Anna',
      customer_name: 'Walk-in',
      payment_method: 'cash',
      subtotal_srd: '11.00',
      discount_srd: '0.00',
      total_srd: '11.00',
      btw_srd: '1.00',
      cash_tendered: '20.00',
      change: '9.00',
      items: [
        {
          product_name: 'Brood',
          quantity: '1',
          unit_price_srd: '11.00',
          line_total_srd: '11.00',
          discount_srd: '0.00',
          btw_rate: '10.00',
          btw_exempt: false,
        },
      ],
    },
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('escpos — buildReceiptBytes', () => {
  it('returns a Uint8Array beginning with the ESC @ init sequence (0x1B 0x40)', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())

    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    expect(bytes[0]).toBe(0x1b) // ESC
    expect(bytes[1]).toBe(0x40) // @
  })

  it('embeds the store name string in the byte stream', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const text = bytesToLatin1(bytes)

    expect(text).toContain('Supermarkt De Hoop')
  })

  it('includes Dutch labels when locale is nl', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ locale: 'nl' }))
    const text = bytesToLatin1(bytes)

    expect(text).toContain('Bon nr.')
    expect(text).toContain('TOTAAL')
    expect(text).toContain('Bedankt voor uw bezoek!')
  })

  it('includes English labels when locale is en', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ locale: 'en' }))
    const text = bytesToLatin1(bytes)

    expect(text).toContain('Receipt no.')
    expect(text).toContain('TOTAL')
    expect(text).toContain('Thank you for your visit!')
  })

  it('ends with a paper-cut command (GS V B 0x01 for partial cut)', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const cutSeq = [0x1d, 0x56, 0x42, 0x01]
    expect(indexOfSubsequence(bytes, cutSeq)).toBeGreaterThan(-1)
  })
})

describe('escpos — control commands', () => {
  it('cashDrawerPulse(1) returns ESC p 0 t1 t2', () => {
    const bytes = cashDrawerPulse(1)
    expect(Array.from(bytes)).toEqual([0x1b, 0x70, 0x00, 0x19, 0xfa])
  })

  it('cashDrawerPulse(2) returns ESC p 1 t1 t2', () => {
    const bytes = cashDrawerPulse(2)
    expect(Array.from(bytes)).toEqual([0x1b, 0x70, 0x01, 0x19, 0xfa])
  })

  it('paperCut() defaults to a full cut (GS V B 0x00)', () => {
    expect(Array.from(paperCut())).toEqual([0x1d, 0x56, 0x42, 0x00])
  })

  it('paperCut(true) returns a partial cut (GS V B 0x01)', () => {
    expect(Array.from(paperCut(true))).toEqual([0x1d, 0x56, 0x42, 0x01])
  })
})

describe('escpos — CP858 code page (accented characters on real printers)', () => {
  it('INIT selects code page 858 (ESC t 19) so accents render on hardware', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    expect(indexOfSubsequence(bytes, [0x1b, 0x74, 19])).toBeGreaterThan(-1)
  })

  it('encodes é/ë/ó as CP858 bytes, not Latin-1', () => {
    expect(encodeCp858Char('é')).toBe(0x82) // Latin-1 would be 0xE9
    expect(encodeCp858Char('ë')).toBe(0x89)
    expect(encodeCp858Char('ó')).toBe(0xa2)
    expect(encodeCp858Char('ñ')).toBe(0xa4)
    expect(encodeCp858Char('€')).toBe(0xd5)
  })

  it('passes ASCII through unchanged and transliterates unmapped accents', () => {
    expect(encodeCp858Char('A')).toBe(0x41)
    expect(encodeCp858Char('ő')).toBe(0x6f) // Hungarian ő → base 'o'
    expect(encodeCp858Char('世')).toBe(0x3f) // no base letter → '?'
  })

  it('product names with accents land in the receipt as CP858 bytes', () => {
    const opts = makeReceiptOptions()
    opts.sale.payment_method = 'qr_payment'
    opts.sale.payment_provider = 'Mopé'
    const bytes = buildReceiptBytes(opts)
    // 'Mopé' → 4d 6f 70 82
    expect(indexOfSubsequence(bytes, [0x4d, 0x6f, 0x70, 0x82])).toBeGreaterThan(-1)
  })
})

describe('escpos — paper width', () => {
  it('defaults to 42 columns (80 mm)', () => {
    const text = bytesToLatin1(buildReceiptBytes(makeReceiptOptions()))
    expect(text).toContain('='.repeat(42))
  })

  it('paperWidth 58 prints 32-column separators and no 42-wide lines', () => {
    const text = bytesToLatin1(buildReceiptBytes(makeReceiptOptions({ paperWidth: 58 })))
    expect(text).toContain('='.repeat(32))
    expect(text).not.toContain('='.repeat(42))
    expect(text).not.toContain('-'.repeat(42))
  })
})

describe('escpos — BTW rate label from items', () => {
  it('single distinct rate prints that rate', () => {
    const text = bytesToLatin1(buildReceiptBytes(makeReceiptOptions()))
    expect(text).toContain('BTW 10%')
  })

  it('mixed rates fall back to a plain BTW label (no wrong percentage)', () => {
    const opts = makeReceiptOptions()
    opts.sale.items = [
      { ...opts.sale.items[0] },
      { ...opts.sale.items[0], product_name: 'Melk', btw_rate: '5.00' },
    ]
    const text = bytesToLatin1(buildReceiptBytes(opts))
    expect(text).not.toContain('BTW 10%')
    expect(text).not.toContain('BTW 5%')
  })
})
