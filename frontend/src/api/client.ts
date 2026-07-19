/**
 * Josbin POS API client
 * Thin wrapper around axios with Sanctum bearer token auth.
 */
import axios, { AxiosInstance } from 'axios'
import { getApiBaseUrl } from '@/lib/serverConfig'

// Runtime override (Settings/Login → Server) wins over the baked VITE_API_URL.
const BASE_URL = getApiBaseUrl()

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15_000,
})

// Inject auth token + current UI language on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('josbin_pos_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Tell the backend which language to render error messages in. Backend's
  // SetLocale middleware reads this and switches app()->setLocale(...). Any
  // __('errors.…') translation then comes back in the matching language —
  // cashier sees Dutch errors when the till UI is NL, English when EN.
  const lang = localStorage.getItem('i18nextLng') || 'nl'
  config.headers['Accept-Language'] = lang.startsWith('en') ? 'en' : 'nl'
  return config
})

// Handle 401 → clear token, redirect to login
// Handle X-License-Status header → store in localStorage for banner display
apiClient.interceptors.response.use(
  (res) => {
    const licenseStatus = res.headers['x-license-status']
    if (licenseStatus) {
      localStorage.setItem('josbin_pos_license_status', licenseStatus)
    }
    return res
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('josbin_pos_token')
      window.location.href = '/'
    }
    // 402 = license lock — store the code so the UI can show the correct message
    if (err.response?.status === 402) {
      const code = err.response?.data?.code ?? 'LICENSE_ERROR'
      localStorage.setItem('josbin_pos_license_status', code)
    }
    return Promise.reject(err)
  },
)

export default apiClient
