/**
 * Chart design tokens — the one place colour and geometry are decided.
 *
 * The categorical palette is NOT eyeballed. It was run through the six checks
 * (lightness band, chroma floor, colour-blind separation, normal-vision
 * separation, contrast against the chart surface) and every slot passes at the
 * dashboard's light surface. Slots 1 and 2 are Josbin navy and orange so the
 * charts read as part of the product rather than as a generic library.
 *
 *   node scripts/validate_palette.js "<the SERIES array>" --mode light
 *
 * If you change a hex, re-run that. Colour separation is computable and
 * guessing at it is how a chart becomes unreadable for the 1-in-12 men with a
 * colour-vision deficiency without anyone on the team noticing.
 *
 * Two rules that are easy to break by accident:
 *
 *   1. Assign slots in FIXED ORDER, never cycled, and key them to the ENTITY —
 *      not to rank. If a filter drops one store, the survivors must keep their
 *      colours. `seriesColor(key, allKeys)` does that; indexing into SERIES by
 *      loop position does not.
 *   2. A ninth series is never a new hue. It folds into "Other".
 */

/** Categorical slots, in assignment order. Validated — see the note above. */
export const SERIES = [
  '#1E5C9E', // 1 navy    — Josbin brand
  '#EF6C00', // 2 orange  — Josbin brand
  '#0E8C6B', // 3 green
  '#B8860B', // 4 gold
  '#C2557A', // 5 rose
  '#6B4FA8', // 6 violet
  '#1F8FA8', // 7 teal
  '#A0522D', // 8 sienna
] as const

/**
 * Belastingdienst variant. The tax-inspector screens carry their own identity —
 * the national green, not Josbin's navy — and a chart that ignores that reads as
 * a bolted-on widget. Same method, different first hue: green leads, the flag's
 * red follows, then hues chosen to separate rather than to decorate.
 *
 * Validated exactly like SERIES:
 *   node scripts/validate_palette.js "#2E8B57,#C1121F,#B8860B,#1E5C9E,#A0522D,#6B4FA8,#0F9BB5,#8A8F2E" --mode light
 *
 * Two earlier attempts FAILED and are worth not repeating: violet beside navy
 * separates by only ΔE 2.3 for a protan reader, and a muted teal fell under the
 * chroma floor and read as grey.
 */
export const SERIES_BD = [
  '#2E8B57', // 1 green   — Belastingdienst
  '#C1121F', // 2 red     — the flag's other colour
  '#B8860B', // 3 gold
  '#1E5C9E', // 4 navy
  '#A0522D', // 5 sienna
  '#6B4FA8', // 6 violet
  '#0F9BB5', // 7 teal
  '#8A8F2E', // 8 olive
] as const

/** Magnitude, one hue light→dark. Never a rainbow. */
export const SEQUENTIAL = ['#D6E4F0', '#A8C6E0', '#6F9FCB', '#3B7CB3', '#1E5C9E', '#123D6B']

/**
 * Status colours. RESERVED — never reused as "series 9", and never the only
 * signal: they ship with a label or icon, because colour alone excludes anyone
 * who cannot see the difference.
 */
export const STATUS = {
  good:     '#0E8C6B',
  warning:  '#B8860B',
  serious:  '#D2691E',
  critical: '#C0392B',
} as const

/** Recessive ink. Values and labels wear these, never a series colour — a
 *  coloured mark beside the text is what carries identity. */
export const INK = {
  primary:   '#0F1E2E',
  secondary: '#4A5A6B',
  muted:     '#7B8794',
  grid:      '#E4E9EE',
  surface:   '#FFFFFF',
} as const

/** Mark geometry, so every chart in the product is built the same way. */
export const MARK = {
  barRadius: 4,        // rounded data-end only, anchored to the baseline
  lineWidth: 2,
  dotSize: 8,
  gap: 2,              // surface gap between adjacent/stacked fills
} as const

/**
 * Colour for one entity, stable across filtering.
 *
 * `keys` is the full domain (every store, every payment method) — NOT the
 * currently visible subset. Pass the same domain everywhere and a store keeps
 * its colour whether it is shown alone or beside nine others.
 */
export function seriesColor(
  key: string,
  keys: readonly string[],
  palette: readonly string[] = SERIES,
): string {
  const i = keys.indexOf(key)
  if (i < 0) return INK.muted
  // A 9th entity does not invent a hue — see rule 2.
  return i < palette.length ? palette[i] : INK.muted
}

/** SRD, grouped, two decimals — the format every money figure in the product
 *  already uses, so a chart tooltip and a report table agree. */
export function srd(n: number): string {
  return `SRD ${n.toLocaleString('nl-SR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Compact axis money: 12.4k rather than 12,400.00, which does not fit. */
export function srdShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toFixed(0)
}

/** DD-MM from an ISO date — Suriname reads day first, and a 30-day axis has no
 *  room for the year. */
export function axisDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}-${m}`
}
