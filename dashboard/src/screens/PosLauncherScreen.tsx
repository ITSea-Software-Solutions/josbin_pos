import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * PosLauncherScreen — a "front door" for the POS app from inside the dashboard.
 *
 * The cashier-facing POS is a separate application: the Electron Windows app on
 * each till, OR the browser version at http://<server>:5173 in dev. Managers
 * sometimes need to open it themselves (training a new cashier, troubleshooting,
 * showing a customer something). This screen gives them one click + the URL +
 * the installer download link without having to remember where any of that lives.
 */

type Reachability = 'unknown' | 'ok' | 'unreachable'

const POS_URL_DEFAULT = 'http://localhost:5173'

export default function PosLauncherScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  // For dev the POS lives on the same host as the dashboard at :5173. For
  // production deployments where the POS is the Electron app on the till, the
  // URL is whatever the operator pointed terminals at — usually the LAN IP of
  // the back-office server. We allow the operator to override at build time
  // via VITE_POS_URL, otherwise fall back to localhost:5173.
  const posUrl = (import.meta.env.VITE_POS_URL as string | undefined) ?? POS_URL_DEFAULT

  const [reach, setReach] = useState<Reachability>('unknown')

  // Ping the POS to tell the manager if it's actually running.
  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    fetch(posUrl, { method: 'GET', mode: 'no-cors', signal: ctrl.signal })
      .then(() => { if (!cancelled) setReach('ok') })
      .catch(() => { if (!cancelled) setReach('unreachable') })
      .finally(() => clearTimeout(t))
    return () => { cancelled = true; ctrl.abort() }
  }, [posUrl])

  return (
    <div style={{ padding: 36, maxWidth: 980 }}>
      <header style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          🛒  {isNl ? 'POS-app' : 'POS app'}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
          {isNl
            ? 'De POS-app is wat de kassamedewerker gebruikt om verkopen aan te slaan. Hieronder kunt u hem openen of de installer downloaden voor een nieuwe kassa.'
            : 'The POS app is what the cashier uses to ring up sales. Open it here, or download the installer for a new till.'}
        </p>
      </header>

      {/* Two cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>

        {/* Browser POS */}
        <div style={card()}>
          <span style={pill(reach)}>
            {reach === 'ok'          ? (isNl ? '● Online'     : '● Online') :
             reach === 'unreachable' ? (isNl ? '○ Niet bereikbaar' : '○ Unreachable') :
                                       (isNl ? '… controleren'    : '… checking')}
          </span>
          <h3 style={cardH()}>{isNl ? 'POS in browser' : 'POS in the browser'}</h3>
          <p style={cardP()}>
            {isNl
              ? 'Geschikt voor training, testen en kleine winkels die geen dedicated kassaterminal hebben.'
              : 'For training, testing, and small shops that don\'t have a dedicated till terminal.'}
          </p>
          <p style={mono()}>{posUrl}</p>
          <button onClick={() => window.open(posUrl, '_blank', 'noopener')}
            disabled={reach === 'unreachable'}
            style={primaryBtn(reach !== 'unreachable')}>
            {isNl ? 'Open POS in nieuw tabblad →' : 'Open POS in new tab →'}
          </button>
        </div>

        {/* Electron installer */}
        <div style={card()}>
          <span style={{ ...pill('unknown'), background: '#eef2ff', color: '#1a234f', borderColor: '#c7d2fe' }}>
            {isNl ? '📦 Voor kassaterminals' : '📦 For till terminals'}
          </span>
          <h3 style={cardH()}>{isNl ? 'Windows-installer' : 'Windows installer'}</h3>
          <p style={cardP()}>
            {isNl
              ? 'De officiële installer voor Windows-kassaterminals. Op de eerste start opent Josbin POS automatisch als de kassa wordt aangezet.'
              : 'The official installer for Windows till terminals. After first launch, Josbin POS opens automatically when the till boots.'}
          </p>
          <p style={mono()}>Josbin POS-{`{version}`}-Setup.exe</p>
          <p style={{ fontSize: 12, color: '#7e88a0', marginBottom: 12 }}>
            {isNl
              ? 'Vraag uw Josbin POS-contactpersoon om de actuele installer voor uw licentie.'
              : 'Ask your Josbin POS contact for the current installer for your license.'}
          </p>
          <button onClick={() => alert(isNl
                ? 'Neem contact op met uw Josbin POS-leverancier voor de installer.'
                : 'Contact your Josbin POS vendor for the installer.')}
            style={secondaryBtn()}>
            {isNl ? 'Hoe krijg ik de installer?' : 'How do I get the installer?'}
          </button>
        </div>
      </div>

      {/* How a cashier logs in */}
      <div style={{ ...card(), marginTop: 24 }}>
        <h3 style={cardH()}>{isNl ? 'Hoe een kassamedewerker inlogt' : 'How a cashier logs in'}</h3>
        <ol style={{ margin: '10px 0 0 18px', padding: 0, color: '#374151', fontSize: 14, lineHeight: 1.7 }}>
          <li>{isNl ? 'Open de POS-app (klik op het Josbin POS bureaubladpictogram, of via de knop hierboven).' : 'Open the POS app (Josbin POS desktop icon, or the button above).'}</li>
          <li>{isNl ? 'Log in met het kassamedewerker-account (bv. kassa@dehoop.sr).' : 'Log in with the cashier account (e.g. kassa@dehoop.sr).'}</li>
          <li>{isNl ? 'Kies de vestiging als er meerdere zijn.' : 'Pick the store if more than one is available.'}</li>
          <li>{isNl ? 'Kies de kassa (Kassa 1, Kassa 2…) en voer het openingsgeld in.' : 'Pick the register (Kassa 1, Kassa 2…) and enter the opening float.'}</li>
          <li>{isNl ? 'Klik Open. Klaar om te verkopen.' : 'Tap Open. Ready to sell.'}</li>
        </ol>
        <p style={{ marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          {isNl
            ? 'Volledige stap-voor-stap handleiding voor de kassamedewerker: ' :
              'Full step-by-step guide for the cashier: '}
          <a href="http://localhost:5180/user_manual/" target="_blank" rel="noopener"
            style={{ color: '#1f2a63', fontWeight: 700, textDecoration: 'none' }}>
            {isNl ? 'POS Gebruikershandleiding ↗' : 'POS User Manual ↗'}
          </a>
        </p>
      </div>
    </div>
  )
}

const card = (): React.CSSProperties => ({
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14,
  padding: 24, display: 'flex', flexDirection: 'column', gap: 10,
})
const cardH = (): React.CSSProperties => ({ margin: '6px 0 0', fontSize: 17, fontWeight: 800, color: '#16203a' })
const cardP = (): React.CSSProperties => ({ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.55 })
const mono = (): React.CSSProperties => ({
  margin: '6px 0', fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 13, color: '#16203a', background: '#f9fafb',
  padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
})
const pill = (r: Reachability): React.CSSProperties => ({
  alignSelf: 'flex-start',
  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
  border: '1px solid',
  background: r === 'ok' ? '#d1fae5' : r === 'unreachable' ? '#fee2e2' : '#f3f4f6',
  color:      r === 'ok' ? '#065f46' : r === 'unreachable' ? '#991b1b' : '#374151',
  borderColor:r === 'ok' ? '#a7f3d0' : r === 'unreachable' ? '#fecaca' : '#e5e7eb',
})
const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 10, border: 'none',
  background: enabled ? 'linear-gradient(135deg,#293371,#1f2a63)' : '#cbd5e1',
  color: '#fff', fontSize: 14, fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  boxShadow: enabled ? '0 4px 14px rgba(41,51,113,.35)' : 'none',
})
const secondaryBtn = (): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 10, border: '1px solid #c7d2fe',
  background: '#eef2ff', color: '#1a234f', fontSize: 13, fontWeight: 700, cursor: 'pointer',
})
