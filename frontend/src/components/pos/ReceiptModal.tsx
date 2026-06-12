import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import { getSale, sendReceiptEmail } from '@/api/sales'
import { buildReceiptBytes } from '@/lib/escpos'
import { printEscPos } from '@/lib/hardware'
import { useSettingsStore } from '@/store/settingsStore'
import apiClient from '@/api/client'
import type { Store } from '@/types/models'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string
  cashTendered: number
  change: number
  onNewSale: () => void
}

export default function ReceiptModal({
  isOpen, onClose, saleId, cashTendered, change, onNewSale,
}: ReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const printer       = useSettingsStore((s) => s.printer)
  const storeId       = useSettingsStore((s) => s.storeId)
  const autoPrint     = useSettingsStore((s) => s.autoPrintReceipt)
  // Thermal (ESC/POS) configured → print silently through it. Otherwise the
  // Print button falls back to the OS print dialog (receipt PDF in a hidden
  // iframe) — works with any printer installed on the machine.
  const hasThermal    = printer.type !== 'none'
  

  const [printStatus, setPrintStatus]   = useState<'idle' | 'printing' | 'ok' | 'error'>('idle')
  const [pdfStatus, setPdfStatus]       = useState<'idle' | 'loading' | 'error'>('idle')
  const [emailInput, setEmailInput]     = useState('')
  const [showEmail, setShowEmail]       = useState(false)
  const [emailStatus, setEmailStatus]   = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  // Fetch sale details for ESC/POS building
  const { data: sale } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
    enabled: isOpen && hasThermal,
  })

  // Fetch store details for receipt header/footer
  const { data: store } = useQuery<Store>({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/stores/${storeId}`)
      return data.data
    },
    enabled: isOpen && hasThermal && !!storeId,
  })

  const emailMutation = useMutation({
    mutationFn: () => sendReceiptEmail(saleId, i18n.language),
    onSuccess: () => setEmailStatus('ok'),
    onError:   () => setEmailStatus('error'),
  })

  const handleEscPosPrint = useCallback(async () => {
    if (!sale || !store) return
    setPrintStatus('printing')
    try {
      const locale = i18n.language === 'nl' ? 'nl' : 'en'
      const bytes = buildReceiptBytes({
        sale: {
          sale_number:       sale.sale_number,
          occurred_at:       sale.occurred_at,
          cashier_name:      sale.cashier_id, // name resolved server-side, fallback to id
          customer_name:     sale.customer?.name,
          payment_method:    sale.payment_method,
          subtotal_srd:      sale.subtotal_srd,
          discount_srd:      sale.discount_srd,
          total_srd:         sale.total_srd,
          btw_srd:           sale.btw_srd,
          cash_tendered:     cashTendered > 0 ? cashTendered.toFixed(2) : undefined,
          change:            change > 0 ? change.toFixed(2) : undefined,
          exchange_rate_used: sale.exchange_rate_used,
          items: sale.items.map((item) => ({
            product_name:   item.product_name_snapshot,
            quantity:       item.quantity,
            unit_price_srd: item.unit_price_srd,
            line_total_srd: item.line_total_srd,
            discount_srd:   item.discount_srd,
            btw_rate:       item.btw_rate,
            btw_exempt:     false,
          })),
        },
        store: {
          name:           store.name,
          receipt_header: store.receipt_header,
          receipt_footer: store.receipt_footer,
          // Per-store receipt BTW number overrides the organisation's.
          btw_number:     store.settings?.receipt_btw_number || store.organisation?.btw_number || undefined,
        },
        locale,
      })

      const result = await printEscPos(bytes, printer)
      setPrintStatus(result.success ? 'ok' : 'error')
    } catch {
      setPrintStatus('error')
    }
  }, [sale, store, printer, cashTendered, change, i18n.language])

  /**
   * Browser-print fallback — no thermal printer configured. Loads the receipt
   * PDF into a hidden iframe and calls print(), which opens the OS print
   * dialog. Works with ANY printer installed on the machine (including
   * thermal printers via their Windows driver) — the same flow web-based POS
   * like Loyverse/Square use when no receipt printer is paired.
   */
  const printViaBrowser = useCallback(async () => {
    setPrintStatus('printing')
    try {
      const params = new URLSearchParams({ locale: i18n.language })
      if (cashTendered > 0) params.set('cash_tendered', String(cashTendered))
      if (change > 0) params.set('change', String(change))
      const res = await apiClient.get(`/sales/${saleId}/receipt/pdf?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.src = url
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setPrintStatus('ok')
        } catch {
          // Cross-origin/viewer edge case — fall back to opening the PDF.
          window.open(url, '_blank')
          setPrintStatus('idle')
        }
      }
      document.body.appendChild(iframe)
      // Keep the iframe alive long enough for the print dialog + spooling,
      // then clean up. (Removing it immediately cancels the print job.)
      setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url) }, 60_000)
    } catch {
      setPrintStatus('error')
    }
  }, [saleId, cashTendered, change, i18n.language])

  // Auto-print when the modal opens after a sale (Settings → Printer toggle).
  // Fires once per sale: thermal waits for the sale+store queries it needs;
  // the browser path fires immediately.
  const autoPrintedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!isOpen || !autoPrint || autoPrintedFor.current === saleId) return
    if (hasThermal) {
      if (sale && store) {
        autoPrintedFor.current = saleId
        handleEscPosPrint()
      }
    } else {
      autoPrintedFor.current = saleId
      printViaBrowser()
    }
  }, [isOpen, autoPrint, saleId, hasThermal, sale, store, handleEscPosPrint, printViaBrowser])

  async function openPdf() {
    setPdfStatus('loading')
    try {
      const params = new URLSearchParams({ locale: i18n.language })
      if (cashTendered > 0) params.set('cash_tendered', String(cashTendered))
      if (change > 0) params.set('change', String(change))
      const res = await apiClient.get(`/sales/${saleId}/receipt/pdf?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.click()
      URL.revokeObjectURL(url)
      setPdfStatus('idle')
    } catch {
      setPdfStatus('error')
      setTimeout(() => setPdfStatus('idle'), 3000)
    }
  }

  async function handleEmail() {
    if (emailInput) {
      // If custom email entered, use it via a different endpoint
      setEmailStatus('sending')
      emailMutation.mutate()
    } else {
      setEmailStatus('sending')
      emailMutation.mutate()
    }
  }

  const statusIcon = { idle: '🖨', printing: '⏳', ok: '✓', error: '✗' }
  const statusColor = { idle: 'var(--text-primary)', printing: 'var(--color-warning)', ok: 'var(--color-success)', error: 'var(--color-error)' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pos.receipt.title')} width={380}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>

        {/* Success + change display */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(0, 212, 170, 0.12)',
          border: '2px solid var(--color-success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>✓</div>

        {change > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {t('pos.payment.change')}
            </div>
            <div className="currency-srd" style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-success)', marginTop: 4 }}>
              SRD {change.toFixed(2)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>

          {/* Print — ALWAYS available. Thermal (silent ESC/POS) when a printer
              is configured in Settings → Printer; otherwise the OS print
              dialog with the receipt PDF (any installed printer works). */}
          <button
            onClick={hasThermal ? handleEscPosPrint : printViaBrowser}
            disabled={printStatus === 'printing' || (hasThermal && !sale)}
            data-testid="btn-print-escpos"
            style={{
              height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: `1px solid ${printStatus === 'ok' ? 'var(--color-success)' : printStatus === 'error' ? 'var(--color-error)' : 'var(--border-color)'}`,
              background: 'var(--bg-elevated)',
              color: statusColor[printStatus],
              cursor: printStatus === 'printing' ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {statusIcon[printStatus]} {
              printStatus === 'printing' ? t('pos.receipt.printing') :
              printStatus === 'ok'       ? t('pos.receipt.printed') :
              printStatus === 'error'    ? t('pos.receipt.printError') :
              hasThermal ? t('pos.receipt.printThermal') : t('pos.receipt.print')
            }
          </button>

          {/* PDF fallback — always shown */}
          <button
            onClick={openPdf}
            disabled={pdfStatus === 'loading'}
            data-testid="btn-print-pdf"
            style={{
              height: 'var(--touch-target)',
              borderRadius: 'var(--border-radius)',
              border: `1px solid ${pdfStatus === 'error' ? 'var(--color-error)' : 'var(--border-color)'}`,
              background: 'var(--bg-elevated)',
              color: pdfStatus === 'error' ? 'var(--color-error)' : 'var(--text-primary)',
              cursor: pdfStatus === 'loading' ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: pdfStatus === 'loading' ? 0.7 : 1,
            }}
          >
            {pdfStatus === 'loading' ? '⏳' : pdfStatus === 'error' ? '✗' : '📄'} {t('pos.receipt.printPdf')}
          </button>

          {/* Email receipt */}
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              data-testid="btn-email-receipt"
              style={{
                height: 'var(--touch-target)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              ✉ {t('pos.receipt.email')}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder={t('pos.receipt.emailPlaceholder')}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  flex: 1, height: 'var(--touch-target)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  padding: '0 12px', fontSize: 'var(--font-size-sm)',
                }}
              />
              <button
                onClick={handleEmail}
                disabled={emailStatus === 'sending'}
                style={{
                  height: 'var(--touch-target)', padding: '0 16px',
                  borderRadius: 'var(--border-radius)',
                  border: 'none',
                  background: emailStatus === 'ok' ? 'var(--color-success)' : emailStatus === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
                  color: '#fff', cursor: 'pointer', fontWeight: 600,
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {emailStatus === 'sending' ? '⏳' : emailStatus === 'ok' ? '✓' : emailStatus === 'error' ? '✗' : t('app.send')}
              </button>
            </div>
          )}

          {/* New sale */}
          <button
            onClick={() => { onNewSale(); onClose() }}
            data-testid="btn-new-sale"
            style={{
              height: 'var(--touch-target-xl)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 'var(--font-size-base)',
              marginTop: 4,
            }}
          >
            {t('pos.receipt.newSale')}
          </button>
        </div>

        {/* Setup tip — only when no thermal printer is configured */}
        {!hasThermal && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('pos.receipt.noPrinterConfigured')}
          </div>
        )}
      </div>
    </Modal>
  )
}
