/**
 * Belastingdienst Suriname — shared visual identity for the tax-inspector
 * portal (login, dashboard chrome, BTW pages). Keeps the official palette in
 * one place so every inspector surface matches.
 *
 * Palette mirrors the national flag: green + red + white + a yellow star.
 */
export const BD = {
  green:      '#1f6b3b',   // primary
  greenDark:  '#0e4429',
  greenDeep:  '#0c3a22',   // sidebar / hero background
  greenSoft:  '#e6efe9',   // tinted fills, hover
  greenLine:  '#cfe0d5',
  gold:       '#f4c430',   // star accent
  goldSoft:   '#fff8e6',
  red:        '#c8102e',
  redSoft:    '#fdecec',
  ink:        '#0e1a14',
  muted:      '#5b6b62',
  paper:      '#f4f7f5',   // page background
  border:     '#d8e2db',
  white:      '#ffffff',
} as const

/** Standard white card used across the inspector pages. */
export const bdCard: React.CSSProperties = {
  background: BD.white,
  border: `1px solid ${BD.border}`,
  borderRadius: 14,
  boxShadow: '0 1px 3px rgba(12,58,34,.05)',
}

/** Status → pill colours for a BTW submission. */
export function bdStatusColors(status: string): { bg: string; fg: string; label_nl: string; label_en: string } {
  switch (status) {
    case 'accepted':  return { bg: BD.greenSoft, fg: BD.green,  label_nl: 'Geaccepteerd', label_en: 'Accepted' }
    case 'filed':     return { bg: '#fff8e6',    fg: '#a16207', label_nl: 'Ingediend',    label_en: 'Filed' }
    case 'disputed':  return { bg: BD.redSoft,   fg: BD.red,    label_nl: 'Betwist',      label_en: 'Disputed' }
    case 'superseded':return { bg: '#eef1f4',    fg: '#64748b', label_nl: 'Vervangen',    label_en: 'Superseded' }
    case 'draft':     return { bg: '#eef1f4',    fg: '#64748b', label_nl: 'Concept',      label_en: 'Draft' }
    default:          return { bg: '#eef1f4',    fg: '#64748b', label_nl: status,         label_en: status }
  }
}
