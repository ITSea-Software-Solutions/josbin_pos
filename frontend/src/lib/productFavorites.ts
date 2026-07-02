/**
 * Per-store cashier favorites & recents, persisted in localStorage.
 *
 * - Recents: a most-recently-added-first list of product IDs, capped.
 * - Favorites: an explicit, ordered list of "pinned" product IDs.
 *
 * The POS quick-row shows favorites first, then fills the remaining slots with
 * recents that are not already pinned. Everything is store-scoped so a cashier
 * moving between terminals/stores sees the right shortcuts.
 *
 * IDs only — the row resolves them against the already-loaded product list, so
 * a deleted/hidden product simply drops out of the row.
 */
const RECENT_KEY = 'josbin_pos_recent_products'
const FAV_KEY = 'josbin_pos_fav_products'
const RECENT_CAP = 20

function read(key: string, storeId: string): string[] {
  try {
    const raw = localStorage.getItem(`${key}:${storeId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(key: string, storeId: string, ids: string[]): void {
  try {
    localStorage.setItem(`${key}:${storeId}`, JSON.stringify(ids))
  } catch {
    /* quota / private mode — favorites are a convenience, fail silently */
  }
}

export function getRecent(storeId: string): string[] {
  return read(RECENT_KEY, storeId)
}

export function getFavorites(storeId: string): string[] {
  return read(FAV_KEY, storeId)
}

/** Record a product add — moves it to the front of the recents list. */
export function recordRecent(storeId: string, productId: string): string[] {
  const next = [productId, ...getRecent(storeId).filter((id) => id !== productId)].slice(0, RECENT_CAP)
  write(RECENT_KEY, storeId, next)
  return next
}

export function isFavorite(storeId: string, productId: string): boolean {
  return getFavorites(storeId).includes(productId)
}

/** Toggle a favorite pin. Returns the new favorites list. */
export function toggleFavorite(storeId: string, productId: string): string[] {
  const current = getFavorites(storeId)
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId]
  write(FAV_KEY, storeId, next)
  return next
}
