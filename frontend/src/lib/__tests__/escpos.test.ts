import { describe, expect, it } from 'vitest'
import {
  buildReceiptBytes,
  cashDrawerPulse,
  paperCut,
  encodeCp858Char,
  buildVerificationPayload,
  type EscPosReceiptOptions,
} from '@/lib/escpos'
import { josbinStampBits, STAMP_WIDTH, STAMP_HEIGHT } from '@/lib/receiptStamp'

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
  // The pulse is INIT + ESC p, not the bare ESC p. A naked 5-byte control
  // fragment was refused outright by the Android USB bulk endpoint —
  // "USB write failed after 0 of 5 bytes" — on a printer that had accepted a
  // full receipt seconds before. Windows' spooler tolerated it, Android did
  // not. Do not "simplify" this back to the bare pulse.
  it('cashDrawerPulse(1) is a well-formed job: INIT then ESC p 0', () => {
    expect(Array.from(cashDrawerPulse(1)))
      .toEqual([0x1b, 0x40, 0x1b, 0x74, 19, 0x1b, 0x70, 0x00, 0x19, 0xfa])
  })

  it('cashDrawerPulse(2) drives the second pin', () => {
    expect(Array.from(cashDrawerPulse(2)))
      .toEqual([0x1b, 0x40, 0x1b, 0x74, 19, 0x1b, 0x70, 0x01, 0x19, 0xfa])
  })

  it('never ends with a line feed — the drawer test must not spit paper', () => {
    for (const pin of [1, 2] as const) {
      const b = cashDrawerPulse(pin)
      expect(b[b.length - 1]).not.toBe(0x0a)
    }
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

  it('mixed rates are itemised per rate, each with its own amount', () => {
    // Previously a mixed-rate sale printed one unlabelled "BTW" line,
    // because a single percentage would have misrepresented the basket.
    // Showing every rate with its own amount states the truth instead of
    // withholding it — and the customer can check the sum themselves.
    const opts = makeReceiptOptions()
    opts.sale.items = [
      { ...opts.sale.items[0], line_total_srd: '110.00', btw_rate: '10.00' },
      { ...opts.sale.items[0], product_name: 'Melk', line_total_srd: '105.00', btw_rate: '5.00' },
    ]
    const text = bytesToLatin1(buildReceiptBytes(opts))

    expect(text).toContain('BTW 5%')
    expect(text).toContain('BTW 10%')
    // Prices include BTW: 110 @10% → 10.00, 105 @5% → 5.00.
    expect(text).toContain('SRD 10.00')
    expect(text).toContain('SRD 5.00')
  })

  it('never prints a rate percentage the basket does not contain', () => {
    const opts = makeReceiptOptions()
    opts.sale.items = [{ ...opts.sale.items[0], btw_rate: '8.00' }]
    const text = bytesToLatin1(buildReceiptBytes(opts))
    expect(text).toContain('BTW 8%')
    expect(text).not.toContain('BTW 10%')
  })

  it('drops the trailing zeros a decimal rate carries', () => {
    // "10.00%" on paper is noise; "10%" is what a shopper reads.
    const text = bytesToLatin1(buildReceiptBytes(makeReceiptOptions()))
    expect(text).not.toContain('10.00%')
  })
})

describe('escpos — cash drawer rides the receipt', () => {
  // The drawer hangs off the printer, so a pulse is a print job. Sent as a
  // SECOND job next to the receipt it races it and the printer drops one —
  // which is exactly what happened when receipts started printing
  // automatically: paper came out, drawer stayed shut. One job, ordered by
  // the printer itself, is the only arrangement that cannot race.
  const PULSE_PIN1 = [0x1b, 0x70, 0x00, 0x19, 0xfa]
  const PULSE_PIN2 = [0x1b, 0x70, 0x01, 0x19, 0xfa]

  const contains = (hay: Uint8Array, needle: number[]) => {
    outer: for (let i = 0; i <= hay.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
      return i
    }
    return -1
  }

  it('emits no drawer pulse unless asked', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    expect(contains(bytes, PULSE_PIN1)).toBe(-1)
    expect(contains(bytes, PULSE_PIN2)).toBe(-1)
  })

  it('emits the pulse for the configured pin', () => {
    expect(contains(buildReceiptBytes({ ...makeReceiptOptions(), openDrawer: 1 }), PULSE_PIN1)).toBeGreaterThan(-1)
    expect(contains(buildReceiptBytes({ ...makeReceiptOptions(), openDrawer: 2 }), PULSE_PIN2)).toBeGreaterThan(-1)
  })

  it('puts the pulse near the front so the drawer springs as printing starts', () => {
    const bytes = buildReceiptBytes({ ...makeReceiptOptions(), openDrawer: 1 })
    // Right after INIT — well before the store name, let alone the total.
    expect(contains(bytes, PULSE_PIN1)).toBeLessThan(12)
  })
})

describe('escpos — the Josbin stamp at the foot of the receipt', () => {
  // A thermal head burns one line at a time and cannot composite, so there is
  // no "watermark behind the text" to print. The mark lands at the bottom as
  // a raster image instead — like a rubber stamp on a docket. The A4/PDF
  // receipt is where a real watermark lives (ReceiptService).
  const GS_V_0 = [0x1d, 0x76, 0x30, 0x00]

  it('emits a GS v 0 raster block by default', () => {
    expect(indexOfSubsequence(buildReceiptBytes(makeReceiptOptions()), GS_V_0))
      .toBeGreaterThan(-1)
  })

  it('omits it when the shop turns the stamp off', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ stamp: false }))
    expect(indexOfSubsequence(bytes, GS_V_0)).toBe(-1)
  })

  it('sits after the total, near the end of the ticket', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const at = indexOfSubsequence(bytes, GS_V_0)
    const totalAt = bytesToLatin1(bytes).indexOf('TOTAAL')
    expect(at).toBeGreaterThan(totalAt)
  })

  it('declares width in BYTES and height in DOTS, little-endian', () => {
    // Getting these two backwards is the classic way to print noise: the
    // command takes xL/xH as byte count and yL/yH as a dot count.
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const at = indexOfSubsequence(bytes, GS_V_0)
    const widthBytes = bytes[at + 4] | (bytes[at + 5] << 8)
    const heightDots = bytes[at + 6] | (bytes[at + 7] << 8)

    expect(widthBytes).toBe(72)              // 576-dot head on 80 mm paper
    expect(heightDots).toBe(STAMP_HEIGHT)
    // …and exactly that many payload bytes must follow, or the printer eats
    // the rest of the receipt as image data.
    expect(bytes.length - (at + 8)).toBeGreaterThanOrEqual(widthBytes * heightDots)
  })

  it('narrows to the 384-dot head on 58 mm paper', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ paperWidth: 58 }))
    const at = indexOfSubsequence(bytes, GS_V_0)
    expect(bytes[at + 4] | (bytes[at + 5] << 8)).toBe(48)
  })

  it('centres the mark by padding rows, not with an alignment command', () => {
    // Several ESC/POS clones ignore ESC a for raster data and left-align it
    // regardless, so the padding has to be in the bitmap itself.
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const at = indexOfSubsequence(bytes, GS_V_0)
    const rowStart = at + 8
    const pad = Math.floor((72 - Math.ceil(STAMP_WIDTH / 8)) / 2)
    expect(pad).toBeGreaterThan(0)
    for (let i = 0; i < pad; i++) expect(bytes[rowStart + i]).toBe(0x00)
  })

  it('is a logo, not a black bar', () => {
    const bits = josbinStampBits()
    const inked = bits.reduce((n, b) => n + b.toString(2).replace(/0/g, '').length, 0)
    const coverage = inked / (STAMP_WIDTH * STAMP_HEIGHT)
    expect(coverage).toBeGreaterThan(0.05)
    expect(coverage).toBeLessThan(0.6)
  })
})

describe('escpos — verification QR under the BTW block', () => {
  // The honest answer to "make the customer trust the BTW": a figure they can
  // have CHECKED, not an emblem asserting someone checked it. The QR carries
  // the shop's BTW registration number plus the sale's own numbers, so the
  // paper and the stored sale either agree or they do not.
  const GS_PAREN_K = [0x1d, 0x28, 0x6b]

  it('prints a QR when the store has a BTW registration number', () => {
    expect(indexOfSubsequence(buildReceiptBytes(makeReceiptOptions()), GS_PAREN_K))
      .toBeGreaterThan(-1)
  })

  it('prints none when there is no BTW number — nothing to verify against', () => {
    const opts = makeReceiptOptions()
    opts.store.btw_number = undefined
    expect(indexOfSubsequence(buildReceiptBytes(opts), GS_PAREN_K)).toBe(-1)
  })

  it('can be switched off', () => {
    expect(indexOfSubsequence(buildReceiptBytes(makeReceiptOptions({ verifyQr: false })), GS_PAREN_K))
      .toBe(-1)
  })

  it('carries the BTW number, sale number, total and BTW amount', () => {
    const text = bytesToLatin1(buildReceiptBytes(makeReceiptOptions()))
    expect(text).toContain('JOSBIN1|BTW-001234|S-0001|2026-05-26 10:15|11.00|1.00')
  })

  it('declares a payload length of data + 3 header bytes', () => {
    // Off by three here prints a truncated code that scans to nothing — which
    // is worse than no QR, because the paper looks correct.
    const payload = buildVerificationPayload({
      btwNumber: 'BTW-001234', saleNumber: 'S-0001',
      occurredAt: '2026-05-26 10:15', totalSrd: '11.00', btwSrd: '1.00',
    })
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const store = indexOfSubsequence(bytes, [0x1d, 0x28, 0x6b, ...[
      (payload.length + 3) & 0xff, ((payload.length + 3) >> 8) & 0xff, 0x31, 0x50, 0x30,
    ]])
    expect(store).toBeGreaterThan(-1)
  })

  it('issues model, size, ECC, store and print in that order', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    const at = (fn: number[]) => indexOfSubsequence(bytes, [0x1d, 0x28, 0x6b, ...fn])
    const model = at([0x04, 0x00, 0x31, 0x41])
    const size  = at([0x03, 0x00, 0x31, 0x43])
    const ecc   = at([0x03, 0x00, 0x31, 0x45])
    const print = at([0x03, 0x00, 0x31, 0x51])
    expect(model).toBeGreaterThan(-1)
    expect(size).toBeGreaterThan(model)
    expect(ecc).toBeGreaterThan(size)
    expect(print).toBeGreaterThan(ecc)
  })

  it('sits above the stamp — verify first, branding last', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions())
    expect(indexOfSubsequence(bytes, GS_PAREN_K))
      .toBeLessThan(indexOfSubsequence(bytes, [0x1d, 0x76, 0x30, 0x00]))
  })
})
