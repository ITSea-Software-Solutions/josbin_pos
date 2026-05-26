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
  /** The single store this user belongs to. Required at the application layer
   *  for cashier + store_manager; null for org-scoped roles (super_admin,
   *  organisation_admin, auditor, api_integration). No "all stores" semantics —
   *  a user with role cashier/store_manager and a null store_id is a data
   *  error and will be blocked from store-scoped actions. */
  store_id?: string | null
  /** Name of the assigned store, for display. Populated by the backend
   *  index endpoint via eager-loaded relation; null for org-scoped roles. */
  store_name?: string | null
  /** The active licence on this user's organisation. Populated by the SA
   *  users-list endpoint so the table can show tier · valid_from · valid_until
   *  next to each row without an N+1. Null when the user has no org (e.g.
   *  super_admin) or the org has no active licence. */
  org_license?: {
    tier: string
    max_stores: number
    valid_from: string | null
    valid_until: string | null
    renewal_status: 'active' | 'warning_30' | 'warning_14' | 'grace' | 'soft_lock' | 'hard_lock'
    is_active: boolean
  } | null
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: string
  organisation_id: string | null
  locale: 'nl' | 'en'
  send_welcome_email?: boolean
  /** Cashier + store_manager only. Required for those roles, prohibited
   *  for org-scoped roles. One user belongs to exactly one store. */
  store_id?: string | null
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
