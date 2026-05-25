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
  name_nl: string
  name_en: string
  barcode: string | null
  price: string           // DECIMAL as string
  btw_rate: string        // DECIMAL as string
  btw_exempt: boolean
  stock_qty: string       // DECIMAL as string
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
  price: string
  btw_rate: string
  btw_exempt?: boolean
  stock_qty?: string
  organisation_id?: string   // super admin only — target org
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
