import { useTranslation } from 'react-i18next'
import { GRID_DENSITIES, useSettingsStore, type GridDensity } from '@/store/settingsStore'

/**
 * Tiles-per-row control, the way a phone gallery does it.
 *
 * This lives on the POS screen rather than in Settings on purpose. It is not a
 * configuration decision made once at install — a cashier working a long queue
 * of known items wants twelve small tiles, and the same person hunting an
 * unfamiliar line wants four big ones with the name readable across the
 * counter. That is a during-the-shift choice, so it has to be one tap away.
 *
 * It still persists per till, so nobody has to set it every morning.
 */

/** Four nested squares per step, so the icon shows what it does. */
function DensityIcon({ n, active }: { n: GridDensity; active: boolean }) {
  // 2x2, 3x3, 4x4, 6x6 cells — the same progression as the densities, drawn
  // small enough that the busiest one still reads as "many".
  const cells = { 4: 2, 6: 3, 8: 4, 12: 6 }[n] ?? 3
  const gap = cells > 4 ? 1 : 1.5
  const size = (16 - gap * (cells - 1)) / cells
  const dots = []
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      dots.push(
        <rect
          key={`${x}-${y}`}
          x={x * (size + gap)} y={y * (size + gap)}
          width={size} height={size} rx={Math.min(1, size / 3)}
        />
      )
    }
  }
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden="true"
         fill={active ? '#fff' : 'currentColor'} style={{ display: 'block' }}>
      {dots}
    </svg>
  )
}

export default function GridDensityToggle() {
  const { t } = useTranslation()
  const density = useSettingsStore((s) => s.gridDensity)
  const setDensity = useSettingsStore((s) => s.setGridDensity)

  return (
    <div
      role="group"
      aria-label={t('pos.density.label')}
      style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}
    >
      {GRID_DENSITIES.map((n) => {
        const active = density === n
        return (
          <button
            key={n}
            onClick={() => setDensity(n)}
            title={t('pos.density.perRow', { count: n })}
            aria-pressed={active}
            data-testid={`density-${n}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, padding: 0, cursor: 'pointer',
              borderRadius: 6,
              background: active ? 'var(--color-primary)' : 'var(--bg-elevated)',
              border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-color)'}`,
              color: 'var(--text-secondary)',
            }}
          >
            <DensityIcon n={n} active={active} />
          </button>
        )
      })}
    </div>
  )
}
