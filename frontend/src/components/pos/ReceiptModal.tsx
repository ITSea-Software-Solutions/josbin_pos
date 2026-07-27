import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import HelpButton from '@/components/shared/HelpButton'
import { getSale, sendReceiptEmail } from '@/api/sales'
import { buildReceiptBytes } from '@/lib/escpos'
import { buildReceiptText, buildWhatsAppLink } from '@/lib/receiptText'
import { printEscPos, openCashDrawer } from '@/lib/hardware'
import { useSettingsStore } from '@/store/settingsStore'
import { formatDateTime } from '@/utils/date'
import apiClient from '@/api/client'
import type { Store } from '@/types/models'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  saleId: string
  cashTendered: number
  change: number
  onNewSale: () => void
  onOpenSettings?: () => void
}

export default function ReceiptModal({
  isOpen, onClose, saleId, cashTendered, change, onNewSale, onOpenSettings,
}: ReceiptModalProps) {
  const { t, i18n } = useTranslation()
  const printer       = useSettingsStore((s) => s.printer)
  const storeId       = useSettingsStore((s) => s.storeId)
  const autoPrint     = useSettingsStore((s) => s.autoPrintReceipt)
  const dateFormat    = useSettingsStore((s) => s.dateFormat)
  // Thermal (ESC/POS) configured → print silently through it. Otherwise the
  // Print button falls back to the OS print dialog (receipt PDF in a hidden
  // iframe) — works with any printer installed on the machine.
  const hasThermal    = printer.type !== 'none'
  

  const [printStatus, setPrintStatus]   = useState<'idle' | 'printing' | 'ok' | 'error'>('idle')
  const [pdfStatus, setPdfStatus]       = useState<'idle' | 'loading' | 'error'>('idle')
  const [emailInput, setEmailInput]     = useState('')
  const [showEmail, setShowEmail]       = useState(false)
  const [emailStatus, setEmailStatus]   = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [phoneInput, setPhoneInput]     = useState('')

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailValid = EMAIL_RE.test(emailInput.trim())

  // Fetch sale details for ESC/POS building. Also needed (for the attached
  // customer's email) when the email panel is used on a non-thermal terminal,
  // so enable it whenever the email form is open too.
  const { data: sale } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
    enabled: isOpen && (hasThermal || showEmail || showWhatsApp),
  })

  const customerEmail = sale?.customer?.email?.trim() || ''
  const customerPhone = sale?.customer?.phone?.trim() || ''

  // Fetch store details for receipt header/footer (thermal) and the store
  // name on the WhatsApp text receipt.
  const { data: store } = useQuery<Store>({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/stores/${storeId}`)
      return data.data
    },
    enabled: isOpen && (hasThermal || showWhatsApp) && !!storeId,
  })

  const emailMutation = useMutation({
    mutationFn: () => sendReceiptEmail(saleId, emailInput.trim(), i18n.language === 'nl' ? 'nl' : 'en'),
    onSuccess: () => setEmailStatus('ok'),
    onError:   () => setEmailStatus('error'),
  })

  // Which sale has already had its drawer kicked, so a reprint doesn't.
  const drawerDoneFor = useRef<string | null>(null)

  const handleEscPosPrint = useCallback(async () => {
    if (!sale || !store) return
    setPrintStatus('printing')
    try {
      const locale = i18n.language === 'nl' ? 'nl' : 'en'
      const bytes = buildReceiptBytes({
        sale: {
          sale_number:       sale.sale_number,
          // A raw ISO timestamp is not something to hand a customer, and
          // Suriname reads dates day-first. GET /sales/{id} loads the cashier
          // relation — the previous build printed the raw cashier UUID here
          // under a comment claiming the name was resolved server-side.
          occurred_at:       formatDateTime(sale.occurred_at, dateFormat, locale),
          cashier_name:      sale.cashier?.name ?? '—',
          customer_name:     sale.customer?.name,
          payment_method:    sale.payment_method,
          payment_provider:  sale.payment_provider ?? undefined,
          payment_reference: sale.payment_reference ?? undefined,
          subtotal_srd:      sale.subtotal_srd,
          discount_srd:      sale.discount_srd,
          total_srd:         sale.total_srd,
          btw_srd:           sale.btw_srd,
          btw_exempt_reason: sale.btw_exempt ? sale.btw_exempt_reason : undefined,
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
        paperWidth: printer.paperWidth ?? 80,
      })

      const result = await printEscPos(bytes, printer)
      setPrintStatus(result.success ? 'ok' : 'error')

      // Kick the drawer as its own job, AFTER the receipt has been handed to
      // the printer — never at the same time.
      //
      // Embedding the pulse in the receipt stream is the textbook ESC/POS
      // answer and it did not open this shop's drawer, so we use the pulse
      // that demonstrably works on the hardware and simply stop racing it.
      // Two jobs sent at the same instant is what broke both: the drawer
      // stayed shut AND the receipt job itself reported an error, which is
      // why a manual re-print then succeeded.
      //
      // Fired even when the print failed: the customer is handing over cash
      // either way, and the cashier needs the drawer more than the paper.
      // Once per sale — a reprint an hour later must not pop it again.
      const wantsDrawer = sale.payment_method === 'cash' || sale.payment_method === 'mixed'
      if (wantsDrawer && drawerDoneFor.current !== saleId) {
        drawerDoneFor.current = saleId
        await openCashDrawer(printer).catch(() => {})
      }
      return result.success
    } catch {
      setPrintStatus('error')
      return false
    }
  }, [sale, store, printer, cashTendered, change, i18n.language])

  /**
   * Browser-print fallback — no thermal printer configured. Fetches the
   * receipt as HTML and prints it from a hidden same-origin iframe (srcdoc),
   * which opens the OS print dialog and works with ANY installed printer
   * (including a thermal printer via its Windows driver).
   *
   * Why HTML and not the PDF: printing a PDF *blob* loaded into an iframe is
   * unreliable in Chrome — the PDF-viewer plugin doesn't expose its rendered
   * content to the parent's print() call, so the preview comes out blank
   * ("Page 1 of 1", empty). An HTML document in a same-origin iframe prints
   * its actual content every time. The HTML is rendered from the same Blade
   * template as the PDF, so the printout is identical.
   */
  const printViaBrowser = useCallback(async () => {
    setPrintStatus('printing')
    try {
      const params = new URLSearchParams({ locale: i18n.language })
      if (cashTendered > 0) params.set('cash_tendered', String(cashTendered))
      if (change > 0) params.set('change', String(change))
      const res = await apiClient.get(`/sales/${saleId}/receipt/html?${params}`, { responseType: 'text' })
      const html = typeof res.data === 'string' ? res.data : String(res.data)

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.setAttribute('aria-hidden', 'true')
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setPrintStatus('ok')
        } catch {
          setPrintStatus('error')
        }
      }
      document.body.appendChild(iframe)
      // srcdoc keeps the iframe same-origin, so contentWindow.print() is allowed.
      iframe.srcdoc = html
      // Keep the iframe alive long enough for the print dialog + spooling,
      // then clean up. (Removing it immediately cancels the print job.)
      setTimeout(() => { iframe.remove() }, 60_000)
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
        // One automatic retry. A till's first job of the day can be refused
        // while the spooler or the socket is still coming up, and the cashier
        // should not have to notice that — before this, the first attempt
        // showed an error and only a manual tap on Print produced paper.
        handleEscPosPrint().then((ok) => {
          if (!ok) setTimeout(() => { void handleEscPosPrint() }, 900)
        })
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

  function handleEmail() {
    // Require a syntactically valid address — the backend rejects anything else
    // with a 422, and sending to an empty field is the bug this replaces.
    if (!emailValid) {
      setEmailStatus('error')
      return
    }
    setEmailStatus('sending')
    emailMutation.mutate()
  }

  // "Bon via WhatsApp" — builds a compact text receipt into a wa.me deep
  // link. With a number → straight to that chat; empty → WhatsApp's own
  // chat picker. Electron routes https:// windows to the system browser,
  // which hands off to WhatsApp (app or Web).
  function handleWhatsApp() {
    if (!sale) return
    const lang = i18n.language
    const locale = lang === 'en' || lang === 'srn' ? lang : 'nl'
    const text = buildReceiptText({
      storeName:       store?.name || 'Josbin POS',
      saleNumber:      sale.sale_number,
      occurredAt:      sale.occurred_at,
      items: sale.items.map((item) => ({
        product_name:   item.product_name_snapshot,
        quantity:       item.quantity,
        unit_price_srd: item.unit_price_srd,
        line_total_srd: item.line_total_srd,
      })),
      subtotalSrd:     sale.subtotal_srd,
      discountSrd:     sale.discount_srd,
      btwSrd:          sale.btw_srd,
      btwExemptReason: sale.btw_exempt ? sale.btw_exempt_reason : undefined,
      totalSrd:        sale.total_srd,
      paymentMethod:   sale.payment_method,
      paymentProvider: sale.payment_provider ?? undefined,
      change:          change > 0 ? change.toFixed(2) : undefined,
      locale,
    })
    window.open(buildWhatsAppLink(phoneInput, text), '_blank', 'noopener,noreferrer')
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Prefill chip — one tap uses the attached customer's email */}
              {customerEmail && customerEmail !== emailInput.trim() && (
                <button
                  type="button"
                  onClick={() => { setEmailInput(customerEmail); if (emailStatus === 'error') setEmailStatus('idle') }}
                  data-testid="chip-use-customer-email"
                  style={{
                    alignSelf: 'flex-start',
                    height: 26, padding: '0 10px',
                    borderRadius: 20, cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: 'rgba(79,142,247,0.12)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  👤 {t('pos.receipt.useCustomerEmail')}: {customerEmail}
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder={t('pos.receipt.emailPlaceholder')}
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); if (emailStatus === 'error') setEmailStatus('idle') }}
                  style={{
                    flex: 1, height: 'var(--touch-target)',
                    borderRadius: 'var(--border-radius)',
                    border: `1px solid ${emailInput.trim() && !emailValid ? 'var(--color-error)' : 'var(--border-color)'}`,
                    background: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    padding: '0 12px', fontSize: 'var(--font-size-sm)',
                  }}
                />
                <button
                  onClick={handleEmail}
                  disabled={emailStatus === 'sending' || !emailValid}
                  style={{
                    height: 'var(--touch-target)', padding: '0 16px',
                    borderRadius: 'var(--border-radius)',
                    border: 'none',
                    background: emailStatus === 'ok' ? 'var(--color-success)' : emailStatus === 'error' ? 'var(--color-error)' : 'var(--color-primary)',
                    color: '#fff', cursor: emailStatus === 'sending' || !emailValid ? 'not-allowed' : 'pointer', fontWeight: 600,
                    fontSize: 'var(--font-size-sm)',
                    opacity: emailStatus === 'sending' || !emailValid ? 0.5 : 1,
                  }}
                >
                  {emailStatus === 'sending' ? '⏳' : emailStatus === 'ok' ? '✓' : emailStatus === 'error' ? '✗' : t('app.send')}
                </button>
              </div>
              {/* Inline validation — only once they have typed something invalid */}
              {emailInput.trim() && !emailValid && (
                <span style={{ fontSize: 11, color: 'var(--color-error)' }}>
                  {t('pos.receipt.emailInvalid')}
                </span>
              )}
            </div>
          )}

          {/* WhatsApp receipt — Suriname's channel of choice */}
          {!showWhatsApp ? (
            <button
              onClick={() => { setShowWhatsApp(true); if (customerPhone) setPhoneInput(customerPhone) }}
              data-testid="btn-whatsapp-receipt"
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
              💬 {t('pos.receipt.whatsapp')}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {customerPhone && customerPhone !== phoneInput.trim() && (
                <button
                  type="button"
                  onClick={() => setPhoneInput(customerPhone)}
                  data-testid="chip-use-customer-phone"
                  style={{
                    alignSelf: 'flex-start',
                    height: 26, padding: '0 10px',
                    borderRadius: 20, cursor: 'pointer',
                    fontSize: 11, fontWeight: 600,
                    background: 'rgba(79,142,247,0.12)',
                    border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)',
                    whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  👤 {t('pos.receipt.useCustomerPhone')}: {customerPhone}
                </button>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="tel"
                  placeholder={t('pos.receipt.whatsappPlaceholder')}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  data-testid="input-whatsapp-phone"
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
                  onClick={handleWhatsApp}
                  disabled={!sale}
                  data-testid="btn-whatsapp-open"
                  style={{
                    height: 'var(--touch-target)', padding: '0 16px',
                    borderRadius: 'var(--border-radius)',
                    border: 'none',
                    background: '#25D366',
                    color: '#fff', cursor: !sale ? 'wait' : 'pointer', fontWeight: 600,
                    fontSize: 'var(--font-size-sm)',
                    opacity: !sale ? 0.6 : 1,
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

          {/* No thermal printer configured → nudge to set one up (the Print
              button still works via the OS dialog; this is a shortcut). */}
          {!hasThermal && onOpenSettings && (
            <button
              onClick={() => { onOpenSettings(); onClose() }}
              style={{
                height: 'var(--touch-target)', background: 'none', border: '1px dashed var(--border-color)',
                borderRadius: 'var(--border-radius)', color: 'var(--text-secondary)', cursor: 'pointer',
                fontSize: 'var(--font-size-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              🖨 {t('pos.receipt.setupPrinter')}
            </button>
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

        {/* Always-available pointer to the full printer / cash-drawer / scanner
            setup guide — right where a cashier first wonders "how do I print?". */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {t('pos.receipt.setupHelp')}
          </span>
          <HelpButton topic="hardware" />
        </div>
      </div>
    </Modal>
  )
}
