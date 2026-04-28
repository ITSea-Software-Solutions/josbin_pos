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

function createEchoInstance(): Echo<'reverb'> {
  const token = localStorage.getItem('josbin_pos_token')

  return new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY ?? 'josbin_pos-reverb',
    wsHost: import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1',
    wsPort: parseInt(import.meta.env.VITE_REVERB_PORT ?? '6001'),
    forceTLS: false,
    enabledTransports: ['ws'],
    authEndpoint: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        Accept: 'application/json',
      },
    },
  })
}

export function getEcho(): Echo<'reverb'> {
  if (!echoInstance) {
    echoInstance = createEchoInstance()
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
