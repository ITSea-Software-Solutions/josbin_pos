import apiClient from './client'

export interface User {
  id: string
  name: string
  email: string
  role: string
  organisation_id: string | null
  locale: string
  two_factor_enabled: boolean
  last_login_at: string | null
  is_active: boolean
  /** Stores this user is assigned to. Empty array = all stores in the org
   *  (backfill semantics — see backend User::canAccessStore). */
  store_ids?: string[]
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: string
  organisation_id: string | null
  locale: 'nl' | 'en'
  send_welcome_email?: boolean
  /** Cashier + store_manager only. Empty = all stores in org. */
  store_ids?: string[]
}

export async function getUsers(): Promise<User[]> {
  const res = await apiClient.get<{ data: User[] }>('/users')
  return res.data.data
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await apiClient.post<{ data: User }>('/users', payload)
  return res.data.data
}

export async function updateUser(
  id: string,
  payload: Partial<Omit<CreateUserPayload, 'password'>> & { is_active?: boolean; password?: string },
): Promise<User> {
  const res = await apiClient.put<{ data: User }>(`/users/${id}`, payload)
  return res.data.data
}
