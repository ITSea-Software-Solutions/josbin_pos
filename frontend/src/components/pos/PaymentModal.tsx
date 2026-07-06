import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import { useCartStore } from '@/store/cartStore'
import { useSettingsStore } from '@/store/settingsStore'
import { createSale } from '@/api/sales'
import { getStore } from '@/api/stores'
import { openCashDrawer } from '@/lib/hardware'
import type { PaymentMethod } from '@/types/models'
import type { CreateSalePayload } from '@/api/sales'

interface PaymentModalProps {
  isOpen: boolean
  onClose: (() => void) | undefined
  storeId: string
  onSuccess: (saleId: string, cashTendered: number, change: number) => void
}

type Step = 'method' | 'cash' | 'card' | 'mixed' | 'bank_transfer' | 'mobile_transfer' | 'foreign_cash' | 'qr_payment'

const NUMPAD = ['7','8','9','4','5','6','1','2','3','','0','.']

export default function PaymentModal({ isOpen, onClose, storeId, onSuccess }: PaymentModalProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const items = useCartStore((s) => s.items)
  const totals = useCartStore((s) => s.totals)
  const saleDiscount = useCartStore((s) => s.saleDiscount)
  const customer = useCartStore((s) => s.customer)
  const clearCart = useCartStore((s) => s.clearCart)
  const qc = useQueryClient()

  const printer = useSettingsStore((s) => s.printer)

  const [step, setStep] = useState<Step>('method')
  const [cashInput, setCashInput] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [retrying, setRetrying] = useState(false)

  // Optional card reconciliation — copied from the bank's PIN terminal slip
  // so OA can match daily card sales to the bank settlement statement. All
  // four fields are skippable; cashier line stays fast. See migration
  // 2026_05_26_040001_add_card_reconciliation_to_sales.php for design.
  const [cardBank,         setCardBank]         = useState('')
  const [cardBankCustom,   setCardBankCustom]   = useState('')
  const [cardApproval,     setCardApproval]     = useState('')
  const [cardTerminalRef,  setCardTerminalRef]  = useState('')
  const [cardLastFour,     setCardLastFour]     = useState('')
  const effectiveBank = cardBank === 'Other' ? cardBankCustom.trim() : cardBank

  // Common Surinamese card issuers + the international brands accepted at
  // supermarkets. Free-text "Other" preserves new banks without a release.
  const BANKS = ['DSB', 'Hakrinbank', 'Finabank', 'RBC', 'Republic', 'Visa', 'Mastercard', 'Other'] as const
  // Phase 2 — banks for bank_transfer (a subset; no card brands).
  const TRANSFER_BANKS = ['DSB', 'Hakrinbank', 'Finabank', 'RBC', 'Republic', 'Other'] as const
  // Mobile-banking apps used in Suriname; "Other" for emerging providers.
  const MOBILE_APPS = ['DSB Mobiel', 'Hakrinbank Online', 'Finabank App', 'RBC Mobile', 'Republic Mobile', 'Other'] as const
  // Phase 3 — QR wallets accepted at Suriname supermarkets. Mopé (Hakrinbank)
  // and Uni5Pay+ (Southern Commercial Bank) both confirm on the merchant
  // device in real time; "Other" catches new wallets without a release.
  const WALLETS = ['Mopé', 'Uni5Pay+', 'Other'] as const

  // Phase 2 state — kept separate from card state since the workflows differ.
  const [transferProvider,   setTransferProvider]   = useState('')
  const [transferProviderCustom, setTransferProviderCustom] = useState('')
  const [transferReference,  setTransferReference]  = useState('')
  const [transferSenderName, setTransferSenderName] = useState('')
  const [mobileProvider,   setMobileProvider]   = useState('')
  const [mobileProviderCustom, setMobileProviderCustom] = useState('')
  const [mobileReference,  setMobileReference]  = useState('')
  const [foreignCurrency, setForeignCurrency] = useState<'USD' | 'EUR'>('USD')
  const [foreignAmount,   setForeignAmount]   = useState('')
  // Phase 3 QR wallet state. walletConfirmed defaults to true because the
  // wallet notifies the merchant device instantly at the counter — the
  // cashier only unticks it when the notification is delayed, which parks
  // the sale in the OA confirmation queue instead.
  const [walletProvider,       setWalletProvider]       = useState('')
  const [walletProviderCustom, setWalletProviderCustom] = useState('')
  const [walletReference,      setWalletReference]      = useState('')
  const [walletConfirmed,      setWalletConfirmed]      = useState(true)
  const [showMore, setShowMore] = useState(false)

  // Store settings carry the static merchant QR images (Mopé / Uni5Pay+)
  // uploaded via Dashboard → Store settings. Fetched once per modal open so
  // the QR step can show the code full-size for the customer to scan.
  const { data: storeData } = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    enabled: isOpen,
    staleTime: 5 * 60_000,
  })
  const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/api$/, '')
  const walletQrPath = (storeData?.settings?.wallet_qrs ?? {})[walletProvider]
  const walletQrUrl = walletQrPath
    ? (walletQrPath.startsWith('http') ? walletQrPath : `${API_ORIGIN}/storage/${walletQrPath}`)
    : null

  const effectiveTransferProvider = transferProvider === 'Other' ? transferProviderCustom.trim() : transferProvider
  const effectiveMobileProvider   = mobileProvider   === 'Other' ? mobileProviderCustom.trim()   : mobileProvider
  const effectiveWalletProvider   = walletProvider   === 'Other' ? walletProviderCustom.trim()   : walletProvider

  // Stable idempotency key for this checkout attempt. Resets whenever the
  // modal is reopened or after a successful sale so the *next* sale gets a
  // fresh key. Reusing the key on rate-limit retries makes the backend
  // return the existing sale instead of creating a duplicate.
  const saleRefRef = useRef<string>('')
  useEffect(() => {
    if (isOpen && !saleRefRef.current) {
      saleRefRef.current = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    }
    if (!isOpen) {
      saleRefRef.current = ''
      // Wipe recon scratch so the next sale doesn't inherit yesterday's bank.
      setCardBank(''); setCardBankCustom(''); setCardApproval(''); setCardTerminalRef(''); setCardLastFour('')
      setTransferProvider(''); setTransferProviderCustom(''); setTransferReference(''); setTransferSenderName('')
      setMobileProvider(''); setMobileProviderCustom(''); setMobileReference('')
      setForeignCurrency('USD'); setForeignAmount('')
      setWalletProvider(''); setWalletProviderCustom(''); setWalletReference(''); setWalletConfirmed(true)
      setShowMore(false)
    }
  }, [isOpen])

  const total = parseFloat(totals.total)

  const cashTendered = parseFloat(cashInput) || 0
  const cardAmt = parseFloat(cardAmount) || 0
  const mixedCashAmt = Math.max(0, total - cardAmt)
  const change = Math.max(0, cashTendered - total)

  function getErrorMessage(err: unknown): string {
    const status = (err as any)?.response?.status
    if (status === 429) return t('errors.tooBusyGiveUp')
    const res = (err as any)?.response
    if (res?.data?.message) return res.data.message
    if (res?.data?.errors) {
      const first = Object.values(res.data.errors as Record<string, string[]>)[0]
      if (Array.isArray(first)) return first[0]
    }
    return t('errors.serverError')
  }

  const saleMutation = useMutation({
    // Auto-retry on nginx rate-limit (429): the bucket refills at ~2/s so a
    // 1.5s backoff is enough. We use external_sale_ref as the idempotency
    // key so the second attempt resolves to the same sale, not a duplicate.
    mutationFn: async (payload: CreateSalePayload) => {
      try {
        return await createSale(payload)
      } catch (err) {
        const status = (err as any)?.response?.status
        if (status !== 429) throw err
        setRetrying(true)
        await new Promise((r) => setTimeout(r, 1500))
        try {
          return await createSale(payload)
        } finally {
          setRetrying(false)
        }
      }
    },
    onSuccess: (sale) => {
      qc.invalidateQueries({ queryKey: ['today-summary', storeId] })
      // Only cash and mixed involve physical cash — every other method
      // (card, transfers, QR wallet, foreign handled separately) must report
      // zero tendered/change or the confirmation screen invites the cashier
      // to hand out "change" for a fully-paid wallet sale.
      const tendered = step === 'cash' ? cashTendered : step === 'mixed' ? mixedCashAmt : 0
      const chg = step === 'cash' ? change : step === 'mixed' ? Math.max(0, mixedCashAmt - cardAmt) : 0

      // Auto-open cash drawer on cash or mixed payment
      if ((step === 'cash' || step === 'mixed') && printer.type !== 'none') {
        openCashDrawer(printer).catch(() => {
          // Drawer failure is non-fatal — sale is already recorded
        })
      }

      // Burn the idempotency key so the *next* sale gets a fresh one
      saleRefRef.current = ''
      clearCart()
      onSuccess(sale.id, tendered, chg)
    },
  })

  function buildPayload(method: PaymentMethod, skipRecon = false): CreateSalePayload {
    // skipRecon = the "Skip & complete" button: still a card sale, but send
    // NONE of the reconciliation fields even if the cashier started typing.
    const isCardSide = (method === 'card' || method === 'mixed') && !skipRecon
    const isTransfer = method === 'bank_transfer' || method === 'mobile_transfer'
    const isQr = method === 'qr_payment'
    const transferProviderForMethod = method === 'bank_transfer'
      ? effectiveTransferProvider
      : method === 'mobile_transfer' ? effectiveMobileProvider
      : isQr ? effectiveWalletProvider : ''
    const transferReferenceForMethod = method === 'bank_transfer'
      ? transferReference
      : method === 'mobile_transfer' ? mobileReference
      : isQr ? walletReference : ''
    return {
      store_id: storeId,
      customer_id: customer?.id ?? null,
      payment_method: method,
      external_sale_ref: saleRefRef.current || undefined,
      cash_tendered: method === 'cash' ? cashTendered : method === 'mixed' ? mixedCashAmt : undefined,
      card_amount: method === 'card' ? total : method === 'mixed' ? cardAmt : undefined,
      // Optional reconciliation — only send when on card/mixed AND the field
      // is filled. Backend nulls anything inappropriate (cash sales etc).
      card_bank:          isCardSide && effectiveBank   ? effectiveBank   : undefined,
      card_approval_code: isCardSide && cardApproval    ? cardApproval    : undefined,
      card_terminal_ref:  isCardSide && cardTerminalRef ? cardTerminalRef : undefined,
      card_last_four:     isCardSide && cardLastFour    ? cardLastFour    : undefined,
      // Phase 2/3 transfer/wallet/foreign fields. Backend nulls them when method doesn't match.
      payment_provider:    (isTransfer || isQr) ? transferProviderForMethod || undefined : undefined,
      payment_reference:   (isTransfer || isQr) ? transferReferenceForMethod.trim() || undefined : undefined,
      payment_sender_name: method === 'bank_transfer' && transferSenderName ? transferSenderName : undefined,
      foreign_currency:    method === 'foreign_cash' ? foreignCurrency : undefined,
      foreign_amount:      method === 'foreign_cash' && foreignAmount ? parseFloat(foreignAmount) : undefined,
      // QR wallets confirm on the merchant device at the till — when the
      // cashier attests receipt the backend stamps the confirmation instead
      // of parking the sale in the OA pending queue.
      payment_confirmed:   isQr ? walletConfirmed : undefined,
      sale_discount_srd: saleDiscount.type === 'fixed' && saleDiscount.value > 0 ? saleDiscount.value : undefined,
      sale_discount_pct: saleDiscount.type === 'percent' && saleDiscount.value > 0 ? saleDiscount.value : undefined,
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name_nl,
        unit_price: parseFloat(i.computed.unitPrice),
        quantity: i.quantity,
        btw_rate: parseFloat(i.btwRateOverride ?? i.product.btw_rate),
        btw_exempt: i.product.btw_exempt,
        discount_srd: parseFloat(i.computed.discountAmount) > 0 ? parseFloat(i.computed.discountAmount) : undefined,
      })),
    }
  }

  function handleComplete(method: PaymentMethod, skipRecon = false) {
    saleMutation.mutate(buildPayload(method, skipRecon))
  }

  function numpadPress(val: string) {
    const target = step === 'mixed' ? setCardAmount : setCashInput
    const current = step === 'mixed' ? cardAmount : cashInput
    if (val === '' ) return  // empty cell in numpad
    if (val === '.' && current.includes('.')) return
    if (current === '0' && val !== '.') { target(val); return }
    if (current.includes('.') && current.split('.')[1].length >= 2) return
    target(current + val)
  }

  function numpadDel() {
    const target = step === 'mixed' ? setCardAmount : setCashInput
    const current = step === 'mixed' ? cardAmount : cashInput
    target(current.slice(0, -1))
  }

  function quickCash(amount: number) {
    setCashInput(amount.toFixed(2))
  }

  const isProcessing = saleMutation.isPending

  return (
    <Modal isOpen={isOpen} onClose={isProcessing ? undefined : onClose} title={t('pos.payment.title')} width={400} persistent={isProcessing}>
      {step === 'method' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Total due */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
            padding: '16px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('pos.payment.amountDue')}
            </div>
            <div className="currency-srd" style={{ fontSize: 36, fontWeight: 800, color: 'var(--color-total)' }}>
              SRD {totals.total}
            </div>
          </div>

          {/* Method buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'cash', label: t('pos.payment.cash'), icon: '💵', action: () => { setCashInput(''); setStep('cash') } },
              // Card flow goes to its own step so the cashier can capture
              // bank reconciliation details from the PIN terminal slip.
              // The step's "Skip & complete" button still lets them blast
              // through if the bank slip isn't out yet.
              { key: 'card', label: t('pos.payment.card'), icon: '💳', action: () => setStep('card') },
              { key: 'mixed', label: t('pos.payment.mixed'), icon: '🔀', action: () => { setCardAmount(''); setStep('mixed') } },
              // QR wallets (Mopé / Uni5Pay+) are an everyday till method at
              // Suriname supermarkets — top-level, not behind the expander.
              { key: 'qr_payment', label: t('pos.payment.qrWallet'), icon: '🔳', action: () => setStep('qr_payment') },
            ].concat(showMore ? [
              { key: 'bank_transfer',   label: t('pos.payment.bankTransfer'),   icon: '🏦', action: () => setStep('bank_transfer') },
              { key: 'mobile_transfer', label: t('pos.payment.mobileTransfer'), icon: '📱', action: () => setStep('mobile_transfer') },
              { key: 'foreign_cash',    label: t('pos.payment.foreignCash'),    icon: '💱', action: () => setStep('foreign_cash') },
            ] : []).map((m) => (
              <button
                key={m.key}
                onClick={m.action}
                disabled={isProcessing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 'var(--font-size-base)', fontWeight: 600,
                  transition: 'border-color 0.12s',
                  height: 'var(--touch-target-xl)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <span style={{ fontSize: 24 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Expander for the less-common Suriname payment methods. Kept
              behind a click so the cash/card/mixed line stays fast at the
              till. Cashiers ringing up B2B / govt / tourist sales tap once
              to reveal bank_transfer + mobile_transfer + foreign_cash. */}
          <button onClick={() => setShowMore((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', padding: '4px 0' }}>
            {showMore ? `▲ ${t('pos.payment.lessMethods')}` : `▼ ${t('pos.payment.moreMethods')}`}
          </button>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {getErrorMessage(saleMutation.error)}
            </div>
          )}
        </div>
      )}

      {step === 'card' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>← {t('app.back')}</button>

          {/* Total — confirms the card amount we're about to charge */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              💳 {t('pos.payment.cardAmount')}
            </span>
            <span className="currency-srd" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-total)' }}>
              SRD {totals.total}
            </span>
          </div>

          {/* Reconciliation panel — optional. Helps OA reconcile the day's
              card sales against the bank settlement statement. Cashier can
              skip via the "Skip & complete" button below. */}
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>
              📋 {t('pos.payment.cardReconTitle')}
            </div>

            {/* Bank dropdown */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.cardBank')}</label>
              <select value={cardBank} onChange={(e) => setCardBank(e.target.value)}
                style={{ width: '100%', height: 36, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', cursor: 'pointer' }}>
                <option value="">— {t('pos.payment.cardBankPick')} —</option>
                {BANKS.map((b) => <option key={b} value={b}>{b === 'Other' ? t('pos.payment.cardBankOther') : b}</option>)}
              </select>
              {cardBank === 'Other' && (
                <input
                  value={cardBankCustom}
                  onChange={(e) => setCardBankCustom(e.target.value)}
                  placeholder={t('pos.payment.cardBankCustomPlaceholder')}
                  maxLength={32}
                  style={{ marginTop: 6, width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Approval code + last 4 — side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.cardApprovalCode')}</label>
                <input value={cardApproval} onChange={(e) => setCardApproval(e.target.value)} maxLength={16}
                  placeholder="A12345"
                  style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.cardLastFour')}</label>
                <input value={cardLastFour}
                  onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric" maxLength={4} placeholder="1234"
                  style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '2px' }}
                />
              </div>
            </div>

            {/* Terminal ref — less common, smaller field */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {t('pos.payment.cardTerminalRef')} <span style={{ opacity: .6 }}>({t('pos.payment.optional')})</span>
              </label>
              <input value={cardTerminalRef} onChange={(e) => setCardTerminalRef(e.target.value)} maxLength={32}
                placeholder="TRM-2026-05-26-001"
                style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            {t('pos.payment.cardReconHelp')}
          </p>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {getErrorMessage(saleMutation.error)}
            </div>
          )}

          {/* Two completion paths: "Skip & complete" sends none of the recon
              fields (still records as payment_method='card'); "Complete with
              details" sends whatever is filled. */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleComplete('card', true)}
              disabled={isProcessing}
              style={{
                flex: 1, height: 'var(--touch-target-xl)',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                cursor: isProcessing ? 'wait' : 'pointer',
                fontWeight: 600,
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {t('pos.payment.cardSkipDetails')}
            </button>
            <button
              onClick={() => handleComplete('card')}
              disabled={isProcessing}
              style={{
                flex: 1.2, height: 'var(--touch-target-xl)',
                borderRadius: 'var(--border-radius)',
                border: 'none',
                background: 'var(--color-primary)',
                color: '#fff',
                cursor: isProcessing ? 'wait' : 'pointer',
                fontWeight: 700,
                fontSize: 'var(--font-size-base)',
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              {retrying ? t('errors.tooBusy') : isProcessing ? t('pos.payment.processing') : t('pos.payment.cardConfirm')}
            </button>
          </div>
        </div>
      )}

      {step === 'bank_transfer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>← {t('app.back')}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>🏦 {t('pos.payment.bankTransfer')}</span>
            <span className="currency-srd" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-total)' }}>SRD {totals.total}</span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('pos.payment.transferHelp')}
          </p>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.transferBank')} *</label>
            <select value={transferProvider} onChange={(e) => setTransferProvider(e.target.value)}
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px' }}>
              <option value="">— {t('pos.payment.cardBankPick')} —</option>
              {TRANSFER_BANKS.map((b) => <option key={b} value={b}>{b === 'Other' ? t('pos.payment.cardBankOther') : b}</option>)}
            </select>
            {transferProvider === 'Other' && (
              <input value={transferProviderCustom} onChange={(e) => setTransferProviderCustom(e.target.value)}
                placeholder={t('pos.payment.cardBankCustomPlaceholder')} maxLength={64}
                style={{ marginTop: 6, width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.transferReference')} *</label>
            <input value={transferReference} onChange={(e) => setTransferReference(e.target.value)} maxLength={64}
              placeholder="REF-2026-05-26-001"
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('pos.payment.transferSenderName')} <span style={{ opacity: .6 }}>({t('pos.payment.optional')})</span>
            </label>
            <input value={transferSenderName} onChange={(e) => setTransferSenderName(e.target.value)} maxLength={120}
              placeholder={t('pos.payment.transferSenderPlaceholder')}
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }} />
          </div>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{getErrorMessage(saleMutation.error)}</div>
          )}

          <button
            onClick={() => handleComplete('bank_transfer')}
            disabled={isProcessing || !effectiveTransferProvider || !transferReference.trim()}
            style={{
              height: 'var(--touch-target-xl)', borderRadius: 'var(--border-radius)', border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || !effectiveTransferProvider || !transferReference.trim()) ? 0.5 : 1,
            }}>
            {isProcessing ? t('pos.payment.processing') : `✓ ${t('pos.payment.recordTransfer')}`}
          </button>
        </div>
      )}

      {step === 'mobile_transfer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>← {t('app.back')}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>📱 {t('pos.payment.mobileTransfer')}</span>
            <span className="currency-srd" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-total)' }}>SRD {totals.total}</span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('pos.payment.transferHelp')}
          </p>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.mobileApp')} *</label>
            <select value={mobileProvider} onChange={(e) => setMobileProvider(e.target.value)}
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px' }}>
              <option value="">— {t('pos.payment.mobileAppPick')} —</option>
              {MOBILE_APPS.map((a) => <option key={a} value={a}>{a === 'Other' ? t('pos.payment.cardBankOther') : a}</option>)}
            </select>
            {mobileProvider === 'Other' && (
              <input value={mobileProviderCustom} onChange={(e) => setMobileProviderCustom(e.target.value)}
                placeholder={t('pos.payment.mobileAppCustomPlaceholder')} maxLength={64}
                style={{ marginTop: 6, width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.mobileReference')} *</label>
            <input value={mobileReference} onChange={(e) => setMobileReference(e.target.value)} maxLength={64}
              placeholder="TX-998877"
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{getErrorMessage(saleMutation.error)}</div>
          )}

          <button
            onClick={() => handleComplete('mobile_transfer')}
            disabled={isProcessing || !effectiveMobileProvider || !mobileReference.trim()}
            style={{
              height: 'var(--touch-target-xl)', borderRadius: 'var(--border-radius)', border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || !effectiveMobileProvider || !mobileReference.trim()) ? 0.5 : 1,
            }}>
            {isProcessing ? t('pos.payment.processing') : `✓ ${t('pos.payment.recordTransfer')}`}
          </button>
        </div>
      )}

      {step === 'qr_payment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>← {t('app.back')}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>🔳 {t('pos.payment.qrWallet')}</span>
            <span className="currency-srd" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-total)' }}>SRD {totals.total}</span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('pos.payment.qrWalletHelp')}
          </p>

          {/* The store's static merchant QR, shown once a wallet is picked so
              the customer can scan straight from the POS screen. Static QRs
              carry no amount — the shopper types the amount in the app, which
              is why the total is repeated right under the code. */}
          {walletProvider && walletProvider !== 'Other' && (
            walletQrUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 0 4px', background: '#fff', borderRadius: 'var(--border-radius)' }}>
                <img src={walletQrUrl} alt={`${walletProvider} QR`} style={{ width: 180, height: 180, objectFit: 'contain' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: '#16203a', paddingBottom: 8, textAlign: 'center' }}>
                  {t('pos.payment.qrScanInstruction')}<br />
                  <span style={{ fontSize: 18, fontWeight: 800 }}>SRD {totals.total}</span>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--color-warning, #b45309)', margin: 0 }}>
                {t('pos.payment.qrNoImage', { wallet: walletProvider })}
              </p>
            )
          )}

          {/* Wallet picker — big touch chips, not a dropdown: two wallets
              cover the whole market so chips are one tap instead of three. */}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.walletPick')} *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {WALLETS.map((w) => (
                <button key={w} onClick={() => setWalletProvider(w)}
                  style={{
                    flex: 1, height: 44, borderRadius: 'var(--border-radius)',
                    border: `2px solid ${walletProvider === w ? 'var(--color-primary)' : 'var(--border-color)'}`,
                    background: walletProvider === w ? 'var(--color-primary)' : 'var(--bg-elevated)',
                    color: walletProvider === w ? '#fff' : 'var(--text-primary)',
                    cursor: 'pointer', fontWeight: 700, fontSize: 'var(--font-size-sm)',
                  }}>
                  {w === 'Other' ? t('pos.payment.cardBankOther') : w}
                </button>
              ))}
            </div>
            {walletProvider === 'Other' && (
              <input value={walletProviderCustom} onChange={(e) => setWalletProviderCustom(e.target.value)}
                placeholder={t('pos.payment.walletCustomPlaceholder')} maxLength={64}
                style={{ marginTop: 6, width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }}
              />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {t('pos.payment.walletReference')} <span style={{ opacity: .6 }}>({t('pos.payment.optional')})</span>
            </label>
            <input value={walletReference} onChange={(e) => setWalletReference(e.target.value)} maxLength={64}
              placeholder="MP-2026-000123"
              style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          </div>

          {/* Confirmation attestation — checked = wallet showed "payment
              received" on the merchant device, sale completes confirmed.
              Unchecked = record as awaiting confirmation for the OA queue. */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)', cursor: 'pointer' }}>
            <input type="checkbox" checked={walletConfirmed} onChange={(e) => setWalletConfirmed(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer', marginTop: 1 }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.35 }}>
              {t('pos.payment.walletConfirmed')}
              {!walletConfirmed && (
                <span style={{ display: 'block', fontSize: 11, color: 'var(--color-warning, #b45309)', marginTop: 4 }}>
                  {t('pos.payment.walletPendingNote')}
                </span>
              )}
            </span>
          </label>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{getErrorMessage(saleMutation.error)}</div>
          )}

          <button
            onClick={() => handleComplete('qr_payment')}
            disabled={isProcessing || !effectiveWalletProvider}
            style={{
              height: 'var(--touch-target-xl)', borderRadius: 'var(--border-radius)', border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || !effectiveWalletProvider) ? 0.5 : 1,
            }}>
            {isProcessing ? t('pos.payment.processing') : `✓ ${t('pos.payment.recordQr')}`}
          </button>
        </div>
      )}

      {step === 'foreign_cash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}>← {t('app.back')}</button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)' }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>💱 {t('pos.payment.foreignCash')}</span>
            <span className="currency-srd" style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-total)' }}>SRD {totals.total}</span>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {t('pos.payment.foreignCashHelp')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.foreignCurrency')}</label>
              <select value={foreignCurrency} onChange={(e) => setForeignCurrency(e.target.value as 'USD' | 'EUR')}
                style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', fontWeight: 700 }}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('pos.payment.foreignAmount')} *</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={foreignAmount}
                onChange={(e) => setForeignAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', height: 38, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace', textAlign: 'right' }} />
            </div>
          </div>

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>{getErrorMessage(saleMutation.error)}</div>
          )}

          <button
            onClick={() => handleComplete('foreign_cash')}
            disabled={isProcessing || !foreignAmount || parseFloat(foreignAmount) <= 0}
            style={{
              height: 'var(--touch-target-xl)', borderRadius: 'var(--border-radius)', border: 'none',
              background: 'var(--color-primary)', color: '#fff', cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700, fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || !foreignAmount || parseFloat(foreignAmount) <= 0) ? 0.5 : 1,
            }}>
            {isProcessing ? t('pos.payment.processing') : `✓ ${t('pos.payment.complete')}`}
          </button>
        </div>
      )}

      {(step === 'cash' || step === 'mixed') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setStep('method')} style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>← {t('app.back')}</button>

          {/* Amount due */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
          }}>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {step === 'mixed' ? t('pos.payment.cardAmount') : t('pos.payment.amountDue')}
            </span>
            <span className="currency-srd" style={{ fontWeight: 700, color: 'var(--color-total)' }}>
              SRD {step === 'mixed' ? (total - (parseFloat(cardAmount) || 0)).toFixed(2) : totals.total}
            </span>
          </div>

          {/* Display */}
          <div style={{
            textAlign: 'right', padding: '10px 16px',
            background: 'var(--bg-input)', borderRadius: 'var(--border-radius)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
              {step === 'mixed' ? t('pos.payment.cardAmount') : t('pos.payment.cashReceived')}
            </div>
            <div className="currency-srd" style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>
              SRD {(step === 'mixed' ? cardAmount : cashInput) || '0'}
            </div>
          </div>

          {/* Split presets — one tap sets the card portion; cash is the remainder. */}
          {step === 'mixed' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: isNl ? 'Kaart 50%' : 'Card 50%', pct: 0.5 },
                { label: isNl ? 'Kaart 70%' : 'Card 70%', pct: 0.7 },
                { label: isNl ? 'Kaart 30%' : 'Card 30%', pct: 0.3 },
              ].map((p) => (
                <button key={p.pct} type="button"
                  onClick={() => setCardAmount((total * p.pct).toFixed(2))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 600, cursor: 'pointer' }}>
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {step === 'cash' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{t('pos.payment.change')}</span>
              <span className="currency-srd" style={{ fontWeight: 700, color: change >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                SRD {change.toFixed(2)}
              </span>
            </div>
          )}

          {/* Quick amounts (cash only) */}
          {step === 'cash' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[total, Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i).slice(0,6).map((amt) => (
                <button
                  key={amt}
                  onClick={() => quickCash(amt)}
                  style={{
                    flex: '1 1 auto', height: 36, borderRadius: 'var(--border-radius)',
                    border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                  }}
                >
                  {amt.toFixed(0)}
                </button>
              ))}
            </div>
          )}

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {NUMPAD.map((k, i) => (
              k === '' ? <div key={i} /> :
              <button
                key={i}
                onClick={() => numpadPress(k)}
                style={{
                  height: 52, borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)', cursor: 'pointer',
                  fontSize: 'var(--font-size-lg)', fontWeight: 600,
                }}
              >
                {k}
              </button>
            ))}
            <button
              onClick={numpadDel}
              style={{
                height: 52, borderRadius: 'var(--border-radius)',
                border: '1px solid var(--border-color)', background: 'var(--bg-elevated)',
                color: 'var(--text-muted)', cursor: 'pointer', fontSize: 'var(--font-size-base)',
              }}
            >
              ⌫
            </button>
          </div>

          {/* Optional reconciliation — only meaningful on mixed payments
              (cash step never carries card data). Collapsed by default to
              keep the cash flow fast; expand on demand from the bank slip. */}
          {step === 'mixed' && cardAmt > 0 && (
            <details style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: '8px 12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>
                📋 {t('pos.payment.cardReconTitle')}
              </summary>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select value={cardBank} onChange={(e) => setCardBank(e.target.value)}
                  style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px' }}>
                  <option value="">— {t('pos.payment.cardBankPick')} —</option>
                  {BANKS.map((b) => <option key={b} value={b}>{b === 'Other' ? t('pos.payment.cardBankOther') : b}</option>)}
                </select>
                {cardBank === 'Other' && (
                  <input value={cardBankCustom} onChange={(e) => setCardBankCustom(e.target.value)}
                    placeholder={t('pos.payment.cardBankCustomPlaceholder')} maxLength={32}
                    style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box' }}
                  />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                  <input value={cardApproval} onChange={(e) => setCardApproval(e.target.value)} maxLength={16}
                    placeholder={t('pos.payment.cardApprovalCode')}
                    style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace' }}
                  />
                  <input value={cardLastFour}
                    onChange={(e) => setCardLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric" maxLength={4} placeholder={t('pos.payment.cardLastFour')}
                    style={{ width: '100%', height: 34, borderRadius: 'var(--border-radius)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', padding: '0 10px', boxSizing: 'border-box', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '2px' }}
                  />
                </div>
              </div>
            </details>
          )}

          {saleMutation.isError && (
            <div style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {getErrorMessage(saleMutation.error)}
            </div>
          )}

          {/* Complete button */}
          <button
            onClick={() => handleComplete(step === 'cash' ? 'cash' : 'mixed')}
            disabled={
              isProcessing ||
              (step === 'cash' && cashTendered < total) ||
              (step === 'mixed' && cardAmt <= 0)
            }
            style={{
              height: 'var(--touch-target-xl)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: isProcessing ? 'wait' : 'pointer',
              fontWeight: 700,
              fontSize: 'var(--font-size-base)',
              opacity: (isProcessing || (step === 'cash' && cashTendered < total) || (step === 'mixed' && cardAmt <= 0)) ? 0.5 : 1,
            }}
          >
            {retrying ? t('errors.tooBusy') : isProcessing ? t('pos.payment.processing') : t('pos.payment.complete')}
          </button>
        </div>
      )}
    </Modal>
  )
}
