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
      const url = err.config?.url ?? ''

      // A 401 from the sign-in endpoints is an ANSWER, not an expired session:
      // a rejected password, a wrong 2FA code. Reloading the page here threw
      // the message away and — worse — destroyed the pending two-factor
      // challenge, so entering a correct password bounced straight back to the
      // login screen with nothing explaining why. Let the screen show it.
      const isAuthCall = url.includes('/auth/')

      if (!isAuthCall) {
        // Clear BOTH copies of the session.
        //
        // The token used to sign requests lives under one key; the store that
        // decides "is this user logged in?" persists its own copy under
        // another. Clearing only the first left the app rehydrating as
        // logged-in with no way to authenticate: it rendered the dashboard,
        // every query 401'd, and each 401 reloaded the page into the same
        // state — an endless redirect that no amount of correct credentials
        // could break out of.
        localStorage.removeItem('josbin_pos_dashboard_token')
        localStorage.removeItem('josbin_pos-dashboard-auth')

        // Only navigate if we are not already there. A hard reload while
        // sitting on the login screen is what wiped the 2FA state.
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  },
)

export default apiClient
