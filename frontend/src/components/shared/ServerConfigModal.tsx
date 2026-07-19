import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'
import {
  clearServerUrl, getApiBaseUrl, getConfiguredServerUrl, getDefaultApiUrl,
  normalizeServerUrl, saveServerUrl, testServerUrl,
} from '@/lib/serverConfig'

interface ServerConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Point this till at a (different) store server — reachable from the login
 * screen so a fresh field install with a wrong baked IP can be fixed on the
 * spot, without rebuilding the app. Saving reloads the app: the axios client
 * and the Reverb discovery both read the base URL once at boot.
 */
export default function ServerConfigModal({ isOpen, onClose }: ServerConfigModalProps) {
  const { t } = useTranslation()
  const overrideActive = getConfiguredServerUrl() !== null
  const [input, setInput] = useState(getConfiguredServerUrl() ?? getDefaultApiUrl())
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [detail, setDetail] = useState('')

  const normalized = normalizeServerUrl(input)

  async function handleTest() {
    setStatus('testing')
    const result = await testServerUrl(input)
    setStatus(result.ok ? 'ok' : 'fail')
    setDetail(result.detail)
  }

  function handleSave() {
    if (!normalized) return
    saveServerUrl(input)
    window.location.reload()
  }

  function handleReset() {
    clearServerUrl()
    window.location.reload()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pos.serverConfig.title')} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          {t('pos.serverConfig.current')}: <code style={{ color: 'var(--text-primary)' }}>{getApiBaseUrl()}</code>
          {overrideActive && (
            <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 4 }}>
              ⚠ {t('pos.serverConfig.overrideActive')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setStatus('idle') }}
            placeholder={t('pos.serverConfig.placeholder')}
            data-testid="input-server-url"
            style={{
              flex: 1, height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: `1px solid ${status === 'fail' ? 'var(--color-error)' : status === 'ok' ? 'var(--color-success)' : 'var(--border-color)'}`,
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              padding: '0 12px', fontSize: 'var(--font-size-sm)',
            }}
          />
          <button
            onClick={handleTest}
            disabled={status === 'testing' || !normalized}
            data-testid="btn-server-test"
            style={{
              height: 'var(--touch-target)', padding: '0 16px',
              borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              cursor: status === 'testing' ? 'wait' : 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
            }}
          >
            {status === 'testing' ? '⏳' : t('pos.serverConfig.test')}
          </button>
        </div>

        {/* Normalised preview + probe result */}
        {normalized && normalized !== input.trim() && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {normalized}</div>
        )}
        {status === 'ok' && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
            ✓ {t('pos.serverConfig.testOk')} ({detail})
          </div>
        )}
        {status === 'fail' && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
            ✗ {t('pos.serverConfig.testFail')} ({detail})
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {t('pos.serverConfig.hint')}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={!normalized}
            data-testid="btn-server-save"
            style={{
              flex: 1, height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)', border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              cursor: normalized ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 'var(--font-size-sm)',
              opacity: normalized ? 1 : 0.5,
            }}
          >
            {t('pos.serverConfig.saveRestart')}
          </button>
          {overrideActive && (
            <button
              onClick={handleReset}
              data-testid="btn-server-reset"
              style={{
                height: 'var(--touch-target)', padding: '0 14px',
                borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
              }}
            >
              {t('pos.serverConfig.reset')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
