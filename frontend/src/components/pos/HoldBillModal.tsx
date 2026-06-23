import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/shared/Modal'

/**
 * Asks for an optional label when parking (holding) a bill, so the Open Bills
 * list shows a recognisable name — a table number or customer ("Tafel 3",
 * "Mevr. Pinas") — instead of just a timestamp. Leaving it blank is fine; the
 * list then falls back to the hold time.
 */
export default function HoldBillModal({ isOpen, onClose, onConfirm }: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (label: string) => void
}) {
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setLabel('')
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [isOpen])

  function submit() {
    onConfirm(label.trim())
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNl ? 'Bon parkeren' : 'Hold bill'} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {isNl
            ? 'Geef de bon een naam zodat je hem makkelijk terugvindt (bijv. tafelnummer of klant). Optioneel.'
            : 'Give the bill a name so you can find it again (e.g. table number or customer). Optional.'}
        </p>
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder={isNl ? 'Bijv. Tafel 3 · Mevr. Pinas' : 'e.g. Table 3 · Mr. Jones'}
          maxLength={60}
          style={{
            height: 'var(--touch-target)', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', padding: '0 14px', fontSize: 'var(--font-size-base)', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, height: 'var(--touch-target)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button onClick={submit} data-testid="btn-confirm-hold"
            style={{ flex: 2, height: 'var(--touch-target)', borderRadius: 'var(--border-radius)', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            {isNl ? 'Parkeren' : 'Hold bill'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
