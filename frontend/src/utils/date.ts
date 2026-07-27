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
 * Date + 24-hour time, in the user's chosen date format.
 *
 * Receipts and Z-reports need the moment, not just the day, and a raw ISO
 * timestamp ("2026-07-27T16:42:00-03:00") is not something to hand a
 * customer. Suriname reads dates day-first, which the default format
 * already gives us.
 */
export function formatDateTime(
  input: string | Date | null | undefined,
  dateFormat: string = DEFAULT_FORMAT,
  locale: 'nl' | 'en' = 'nl',
): string {
  if (input === null || input === undefined || input === '') return '—'
  const d = typeof input === 'string' ? parseISO(input) : input
  if (!isValid(d)) return typeof input === 'string' ? input : '—'
  const ast = toAstWallClock(d)
  return `${formatDate(ast, dateFormat, locale)} ${dfFormat(ast, 'HH:mm')}`
}

/** Suriname time — every timestamp in this system is AST, by policy. */
const AST_TIMEZONE = 'America/Paramaribo'

/**
 * Rebuilds a Date whose LOCAL fields hold the AST wall-clock values.
 *
 * The API returns UTC ("…T19:26:09Z"), and formatting that with the device's
 * own clock puts whatever timezone the terminal happens to be set to onto a
 * receipt and a Z-report. Those are fiscal documents: the time on them has to
 * be Suriname time whether or not somebody set the tablet up correctly.
 */
function toAstWallClock(d: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: AST_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  // Hour 24 appears at midnight in some engines' hour12:false output.
  const hour = get('hour') % 24
  return new Date(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'))
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
