import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import ServerConfigModal from '@/components/shared/ServerConfigModal'
import { useAuthStore } from '@/store/authStore'
import ProcessBar from '@/components/shared/ProcessBar'
import JosbinMark from '@/components/shared/JosbinMark'

// ─── Keyframe & global styles injected once ──────────────────────────────────
const STYLES = `
  @keyframes orb-drift-1 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(40px,-60px) scale(1.08); }
    66%      { transform: translate(-30px,40px) scale(0.94); }
  }
  @keyframes orb-drift-2 {
    0%,100% { transform: translate(0,0) scale(1); }
    40%      { transform: translate(-50px,30px) scale(1.06); }
    70%      { transform: translate(35px,-45px) scale(0.96); }
  }
  @keyframes orb-drift-3 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(25px,55px) scale(1.04); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(18px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .jpos-login-input {
    width: 100%;
    height: 52px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    color: #f1f5f9;
    font-size: 15px;
    padding: 0 48px 0 46px;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
    font-family: inherit;
    box-sizing: border-box;
  }
  .jpos-login-input::placeholder { color: rgba(148,163,184,0.55); }
  .jpos-login-input:focus {
    border-color: #003366;
    background: rgba(0,51,102,0.08);
    box-shadow: 0 0 0 4px rgba(0,51,102,0.18);
  }
  .jpos-login-input:disabled { opacity: 0.45; cursor: not-allowed; }
  .jpos-submit-btn {
    width: 100%;
    height: 52px;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    font-family: inherit;
    color: #fff;
    background: linear-gradient(135deg, #ef6c00 0%, #d95f00 50%, #ef6c00 100%);
    background-size: 200% auto;
    box-shadow: 0 4px 24px rgba(239,108,0,0.42);
  }
  .jpos-submit-btn:not(:disabled):hover {
    animation: shimmer 1.4s linear infinite;
    box-shadow: 0 6px 32px rgba(239,108,0,0.58);
    transform: translateY(-1px);
  }
  .jpos-submit-btn:not(:disabled):active { transform: translateY(0); }
  .jpos-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
  .jpos-feature-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    animation: fade-up 0.5s ease both;
  }
  .jpos-lang-btn {
    position: absolute;
    top: 22px;
    right: 22px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 20px;
    color: rgba(248,250,252,0.75);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 6px 14px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
    z-index: 10;
  }
  .jpos-lang-btn:hover { background: rgba(0,51,102,0.3); color: #fff; }
`

// ─── Icons ─────────────────────────────────────────────────────────────────
function IconEmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" y1="2" x2="22" y2="22"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconSpinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.75s linear infinite', display: 'inline-block' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  )
}

// ─── Feature list shown on the branding panel ─────────────────────────────
const FEATURES = [
  // Accurate, not flattering: the till is a thin client that must reach its
  // STORE server. That server sits in the shop, so no internet is needed —
  // but "fully offline" would promise selling with no connection at all,
  // which this app cannot do and has never claimed in its architecture.
  { nl: 'Werkt zonder internet — winkelserver staat ter plaatse', en: 'Runs without internet — the store server is on site' },
  { nl: 'BTW-compliant voor Belastingdienst Suriname',              en: 'BTW-compliant for Belastingdienst Suriname' },
  { nl: 'Realtime multi-store dashboard & rapportage',             en: 'Real-time multi-store dashboard & reporting' },
]

// ─── Main component ────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { t, i18n } = useTranslation()
  const login      = useAuthStore((s) => s.login)
  const isLoading  = useAuthStore((s) => s.isLoading)
  const error      = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPw,      setShowPw]      = useState(false)
  const [focusField,  setFocusField]  = useState<'email'|'pw'|null>(null)
  const [showServer,  setShowServer]  = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const isNl     = i18n.language === 'nl'

  // Inject keyframes once
  useEffect(() => {
    const id = 'jpos-login-styles'
    if (!document.getElementById(id)) {
      const tag = document.createElement('style')
      tag.id = id
      tag.textContent = STYLES
      document.head.appendChild(tag)
    }
    emailRef.current?.focus()
    return () => { clearError() }
  }, [clearError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password || isLoading) return
    clearError()
    try { await login(email, password) } catch { /* error set inside */ }
  }

  function toggleLanguage() {
    const next = isNl ? 'en' : 'nl'
    i18n.changeLanguage(next)
    localStorage.setItem('josbin_pos_locale', next)
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      background: '#002739',
      position: 'fixed',
      top: 0,
      left: 0,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── Animated background orbs ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        {/* Orb 1 — large purple */}
        <div style={{
          position: 'absolute', top: '-10%', left: '-5%',
          width: 560, height: 560,
          background: 'radial-gradient(circle, rgba(0,51,102,0.35) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'orb-drift-1 18s ease-in-out infinite',
          filter: 'blur(2px)',
        }} />
        {/* Orb 2 — blue */}
        <div style={{
          position: 'absolute', bottom: '-15%', right: '-8%',
          width: 480, height: 480,
          background: 'radial-gradient(circle, rgba(31,42,99,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'orb-drift-2 22s ease-in-out infinite',
          filter: 'blur(2px)',
        }} />
        {/* Orb 3 — cyan accent */}
        <div style={{
          position: 'absolute', top: '40%', left: '45%',
          width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'orb-drift-3 14s ease-in-out infinite',
        }} />
        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }} />
      </div>

      {/* ── Language toggle ───────────────────────────────────────────── */}
      <button className="jpos-lang-btn" onClick={toggleLanguage}>
        {isNl ? 'EN' : 'NL'}
      </button>

      {/* ── Left branding panel ──────────────────────────────────────── */}
      <div style={{
        flex: '0 0 48%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 56px',
        position: 'relative',
        zIndex: 1,
        // hide on very small screens handled inline via flex basis
      }}>
        {/* Logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* The mark stands on its own — boxing a logo inside a tile shrinks
                it to the point where the wing's tail detail disappears, which
                is exactly what happened at 30px. */}
            <JosbinMark size={72} color="#EF6C00" title="Josbin" />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
              Josbin POS
            </div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.75)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>
              Enterprise · Suriname
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 40,
          fontWeight: 800,
          color: '#f8fafc',
          lineHeight: 1.15,
          letterSpacing: '-1px',
          marginBottom: 16,
        }}>
          {isNl ? 'Welkom terug.' : 'Welcome back.'}
          <br />
          <span style={{
            background: 'linear-gradient(90deg, #9DB3BF, #EF6C00)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {isNl ? 'Log in om door te gaan.' : 'Sign in to continue.'}
          </span>
        </h1>

        <p style={{
          fontSize: 15,
          color: 'rgba(148,163,184,0.8)',
          lineHeight: 1.7,
          marginBottom: 44,
          maxWidth: 380,
        }}>
          {isNl
            ? 'Het complete kassasysteem voor Surinaams retail. BTW-compliant, offline-first en gereed voor meerdere vestigingen.'
            : 'The complete POS platform for Surinamese retail. BTW-compliant, offline-first, and built for multi-store operations.'
          }
        </p>

        {/* Feature bullets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="jpos-feature-item"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <div style={{
                width: 28, height: 28,
                background: 'rgba(0,51,102,0.2)',
                border: '1px solid rgba(0,51,102,0.4)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9DB3BF',
                flexShrink: 0,
                marginTop: 1,
              }}>
                <IconCheck />
              </div>
              <span style={{ fontSize: 14, color: 'rgba(203,213,225,0.9)', lineHeight: 1.5 }}>
                {isNl ? f.nl : f.en}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom tag */}
        <div style={{
          marginTop: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 0 3px rgba(34,197,94,0.2)',
          }} />
          <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.3px' }}>
            {isNl ? 'Systeem operationeel · Paramaribo, Suriname · SRD' : 'System operational · Paramaribo, Suriname · SRD'}
          </span>
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 52%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Glassmorphism card */}
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24,
          padding: '48px 44px 44px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
          animation: 'fade-up 0.45s ease both',
        }}>

          {/* Card header */}
          <div style={{ marginBottom: 36 }}>
            <h2 style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#f8fafc',
              marginBottom: 8,
              letterSpacing: '-0.5px',
            }}>
              {isNl ? 'Inloggen' : 'Sign in'}
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.7)', lineHeight: 1.5 }}>
              {isNl
                ? 'Voer uw e-mail en wachtwoord in om toegang te krijgen'
                : 'Enter your email and password to access the system'
              }
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: 12,
              padding: '13px 16px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              animation: 'fade-up 0.2s ease',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                  <path d="M5 1v4M5 7.5v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {/* Process bar — the four inks Josbin's machines lay down. Signature
              only; it never carries state or becomes a control. */}
          <ProcessBar onDark height={4} />

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 22 }}>

            {/* Email field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(203,213,225,0.8)', letterSpacing: '0.2px' }}>
                {t('auth.email')}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)',
                  color: focusField === 'email' ? '#9DB3BF' : 'rgba(148,163,184,0.5)',
                  transition: 'color 0.2s',
                  pointerEvents: 'none',
                }}>
                  <IconEmail />
                </div>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusField('email')}
                  onBlur={() => setFocusField(null)}
                  disabled={isLoading}
                  autoComplete="email"
                  placeholder={isNl ? 'naam@winkel.sr' : 'name@store.sr'}
                  className="jpos-login-input"
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(203,213,225,0.8)', letterSpacing: '0.2px' }}>
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)',
                  color: focusField === 'pw' ? '#9DB3BF' : 'rgba(148,163,184,0.5)',
                  transition: 'color 0.2s',
                  pointerEvents: 'none',
                }}>
                  <IconLock />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField('pw')}
                  onBlur={() => setFocusField(null)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="jpos-login-input"
                />
                {/* Show/hide toggle */}
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: showPw ? '#9DB3BF' : 'rgba(148,163,184,0.45)',
                    transition: 'color 0.15s',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <IconEye off={showPw} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="jpos-submit-btn"
              style={{ marginTop: 6 }}
            >
              {isLoading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <IconSpinner />
                    {isNl ? 'Bezig met inloggen…' : 'Signing in…'}
                  </span>
                : (isNl ? 'Inloggen' : 'Sign in')
              }
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '28px 0 20px',
          }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {isNl ? 'beveiligd systeem' : 'secured system'}
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Security badges row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            {[
              { icon: '🔐', label: isNl ? 'AES-256 versleuteld' : 'AES-256 encrypted' },
              { icon: '🛡️', label: 'WBP-S' },
              { icon: '🏛️', label: isNl ? 'BTW-conform' : 'BTW compliant' },
            ].map((b) => (
              <div key={b.label} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                padding: '5px 10px',
              }}>
                <span style={{ fontSize: 11 }}>{b.icon}</span>
                <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* Below-card help links + version tag */}
        <div style={{
          position: 'absolute', bottom: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href={`${(import.meta.env.VITE_DOCS_URL ?? 'http://142.93.88.143:8095').replace(/\/$/, '')}/user_manual/`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, color: 'rgba(148,163,184,0.75)', textDecoration: 'none', fontWeight: 600 }}>
              {isNl ? '📘 Handleiding' : '📘 User manual'}
            </a>
            <a href={`${(import.meta.env.VITE_DOCS_URL ?? 'http://142.93.88.143:8095').replace(/\/$/, '')}/flows.html`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, color: 'rgba(148,163,184,0.75)', textDecoration: 'none', fontWeight: 600 }}>
              {isNl ? '🗺️ Hoe het werkt' : '🗺️ How it works'}
            </a>
            {/* Field-install escape hatch: point this till at the right store
                server without a rebuild. Deliberately reachable pre-login. */}
            <button
              onClick={() => setShowServer(true)}
              data-testid="btn-server-config"
              style={{
                fontSize: 11.5, color: 'rgba(148,163,184,0.75)', fontWeight: 600,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
              ⚙ Server
            </button>
            {/* Production runs fullscreen + frameless — without this there
                is NO way to exit the app on a till (installer upgrades
                block on the running process). Electron only. */}
            {Boolean((window as any).josbin_pos?.quit) && (
              <button
                onClick={() => (window as any).josbin_pos.quit()}
                data-testid="btn-exit-app"
                style={{
                  fontSize: 11.5, color: 'rgba(148,163,184,0.75)', fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                ⏻ {isNl ? 'Afsluiten' : 'Exit'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.3)', letterSpacing: '0.3px' }}>
            Josbin POS v1.0 &nbsp;·&nbsp; © 2026
          </div>
        </div>
      </div>

      <ServerConfigModal isOpen={showServer} onClose={() => setShowServer(false)} />
    </div>
  )
}
