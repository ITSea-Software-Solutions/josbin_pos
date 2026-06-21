import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore } from '@/store/cartStore'
import type { CartDiscount, CartItem, Customer, Product } from '@/types/models'

// ─── Test fixtures ───────────────────────────────────────────────────────────
//
// All prices are tax-inclusive SRD strings — the store extracts BTW from the
// taxable base using: btw = base - base / (1 + rate/100).
//
// Product P10 (11.00 incl. 10% BTW): subtotal 11.00, btw 1.00, base 11.00
// Product P05 (21.00 incl. 5% BTW):  subtotal 21.00, btw 1.00, base 21.00
// Product PX  (5.00 BTW-exempt):     subtotal 5.00,  btw 0.00, base 5.00

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    organisation_id: 'org-1',
    category_id: 'cat-1',
    name_nl: 'Brood',
    name_en: 'Bread',
    barcode: '1234567890123',
    price: '11.00',
    btw_rate: '10.00',
    btw_exempt: false,
    stock_qty: 100,
    image_url: null,
    ...overrides,
  }
}

const P10 = makeProduct({ id: 'p10', name_nl: 'P10', name_en: 'P10' })
const P10_ALT = makeProduct({ id: 'p10b', name_nl: 'P10b', name_en: 'P10b' })
const P05 = makeProduct({
  id: 'p05',
  name_nl: 'P05',
  name_en: 'P05',
  price: '21.00',
  btw_rate: '5.00',
})
const PX = makeProduct({
  id: 'px',
  name_nl: 'PX',
  name_en: 'PX',
  price: '5.00',
  btw_rate: '0.00',
  btw_exempt: true,
})

const ALICE: Customer = {
  id: 'cust-1',
  organisation_id: 'org-1',
  name: 'Alice',
  phone: '+597 555-0100',
  email: 'alice@example.com',
  total_spend_srd: '0.00',
  visit_count: 0,
}

// Reset the Zustand store between tests so each starts from a clean slate.
beforeEach(() => {
  useCartStore.getState().clearCart()
})

describe('cartStore — addProduct', () => {
  it('adds a single item and populates computed fields', () => {
    useCartStore.getState().addProduct(P10)

    const { items, totals } = useCartStore.getState()
    expect(items).toHaveLength(1)

    const line = items[0]
    expect(line.product.id).toBe('p10')
    expect(line.quantity).toBe(1)
    expect(line.computed.unitPrice).toBe('11.00')
    expect(line.computed.subtotal).toBe('11.00')
    expect(line.computed.discountAmount).toBe('0.00')
    expect(line.computed.taxableBase).toBe('11.00')
    expect(line.computed.btwAmount).toBe('1.00')
    expect(line.computed.lineTotal).toBe('11.00')

    expect(totals.subtotal).toBe('11.00')
    expect(totals.btwTotal).toBe('1.00')
    expect(totals.total).toBe('11.00')
  })

  it('merges quantity when the same product is added twice (no duplicate rows)', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().addProduct(P10)

    const { items } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
    expect(items[0].computed.subtotal).toBe('22.00')
    expect(items[0].computed.taxableBase).toBe('22.00')
    expect(items[0].computed.btwAmount).toBe('2.00')
    expect(items[0].computed.lineTotal).toBe('22.00')
  })
})

describe('cartStore — updateQuantity / removeItem', () => {
  it('removes the row when quantity is updated to 0', () => {
    useCartStore.getState().addProduct(P10)
    expect(useCartStore.getState().items).toHaveLength(1)

    useCartStore.getState().updateQuantity('p10', 0)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.totals.subtotal).toBe('0.00')
    expect(state.totals.total).toBe('0.00')
  })

  it('removes the row when quantity is updated to a negative value', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().updateQuantity('p10', -3)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('recomputes the line when quantity changes', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().updateQuantity('p10', 3)

    const line = useCartStore.getState().items[0]
    expect(line.quantity).toBe(3)
    expect(line.computed.subtotal).toBe('33.00')
    expect(line.computed.btwAmount).toBe('3.00')
    expect(line.computed.lineTotal).toBe('33.00')
  })

  it('removeItem deletes the row and rebuilds totals', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().addProduct(P05)
    expect(useCartStore.getState().items).toHaveLength(2)

    useCartStore.getState().removeItem('p10')

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].product.id).toBe('p05')
    expect(state.totals.subtotal).toBe('21.00')
    expect(state.totals.btwTotal).toBe('1.00')
  })
})

describe('cartStore — line-item discounts', () => {
  it('applies a percent line discount and adjusts discountAmount / lineTotal / btw', () => {
    useCartStore.getState().addProduct(P10) // 11.00 incl. 10%
    useCartStore.getState().updateItemDiscount('p10', { type: 'percent', value: 10 })

    const line = useCartStore.getState().items[0]
    // subtotal 11.00, discount 1.10, taxableBase 9.90
    expect(line.computed.subtotal).toBe('11.00')
    expect(line.computed.discountAmount).toBe('1.10')
    expect(line.computed.taxableBase).toBe('9.90')
    // 9.90 - 9.90/1.10 = 0.90
    expect(line.computed.btwAmount).toBe('0.90')
    expect(line.computed.lineTotal).toBe('9.90')
  })

  it('applies a fixed SRD line discount and adjusts the computed fields', () => {
    useCartStore.getState().addProduct(P10) // 11.00 incl. 10%
    useCartStore.getState().updateItemDiscount('p10', { type: 'fixed', value: 1 })

    const line = useCartStore.getState().items[0]
    // subtotal 11.00, discount 1.00, taxableBase 10.00
    expect(line.computed.discountAmount).toBe('1.00')
    expect(line.computed.taxableBase).toBe('10.00')
    // 10 - 10/1.10 = 0.9090909... → "0.91"
    expect(line.computed.btwAmount).toBe('0.91')
    expect(line.computed.lineTotal).toBe('10.00')
  })

  it('caps a fixed discount at the line subtotal', () => {
    useCartStore.getState().addProduct(P10) // 11.00
    useCartStore.getState().updateItemDiscount('p10', { type: 'fixed', value: 999 })

    const line = useCartStore.getState().items[0]
    expect(line.computed.discountAmount).toBe('11.00')
    expect(line.computed.taxableBase).toBe('0.00')
    expect(line.computed.lineTotal).toBe('0.00')
  })
})

describe('cartStore — sale-level discount', () => {
  it('proportionally rebates a mixed-rate cart and recomputes BTW per line', () => {
    // Item A: 11.00 incl 10% → base 11.00, btw 1.00
    // Item B: 21.00 incl 5%  → base 21.00, btw 1.00
    // Pre-discount cart subtotal 32.00, btwTotal 2.00
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().addProduct(P05)

    const before = useCartStore.getState().totals
    expect(before.subtotal).toBe('32.00')
    expect(before.btwTotal).toBe('2.00')
    expect(before.total).toBe('32.00')

    // 10% sale-level discount → 3.20 off
    useCartStore.getState().setSaleDiscount({ type: 'percent', value: 10 })

    const after = useCartStore.getState().totals
    expect(after.subtotal).toBe('32.00')
    expect(after.saleDiscountAmount).toBe('3.20')
    expect(after.total).toBe('28.80')

    // ratio = 28.8 / 32 = 0.9 → each line's taxable base shrinks 10%
    // Item A adjusted: 11 * 0.9 = 9.9 → 9.9 - 9.9/1.10 = 0.90
    // Item B adjusted: 21 * 0.9 = 18.9 → 18.9 - 18.9/1.05 = 0.90
    expect(after.btwTotal).toBe('1.80')
  })

  it('caps a fixed sale discount at the cart subtotal', () => {
    useCartStore.getState().addProduct(P10) // 11.00
    useCartStore.getState().setSaleDiscount({ type: 'fixed', value: 9999 })

    const totals = useCartStore.getState().totals
    expect(totals.saleDiscountAmount).toBe('11.00')
    expect(totals.total).toBe('0.00')
    // ratio = 0 → btw collapses to 0
    expect(totals.btwTotal).toBe('0.00')
  })

  it('clearSaleDiscount resets discount and totals', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().setSaleDiscount({ type: 'percent', value: 25 })
    expect(useCartStore.getState().totals.saleDiscountAmount).toBe('2.75')

    useCartStore.getState().clearSaleDiscount()

    const state = useCartStore.getState()
    expect(state.saleDiscount).toEqual({ type: 'percent', value: 0 })
    expect(state.totals.saleDiscountAmount).toBe('0.00')
    expect(state.totals.total).toBe('11.00')
  })
})

describe('cartStore — mixed BTW rates', () => {
  it('sums correctly when a cart contains 10%, 5% and BTW-exempt items', () => {
    useCartStore.getState().addProduct(P10) // 11.00 incl 10% → btw 1.00
    useCartStore.getState().addProduct(P05) // 21.00 incl 5%  → btw 1.00
    useCartStore.getState().addProduct(PX)  // 5.00 exempt    → btw 0.00

    const { items, totals } = useCartStore.getState()
    expect(items).toHaveLength(3)

    const exemptLine = items.find((i) => i.product.id === 'px')!
    expect(exemptLine.computed.btwAmount).toBe('0.00')
    expect(exemptLine.computed.taxableBase).toBe('5.00')
    expect(exemptLine.computed.lineTotal).toBe('5.00')

    expect(totals.subtotal).toBe('37.00')
    expect(totals.btwTotal).toBe('2.00')
    expect(totals.total).toBe('37.00')
  })
})

describe('cartStore — BTW-exempt behaviour', () => {
  it('ignores BTW even when a line discount is applied to an exempt product', () => {
    useCartStore.getState().addProduct(PX) // 5.00 exempt
    useCartStore.getState().updateItemDiscount('px', { type: 'percent', value: 10 })

    const line = useCartStore.getState().items[0]
    expect(line.computed.subtotal).toBe('5.00')
    expect(line.computed.discountAmount).toBe('0.50')
    expect(line.computed.taxableBase).toBe('4.50')
    expect(line.computed.btwAmount).toBe('0.00')
    expect(line.computed.lineTotal).toBe('4.50')

    expect(useCartStore.getState().totals.btwTotal).toBe('0.00')
  })

  it('keeps an exempt line at btw=0 even when a sale-level discount is active', () => {
    useCartStore.getState().addProduct(PX) // exempt, 5.00
    useCartStore.getState().addProduct(P10) // 10%, 11.00
    useCartStore.getState().setSaleDiscount({ type: 'percent', value: 50 })

    const { totals } = useCartStore.getState()
    // subtotal 16, discount 8, ratio 0.5
    // P10 adjusted base 5.5 → btw = 5.5 - 5.5/1.10 = 0.50
    // PX exempt → 0
    expect(totals.subtotal).toBe('16.00')
    expect(totals.saleDiscountAmount).toBe('8.00')
    expect(totals.btwTotal).toBe('0.50')
    expect(totals.total).toBe('8.00')
  })
})

describe('cartStore — restoreCart', () => {
  it('re-derives computed for items that arrive without a computed block (held bill)', () => {
    // Simulate a held bill where items were persisted without `computed`
    // (legacy / seeded rows). We use `as unknown as CartItem[]` because the
    // production code path explicitly recomputes on restore.
    const rawItems = [
      {
        product: P10,
        quantity: 2,
        unitPriceOverride: null,
        btwRateOverride: null,
        discount: null,
      },
      {
        product: P05,
        quantity: 1,
        unitPriceOverride: null,
        btwRateOverride: null,
        discount: { type: 'percent', value: 10 } as CartDiscount,
      },
    ] as unknown as CartItem[]

    useCartStore.getState().restoreCart(rawItems, ALICE, { type: 'percent', value: 0 })

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(2)
    expect(state.customer?.id).toBe('cust-1')

    const lineA = state.items.find((i) => i.product.id === 'p10')!
    expect(lineA.computed).toBeDefined()
    expect(lineA.computed.subtotal).toBe('22.00')
    expect(lineA.computed.btwAmount).toBe('2.00')
    expect(lineA.computed.lineTotal).toBe('22.00')

    const lineB = state.items.find((i) => i.product.id === 'p05')!
    expect(lineB.computed.subtotal).toBe('21.00')
    expect(lineB.computed.discountAmount).toBe('2.10')
    expect(lineB.computed.taxableBase).toBe('18.90')
    // 18.9 - 18.9/1.05 = 0.90
    expect(lineB.computed.btwAmount).toBe('0.90')
    expect(lineB.computed.lineTotal).toBe('18.90')

    expect(state.totals.subtotal).toBe('40.90')
    expect(state.totals.btwTotal).toBe('2.90')
    expect(state.totals.total).toBe('40.90')
  })

  it('restores the sale discount alongside items and customer', () => {
    const rawItems = [
      {
        product: P10,
        quantity: 1,
        unitPriceOverride: null,
        btwRateOverride: null,
        discount: null,
      },
    ] as unknown as CartItem[]

    useCartStore
      .getState()
      .restoreCart(rawItems, ALICE, { type: 'percent', value: 50 })

    const state = useCartStore.getState()
    expect(state.saleDiscount).toEqual({ type: 'percent', value: 50 })
    expect(state.totals.saleDiscountAmount).toBe('5.50')
    expect(state.totals.total).toBe('5.50')
  })
})

describe('cartStore — clearCart', () => {
  it('resets items, customer, sale discount and totals to empty', () => {
    useCartStore.getState().addProduct(P10)
    useCartStore.getState().addProduct(P10_ALT)
    useCartStore.getState().setCustomer(ALICE)
    useCartStore.getState().setSaleDiscount({ type: 'percent', value: 10 })

    // Sanity: cart is non-empty
    expect(useCartStore.getState().items).toHaveLength(2)
    expect(useCartStore.getState().customer).not.toBeNull()

    useCartStore.getState().clearCart()

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(0)
    expect(state.customer).toBeNull()
    expect(state.saleDiscount).toEqual({ type: 'percent', value: 0 })
    expect(state.totals).toEqual({
      subtotal: '0.00',
      saleDiscountAmount: '0.00',
      btwTotal: '0.00',
      total: '0.00',
    })
  })
})

describe('cartStore — customer attach / detach', () => {
  it('attaches a customer via setCustomer', () => {
    expect(useCartStore.getState().customer).toBeNull()

    useCartStore.getState().setCustomer(ALICE)
    expect(useCartStore.getState().customer).toEqual(ALICE)
  })

  it('detaches the customer when setCustomer(null) is called', () => {
    useCartStore.getState().setCustomer(ALICE)
    expect(useCartStore.getState().customer?.id).toBe('cust-1')

    useCartStore.getState().setCustomer(null)
    expect(useCartStore.getState().customer).toBeNull()
  })

  it('does not change items or totals when a customer is attached', () => {
    useCartStore.getState().addProduct(P10)
    const totalsBefore = useCartStore.getState().totals

    useCartStore.getState().setCustomer(ALICE)
    const totalsAfter = useCartStore.getState().totals

    expect(totalsAfter).toEqual(totalsBefore)
    expect(useCartStore.getState().items).toHaveLength(1)
  })
})

describe('cartStore — restoreCart (held bills)', () => {
  it('restores a full-CartItem hold (real POS shape)', () => {
    const item: CartItem = {
      product: P10,
      quantity: 2,
      unitPriceOverride: null,
      btwRateOverride: null,
      discount: null,
      computed: {
        unitPrice: '11.00', subtotal: '22.00', discountAmount: '0.00',
        taxableBase: '22.00', btwAmount: '2.00', lineTotal: '22.00',
      },
    }
    useCartStore.getState().restoreCart([item], null, { type: 'fixed', value: 0 } as CartDiscount)
    const { items, totals } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].product.id).toBe('p10')
    expect(items[0].quantity).toBe(2)
    expect(items[0].computed.lineTotal).toBe('22.00')
    expect(totals.total).toBe('22.00')
  })

  it('restores a THIN seeded/legacy hold (no nested product) without crashing', () => {
    // The shape DemoSeeder/legacy rows store: flat, no `product` object.
    const thin = {
      product_id: 'seed-1', name: 'Fernandes Cola',
      unit_price: '11.00', quantity: 3, btw_rate: '10.00',
    }
    expect(() =>
      useCartStore.getState().restoreCart([thin], null, { type: 'fixed', value: 0 } as CartDiscount),
    ).not.toThrow()

    const { items, totals } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].product.id).toBe('seed-1')
    expect(items[0].product.name_nl).toBe('Fernandes Cola')
    expect(items[0].quantity).toBe(3)
    // 3 × 11.00 = 33.00 incl. 10% BTW → base 33.00, btw 3.00
    expect(items[0].computed.lineTotal).toBe('33.00')
    expect(items[0].computed.btwAmount).toBe('3.00')
    expect(totals.total).toBe('33.00')
  })

  it('tolerates a missing/empty items array', () => {
    expect(() =>
      useCartStore.getState().restoreCart([], null, { type: 'fixed', value: 0 } as CartDiscount),
    ).not.toThrow()
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
