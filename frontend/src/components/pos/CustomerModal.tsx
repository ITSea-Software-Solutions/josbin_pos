import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'
import { useCartStore } from '@/store/cartStore'
import { searchCustomers, createCustomer } from '@/api/customers'
import type { Customer } from '@/types/models'

interface CustomerModalProps {
  isOpen: boolean
  onClose: () => void
}

type View = 'search' | 'create'

export default function CustomerModal({ isOpen, onClose }: CustomerModalProps) {
  const { t } = useTranslation()
  const setCustomer = useCartStore((s) => s.setCustomer)
  const currentCustomer = useCartStore((s) => s.customer)

  const [view, setView] = useState<View>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Create form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setQuery(value)
    setSearchError('')
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 2) { setResults([]); return }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await searchCustomers(value.trim())
        setResults(r)
      } catch {
        setSearchError(t('errors.networkError'))
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  function handleSelect(customer: Customer) {
    setCustomer(customer)
    onClose()
  }

  function handleClear() {
    setCustomer(null)
    onClose()
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      const c = await createCustomer({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
      })
      setCustomer(c)
      onClose()
    } catch {
      setCreateError(t('errors.serverError'))
    } finally {
      setCreating(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    background: 'var(--bg-input)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-base)',
    padding: '0 14px',
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    fontWeight: 500,
    display: 'block',
    marginBottom: 5,
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pos.customer.title')} width={440}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-color)' }}>
        {(['search', 'create'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: view === v ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: view === v ? 'var(--color-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: view === v ? 700 : 400,
              fontSize: 'var(--font-size-sm)',
              marginBottom: -1,
            }}
          >
            {v === 'search' ? t('pos.customer.search') : t('pos.customer.add')}
          </button>
        ))}
      </div>

      {view === 'search' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Current customer indicator */}
          {currentCustomer && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--color-primary)',
            }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{currentCustomer.name}</div>
                {currentCustomer.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentCustomer.phone}</div>}
              </div>
              <button onClick={handleClear} style={{
                background: 'none', border: '1px solid var(--border-color)', borderRadius: 4,
                color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px 8px', fontSize: 11,
              }}>
                {t('pos.customer.walkIn')}
              </button>
            </div>
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('app.search') + '…'}
            autoFocus
            style={inputStyle}
          />

          {searchError && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>{searchError}</div>}

          {searching && <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{t('app.loading')}</div>}

          {!searching && query.length >= 2 && results.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{t('pos.customer.notFound')}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{c.name}</div>
                  {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.visit_count}x</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>{t('pos.customer.name')} *</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>{t('pos.customer.phone')}</label>
            <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('pos.customer.email')}</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} />
          </div>

          {createError && <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>{createError}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 44, borderRadius: 'var(--border-radius)',
              border: '1px solid var(--border-color)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            }}>
              {t('app.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
              style={{
                flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                border: 'none', background: 'var(--color-primary)',
                color: '#fff', cursor: !newName.trim() || creating ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 'var(--font-size-sm)',
                opacity: !newName.trim() || creating ? 0.5 : 1,
              }}
            >
              {creating ? t('app.loading') : t('app.save')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
