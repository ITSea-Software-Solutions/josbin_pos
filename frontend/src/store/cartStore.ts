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

function computeItem(item: Omit<CartItem, 'computed'>, saleExempt = false): CartItem['computed'] {
  let unitPrice = toDecimal(item.unitPriceOverride ?? item.product.price)
  const rateForStrip = toDecimal(item.btwRateOverride ?? item.product.btw_rate)
  // Sale-level BTW exemption (vrijstelling): the buyer pays the price
  // WITHOUT the BTW component, so strip it from the unit price. Rounded to
  // the cent per unit — the exact rule the backend applies, so the cart
  // shows the same figures the server will persist.
  if (saleExempt && !item.product.btw_exempt && rateForStrip > 0) {
    unitPrice = Math.round((unitPrice / (1 + rateForStrip / 100)) * 100) / 100
  }
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
  const btwAmount = item.product.btw_exempt || saleExempt
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

/**
 * Held-bill cart_data is an unversioned JSON blob. Real POS holds store full
 * CartItems (with a nested `product`), but seeded / legacy / partial rows can
 * carry a thin shape ({ product_id, name, unit_price, quantity, btw_rate }).
 * Normalize either into a CartItem so restoring a bill never crashes on a
 * missing `item.product` (which would otherwise throw and silently abort the
 * restore). Unknown fields fall back to safe defaults.
 */
function normalizeHeldItem(raw: unknown): Omit<CartItem, 'computed'> {
  const r = (raw ?? {}) as Record<string, any>

  // Already a full CartItem (real hold) — keep its product as-is.
  const product: Product = r.product && typeof r.product === 'object'
    ? r.product
    : {
        id: String(r.product_id ?? r.id ?? ''),
        organisation_id: String(r.organisation_id ?? ''),
        category_id: String(r.category_id ?? ''),
        name_nl: String(r.name_nl ?? r.name ?? ''),
        name_en: String(r.name_en ?? r.name ?? ''),
        barcode: r.barcode ?? null,
        price: String(r.unit_price ?? r.price ?? '0'),
        btw_rate: String(r.btw_rate ?? '0'),
        btw_exempt: Boolean(r.btw_exempt ?? false),
        stock_qty: Number(r.stock_qty ?? 0),
        image_url: r.image_url ?? null,
      }

  return {
    product,
    quantity: Number(r.quantity) || 1,
    unitPriceOverride: r.unitPriceOverride ?? null,
    btwRateOverride: r.btwRateOverride ?? null,
    discount: r.discount ?? null,
  }
}

function computeTotals(items: CartItem[], saleDiscount: CartDiscount, saleExempt = false): CartTotals {
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

  const btwTotal = saleExempt ? 0 : items.reduce((sum, i) => {
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
  // Sale-level BTW exemption (vrijstelling) — reason is mandatory and
  // travels to the backend, the receipt and the audit trail.
  btwExempt: boolean
  btwExemptReason: string | null
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
  setBtwExemption: (reason: string) => void
  clearBtwExemption: () => void
  clearCart: () => void
  // items is loosely typed: held-bill cart_data may be full CartItems (real
  // holds) or a thin seeded/legacy shape — normalizeHeldItem handles both.
  restoreCart: (items: readonly unknown[], customer: Customer | null, saleDiscount: CartDiscount) => void
}

const EMPTY_DISCOUNT: CartDiscount = { type: 'percent', value: 0 }

const EMPTY_TOTALS: CartTotals = {
  subtotal: '0.00',
  saleDiscountAmount: '0.00',
  btwTotal: '0.00',
  total: '0.00',
}

function rebuildTotals(items: CartItem[], saleDiscount: CartDiscount, saleExempt = false): CartTotals {
  if (items.length === 0) return EMPTY_TOTALS
  return computeTotals(items, saleDiscount, saleExempt)
}

/** Recompute every line under the given exemption state (prices restrip/restore). */
function recomputeItems(items: CartItem[], saleExempt: boolean): CartItem[] {
  return items.map((i) => ({ ...i, computed: computeItem(i, saleExempt) }))
}

export const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      items: [],
      customer: null,
      saleDiscount: EMPTY_DISCOUNT,
      btwExempt: false,
      btwExemptReason: null,
      totals: EMPTY_TOTALS,

      addProduct: (product) => {
        const { items, saleDiscount, btwExempt } = get()
        const existing = items.find((i) => i.product.id === product.id)

        let updatedItems: CartItem[]

        if (existing) {
          // Increment quantity
          updatedItems = items.map((i) => {
            if (i.product.id !== product.id) return i
            const updated = { ...i, quantity: i.quantity + 1 }
            return { ...updated, computed: computeItem(updated, btwExempt) }
          })
        } else {
          const newItem: Omit<CartItem, 'computed'> = {
            product,
            quantity: 1,
            unitPriceOverride: null,
            btwRateOverride: null,
            discount: null,
          }
          updatedItems = [...items, { ...newItem, computed: computeItem(newItem, btwExempt) }]
        }

        set({
          items: updatedItems,
          totals: rebuildTotals(updatedItems, saleDiscount, btwExempt),
        })
      },

      removeItem: (productId) => {
        const { items, saleDiscount, btwExempt } = get()
        const updatedItems = items.filter((i) => i.product.id !== productId)
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount, btwExempt) })
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        const { items, saleDiscount, btwExempt } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, quantity }
          return { ...updated, computed: computeItem(updated, btwExempt) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount, btwExempt) })
      },

      updateItemDiscount: (productId, discount) => {
        const { items, saleDiscount, btwExempt } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, discount }
          return { ...updated, computed: computeItem(updated, btwExempt) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount, btwExempt) })
      },

      updateItemOverrides: (productId, overrides) => {
        const { items, saleDiscount, btwExempt } = get()
        const updatedItems = items.map((i) => {
          if (i.product.id !== productId) return i
          const updated = { ...i, ...overrides }
          return { ...updated, computed: computeItem(updated, btwExempt) }
        })
        set({ items: updatedItems, totals: rebuildTotals(updatedItems, saleDiscount, btwExempt) })
      },

      setSaleDiscount: (saleDiscount) => {
        const { items, btwExempt } = get()
        set({ saleDiscount, totals: rebuildTotals(items, saleDiscount, btwExempt) })
      },

      clearSaleDiscount: () => {
        const { items, btwExempt } = get()
        set({ saleDiscount: EMPTY_DISCOUNT, totals: rebuildTotals(items, EMPTY_DISCOUNT, btwExempt) })
      },

      setBtwExemption: (reason) => {
        const { items, saleDiscount } = get()
        const recomputed = recomputeItems(items, true)
        set({
          btwExempt: true,
          btwExemptReason: reason,
          items: recomputed,
          totals: rebuildTotals(recomputed, saleDiscount, true),
        })
      },

      clearBtwExemption: () => {
        const { items, saleDiscount } = get()
        const recomputed = recomputeItems(items, false)
        set({
          btwExempt: false,
          btwExemptReason: null,
          items: recomputed,
          totals: rebuildTotals(recomputed, saleDiscount, false),
        })
      },

      setCustomer: (customer) => set({ customer }),

      clearCart: () =>
        set({
          items: [],
          customer: null,
          saleDiscount: EMPTY_DISCOUNT,
          btwExempt: false,
          btwExemptReason: null,
          totals: EMPTY_TOTALS,
        }),

      restoreCart: (items, customer, saleDiscount) => {
        // Normalize first — held-bill JSON may carry full CartItems (real
        // holds) or a thin seeded/legacy shape with no nested `product`.
        // Then recompute (in case prices changed since the bill was held).
        const recomputed = (items ?? []).map((i) => {
          const norm = normalizeHeldItem(i)
          return { ...norm, computed: computeItem(norm) }
        })
        const discount = saleDiscount ?? EMPTY_DISCOUNT
        set({
          items: recomputed,
          customer: customer ?? null,
          // Held bills predate any exemption toggle — always restore clean.
          btwExempt: false,
          btwExemptReason: null,
          saleDiscount: discount,
          totals: rebuildTotals(recomputed, discount),
        })
      },
    }),
    { name: 'Josbin POS:cart' }
  )
)
