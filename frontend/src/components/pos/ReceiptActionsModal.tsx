/**
 * Everything you can do with a receipt AFTER the sale is over.
 *
 * The popup at the end of a sale is deliberately down to Reprint + New sale —
 * a cashier with a customer waiting has one job. These four actions are the
 * ones you reach for later, about a sale you had to look up first, so they
 * live here on Transactions where you find that sale.
 */

import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import { getSale, sendReceiptEmail, openReceiptPdf } from '@/api/sales'
import { printEscPos } from '@/lib/hardware'
import { saleToEscPosBytes, saleToReceiptText } from '@/lib/saleReceipt'
import { buildWhatsAppLink } from '@/lib/receiptText'
import { getReceiptStamp } from '@/api/stores'
import { useSettingsStore } from '@/store/settingsStore'
import apiClient from '@/api/client'
import type { Sale, Store } from '@/types/models'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = 'idle' | 'busy' | 'ok' | 'error'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** The row the user clicked — enough to label the modal before the full
   *  sale (with items, cashier and customer) has loaded. */
  sale: Sale
}

export default function ReceiptActionsModal({ isOpen, onClose, sale: row }: Props) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const printer    = useSettingsStore((s) => s.printer)
  const storeId    = useSettingsStore((s) => s.storeId)
  const dateFormat = useSettingsStore((s) => s.dateFormat)
  const stamp      = useSettingsStore((s) => s.receiptStamp)
  const hasThermal = printer.type !== 'none'

  const [printStatus, setPrintStatus] = useState<Status>('idle')
  const [printError,  setPrintError]  = useState<string | null>(null)
  const [pdfStatus,   setPdfStatus]   = useState<Status>('idle')

  const [showEmail,   setShowEmail]   = useState(false)
  const [emailInput,  setEmailInput]  = useState('')
  const [emailStatus, setEmailStatus] = useState<Status>('idle')
  const [emailError,  setEmailError]  = useState<string | null>(null)

  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [phoneInput,   setPhoneInput]   = useState('')

  // Full sale — the history list carries totals but not items, and a receipt
  // without its lines is not a receipt.
  const { data: sale } = useQuery({
    queryKey: ['sale', row.id],
    queryFn: () => getSale(row.id),
    enabled: isOpen,
  })

  const { data: store } = useQuery<Store>({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/stores/${storeId}`)
      return data.data
    },
    enabled: isOpen && !!storeId,
  })

  // The store's own stamp image, when one has been uploaded. Long-lived in
  // cache: it changes when a manager replaces the file, not per sale.
  const { data: stampBits } = useQuery({
    queryKey: ['receipt-stamp', storeId],
    queryFn: () => getReceiptStamp(storeId!),
    enabled: !!storeId && stamp,
    staleTime: 60 * 60_000,
  })

  const customerEmail = sale?.customer?.email ?? ''
  const customerPhone = sale?.customer?.phone ?? ''
  const emailValid = EMAIL_RE.test(emailInput.trim())

  // ── Reprint on the thermal printer ────────────────────────────────────────
  // No drawer pulse: this is a reprint of a sale that was paid and closed,
  // possibly hours ago. Popping the drawer for it would be a cash-control
  // hole, and 1.4.4 fixed exactly that.
  const handleThermalReprint = useCallback(async () => {
    if (!sale || !store) return
    setPrintStatus('busy')
    setPrintError(null)
    try {
      const bytes = saleToEscPosBytes({
        sale, store, lang: i18n.language, dateFormat, stamp,
        stampBits: stampBits ?? undefined,
        paperWidth: printer.paperWidth ?? 80,
      })
      const result = await printEscPos(bytes, printer)
      setPrintStatus(result.success ? 'ok' : 'error')
      setPrintError(result.success ? null : (result.error ?? null))
    } catch (e) {
      setPrintStatus('error')
      setPrintError(String(e))
    }
  }, [sale, store, printer, dateFormat, stamp, stampBits, i18n.language])

  // ── Browser print fallback (no thermal printer configured) ────────────────
  // HTML in a same-origin iframe, not the PDF blob: Chrome's PDF viewer does
  // not expose its rendered content to the parent's print(), so the preview
  // comes out blank. Same Blade template either way.
  const handleBrowserPrint = useCallback(async () => {
    setPrintStatus('busy')
    setPrintError(null)
    try {
      const res = await apiClient.get(
        `/sales/${row.id}/receipt/html?locale=${i18n.language}`, { responseType: 'text' },
      )
      const html = typeof res.data === 'string' ? res.data : String(res.data)
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setPrintStatus('ok')
        } catch { setPrintStatus('error') }
      }
      document.body.appendChild(iframe)
      iframe.srcdoc = html
      setTimeout(() => iframe.remove(), 60_000)
    } catch (e) {
      setPrintStatus('error')
      setPrintError(String(e))
    }
  }, [row.id, i18n.language])

  // ── PDF ───────────────────────────────────────────────────────────────────
  const handlePdf = useCallback(async () => {
    setPdfStatus('busy')
    try {
      await openReceiptPdf(row.id, i18n.language)
      setPdfStatus('ok')
    } catch {
      setPdfStatus('error')
    }
  }, [row.id, i18n.language])

  // ── E-mail ────────────────────────────────────────────────────────────────
  const handleEmail = useCallback(async () => {
    if (!emailValid) { setEmailStatus('error'); return }
    setEmailStatus('busy')
    setEmailError(null)
    try {
      await sendReceiptEmail(row.id, emailInput.trim(), isNl ? 'nl' : 'en')
      setEmailStatus('ok')
    } catch (e) {
      setEmailStatus('error')
      setEmailError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null,
      )
    }
  }, [row.id, emailInput, emailValid, isNl])

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  function handleWhatsApp() {
    if (!sale) return
    const text = saleToReceiptText(sale, store?.name || 'Josbin POS', i18n.language)
    window.open(buildWhatsAppLink(phoneInput, text), '_blank', 'noopener,noreferrer')
  }

  const btn = (bg: string): React.CSSProperties => ({
    height: 'var(--touch-target)',
    borderRadius: 'var(--border-radius)',
    border: '1px solid var(--border-color)',
    background: bg,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 'var(--font-size-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%',
  })

  const inputStyle: React.CSSProperties = {
    flex: 1, height: 'var(--touch-target)', padding: '0 12px',
    borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
    background: 'var(--bg-input, var(--bg-elevated))', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-sm)', minWidth: 0,
  }

  const printIcon = { idle: '🖨', busy: '⏳', ok: '✓', error: '✗' }[printStatus]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isNl ? 'Bon' : 'Receipt'} #${row.sale_number}`}
      width={400}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
          {new Date(row.occurred_at).toLocaleString(isNl ? 'nl-NL' : 'en-GB', {
            timeZone: 'America/Paramaribo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
          {' · '}
          <span className="currency-srd">SRD {parseFloat(row.total_srd).toFixed(2)}</span>
        </div>

        {/* Reprint */}
        <button
          onClick={hasThermal ? handleThermalReprint : handleBrowserPrint}
          disabled={printStatus === 'busy' || (hasThermal && (!sale || !store))}
          data-testid="btn-tx-reprint"
          style={{
            ...btn('var(--bg-elevated)'),
            borderColor: printStatus === 'ok' ? 'var(--color-success)'
              : printStatus === 'error' ? 'var(--color-error)' : 'var(--border-color)',
          }}
        >
          {printIcon} {hasThermal
            ? (isNl ? 'Bon opnieuw printen' : 'Reprint receipt')
            : (isNl ? 'Printen…' : 'Print…')}
        </button>

        {printStatus === 'error' && printError && (
          <div
            data-testid="tx-print-error"
            style={{
              fontSize: 12, lineHeight: 1.45, color: 'var(--color-error)',
              background: 'rgba(224,82,82,.08)', border: '1px solid rgba(224,82,82,.25)',
              borderRadius: 'var(--border-radius)', padding: '8px 10px', wordBreak: 'break-word',
            }}
          >
            {printError}
          </div>
        )}

        {/* PDF */}
        <button
          onClick={handlePdf}
          disabled={pdfStatus === 'busy'}
          data-testid="btn-tx-pdf"
          style={btn('var(--bg-elevated)')}
        >
          {pdfStatus === 'busy' ? '⏳' : pdfStatus === 'error' ? '✗' : '📄'}{' '}
          {isNl ? 'PDF openen' : 'Open PDF'}
        </button>

        {/* E-mail */}
        {!showEmail ? (
          <button
            onClick={() => { setShowEmail(true); if (customerEmail) setEmailInput(customerEmail) }}
            data-testid="btn-tx-email"
            style={btn('var(--bg-elevated)')}
          >
            ✉ {isNl ? 'Bon e-mailen' : 'E-mail receipt'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => { setEmailInput(e.target.value); setEmailStatus('idle') }}
                placeholder={t('pos.receipt.emailPlaceholder')}
                data-testid="input-tx-email"
                style={{
                  ...inputStyle,
                  borderColor: emailInput.trim() && !emailValid
                    ? 'var(--color-error)' : 'var(--border-color)',
                }}
              />
              <button
                onClick={handleEmail}
                disabled={!emailValid || emailStatus === 'busy'}
                data-testid="btn-tx-email-send"
                style={{
                  ...btn(emailValid ? 'var(--color-primary)' : 'var(--bg-elevated)'),
                  width: 'auto', padding: '0 16px', color: emailValid ? '#fff' : 'var(--text-muted)',
                  cursor: emailValid ? 'pointer' : 'not-allowed',
                }}
              >
                {emailStatus === 'busy' ? '⏳' : emailStatus === 'ok' ? '✓' : (isNl ? 'Stuur' : 'Send')}
              </button>
            </div>
            {emailStatus === 'ok' && (
              <span style={{ fontSize: 12, color: 'var(--color-success)' }}>
                {isNl ? 'Bon verstuurd.' : 'Receipt sent.'}
              </span>
            )}
            {emailStatus === 'error' && (
              <span style={{ fontSize: 12, color: 'var(--color-error)' }}>
                {emailError ?? (isNl ? 'Versturen mislukt.' : 'Could not send.')}
              </span>
            )}
          </div>
        )}

        {/* WhatsApp */}
        {!showWhatsApp ? (
          <button
            onClick={() => { setShowWhatsApp(true); if (customerPhone) setPhoneInput(customerPhone) }}
            data-testid="btn-tx-whatsapp"
            style={btn('var(--bg-elevated)')}
          >
            💬 {isNl ? 'Bon via WhatsApp' : 'Receipt via WhatsApp'}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder={t('pos.receipt.whatsappPlaceholder')}
                data-testid="input-tx-whatsapp-phone"
                style={inputStyle}
              />
              <button
                onClick={handleWhatsApp}
                disabled={!sale}
                data-testid="btn-tx-whatsapp-open"
                style={{
                  ...btn('#25D366'), width: 'auto', padding: '0 16px',
                  color: '#fff', borderColor: '#25D366',
                }}
              >
                {!sale ? '⏳' : t('pos.receipt.whatsappOpen')}
              </button>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {t('pos.receipt.whatsappHint')}
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
