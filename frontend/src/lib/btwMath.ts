/**
 * Fixed-point money math + the BTW cart engine, mirroring the backend's
 * BtwCalculationService (bcmath, scale 4) OPERATION FOR OPERATION.
 *
 * Why this exists: the cart used to compute in binary floats and round with
 * toFixed(2), while the backend computes in decimal strings and rounds
 * half-up — the two disagreed by a cent on real inputs (0.605 → BTW 0.06
 * decimal vs 0.05 float). Harmless while the backend recomputed and won;
 * fatal in standalone mode where the on-device number IS the books. Both
 * engines are pinned against the same frozen vectors:
 * backend/tests/Fixtures/btw_vectors.json.
 *
 * Representation: BigInt of (value × 10^4) — "scale 4", like bcmath here.
 *  - mul4/div4 TRUNCATE toward zero at scale 4 (exactly bcmul/bcdiv scale 4)
 *  - round2 adds half a cent then truncates (the service's bcRoundHalfUp)
 * All cart values are non-negative by construction (the backend guards this
 * server-side); parse() rejects negatives to keep the mirror honest.
 */

const SCALE = 10_000n // 4 decimal places

export type Dec4 = bigint

export function parse(value: string | number): Dec4 {
  const s = String(value ?? '0').trim()
  if (s === '' || s === '-') return 0n
  const m = /^(-)?(\d*)(?:\.(\d*))?$/.exec(s)
  if (!m) return 0n
  const negative = m[1] === '-'
  const intPart = m[2] || '0'
  const fracPart = ((m[3] || '') + '0000').slice(0, 4) // truncate past scale 4
  const units = BigInt(intPart) * SCALE + BigInt(fracPart)
  if (negative && units !== 0n) {
    throw new RangeError(`negative money value not allowed: ${s}`)
  }
  return units
}

export const add4 = (a: Dec4, b: Dec4): Dec4 => a + b
export const sub4 = (a: Dec4, b: Dec4): Dec4 => a - b

/** bcmul(a, b, 4) — full-precision product, truncated to scale 4. */
export const mul4 = (a: Dec4, b: Dec4): Dec4 => (a * b) / SCALE

/** bcdiv(a, b, 4) — quotient truncated to scale 4. */
export const div4 = (a: Dec4, b: Dec4): Dec4 => {
  if (b === 0n) throw new RangeError('division by zero')
  return (a * SCALE) / b
}

export const cmp = (a: Dec4, b: Dec4): number => (a < b ? -1 : a > b ? 1 : 0)
export const min4 = (a: Dec4, b: Dec4): Dec4 => (a < b ? a : b)

/** Half-up rounding to 2 decimals, returned at scale 4 (…xx00). */
export function round2(v: Dec4): Dec4 {
  return ((v + 50n) / 100n) * 100n
}

/** Half-up rounding to 4 decimals — a no-op at scale 4; kept for parity. */
export const round4 = (v: Dec4): Dec4 => v

/** Format as a 2-decimal display string (values are non-negative). */
export function toMoney(v: Dec4): string {
  const cents = (v + 50n) / 100n
  const whole = cents / 100n
  const frac = cents % 100n
  return `${whole}.${frac.toString().padStart(2, '0')}`
}

// ─── The cart engine (mirrors BtwCalculationService) ─────────────────────────

export interface LineInput {
  unitPrice: string   // BTW-inclusive, as entered / listed
  /** Overrides unitPrice when set — e.g. an exempt-sale stripped price. */
  unitPrice4?: Dec4
  quantity: string | number
  btwRate: string
  btwExempt: boolean
  /** Item discount in SRD at scale 4 (already includes any pct conversion). */
  discountSrd4?: Dec4
}

export interface LineResult {
  lineGross: Dec4   // round2'd, like the service's line_gross
  lineNet: Dec4     // round2'd line_net === line_total
  btwBase: Dec4
  btwAmount: Dec4
  lineTotal: Dec4
  /** The discount actually applied (post line-gross cap), scale 4. */
  appliedDiscount4: Dec4
}

/** calculateLineItem — identical op order to the PHP service. */
export function computeLine(input: LineInput): LineResult {
  const unitPrice = input.unitPrice4 ?? parse(input.unitPrice)
  const quantity = parse(String(input.quantity))
  const rate = parse(input.btwRate)

  const lineGross4 = mul4(unitPrice, quantity)
  const discount = min4(input.discountSrd4 ?? 0n, lineGross4)
  const lineNet4 = sub4(lineGross4, discount)

  let btwAmount: Dec4
  let btwBase: Dec4
  if (input.btwExempt || rate === 0n) {
    btwAmount = 0n
    btwBase = round2(lineNet4)
  } else {
    const divisor = add4(SCALE, div4(rate, parse('100'))) // 1 + rate/100
    const taxExcl = div4(lineNet4, divisor)
    btwAmount = round2(sub4(lineNet4, taxExcl))
    btwBase = round2(taxExcl)
  }

  return {
    lineGross: round2(lineGross4),
    lineNet: round2(lineNet4),
    btwBase,
    btwAmount,
    lineTotal: round2(lineNet4),
    appliedDiscount4: discount,
  }
}

/** pctToSrd — round2(base × pct / 100), the frozen wire-conversion rule. */
export function pctToSrd(base4: Dec4, pct: string | number): Dec4 {
  return round2(div4(mul4(base4, parse(String(pct))), parse('100')))
}

/** stripBtwForExemptSale's per-unit price rule: round2(price / (1 + rate/100)). */
export function stripUnitPrice(unitPrice: string, btwRate: string): Dec4 {
  const rate = parse(btwRate)
  if (rate === 0n) return round2(parse(unitPrice))
  const divisor = add4(SCALE, div4(rate, parse('100')))
  return round2(div4(parse(unitPrice), divisor))
}

export interface CartLineInput extends LineInput {}

export interface CartResult {
  subtotal: Dec4
  saleDiscount: Dec4
  btwTotal: Dec4
  total: Dec4
  lines: LineResult[]
}

/**
 * calculateCart — identical algorithm to the PHP service:
 * per-line results → additive sale discount (SRD + pct of subtotal, pct
 * truncated at scale 4) capped at subtotal → proportional allocation with
 * scale-4 truncated weights, LAST line absorbing the remainder → each line
 * recomputed with its combined discount → per-line round2'd BTW summed.
 */
export function computeCart(
  items: CartLineInput[],
  saleDiscountSrd4: Dec4 = 0n,
  saleDiscountPct: string | number = '0',
): CartResult {
  if (items.length === 0) {
    return { subtotal: 0n, saleDiscount: 0n, btwTotal: 0n, total: 0n, lines: [] }
  }

  const firstPass = items.map((i) => computeLine(i))
  let subtotal = 0n
  for (const line of firstPass) subtotal = add4(subtotal, line.lineTotal)

  let saleDiscount = 0n
  if (saleDiscountSrd4 > 0n) saleDiscount = saleDiscountSrd4
  const pct = parse(String(saleDiscountPct))
  if (pct > 0n) {
    saleDiscount = add4(saleDiscount, div4(mul4(subtotal, pct), parse('100')))
  }
  if (cmp(saleDiscount, subtotal) > 0) saleDiscount = subtotal

  const lastIndex = firstPass.length - 1
  let remaining = saleDiscount
  let btwTotal = 0n
  const lines: LineResult[] = []

  firstPass.forEach((line, i) => {
    let itemDisc: Dec4
    if (subtotal === 0n) {
      itemDisc = 0n
    } else if (i === lastIndex) {
      itemDisc = remaining
    } else {
      const weight = div4(line.lineTotal, subtotal)
      itemDisc = mul4(saleDiscount, weight)
      remaining = sub4(remaining, itemDisc)
    }

    const adjusted = computeLine({
      ...items[i],
      discountSrd4: round4(add4(items[i].discountSrd4 ?? 0n, itemDisc)),
    })
    btwTotal = add4(btwTotal, adjusted.btwAmount)
    lines.push(adjusted)
  })

  return {
    subtotal: round2(subtotal),
    saleDiscount: round2(saleDiscount),
    btwTotal: round2(btwTotal),
    total: round2(sub4(subtotal, saleDiscount)),
    lines,
  }
}
