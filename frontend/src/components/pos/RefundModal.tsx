import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/shared/Modal'
import QuickReasonChips from './QuickReasonChips'
import { getSale, refundSale } from '@/api/sales'
import type { Sale, SaleItem } from '@/types/models'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale
}

type RowState = Record<string, { selected: boolean; quantity: string }>

interface RefundResult {
  saleNumber: string
  totalSrd: string
}

function buildInitialRows(items: SaleItem[]): RowState {
  const out: RowState = {}
  for (const it of items) {
    if (!it.id) continue
    out[it.id] = { selected: false, quantity: it.quantity }
  }
  return out
}

function formatCurrency(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return '0.00'
  return Math.abs(n).toFixed(2)
}

export default function RefundModal({ isOpen, onClose, sale }: RefundModalProps) {
  const { t, i18n } = useTranslation()
  const isNl = i18n.language === 'nl'
  const qc = useQueryClient()

  // Always re-fetch the full sale (with items) when the modal opens so we have
  // sale_item ids and current quantities. The list endpoint omits items.
  const { data: fullSale, isLoading: loadingSale } = useQuery({
    queryKey: ['sale-detail', sale.id],
    queryFn: () => getSale(sale.id),
    enabled: isOpen,
  })

  const items = fullSale?.items ?? []

  const [rows, setRows] = useState<RowState>({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<RefundResult | null>(null)

  // Initialise rows once items arrive
  useMemo(() => {
    if (items.length && Object.keys(rows).length === 0 && !result) {
      setRows(buildInitialRows(items))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  function getErrorMessage(err: unknown): string {
    const e = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } }
    const status = e?.response?.status
    if (status === 429) return t('errors.tooBusyGiveUp')
    const res = e?.response
    if (res?.data?.message) return res.data.message
    if (res?.data?.errors) {
      const first = Object.values(res.data.errors)[0]
      if (Array.isArray(first)) return first[0]
    }
    return t('errors.serverError')
  }

  const computedTotal = useMemo(() => {
    let total = 0
    for (const it of items) {
      if (!it.id) continue
      const row = rows[it.id]
      if (!row?.selected) continue
      const qty = parseFloat(row.quantity) || 0
      const origQty = parseFloat(it.quantity) || 0
      if (qty <= 0 || origQty <= 0) continue
      const ratio = Math.min(qty / origQty, 1)
      const lineTotal = parseFloat(it.line_total_srd) || 0
      total += Math.abs(lineTotal) * ratio
    }
    return total
  }, [items, rows])

  const selectedPayload = useMemo(() => {
    const out: Array<{ sale_item_id: string; quantity: number }> = []
    for (const it of items) {
      if (!it.id) continue
      const row = rows[it.id]
      if (!row?.selected) continue
      const qty = parseFloat(row.quantity) || 0
      if (qty > 0) {
        out.push({ sale_item_id: it.id, quantity: qty })
      }
    }
    return out
  }, [items, rows])

  const reasonValid = reason.trim().length >= 5
  const canSubmit = selectedPayload.length > 0 && reasonValid && computedTotal > 0

  const mutation = useMutation({
    mutationFn: () => refundSale(sale.id, reason.trim(), selectedPayload),
    onSuccess: (refund) => {
      qc.invalidateQueries({ queryKey: ['sales-history'] })
      qc.invalidateQueries({ queryKey: ['today-summary', sale.store_id] })
      qc.invalidateQueries({ queryKey: ['sale-detail', sale.id] })
      setResult({
        saleNumber: refund.sale_number,
        totalSrd: refund.total_srd,
      })
    },
    onError: (e) => {
      setError(getErrorMessage(e))
    },
  })

  function updateRow(itemId: string, patch: Partial<{ selected: boolean; quantity: string }>) {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { selected: false, quantity: '0' }), ...patch },
    }))
  }

  function handleQtyChange(itemId: string, origQty: string, raw: string) {
    // Allow empty + numeric; cap at original quantity. Backend computes a ratio
    // so refund qty must be > 0 and <= original qty.
    const sanitized = raw.replace(/[^0-9.]/g, '')
    const parsed = parseFloat(sanitized)
    const maxQty = parseFloat(origQty)
    let next = sanitized
    if (Number.isFinite(parsed) && Number.isFinite(maxQty) && parsed > maxQty) {
      next = String(maxQty)
    }
    updateRow(itemId, { quantity: next })
  }

  function handleSubmit() {
    setError('')
    if (!canSubmit) return
    mutation.mutate()
  }

  function handleClose() {
    if (mutation.isPending) return
    // Reset local state so re-opening starts fresh
    setRows({})
    setReason('')
    setError('')
    setResult(null)
    onClose()
  }

  const isProcessing = mutation.isPending
  const originalTotal = parseFloat(sale.total_srd) || 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? undefined : handleClose}
      title={result ? t('pos.refund.success') : t('pos.refund.title')}
      width={520}
      persistent={isProcessing}
    >
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
            padding: '20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {t('pos.refund.successDetail', {
                number: result.saleNumber,
                amount: formatCurrency(result.totalSrd),
              })}
            </div>
          </div>
          {/* TODO: print refund receipt — reuse ReceiptModal flow when added */}
          <button
            onClick={handleClose}
            style={{
              height: 'var(--touch-target-xl)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 'var(--font-size-base)',
              fontWeight: 700,
            }}
          >
            {t('pos.refund.close')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sale header */}
          <div style={{
            background: 'var(--bg-elevated)', borderRadius: 'var(--border-radius)',
            padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12,
          }}>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>{t('pos.refund.originalReceipt')}</div>
              <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                #{sale.sale_number}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>{t('pos.refund.occurredAt')}</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {new Date(sale.occurred_at).toLocaleString(isNl ? 'nl-NL' : 'en-US', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>{t('pos.refund.customer')}</div>
              <div style={{ color: 'var(--text-primary)' }}>
                {sale.customer?.name ?? (isNl ? 'Loopklant' : 'Walk-in')}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)' }}>{t('pos.refund.originalTotal')}</div>
              <div className="currency-srd" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                SRD {formatCurrency(originalTotal)}
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {t('pos.refund.selectItems')}
            </div>
            {loadingSale ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('pos.refund.loadingSale')}
              </div>
            ) : (
              <div style={{
                border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: 28 }}></th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {t('pos.refund.item')}
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: 60 }}>
                        {t('pos.refund.available')}
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: 90 }}>
                        {t('pos.refund.qtyToRefund')}
                      </th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', width: 90 }}>
                        {t('pos.refund.lineTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      if (!it.id) return null
                      const row = rows[it.id] ?? { selected: false, quantity: it.quantity }
                      const origQty = parseFloat(it.quantity) || 0
                      const qty = parseFloat(row.quantity) || 0
                      const ratio = origQty > 0 ? Math.min(qty / origQty, 1) : 0
                      const lineTotal = Math.abs(parseFloat(it.line_total_srd) || 0) * ratio
                      return (
                        <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => updateRow(it.id!, { selected: e.target.checked })}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>
                            {it.product_name_snapshot}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {parseFloat(it.quantity).toString()}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.quantity}
                              onChange={(e) => handleQtyChange(it.id!, it.quantity, e.target.value)}
                              disabled={!row.selected}
                              style={{
                                width: 70, padding: '4px 6px', borderRadius: 6,
                                border: '1px solid var(--border-color)',
                                background: row.selected ? 'var(--bg-input)' : 'var(--bg-elevated)',
                                color: 'var(--text-primary)', textAlign: 'right',
                                fontSize: 12, fontFamily: 'monospace',
                                opacity: row.selected ? 1 : 0.5,
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: row.selected && lineTotal > 0 ? 600 : 400 }}>
                            SRD {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label style={{
              display: 'block', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', marginBottom: 6,
            }}>
              {t('pos.refund.reason')}
            </label>
            <div style={{ marginBottom: 8 }}>
              <QuickReasonChips value={reason} onChange={setReason} />
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('pos.refund.reasonPlaceholder')}
              rows={3}
              maxLength={500}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                borderRadius: 8, border: '1px solid var(--border-color)',
                fontSize: 13, resize: 'none',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', background: 'var(--bg-elevated)',
            borderRadius: 'var(--border-radius)',
            borderTop: '2px solid var(--color-primary)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('pos.refund.totalRefund')}
            </span>
            <span className="currency-srd" style={{ fontSize: 20, fontWeight: 800, color: '#dc2626' }}>
              -SRD {formatCurrency(computedTotal)}
            </span>
          </div>

          {(error || mutation.isError) && (
            <div style={{ color: '#dc2626', fontSize: 12, textAlign: 'center' }}>
              {error || getErrorMessage(mutation.error)}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              style={{
                flex: 1, height: 'var(--touch-target-xl)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--text-primary)',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >
              {t('pos.refund.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isProcessing}
              style={{
                flex: 2, height: 'var(--touch-target-xl)',
                background: '#dc2626', border: 'none',
                borderRadius: 'var(--border-radius)',
                color: '#fff',
                cursor: (!canSubmit || isProcessing) ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700,
                opacity: (!canSubmit || isProcessing) ? 0.5 : 1,
              }}
            >
              {isProcessing
                ? t('pos.refund.processing')
                : t('pos.refund.confirm', { amount: formatCurrency(computedTotal) })}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
