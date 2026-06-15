/**
 * Embedded-value barcode parsing for scale-printed labels (weighed goods).
 *
 * Supermarket scales (Bizerba, CAS, Avery, Digi, …) print an EAN-13 whose
 * leading digit is in the GS1 "in-store / restricted distribution" range
 * (prefix 2). Instead of identifying a fixed product, the barcode embeds an
 * item/PLU code AND a value — either the PRICE (already weighed & priced at the
 * scale) or the WEIGHT (price computed at the till from the catalogue rate).
 *
 * The exact digit split varies by scale brand, so the layout is configurable.
 * The default is the most common EAN-13 layout:
 *
 *   2 IIIIII VVVVV C
 *   │ │      │     └ check digit (ignored — the scanner already validated it)
 *   │ │      └─────── 5-digit embedded value (price in cents, or weight in g)
 *   │ └────────────── 6-digit item / PLU code
 *   └──────────────── prefix
 *
 * NB: confirm the split + divisor against the CLIENT'S actual scale before
 * go-live — a wrong layout silently mis-prices weighed items. This util is
 * unit-tested so the contract is explicit and tunable.
 */
export interface EmbeddedBarcodeConfig {
  enabled: boolean
  prefix: string            // leading digit(s) that mark an in-store barcode (default '2')
  mode: 'price' | 'weight'  // what the embedded value represents
  itemDigits: number        // length of the item/PLU code segment
  valueDigits: number       // length of the embedded value segment
  /** value is divided by this to get SRD (price: cents → 100) or kg (weight: g → 1000) */
  valueDivisor: number
}

export const DEFAULT_EMBEDDED_BARCODE: EmbeddedBarcodeConfig = {
  enabled: false,
  prefix: '2',
  mode: 'price',
  itemDigits: 6,
  valueDigits: 5,
  valueDivisor: 100,
}

export interface EmbeddedBarcodeParsed {
  itemCode: string   // the PLU / item segment — used to look the product up
  value: number      // SRD (price mode) or kg (weight mode), already divided
  mode: 'price' | 'weight'
}

/**
 * Parse a scanned code against the config. Returns null when it is NOT an
 * embedded barcode (disabled, wrong prefix, wrong length, non-numeric) — the
 * caller then falls back to a normal product-barcode lookup.
 */
export function parseEmbeddedBarcode(
  code: string,
  cfg: EmbeddedBarcodeConfig,
): EmbeddedBarcodeParsed | null {
  if (!cfg.enabled) return null

  const raw = code.trim()
  if (!/^\d+$/.test(raw)) return null
  if (!cfg.prefix || !raw.startsWith(cfg.prefix)) return null

  const expectedLength = cfg.prefix.length + cfg.itemDigits + cfg.valueDigits + 1 // +1 check digit
  if (raw.length !== expectedLength) return null

  const itemStart = cfg.prefix.length
  const itemCode  = raw.slice(itemStart, itemStart + cfg.itemDigits)
  const valueRaw  = raw.slice(itemStart + cfg.itemDigits, itemStart + cfg.itemDigits + cfg.valueDigits)

  const divisor = cfg.valueDivisor > 0 ? cfg.valueDivisor : 1
  const value = parseInt(valueRaw, 10) / divisor
  if (Number.isNaN(value)) return null

  return { itemCode, value, mode: cfg.mode }
}
