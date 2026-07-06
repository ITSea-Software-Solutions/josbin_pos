import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/store/settingsStore'
import { listPrinters, openCashDrawer, detectPlatform } from '@/lib/hardware'
import type { ProductDisplay } from '@/store/settingsStore'
import type { PrinterConfig } from '@/lib/hardware'
import { SystemActions } from '@/components/settings/SystemActions'
import HelpButton from '@/components/shared/HelpButton'

const DATE_FORMATS = ['DD-MM-YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'D MMMM YYYY', 'D MMM YYYY', 'DD/MM/YY']

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

  const platform = detectPlatform()
  const [saved, setSaved] = useState(false)
  const [windowsPrinters, setWindowsPrinters] = useState<string[]>([])
  const [drawerTestStatus, setDrawerTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function loadWindowsPrinters() {
    const list = await listPrinters()
    setWindowsPrinters(list.map((p) => p.name))
  }

  async function testDrawer() {
    setDrawerTestStatus('testing')
    const result = await openCashDrawer(printer)
    setDrawerTestStatus(result.success ? 'ok' : 'error')
    setTimeout(() => setDrawerTestStatus('idle'), 3000)
  }

  function updatePrinter(patch: Partial<PrinterConfig>) {
    setPrinter({ ...printer, ...patch })
    handleSave()
  }

  function toggleLanguage(locale: 'nl' | 'en') {
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
            {(['nl', 'en'] as const).map((lang) => (
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
                {lang === 'nl' ? '🇳🇱 Nederlands' : '🇬🇧 English'}
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

          {/* Connection type */}
          <div>
            <label style={labelSt}>{t('settings.printer.type')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['none', 'network', 'usb'] as const).map((type) => (
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

          {/* Test cash drawer button */}
          {printer.type !== 'none' && (
            <button
              onClick={testDrawer}
              disabled={drawerTestStatus === 'testing'}
              data-testid="btn-test-drawer"
              style={{
                height: 44, borderRadius: 'var(--border-radius)',
                border: `1px solid ${drawerTestStatus === 'ok' ? 'var(--color-success)' : drawerTestStatus === 'error' ? 'var(--color-error)' : 'var(--border-color)'}`,
                background: 'var(--bg-elevated)',
                color: drawerTestStatus === 'ok' ? 'var(--color-success)' : drawerTestStatus === 'error' ? 'var(--color-error)' : 'var(--text-primary)',
                cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
              }}
            >
              {drawerTestStatus === 'testing' ? `⏳ ${t('settings.printer.testingDrawer')}` :
               drawerTestStatus === 'ok'      ? `✓ ${t('settings.printer.drawerOpened')}` :
               drawerTestStatus === 'error'   ? `✗ ${t('settings.printer.drawerError')}` :
               `🗄 ${t('settings.printer.testDrawer')}`}
            </button>
          )}

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
                  {['DSB', 'Hakrinbank', 'Finabank', 'RBC', 'Republic'].map((b) => <option key={b} value={b}>{b}</option>)}
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
