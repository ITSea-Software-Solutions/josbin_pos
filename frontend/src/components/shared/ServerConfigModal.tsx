import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'
import {
  clearServerUrl, discoverServers, getApiBaseUrl, getConfiguredServerUrl, getDefaultApiUrl,
  isDiscoverySupported, normalizeServerUrl, saveServerUrl, testServerUrl,
  type DiscoveredServer,
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
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<DiscoveredServer[] | null>(null)
  const canDiscover = isDiscoverySupported()

  const normalized = normalizeServerUrl(input)

  async function handleTest(url?: string) {
    const target = url ?? input
    setStatus('testing')
    const result = await testServerUrl(target)
    setStatus(result.ok ? 'ok' : 'fail')
    setDetail(result.detail)
  }

  /** Sweep the LAN, then: one hit → fill + test it, several → let the operator pick. */
  async function handleFind() {
    setScanning(true)
    setFound(null)
    setStatus('idle')
    try {
      const results = await discoverServers()
      setFound(results)
      if (results.length === 1) {
        setInput(results[0].url)
        await handleTest(results[0].url)
      }
    } finally {
      setScanning(false)
    }
  }

  async function handlePick(server: DiscoveredServer) {
    setInput(server.url)
    await handleTest(server.url)
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
            onClick={() => handleTest()}
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

        {/* ── Find my server — LAN sweep of the till's own /24 ─────────────── */}
        <button
          onClick={handleFind}
          disabled={!canDiscover || scanning || status === 'testing'}
          data-testid="btn-server-find"
          title={canDiscover ? undefined : t('pos.serverConfig.findUnavailable')}
          style={{
            height: 'var(--touch-target)',
            borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            cursor: !canDiscover ? 'not-allowed' : scanning ? 'wait' : 'pointer',
            fontWeight: 600, fontSize: 'var(--font-size-sm)',
            opacity: canDiscover ? 1 : 0.5,
          }}
        >
          {/* The "searching…" line below carries the status; the button just spins. */}
          {scanning ? `⏳ ${t('pos.serverConfig.find')}` : t('pos.serverConfig.find')}
        </button>

        {/* Browsers have no raw sockets — say so instead of showing a dead button */}
        {!canDiscover && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }} data-testid="txt-find-unavailable">
            {t('pos.serverConfig.findUnavailable')}
          </div>
        )}

        {scanning && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }} data-testid="txt-find-searching">
            {t('pos.serverConfig.searching')}
          </div>
        )}

        {!scanning && found !== null && found.length === 0 && (
          <div
            data-testid="txt-find-none"
            style={{
              fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--border-radius)', padding: 10, lineHeight: 1.4,
            }}
          >
            {t('pos.serverConfig.foundNone')}
          </div>
        )}

        {!scanning && found !== null && found.length === 1 && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }} data-testid="txt-find-one">
            {t('pos.serverConfig.foundOne')}
          </div>
        )}

        {!scanning && found !== null && found.length > 1 && (
          <div data-testid="list-find-results" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {t('pos.serverConfig.foundMany', { n: found.length })}
            </div>
            {found.map((server) => {
              const selected = normalized === server.url
              return (
                <button
                  key={server.url}
                  onClick={() => handlePick(server)}
                  data-testid={`btn-find-pick-${server.ip}-${server.port}`}
                  aria-label={`${t('pos.serverConfig.pickPrompt')}: ${server.ip}:${server.port}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    height: 'var(--touch-target)', padding: '0 12px', textAlign: 'left',
                    borderRadius: 'var(--border-radius)',
                    border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                    cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: 600,
                  }}
                >
                  <span>{server.ip}:{server.port}</span>
                  {server.appEnv && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 4,
                      background: 'var(--bg-input)', color: 'var(--text-secondary)',
                    }}>
                      {server.appEnv}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

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
