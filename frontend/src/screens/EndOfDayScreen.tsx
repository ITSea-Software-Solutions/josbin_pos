import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDailyReport, closeZReport, getZReportHistory, submitZReport } from '@/api/reports'
import type { ZReportRecord } from '@/api/reports'
import apiClient from '@/api/client'
import Modal from '@/components/shared/Modal'
import { useDateFormatter } from '@/utils/date'

interface EndOfDayScreenProps {
  storeId: string
}

export default function EndOfDayScreen({ storeId }: EndOfDayScreenProps) {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const fmtDate = useDateFormatter()

  const [actualCash, setActualCash] = useState('')
  const [discrepancyNote, setDiscrepancyNote] = useState('')
  const [exportingDate, setExportingDate] = useState<string | null>(null)
  const [submitTarget, setSubmitTarget] = useState<ZReportRecord | null>(null)

  async function downloadSurapos(fromDate: string, toDate?: string) {
    const fd = fromDate
    const td = toDate ?? fromDate
    setExportingDate(fd)
    try {
      const res = await apiClient.get('/sync/export', {
        params: { store_id: storeId, from_date: fd, to_date: td },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `josbin_pos_${storeId}_${fd}_${td}.josbin_pos`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // TODO: show error toast
    } finally {
      setExportingDate(null)
    }
  }

  const { data: todaySummary, isFetching: fetchingToday, refetch: refetchToday } = useQuery({
    queryKey: ['today-summary', storeId],
    queryFn: () => getDailyReport(storeId),
  })

  const { data: history = [], isFetching: fetchingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['z-report-history', storeId],
    queryFn: () => getZReportHistory(storeId),
  })

  const isRefreshing = fetchingToday || fetchingHistory
  function handleRefresh() {
    refetchToday()
    refetchHistory()
  }

  const closeMutation = useMutation({
    mutationFn: () => closeZReport(storeId, actualCash, discrepancyNote || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['z-report-history', storeId] })
      qc.invalidateQueries({ queryKey: ['today-summary', storeId] })
    },
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitZReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['z-report-history', storeId] })
      setSubmitTarget(null)
    },
  })

  const expectedCash = parseFloat(todaySummary?.cash_total_srd ?? '0')
  const actual = parseFloat(actualCash) || 0
  const discrepancy = actual - expectedCash
  const hasDiscrepancy = Math.abs(discrepancy) > 0.01

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>
          {t('endOfDay.title')}
        </h2>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title={t('app.refresh')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 14px', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: 'var(--font-size-sm)', fontWeight: 600,
            opacity: isRefreshing ? 0.5 : 1,
          }}
        >
          <RefreshIcon spinning={isRefreshing} />
          {t('app.refresh')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, maxWidth: 900 }}>
        {/* Today summary */}
        {todaySummary && (
          <div style={cardSt}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 14 }}>
              {t('reports.daily')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('reports.summary.totalSales'), value: `SRD ${parseFloat(todaySummary.total_sales_srd).toFixed(2)}`, color: 'var(--color-total)' },
                { label: t('reports.summary.transactionCount'), value: String(todaySummary.transaction_count) },
                { label: t('reports.summary.totalBtw'), value: `SRD ${parseFloat(todaySummary.total_btw_srd).toFixed(2)}`, color: 'var(--color-btw)' },
                { label: t('reports.summary.cashTotal'), value: `SRD ${expectedCash.toFixed(2)}` },
                { label: t('reports.summary.cardTotal'), value: `SRD ${parseFloat(todaySummary.card_total_srd).toFixed(2)}` },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span className="currency-srd" style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: row.color ?? 'var(--text-primary)' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cash reconciliation */}
        <div style={cardSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 14 }}>
            {t('endOfDay.cashReconciliation')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                {t('endOfDay.expectedCash')}
              </label>
              <div className="currency-srd" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                SRD {expectedCash.toFixed(2)}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                {t('endOfDay.actualCash')}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                placeholder="0.00"
                style={inputSt}
              />
            </div>

            {actualCash && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 'var(--border-radius)',
                background: hasDiscrepancy ? 'rgba(224,82,82,0.08)' : 'rgba(0,212,170,0.08)',
                border: `1px solid ${hasDiscrepancy ? 'var(--color-error)' : 'var(--color-success)'}`,
              }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: hasDiscrepancy ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {t('endOfDay.discrepancy')}
                </span>
                <span className="currency-srd" style={{ fontWeight: 700, color: hasDiscrepancy ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {discrepancy >= 0 ? '+' : ''}SRD {discrepancy.toFixed(2)}
                </span>
              </div>
            )}

            {hasDiscrepancy && (
              <div>
                <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
                  {t('endOfDay.discrepancyNote')}
                </label>
                <textarea
                  value={discrepancyNote}
                  onChange={(e) => setDiscrepancyNote(e.target.value)}
                  rows={2}
                  style={{ ...inputSt, height: 'auto', padding: '10px 14px', resize: 'vertical' }}
                />
              </div>
            )}

            {closeMutation.isSuccess ? (
              <div style={{ padding: '10px 14px', background: 'rgba(0,212,170,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--border-radius)', fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', textAlign: 'center' }}>
                {t('endOfDay.submitSuccess')}
              </div>
            ) : (
              <button
                onClick={() => closeMutation.mutate()}
                disabled={
                  !actualCash ||
                  closeMutation.isPending ||
                  (hasDiscrepancy && !discrepancyNote.trim())
                }
                style={{
                  height: 'var(--touch-target)',
                  borderRadius: 'var(--border-radius)',
                  border: 'none', background: 'var(--color-primary)', color: '#fff',
                  cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-base)',
                  opacity: (!actualCash || closeMutation.isPending || (hasDiscrepancy && !discrepancyNote.trim())) ? 0.5 : 1,
                }}
              >
                {closeMutation.isPending ? t('app.loading') : t('endOfDay.printZReport')}
              </button>
            )}
            {closeMutation.isError && (() => {
              const err = closeMutation.error as { response?: { status?: number; data?: { message?: string } } }
              const status = err?.response?.status
              const apiMsg = err?.response?.data?.message
              const msg = status === 403
                ? (i18n.language === 'nl'
                    ? 'Alleen een beheerder kan de Z-Rapport voor de dag sluiten. U kunt wel uw eigen kassa sluiten via "Kassa sluiten" rechtsboven.'
                    : 'Only a manager can close the daily Z-Report. You can close your own register via "Close register" in the top-right.')
                : (apiMsg || t('errors.serverError'))
              return (
                <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center', lineHeight: 1.5 }}>
                  {msg}
                </div>
              )
            })()}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ ...cardSt, gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 14 }}>
              {t('endOfDay.history')}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {[t('reports.columns.date'), t('reports.summary.totalSales'), t('reports.summary.totalBtw'), 'Status'].map((h) => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((z: ZReportRecord) => (
                  <tr key={z.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>{fmtDate(z.report_date)}</td>
                    <td className="currency-srd" style={{ padding: '8px 12px' }}>SRD {parseFloat(z.total_sales_srd).toFixed(2)}</td>
                    <td className="currency-srd" style={{ padding: '8px 12px', color: 'var(--color-btw)' }}>SRD {parseFloat(z.total_btw_srd).toFixed(2)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <SyncBadge status={z.sync_status} />
                      {z.sync_status === 'sent' && z.synced_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {fmtDate(z.synced_at)}{' '}
                          {new Date(z.synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {z.sync_status !== 'sent' && (
                          <button
                            onClick={() => setSubmitTarget(z)}
                            title={t('endOfDay.submitHq')}
                            style={{
                              padding: '3px 10px', borderRadius: 5, border: 'none',
                              background: 'var(--color-primary)', cursor: 'pointer',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                            }}
                          >
                            {t('endOfDay.submitHq')}
                          </button>
                        )}
                        <button
                          onClick={() => downloadSurapos(z.report_date)}
                          disabled={exportingDate === z.report_date}
                          title={t('endOfDay.exportSurapos')}
                          style={{
                            padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-color)',
                            background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {exportingDate === z.report_date ? '…' : '💾 .josbin_pos'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Submit to Headquarters — confirmation modal (shows exactly what will be sent) */}
      <Modal
        isOpen={submitTarget !== null}
        onClose={() => !submitMutation.isPending && setSubmitTarget(null)}
        title={t('endOfDay.submitHq')}
        width={420}
      >
        {submitTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              {t('endOfDay.confirmSubmit')}
            </p>
            <div style={{ ...cardSt, padding: '12px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: t('reports.columns.date'), value: fmtDate(submitTarget.report_date) },
                  { label: t('reports.summary.totalSales'), value: `SRD ${parseFloat(submitTarget.total_sales_srd).toFixed(2)}` },
                  { label: t('reports.summary.totalBtw'), value: `SRD ${parseFloat(submitTarget.total_btw_srd).toFixed(2)}` },
                  { label: t('reports.summary.transactionCount'), value: String(submitTarget.transaction_count) },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{row.label}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {submitMutation.isError && (
              <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                {t('errors.serverError')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSubmitTarget(null)}
                disabled={submitMutation.isPending}
                style={{
                  height: 40, padding: '0 16px', borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {t('app.cancel')}
              </button>
              <button
                onClick={() => submitMutation.mutate(submitTarget.id)}
                disabled={submitMutation.isPending}
                style={{
                  height: 40, padding: '0 18px', borderRadius: 'var(--border-radius)',
                  border: 'none', background: 'var(--color-primary)', color: '#fff',
                  cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)',
                  opacity: submitMutation.isPending ? 0.5 : 1,
                }}
              >
                {submitMutation.isPending ? t('app.loading') : t('endOfDay.submitHq')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, animation: spinning ? 'spin-eod 0.8s linear infinite' : 'none' }}
    >
      <style>{`@keyframes spin-eod { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function SyncBadge({ status }: { status: ZReportRecord['sync_status'] }) {
  const { t } = useTranslation()
  const styles: Record<string, { bg: string; color: string }> = {
    sent: { bg: 'rgba(0,212,170,0.1)', color: 'var(--color-success)' },
    pending: { bg: 'rgba(245,166,35,0.1)', color: 'var(--color-warning)' },
    failed: { bg: 'rgba(224,82,82,0.1)', color: 'var(--color-error)' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      {t(`endOfDay.syncStatus.${status}`)}
    </span>
  )
}
