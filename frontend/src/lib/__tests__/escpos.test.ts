import { describe, expect, it } from 'vitest'
import {
  buildReceiptBytes,
  cashDrawerPulse,
  cashDrawerPulseInJob,
  drawerVariants,
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
  // The pulse is INIT + ESC p, not the bare ESC p. A naked 5-byte control
  // fragment was refused outright by the Android USB bulk endpoint —
  // "USB write failed after 0 of 5 bytes" — on a printer that had accepted a
  // full receipt seconds before. Windows' spooler tolerated it, Android did
  // not. Do not "simplify" this back to the bare pulse.
  // 200 ms on-time (t1 = 100 units of 2 ms), not Epson's 25.
  //
  // The 50 ms default is specified for a 12 V drawer. Under a Posiflex till
  // the drawer is usually 24 V and often will not throw its latch that fast —
  // the write succeeds, the printer reports success, and nothing moves. That
  // failure has no error anywhere to find, which is why it survived several
  // releases. Do not lower this to "match the spec": the spec's number is for
  // different hardware.
  it('cashDrawerPulse(1) is a well-formed job: INIT then ESC p 0, 200 ms', () => {
    expect(Array.from(cashDrawerPulse(1)))
      .toEqual([0x1b, 0x40, 0x1b, 0x74, 19, 0x1b, 0x70, 0x00, 100, 100])
  })

  it('cashDrawerPulse(2) drives the second pin', () => {
    expect(Array.from(cashDrawerPulse(2)))
      .toEqual([0x1b, 0x40, 0x1b, 0x74, 19, 0x1b, 0x70, 0x01, 100, 100])
  })

  it('accepts a custom on-time and converts ms to ESC p 2 ms units', () => {
    expect(Array.from(cashDrawerPulse(1, 50))[8]).toBe(25)
    expect(Array.from(cashDrawerPulse(1, 400))[8]).toBe(200)
  })

  it('clamps a pulse the byte cannot carry instead of wrapping it', () => {
    // 600 ms would be 300 units — truncating to a byte gives 44, a 88 ms
    // pulse, i.e. silently the opposite of what was asked for.
    expect(Array.from(cashDrawerPulse(1, 600))[8]).toBe(255)
    expect(Array.from(cashDrawerPulse(1, 0))[8]).toBe(1)
  })

  it('the in-job variant ends with printable data', () => {
    // Some firmware discards a job containing nothing printable, drawer
    // command included. A space and a feed makes it a real job.
    const b = Array.from(cashDrawerPulseInJob(1))
    expect(b.slice(-2)).toEqual([0x20, 0x0a])
  })

  it('offers every combination worth trying, each labelled for a human', () => {
    const v = drawerVariants()
    expect(v.length).toBeGreaterThanOrEqual(6)
    expect(new Set(v.map((x) => x.id)).size).toBe(v.length)
    // Both pins and both pulse lengths must be represented, or the sweep
    // cannot actually locate the fault it exists to find.
    expect(v.some((x) => x.pin === 1)).toBe(true)
    expect(v.some((x) => x.pin === 2)).toBe(true)
    expect(v.some((x) => x.onMs === 50)).toBe(true)
    expect(v.some((x) => x.onMs === 200)).toBe(true)
    expect(v.some((x) => x.inJob)).toBe(true)
    for (const x of v) expect(x.label).toMatch(/Pin [25]/)
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

describe('escpos — the shop\'s own footer stamp', () => {
  // Nothing is stamped by default. A receipt is the customer's record of what
  // they paid, not advertising space for the till vendor — so the footer image
  // is the SHOP's, uploaded by them, or there is none.
  const GS_V_0 = [0x1d, 0x76, 0x30, 0x00]

  // 240x16 of solid ink — enough to assert the raster header without
  // depending on any particular artwork.
  const fakeStamp = {
    bits: new Uint8Array(30 * 16).fill(0xff),
    width: 240,
    height: 16,
  }

  it('prints nothing when the shop has uploaded no image', () => {
    expect(indexOfSubsequence(buildReceiptBytes(makeReceiptOptions()), GS_V_0)).toBe(-1)
  })

  it('prints the shop\'s image when there is one', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp }))
    expect(indexOfSubsequence(bytes, GS_V_0)).toBeGreaterThan(-1)
  })

  it('stays off when the till switches stamps off, image or not', () => {
    const bytes = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp, stamp: false }))
    expect(indexOfSubsequence(bytes, GS_V_0)).toBe(-1)
  })

  it('declares width in BYTES and height in DOTS, little-endian', () => {
    // Getting these two backwards is the classic way to print noise.
    const bytes = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp }))
    const at = indexOfSubsequence(bytes, GS_V_0)
    // The IMAGE's own width, not the head's. Padding every row out to the
    // full head tripled the payload and made the printer chew through blank
    // dots on every receipt; centring is done by moving the head instead.
    expect(bytes[at + 4] | (bytes[at + 5] << 8)).toBe(30)   // 240 dots / 8
    expect(bytes[at + 6] | (bytes[at + 7] << 8)).toBe(16)
  })

  it('ships the same image bytes whatever the paper width', () => {
    // Paper width now changes only the INDENT, never the payload — a 58 mm
    // roll should not cost a different number of bytes for the same image.
    const wide   = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp }))
    const narrow = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp, paperWidth: 58 }))
    for (const b of [wide, narrow]) {
      const at = indexOfSubsequence(b, GS_V_0)
      expect(b[at + 4] | (b[at + 5] << 8)).toBe(30)
    }
  })

  it('centres by moving the head (ESC $), not by padding the data', () => {
    // Several ESC/POS clones ignore ESC a for raster data and left-align it,
    // so justification is not an option — but ESC $, an absolute horizontal
    // position in dots, is widely honoured and costs no bytes per row.
    const bytes = buildReceiptBytes(makeReceiptOptions({ stampBits: fakeStamp }))
    const at = indexOfSubsequence(bytes, GS_V_0)
    // ESC $ nL nH immediately precedes the raster header.
    expect(bytes[at - 4]).toBe(0x1b)
    expect(bytes[at - 3]).toBe(0x24)
    const indent = bytes[at - 2] | (bytes[at - 1] << 8)
    expect(indent).toBe(Math.floor(((72 - 30) / 2) * 8))   // centred on a 576-dot head

    // ...and the first row is IMAGE data, not the blank padding it used to be.
    const firstRow = bytes.slice(at + 8, at + 8 + 30)
    expect(firstRow.some((b) => b !== 0x00)).toBe(true)
  })

  it('prints no QR — the verification code was removed from the receipt', () => {
    expect(indexOfSubsequence(buildReceiptBytes(makeReceiptOptions()), [0x1d, 0x28, 0x6b])).toBe(-1)
  })
})

