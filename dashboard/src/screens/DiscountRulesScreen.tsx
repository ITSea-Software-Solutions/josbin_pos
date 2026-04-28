import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import apiClient from '@/api/client'

interface DiscountRule {
  id: string
  name: string
  applies_to: 'all' | 'category' | 'product'
  applies_to_id: string | null
  type: 'percentage' | 'fixed'
  value: number
  min_qty: number | null
  max_discount_srd: number | null
  stackable: boolean
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
}

const EMPTY_RULE: Omit<DiscountRule, 'id'> = {
  name: '', applies_to: 'all', applies_to_id: null,
  type: 'percentage', value: 0, min_qty: null, max_discount_srd: null,
  stackable: false, is_active: true, valid_from: null, valid_to: null,
}

function RuleModal({ rule, isNl, onClose }: { rule: DiscountRule | null; isNl: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Omit<DiscountRule, 'id'>>(rule ? { ...rule } : { ...EMPTY_RULE })
  const [error, setError] = useState('')

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const mut = useMutation({
    mutationFn: () => rule
      ? apiClient.put(`/discount-rules/${rule.id}`, form).then(r => r.data)
      : apiClient.post('/discount-rules', form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['discount-rules'] }); onClose() },
    onError: (e: unknown) => setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'),
  })

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
  const inputStyle = { width: '100%', boxSizing: 'border-box' as const, height: 38, padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13 }
  const selectStyle = { ...inputStyle }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,.2)', margin: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#1c1c2e' }}>
          {rule ? (isNl ? 'Regel bewerken' : 'Edit rule') : (isNl ? 'Nieuwe kortingsregel' : 'New discount rule')}
        </h3>

        <F label={isNl ? 'Naam' : 'Name'}>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder={isNl ? 'Bijv. Zomerkorting 10%' : 'e.g. Summer sale 10%'} />
        </F>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <F label={isNl ? 'Type korting' : 'Discount type'}>
            <select style={selectStyle} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="percentage">{isNl ? 'Percentage (%)' : 'Percentage (%)'}</option>
              <option value="fixed">{isNl ? 'Vast bedrag (SRD)' : 'Fixed amount (SRD)'}</option>
            </select>
          </F>
          <F label={isNl ? 'Waarde' : 'Value'}>
            <input type="number" min="0" step="0.01" style={inputStyle} value={form.value || ''} onChange={e => set('value', parseFloat(e.target.value) || 0)}
              placeholder={form.type === 'percentage' ? '10' : '5.00'} />
          </F>
        </div>

        <F label={isNl ? 'Van toepassing op' : 'Applies to'}>
          <select style={selectStyle} value={form.applies_to} onChange={e => set('applies_to', e.target.value)}>
            <option value="all">{isNl ? 'Alle producten' : 'All products'}</option>
            <option value="category">{isNl ? 'Categorie' : 'Category'}</option>
            <option value="product">{isNl ? 'Specifiek product' : 'Specific product'}</option>
          </select>
        </F>

        {form.applies_to !== 'all' && (
          <F label={isNl ? 'ID van categorie/product' : 'Category/product ID'}>
            <input style={inputStyle} value={form.applies_to_id ?? ''} onChange={e => set('applies_to_id', e.target.value || null)}
              placeholder="UUID" />
          </F>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <F label={isNl ? 'Min. aantal' : 'Min. quantity'}>
            <input type="number" min="0" style={inputStyle} value={form.min_qty ?? ''} onChange={e => set('min_qty', e.target.value ? parseFloat(e.target.value) : null)} placeholder="1" />
          </F>
          <F label={isNl ? 'Max. korting (SRD)' : 'Max. discount (SRD)'}>
            <input type="number" min="0" step="0.01" style={inputStyle} value={form.max_discount_srd ?? ''} onChange={e => set('max_discount_srd', e.target.value ? parseFloat(e.target.value) : null)} placeholder={isNl ? 'Geen limiet' : 'No limit'} />
          </F>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <F label={isNl ? 'Geldig vanaf' : 'Valid from'}>
            <input type="date" style={inputStyle} value={form.valid_from?.split('T')[0] ?? ''} onChange={e => set('valid_from', e.target.value || null)} />
          </F>
          <F label={isNl ? 'Geldig tot' : 'Valid to'}>
            <input type="date" style={inputStyle} value={form.valid_to?.split('T')[0] ?? ''} onChange={e => set('valid_to', e.target.value || null)} />
          </F>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, marginTop: 4 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.stackable} onChange={e => set('stackable', e.target.checked)} />
            {isNl ? 'Stapelbaar met andere kortingen' : 'Stackable with other discounts'}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            {isNl ? 'Actief' : 'Active'}
          </label>
        </div>

        {error && <p style={{ margin: '0 0 12px', fontSize: 12, color: '#dc2626' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={() => mut.mutate()} disabled={!form.name || mut.isPending}
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !form.name ? 0.5 : 1 }}>
            {mut.isPending ? '…' : (isNl ? 'Opslaan' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DiscountRulesScreen() {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()
  const [editRule, setEditRule] = useState<DiscountRule | 'new' | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['discount-rules'],
    queryFn: () => apiClient.get('/discount-rules').then(r => r.data.data as DiscountRule[]),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.put(`/discount-rules/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-rules'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/discount-rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discount-rules'] }),
  })

  function appliesToLabel(r: DiscountRule) {
    if (r.applies_to === 'all') return isNl ? 'Alle producten' : 'All products'
    if (r.applies_to === 'category') return isNl ? 'Categorie' : 'Category'
    return isNl ? 'Product' : 'Product'
  }

  function typeLabel(r: DiscountRule) {
    return r.type === 'percentage' ? `${r.value}%` : `SRD ${r.value.toFixed(2)}`
  }

  function validLabel(r: DiscountRule) {
    if (!r.valid_from && !r.valid_to) return isNl ? 'Altijd geldig' : 'Always valid'
    const from = r.valid_from ? new Date(r.valid_from).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short' }) : '…'
    const to   = r.valid_to   ? new Date(r.valid_to).toLocaleDateString(isNl ? 'nl-NL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'
    return `${from} – ${to}`
  }

  const active = rules.filter(r => r.is_active)
  const inactive = rules.filter(r => !r.is_active)

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1c1c2e', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Kortingsregels' : 'Discount Rules'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl ? `${active.length} actieve regels` : `${active.length} active rules`}
          </p>
        </div>
        <button onClick={() => setEditRule('new')}
          style={{ height: 42, padding: '0 20px', borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {isNl ? '+ Nieuwe regel' : '+ New rule'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef' }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🎁</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>{isNl ? 'Nog geen kortingsregels' : 'No discount rules yet'}</p>
          <p style={{ fontSize: 13, color: '#9090a0' }}>{isNl ? 'Voeg een regel toe voor promoties of bulkkortingen.' : 'Add a rule for promotions or bulk discounts.'}</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e9e9ef', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f8f7ff,#f5f5fb)', borderBottom: '1px solid #eeeef8' }}>
                {[isNl ? 'Naam' : 'Name', isNl ? 'Korting' : 'Discount', isNl ? 'Van toepassing op' : 'Applies to', isNl ? 'Min. aantal' : 'Min. qty', isNl ? 'Geldigheid' : 'Validity', 'Status', ''].map((h, i) => (
                  <th key={i} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6d6d80', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...active, ...inactive].map((r, i) => (
                <tr key={r.id}
                  style={{ borderBottom: i < rules.length - 1 ? '1px solid #f3f3f8' : 'none', opacity: r.is_active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,58,237,.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1c1c2e' }}>{r.name}</p>
                    {r.stackable && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7c3aed' }}>{isNl ? 'Stapelbaar' : 'Stackable'}</p>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#7c3aed' }}>{typeLabel(r)}</span>
                    {r.max_discount_srd && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9090a0' }}>max SRD {r.max_discount_srd.toFixed(2)}</p>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{appliesToLabel(r)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{r.min_qty ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{validLabel(r)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleMut.mutate({ id: r.id, is_active: !r.is_active })}
                      style={{
                        height: 26, padding: '0 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: r.is_active ? '#f0fdf4' : '#f9fafb',
                        color: r.is_active ? '#15803d' : '#6b7280',
                        border: `1px solid ${r.is_active ? '#bbf7d0' : '#e5e7eb'}`,
                      } as React.CSSProperties}
                    >
                      {r.is_active ? (isNl ? 'Actief' : 'Active') : (isNl ? 'Inactief' : 'Inactive')}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditRule(r)}
                        style={{ height: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9f9f9', fontSize: 12, cursor: 'pointer' }}>
                        {isNl ? 'Bewerken' : 'Edit'}
                      </button>
                      <button onClick={() => { if (confirm(isNl ? 'Verwijderen?' : 'Delete?')) deleteMut.mutate(r.id) }}
                        style={{ height: 30, padding: '0 8px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRule !== null && (
        <RuleModal rule={editRule === 'new' ? null : editRule} isNl={isNl} onClose={() => setEditRule(null)} />
      )}
    </div>
  )
}
