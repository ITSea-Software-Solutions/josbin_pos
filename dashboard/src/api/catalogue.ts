import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string
  organisation_id: string
  name_nl: string
  name_en: string
  sort_order: number
  is_active: boolean
  product_count?: number
}

export interface Product {
  id: string
  organisation_id: string
  category_id: string | null
  category_name?: string
  category?: { id: string; name_nl: string; name_en: string } | null
  name_nl: string
  name_en: string
  barcode: string | null
  sku: string | null
  price: string           // DECIMAL as string
  cost_price?: string | null   // OA/SA only — stripped server-side for SM/cashier
  margin?: string | null       // computed server-side when cost visible
  margin_pct?: string | null
  btw_rate: string        // DECIMAL as string
  btw_exempt: boolean
  stock_qty: string       // DECIMAL as string
  image_path: string | null
  image_url?: string | null    // absolute URL — computed/storage-link
  brand: string | null
  supplier: string | null
  unit: 'each' | 'kg' | 'g' | 'l' | 'ml' | 'pak'
  description_nl: string | null
  description_en: string | null
  is_active: boolean
  created_at: string
}

export interface CreateCategoryPayload {
  name_nl: string
  name_en: string
  sort_order?: number
  organisation_id?: string   // super admin only — target org
}

export interface CreateProductPayload {
  name_nl: string
  name_en: string
  category_id?: string | null
  barcode?: string
  sku?: string
  price: string
  cost_price?: string | null
  btw_rate: string
  btw_exempt?: boolean
  stock_qty?: string
  brand?: string | null
  supplier?: string | null
  unit?: 'each' | 'kg' | 'g' | 'l' | 'ml' | 'pak'
  description_nl?: string | null
  description_en?: string | null
  image_path?: string | null
  organisation_id?: string   // super admin only — target org
}

/**
 * Upload a product image. Returns the relative image_path stored on the
 * product + an absolute image_url ready to <img src={…}>.
 *
 * 5 MB max, jpeg/png/webp only — backend rejects anything else.
 */
// ─── Variants (stage 2) ─────────────────────────────────────────────────────

export interface ProductVariant {
  id: string
  product_id: string
  organisation_id: string
  sku: string | null
  barcode: string | null
  name_nl: string
  name_en: string
  sort_order: number
  price: string | null            // null = inherit parent
  cost_price?: string | null      // OA/SA only; stripped for SM
  effective_price: string         // computed server-side
  effective_cost?: string | null  // OA/SA only
  stock_qty: string
  low_stock_threshold: string | null
  attributes: Record<string, unknown> | null
  is_active: boolean
}

export interface CreateVariantPayload {
  name_nl: string
  name_en: string
  sku?: string | null
  barcode?: string | null
  sort_order?: number
  price?: string | null
  cost_price?: string | null
  stock_qty?: string
  low_stock_threshold?: string | null
  attributes?: Record<string, unknown> | null
  is_active?: boolean
}

export async function getVariants(productId: string): Promise<ProductVariant[]> {
  const res = await apiClient.get<{ data: ProductVariant[] }>(`/products/${productId}/variants`)
  return res.data.data
}

export async function createVariant(productId: string, payload: CreateVariantPayload): Promise<ProductVariant> {
  const res = await apiClient.post<{ data: ProductVariant }>(`/products/${productId}/variants`, payload)
  return res.data.data
}

export async function updateVariant(productId: string, variantId: string, payload: Partial<CreateVariantPayload>): Promise<ProductVariant> {
  const res = await apiClient.put<{ data: ProductVariant }>(`/products/${productId}/variants/${variantId}`, payload)
  return res.data.data
}

export async function deleteVariant(productId: string, variantId: string): Promise<void> {
  await apiClient.delete(`/products/${productId}/variants/${variantId}`)
}

// ─── Image upload ───────────────────────────────────────────────────────────

export async function uploadProductImage(productId: string, file: File): Promise<{ image_path: string; image_url: string }> {
  const form = new FormData()
  form.append('image', file)
  // Existing endpoint returns the fields at top level (not wrapped in `data`).
  const res = await apiClient.post<{ image_path: string; image_url: string }>(
    `/products/${productId}/image`, form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return res.data
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(orgId?: string): Promise<Category[]> {
  const params = orgId ? { organisation_id: orgId } : {}
  const res = await apiClient.get<{ data: Category[] }>('/categories', { params })
  return res.data.data
}

export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
  const res = await apiClient.post<{ data: Category }>('/categories', payload)
  return res.data.data
}

export async function updateCategory(id: string, payload: Partial<CreateCategoryPayload> & { is_active?: boolean }): Promise<Category> {
  const res = await apiClient.put<{ data: Category }>(`/categories/${id}`, payload)
  return res.data.data
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(params?: { organisation_id?: string; category_id?: string; search?: string }): Promise<Product[]> {
  const res = await apiClient.get<{ data: Product[] }>('/products', { params })
  return res.data.data
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const res = await apiClient.post<{ data: Product }>('/products', payload)
  return res.data.data
}

export async function updateProduct(id: string, payload: Partial<CreateProductPayload> & { is_active?: boolean }): Promise<Product> {
  const res = await apiClient.put<{ data: Product }>(`/products/${id}`, payload)
  return res.data.data
}

export interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
}

export async function importProducts(file: File): Promise<ImportResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiClient.post<ImportResult>('/products/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function exportProducts(): Promise<void> {
  const res = await apiClient.get('/products/export', { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `josbin-products-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadImportTemplate(format: 'csv' | 'xlsx' = 'csv'): Promise<void> {
  const res = await apiClient.get('/products/import/template', {
    responseType: 'blob',
    params: format === 'xlsx' ? { format: 'xlsx' } : undefined,
  })
  const mime = format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv'
  const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = `josbin-products-template.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
