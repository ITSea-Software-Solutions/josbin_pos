import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime } from '../date'

/**
 * The receipt used to print the API's raw UTC string
 * ("2026-07-27T19:26:09.000000Z"). A receipt is a document a customer keeps
 * and the tax authority may read, so it carries Suriname's date order and
 * Suriname's clock — not the terminal's.
 */
describe('formatDateTime', () => {
  it('renders Suriname day-first date and 24-hour time', () => {
    // 19:26 UTC is 16:26 in Paramaribo (UTC-3).
    expect(formatDateTime('2026-07-27T19:26:09.000000Z')).toBe('27-07-2026 16:26')
  })

  it('uses AST regardless of the terminal timezone', () => {
    // 01:30 UTC is still the previous DAY in Suriname — a sale rung up at
    // 22:30 must not appear on tomorrow's receipt.
    expect(formatDateTime('2026-07-28T01:30:00Z')).toBe('27-07-2026 22:30')
  })

  it('handles midnight without rolling to hour 24', () => {
    expect(formatDateTime('2026-07-28T03:00:00Z')).toBe('28-07-2026 00:00')
  })

  it('honours the shop’s chosen date order', () => {
    expect(formatDateTime('2026-07-27T19:26:09Z', 'YYYY-MM-DD')).toBe('2026-07-27 16:26')
    expect(formatDateTime('2026-07-27T19:26:09Z', 'DD/MM/YY')).toBe('27/07/26 16:26')
  })

  it('never renders "Invalid Date" on the paper', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime('')).toBe('—')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })

  it('leaves the plain date formatter alone', () => {
    expect(formatDate('2026-07-27')).toBe('27-07-2026')
  })
})
