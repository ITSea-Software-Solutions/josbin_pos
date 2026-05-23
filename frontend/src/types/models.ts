// Core domain types mirroring the backend database schema
// All monetary values are strings to preserve DECIMAL(12,2) precision

export type Locale = 'nl' | 'en'

export type UserRole =
  | 'super_admin'
  | 'organisation_admin'
  | 'store_manager'
  | 'cashier'
  | 'auditor'
  | 'api_integration'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  locale: Locale
  two_factor_enabled: boolean
  requires_2fa: boolean
  organisation_id: string
  permissions: string[]
  last_login_at: string | null
}

export interface Organisation {
  id: string
  name: string
  type: 'retail' | 'govt' | 'wholesale'
  btw_number: string
  currency: 'SRD'
  locale: Locale
  is_government: boolean
  subscription_tier: string
}

export interface Store {
  id: string
  organisation_id: string
  name: string
  address: string
  city: string
  default_btw_rate: string // DECIMAL(5,2)
  receipt_header: string
  receipt_footer: string
  receipt_logo_path?: string | null
  settings?: { receipt_btw_number?: string } & Record<string, unknown>
  organisation?: { id: string; name: string; btw_number?: string | null }
  is_active: boolean
  pos_type: 'native' | 'external'
}

export interface Category {
  id: string
  organisation_id: string
  name_nl: string
  name_en: string
  sort_order: number
}

export interface Product {
  id: string
  organisation_id: string
  category_id: string
  category?: Category
  name_nl: string
  name_en: string
  barcode: string | null
  price: string // DECIMAL(12,2) SRD
  btw_rate: string // DECIMAL(5,2)
  btw_exempt: boolean
  stock_qty: number
  image_url: string | null
}

export interface Customer {
  id: string
  organisation_id: string
  name: string
  phone: string | null
  email: string | null
  total_spend_srd: string
  visit_count: number
}

export type PaymentMethod = 'cash' | 'card' | 'mixed'
export type SaleStatus = 'completed' | 'voided' | 'held'

export interface SaleItem {
  id?: string
  product_id: string | null
  product_name_snapshot: string
  unit_price_srd: string
  quantity: string // DECIMAL(10,3)
  discount_srd: string
  discount_pct: string
  btw_rate: string
  btw_srd: string
  line_total_srd: string
}

export interface Sale {
  id: string
  store_id: string
  cashier_id: string
  customer_id: string | null
  customer?: Customer
  sale_number: string
  subtotal_srd: string
  discount_srd: string
  btw_srd: string
  total_srd: string
  payment_method: PaymentMethod
  status: SaleStatus
  source: 'pos' | 'api' | 'import'
  exchange_rate_used: string
  occurred_at: string // ISO 8601, AST
  items: SaleItem[]
}

export interface DailyRate {
  id: string
  date: string // YYYY-MM-DD
  usd_to_srd: string // DECIMAL(10,4)
  raw_rate: string
  markup_pct: string
  source: 'api' | 'manual'
  locked_at: string | null
}

export interface HeldBill {
  id: string
  store_id: string
  cashier_id: string
  customer: Customer | null
  items: CartItem[]
  sale_discount: CartDiscount
  created_at: string
  label?: string
}

// ─── Cart types (Zustand — frontend only) ────────────────────────────────────

export interface CartDiscount {
  type: 'percent' | 'fixed'
  value: number
}

export interface CartItem {
  product: Product
  quantity: number
  // Per-item overrides (set via edit line item modal)
  unitPriceOverride: string | null
  btwRateOverride: string | null
  discount: CartDiscount | null
  // Computed (recalculated on every cart change)
  computed: {
    unitPrice: string
    subtotal: string // before discount + btw
    discountAmount: string
    taxableBase: string
    btwAmount: string
    lineTotal: string
  }
}

export interface CartTotals {
  subtotal: string // sum of line totals before sale discount
  saleDiscountAmount: string
  btwTotal: string
  total: string
}
