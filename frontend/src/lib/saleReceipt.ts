/**
 * One place that turns a saved Sale into printable/sendable receipt payloads.
 *
 * Two screens need this now — the popup at the end of a sale (ReceiptModal)
 * and Transactions, where a cashier reprints a receipt an hour later. They
 * used to build the ESC/POS options inline, and the popup's copy was the only
 * one that had ever been corrected: the cashier's *name* instead of the raw
 * UUID, an AST day-first date instead of the ISO timestamp. A second inline
 * copy would have quietly shipped both bugs again.
 */

import { buildReceiptBytes, type EscPosReceiptOptions, type PaperWidth } from '@/lib/escpos'
import { buildReceiptText, type TextReceiptInput } from '@/lib/receiptText'
import { formatDateTime } from '@/utils/date'
import type { Sale, Store } from '@/types/models'

export type ReceiptLocale = 'nl' | 'en' | 'srn'

/** i18next gives us 'nl' | 'en' | 'srn' (and regional variants). The printed
 *  receipt has no Sranantongo layout, so srn falls back to Dutch on paper —
 *  it stays srn for the WhatsApp text, which does have the translations. */
export function printLocale(lang: string): 'nl' | 'en' {
  return lang.startsWith('en') ? 'en' : 'nl'
}

export function textLocale(lang: string): ReceiptLocale {
  if (lang.startsWith('en')) return 'en'
  if (lang.startsWith('srn')) return 'srn'
  return 'nl'
}

interface BuildArgs {
  sale: Sale
  store: Pick<Store, 'name' | 'receipt_header' | 'receipt_footer'> & {
    settings?: Store['settings']
    organisation?: Store['organisation']
  }
  lang: string
  dateFormat: string
  paperWidth?: PaperWidth
  /** Cash tendered / change are known only at the till, never from the saved
   *  sale — a reprint simply omits them rather than printing zeros. */
  cashTendered?: number
  change?: number
  openDrawer?: 1 | 2
  /** Josbin mark stamped at the foot of the ticket. Defaults to on. */
  stamp?: boolean
}

/** ESC/POS options for the thermal printer. */
export function saleToEscPosOptions({
  sale, store, lang, dateFormat, paperWidth, cashTendered, change, openDrawer, stamp,
}: BuildArgs): EscPosReceiptOptions {
  const locale = printLocale(lang)
  return {
    sale: {
      sale_number:       sale.sale_number,
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
      cash_tendered:     cashTendered && cashTendered > 0 ? cashTendered.toFixed(2) : undefined,
      change:            change && change > 0 ? change.toFixed(2) : undefined,
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
    paperWidth: paperWidth ?? 80,
    ...(openDrawer ? { openDrawer } : {}),
    ...(stamp === undefined ? {} : { stamp }),
  }
}

/** Ready-to-print bytes. */
export function saleToEscPosBytes(args: BuildArgs): Uint8Array {
  return buildReceiptBytes(saleToEscPosOptions(args))
}

/** Plain-text receipt for WhatsApp. */
export function saleToReceiptText(
  sale: Sale,
  storeName: string,
  lang: string,
  change?: number,
): string {
  const input: TextReceiptInput = {
    storeName,
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
    change:          change && change > 0 ? change.toFixed(2) : undefined,
    locale:          textLocale(lang),
  }
  return buildReceiptText(input)
}
