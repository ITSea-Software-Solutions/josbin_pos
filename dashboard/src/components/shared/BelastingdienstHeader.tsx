import { BD } from '@/theme/belastingdienst'

/** National-flag stripe with the star — the portal's recurring identity mark. */
export function FlagStripe({ w = 40, h = 26 }: { w?: number; h?: number }) {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', width: w, height: h, borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.18)', position: 'relative', flexShrink: 0 }}>
      <div style={{ flex: 2, background: '#377e3f' }} />
      <div style={{ flex: 1, background: '#fff' }} />
      <div style={{ flex: 2, background: BD.red }} />
      <div style={{ flex: 1, background: '#fff' }} />
      <div style={{ flex: 2, background: '#377e3f' }} />
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: BD.gold, fontSize: h * 0.4, lineHeight: 1 }}>★</span>
    </div>
  )
}

/**
 * Official page header for the Belastingdienst portal — a deep-green band with
 * the flag mark, an overline, the page title and subtitle, plus an optional
 * actions slot. Gives every inspector page the same institutional top.
 */
export function BelastingdienstHeader({
  overline, title, subtitle, actions,
}: {
  overline: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${BD.greenDeep} 0%, ${BD.greenDark} 100%)`,
      borderRadius: 16, padding: '22px 26px', marginBottom: 22, position: 'relative', overflow: 'hidden',
      boxShadow: '0 8px 26px rgba(12,58,34,.22)',
    }}>
      {/* faint star watermark */}
      <span aria-hidden style={{ position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)', fontSize: 200, color: 'rgba(244,196,48,.06)', lineHeight: 1, pointerEvents: 'none' }}>★</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <FlagStripe w={46} h={30} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '2px', color: 'rgba(244,196,48,.9)', textTransform: 'uppercase' }}>
              {overline}
            </div>
            <h1 style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px', margin: '3px 0 0' }}>
              {title}
            </h1>
            {subtitle && <p style={{ fontSize: 13.5, color: 'rgba(234,242,236,.72)', margin: '5px 0 0', maxWidth: 620, lineHeight: 1.5 }}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  )
}
