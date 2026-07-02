import { useTranslation } from 'react-i18next'

interface QuickReasonChipsProps {
  /** Current value of the bound free-text field (source of truth). */
  value: string
  /** Setter for the bound field — a chip just writes its preset text in. */
  onChange: (value: string) => void
}

/**
 * A row of preset reason chips (Damaged / Expired / Wrong item / Customer
 * request / Other) that fill a bound free-text field. The text field stays the
 * single source of truth — chips only *set* it, they never store state.
 *
 * Tapping a preset chip replaces the field with that preset's label.
 * Tapping "Other" clears the field so the cashier can keep typing free-text
 * (unless it already holds free text, in which case it is left alone).
 *
 * Used by: Refund reason, Blind Return reason, and the Z-Report cash-
 * discrepancy note (EndOfDayScreen).
 */
export default function QuickReasonChips({ value, onChange }: QuickReasonChipsProps) {
  const { t } = useTranslation()

  const presets = [
    t('pos.reasonChips.damaged'),
    t('pos.reasonChips.expired'),
    t('pos.reasonChips.wrongItem'),
    t('pos.reasonChips.customerRequest'),
  ]
  const otherLabel = t('pos.reasonChips.other')

  const trimmed = value.trim()
  const activePreset = presets.find((p) => p === trimmed)
  // "Other" is the active state when there is free text that matches no preset.
  const otherActive = trimmed.length > 0 && !activePreset

  function selectPreset(label: string) {
    onChange(label)
  }

  function selectOther() {
    // Keep any free text the user already typed; only clear a preset so the
    // field becomes an empty canvas for free-text entry.
    if (activePreset) onChange('')
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {presets.map((label) => {
        const active = label === activePreset
        return (
          <button
            key={label}
            type="button"
            onClick={() => selectPreset(label)}
            style={chipStyle(active)}
          >
            {label}
          </button>
        )
      })}
      <button
        type="button"
        onClick={selectOther}
        style={chipStyle(otherActive)}
      >
        {otherLabel}…
      </button>
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    height: 28,
    padding: '0 12px',
    borderRadius: 20,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    background: active ? 'rgba(79,142,247,0.12)' : 'var(--bg-elevated)',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
  }
}
