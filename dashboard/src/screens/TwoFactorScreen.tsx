import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'

// Match the Belastingdienst portal skin when 2FA is reached via /belastingdienst
// (the role isn't known yet during the challenge, so we key off the URL).
const IS_TAX_PORTAL = /(^|\/)belastingdienst\/?$/i.test(window.location.pathname)
  || new URLSearchParams(window.location.search).has('belastingdienst')
const ACCENT       = IS_TAX_PORTAL ? '#1f6b3b' : '#7c3aed'
const ACCENT_GRAD  = IS_TAX_PORTAL ? 'linear-gradient(135deg,#1f6b3b,#0e4429)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)'
const ACCENT_SHADOW = IS_TAX_PORTAL ? '0 8px 24px rgba(15,58,34,0.4)' : '0 8px 24px rgba(124,58,237,0.4)'
const PAGE_BG      = IS_TAX_PORTAL ? 'linear-gradient(135deg,#0e4429 0%,#0c3a22 100%)' : 'linear-gradient(135deg, #1c1c2e 0%, #2d2d44 100%)'

// ─── 2FA Challenge ────────────────────────────────────────────────────────────
function ChallengeView() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const submitChallenge = useDashboardAuthStore((s) => s.submitChallenge)
  const isLoading       = useDashboardAuthStore((s) => s.isLoading)
  const error           = useDashboardAuthStore((s) => s.error)
  const clearError      = useDashboardAuthStore((s) => s.clearError)
  const logout          = useDashboardAuthStore((s) => s.logout)

  const [code, setCode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    clearError()
    try {
      await submitChallenge(code)
    } catch {
      setCode('')
      inputRef.current?.focus()
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.iconBox}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 28, height: 28 }}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      </div>

      <h1 style={styles.title}>{isNl ? 'Twee-factor authenticatie' : 'Two-Factor Authentication'}</h1>
      <p style={styles.subtitle}>
        {isNl
          ? 'Voer de 6-cijferige code in uit uw authenticator-app.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          style={{
            ...styles.codeInput,
            letterSpacing: '0.6em',
            fontFamily: 'monospace',
            fontSize: 26,
            textAlign: 'center',
            borderColor: error ? '#ef4444' : code.length === 6 ? ACCENT : '#e0e0ed',
          }}
          disabled={isLoading}
        />

        {error && (
          <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isLoading || code.length !== 6}
          style={{
            ...styles.btn,
            opacity: isLoading || code.length !== 6 ? 0.6 : 1,
            marginTop: 20,
          }}
        >
          {isLoading
            ? (isNl ? 'Verifiëren…' : 'Verifying…')
            : (isNl ? 'Verifiëren' : 'Verify')}
        </button>
      </form>

      <button
        onClick={() => logout()}
        style={{ ...styles.linkBtn, marginTop: 20 }}
      >
        ← {isNl ? 'Terug naar inloggen' : 'Back to login'}
      </button>
    </div>
  )
}

// ─── 2FA Setup ────────────────────────────────────────────────────────────────
type SetupStep = 'qr' | 'confirm' | 'done'

function SetupView() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const fetchSetupQr     = useDashboardAuthStore((s) => s.fetchSetupQr)
  const submitSetupConfirm = useDashboardAuthStore((s) => s.submitSetupConfirm)
  const isLoading        = useDashboardAuthStore((s) => s.isLoading)
  const error            = useDashboardAuthStore((s) => s.error)
  const clearError       = useDashboardAuthStore((s) => s.clearError)
  const logout           = useDashboardAuthStore((s) => s.logout)

  const [step, setStep]               = useState<SetupStep>('qr')
  const [qrData, setQrData]           = useState<{ secret: string; qr_code_url: string } | null>(null)
  const [code, setCode]               = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [fetchError, setFetchError]   = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchSetupQr()
      .then(setQrData)
      .catch(() => setFetchError(isNl ? 'Kon QR-code niet laden.' : 'Could not load QR code.'))
  }, [fetchSetupQr, isNl])

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6) return
    clearError()
    try {
      const { recovery_codes } = await submitSetupConfirm(code)
      setRecoveryCodes(recovery_codes)
      setStep('done')
    } catch {
      setCode('')
      codeRef.current?.focus()
    }
  }

  if (step === 'done') {
    return (
      <div style={styles.card}>
        <div style={{ ...styles.iconBox, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ width: 26, height: 26 }}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 style={styles.title}>{isNl ? '2FA ingeschakeld!' : '2FA Enabled!'}</h1>
        <p style={styles.subtitle}>
          {isNl
            ? 'Twee-factor authenticatie is succesvol ingesteld. Bewaar uw herstelcodes op een veilige plek.'
            : 'Two-factor authentication is set up successfully. Save your recovery codes in a safe place.'}
        </p>

        <div style={{ marginTop: 24, background: '#1c1c2e', borderRadius: 10, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
            {isNl ? 'HERSTELCODES' : 'RECOVERY CODES'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {recoveryCodes.map((c) => (
              <code key={c} style={{ fontSize: 12, fontFamily: 'monospace', color: '#a78bfa', background: 'rgba(124,58,237,0.15)', padding: '4px 8px', borderRadius: 6 }}>{c}</code>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#9090a0', marginTop: 16, textAlign: 'center' }}>
          {isNl
            ? 'U bent nu ingelogd en wordt doorgestuurd naar het dashboard.'
            : 'You are now logged in and will be redirected to the dashboard.'}
        </p>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      <div style={styles.iconBox}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} style={{ width: 28, height: 28 }}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
      </div>

      <h1 style={styles.title}>{isNl ? '2FA instellen' : 'Set Up 2FA'}</h1>

      {step === 'qr' && (
        <>
          <p style={styles.subtitle}>
            {isNl
              ? 'Uw account vereist twee-factor authenticatie. Scan de QR-code met uw authenticator-app.'
              : 'Your account requires two-factor authentication. Scan the QR code with your authenticator app.'}
          </p>

          {fetchError ? (
            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 16, textAlign: 'center' }}>{fetchError}</p>
          ) : !qrData ? (
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e9e9ef', borderTopColor: ACCENT, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* QR code via Google Charts API (offline-safe for local Docker) */}
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #e9e9ef' }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData.qr_code_url)}`}
                    alt="QR Code"
                    width={180}
                    height={180}
                    style={{ display: 'block' }}
                  />
                </div>
                <div style={{ background: '#f5f5f8', borderRadius: 8, padding: '10px 16px', width: '100%' }}>
                  <p style={{ fontSize: 11, color: '#9090a0', marginBottom: 4 }}>
                    {isNl ? 'Of voer de code handmatig in:' : 'Or enter manually:'}
                  </p>
                  <code style={{ fontSize: 13, fontFamily: 'monospace', color: '#1c1c2e', wordBreak: 'break-all', letterSpacing: '0.1em' }}>{qrData.secret}</code>
                </div>
              </div>

              <button onClick={() => setStep('confirm')} style={{ ...styles.btn, marginTop: 24 }}>
                {isNl ? 'Ik heb de code gescand →' : 'I scanned the code →'}
              </button>
            </>
          )}
        </>
      )}

      {step === 'confirm' && (
        <>
          <p style={styles.subtitle}>
            {isNl
              ? 'Voer de 6-cijferige code in van uw authenticator-app om de installatie te bevestigen.'
              : 'Enter the 6-digit code from your authenticator app to confirm setup.'}
          </p>

          <form onSubmit={handleConfirm} style={{ marginTop: 24 }}>
            <input
              ref={codeRef}
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={{
                ...styles.codeInput,
                letterSpacing: '0.6em',
                fontFamily: 'monospace',
                fontSize: 26,
                textAlign: 'center',
                borderColor: error ? '#ef4444' : code.length === 6 ? ACCENT : '#e0e0ed',
              }}
              disabled={isLoading}
            />

            {error && (
              <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => { setStep('qr'); setCode(''); clearError() }}
                style={{ ...styles.btnOutline, flex: 1 }}
              >
                ← {isNl ? 'Terug' : 'Back'}
              </button>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                style={{ ...styles.btn, flex: 2, opacity: isLoading || code.length !== 6 ? 0.6 : 1 }}
              >
                {isLoading
                  ? (isNl ? 'Bevestigen…' : 'Confirming…')
                  : (isNl ? 'Bevestigen' : 'Confirm')}
              </button>
            </div>
          </form>
        </>
      )}

      <button onClick={() => logout()} style={{ ...styles.linkBtn, marginTop: 16 }}>
        ← {isNl ? 'Annuleren en uitloggen' : 'Cancel and log out'}
      </button>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function TwoFactorScreen() {
  const twoFactor = useDashboardAuthStore((s) => s.twoFactor)

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: PAGE_BG,
      padding: 24,
    }}>
      {twoFactor.type === 'challenge' && <ChallengeView />}
      {twoFactor.type === 'setup'     && <SetupView />}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  card: {
    background: '#fff',
    borderRadius: 20,
    padding: '40px 40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    background: ACCENT_GRAD,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: ACCENT_SHADOW,
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: '#1c1c2e',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 14,
    color: '#6d6d80',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
  codeInput: {
    display: 'block',
    width: '100%',
    padding: '16px 12px',
    borderRadius: 12,
    border: '2px solid #e0e0ed',
    outline: 'none',
    background: '#fafafa',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box' as const,
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '14px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    background: ACCENT_GRAD,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    boxShadow: ACCENT_SHADOW,
    transition: 'opacity 0.15s',
  },
  btnOutline: {
    display: 'block',
    padding: '14px',
    borderRadius: 12,
    border: '2px solid #e0e0ed',
    cursor: 'pointer',
    background: '#fff',
    color: '#6d6d80',
    fontSize: 14,
    fontWeight: 600,
    transition: 'border-color 0.15s',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9090a0',
    fontSize: 13,
    fontWeight: 500,
  },
} as const
