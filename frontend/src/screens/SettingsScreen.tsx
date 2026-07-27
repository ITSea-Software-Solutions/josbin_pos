import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useSettingsStore } from '@/store/settingsStore'
import { getStore } from '@/api/stores'
import { listPrinters, openCashDrawer, printEscPos, printHtmlSheet, detectPlatform } from '@/lib/hardware'
import { probeUsbPrinters, UsbPrinter, type UsbDeviceInfo, type UsbProbe } from '@/lib/usbPrinter'
import { buildReceiptBytes } from '@/lib/escpos'
import { LABEL_SIZES, PX_PER_MM, barcodeDataUrl, generateLabelSheetHTML } from '@/lib/labelSheet'
import type { ProductDisplay } from '@/store/settingsStore'
import type { PrinterConfig } from '@/lib/hardware'
import { SystemActions } from '@/components/settings/SystemActions'
import HelpButton from '@/components/shared/HelpButton'

const DATE_FORMATS = ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'D MMMM YYYY', 'D MMM YYYY', 'DD/MM/YY']

type HardwareTestStatus = 'idle' | 'testing' | 'ok' | 'error'

export default function SettingsScreen() {
  const { t, i18n } = useTranslation()
  const {
    productDisplay, setProductDisplay,
    dateFormat, setDateFormat,
    onScreenKeyboard, setOnScreenKeyboard,
    defaultBtwRate, setDefaultBtwRate,
    printer, setPrinter,
    cardTerminal, setCardTerminal,
    autoPrintReceipt, setAutoPrintReceipt,
    embeddedBarcode, setEmbeddedBarcode,
  } = useSettingsStore()
  const storeId = useSettingsStore((s) => s.storeId)

  // Bank options for the simulated-terminal preselect come from the org's
  // configured payment options (same source as the payment modal's chips).
  const { data: settingsStoreData } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId!),
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  })
  const terminalBanks = settingsStoreData?.payment_options?.card_banks
    ?? ['DSB', 'Hakrinbank', 'Republic', 'SPSB', 'VCB', 'GODO', 'Finabank', 'Trustbank']

  const platform = detectPlatform()
  const [saved, setSaved] = useState(false)

  // Heal a saved 'usb' printer config on platforms that can't drive USB
  // (e.g. an Android till configured before that option stopped being
  // offered there) — otherwise the hidden setting keeps failing tests.
  useEffect(() => {
    if (platform !== 'electron' && printer.type === 'usb') {
      updatePrinter({ type: 'network' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [windowsPrinters, setWindowsPrinters] = useState<string[]>([])
  const [drawerTestStatus, setDrawerTestStatus] = useState<HardwareTestStatus>('idle')
  const [receiptTestStatus, setReceiptTestStatus] = useState<HardwareTestStatus>('idle')
  const [labelTestStatus, setLabelTestStatus] = useState<HardwareTestStatus>('idle')
  const printerShareEnabled = useSettingsStore((s) => s.printerShareEnabled)
  const setPrinterShareEnabled = useSettingsStore((s) => s.setPrinterShareEnabled)
  const [shareIps, setShareIps] = useState<string[]>([])
  const [shareError, setShareError] = useState<string | null>(null)
  const [hwError, setHwError] = useState<string | null>(null)
  const [usbProbe, setUsbProbe] = useState<UsbProbe | null>(null)
  const [usbBusy, setUsbBusy] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function loadWindowsPrinters() {
    const list = await listPrinters()
    setWindowsPrinters(list.map((p) => p.name))
  }

  async function testDrawer() {
    setDrawerTestStatus('testing'); setHwError(null)
    const result = await openCashDrawer(printer)
    setDrawerTestStatus(result.success ? 'ok' : 'error')
    if (!result.success) setHwError(result.error ?? null)
    setTimeout(() => setDrawerTestStatus('idle'), 3000)
  }

  // Sends a real ESC/POS ticket through the exact same path a sale receipt
  // takes (CP858 encoding, paper width, platform routing) — so a green test
  // here means sales will print.
  async function testReceiptPrint() {
    setReceiptTestStatus('testing'); setHwError(null)
    try {
      const locale = i18n.language === 'nl' ? 'nl' : 'en'
      const bytes = buildReceiptBytes({
        sale: {
          sale_number: 'TEST-0001',
          occurred_at: new Date().toISOString(),
          cashier_name: 'Josbin POS',
          payment_method: 'cash',
          subtotal_srd: '10.00',
          discount_srd: '0.00',
          total_srd: '10.00',
          btw_srd: '0.91',
          cash_tendered: '10.00',
          change: '0.00',
          items: [{
            product_name: locale === 'nl' ? 'Testproduct' : 'Test product',
            quantity: '1',
            unit_price_srd: '10.00',
            line_total_srd: '10.00',
            discount_srd: '0.00',
            btw_rate: '10.00',
            btw_exempt: false,
          }],
        },
        store: {
          name: 'Josbin POS',
          receipt_footer: locale === 'nl' ? 'Testbon — geen verkoop' : 'Test receipt — not a sale',
        },
        locale,
        paperWidth: printer.paperWidth ?? 80,
      })
      const result = await printEscPos(bytes, printer)
      setReceiptTestStatus(result.success ? 'ok' : 'error')
      if (!result.success) setHwError(result.error ?? null)
    } catch (e) {
      setReceiptTestStatus('error')
      setHwError(String(e))
    }
    setTimeout(() => setReceiptTestStatus('idle'), 3000)
  }

  // Label test goes through printHtmlSheet: OS print dialog on Electron/web,
  // native PrintManager on Android. Independent of the ESC/POS config above,
  // so it stays available even with the receipt printer disabled.
  async function testLabelPrint() {
    setLabelTestStatus('testing')
    try {
      const size = '50x30' as const
      const { w, h } = LABEL_SIZES[size]
      const dataUrl = await barcodeDataUrl(
        '871000000000', 'EAN13', Math.round(w * PX_PER_MM), Math.round(h * PX_PER_MM),
      )
      const html = generateLabelSheetHTML(
        [{
          product: {
            id: 'test',
            name_nl: 'Testetiket',
            name_en: 'Test label',
            barcode: '871000000000',
            price: '9.99',
          },
          qty: 2,
        }],
        size, true, true, i18n.language === 'nl', new Map([['test', dataUrl]]),
      )
      const result = await printHtmlSheet('Josbin POS Test Label', html)
      setLabelTestStatus(result.success ? 'ok' : 'error')
    } catch {
      setLabelTestStatus('error')
    }
    setTimeout(() => setLabelTestStatus('idle'), 3000)
  }

  async function togglePrinterShare() {
    setShareError(null)
    const api = (window as any).josbin_pos
    if (printerShareEnabled) {
      await api?.printerShareStop?.()
      setPrinterShareEnabled(false)
      setShareIps([])
      handleSave()
      return
    }
    const res = await api?.printerShareStart?.(printer.printerName ?? '')
    if (res?.success) {
      setPrinterShareEnabled(true)
      setShareIps(res.ips ?? [])
      handleSave()
    } else {
      setShareError(res?.error ?? t('settings.printer.shareFailed'))
    }
  }

  // Reflect an already-running share (auto-started on boot) in the UI.
  useEffect(() => {
    if (platform !== 'electron') return
    ;(window as any).josbin_pos?.printerShareStatus?.().then(
      (st: { running: boolean; ips: string[] }) => { if (st?.running) setShareIps(st.ips ?? []) },
      () => {},
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Android USB: list attached devices, then claim one (the OS shows its own
  // permission dialog). Vendor+product are stored, not Android's deviceId —
  // that changes on every replug.
  async function scanUsbPrinters() {
    setUsbBusy(true); setHwError(null)
    setUsbProbe(await probeUsbPrinters())
    setUsbBusy(false)
  }

  async function connectUsbPrinter(d: UsbDeviceInfo) {
    setUsbBusy(true); setHwError(null)
    try {
      const res = await UsbPrinter.requestPermission({ vendorId: d.vendorId, productId: d.productId })
      if (res.granted) {
        updatePrinter({ usbVendorId: d.vendorId, usbProductId: d.productId, printerName: d.name })
        setUsbProbe(await probeUsbPrinters())
      } else {
        setHwError(t('settings.printer.usbDenied'))
      }
    } catch (e) {
      setHwError(String(e))
    }
    setUsbBusy(false)
  }

  function updatePrinter(patch: Partial<PrinterConfig>) {
    setPrinter({ ...printer, ...patch })
    handleSave()
  }

  function toggleLanguage(locale: 'nl' | 'en' | 'srn') {
    i18n.changeLanguage(locale)
    localStorage.setItem('josbin_pos_locale', locale)
  }

  const sectionSt: React.CSSProperties = {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: 16,
  }

  const labelSt: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
    fontWeight: 500, marginBottom: 6, display: 'block',
  }

  const selectSt: React.CSSProperties = {
    height: 44, background: 'var(--bg-input)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-base)', padding: '0 14px', outline: 'none', width: '100%',
    cursor: 'pointer',
  }

  const testBtnSt = (status: HardwareTestStatus): React.CSSProperties => ({
    height: 44, borderRadius: 'var(--border-radius)',
    border: `1px solid ${status === 'ok' ? 'var(--color-success)' : status === 'error' ? 'var(--color-error)' : 'var(--border-color)'}`,
    background: 'var(--bg-elevated)',
    color: status === 'ok' ? 'var(--color-success)' : status === 'error' ? 'var(--color-error)' : 'var(--text-primary)',
    cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
  })

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, margin: 0 }}>
          {t('settings.title')}
        </h2>
        {saved && (
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
            ✓ {t('settings.saved')}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, maxWidth: 860 }}>

        {/* Language */}
        <div style={sectionSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{t('settings.language')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['nl', 'en', 'srn'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => toggleLanguage(lang)}
                style={{
                  flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                  border: i18n.language === lang ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                  background: i18n.language === lang ? 'var(--color-primary)' : 'var(--bg-input)',
                  color: i18n.language === lang ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: i18n.language === lang ? 700 : 400,
                  fontSize: 'var(--font-size-base)',
                }}
              >
                {lang === 'nl' ? '🇳🇱 Nederlands' : lang === 'en' ? '🇬🇧 English' : '🇸🇷 Sranantongo'}
              </button>
            ))}
          </div>
        </div>

        {/* Product display */}
        <div style={sectionSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{t('settings.productDisplay')}</h3>
          <div>
            <label style={labelSt}>{t('settings.productDisplay')}</label>
            <select
              value={productDisplay}
              onChange={(e) => { setProductDisplay(e.target.value as ProductDisplay); handleSave() }}
              style={selectSt}
            >
              <option value="name">{t('settings.productDisplayOptions.name')}</option>
              <option value="photo">{t('settings.productDisplayOptions.photo')}</option>
              <option value="both">{t('settings.productDisplayOptions.both')}</option>
            </select>
          </div>
        </div>

        {/* Date format */}
        <div style={sectionSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{t('settings.dateFormat')}</h3>
          <div>
            <label style={labelSt}>{t('settings.dateFormat')}</label>
            <select
              value={dateFormat}
              onChange={(e) => { setDateFormat(e.target.value); handleSave() }}
              style={selectSt}
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Default BTW rate */}
        <div style={sectionSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{t('settings.defaultBtw')}</h3>
          <div>
            <label style={labelSt}>{t('settings.defaultBtw')}</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={defaultBtwRate}
              onChange={(e) => setDefaultBtwRate(e.target.value)}
              onBlur={handleSave}
              style={{
                height: 44, background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)', color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)', padding: '0 14px', outline: 'none', width: '100%',
              }}
            />
          </div>
        </div>

        {/* On-screen keyboard */}
        <div style={sectionSt}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>{t('settings.onScreenKeyboard')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {t('settings.onScreenKeyboard')}
            </span>
            <button
              onClick={() => { setOnScreenKeyboard(!onScreenKeyboard); handleSave() }}
              style={{
                width: 52, height: 28, borderRadius: 14,
                background: onScreenKeyboard ? 'var(--color-primary)' : 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: onScreenKeyboard ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </button>
          </div>
        </div>

        {/* ── Printer & Cash Drawer ─────────────────────────────────────────── */}
        <div style={{ ...sectionSt, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>
              🖨 {t('settings.printer.title')}
            </h3>
            {/* Full printer / cash-drawer / scanner setup walkthrough. */}
            <HelpButton topic="hardware" />
          </div>

          {/* Connection type. USB goes through the Windows print spooler, which
              only exists in the Electron build — on Android/web offering it
              would be a dead end (drawer test fails with a vague error), so
              those platforms get network-only. */}
          <div>
            <label style={labelSt}>{t('settings.printer.type')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(platform === 'web' ? (['none', 'network'] as const) : (['none', 'network', 'usb'] as const)).map((type) => (
                <button
                  key={type}
                  onClick={() => updatePrinter({ type })}
                  style={{
                    flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                    border: printer.type === type ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                    background: printer.type === type ? 'var(--color-primary)' : 'var(--bg-input)',
                    color: printer.type === type ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: printer.type === type ? 700 : 400,
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {type === 'none'    ? t('settings.printer.typeNone') :
                   type === 'network' ? t('settings.printer.typeNetwork') :
                                        t('settings.printer.typeUsb')}
                </button>
              ))}
            </div>
            {platform === 'web' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('settings.printer.networkOnlyHint')}
              </div>
            )}
          </div>

          {/* Auto-print after each sale (works with or without a thermal
              printer — without one, the OS print dialog opens instead). */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                {t('settings.printer.autoPrint')}
              </span>
              <button
                onClick={() => { setAutoPrintReceipt(!autoPrintReceipt); handleSave() }}
                data-testid="toggle-auto-print"
                style={{
                  width: 52, height: 28, borderRadius: 14,
                  background: autoPrintReceipt ? 'var(--color-primary)' : 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: autoPrintReceipt ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              {t('settings.printer.autoPrintHelp')}
            </p>
          </div>

          {/* Network settings */}
          {printer.type === 'network' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
              <div>
                <label style={labelSt}>{t('settings.printer.ipAddress')}</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={printer.ip ?? ''}
                  onChange={(e) => updatePrinter({ ip: e.target.value })}
                  style={{
                    height: 44, width: '100%', background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)', padding: '0 14px',
                    fontSize: 'var(--font-size-base)', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={labelSt}>{t('settings.printer.port')}</label>
                <input
                  type="number"
                  value={printer.port ?? 9100}
                  onChange={(e) => updatePrinter({ port: parseInt(e.target.value) || 9100 })}
                  style={{
                    height: 44, width: 90, background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
                    color: 'var(--text-primary)', padding: '0 14px',
                    fontSize: 'var(--font-size-base)', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Android USB: pick the physical printer once */}
          {printer.type === 'usb' && platform === 'android' && (
            <div>
              <label style={labelSt}>{t('settings.printer.usbDevice')}</label>
              {printer.usbVendorId ? (
                <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius)', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)', fontSize: 12.5, color: 'var(--text-primary)' }}>
                  ✓ {printer.printerName || `${printer.usbVendorId}:${printer.usbProductId}`}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {t('settings.printer.usbHelp')}
                </div>
              )}
              <button
                onClick={scanUsbPrinters}
                disabled={usbBusy}
                data-testid="btn-usb-scan"
                style={{ marginTop: 8, height: 44, width: '100%', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: usbBusy ? 'wait' : 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}
              >
                {usbBusy ? '…' : `🔌 ${t('settings.printer.usbScan')}`}
              </button>
              {/* An empty list has three different causes and three different
                  fixes — say which one this is instead of one vague error. */}
              {usbProbe && usbProbe.devices.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-error)' }}>
                  {usbProbe.unavailable
                    ? t('settings.printer.usbUnavailable')
                    : !usbProbe.hostSupport
                      ? t('settings.printer.usbNoHost')
                      : t('settings.printer.usbNone')}
                </div>
              )}
              {usbProbe && usbProbe.devices.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {usbProbe.devices.map((d) => (
                    <button
                      key={`${d.vendorId}:${d.productId}`}
                      onClick={() => connectUsbPrinter(d)}
                      disabled={!d.printable || usbBusy}
                      style={{
                        textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--border-radius)',
                        border: `1px solid ${printer.usbVendorId === d.vendorId && printer.usbProductId === d.productId ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        background: 'var(--bg-input)', color: d.printable ? 'var(--text-primary)' : 'var(--text-muted)',
                        cursor: d.printable ? 'pointer' : 'not-allowed', fontSize: 'var(--font-size-sm)',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {d.manufacturer ? `${d.manufacturer} · ` : ''}{d.vendorId}:{d.productId}
                        {d.deviceClassName ? ` · ${d.deviceClassName}` : ''}
                        {d.hasPermission ? ' · ✓' : ''}
                        {!d.printable ? ` · ${t('settings.printer.usbNotPrinter')}` : ''}
                      </div>
                      {/* The exact descriptor, so an unrecognised printer can be
                          diagnosed from a photo of this screen. */}
                      {!d.printable && d.reason && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, opacity: .8 }}>
                          {d.reason}
                          {d.interfaces?.length ? ` · ${d.interfaces.map((i) => `${i.className} (${i.endpoints} ep)`).join(', ')}` : ''}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* USB / Windows spooler settings */}
          {printer.type === 'usb' && platform === 'electron' && (
            <div>
              <label style={labelSt}>{t('settings.printer.windowsPrinter')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={printer.printerName ?? ''}
                  onChange={(e) => updatePrinter({ printerName: e.target.value })}
                  style={{ ...selectSt, flex: 1 }}
                >
                  <option value="">{t('settings.printer.selectPrinter')}</option>
                  {windowsPrinters.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <button
                  onClick={loadWindowsPrinters}
                  style={{
                    height: 44, padding: '0 16px', borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {t('settings.printer.refresh')}
                </button>
              </div>

              {/* Printer bridge: make this USB printer a network printer.
                  The software equivalent of the printer's LAN card — Android
                  tills print to this PC's address on port 9100. */}
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: printerShareEnabled ? 'rgba(41,51,113,.12)' : 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
                    📡 {t('settings.printer.share')}
                  </span>
                  <button
                    onClick={togglePrinterShare}
                    disabled={!printer.printerName}
                    data-testid="toggle-printer-share"
                    style={{
                      width: 52, height: 28, borderRadius: 14, flexShrink: 0,
                      background: printerShareEnabled ? 'var(--color-primary)' : 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      cursor: printer.printerName ? 'pointer' : 'not-allowed', position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: printerShareEnabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {printerShareEnabled && shareIps.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.printer.shareHelp')}</div>
                    {shareIps.map((ip) => (
                      <div key={ip} style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)', marginTop: 4 }}>{ip}:9100</div>
                    ))}
                  </div>
                )}
                {shareError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-error)' }}>{shareError}</div>}
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>{t('settings.printer.shareNote')}</div>
              </div>
            </div>
          )}

          {/* Paper width — 80mm countertop vs 58mm compact rolls */}
          {printer.type !== 'none' && (
            <div>
              <label style={labelSt}>{t('settings.printer.paperWidth')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([80, 58] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => updatePrinter({ paperWidth: w })}
                    style={{
                      flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                      border: (printer.paperWidth ?? 80) === w ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      background: (printer.paperWidth ?? 80) === w ? 'var(--color-primary)' : 'var(--bg-input)',
                      color: (printer.paperWidth ?? 80) === w ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {w === 80 ? t('settings.printer.paper80') : t('settings.printer.paper58')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('settings.printer.paperWidthHelp')}
              </div>
            </div>
          )}

          {/* Cash drawer pin */}
          {printer.type !== 'none' && (
            <div>
              <label style={labelSt}>{t('settings.printer.drawerPin')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([1, 2] as const).map((pin) => (
                  <button
                    key={pin}
                    onClick={() => updatePrinter({ drawerPin: pin })}
                    style={{
                      flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                      border: (printer.drawerPin ?? 1) === pin ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                      background: (printer.drawerPin ?? 1) === pin ? 'var(--color-primary)' : 'var(--bg-input)',
                      color: (printer.drawerPin ?? 1) === pin ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {pin === 1 ? t('settings.printer.pin2') : t('settings.printer.pin5')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {t('settings.printer.pinHelp')}
              </div>
            </div>
          )}

          {/* Why a test failed — the exact spooler/socket message, so a
              field engineer can act instead of guessing. */}
          {hwError && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--border-radius)', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', color: 'var(--color-error)', fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>
              {hwError}
            </div>
          )}

          {/* Hardware tests: receipt print + cash drawer need the ESC/POS
              config; the label test prints via the OS/Android print dialog
              and works even with the receipt printer disabled. */}
          {printer.type !== 'none' && (
            <button
              onClick={testReceiptPrint}
              disabled={receiptTestStatus === 'testing'}
              data-testid="btn-test-receipt"
              style={testBtnSt(receiptTestStatus)}
            >
              {receiptTestStatus === 'testing' ? `⏳ ${t('settings.printer.testingPrint')}` :
               receiptTestStatus === 'ok'      ? `✓ ${t('settings.printer.printOk')}` :
               receiptTestStatus === 'error'   ? `✗ ${t('settings.printer.printError')}` :
               `🧾 ${t('settings.printer.testPrint')}`}
            </button>
          )}

          {printer.type !== 'none' && (
            <button
              onClick={testDrawer}
              disabled={drawerTestStatus === 'testing'}
              data-testid="btn-test-drawer"
              style={testBtnSt(drawerTestStatus)}
            >
              {drawerTestStatus === 'testing' ? `⏳ ${t('settings.printer.testingDrawer')}` :
               drawerTestStatus === 'ok'      ? `✓ ${t('settings.printer.drawerOpened')}` :
               drawerTestStatus === 'error'   ? `✗ ${t('settings.printer.drawerError')}` :
               `🗄 ${t('settings.printer.testDrawer')}`}
            </button>
          )}

          <button
            onClick={testLabelPrint}
            disabled={labelTestStatus === 'testing'}
            data-testid="btn-test-label"
            style={testBtnSt(labelTestStatus)}
          >
            {labelTestStatus === 'testing' ? `⏳ ${t('settings.printer.testingPrint')}` :
             labelTestStatus === 'ok'      ? `✓ ${t('settings.printer.labelOk')}` :
             labelTestStatus === 'error'   ? `✗ ${t('settings.printer.labelError')}` :
             `🏷 ${t('settings.printer.testLabel')}`}
          </button>

          {/* Info box */}
          <div style={{
            padding: '10px 14px', background: 'var(--bg-base)',
            borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)',
            fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            {platform === 'electron'
              ? t('settings.printer.helpElectron')
              : t('settings.printer.helpAndroid')}
          </div>
        </div>

        {/* ── Payments: card / PIN terminal ─────────────────────────────────── */}
        <div style={{ ...sectionSt, gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>
            💳 {t('settings.cardTerminal.title')}
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: '6px 0 12px' }}>
            {t('settings.cardTerminal.help')}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 620 }}>
            <div>
              <label style={labelSt}>{t('settings.cardTerminal.mode')}</label>
              <select value={cardTerminal.mode}
                onChange={(e) => setCardTerminal({ mode: e.target.value as 'manual' | 'simulated' })}
                style={selectSt}>
                <option value="manual">{t('settings.cardTerminal.modeManual')}</option>
                <option value="simulated">{t('settings.cardTerminal.modeSimulated')}</option>
                <option value="ecr" disabled>{t('settings.cardTerminal.modeEcr')}</option>
              </select>
            </div>
            {cardTerminal.mode === 'simulated' && (
              <div>
                <label style={labelSt}>{t('settings.cardTerminal.bank')}</label>
                <select value={cardTerminal.defaultBank}
                  onChange={(e) => setCardTerminal({ defaultBank: e.target.value })}
                  style={selectSt}>
                  {terminalBanks.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Weighed goods / scale barcodes ────────────────────────────────── */}
        <div style={{ ...sectionSt, gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, margin: 0 }}>
            ⚖ {t('settings.weighed.title')}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {t('settings.weighed.enable')}
            </span>
            <button
              onClick={() => { setEmbeddedBarcode({ enabled: !embeddedBarcode.enabled }); handleSave() }}
              style={{
                width: 52, height: 28, borderRadius: 14,
                background: embeddedBarcode.enabled ? 'var(--color-primary)' : 'var(--bg-input)',
                border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', top: 3, left: embeddedBarcode.enabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
          </div>

          {embeddedBarcode.enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelSt}>{t('settings.weighed.mode')}</label>
                <select
                  value={embeddedBarcode.mode}
                  onChange={(e) => { setEmbeddedBarcode({ mode: e.target.value as 'price' | 'weight', valueDivisor: e.target.value === 'price' ? 100 : 1000 }); handleSave() }}
                  style={{ height: 44, width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 'var(--font-size-sm)' }}
                >
                  <option value="price">{t('settings.weighed.modePrice')}</option>
                  <option value="weight">{t('settings.weighed.modeWeight')}</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('settings.weighed.prefix')}</label>
                <input
                  value={embeddedBarcode.prefix}
                  onChange={(e) => { setEmbeddedBarcode({ prefix: e.target.value.replace(/\D/g, '') }); }}
                  onBlur={handleSave} maxLength={2} inputMode="numeric"
                  style={{ height: 44, width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', color: 'var(--text-primary)', padding: '0 12px', fontSize: 'var(--font-size-base)', fontFamily: 'monospace' }}
                />
              </div>
            </div>
          )}

          <div style={{ padding: '10px 14px', background: 'var(--bg-base)', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t('settings.weighed.help')}
          </div>
        </div>

        {/* System actions (Manager+ on Electron only — hidden otherwise) */}
        <SystemActions />

      </div>
    </div>
  )
}
