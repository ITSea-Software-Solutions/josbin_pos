import { describe, expect, it } from 'vitest'
import {
  generateLabelSheetHTML,
  labelCode,
  toEan13,
  type LabelItem,
} from '@/lib/labelSheet'

const product = (over: Partial<LabelItem['product']> = {}): LabelItem['product'] => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  name_nl: 'Pindakaas 500g',
  name_en: 'Peanut butter 500g',
  barcode: '8712345678906',
  price: '24.5',
  ...over,
})

describe('toEan13', () => {
  it('strips non-digits and pads to 12 digits', () => {
    expect(toEan13('ABC-123')).toBe('000000000123')
    expect(toEan13('87123456789')).toBe('087123456789')
  })

  it('truncates longer input to the 12-digit EAN body', () => {
    expect(toEan13('8712345678906999')).toBe('871234567890')
  })
})

describe('labelCode', () => {
  it('prefers the product barcode', () => {
    expect(labelCode(product())).toBe('8712345678906')
  })

  it('falls back to a digest of the product id when barcode is missing', () => {
    expect(labelCode(product({ barcode: null }))).toBe('a1b2c3d4e5f6')
  })
})

describe('generateLabelSheetHTML', () => {
  const dataUrls = new Map([[product().id, 'data:image/png;base64,QQ==']])

  it('renders one label per unit of qty', () => {
    const html = generateLabelSheetHTML(
      [{ product: product(), qty: 3 }], '50x30', true, true, false, dataUrls,
    )
    expect(html.match(/class="label"/g)).toHaveLength(3)
  })

  it('respects showName/showPrice toggles and locale', () => {
    const nl = generateLabelSheetHTML(
      [{ product: product(), qty: 1 }], '50x30', true, true, true, dataUrls,
    )
    expect(nl).toContain('Pindakaas 500g')
    expect(nl).toContain('SRD 24.50')

    const bare = generateLabelSheetHTML(
      [{ product: product(), qty: 1 }], '50x30', false, false, false, dataUrls,
    )
    expect(bare).not.toContain('Peanut butter')
    expect(bare).not.toContain('SRD 24.50')
    expect(bare).toContain('8712345678906')   // barcode text always printed
  })

  it('sizes labels from the selected format and embeds the barcode image', () => {
    const html = generateLabelSheetHTML(
      [{ product: product(), qty: 1 }], '36x24', true, true, false, dataUrls,
    )
    expect(html).toContain('width: 36mm; height: 24mm')
    expect(html).toContain('src="data:image/png;base64,QQ=="')
  })
})
