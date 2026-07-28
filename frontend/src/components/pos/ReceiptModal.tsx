import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import HelpButton from '@/components/shared/HelpButton'
import { getSale } from '@/api/sales'
import { buildReceiptBytes } from '@/lib/escpos'
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
}

export default function ReceiptModal({
  isOpen, onClose, saleId, cashTendered, change, onNewSale,
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
  const [printError, setPrintError]     = useState<string | null>(null)

  // Sale details for building the ESC/POS ticket.
  const { data: sale } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
    enabled: isOpen && hasThermal,
  })


  // Store header/footer and BTW number for the printed ticket.
  const { data: store } = useQuery<Store>({
    queryKey: ['store', storeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/stores/${storeId}`)
      return data.data
    },
    enabled: isOpen && hasThermal && !!storeId,
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
      // Say WHY. Until now this screen showed a bare "print error" and every
      // field report turned into guesswork — the Settings hardware tests have
      // surfaced the real spooler/socket message since 1.3.2, and the screen
      // the cashier actually stands in front of should too.
      setPrintError(result.success ? null : (result.error ?? null))

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
    } catch (e) {
      setPrintStatus('error')
      setPrintError(String(e))
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
        // Retry ladder, not a single retry. The failure that keeps showing up
        // is the FIRST sale of the day: the printer slept overnight, or the
        // spooler / socket is still coming up, and one attempt 900ms later is
        // not long enough for a thermal printer to wake. Three tries spread
        // over ~7s covers a cold start without making a genuinely dead
        // printer take forever to report itself.
        const attempt = (delays: number[]) => {
          void handleEscPosPrint().then((ok) => {
            if (ok || !delays.length) return
            const [wait, ...rest] = delays
            setTimeout(() => attempt(rest), wait)
          })
        }
        attempt([1200, 3000, 3000])
      }
    } else {
      autoPrintedFor.current = saleId
      printViaBrowser()
    }
  }, [isOpen, autoPrint, saleId, hasThermal, sale, store, handleEscPosPrint, printViaBrowser])

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

          {/* The actual reason, verbatim from Windows / the printer socket.
              "Printer not reachable at 192.168.0.251:9100" tells a shop what
              to do; a red button does not. */}
          {printStatus === 'error' && printError && (
            <div
              data-testid="print-error-detail"
              style={{
                fontSize: 12, lineHeight: 1.45, color: 'var(--color-error)',
                background: 'rgba(224,82,82,.08)',
                border: '1px solid rgba(224,82,82,.25)',
                borderRadius: 'var(--border-radius)',
                padding: '8px 10px', wordBreak: 'break-word',
              }}
            >
              {printError}
            </div>
          )}

          {/* Reprint and New sale only.

              A cashier at a live till has one job here: hand over the
              receipt and serve the next customer. PDF, e-mail and WhatsApp
              are things you reach for later, about a sale that already
              happened — they belong on Transactions, where you can find
              the right sale first. Putting them on this popup made the
              cashier read five buttons to press one. */}

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
