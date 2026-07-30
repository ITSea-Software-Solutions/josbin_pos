import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  computeCart,
  mul4,
  parse,
  pctToSrd,
  stripUnitPrice,
  toMoney,
  type CartLineInput,
  type Dec4,
} from '@/lib/btwMath'

/**
 * Cross-vector contract test — the frontend half.
 *
 * Reads the SAME frozen fixture the backend's BtwCrossVectorTest pins
 * (backend/tests/Fixtures/btw_vectors.json — expected values generated from
 * the bcmath engine and hand-checked). Every figure the cart engine produces
 * must equal the backend's, to the cent, for every vector with scope "both".
 */

interface VectorItem {
  unit_price: string
  quantity: string
  btw_rate: string
  btw_exempt: boolean
  discount_srd?: string
  discount_pct?: string
}

interface Vector {
  id: string
  title: string
  scope: 'both' | 'php'
  sale_btw_exempt?: boolean
  items: VectorItem[]
  sale_discount_srd?: string
  sale_discount_pct?: string
  expected: {
    subtotal: string
    sale_discount: string
    btw_total: string
    total: string
    lines: { discount_srd_wire: string; btw_amount: string; line_total: string }[]
  }
}

// vitest runs with cwd = frontend/; the fixture is the backend's copy — ONE
// physical file for both engines (import.meta.url is not a file: URL under
// the jsdom test environment, hence the cwd-relative resolve).
const doc = JSON.parse(
  readFileSync(resolve(process.cwd(), '../backend/tests/Fixtures/btw_vectors.json'), 'utf8'),
) as { vectors: Vector[] }

const vectors = doc.vectors.filter((v) => v.scope === 'both')

describe('BTW cross-vectors — cart engine must match the backend to the cent', () => {
  it('covers the fixture (both-scope vectors present)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(20)
  })

  for (const vector of vectors) {
    it(`${vector.id} — ${vector.title}`, () => {
      const saleExempt = vector.sale_btw_exempt ?? false

      const inputs: CartLineInput[] = vector.items.map((item, idx) => {
        const stripped =
          saleExempt && !item.btw_exempt && parse(item.btw_rate) > 0n
            ? stripUnitPrice(item.unit_price, item.btw_rate)
            : undefined
        const price4: Dec4 = stripped ?? parse(item.unit_price)

        let discountSrd4: Dec4 | undefined
        if (item.discount_pct !== undefined) {
          discountSrd4 = pctToSrd(mul4(price4, parse(item.quantity)), item.discount_pct)
        } else if (item.discount_srd !== undefined) {
          discountSrd4 = parse(item.discount_srd)
        }

        // The SRD amount that would go on the wire must match the frozen rule.
        expect(toMoney(discountSrd4 ?? 0n), `${vector.id} line ${idx} wire discount`).toBe(
          vector.expected.lines[idx].discount_srd_wire === '0.00'
            ? '0.00'
            : vector.expected.lines[idx].discount_srd_wire,
        )

        return {
          unitPrice: item.unit_price,
          unitPrice4: stripped,
          quantity: item.quantity,
          btwRate: item.btw_rate,
          btwExempt: saleExempt ? true : item.btw_exempt,
          discountSrd4,
        }
      })

      const cart = computeCart(
        inputs,
        parse(vector.sale_discount_srd ?? '0'),
        vector.sale_discount_pct ?? '0',
      )

      expect(toMoney(cart.subtotal), `${vector.id} subtotal`).toBe(vector.expected.subtotal)
      expect(toMoney(cart.saleDiscount), `${vector.id} sale_discount`).toBe(vector.expected.sale_discount)
      expect(toMoney(cart.btwTotal), `${vector.id} btw_total`).toBe(vector.expected.btw_total)
      expect(toMoney(cart.total), `${vector.id} total`).toBe(vector.expected.total)

      cart.lines.forEach((line, idx) => {
        expect(toMoney(line.btwAmount), `${vector.id} line ${idx} btw`).toBe(
          vector.expected.lines[idx].btw_amount,
        )
        expect(toMoney(line.lineTotal), `${vector.id} line ${idx} total`).toBe(
          vector.expected.lines[idx].line_total,
        )
      })
    })
  }
})
