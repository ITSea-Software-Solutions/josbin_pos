import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRates, overrideRate, fetchLiveRate } from '@/api/rates'
import { useAuthStore } from '@/store/authStore'
import { useDateFormatter } from '@/utils/date'

export default function ExchangeRateScreen() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const fmtDate = useDateFormatter()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canFetch = hasPermission('rates.lock')
  const canOverride = hasPermission('rates.override')

  const [manualRate, setManualRate] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [srdAmount, setSrdAmount] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rates'],
    queryFn: getRates,
  })

  const fetchMutation = useMutation({
    mutationFn: fetchLiveRate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rates'] }),
  })

  const overrideMutation = useMutation({
    mutationFn: () => overrideRate(manualRate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rates'] })
      setManualRate('')
    },
  })

  const currentRate = data?.today ? parseFloat(data.today.usd_to_srd) : null

  function convertUsdToSrd(usd: string) {
    setUsdAmount(usd)
    if (currentRate && usd) setSrdAmount((parseFloat(usd) * currentRate).toFixed(2))
    else setSrdAmount('')
  }

  function convertSrdToUsd(srd: string) {
    setSrdAmount(srd)
    if (currentRate && srd) setUsdAmount((parseFloat(srd) / currentRate).toFixed(2))
    else setUsdAmount('')
  }

  const cardSt: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', padding: '16px 20px',
  }

  const inputSt: React.CSSProperties = {
    height: 44, background: 'var(--bg-input)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-base)', padding: '0 14px', outline: 'none', width: '100%',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>
            {t('exchangeRate.title')}
          </h2>
          {/* Online / offline indicator */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 20,
            fontSize: 12, fontWeight: 600,
            background: isOnline ? 'rgba(0,212,170,0.12)' : 'rgba(224,82,82,0.12)',
            color: isOnline ? 'var(--color-success)' : 'var(--color-error)',
            border: `1px solid ${isOnline ? 'var(--color-success)' : 'var(--color-error)'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isOnline ? 'var(--color-success)' : 'var(--color-error)',
              display: 'inline-block',
            }} />
            {isOnline ? t('app.online') : t('app.offline')}
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('app.refresh')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: 'var(--font-size-sm)', fontWeight: 600,
            opacity: isFetching ? 0.5 : 1,
          }}
        >
          <RefreshIcon spinning={isFetching} />
          {t('app.refresh')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, maxWidth: 900 }}>
        {/* Current rate card */}
        <div style={{ ...cardSt, gridColumn: '1 / -1' }}>
          {isLoading ? (
            <div style={{ color: 'var(--text-secondary)' }}>{t('app.loading')}</div>
          ) : data?.today ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {t('exchangeRate.currentRate')} — {fmtDate(data.today.date)}
                </div>
                <div className="currency-srd" style={{ fontSize: 40, fontWeight: 800, color: 'var(--color-accent)' }}>
                  1 USD = SRD {parseFloat(data.today.usd_to_srd).toFixed(4)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <SourceBadge source={data.today.source} lockedAt={data.today.locked_at} t={t} />
                </div>
              </div>
              {canFetch && (
                <button
                  onClick={() => fetchMutation.mutate()}
                  disabled={fetchMutation.isPending || !isOnline}
                  title={!isOnline ? t('app.offline') : undefined}
                  style={{
                    height: 40, padding: '0 16px', borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--color-primary)', background: 'transparent',
                    color: 'var(--color-primary)', cursor: isOnline ? 'pointer' : 'not-allowed',
                    fontWeight: 600, fontSize: 'var(--font-size-sm)',
                    opacity: fetchMutation.isPending || !isOnline ? 0.5 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  🌐 {fetchMutation.isPending ? '…' : t('exchangeRate.getLiveRate')}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {t('exchangeRate.noRate')}
              </span>
              {canFetch && (
                <button
                  onClick={() => fetchMutation.mutate()}
                  disabled={fetchMutation.isPending || !isOnline}
                  title={!isOnline ? t('app.offline') : undefined}
                  style={{
                    height: 40, padding: '0 16px', borderRadius: 'var(--border-radius)',
                    border: 'none', background: 'var(--color-primary)',
                    color: '#fff', cursor: isOnline ? 'pointer' : 'not-allowed',
                    fontWeight: 700, opacity: !isOnline ? 0.5 : 1,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  🌐 {t('exchangeRate.getLiveRate')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Manual override — managers/admins only */}
        {canOverride && (
          <div style={cardSt}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 4 }}>
              ✏️ {t('exchangeRate.manualOverride')}
            </h3>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 14, marginTop: 0 }}>
              {t('exchangeRate.manualOverrideHint')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                placeholder="b.v. 36.5000"
                style={{ ...inputSt, flex: 1 }}
              />
              <button
                onClick={() => overrideMutation.mutate()}
                disabled={!manualRate || overrideMutation.isPending}
                style={{
                  height: 44, padding: '0 16px', borderRadius: 'var(--border-radius)',
                  border: 'none', background: 'var(--color-primary)', color: '#fff',
                  cursor: 'pointer', fontWeight: 700, flexShrink: 0,
                  opacity: !manualRate || overrideMutation.isPending ? 0.5 : 1,
                }}
              >
                {overrideMutation.isPending ? '…' : t('app.save')}
              </button>
            </div>
            {overrideMutation.isSuccess && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
                ✓ {t('exchangeRate.overrideSuccess')}
              </div>
            )}
            {overrideMutation.isError && (
              <div style={{ marginTop: 8, fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                {t('errors.serverError')}
              </div>
            )}
          </div>
        )}

        {/* Quick converter */}
        <div style={cardSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 14 }}>
            {t('exchangeRate.converter')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: 36, flexShrink: 0 }}>USD</label>
              <input type="number" value={usdAmount} onChange={(e) => convertUsdToSrd(e.target.value)}
                placeholder="0.00" style={inputSt} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: 36, flexShrink: 0 }}>SRD</label>
              <input type="number" value={srdAmount} onChange={(e) => convertSrdToUsd(e.target.value)}
                placeholder="0.00" style={inputSt} />
            </div>
          </div>
        </div>

        {/* History */}
        {data?.history && data.history.length > 0 && (
          <div style={{ ...cardSt, gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 14 }}>
              {t('exchangeRate.history')}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {[t('reports.columns.date'), '1 USD = SRD', t('exchangeRate.source'), t('exchangeRate.lockedAt')].map((h) => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.slice(0, 14).map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{fmtDate(r.date)}</td>
                    <td className="currency-srd" style={{ padding: '8px 12px', fontWeight: 600 }}>
                      {parseFloat(r.usd_to_srd).toFixed(4)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <SourceBadge source={r.source} t={t} />
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>
                      {r.locked_at ? new Date(r.locked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/** Coloured badge: green pill for API/auto, amber pill for manual entry */
function SourceBadge({ source, lockedAt, t }: { source: string; lockedAt?: string | null; t: (k: string) => string }) {
  const isManual = source === 'manual'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600,
      background: isManual ? 'rgba(245,166,35,0.12)' : 'rgba(0,212,170,0.12)',
      color: isManual ? 'var(--color-warning)' : 'var(--color-success)',
      border: `1px solid ${isManual ? 'rgba(245,166,35,0.4)' : 'rgba(0,212,170,0.4)'}`,
    }}>
      {isManual ? '✏️' : '🌐'}
      {isManual ? t('exchangeRate.status.manual') : t('exchangeRate.status.locked')}
      {!isManual && lockedAt && ` · ${new Date(lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
    </span>
  )
}

/** Animated refresh icon */
function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, animation: spinning ? 'spin 0.8s linear infinite' : 'none' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
