import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { CartItem, CartDiscount, CartTotals, Customer, Product } from '@/types/models'
import {
  computeCart,
  computeLine,
  mul4,
  parse,
  pctToSrd,
  stripUnitPrice,
  toMoney,
  type CartLineInput,
  type Dec4,
} from '@/lib/btwMath'

// All money arithmetic lives in lib/btwMath.ts — exact fixed-point decimal
// that mirrors the backend's BtwCalculationService operation for operation
// (same truncating scale-4 intermediates, same half-up cent rounding, same
// sale-discount allocation). Both engines are pinned against the shared
// vectors in backend/tests/Fixtures/btw_vectors.json, so the figures the
// cart shows are the figures the server will persist — a requirement once
// standalone tills keep their own books.

/** Derive the exact-decimal line input the engine (and the wire) sees. */
function toLineInput(item: Omit<CartItem, 'computed'>, saleExempt: boolean): CartLineInput {
  const unitPrice = String(item.unitPriceOverride ?? item.product.price)
  const btwRate = String(item.btwRateOverride ?? item.product.btw_rate)

  // Sale-level BTW exemption (vrijstelling): the buyer pays the price
  // WITHOUT the BTW component — strip it per unit, rounded to the cent,
  // exactly like the backend's stripBtwForExemptSale.
  const stripped =
    saleExempt && !item.product.btw_exempt && parse(btwRate) > 0n
      ? stripUnitPrice(unitPrice, btwRate)
      : undefined

  const price4: Dec4 = stripped ?? parse(unitPrice)

  let discountSrd4: Dec4 | undefined
  if (item.discount && item.discount.value > 0) {
    discountSrd4 =
      item.discount.type === 'percent'
        ? pctToSrd(mul4(price4, parse(String(item.quantity))), item.discount.value)
        : parse(String(item.discount.value))
  }

  return {
    unitPrice,
    unitPrice4: stripped,
    quantity: item.quantity,
    btwRate,
    btwExempt: saleExempt ? true : item.product.btw_exempt,
    discountSrd4,
  }
}

function computeItem(item: Omit<CartItem, 'computed'>, saleExempt = false): CartItem['computed'] {
  const input = toLineInput(item, saleExempt)
  const line = computeLine(input)
  const price4 = input.unitPrice4 ?? parse(input.unitPrice)

  return {
    unitPrice: toMoney(price4),
    subtotal: toMoney(line.lineGross),
    discountAmount: toMoney(line.appliedDiscount4),
    taxableBase: toMoney(line.lineNet),
    btwAmount: toMoney(line.btwAmount),
    lineTotal: toMoney(line.lineTotal),
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
  const inputs = items.map((i) => toLineInput(i, saleExempt))

  const saleDiscountSrd4 =
    saleDiscount.type === 'fixed' && saleDiscount.value > 0 ? parse(String(saleDiscount.value)) : 0n
  const saleDiscountPct =
    saleDiscount.type === 'percent' && saleDiscount.value > 0 ? saleDiscount.value : 0

  const cart = computeCart(inputs, saleDiscountSrd4, saleDiscountPct)

  return {
    subtotal: toMoney(cart.subtotal),
    saleDiscountAmount: toMoney(cart.saleDiscount),
    btwTotal: toMoney(cart.btwTotal),
    total: toMoney(cart.total),
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
