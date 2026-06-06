/**
 * Context-aware help for the Dashboard. A "?" button that opens a slide-in
 * drawer with short steps for the CURRENT screen, in the user's language, plus
 * an "Open full guide →" deep-link to the hosted Dashboard Manual.
 *
 *   <HelpButton topic={screen} />   // topic = the dashboard screen id
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DASH_HELP } from '@/help/helpContent'

const DOCS_URL = (import.meta.env.VITE_DOCS_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://142.93.88.143:8095'

export default function HelpButton({ topic }: { topic: string }) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const isNl = i18n.language === 'nl'
  const entry = DASH_HELP[topic] ?? DASH_HELP.overview
  const c = isNl ? entry.nl : entry.en

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={isNl ? 'Hulp voor dit scherm' : 'Help for this screen'}
        aria-label={isNl ? 'Hulp' : 'Help'}
        style={{
          width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
          border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280',
          fontSize: 16, fontWeight: 800, lineHeight: 1,
        }}
      >?</button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(28,28,46,0.5)', display: 'flex', justifyContent: 'flex-end' }}
        >
          <aside style={{
            width: 'min(440px, 92vw)', height: '100%', background: '#fff',
            display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
            animation: 'dash-help-slide .18s ease-out',
          }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #eeeef8' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#7c3aed' }}>
                {isNl ? 'Hulp' : 'Help'}
              </span>
              <button onClick={() => setOpen(false)} aria-label={isNl ? 'Sluiten' : 'Close'}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9090a0', lineHeight: 1 }}>✕</button>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1c1c2e' }}>{c.title}</h2>
              {c.intro && <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#6b7280' }}>{c.intro}</p>}
              <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {c.steps.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 14, lineHeight: 1.5, color: '#1c1c2e' }}>
                    <span style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#7c3aed',
                      color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <footer style={{ padding: '14px 22px', borderTop: '1px solid #eeeef8' }}>
              <a href={`${DOCS_URL}/${entry.guide}`} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#7c3aed', textDecoration: 'none' }}>
                {isNl ? 'Open volledige handleiding' : 'Open full guide'} →
              </a>
            </footer>
          </aside>
          <style>{`@keyframes dash-help-slide{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}
    </>
  )
}
