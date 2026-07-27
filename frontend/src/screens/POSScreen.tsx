import { useState, useCallback, useEffect, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { holdBill } from '@/api/sales'
import { useOrgChannel } from '@/hooks/useEcho'
import { useToast } from '@/components/shared/Toast'
import ProductGrid from '@/components/pos/ProductGrid'
import CartPanel from '@/components/pos/CartPanel'
import TopBar from '@/components/pos/TopBar'
import OnScreenKeyboard from '@/components/pos/OnScreenKeyboard'
import PaymentModal from '@/components/pos/PaymentModal'
import ReceiptModal from '@/components/pos/ReceiptModal'
import HoldBillModal from '@/components/pos/HoldBillModal'

// Lazy-load secondary screens
const ReportsScreen       = lazy(() => import('./ReportsScreen'))
const ExchangeRateScreen  = lazy(() => import('./ExchangeRateScreen'))
const EndOfDayScreen      = lazy(() => import('./EndOfDayScreen'))
const SettingsScreen      = lazy(() => import('./SettingsScreen'))
const BarcodeLabelScreen  = lazy(() => import('./BarcodeLabelScreen'))
const SalesHistoryScreen  = lazy(() => import('./SalesHistoryScreen'))

type Screen = 'pos' | 'reports' | 'exchange-rate' | 'end-of-day' | 'settings' | 'labels' | 'history'

interface CompletedSale {
  saleId: string
  cashTendered: number
  change: number
}

export default function POSScreen() {
  const storeId = useSettingsStore((s) => s.storeId)!
  const user = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const clearCart = useCartStore((s) => s.clearCart)
  const toast = useToast()
  const { i18n } = useTranslation()
  const isNl = i18n.language === 'nl'

  // Subscribe to org channel: live product price updates + license warnings
  useOrgChannel(user?.organisation_id ?? null, qc, storeId)

  const items = useCartStore((s) => s.items)
  const customer = useCartStore((s) => s.customer)
  const totals = useCartStore((s) => s.totals)

  const [activeScreen, setActiveScreen] = useState<Screen>('pos')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [holdModalOpen, setHoldModalOpen] = useState(false)

  function handleSaleComplete(saleId: string, cashTendered: number, change: number) {
    setPaymentOpen(false)
    setCompletedSale({ saleId, cashTendered, change })
  }

  function handleNewSale() {
    setCompletedSale(null)
    clearCart()
  }

  const handleHoldBill = useCallback(async (label?: string) => {
    if (items.length === 0) return
    try {
      await holdBill({
        store_id: storeId,
        label: label?.trim() || undefined,   // optional — list falls back to hold time
        customer_id: customer?.id ?? null,
        cart_data: items,
        total_srd: parseFloat(totals.total),
      })
      clearCart()
      toast.success(isNl ? 'Bon geparkeerd' : 'Bill held')
    } catch (e: unknown) {
      // Previously this was silently swallowed — cashier thought the bill
      // was parked but it was lost. Always surface it so they can retry.
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(
        isNl
          ? `Kon bon niet parkeren: ${msg}`
          : `Could not hold bill: ${msg}`,
      )
    }
  }, [storeId, items, customer, totals, clearCart, toast, isNl])

  // ────── Cashier keyboard shortcuts ──────
  // Friday-evening cashiers cannot mouse-click for every action. Mirror
  // the SambaPOS / Loyverse muscle memory:
  //   F2  → Hold the active bill
  //   F4  → New sale (after a sale has just completed)
  //   F9  → Open payment modal (only when cart has items)
  //   F12 → Toggle on-screen keyboard
  //   Esc → Close payment / receipt / keyboard if open
  //
  // Skipped when focus is inside an <input>/<textarea>/<select> so the
  // numpad and search boxes still work as expected.
  useEffect(() => {
    function inEditable(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false
      const tag = t.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
    }
    function onKey(e: KeyboardEvent) {
      if (inEditable(e.target)) return
      // Only react on the POS view; secondary screens manage their own shortcuts.
      if (activeScreen !== 'pos' && e.key !== 'F12') return

      switch (e.key) {
        case 'F2':
          if (items.length > 0) { e.preventDefault(); setHoldModalOpen(true) }
          break
        case 'F4':
          if (completedSale) { e.preventDefault(); handleNewSale() }
          break
        case 'F9':
          if (items.length > 0 && !paymentOpen && !completedSale) {
            e.preventDefault(); setPaymentOpen(true)
          }
          break
        case 'F12':
          e.preventDefault(); setKeyboardOpen((v) => !v)
          break
        case 'Escape':
          if (paymentOpen) { e.preventDefault(); setPaymentOpen(false) }
          else if (completedSale) { e.preventDefault(); setCompletedSale(null) }
          else if (keyboardOpen) { e.preventDefault(); setKeyboardOpen(false) }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeScreen, items.length, paymentOpen, completedSale, keyboardOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <TopBar
        storeId={storeId}
        onNavigate={setActiveScreen}
        activeScreen={activeScreen}
        keyboardOpen={keyboardOpen}
        onToggleKeyboard={() => setKeyboardOpen((v) => !v)}
      />

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* POS sell screen */}
        <div style={{
          display: activeScreen === 'pos' ? 'flex' : 'none',
          height: '100%',
        }}>
          {/* Left: product grid */}
          <div style={{ flex: 1, overflow: 'hidden', paddingTop: 10 }}>
            <ProductGrid
              storeId={storeId}
              // A scan must not add a product behind an open dialog — the
              // cashier is counting cash or naming a held bill, not selling.
              scanEnabled={!paymentOpen && !holdModalOpen && !completedSale}
            />
          </div>

          {/* Right: cart */}
          <div style={{ width: 340, flexShrink: 0 }}>
            <CartPanel
              onCheckout={() => setPaymentOpen(true)}
              onHoldBill={() => { if (items.length > 0) setHoldModalOpen(true) }}
            />
          </div>
        </div>

        {/* Secondary screens */}
        {activeScreen !== 'pos' && (
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              Laden…
            </div>
          }>
            {activeScreen === 'reports'       && <ReportsScreen storeId={storeId} />}
            {activeScreen === 'exchange-rate' && <ExchangeRateScreen />}
            {activeScreen === 'end-of-day'   && <EndOfDayScreen storeId={storeId} />}
            {activeScreen === 'settings'     && <SettingsScreen />}
            {activeScreen === 'labels'       && <BarcodeLabelScreen />}
            {activeScreen === 'history'      && <SalesHistoryScreen storeId={storeId} />}
          </Suspense>
        )}
      </div>

      {/* Payment modal */}
      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        storeId={storeId}
        onSuccess={handleSaleComplete}
      />

      {/* Receipt modal */}
      {completedSale && (
        <ReceiptModal
          isOpen
          onClose={() => setCompletedSale(null)}
          saleId={completedSale.saleId}
          cashTendered={completedSale.cashTendered}
          change={completedSale.change}
          onNewSale={handleNewSale}
          onOpenSettings={() => { setCompletedSale(null); setActiveScreen('settings') }}
        />
      )}

      {/* Name-this-bill prompt before parking (Hold) */}
      <HoldBillModal
        isOpen={holdModalOpen}
        onClose={() => setHoldModalOpen(false)}
        onConfirm={(label) => handleHoldBill(label)}
      />

      {/* On-screen keyboard — floats above everything at the bottom */}
      {keyboardOpen && (
        <OnScreenKeyboard onClose={() => setKeyboardOpen(false)} />
      )}
    </div>
  )
}
