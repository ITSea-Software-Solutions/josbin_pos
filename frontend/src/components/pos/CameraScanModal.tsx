import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Quagga from '@ericblade/quagga2'
import { stripAimPrefix } from '@/lib/barcode'

/**
 * Camera barcode scanner for POS terminals without a USB scanner — Android
 * tablets and laptops. Live-decodes 1D symbologies (EAN-13/8, UPC-A/E,
 * Code 128, Code 39, ITF) via Quagga2.
 *
 * Camera decoding of 1D codes occasionally misreads a digit, so a code is
 * only accepted after TWO identical consecutive reads — fast in practice
 * (a steady camera fires several reads per second) and it filters the
 * one-off glitches that would ring up the wrong product.
 */
export default function CameraScanModal({ onDetected, onClose }: {
  onDetected: (code: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const viewportRef = useRef<HTMLDivElement>(null)
  const lastRead    = useRef<string>('')
  const accepted    = useRef(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!viewportRef.current) return

    // getUserMedia only exists in a secure context (HTTPS / localhost /
    // Electron). On plain http://<ip> the browser hides the camera API —
    // explain that instead of failing with a raw exception.
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t('pos.cameraScan.httpsOnly'))
      return
    }

    let started = false
    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: viewportRef.current,
        constraints: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 360 } },
      },
      decoder: {
        readers: [
          'ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader',
          'code_128_reader', 'code_39_reader', 'i2of5_reader',
        ],
      },
      locate: true,
    }, (err) => {
      if (err) {
        const raw = String(err)
        setError(/NotAllowed|Permission|denied/i.test(raw)
          ? t('pos.cameraScan.denied')
          : t('pos.cameraScan.failed', { error: raw }))
        return
      }
      started = true
      Quagga.start()
    })

    Quagga.onDetected((result) => {
      const code = stripAimPrefix(result.codeResult?.code ?? '')
      if (!code || accepted.current) return
      setFlash(true)
      setTimeout(() => setFlash(false), 250)
      if (code === lastRead.current) {
        accepted.current = true
        onDetected(code)
        onClose()
      } else {
        lastRead.current = code
      }
    })

    return () => { try { if (started) Quagga.stop() } catch { /* not started */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,30,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-panel, #16203a)', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 480, boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,.08))' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-primary, #f1f5f9)' }}>{t('pos.cameraScan.title')}</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #94a3b8)' }}>{t('pos.cameraScan.hint')}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-input, rgba(255,255,255,.07))', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--text-secondary, rgba(255,255,255,.6))', fontSize: 18 }}
          >×</button>
        </div>

        {error ? (
          <p style={{ margin: 0, padding: '22px 18px', fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-danger, #fca5a5)' }}>{error}</p>
        ) : (
          <div style={{ position: 'relative', background: '#000', lineHeight: 0 }}>
            <div ref={viewportRef} className="pos-cam-viewport" style={{ width: '100%', minHeight: 260, position: 'relative', overflow: 'hidden' }} />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '70%', height: 2, borderRadius: 2, background: flash ? '#22c55e' : 'rgba(239,108,0,.8)', boxShadow: flash ? '0 0 12px #22c55e' : '0 0 8px rgba(239,108,0,.7)', transition: 'all .15s' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
