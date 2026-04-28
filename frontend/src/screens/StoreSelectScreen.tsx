import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { getMyStores } from '@/api/stores'
import type { Store } from '@/types/models'

export default function StoreSelectScreen() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setStoreId = useSettingsStore((s) => s.setStoreId)

  const { data: stores = [], isLoading, error } = useQuery({
    queryKey: ['my-stores'],
    queryFn: getMyStores,
  })

  function handleSelect(store: Store) {
    setStoreId(store.id)
  }

  function toggleLanguage() {
    const next = i18n.language === 'nl' ? 'en' : 'nl'
    i18n.changeLanguage(next)
    localStorage.setItem('josbin_pos_locale', next)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-base)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: 'var(--color-primary)' }}>
          Josbin POS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {user?.name}
          </span>
          <button
            onClick={toggleLanguage}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {i18n.language === 'nl' ? 'EN' : 'NL'}
          </button>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          gap: 32,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, margin: 0 }}>
            {t('settings.siteName')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 'var(--font-size-base)' }}>
            {i18n.language === 'nl' ? 'Selecteer een vestiging om door te gaan' : 'Select a store to continue'}
          </p>
        </div>

        {isLoading && (
          <p style={{ color: 'var(--text-secondary)' }}>{t('app.loading')}</p>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)' }}>{t('errors.networkError')}</p>
        )}

        {!isLoading && stores.length === 0 && !error && (
          <p style={{ color: 'var(--text-secondary)' }}>
            {i18n.language === 'nl' ? 'Geen vestigingen beschikbaar.' : 'No stores available.'}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
            width: '100%',
            maxWidth: 800,
          }}
        >
          {stores.map((store) => (
            <button
              key={store.id}
              onClick={() => handleSelect(store)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-lg)',
                padding: '24px 20px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.background = 'var(--bg-elevated)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)'
                e.currentTarget.style.background = 'var(--bg-surface)'
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>
                {store.name}
              </div>
              {store.city && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {store.city}
                </div>
              )}
              {store.address && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  {store.address}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
