/**
 * Laravel Echo / Reverb WebSocket hook for the POS Electron app
 *
 * Provides a singleton Echo instance. Used for:
 * - ProductUpdated  → invalidate pos-products cache (price changes push instantly)
 * - LicenseWarning → show license banner
 * - StoreStatusChanged → sync indicator
 *
 * The Electron app connects from localhost to the local Reverb server.
 * When offline, Echo silently retries connection — POS continues operating.
 */
import { useEffect, useRef } from 'react'
import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import type { QueryClient } from '@tanstack/react-query'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

let echoInstance: Echo<'reverb'> | null = null

interface ReverbConfig { app_key: string; host: string; port: number; scheme: string }
let reverbConfig: ReverbConfig | null = null

/**
 * Reverb host/port differs per stack (live=6001, demo=6002) and the WS app_key
 * is set in the backend .env, not the frontend. So instead of juggling
 * VITE_REVERB_* envs per build, the backend advertises its WS coordinates at
 * /api/environment. Call discoverReverbConfig() once after we know the API
 * base URL — the cached result is reused for every getEcho() call.
 */
export async function discoverReverbConfig(): Promise<ReverbConfig> {
  if (reverbConfig) return reverbConfig
  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'
  try {
    const res = await fetch(`${apiBase}/environment`, { headers: { Accept: 'application/json' } })
    if (res.ok) {
      const j = await res.json()
      if (j?.reverb?.host && j?.reverb?.port) {
        reverbConfig = j.reverb as ReverbConfig
        return reverbConfig
      }
    }
  } catch {
    /* fall through to env fallback */
  }
  // Fallback for offline / unreachable backend: trust the explicit env vars.
  reverbConfig = {
    app_key: import.meta.env.VITE_REVERB_APP_KEY ?? 'josbin_pos-key',
    host:    import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1',
    port:    parseInt(import.meta.env.VITE_REVERB_PORT ?? '6001'),
    scheme:  import.meta.env.VITE_REVERB_SCHEME ?? 'http',
  }
  return reverbConfig
}

function createEchoInstance(cfg: ReverbConfig): Echo<'reverb'> {
  const token = localStorage.getItem('josbin_pos_token')

  return new Echo({
    broadcaster: 'reverb',
    key:    cfg.app_key,
    wsHost: cfg.host,
    wsPort: cfg.port,
    forceTLS: cfg.scheme === 'https',
    enabledTransports: cfg.scheme === 'https' ? ['ws', 'wss'] : ['ws'],
    authEndpoint: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  })
}

/**
 * Synchronous getter — first call must come *after* discoverReverbConfig()
 * has resolved (call it in main.tsx before rendering). If it hasn't, we
 * fall back to env / sensible defaults so the call never throws.
 */
export function getEcho(): Echo<'reverb'> {
  if (!echoInstance) {
    const cfg = reverbConfig ?? {
      app_key: import.meta.env.VITE_REVERB_APP_KEY ?? 'josbin_pos-key',
      host:    import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1',
      port:    parseInt(import.meta.env.VITE_REVERB_PORT ?? '6001'),
      scheme:  'http',
    }
    echoInstance = createEchoInstance(cfg)
  }
  return echoInstance
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect()
    echoInstance = null
  }
}

/**
 * Subscribe to the org channel and react to product/license events.
 * Used by ProductGrid to get instant price updates pushed from HQ.
 */
export function useOrgChannel(
  orgId: string | null,
  queryClient: QueryClient,
  storeId: string | null,
) {
  const qc = queryClient
  const echo = getEcho()

  const orgIdRef = useRef(orgId)
  const storeIdRef = useRef(storeId)
  orgIdRef.current = orgId
  storeIdRef.current = storeId

  useEffect(() => {
    if (!orgId) return

    const channel = echo.private(`org.${orgId}`)

    // Product updated from HQ catalogue → invalidate POS product cache
    channel.listen('.product.updated', () => {
      qc.invalidateQueries({ queryKey: ['pos-products', storeIdRef.current] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    })

    // License warning → update localStorage so LicenseBanner re-renders
    channel.listen('.license.warning', (data: { license_status: string }) => {
      localStorage.setItem('josbin_pos_license_status', data.license_status)
    })

    return () => {
      echo.leave(`org.${orgId}`)
    }
  }, [echo, orgId, qc])
}
