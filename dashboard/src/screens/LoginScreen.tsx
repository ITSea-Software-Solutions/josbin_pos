import { useState, useEffect, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useDashboardAuthStore } from '@/store/authStore'

const STYLES = `
  @keyframes orb-a { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(60px,-80px) scale(1.1)} 70%{transform:translate(-40px,50px) scale(0.93)} }
  @keyframes orb-b { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-70px,40px) scale(1.07)} 66%{transform:translate(50px,-55px) scale(0.96)} }
  @keyframes orb-c { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,60px)} }
  @keyframes fade-rise { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer-btn { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes spin-login { to{transform:rotate(360deg)} }
  @keyframes badge-pop { 0%{opacity:0;transform:scale(0.85) translateY(8px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  .login-input {
    width:100%; height:54px;
    background:rgba(255,255,255,0.055);
    border:1.5px solid rgba(255,255,255,0.1);
    border-radius:14px;
    color:#f1f5f9; font-size:15px;
    padding:0 50px 0 48px;
    outline:none;
    transition:border-color .2s, background .2s, box-shadow .2s;
    font-family:inherit; box-sizing:border-box;
  }
  .login-input::placeholder{color:rgba(148,163,184,0.45)}
  .login-input:focus{border-color:#293371;background:rgba(41,51,113,0.09);box-shadow:0 0 0 4px rgba(41,51,113,0.2)}
  .login-input:disabled{opacity:.4;cursor:not-allowed}
  .login-btn {
    width:100%; height:54px; border:none; border-radius:14px;
    font-size:16px; font-weight:700; letter-spacing:.3px; cursor:pointer;
    color:#fff; font-family:inherit;
    background:linear-gradient(135deg,#ef6c00 0%,#d95f00 50%,#ef6c00 100%);
    background-size:200% auto;
    box-shadow:0 6px 28px rgba(239,108,0,0.45);
    transition:opacity .2s,transform .15s,box-shadow .2s;
  }
  .login-btn:not(:disabled):hover{animation:shimmer-btn 1.3s linear infinite;box-shadow:0 8px 36px rgba(239,108,0,0.6);transform:translateY(-1px)}
  .login-btn:not(:disabled):active{transform:translateY(0)}
  .login-btn:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
  .lang-pill {
    position:absolute; top:24px; right:24px;
    background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
    border-radius:24px; overflow:hidden; display:flex;
    z-index:10;
  }
  .lang-pill button {
    padding:6px 16px; font-size:11px; font-weight:800; letter-spacing:1px;
    border:none; cursor:pointer; font-family:inherit; transition:all .15s;
    color:rgba(248,250,252,.6); background:transparent;
  }
  .lang-pill button.active{background:rgba(41,51,113,.5);color:#fff}
  .lang-pill button:hover:not(.active){background:rgba(255,255,255,.07);color:#fff}
  .feat-row{display:flex;align-items:flex-start;gap:12px;animation:fade-rise .5s ease both}
`

export default function LoginScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const login      = useDashboardAuthStore((s) => s.login)
  const isLoading  = useDashboardAuthStore((s) => s.isLoading)
  const error      = useDashboardAuthStore((s) => s.error)
  const clearError = useDashboardAuthStore((s) => s.clearError)

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)

  useEffect(() => {
    const id = 'jdash-login-styles'
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

  const FEATURES = [
    { nl: 'Realtime omzetinzicht over alle vestigingen', en: 'Real-time revenue across all locations' },
    { nl: 'BTW-rapportage voor Belastingdienst Suriname', en: 'BTW reporting for Belastingdienst Suriname' },
    { nl: 'Rekenkamer-klaar auditlogboek & exportfunctie', en: 'Court-of-Audit-ready immutable audit log' },
    { nl: 'Vijf-laags offline sync & nood-USB-back-up', en: 'Five-layer offline sync & emergency USB backup' },
  ]

  const STATS = [
    { n: '6', sub: isNl ? 'Gebruikersrollen' : 'User roles' },
    { n: 'SRD', sub: isNl ? 'Surinaamse dollar' : 'Surinamese dollar' },
    { n: '10%', sub: isNl ? 'BTW-tarief' : 'BTW rate' },
    { n: '5×', sub: isNl ? 'Sync lagen' : 'Sync layers' },
  ]

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      overflow: 'hidden', position: 'fixed', top: 0, left: 0,
      background: '#08081a',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* ── Orbs ── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-8%', left: '-6%', width: 580, height: 580, borderRadius: '50%', background: 'radial-gradient(circle, rgba(41,51,113,.32) 0%, transparent 68%)', animation: 'orb-a 20s ease-in-out infinite', filter: 'blur(3px)' }} />
        <div style={{ position: 'absolute', bottom: '-12%', right: '-5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(31,42,99,.26) 0%, transparent 68%)', animation: 'orb-b 25s ease-in-out infinite', filter: 'blur(3px)' }} />
        <div style={{ position: 'absolute', top: '35%', left: '42%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,.1) 0%, transparent 70%)', animation: 'orb-c 16s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)', backgroundSize: '52px 52px' }} />
      </div>

      {/* ── Language toggle ── */}
      <div className="lang-pill">
        {(['nl', 'en'] as const).map((l) => (
          <button key={l} onClick={() => i18n.changeLanguage(l)} className={i18n.language === l ? 'active' : ''}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ══ LEFT BRANDING PANEL ══════════════════════════════════════════════ */}
      <div style={{
        flex: '0 0 52%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 64px', position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 56 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg,#293371,#1f2a63)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(41,51,113,.55)',
          }}>
            <svg viewBox="0 0 28 28" fill="none" style={{ width: 28, height: 28 }}>
              <rect x="3" y="3" width="10" height="10" rx="3" fill="white" fillOpacity=".9" />
              <rect x="15" y="3" width="10" height="10" rx="3" fill="white" fillOpacity=".5" />
              <rect x="3" y="15" width="10" height="10" rx="3" fill="white" fillOpacity=".5" />
              <rect x="15" y="15" width="10" height="10" rx="3" fill="white" fillOpacity=".9" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px', lineHeight: 1.1 }}>Josbin POS</div>
            <div style={{ fontSize: 11, color: 'rgba(143,154,201,.8)', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: 2 }}>
              {isNl ? 'Beheerportaal' : 'Management Portal'}
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.5px', marginBottom: 20 }}>
          <span style={{ color: '#f8fafc' }}>{isNl ? 'Volledig zicht.' : 'Full control.'}</span>
          <br />
          <span style={{ background: 'linear-gradient(90deg,#8f9ac9,#60a5fa,#8f9ac9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundSize: '200%' }}>
            {isNl ? 'Elke vestiging.' : 'Every location.'}
          </span>
        </h1>

        <p style={{ fontSize: 17, color: 'rgba(148,163,184,.85)', lineHeight: 1.75, marginBottom: 48, maxWidth: 440 }}>
          {isNl
            ? 'Het centrale zenuwstelsel van uw winkelnetwerk — BTW-conform, offline-bestendig en klaar voor Surinaamse regelgeving.'
            : 'The central nervous system of your store network — BTW-compliant, offline-resilient, and built for Surinamese compliance.'}
        </p>

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 52 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feat-row" style={{ animationDelay: `${i * 0.1}s` }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginTop: 1,
                background: 'rgba(41,51,113,.2)', border: '1px solid rgba(41,51,113,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8f9ac9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span style={{ fontSize: 14.5, color: 'rgba(203,213,225,.9)', lineHeight: 1.55 }}>
                {isNl ? f.nl : f.en}
              </span>
            </div>
          ))}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {STATS.map((s, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 14, padding: '14px 12px', textAlign: 'center',
              animation: `badge-pop .5s ease both`, animationDelay: `${i * 0.08 + 0.3}s`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#8f9ac9', letterSpacing: '-0.5px' }}>{s.n}</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,.6)', marginTop: 3, lineHeight: 1.3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Footer tag */}
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,.2)' }} />
          <span style={{ fontSize: 12, color: 'rgba(148,163,184,.5)' }}>
            {isNl ? 'Systeem operationeel · Paramaribo, Suriname · AST (UTC−3)' : 'System operational · Paramaribo, Suriname · AST (UTC−3)'}
          </span>
        </div>
      </div>

      {/* ══ RIGHT FORM PANEL ═════════════════════════════════════════════════ */}
      <div style={{
        flex: '0 0 48%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 36px', position: 'relative', zIndex: 1,
      }}>
        <div style={{
          width: '100%', maxWidth: 460,
          background: 'rgba(255,255,255,.045)',
          backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255,255,255,.09)',
          borderRadius: 28,
          padding: '52px 48px 48px',
          boxShadow: '0 36px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset',
          animation: 'fade-rise .45s ease both',
        }}>

          {/* Card header */}
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.8px', marginBottom: 10 }}>
              {isNl ? 'Inloggen' : 'Sign in'}
            </h2>
            <p style={{ fontSize: 15, color: 'rgba(148,163,184,.7)', lineHeight: 1.5 }}>
              {isNl ? 'Toegang uitsluitend voor bevoegd personeel.' : 'Access restricted to authorised personnel only.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 14, padding: '14px 18px', marginBottom: 28,
              display: 'flex', alignItems: 'flex-start', gap: 12,
              animation: 'fade-rise .2s ease',
            }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>!</span>
              </div>
              <span style={{ fontSize: 14, color: '#fca5a5', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'rgba(203,213,225,.85)', letterSpacing: '.2px', marginBottom: 10 }}>
                {isNl ? 'E-mailadres' : 'Email address'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,.5)', pointerEvents: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </span>
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required autoFocus autoComplete="email"
                  placeholder="admin@josbin-pos.sr"
                  className="login-input"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'rgba(203,213,225,.85)', letterSpacing: '.2px', marginBottom: 10 }}>
                {isNl ? 'Wachtwoord' : 'Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,.5)', pointerEvents: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  placeholder="••••••••••"
                  className="login-input"
                  disabled={isLoading}
                />
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: showPw ? '#8f9ac9' : 'rgba(148,163,184,.45)', transition: 'color .15s', display: 'flex' }}
                >
                  {showPw
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={isLoading || !email || !password} className="login-btn" style={{ marginTop: 8 }}>
              {isLoading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin-login .75s linear infinite', display: 'inline-block' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    {isNl ? 'Bezig met inloggen…' : 'Signing in…'}
                  </span>
                : (isNl ? 'Aanmelden' : 'Sign in')
              }
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '32px 0 24px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,.35)', letterSpacing: '.5px', textTransform: 'uppercase' }}>
              {isNl ? 'beveiligd systeem' : 'secured system'}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
          </div>

          {/* Security badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            {[
              { icon: '🔐', label: 'AES-256' },
              { icon: '🛡️', label: 'WBP-S' },
              { icon: '🏛️', label: 'BTW-conform' },
              { icon: '📋', label: 'Rekenkamer' },
            ].map((b) => (
              <div key={b.label} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 20, padding: '5px 11px',
              }}>
                <span style={{ fontSize: 11 }}>{b.icon}</span>
                <span style={{ fontSize: 10.5, color: 'rgba(148,163,184,.5)', fontWeight: 700 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Help links + version */}
        <div style={{ position: 'absolute', bottom: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href={`${(import.meta.env.VITE_DOCS_URL ?? 'http://142.93.88.143:8095').replace(/\/$/, '')}/dashboard_manual/`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, color: 'rgba(148,163,184,.7)', textDecoration: 'none', fontWeight: 600 }}>
              {isNl ? '📘 Handleiding' : '📘 Admin manual'}
            </a>
            <a href={`${(import.meta.env.VITE_DOCS_URL ?? 'http://142.93.88.143:8095').replace(/\/$/, '')}/flows.html`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, color: 'rgba(148,163,184,.7)', textDecoration: 'none', fontWeight: 600 }}>
              {isNl ? '🗺️ Hoe het werkt' : '🗺️ How it works'}
            </a>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,.25)', letterSpacing: '.3px' }}>
            Josbin POS v1.0 &nbsp;·&nbsp; © 2026
          </div>
        </div>
      </div>
    </div>
  )
}
