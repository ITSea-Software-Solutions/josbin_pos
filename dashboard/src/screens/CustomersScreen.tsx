import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getCustomers, updateCustomer, redactCustomer, type Customer } from '@/api/customers'
import { useTableSort } from '@/lib/useTableSort'
import { useDashboardAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'

function EditModal({ customer, isNl, onClose }: { customer: Customer; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: customer.name, phone: customer.phone ?? '', email: customer.email ?? '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => updateCustomer(customer.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,.2)' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#16203a' }}>
          {isNl ? 'Klant bewerken' : 'Edit customer'}
        </h3>
        {[
          { key: 'name',  label: isNl ? 'Naam' : 'Name',  type: 'text' },
          { key: 'phone', label: isNl ? 'Telefoon' : 'Phone', type: 'tel' },
          { key: 'email', label: 'Email', type: 'email' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>{f.label}</label>
            <input
              type={f.type}
              value={(form as Record<string, string>)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              style={{ width: '100%', boxSizing: 'border-box', height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }}
            />
          </div>
        ))}
        {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#293371', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            {mut.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CustomersScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const toast = useToast()
  // WBP-S erasure is OA + SA only (mirrors CustomerPolicy::delete server-side).
  const canRedact = ['organisation_admin', 'super_admin'].includes(
    useDashboardAuthStore((s) => s.user?.role) ?? '',
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [redactTarget, setRedactTarget] = useState<Customer | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => getCustomers({ search: search || undefined, per_page: 30, page }),
    placeholderData: (prev) => prev,
  })

  const redactMut = useMutation({
    mutationFn: (id: string) => redactCustomer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      setRedactTarget(null)
      toast.success(isNl ? 'Persoonsgegevens gewist' : 'Personal data erased')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Wissen mislukt: ${msg}` : `Erasure failed: ${msg}`)
    },
  })

  const customers = data?.data ?? []
  const lastPage = data?.last_page ?? 1
  const total = data?.total ?? 0

  // Client-side column sort (shared hook → identical behaviour across all
  // dashboard tables). Sorts the current page of results.
  const { sorted, sort, toggle, indicator } = useTableSort(customers, {
    name:   (c) => (c.name ?? '').toLowerCase(),
    phone:  (c) => (c.phone ?? '').toLowerCase(),
    email:  (c) => (c.email ?? '').toLowerCase(),
    spend:  (c) => parseFloat(c.total_spend_srd) || 0,
    visits: (c) => Number(c.visit_count) || 0,
    since:  (c) => (c.created_at ? new Date(c.created_at).getTime() : null),
  })

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
          {isNl ? 'Klantenbeheer' : 'Customer Management'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          {isNl ? `${total} klanten gevonden` : `${total} customers found`}
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={isNl ? 'Zoeken op naam, telefoon of e-mail…' : 'Search by name, phone or email…'}
          style={{ width: '100%', maxWidth: 420, height: 40, padding: '0 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
              {[
                { key: 'name',   label: isNl ? 'Naam' : 'Name' },
                { key: 'phone',  label: isNl ? 'Telefoon' : 'Phone' },
                { key: 'email',  label: 'Email' },
                { key: 'spend',  label: isNl ? 'Totaal besteed' : 'Total spend' },
                { key: 'visits', label: isNl ? 'Bezoeken' : 'Visits' },
                { key: 'since',  label: isNl ? 'Klant sinds' : 'Customer since' },
                { key: '',       label: '' },
              ].map((h, i) => (
                <th key={i}
                  onClick={h.key ? () => toggle(h.key) : undefined}
                  style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                  {h.label}
                  {h.key && <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{indicator(h.key)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f4fb' }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 13, borderRadius: 6, background: '#eef2fb', width: j === 0 ? 120 : j === 3 ? 80 : 90 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 0 }}>
                <EmptyState
                  icon="👤"
                  isNl={isNl}
                  title={{ nl: 'Geen klanten gevonden', en: 'No customers found' }}
                  description={
                    search
                      ? { nl: 'Pas uw zoekopdracht aan.', en: 'Try adjusting your search.' }
                      : { nl: 'Klanten worden aangemaakt vanaf de kassa tijdens een verkoop.', en: 'Customers are added from the POS during a sale.' }
                  }
                />
              </td></tr>
            ) : sorted.map((c, i) => (
              <tr key={c.id}
                style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f1f4fb' : 'none', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#293371,#1f2a63)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#16203a' }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{c.phone ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{c.email ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: '#293371' }}>
                  SRD {parseFloat(c.total_spend_srd).toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                    {c.visit_count}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#7e88a0' }}>
                  {new Date(c.created_at).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setEditCustomer(c)}
                      style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#374151' }}
                    >
                      {isNl ? 'Bewerken' : 'Edit'}
                    </button>
                    {canRedact && (
                      <button
                        onClick={() => setRedactTarget(c)}
                        title={isNl ? 'Persoonsgegevens wissen (WBP-S)' : 'Erase personal data (WBP-S)'}
                        style={{ height: 30, padding: '0 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', fontSize: 12, cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}
                      >
                        {isNl ? 'Wissen' : 'Erase'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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

      {editCustomer && <EditModal customer={editCustomer} isNl={isNl} onClose={() => setEditCustomer(null)} />}

      {/* WBP-S erasure confirm — irreversible, so spell out the consequence. */}
      <ConfirmDialog
        isOpen={redactTarget !== null}
        loading={redactMut.isPending}
        tone="danger"
        title={isNl ? 'Persoonsgegevens wissen?' : 'Erase personal data?'}
        message={
          isNl
            ? `Naam, telefoon, e-mail en ID van ${redactTarget?.name ?? 'deze klant'} worden permanent gewist (WBP-S recht op vergetelheid). De verkoophistorie en totalen blijven bewaard. Dit kan niet ongedaan worden gemaakt.`
            : `Name, phone, email and ID for ${redactTarget?.name ?? 'this customer'} will be permanently erased (WBP-S right to erasure). Sales history and totals are kept. This cannot be undone.`
        }
        confirmLabel={isNl ? 'Definitief wissen' : 'Erase permanently'}
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setRedactTarget(null)}
        onConfirm={() => redactTarget && redactMut.mutate(redactTarget.id)}
      />
    </div>
  )
}
