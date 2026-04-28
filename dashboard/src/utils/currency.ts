/**
 * Format a SRD monetary value for display.
 * All monetary values are strings (DECIMAL(12,2)) from the API.
 */
export function formatSRD(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return 'SRD 0,00'
  return `SRD ${num.toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(n: string | number, decimals = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '0'
  return num.toLocaleString('nl-SR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
