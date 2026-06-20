import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'

/**
 * Belastingdienst Suriname — government BTW-inspection portal login.
 *
 * A deliberately DISTINCT, institutional entry point for tax officials
 * (role: tax_inspector), reached at /belastingdienst. It reuses the normal
 * auth store — 2FA (mandatory for this role) is handled by App.tsx — but wears
 * an official Suriname tax-authority identity instead of the commercial
 * "Management Portal" chrome.
 *
 * NOTE: the emblem here is a neutral star/seal motif inspired by the national
 * flag — NOT the official Republic of Suriname coat of arms (a protected state
 * emblem). Drop the official Belastingdienst logo into the marked slot on
 * delivery.
 */
const STYLES = `
  @keyframes bd-rise { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bd-spin { to{transform:rotate(360deg)} }
  .bd-input {
    width:100%; height:52px;
    background:#ffffff;
    border:1.5px solid #cdd8d0;
    border-radius:10px;
    color:#0e1a14; font-size:15px;
    padding:0 46px 0 44px;
    outline:none;
    transition:border-color .15s, box-shadow .15s;
    font-family:inherit; box-sizing:border-box;
  }
  .bd-input::placeholder{color:#9aa8a0}
  .bd-input:focus{border-color:#1f6b3b; box-shadow:0 0 0 3px rgba(31,107,59,.16)}
  .bd-input:disabled{opacity:.5;cursor:not-allowed;background:#f1f4f2}
  .bd-btn {
    width:100%; height:52px; border:none; border-radius:10px;
    font-size:15.5px; font-weight:700; letter-spacing:.2px; cursor:pointer;
    color:#fff; font-family:inherit;
    background:#1f6b3b;
    box-shadow:0 6px 18px rgba(15,58,34,.28);
    transition:background .15s, transform .12s, box-shadow .15s;
  }
  .bd-btn:not(:disabled):hover{background:#185730;box-shadow:0 8px 22px rgba(15,58,34,.34);transform:translateY(-1px)}
  .bd-btn:not(:disabled):active{transform:translateY(0)}
  .bd-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
  .bd-lang { display:flex; border:1px solid rgba(255,255,255,.28); border-radius:8px; overflow:hidden }
  .bd-lang button{padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.8px;border:none;cursor:pointer;font-family:inherit;background:transparent;color:rgba(255,255,255,.62);transition:all .12s}
  .bd-lang button.active{background:#f4c430;color:#0c3a22}
  .bd-lang button:hover:not(.active){background:rgba(255,255,255,.12);color:#fff}
`

/** National-flag stripe: green / white / red / white / green with the star. */
function FlagStripe() {
  return (
    <div aria-hidden style={{ display: 'flex', flexDirection: 'column', width: 46, height: 30, borderRadius: 3, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.3)', position: 'relative' }}>
      <div style={{ flex: 2, background: '#377e3f' }} />
      <div style={{ flex: 1, background: '#fff' }} />
      <div style={{ flex: 2, background: '#c8102e' }} />
      <div style={{ flex: 1, background: '#fff' }} />
      <div style={{ flex: 2, background: '#377e3f' }} />
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4c430', fontSize: 13, lineHeight: 1 }}>★</span>
    </div>
  )
}

export default function BelastingdienstLoginScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const login      = useDashboardAuthStore((s) => s.login)
  const isLoading  = useDashboardAuthStore((s) => s.isLoading)
  const error      = useDashboardAuthStore((s) => s.error)
  const clearError = useDashboardAuthStore((s) => s.clearError)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    const id = 'bd-login-styles'
    if (!document.getElementById(id)) {
      const tag = document.createElement('style')
      tag.id = id; tag.textContent = STYLES
      document.head.appendChild(tag)
    }
    return () => { clearError() }
  }, [clearError])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); clearError()
    await login(email, password).catch(() => {})
  }

  const POINTS = [
    { nl: 'Ingediende BTW-aangiften van alle aangesloten winkels bekijken', en: 'Review submitted BTW filings from every connected shop' },
    { nl: 'Inzoomen tot op de onderliggende kassa- en transactiegegevens', en: 'Drill down to the underlying POS & transaction data' },
    { nl: 'Rekenkamer-waardige, onveranderbare export voor dossiervorming', en: 'Court-of-Audit-grade, tamper-evident export for case files' },
  ]

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
      position: 'fixed', top: 0, left: 0,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      background: '#0c3a22',
    }}>
      {/* ══ LEFT — OFFICIAL IDENTITY RAIL ══════════════════════════════════════ */}
      <div style={{
        flex: '0 0 50%', position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 56px',
        background: 'linear-gradient(160deg,#0e4429 0%,#0c3a22 55%,#082619 100%)',
        color: '#eaf2ec',
      }}>
        {/* faint seal watermark */}
        <div aria-hidden style={{ position: 'absolute', right: -90, top: '50%', transform: 'translateY(-50%)', fontSize: 460, color: 'rgba(244,196,48,.04)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>★</div>

        {/* Top: flag + republic overline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <FlagStripe />
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '2.5px', color: 'rgba(234,242,236,.72)', textTransform: 'uppercase' }}>
            {isNl ? 'Republiek Suriname' : 'Republic of Suriname'}
          </div>
        </div>

        {/* Emblem + wordmark */}
        <div style={{ position: 'relative' }}>
          {/* ▼▼ OFFICIAL LOGO SLOT — replace this seal with the Belastingdienst logo ▼▼ */}
          <div style={{
            width: 78, height: 78, borderRadius: '50%', marginBottom: 26,
            background: 'radial-gradient(circle at 50% 38%, #1a5c38 0%, #0f3f27 100%)',
            border: '2px solid #f4c430',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 26px rgba(0,0,0,.35)',
          }}>
            <span style={{ fontSize: 38, color: '#f4c430', lineHeight: 1 }}>★</span>
          </div>

          <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 40, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.5px', color: '#fff' }}>
            Belastingdienst<br />Suriname
          </div>
          <div style={{ marginTop: 14, fontSize: 15, color: 'rgba(234,242,236,.8)', fontWeight: 600, letterSpacing: '.3px' }}>
            {isNl ? 'BTW-inspectieportaal' : 'BTW Inspection Portal'}
          </div>

          <p style={{ marginTop: 22, fontSize: 14.5, lineHeight: 1.7, color: 'rgba(234,242,236,.62)', maxWidth: 400 }}>
            {isNl
              ? 'Beveiligde overheidsomgeving voor het beoordelen van BTW-aangiften die winkels via Josbin POS indienen.'
              : 'Secure government environment for reviewing the BTW filings that shops submit through Josbin POS.'}
          </p>

          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 13 }}>
            {POINTS.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, animation: 'bd-rise .5s ease both', animationDelay: `${i * 0.08}s` }}>
                <span style={{ flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: 5, background: 'rgba(244,196,48,.16)', border: '1px solid rgba(244,196,48,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f4c430', fontSize: 12, fontWeight: 900 }}>✓</span>
                <span style={{ fontSize: 13.5, color: 'rgba(234,242,236,.82)', lineHeight: 1.5 }}>{isNl ? p.nl : p.en}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer notice */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'rgba(234,242,236,.5)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f4c430' }} />
          {isNl ? 'Officieel systeem · Paramaribo · AST (UTC−3)' : 'Official system · Paramaribo · AST (UTC−3)'}
        </div>
      </div>

      {/* ══ RIGHT — SIGN-IN ════════════════════════════════════════════════════ */}
      <div style={{ flex: '0 0 50%', position: 'relative', background: '#f4f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 36px' }}>
        {/* Language toggle */}
        <div style={{ position: 'absolute', top: 22, right: 24 }}>
          <div className="bd-lang" style={{ borderColor: '#cdd8d0' }}>
            {(['nl', 'en'] as const).map((l) => (
              <button key={l} onClick={() => i18n.changeLanguage(l)} className={i18n.language === l ? 'active' : ''}
                style={i18n.language === l ? {} : { color: '#5b6b62' }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: 416, animation: 'bd-rise .4s ease both' }}>
          {/* Header */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#e6efe9', border: '1px solid #cfe0d5', borderRadius: 20, padding: '5px 13px', marginBottom: 18 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f6b3b' }} />
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.8px', color: '#1f6b3b', textTransform: 'uppercase' }}>
                {isNl ? 'Beveiligde toegang' : 'Secure access'}
              </span>
            </div>
            <h1 style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 30, fontWeight: 700, color: '#0e1a14', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
              {isNl ? 'Aanmelden' : 'Sign in'}
            </h1>
            <p style={{ fontSize: 14, color: '#5b6b62', lineHeight: 1.5, margin: 0 }}>
              {isNl ? 'Uitsluitend voor geautoriseerde belastingambtenaren.' : 'For authorised tax officials only.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fdecec', border: '1px solid #f5c2c2', borderRadius: 10, padding: '12px 15px', marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: '50%', background: '#c8102e', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>!</span>
              <span style={{ fontSize: 13.5, color: '#a01024', lineHeight: 1.45 }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#34433b', marginBottom: 8 }}>
                {isNl ? 'Dienst-e-mailadres' : 'Official email address'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#9aa8a0', pointerEvents: 'none' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email"
                  placeholder="naam@belastingdienst.sr" className="bd-input" disabled={isLoading} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#34433b', marginBottom: 8 }}>
                {isNl ? 'Wachtwoord' : 'Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#9aa8a0', pointerEvents: 'none' }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                  placeholder="••••••••••" className="bd-input" disabled={isLoading} />
                <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: showPw ? '#1f6b3b' : '#9aa8a0', display: 'flex' }}>
                  {showPw
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading || !email || !password} className="bd-btn" style={{ marginTop: 4 }}>
              {isLoading
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'bd-spin .75s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    {isNl ? 'Bezig met aanmelden…' : 'Signing in…'}
                  </span>
                : (isNl ? 'Veilig aanmelden' : 'Sign in securely')}
            </button>
          </form>

          {/* 2FA-mandatory notice */}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-start', gap: 9, background: '#fff8e6', border: '1px solid #f0dca0', borderRadius: 10, padding: '11px 14px' }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>🔐</span>
            <span style={{ fontSize: 12.5, color: '#6b5a1e', lineHeight: 1.5 }}>
              {isNl
                ? 'Tweestapsverificatie is verplicht voor overheidsaccounts. Toegang wordt vastgelegd in het auditlogboek.'
                : 'Two-factor authentication is mandatory for government accounts. Access is recorded in the audit log.'}
            </span>
          </div>

          {/* Security badges */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 9, flexWrap: 'wrap' }}>
            {[
              { icon: '🔐', label: '2FA' },
              { icon: '🛡️', label: 'AES-256' },
              { icon: '⚖️', label: 'WBP-S' },
              { icon: '📋', label: 'Rekenkamer' },
            ].map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #d8e2db', borderRadius: 18, padding: '5px 11px' }}>
                <span style={{ fontSize: 11 }}>{b.icon}</span>
                <span style={{ fontSize: 10.5, color: '#5b6b62', fontWeight: 700 }}>{b.label}</span>
              </div>
            ))}
          </div>

          {/* Back to commercial portal */}
          <div style={{ marginTop: 26, textAlign: 'center' }}>
            <a href="/" style={{ fontSize: 12.5, color: '#5b6b62', textDecoration: 'none', fontWeight: 600 }}>
              {isNl ? '← Naar het beheerportaal' : '← To the management portal'}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
