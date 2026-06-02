import axios, { AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 20_000,
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('josbin_pos_dashboard_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Tell the backend which language to render error messages in. Backend's
  // SetLocale middleware reads this and switches app()->setLocale(...). Any
  // __('errors.…') translation then comes back in the matching language —
  // user sees Dutch errors when the UI is NL, English when EN.
  const lang = localStorage.getItem('i18nextLng') || 'nl'
  config.headers['Accept-Language'] = lang.startsWith('en') ? 'en' : 'nl'
  return config
})

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
      localStorage.removeItem('josbin_pos_dashboard_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default apiClient
