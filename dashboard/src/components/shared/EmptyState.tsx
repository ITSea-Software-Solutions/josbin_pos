/**
 * Shared empty-state block for dashboard tables / lists.
 *
 * Why: several screens hand-roll their own "no rows yet" markup (a big emoji,
 * a bold line, a muted line, sometimes a CTA). They drift in spacing, colour
 * and copy. This centralises the look so every empty state reads the same.
 *
 * Bilingual by design — pass NL + EN strings and the current `isNl` flag,
 * matching the inline-i18n pattern used across the dashboard screens.
 *
 * Usage (inside a table body, spanning all columns):
 *   <tr><td colSpan={7} style={{ padding: 0 }}>
 *     <EmptyState
 *       icon="👤"
 *       isNl={isNl}
 *       title={{ nl: 'Geen klanten gevonden', en: 'No customers found' }}
 *       description={{ nl: 'Voeg uw eerste klant toe.', en: 'Add your first customer.' }}
 *     />
 *   </td></tr>
 *
 * Or standalone (card wrapper is the caller's responsibility):
 *   <EmptyState icon="🏬" isNl={isNl} title={{ nl:'…', en:'…' }}
 *     cta={{ label:{ nl:'+ Nieuwe vestiging', en:'+ New store' }, onClick: openAdd, disabled }} />
 */

type BiText = { nl: string; en: string }

interface EmptyStateProps {
  /** Emoji or short glyph shown above the title. */
  icon: string
  isNl: boolean
  title: BiText
  /** Optional muted second line. */
  description?: BiText
  /** Optional call-to-action button. */
  cta?: {
    label: BiText
    onClick: () => void
    disabled?: boolean
    /** Native tooltip — e.g. the reason a disabled CTA is blocked. */
    title?: string
  }
}

export default function EmptyState({ icon, isNl, title, description, cta }: EmptyStateProps) {
  const pick = (t: BiText) => (isNl ? t.nl : t.en)

  return (
    <div style={{ padding: '60px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }} aria-hidden>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 }}>
        {pick(title)}
      </p>
      {description && (
        <p style={{ fontSize: 13, color: '#7e88a0', margin: '6px 0 0' }}>
          {pick(description)}
        </p>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          disabled={cta.disabled}
          title={cta.title}
          style={{
            marginTop: 18, padding: '10px 22px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#293371,#1f2a63)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: cta.disabled ? 'not-allowed' : 'pointer',
            opacity: cta.disabled ? 0.5 : 1, boxShadow: '0 4px 12px rgba(41,51,113,.3)',
          }}
        >
          {pick(cta.label)}
        </button>
      )}
    </div>
  )
}
