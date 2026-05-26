import { useEffect, useState } from 'react'

/**
 * Vendor contact details for any UI surface that tells a client to "contact
 * support" — licence-missing banners, read-only org header, renewal warnings,
 * the licence certificate PDF.
 *
 * Source of truth: backend `config('josbin_pos.vendor')`, surfaced at
 * GET /api/environment (public, no auth needed). Resellers override per
 * deployment via JOSBIN_POS_VENDOR_NAME / EMAIL / PHONE / WEBSITE env vars.
 *
 * The "Josbin" fallback is what the UI shows before /environment responds
 * (or if the request fails) — so the page never flashes "support@undefined".
 */
export interface VendorContact {
  name: string
  email: string
  phone: string
  website: string
}

const DEFAULT_VENDOR: VendorContact = {
  name: 'Josbin',
  email: 'support@josbin-pos.sr',
  phone: '+597 471-0000',
  website: 'https://josbin-pos.sr',
}

// Module-level cache so every component doesn't refetch.
let cached: VendorContact | null = null
let inflight: Promise<VendorContact> | null = null

async function fetchVendor(): Promise<VendorContact> {
  if (cached) return cached
  if (inflight) return inflight

  const base = (import.meta.env.VITE_API_URL ?? '/api') as string
  inflight = fetch(`${base}/environment`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data): VendorContact => {
      const v = data?.vendor as Partial<VendorContact> | undefined
      cached = { ...DEFAULT_VENDOR, ...v }
      return cached
    })
    .catch((): VendorContact => {
      cached = DEFAULT_VENDOR
      return cached
    })
    .finally(() => { inflight = null })

  return inflight
}

/**
 * Hook returning the vendor contact. Renders synchronously with the default
 * (so first paint never shows "undefined") then swaps in the real one once
 * /api/environment resolves.
 */
export function useVendor(): VendorContact {
  const [vendor, setVendor] = useState<VendorContact>(cached ?? DEFAULT_VENDOR)
  useEffect(() => {
    if (cached) return
    let cancelled = false
    fetchVendor().then((v) => { if (!cancelled) setVendor(v) })
    return () => { cancelled = true }
  }, [])
  return vendor
}
