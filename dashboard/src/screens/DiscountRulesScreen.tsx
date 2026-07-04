import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTableSort } from '@/lib/useTableSort'
import apiClient from '@/api/client'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EmptyState from '@/components/shared/EmptyState'
import { useToast } from '@/components/shared/Toast'

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
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 800, color: '#16203a' }}>
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
            style={{ flex: 1, height: 40, borderRadius: 8, border: 'none', background: '#293371', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, opacity: !form.name ? 0.5 : 1 }}>
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
  const toast = useToast()
  const [editRule, setEditRule] = useState<DiscountRule | 'new' | null>(null)
  // Bulk selection + confirm state.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'enable' | 'disable' | 'delete' | null>(null)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  // Single-row delete confirm (replaces the old window.confirm()).
  const [deleteTarget, setDeleteTarget] = useState<DiscountRule | null>(null)

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discount-rules'] })
      setDeleteTarget(null)
      toast.success(isNl ? 'Regel verwijderd' : 'Rule deleted')
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(isNl ? `Verwijderen mislukt: ${msg}` : `Delete failed: ${msg}`)
    },
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

  // Active rules first by default; sorting (when a column is picked) overrides
  // that ordering. Shared hook → identical behaviour across all dashboard tables.
  const { sorted, sort, toggle, indicator } = useTableSort([...active, ...inactive], {
    name:     (r) => (r.name ?? '').toLowerCase(),
    discount: (r) => Number(r.value) || 0,
    applies:  (r) => appliesToLabel(r).toLowerCase(),
    minQty:   (r) => (r.min_qty == null ? null : Number(r.min_qty) || 0),
    validity: (r) => (r.valid_from ? new Date(r.valid_from).getTime() : null),
    status:   (r) => (r.is_active ? 1 : 0),
  })

  // ── Bulk selection ──────────────────────────────────────────────────────
  const allSelected = rules.length > 0 && rules.every((r) => selectedIds.has(r.id))
  const selectedRules = rules.filter((r) => selectedIds.has(r.id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }
  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rules.map((r) => r.id)))
  }

  // Run the existing single-rule API sequentially so backend validation and
  // audit logging stay per-rule, while we show aggregate progress.
  async function runBulk(action: 'enable' | 'disable' | 'delete') {
    setBulkAction(null)
    const targets = action === 'delete'
      ? selectedRules
      : selectedRules.filter((r) => r.is_active !== (action === 'enable'))
    if (targets.length === 0) {
      toast.info(isNl ? 'Niets te wijzigen.' : 'Nothing to change.')
      setSelectedIds(new Set())
      return
    }
    setBulkProgress({ done: 0, total: targets.length })
    let ok = 0, failed = 0
    for (const r of targets) {
      try {
        if (action === 'delete') await apiClient.delete(`/discount-rules/${r.id}`)
        else await apiClient.put(`/discount-rules/${r.id}`, { is_active: action === 'enable' })
        ok++
      } catch {
        failed++
      }
      setBulkProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
    }
    setBulkProgress(null)
    setSelectedIds(new Set())
    qc.invalidateQueries({ queryKey: ['discount-rules'] })
    const verb = action === 'delete' ? (isNl ? 'verwijderd' : 'deleted')
      : action === 'enable' ? (isNl ? 'ingeschakeld' : 'enabled')
      : (isNl ? 'uitgeschakeld' : 'disabled')
    if (failed === 0) toast.success(isNl ? `${ok} regel(s) ${verb}.` : `${ok} rule(s) ${verb}.`)
    else toast.warning(isNl ? `${ok} ${verb}, ${failed} mislukt.` : `${ok} ${verb}, ${failed} failed.`)
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#16203a', letterSpacing: '-0.5px', marginBottom: 4 }}>
            {isNl ? 'Kortingsregels' : 'Discount Rules'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280' }}>
            {isNl ? `${active.length} actieve regels` : `${active.length} active rules`}
          </p>
        </div>
        <button onClick={() => setEditRule('new')}
          style={{ height: 42, padding: '0 20px', borderRadius: 10, border: 'none', background: '#293371', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {isNl ? '+ Nieuwe regel' : '+ New rule'}
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #e6ebf7', borderTopColor: '#293371', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : rules.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5' }}>
          <EmptyState
            icon="🎁"
            isNl={isNl}
            title={{ nl: 'Nog geen kortingsregels', en: 'No discount rules yet' }}
            description={{ nl: 'Voeg een regel toe voor promoties of bulkkortingen.', en: 'Add a rule for promotions or bulk discounts.' }}
            cta={{ label: { nl: '+ Nieuwe regel', en: '+ New rule' }, onClick: () => setEditRule('new') }}
          />
        </div>
      ) : (
        <>
        {/* Sticky bulk-action bar — appears when rows are selected. */}
        {selectedIds.size > 0 && (
          <div style={{ position: 'sticky', top: 12, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, padding: '12px 18px', background: 'linear-gradient(135deg,#293371,#1f2a63)', borderRadius: 12, color: '#fff', boxShadow: '0 6px 18px rgba(41,51,113,.35)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>
              {bulkProgress
                ? (isNl ? `Bezig… ${bulkProgress.done}/${bulkProgress.total}` : `Working… ${bulkProgress.done}/${bulkProgress.total}`)
                : `${selectedIds.size} ${isNl ? 'geselecteerd' : 'selected'}`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedIds(new Set())} disabled={!!bulkProgress}
                style={{ height: 36, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 600, opacity: bulkProgress ? 0.6 : 1 }}>
                {isNl ? 'Wissen' : 'Clear'}
              </button>
              <button onClick={() => setBulkAction('enable')} disabled={!!bulkProgress}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#f0fdf4', color: '#15803d', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkProgress ? 0.6 : 1 }}>
                ✓ {isNl ? 'Inschakelen' : 'Enable'}
              </button>
              <button onClick={() => setBulkAction('disable')} disabled={!!bulkProgress}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#fff7ed', color: '#c2410c', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkProgress ? 0.6 : 1 }}>
                {isNl ? 'Uitschakelen' : 'Disable'}
              </button>
              <button onClick={() => setBulkAction('delete')} disabled={!!bulkProgress}
                style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#dc2626', cursor: bulkProgress ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 800, opacity: bulkProgress ? 0.6 : 1 }}>
                {isNl ? 'Verwijderen' : 'Delete'}
              </button>
            </div>
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e6ecf5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(to right,#f4f6fc,#f2f5fb)', borderBottom: '1px solid #e9eef9' }}>
                <th style={{ padding: '11px 8px 11px 16px', width: 38 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    title={isNl ? 'Alles selecteren' : 'Select all'}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#293371' }} />
                </th>
                {[
                  { key: 'name',     label: isNl ? 'Naam' : 'Name' },
                  { key: 'discount', label: isNl ? 'Korting' : 'Discount' },
                  { key: 'applies',  label: isNl ? 'Van toepassing op' : 'Applies to' },
                  { key: 'minQty',   label: isNl ? 'Min. aantal' : 'Min. qty' },
                  { key: 'validity', label: isNl ? 'Geldigheid' : 'Validity' },
                  { key: 'status',   label: 'Status' },
                ].map((h) => (
                  <th key={h.key} onClick={() => toggle(h.key)}
                    style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                    {h.label}
                    <span style={{ marginLeft: 5, fontSize: 9, color: sort?.key === h.key ? '#293371' : '#c0c0cc' }}>{indicator(h.key)}</span>
                  </th>
                ))}
                <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5f6a84', textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id}
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid #f1f4fb' : 'none', opacity: r.is_active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(41,51,113,.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 8px 12px 16px' }}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleOne(r.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#293371' }} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#16203a' }}>{r.name}</p>
                    {r.stackable && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#293371' }}>{isNl ? 'Stapelbaar' : 'Stackable'}</p>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#293371' }}>{typeLabel(r)}</span>
                    {r.max_discount_srd && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7e88a0' }}>max SRD {r.max_discount_srd.toFixed(2)}</p>}
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
                      <button onClick={() => setDeleteTarget(r)}
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
        </>
      )}

      {editRule !== null && (
        <RuleModal rule={editRule === 'new' ? null : editRule} isNl={isNl} onClose={() => setEditRule(null)} />
      )}

      {/* Single-row delete confirm (replaces window.confirm). */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        loading={deleteMut.isPending}
        tone="danger"
        title={isNl ? 'Kortingsregel verwijderen?' : 'Delete discount rule?'}
        message={isNl
          ? `"${deleteTarget?.name}" wordt permanent verwijderd. Dit kan niet ongedaan worden gemaakt.`
          : `"${deleteTarget?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel={isNl ? 'Verwijderen' : 'Delete'}
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
      />

      {/* Bulk enable / disable / delete confirm. */}
      <ConfirmDialog
        isOpen={bulkAction !== null}
        tone={bulkAction === 'delete' || bulkAction === 'disable' ? 'danger' : 'default'}
        title={
          bulkAction === 'delete'  ? (isNl ? 'Geselecteerde regels verwijderen?' : 'Delete selected rules?')
          : bulkAction === 'enable'  ? (isNl ? 'Geselecteerde regels inschakelen?' : 'Enable selected rules?')
          : (isNl ? 'Geselecteerde regels uitschakelen?' : 'Disable selected rules?')
        }
        message={(() => {
          const n = bulkAction === 'delete'
            ? selectedRules.length
            : selectedRules.filter((r) => r.is_active !== (bulkAction === 'enable')).length
          return bulkAction === 'delete'
            ? (isNl ? `${n} regel(s) worden permanent verwijderd. Dit kan niet ongedaan worden gemaakt.` : `${n} rule(s) will be permanently deleted. This cannot be undone.`)
            : bulkAction === 'enable'
              ? (isNl ? `${n} regel(s) worden ingeschakeld en gaan direct gelden bij de kassa.` : `${n} rule(s) will be enabled and apply immediately at the POS.`)
              : (isNl ? `${n} regel(s) worden uitgeschakeld en gelden niet meer bij de kassa.` : `${n} rule(s) will be disabled and no longer apply at the POS.`)
        })()}
        confirmLabel={
          bulkAction === 'delete'  ? (isNl ? 'Verwijderen' : 'Delete')
          : bulkAction === 'enable'  ? (isNl ? 'Inschakelen' : 'Enable')
          : (isNl ? 'Uitschakelen' : 'Disable')
        }
        cancelLabel={isNl ? 'Annuleren' : 'Cancel'}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => bulkAction && runBulk(bulkAction)}
      />
    </div>
  )
}
