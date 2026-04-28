import apiClient from './client'
import type { Sale, HeldBill } from '@/types/models'

export interface CreateSalePayload {
  store_id: string
  customer_id?: string | null
  payment_method: 'cash' | 'card' | 'mixed'
  cash_tendered?: number
  card_amount?: number
  sale_discount_srd?: number
  sale_discount_pct?: number
  items: Array<{
    product_id?: string | null
    product_name: string
    unit_price: number
    quantity: number
    btw_rate: number
    btw_exempt?: boolean
    discount_srd?: number
  }>
}

export async function createSale(payload: CreateSalePayload): Promise<Sale> {
  const { data } = await apiClient.post<{ data: Sale }>('/sales', payload)
  return data.data
}

export async function holdBill(payload: {
  store_id: string
  label?: string
  customer_id?: string | null
  cart_data: unknown[]
  total_srd: number
}): Promise<HeldBill> {
  const { data } = await apiClient.post<{ data: HeldBill }>('/sales/hold', payload)
  return data.data
}

export async function getHeldBills(storeId: string): Promise<HeldBill[]> {
  const { data } = await apiClient.get<{ data: HeldBill[] }>('/sales/held', {
    params: { store_id: storeId },
  })
  return data.data
}

export async function restoreHeldBill(heldBillId: string): Promise<HeldBill> {
  const { data } = await apiClient.delete<{ data: HeldBill }>(`/sales/held/${heldBillId}`)
  return data.data
}

export async function voidSale(saleId: string, reason: string): Promise<Sale> {
  const { data } = await apiClient.post<{ data: Sale }>(`/sales/${saleId}/void`, {
    void_reason: reason,
  })
  return data.data
}

export async function getSales(params: {
  store_id: string
  date?: string
  search?: string
  status?: string
  per_page?: number
  page?: number
}): Promise<{ data: Sale[]; current_page: number; last_page: number; total: number }> {
  const { data } = await apiClient.get('/sales', { params })
  return data
}

export async function getSale(saleId: string): Promise<Sale> {
  const { data } = await apiClient.get<{ data: Sale }>(`/sales/${saleId}`)
  return data.data
}

export async function sendReceiptEmail(saleId: string, locale: string): Promise<void> {
  await apiClient.post(`/sales/${saleId}/receipt/email`, { locale })
}

export function getReceiptPdfUrl(saleId: string, locale: string, cashTendered?: number, change?: number): string {
  const token = localStorage.getItem('josbin_pos_token') ?? ''
  const params = new URLSearchParams({ locale })
  if (cashTendered !== undefined) params.set('cash_tendered', String(cashTendered))
  if (change !== undefined) params.set('change', String(change))
  return `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/sales/${saleId}/receipt/pdf?${params}&token=${token}`
}
