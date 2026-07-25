/**
 * Barcode label sheet generation — shared by the Barcode & Label Printing
 * screen and the Settings → Printer hardware test.
 *
 * Everything is generated in-browser (jsbarcode/qrcode → canvas → data URL,
 * then one self-contained HTML document with inline CSS). No network
 * requests — works offline and inside Docker.
 */
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

export interface LabelProduct {
  id: string
  name_nl: string
  name_en: string
  barcode: string | null
  price: string
}

export interface LabelItem {
  product: LabelProduct
  qty: number
}

export type BarcodeType = 'EAN13' | 'Code128' | 'QR'
export type LabelSize   = '36x24' | '50x30' | '60x40'

export const LABEL_SIZES: Record<LabelSize, { w: number; h: number; label: string }> = {
  '36x24': { w: 36, h: 24, label: '36 × 24 mm' },
  '50x30': { w: 50, h: 30, label: '50 × 30 mm' },
  '60x40': { w: 60, h: 40, label: '60 × 40 mm' },
}

/** ~96 dpi CSS pixels per millimetre. */
export const PX_PER_MM = 3.78

/** The value encoded on a product's label: its barcode, or a stable digest of its id. */
export function labelCode(product: LabelProduct): string {
  return product.barcode ?? product.id.replace(/-/g, '').slice(0, 12)
}

/**
 * Normalise a string to a valid 12-digit EAN-13 body (checksum auto-calculated by JsBarcode).
 * Strips non-digits and zero-pads or truncates to 12 digits.
 */
export function toEan13(code: string): string {
  return code.replace(/\D/g, '').slice(0, 12).padStart(12, '0')
}

/**
 * Generate a barcode/QR data URL entirely in-browser using jsbarcode + qrcode.
 */
export async function barcodeDataUrl(code: string, type: BarcodeType, widthPx: number, heightPx: number): Promise<string> {
  if (type === 'QR') {
    return QRCode.toDataURL(code, {
      width: Math.min(widthPx, heightPx),
      margin: 1,
      errorCorrectionLevel: 'M',
    })
  }

  // EAN-13: code must be exactly 12 or 13 digits. Fall back to CODE128 if invalid.
  const format = type === 'EAN13' ? 'EAN13' : 'CODE128'
  const safeCode = format === 'EAN13' ? toEan13(code) : code

  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, safeCode, {
      format,
      displayValue: false,
      margin: 2,
      width: Math.max(1, Math.round(widthPx / Math.max(safeCode.length * 7, 40))),
      height: Math.round(heightPx * 0.85),
    })
  } catch {
    // If JsBarcode rejects the value (e.g. bad EAN-13 check digit), fall back to CODE128
    JsBarcode(canvas, code, { format: 'CODE128', displayValue: false, margin: 2, height: Math.round(heightPx * 0.85) })
  }
  return canvas.toDataURL('image/png')
}

export function generateLabelSheetHTML(
  items: LabelItem[],
  labelSize: LabelSize,
  showPrice: boolean,
  showName: boolean,
  isNl: boolean,
  dataUrls: Map<string, string>,   // productId → barcode data URL
): string {
  const { w, h } = LABEL_SIZES[labelSize]

  const labels: string[] = []
  for (const { product, qty } of items) {
    const code = labelCode(product)
    const name = isNl ? product.name_nl : product.name_en
    const price = `SRD ${parseFloat(product.price).toFixed(2)}`
    const imgUrl = dataUrls.get(product.id) ?? ''

    for (let i = 0; i < qty; i++) {
      labels.push(`
        <div class="label">
          ${showName ? `<div class="lname">${name}</div>` : ''}
          ${imgUrl ? `<img src="${imgUrl}" alt="${code}" class="bimg" />` : ''}
          <div class="bcode">${code}</div>
          ${showPrice ? `<div class="lprice">${price}</div>` : ''}
        </div>
      `)
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Labels</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; }
  .sheet { display: flex; flex-wrap: wrap; gap: 2mm; padding: 5mm; }
  .label {
    width: ${w}mm; height: ${h}mm;
    border: 0.3mm solid #ccc;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 1mm; overflow: hidden; page-break-inside: avoid;
  }
  .lname { font-size: 6px; font-weight: 600; text-align: center; width: 100%;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 1px; }
  .bimg { max-width: 100%; max-height: ${Math.round(h * 0.5)}mm; object-fit: contain; }
  .bcode { font-size: 5px; margin-top: 1px; letter-spacing: 0.5px; color: #333; }
  .lprice { font-size: 7px; font-weight: 700; margin-top: 1px; color: #000; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { padding: 3mm; gap: 1mm; }
  }
</style>
</head>
<body>
  <div class="sheet">${labels.join('')}</div>
</body>
</html>`
}
