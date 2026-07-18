import { describe, expect, it } from 'vitest'
import { looksLikeScannedCode, stripAimPrefix } from '@/lib/barcode'

describe('barcode — looksLikeScannedCode', () => {
  it('accepts the numeric retail symbologies', () => {
    expect(looksLikeScannedCode('123456')).toBe(true)          // UPC-E (6)
    expect(looksLikeScannedCode('12345670')).toBe(true)        // EAN-8
    expect(looksLikeScannedCode('123456789012')).toBe(true)    // UPC-A
    expect(looksLikeScannedCode('8712345678906')).toBe(true)   // EAN-13
    expect(looksLikeScannedCode('18712345678903')).toBe(true)  // ITF-14 / GTIN-14
    expect(looksLikeScannedCode('2123456012349')).toBe(true)   // scale barcode (prefix 2)
  })

  it('accepts alphanumeric supplier SKUs (Code 39 / Code 128)', () => {
    expect(looksLikeScannedCode('AB-1234')).toBe(true)
    expect(looksLikeScannedCode('SKU.9987')).toBe(true)
    expect(looksLikeScannedCode('X99')).toBe(false)            // too short (< 4)
  })

  it('rejects product-name searches', () => {
    expect(looksLikeScannedCode('cola')).toBe(false)           // no digits
    expect(looksLikeScannedCode('fanta 1l')).toBe(false)       // contains a space
    expect(looksLikeScannedCode('12345')).toBe(false)          // 5 digits — a price, not a code
    expect(looksLikeScannedCode('')).toBe(false)
  })
})

describe('barcode — stripAimPrefix', () => {
  it('drops a 3-char AIM symbology identifier', () => {
    expect(stripAimPrefix(']E08712345678906')).toBe('8712345678906')
    expect(stripAimPrefix(']C1AB-1234')).toBe('AB-1234')
  })

  it('leaves plain codes untouched', () => {
    expect(stripAimPrefix('8712345678906')).toBe('8712345678906')
  })
})
