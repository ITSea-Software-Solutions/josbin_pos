import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  getCustomer,
  getCustomerHistory,
  downloadCustomerStatement,
  type CustomerSale,
} from '@/api/customers'
import { formatSRD } from '@/utils/currency'
import EmptyState from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'

/**
 * Customer detail — the page you land on when you click a customer row on
 * the Customers screen. Mirrors the BtwSubmissionDetailScreen navigation
 * pattern (id prop + onBack, wired in DashboardLayout).
 *
 * Top to bottom:
 *   - header: back button, avatar, name, contact details
 *   - aggregates row: total spend / visits / last visit / customer since
 *   - statement card: from/to range (default last 90 days) + PDF / CSV
 *     download (authenticated blob download — no tokenless links)
 *   - purchase history table (paginated, refunds + voids flagged)
 *
 * Role gate: reachable only from the Customers screen, which the layout
 * already limits to SA / OA / SM; the backend enforces customers.view +
 * org scoping (cross-org = 404) regardless.
 */
interface Props {
  customerId: string
  onBack: () => void
}

/** YYYY-MM-DD in the browser's local calendar (avoids toISOString UTC roll-over). */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const PAYMENT_LABELS: Record<string, { nl: string; en: string }> = {
  cash:            { nl: 'Contant', en: 'Cash' },
  card:            { nl: 'Pin/Kaart', en: 'Card/PIN' },
  mixed:           { nl: 'Gemengd', en: 'Mixed' },
  bank_transfer:   { nl: 'Overschrijving', en: 'Bank transfer' },
  mobile_transfer: { nl: 'Mobiel bankieren', en: 'Mobile banking' },
  foreign_cash:    { nl: 'Vreemde valuta', en: 'Foreign cash' },
  qr_payment:      { nl: 'QR-wallet', en: 'QR wallet' },
}

export default function CustomerDetailScreen({ customerId, onBack }: Props) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const toast = useToast()

  const [page, setPage] = useState(1)

  // Statement range — default: last 90 days.
  const today = new Date()
  const [from, setFrom] = useState(() => localISO(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
  const [to, setTo] = useState(() => localISO(today))
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null)

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId),
  })

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['customer-history', customerId, page],
    queryFn: () => getCustomerHistory(customerId, { page, per_page: 15 }),
    placeholderData: (prev) => prev,
  })

  async function download(format: 'pdf' | 'csv') {
    if (from > to) {
      toast.error(isNl ? 'Van-datum moet vóór tot-datum liggen' : 'From date must be before to date')
      return
    }
    setDownloading(format)
    try {
      await downloadCustomerStatement(customerId, { from, to, format, locale: isNl ? 'nl' : 'en' })
    } catch {
      toast.error(isNl ? 'Download mislukt' : 'Download failed')
    } finally {
      setDownloading(null)
    }
  }

  if (loadingCustomer) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <div style={{ width: 24, height: 24, border: '2.5px solid #1f2a63', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!customer) return null

  const sales = history?.data ?? []
  const lastPage = history?.last_page ?? 1
  const total = history?.total ?? 0

  const fmtDate = (iso: string | null, withTime = false) =>
    iso
      ? new Date(iso).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', {
          day: 'numeric', month: 'short', year: 'numeric',
          ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        })
      : '—'

  const aggregates = [
    { label: isNl ? 'Totaal besteed' : 'Total spend', value: formatSRD(customer.total_spend_srd) },
    { label: isNl ? 'Bezoeken' : 'Visits', value: String(customer.visit_count) },
    { label: isNl ? 'Laatste bezoek' : 'Last visit', value: fmtDate(customer.last_visit_at) },
    { label: isNl ? 'Klant sinds' : 'Customer since', value: fmtDate(customer.created_at) },
  ]

  const statusBadge = (s: CustomerSale) => {
    if (s.is_refund) {
      return { label: isNl ? 'Retour' : 'Refund', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
    }
    if (s.status === 'voided') {
      return { label: isNl ? 'Geannuleerd' : 'Voided', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
    }
    return { label: isNl ? 'Voltooid' : 'Completed', bg: '#ecfdf5', color: '#15803d', border: '#bbf7d0' }
  }

  const inputStyle: React.CSSProperties = {
    height: 36, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      {/* Header */}
      <button
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 18 }}
      >
        ← {isNl ? 'Terug naar klanten' : 'Back to customers'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#293371,#1f2a63)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {customer.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', margin: 0 }}>
            {customer.name}
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '3px 0 0' }}>
            {customer.phone ?? '—'} &nbsp;·&nbsp; {customer.email ?? '—'}
          </p>
        </div>
      </div>

      {/* Aggregates row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        {aggregates.map((a, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6ecf5', padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{a.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#293371' }}>{a.value}</div>
          </div>
        ))}
      </div>

      {/* Statement export */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e6ecf5', padding: '16px 18px', marginBottom: 22, boxShadow: '0 2px 12px rgba(0,0,0,.04)', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>
            {isNl ? 'Van' : 'From'}
          </label>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 5 }}>
            {isNl ? 'Tot' : 'To'}
          </label>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} />
        </div>
        <button
          onClick={() => download('pdf')}
          disabled={downloading !== null}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#293371', color: '#fff', cursor: downloading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, opacity: downloading === 'csv' ? 0.6 : 1 }}
        >
          {downloading === 'pdf' ? '…' : (isNl ? 'Download overzicht (PDF)' : 'Download statement (PDF)')}
        </button>
        <button
          onClick={() => download('csv')}
          disabled={downloading !== null}
          style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #293371', background: '#fff', color: '#293371', cursor: downloading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, opacity: downloading === 'pdf' ? 0.6 : 1 }}
        >
          {downloading === 'csv' ? '…' : 'CSV'}
        </button>
        <span style={{ fontSize: 12, color: '#7e88a0', marginLeft: 'auto' }}>
          {isNl ? 'Standaard: laatste 90 dagen' : 'Default: last 90 days'}
        </span>
      </div>

      {/* Purchase history */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e9eef9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#16203a' }}>
            {isNl ? 'Aankoophistorie' : 'Purchase history'}
          </h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {isNl ? `${total} transacties` : `${total} transactions`}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
              {[
                isNl ? 'Datum' : 'Date',
                isNl ? 'Bonnummer' : 'Sale number',
                isNl ? 'Vestiging' : 'Store',
                isNl ? 'Betaalmethode' : 'Payment',
                isNl ? 'Korting' : 'Discount',
                'BTW',
                isNl ? 'Totaal' : 'Total',
                'Status',
              ].map((label, i) => (
                <th key={i} style={{ padding: '11px 16px', textAlign: i >= 4 && i <= 6 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadingHistory && !history ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f4fb' }}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} style={{ padding: '13px 16px' }}>
                      <div style={{ height: 13, borderRadius: 6, background: '#eef2fb', width: j === 0 ? 110 : 70 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sales.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 0 }}>
                <EmptyState
                  icon="🧾"
                  isNl={isNl}
                  title={{ nl: 'Nog geen aankopen', en: 'No purchases yet' }}
                  description={{
                    nl: 'Verkopen die aan deze klant zijn gekoppeld verschijnen hier.',
                    en: 'Sales linked to this customer will appear here.',
                  }}
                />
              </td></tr>
            ) : sales.map((s, i) => {
              const badge = statusBadge(s)
              return (
                <tr key={s.id} style={{ borderBottom: i < sales.length - 1 ? '1px solid #f1f4fb' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                    {fmtDate(s.occurred_at, true)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#16203a', whiteSpace: 'nowrap' }}>{s.sale_number}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{s.store_name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                    {PAYMENT_LABELS[s.payment_method]?.[isNl ? 'nl' : 'en'] ?? s.payment_method}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: 'right' }}>{formatSRD(s.discount_srd)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', textAlign: 'right' }}>{formatSRD(s.btw_srd)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, textAlign: 'right', color: s.is_refund ? '#dc2626' : '#293371' }}>
                    {formatSRD(s.total_srd)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {lastPage > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid #f1f4fb', background: '#fafafa' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1, fontSize: 13 }}>
              ‹
            </button>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{page} / {lastPage}</span>
            <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page === lastPage}
              style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: page === lastPage ? 'not-allowed' : 'pointer', opacity: page === lastPage ? 0.4 : 1, fontSize: 13 }}>
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
