import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CartItem, CartDiscount, CartTotals, Customer, Product } from '@/types/models'

// All arithmetic uses string-based decimal math to avoid floating point.
// We rely on toFixed(2) for display and comparison — the backend
// re-validates every figure before persisting. This is intentional.

function toDecimal(val: string | number): number {
  return parseFloat(String(val)) || 0
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function computeItem(item: Omit<CartItem, 'computed'>): CartItem['computed'] {
  const unitPrice = toDecimal(item.unitPriceOverride ?? item.product.price)
  const qty = item.quantity
  const subtotal = unitPrice * qty

  // Item-level discount
  let discountAmount = 0
  if (item.discount) {
    discountAmount =
      item.discount.type === 'percent'
        ? subtotal * (item.discount.value / 100)
        : Math.min(item.discount.value, subtotal)
  }

  const taxableBase = subtotal - discountAmount

  // BTW extracted from taxable base (inclusive method — correct for SRD/BTW)
  const btwRateDecimal = toDecimal(item.btwRateOverride ?? item.product.btw_rate) / 100
  const btwAmount = item.product.btw_exempt
    ? 0
    : taxableBase - taxableBase / (1 + btwRateDecimal)

  const lineTotal = taxableBase

  return {
    unitPrice: fmt(unitPrice),
    subtotal: fmt(subtotal),
    discountAmount: fmt(discountAmount),
    taxableBase: fmt(taxableBase),
    btwAmount: fmt(btwAmount),
    lineTotal: fmt(lineTotal),
  }
}

function computeTotals(items: CartItem[], saleDiscount: CartDiscount): CartTotals {
  const subtotal = items.reduce((sum, i) => sum + toDecimal(i.computed.taxableBase), 0)

  let saleDiscountAmount = 0
  if (saleDiscount.value > 0) {
    saleDiscountAmount =
      saleDiscount.type === 'percent'
        ? subtotal * (saleDiscount.value / 100)
        : Math.min(saleDiscount.value, subtotal)
  }

  // Re-distribute sale discount proportionally across items to get correct BTW
  const postSaleDiscountTotal = subtotal - saleDiscountAmount
  const ratio = subtotal > 0 ? postSaleDiscountTotal / subtotal : 1

  const btwTotal = items.reduce((sum, i) => {
    if (i.product.btw_exempt) return sum
    const adjustedBase = toDecimal(i.computed.taxableBase) * ratio
    const btwRate = toDecimal(i.btwRateOverride ?? i.product.btw_rate) / 100
    const btw = adjustedBase - adjustedBase / (1 + btwRate)
    return sum + btw
  }, 0)

  return {
    subtotal: fmt(subtotal),
    saleDiscountAmount: fmt(saleDiscountAmount),
    btwTotal: fmt(btwTotal),
    total: fmt(subtotal - saleDiscountAmount),
  }
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[]
  customer: Customer | null
  saleDiscount: CartDiscount
  totals: CartTotals

  // Actions
  addProduct: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: CartDiscount | null) => void
  updateItemOverrides: (
    productId: string,
    overrides: { unitPriceOverride?: string | null; btwRateOverride?: string | null }
  ) => void
  setSaleDiscount: (discount: CartDiscount) => void
  clearSaleDiscount: () => void
  setCustomer: (customer: Customer | null) => void
  clearCart: () => void
  restoreCart: (items: CartItem[], customer: Customer | null, saleDiscount: CartDiscount) => void
}

const EMPTY_DISCOUNT: CartDiscount = { type: 'percent', value: 0 }

const EMPTY_TOTALS: CartTotals = {
  subtotal: '0.00',
  saleDiscountAmount: '0.00',
  btwTotal: '0.00',
  total: '0.00',
}

function rebuildTotals(items: CartItem[], saleDiscount: CartDiscount): CartTotals {
  if (items.length === 0) return EMPTY_TOTALS
  return computeTotals(items, saleDiscount)
}

export const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],
      customer: null,
      saleDiscount: EMPTY_DISCOUNT,
      totals: EMPTY_TOTALS,

      addProduct: (product) => {
        const { items, saleDiscount } = get()
        const existing = items.find((i) => i.product.id === product.id)

        let updatedItems: CartItem[]

        if (existing) {
          // Increment quantity
          updatedItems = items.map((i) => {
            if (i.product.id !== product.id) return i
            const updated = { ...i, quantity: i.quantity + 1 }
            return { ...updated, computed: computeItem(updated) }
          })
        } else {
          const newItem: Omit<CartItem, 'computed'> = {
            product,
            quantity: 1,
            unitPriceOverride: null,
            btwRateOverride: null,
            discount: null,
          }
          updatedItems = [...items, { ...newItem, computed: computeItem(newItem) }]
        }

        set({
          items: updatedItems,
          totals: rebuildTotals(updatedItems, saleDiscount),
        })
      },

      removeItem: (productId) => {
        const { items, saleDiscount } = get()
        const updatedItems = items.filter((i) => i.product.id !== productId)
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount) })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        const { items, saleDiscount } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, quantity }
          return { ...updated, computed: computeItem(updated) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount) })
      },

      updateItemDiscount: (productId, discount) => {
        const { items, saleDiscount } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, discount }
          return { ...updated, computed: computeItem(updated) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount) })
      },

      updateItemOverrides: (productId, overrides) => {
        const { items, saleDiscount } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, ...overrides }
          return { ...updated, computed: computeItem(updated) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount) })
      },

      setSaleDiscount: (saleDiscount) => {
        const { items } = get()
        set({ saleDiscount, totals: rebuildTotals(items, saleDiscount) })
      },

      clearSaleDiscount: () => {
        const { items } = get()
        set({ saleDiscount: EMPTY_DISCOUNT, totals: rebuildTotals(items, EMPTY_DISCOUNT) })
      },

      setCustomer: (customer) => set({ customer }),

      clearCart: () =>
        set({
          items: [],
          customer: null,
          saleDiscount: EMPTY_DISCOUNT,
          totals: EMPTY_TOTALS,
        }),

      restoreCart: (items, customer, saleDiscount) => {
        // Recompute all items (in case prices changed since bill was held)
        const recomputed = items.map((i) => ({
          ...i,
          computed: computeItem(i),
        }))
        set({
          items: recomputed,
          customer,
          saleDiscount,
          totals: rebuildTotals(recomputed, saleDiscount),
        })
      },
    }),
    { name: 'Josbin POS:cart' }
  )
)
