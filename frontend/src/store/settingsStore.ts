import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PrinterConfig } from '@/lib/hardware'
import { DEFAULT_EMBEDDED_BARCODE, type EmbeddedBarcodeConfig } from '@/lib/embeddedBarcode'

export type ProductDisplay = 'name' | 'photo' | 'both'

interface SettingsState {
  storeId: string | null
  productDisplay: ProductDisplay
  dateFormat: string
  defaultBtwRate: string
  printer: PrinterConfig
  /** Windows only: expose the USB printer on TCP 9100 so Android tills can
   *  print through this PC (the software LAN card). */
  printerShareEnabled: boolean
  /** Fire the print path automatically when the receipt modal opens after a
   *  sale (industry-standard POS behaviour). Thermal prints silently; the
   *  browser fallback opens the print dialog. */
  autoPrintReceipt: boolean
  /**
   * Offer the WhatsApp receipt automatically when the customer on the sale
   * has a phone number. Manager-level switch (Settings → Printer).
   *
   * "Automatically" here means the till hands WhatsApp a ready-made message
   * addressed to that customer — the cashier still presses send in WhatsApp.
   * A truly hands-off send is not something a shop till can do: WhatsApp only
   * accepts machine-sent messages through Meta's Business API, which needs a
   * business account, a paid provider, and each message body pre-approved as
   * a template. See user manual §5.7.
   */
  autoWhatsAppReceipt: boolean
  /** Print the Josbin mark at the foot of the thermal receipt, stamp-style. */
  receiptStamp: boolean
  /** Scale-printed weighed-goods barcode layout (off by default). */
  embeddedBarcode: EmbeddedBarcodeConfig
  /**
   * How the card / PIN terminal is wired to this till.
   * - manual:    standalone bank terminal (Suriname default) — cashier keys
   *              the amount into the bank's device and copies the slip.
   * - simulated: training/demo — the POS "sends" the amount and a virtual
   *              terminal approves after ~2s, auto-filling reconciliation.
   * A real ECR link (POS→terminal over LAN/serial) needs the acquiring
   * bank's terminal protocol — adapter slot exists, no SR bank exposes one
   * publicly yet. See user manual §5.3.
   */
  cardTerminal: CardTerminalConfig

  setStoreId: (storeId: string | null) => void
  setProductDisplay: (display: ProductDisplay) => void
  setDateFormat: (format: string) => void
  setDefaultBtwRate: (rate: string) => void
  setPrinter: (config: PrinterConfig) => void
  setPrinterShareEnabled: (v: boolean) => void
  setAutoPrintReceipt: (enabled: boolean) => void
  setAutoWhatsAppReceipt: (enabled: boolean) => void
  setReceiptStamp: (enabled: boolean) => void
  setEmbeddedBarcode: (config: Partial<EmbeddedBarcodeConfig>) => void
  setCardTerminal: (config: Partial<CardTerminalConfig>) => void
}

export interface CardTerminalConfig {
  mode: 'manual' | 'simulated'
  /** Bank preset the simulated terminal reports on approvals. */
  defaultBank: string
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      storeId: null,
      productDisplay: 'both',
      dateFormat: 'DD-MM-YYYY',
      defaultBtwRate: '10',
      printer: {
        type: 'none',
        ip: '',
        port: 9100,
        printerName: '',
        drawerPin: 1,
        paperWidth: 80,
      },
      printerShareEnabled: false,
      // A shop expects the receipt to come out when the sale is paid, the
      // same way the drawer opens by itself. Making the cashier tap Print on
      // every sale is a queue tax. Still switchable off in Settings for
      // tills that deliberately print on request only.
      autoPrintReceipt: true,
      // On by default: a customer who gave the shop their number expects the
      // bon on their phone, and WhatsApp is how Suriname sends things.
      autoWhatsAppReceipt: true,
      receiptStamp: true,
      embeddedBarcode: DEFAULT_EMBEDDED_BARCODE,
      cardTerminal: { mode: 'manual', defaultBank: 'DSB' },

      setStoreId: (storeId) => set({ storeId: storeId ?? null }),
      setProductDisplay: (productDisplay) => set({ productDisplay }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setDefaultBtwRate: (defaultBtwRate) => set({ defaultBtwRate }),
      setPrinter: (printer) => set({ printer }),
      setPrinterShareEnabled: (printerShareEnabled) => set({ printerShareEnabled }),
      setAutoPrintReceipt: (autoPrintReceipt) => set({ autoPrintReceipt }),
      setAutoWhatsAppReceipt: (autoWhatsAppReceipt) => set({ autoWhatsAppReceipt }),
      setReceiptStamp: (receiptStamp) => set({ receiptStamp }),
      setEmbeddedBarcode: (config) => set((s) => ({ embeddedBarcode: { ...s.embeddedBarcode, ...config } })),
      setCardTerminal: (config) => set((s) => ({ cardTerminal: { ...s.cardTerminal, ...config } })),
    }),
    {
      name: 'josbin_pos-settings',
      // Bumping the version re-applies changed defaults to tills that already
      // have settings saved — otherwise a new default only ever reaches a
      // fresh install, and every till in the field keeps the old behaviour.
      version: 1,
      migrate: (persisted, from) => {
        const s = persisted as Partial<SettingsState>
        // v0 → v1: auto-print became the default. Only tills still carrying
        // the old default are switched; anyone who deliberately turned it on
        // is already there, and a deliberate "off" is indistinguishable from
        // the old default, so this is a one-time nudge, not a lock.
        if (from < 1 && s.autoPrintReceipt === false) s.autoPrintReceipt = true
        return s as SettingsState
      },
    }
  )
)
