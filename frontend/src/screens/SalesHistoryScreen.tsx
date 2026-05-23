import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getSales, voidSale, getReceiptPdfUrl } from '@/api/sales'
import type { Sale } from '@/types/models'

function VoidModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => voidSale(sale.id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-history'] })
      onClose()
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (isNl ? 'Fout opgetreden' : 'An error occurred'))
    },
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 16px 48px rgba(0,0,0,.25)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          {isNl ? 'Bon annuleren' : 'Void sale'}
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
          {isNl ? `Bon #${sale.sale_number} — SRD ${parseFloat(sale.total_srd).toFixed(2)}` : `Receipt #${sale.sale_number} — SRD ${parseFloat(sale.total_srd).toFixed(2)}`}
        </p>

        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {isNl ? 'Reden (verplicht)' : 'Reason (required)'}
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder={isNl ? 'Waarom wordt deze bon geannuleerd?' : 'Why is this sale being voided?'}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border-color)', fontSize: 13, resize: 'none',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          }}
        />

        {error && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, height: 40, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
          >
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={reason.trim().length < 5 || mutation.isPending}
            style={{
              flex: 1, height: 40, background: '#dc2626', border: 'none', borderRadius: 8,
              color: '#fff', cursor: reason.trim().length < 5 ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, opacity: reason.trim().length < 5 ? 0.5 : 1,
            }}
          >
            {mutation.isPending ? '…' : (isNl ? 'Bon annuleren' : 'Void sale')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props { storeId: string }

export default function SalesHistoryScreen({ storeId }: Props) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10))
  const [page, setPage] = useState(1)
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-history', storeId, dateFilter, search, page],
    queryFn: () => getSales({ store_id: storeId, date: dateFilter, search: search || undefined, per_page: 25, page }),
    placeholderData: (prev) => prev,
  })

  const sales = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const total = data?.total ?? 0

  function statusColor(s: string) {
    if (s === 'completed') return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }
    if (s === 'voided')    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    return { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' }
  }

  function statusLabel(s: string) {
    if (s === 'completed') return isNl ? 'Voltooid' : 'Completed'
    if (s === 'voided')    return isNl ? 'Geannuleerd' : 'Voided'
    if (s === 'held')      return isNl ? 'In wacht' : 'Held'
    return s
  }

  function methodLabel(m: string) {
    if (m === 'cash')  return isNl ? 'Contant' : 'Cash'
    if (m === 'card')  return isNl ? 'Pin/Kaart' : 'Card'
    if (m === 'mixed') return isNl ? 'Gemengd' : 'Mixed'
    return m
  }

  return (
    <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {isNl ? 'Transactiehistorie' : 'Transaction History'}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {isNl ? `${total} transacties gevonden` : `${total} transactions found`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={dateFilter}
          onChange={e => { setDateFilter(e.target.value); setPage(1) }}
          style={{ height: 36, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13 }}
        />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={isNl ? 'Zoek op bonnummer of klant…' : 'Search by receipt # or customer…'}
          style={{ flex: 1, minWidth: 200, height: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
                {[
                  isNl ? 'Bonnr.' : 'Receipt #',
                  isNl ? 'Tijd' : 'Time',
                  isNl ? 'Klant' : 'Customer',
                  isNl ? 'Betaalwijze' : 'Payment',
                  isNl ? 'Totaal' : 'Total',
                  isNl ? 'BTW' : 'VAT',
                  isNl ? 'Status' : 'Status',
                  '',
                ].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {isNl ? 'Laden…' : 'Loading…'}
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {isNl ? 'Geen transacties gevonden.' : 'No transactions found.'}
                </td></tr>
              ) : sales.map((sale) => {
                const sc = statusColor(sale.status)
                return (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                      #{sale.sale_number}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(sale.occurred_at).toLocaleTimeString(isNl ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>
                      {(sale as unknown as { customer?: { name?: string } }).customer?.name ?? (isNl ? 'Loopklant' : 'Walk-in')}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                      {methodLabel(sale.payment_method)}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      <span className="currency-srd">SRD {parseFloat(sale.total_srd).toFixed(2)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                      SRD {parseFloat(sale.btw_srd).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                        {statusLabel(sale.status)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Reprint PDF */}
                        <a
                          href={getReceiptPdfUrl(sale.id, i18n.language)}
                          target="_blank"
                          rel="noreferrer"
                          title={isNl ? 'Bon afdrukken' : 'Print receipt'}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14 }}
                        >
                          🖨
                        </a>
                        {/* Void — only for completed sales */}
                        {sale.status === 'completed' && (
                          <button
                            onClick={() => setVoidTarget(sale)}
                            title={isNl ? 'Annuleren' : 'Void'}
                            style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(220,38,38,.3)', background: 'rgba(220,38,38,.05)', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}
            >
              ‹
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {page} / {lastPage}
            </span>
            <button
              onClick={() => setPage(p => Math.min(lastPage, p + 1))}
              disabled={page === lastPage}
              style={{ height: 32, padding: '0 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', cursor: page === lastPage ? 'not-allowed' : 'pointer', opacity: page === lastPage ? 0.4 : 1, fontSize: 13 }}
            >
              ›
            </button>
          </div>
        )}
      </div>

      {voidTarget && (
        <VoidModal sale={voidTarget} onClose={() => setVoidTarget(null)} />
      )}
    </div>
  )
}
