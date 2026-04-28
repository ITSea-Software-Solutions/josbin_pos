import apiClient from './client'
import type { Customer } from '@/types/models'

export async function searchCustomers(search: string): Promise<Customer[]> {
  const { data } = await apiClient.get<{ data: Customer[] }>('/customers', {
    params: { search, per_page: 10 },
  })
  return data.data
}

export async function createCustomer(payload: {
  name: string
  phone?: string
  email?: string
}): Promise<Customer> {
  const { data } = await apiClient.post<{ data: Customer }>('/customers', payload)
  return data.data
}
