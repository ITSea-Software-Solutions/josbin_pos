import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  downloadInstaller, getInstallerInfo, posServerAddress,
} from '@/api/installer'

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
  const [dlPct, setDlPct]   = useState<number | null>(null)
  const [dlBusy, setDlBusy] = useState(false)
  const [dlPlat, setDlPlat] = useState<'windows' | 'android' | null>(null)
  const [dlErr, setDlErr]   = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Is an installer deployed on THIS server? A 403 (cashier) or a missing file
  // both simply mean "don't show the card" — never an error state.
  const { data: installer } = useQuery({
    queryKey: ['installer-info'],
    queryFn: getInstallerInfo,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const serverAddress = posServerAddress()

  async function handleDownload(platform: 'windows' | 'android' = 'windows') {
    const filename = platform === 'android' ? installer?.android?.filename : installer?.filename
    if (!filename) return
    setDlBusy(true); setDlPlat(platform); setDlErr(null); setDlPct(0)
    try {
      await downloadInstaller(filename, setDlPct, platform)
    } catch {
      setDlErr(isNl
        ? 'Download mislukt. Controleer de verbinding met de server en probeer opnieuw.'
        : 'Download failed. Check the connection to the server and try again.')
    } finally {
      setDlBusy(false); setDlPlat(null); setDlPct(null)
    }
  }

  function copyAddress() {
    navigator.clipboard?.writeText(serverAddress).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000) },
      () => {/* clipboard blocked — the address is on screen to type */},
    )
  }

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

        {/* Electron installer — real download from THIS server */}
        <div style={card()}>
          <span style={{ ...pill('unknown'), background: '#eef2ff', color: '#1a234f', borderColor: '#c7d2fe' }}>
            {isNl ? '📦 Voor kassaterminals' : '📦 For till terminals'}
          </span>
          <h3 style={cardH()}>{isNl ? 'Installer voor kassa’s' : 'Till installer'}</h3>

          {installer?.available ? (
            <>
              <p style={cardP()}>
                {isNl
                  ? 'Download op de kassaterminal zelf en voer hem uit. Werkt volledig via het winkelnetwerk — internet is niet nodig.'
                  : 'Download on the till itself and run it. Works entirely over the store network — no internet needed.'}
              </p>

              {installer.filename && (
                <>
                  <p style={mono()}>
                    🪟 {installer.filename}
                    {installer.size_bytes
                      ? `  ·  ${(installer.size_bytes / 1048576).toFixed(0)} MB`
                      : ''}
                  </p>
                  <button onClick={() => handleDownload('windows')} disabled={dlBusy} style={primaryBtn(!dlBusy)}>
                    {dlBusy && dlPlat === 'windows'
                      ? (dlPct !== null
                          ? `${isNl ? 'Downloaden' : 'Downloading'}… ${dlPct}%`
                          : (isNl ? 'Downloaden…' : 'Downloading…'))
                      : (isNl ? '⬇ Windows-installer (.exe)' : '⬇ Windows installer (.exe)')}
                  </button>
                  <p style={{ fontSize: 12, color: '#7e88a0', margin: 0 }}>
                    {isNl
                      ? 'Windows kan "onbekende uitgever" tonen bij een niet-ondertekende versie: Meer info → Toch uitvoeren.'
                      : 'Windows may warn "unknown publisher" on an unsigned build: More info → Run anyway.'}
                  </p>
                </>
              )}

              {installer.android && (
                <>
                  <p style={mono()}>
                    🤖 {installer.android.filename}
                    {`  ·  ${(installer.android.size_bytes / 1048576).toFixed(1)} MB`}
                  </p>
                  <button onClick={() => handleDownload('android')} disabled={dlBusy} style={primaryBtn(!dlBusy)}>
                    {dlBusy && dlPlat === 'android'
                      ? (dlPct !== null
                          ? `${isNl ? 'Downloaden' : 'Downloading'}… ${dlPct}%`
                          : (isNl ? 'Downloaden…' : 'Downloading…'))
                      : (isNl ? '⬇ Android-app (.apk)' : '⬇ Android app (.apk)')}
                  </button>
                  <p style={{ fontSize: 12, color: '#7e88a0', margin: 0 }}>
                    {isNl
                      ? 'Voor Android-kassaterminals (bijv. Posiflex RT): download in Chrome op de terminal zelf, tik op het bestand en sta "onbekende apps installeren" toe.'
                      : 'For Android till terminals (e.g. Posiflex RT): download in Chrome on the terminal itself, tap the file, and allow "install unknown apps".'}
                  </p>
                </>
              )}

              {dlErr && <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>{dlErr}</p>}
            </>
          ) : (
            <>
              <p style={cardP()}>
                {isNl
                  ? 'Op deze server staat nog geen installer. Uw Josbin POS-contactpersoon plaatst het bestand op de winkelserver, daarna verschijnt hier een downloadknop.'
                  : 'No installer is deployed on this server yet. Your Josbin POS contact places the file on the store server, after which a download button appears here.'}
              </p>
              {installer?.expected_dir && (
                <p style={{ ...mono(), fontSize: 11.5 }}>{installer.expected_dir}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Server address — what a fresh till must be pointed at */}
      <div style={{ ...card(), marginTop: 24, borderColor: '#c7d2fe', background: '#f8faff' }}>
        <h3 style={cardH()}>
          {isNl ? '🔗 Serveradres voor de kassa\'s' : '🔗 Server address for the tills'}
        </h3>
        <p style={cardP()}>
          {isNl
            ? 'Elke kassa moet naar deze server wijzen. Eén installer werkt voor iedere winkel — het adres stelt u per kassa in, opnieuw bouwen is nooit nodig.'
            : 'Every till must point at this server. One installer works for every store — you set the address per till, a rebuild is never needed.'}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...mono(), margin: 0, fontSize: 15, fontWeight: 700 }}>{serverAddress}</span>
          <button onClick={copyAddress} style={secondaryBtn()}>
            {copied ? (isNl ? '✓ Gekopieerd' : '✓ Copied') : (isNl ? '📋 Kopiëren' : '📋 Copy')}
          </button>
        </div>
        <ol style={{ margin: '10px 0 0 18px', padding: 0, color: '#374151', fontSize: 13.5, lineHeight: 1.75 }}>
          <li>{isNl ? 'Open de POS-app op de kassa.' : 'Open the POS app on the till.'}</li>
          <li>{isNl ? 'Klik op ⚙ Server op het inlogscherm (of Instellingen → Systeem).' : 'Click ⚙ Server on the login screen (or Settings → System).'}</li>
          <li>{isNl ? 'Plak het adres hierboven → Testen → Opslaan & herstarten.' : 'Paste the address above → Test → Save & restart.'}</li>
        </ol>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6b7280', lineHeight: 1.6 }}>
          {isNl
            ? '⚠ Alle kassa\'s van één vestiging moeten hetzelfde adres gebruiken — anders komen verkopen in twee gescheiden administraties terecht. Controleer per kassa via Instellingen → Systeem.'
            : '⚠ All tills in one store must use the same address — otherwise sales end up in two separate sets of books. Verify per till under Settings → System.'}
        </p>
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
  background: enabled ? 'linear-gradient(135deg,#003366,#1f2a63)' : '#cbd5e1',
  color: '#fff', fontSize: 14, fontWeight: 700,
  cursor: enabled ? 'pointer' : 'not-allowed',
  boxShadow: enabled ? '0 4px 14px rgba(0,51,102,.35)' : 'none',
})
const secondaryBtn = (): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 10, border: '1px solid #c7d2fe',
  background: '#eef2ff', color: '#1a234f', fontSize: 13, fontWeight: 700, cursor: 'pointer',
})
