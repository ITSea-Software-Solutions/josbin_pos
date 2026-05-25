import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Renders a bright "DEMO MODE" bar across the top of the app when the
 * backend reports it is running on the demo stack
 * (JOSBIN_POS_DEMO_MODE=true in backend/.env, set by docker-compose.demo.yml).
 *
 * Fetches the public /api/environment endpoint once on mount. No auth needed,
 * so the banner shows on the login screen too — that way nobody can screenshot
 * a demo login and claim it's the client's live install.
 */
export function DemoBanner() {
  const { i18n } = useTranslation()
  const [demo, setDemo] = useState(false)
  const isNl = i18n.language === 'nl'

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api'
    fetch(`${base}/environment`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.demo_mode) setDemo(true) })
      .catch(() => { /* ignore — banner just stays hidden */ })
  }, [])

  if (!demo) return null

  return (
    <div
      role="status"
      style={{
        background: 'repeating-linear-gradient(45deg,#facc15,#facc15 12px,#eab308 12px,#eab308 24px)',
        color: '#422006',
        padding: '6px 16px',
        textAlign: 'center',
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        boxShadow: '0 2px 6px rgba(0,0,0,.18)',
        zIndex: 9999,
        position: 'sticky',
        top: 0,
      }}
    >
      {isNl
        ? '⚠️  Demo-omgeving — geen echte data. Gebruik niet voor live verkoop.'
        : '⚠️  Demo environment — not real data. Do not use for live sales.'}
    </div>
  )
}
