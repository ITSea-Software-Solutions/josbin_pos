import { describe, it, expect } from 'vitest'
import { buildReceiptBytes } from '@/lib/escpos'

/**
 * "The logo and stamp don't print" was reported three times, and each round
 * started by re-deriving whether the artwork ever reaches the printer at all.
 * These lock that end down: given bitmaps in the shape the server actually
 * returns, the receipt bytes must contain the raster command — once per image.
 *
 * A failure here means the receipt builder dropped the artwork. A pass here
 * with nothing on the paper means the problem is downstream: the wrong build
 * installed, no image uploaded for that store, or ink too faint to see.
 * That is the split that kept getting guessed at.
 */
const live = {
  logo:  { b64: btoa('\u0001'.repeat(30 * 81)),  width: 240, height: 81 },
  stamp: { b64: btoa('\u00ff'.repeat(23 * 160)), width: 179, height: 160 },
}

function unpack(d: { b64: string; width: number; height: number }) {
  const bin = atob(d.b64)
  const bits = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bits[i] = bin.charCodeAt(i)
  return { bits, width: d.width, height: d.height }
}

const base = {
  sale: {
    sale_number: 'T-1', occurred_at: '29-07-2026 12:00', cashier_name: 'X',
    payment_method: 'cash' as const, subtotal_srd: '10.00', discount_srd: '0.00',
    total_srd: '10.00', btw_srd: '0.91',
    items: [{ product_name: 'P', quantity: '1', unit_price_srd: '10.00',
              line_total_srd: '10.00', discount_srd: '0.00', btw_rate: '10.00', btw_exempt: false }],
  },
  store: { name: 'S' },
  locale: 'nl' as const,
  paperWidth: 80 as const,
}

/** GS v 0 = 1D 76 30 — the raster-image command. */
function rasterCount(b: Uint8Array) {
  let n = 0
  for (let i = 0; i + 2 < b.length; i++)
    if (b[i] === 0x1d && b[i + 1] === 0x76 && b[i + 2] === 0x30) n++
  return n
}

describe('receipt artwork actually reaches the printer bytes', () => {
  it('prints neither when no bits are supplied', () => {
    expect(rasterCount(buildReceiptBytes(base))).toBe(0)
  })
  it('prints the header logo when logoBits is supplied', () => {
    const b = buildReceiptBytes({ ...base, logoBits: unpack(live.logo) })
    expect(rasterCount(b)).toBe(1)
  })
  it('prints the footer stamp when stampBits is supplied', () => {
    const b = buildReceiptBytes({ ...base, stampBits: unpack(live.stamp) })
    expect(rasterCount(b)).toBe(1)
  })
  it('prints BOTH when both are supplied — the real sale-receipt case', () => {
    const b = buildReceiptBytes({
      ...base, logoBits: unpack(live.logo), stampBits: unpack(live.stamp),
    })
    expect(rasterCount(b)).toBe(2)
  })
})
