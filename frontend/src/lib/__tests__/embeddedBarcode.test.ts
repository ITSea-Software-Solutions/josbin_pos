import { describe, it, expect } from 'vitest'
import { parseEmbeddedBarcode, DEFAULT_EMBEDDED_BARCODE, type EmbeddedBarcodeConfig } from '../embeddedBarcode'

const priceCfg: EmbeddedBarcodeConfig = { ...DEFAULT_EMBEDDED_BARCODE, enabled: true, mode: 'price', valueDivisor: 100 }
const weightCfg: EmbeddedBarcodeConfig = { ...DEFAULT_EMBEDDED_BARCODE, enabled: true, mode: 'weight', valueDivisor: 1000 }

describe('parseEmbeddedBarcode', () => {
  it('returns null when disabled', () => {
    expect(parseEmbeddedBarcode('2123456012503', { ...priceCfg, enabled: false })).toBeNull()
  })

  it('returns null for a normal (non-prefix) barcode', () => {
    expect(parseEmbeddedBarcode('8712345678906', priceCfg)).toBeNull()
  })

  it('returns null on wrong length', () => {
    expect(parseEmbeddedBarcode('212345', priceCfg)).toBeNull()
  })

  it('returns null for non-numeric input', () => {
    expect(parseEmbeddedBarcode('2ABCDE012503', priceCfg)).toBeNull()
  })

  it('parses an embedded PRICE — 2 IIIIII VVVVV C, value in cents', () => {
    // prefix 2 | item 123456 | value 01250 (=12.50) | check 3
    const r = parseEmbeddedBarcode('2123456012503', priceCfg)
    expect(r).not.toBeNull()
    expect(r!.itemCode).toBe('123456')
    expect(r!.value).toBeCloseTo(12.5, 2)
    expect(r!.mode).toBe('price')
  })

  it('parses an embedded WEIGHT — value in grams → kg', () => {
    // item 222333 | value 01500 (=1.5 kg)
    const r = parseEmbeddedBarcode('2222333015009', weightCfg)
    expect(r).not.toBeNull()
    expect(r!.itemCode).toBe('222333')
    expect(r!.value).toBeCloseTo(1.5, 3)
    expect(r!.mode).toBe('weight')
  })

  it('honours a custom layout (prefix 21, 5-digit item, 5-digit value)', () => {
    const cfg: EmbeddedBarcodeConfig = { enabled: true, prefix: '21', mode: 'price', itemDigits: 5, valueDigits: 5, valueDivisor: 100 }
    // 21 | 54321 | 00999 (=9.99) | check 0  → length 2+5+5+1 = 13
    const r = parseEmbeddedBarcode('2154321009990', cfg)
    expect(r!.itemCode).toBe('54321')
    expect(r!.value).toBeCloseTo(9.99, 2)
  })
})
