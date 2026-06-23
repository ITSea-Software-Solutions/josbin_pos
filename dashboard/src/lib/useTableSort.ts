import { useState } from 'react'

export type SortDir = 'asc' | 'desc'
export interface SortState { key: string; dir: SortDir }

type Accessor<T> = (row: T) => string | number | null | undefined
type Accessors<T> = Record<string, Accessor<T>>

/**
 * Shared client-side table sorting used across every dashboard list table so
 * they all behave + look identical:
 *   - click a header to cycle  asc → desc → off
 *   - numbers sort numerically, strings naturally (numeric-aware), nulls last
 *   - `indicator(key)` returns ⇅ (inactive) / ▲ (asc) / ▼ (desc)
 *
 * Usage:
 *   const acc = { name: r => r.name, price: r => Number(r.price) }
 *   const { sorted, toggle, indicator } = useTableSort(rows, acc)
 *   <th onClick={() => toggle('name')}>Name {indicator('name')}</th>
 *   {sorted.map(...)}
 */
export function useTableSort<T>(rows: T[], accessors: Accessors<T>, initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial)

  let sorted = rows
  if (sort && accessors[sort.key]) {
    const acc = accessors[sort.key]
    sorted = [...rows].sort((a, b) => {
      const av = acc(a)
      const bv = acc(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1            // nulls / blanks last
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }

  function toggle(key: string) {
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  function indicator(key: string): string {
    if (sort?.key !== key) return '⇅'
    return sort.dir === 'asc' ? '▲' : '▼'
  }

  return { sorted, sort, setSort, toggle, indicator }
}
