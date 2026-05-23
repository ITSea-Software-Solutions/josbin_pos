import { format as dfFormat, parseISO, isValid } from 'date-fns'
import { nl, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/store/settingsStore'

/**
 * Maps the 6 user-facing date format options (Settings → Date format) to
 * date-fns format patterns. Dutch default is DD-MM-YYYY.
 */
const FORMAT_MAP: Record<string, string> = {
  'DD-MM-YYYY':  'dd-MM-yyyy',
  'MM-DD-YYYY':  'MM-dd-yyyy',
  'YYYY-MM-DD':  'yyyy-MM-dd',
  'D MMMM YYYY': 'd MMMM yyyy',
  'D MMM YYYY':  'd MMM yyyy',
  'DD/MM/YY':    'dd/MM/yy',
}

const DEFAULT_FORMAT = 'DD-MM-YYYY'

/**
 * Format a date according to the user's chosen date format.
 * Accepts an ISO string (date or datetime) or a Date. Returns the original
 * string unchanged if it cannot be parsed, so nothing ever renders "Invalid Date".
 */
export function formatDate(
  input: string | Date | null | undefined,
  dateFormat: string = DEFAULT_FORMAT,
  locale: 'nl' | 'en' = 'nl',
): string {
  if (input === null || input === undefined || input === '') return '—'
  const d = typeof input === 'string' ? parseISO(input) : input
  if (!isValid(d)) return typeof input === 'string' ? input : '—'
  const pattern = FORMAT_MAP[dateFormat] ?? FORMAT_MAP[DEFAULT_FORMAT]
  return dfFormat(d, pattern, { locale: locale === 'nl' ? nl : enUS })
}

/**
 * Hook returning a formatter bound to the active user's date-format setting
 * and the current UI language (used for localised month names).
 */
export function useDateFormatter(): (input: string | Date | null | undefined) => string {
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const { i18n } = useTranslation()
  const locale = i18n.language === 'nl' ? 'nl' : 'en'
  return (input) => formatDate(input, dateFormat, locale)
}
