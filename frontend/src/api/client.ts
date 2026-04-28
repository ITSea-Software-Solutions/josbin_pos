/**
 * Josbin POS API client
 * Thin wrapper around axios with Sanctum bearer token auth.
 */
import axios, { AxiosInstance } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 15_000,
})

// Inject auth token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('josbin_pos_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
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
