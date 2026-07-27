import apiClient from './client'

/** POS pick-lists per tender type. Effective values come appended on every
 *  organisation payload; overrides live under settings.payment_options. */
export interface PaymentOptions {
  wallets?: string[]
  card_banks?: string[]
  transfer_banks?: string[]
  mobile_apps?: string[]
}

export interface Organisation {
  id: string
  name: string
  type: 'retail' | 'govt' | 'wholesale'
  btw_number: string
  currency: 'SRD'
  locale: 'nl' | 'en'
  is_government: boolean
  block_oversell: boolean
  subscription_tier: string
  is_active: boolean
  store_count: number
  created_at: string
  allow_impersonation?: boolean
  admin_user?: { id: string; name: string; email: string } | null
  settings?: { payment_options?: PaymentOptions
    register_policy?: { self_service_handover: boolean } } & Record<string, unknown>
  /** Effective lists (override or default) — appended by the API. */
  payment_options?: PaymentOptions
}

export interface Store {
  id: string
  organisation_id: string
  organisation_name?: string
  name: string
  address: string
  city: string
  default_btw_rate: string
  receipt_header: string
  receipt_footer: string
  receipt_logo_path?: string
  receipt_logo_url?: string
  settings?: Record<string, unknown>
  /** Effective org pick-lists, served by GET /stores/{id}. */
  payment_options?: PaymentOptions
  is_active: boolean
  pos_type: 'native' | 'external'
}

export interface CreateOrgPayload {
  name: string
  type: 'retail' | 'govt' | 'wholesale'
  btw_number?: string
  locale: 'nl' | 'en'
  subscription_tier: 'starter' | 'professional' | 'enterprise'
  is_government?: boolean
}

export interface CreateStorePayload {
  name: string
  address?: string
  city?: string
  default_btw_rate: string
  receipt_header?: string
  receipt_footer?: string
  receipt_logo_path?: string
  pos_type: 'native' | 'external'
}

// ─── Organisations ────────────────────────────────────────────────────────────

export async function getOrganisations(): Promise<Organisation[]> {
  const res = await apiClient.get<{ data: Organisation[] }>('/organisations')
  return res.data.data
}

export interface OrganisationsPage {
  data: Organisation[]
  current_page: number
  last_page: number
  total: number
}

/**
 * Paginated org list for the Organisations screen. The backend paginates for
 * cross-org roles (SA / inspector) but has NO server-side search — the screen
 * fetches a large page and keeps filtering client-side. Own-org roles get a
 * plain { data: [org] } body; normalise so callers always see paginator fields.
 */
export async function getOrganisationsPage(params: { page?: number; per_page?: number } = {}): Promise<OrganisationsPage> {
  const res = await apiClient.get<Partial<OrganisationsPage> & { data: Organisation[] }>('/organisations', { params })
  const d = res.data
  return {
    data: d.data ?? [],
    current_page: d.current_page ?? 1,
    last_page: d.last_page ?? 1,
    total: d.total ?? d.data?.length ?? 0,
  }
}

/**
 * Full slim org list (id + name) for filter dropdowns — bypasses pagination so
 * a cross-org user (Super Admin, tax inspector) sees EVERY organisation, not
 * just the first page.
 */
export async function getAllOrganisations(): Promise<Array<{ id: string; name: string }>> {
  const res = await apiClient.get<{ data: Array<{ id: string; name: string }> }>('/organisations', { params: { all: true } })
  return res.data.data
}

export async function getOrganisation(id: string): Promise<Organisation> {
  const res = await apiClient.get<{ data: Organisation }>(`/organisations/${id}`)
  return res.data.data
}

export async function createOrganisation(payload: CreateOrgPayload): Promise<Organisation> {
  const res = await apiClient.post<{ data: Organisation }>('/organisations', payload)
  return res.data.data
}

export async function updateOrganisation(
  id: string,
  payload: Partial<CreateOrgPayload> & { is_active?: boolean; allow_impersonation?: boolean; block_oversell?: boolean; payment_options?: PaymentOptions; register_policy?: { self_service_handover: boolean } },
): Promise<Organisation> {
  const res = await apiClient.put<{ data: Organisation }>(`/organisations/${id}`, payload)
  return res.data.data
}

export async function deactivateOrganisation(id: string): Promise<void> {
  await apiClient.delete(`/organisations/${id}`)
}

// ─── Stores ───────────────────────────────────────────────────────────────────

export async function getOrgStores(orgId: string): Promise<Store[]> {
  const res = await apiClient.get<{ data: Store[] }>(`/organisations/${orgId}/stores`)
  return res.data.data
}

export async function createStore(orgId: string, payload: CreateStorePayload): Promise<Store> {
  const res = await apiClient.post<{ data: Store }>(`/organisations/${orgId}/stores`, payload)
  return res.data.data
}

export async function updateStore(storeId: string, payload: Partial<CreateStorePayload>): Promise<Store> {
  const res = await apiClient.put<{ data: Store }>(`/stores/${storeId}`, payload)
  return res.data.data
}

export async function deactivateStore(storeId: string): Promise<void> {
  await apiClient.delete(`/stores/${storeId}`)
}
