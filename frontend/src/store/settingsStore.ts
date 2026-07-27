import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PrinterConfig } from '@/lib/hardware'
import { DEFAULT_EMBEDDED_BARCODE, type EmbeddedBarcodeConfig } from '@/lib/embeddedBarcode'

export type ProductDisplay = 'name' | 'photo' | 'both'

interface SettingsState {
  storeId: string | null
  productDisplay: ProductDisplay
  dateFormat: string
  onScreenKeyboard: boolean
  defaultBtwRate: string
  printer: PrinterConfig
  /** Windows only: expose the USB printer on TCP 9100 so Android tills can
   *  print through this PC (the software LAN card). */
  printerShareEnabled: boolean
  /** Fire the print path automatically when the receipt modal opens after a
   *  sale (industry-standard POS behaviour). Thermal prints silently; the
   *  browser fallback opens the print dialog. */
  autoPrintReceipt: boolean
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
  setOnScreenKeyboard: (enabled: boolean) => void
  setDefaultBtwRate: (rate: string) => void
  setPrinter: (config: PrinterConfig) => void
  setPrinterShareEnabled: (v: boolean) => void
  setAutoPrintReceipt: (enabled: boolean) => void
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
      onScreenKeyboard: false,
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
      autoPrintReceipt: false,
      embeddedBarcode: DEFAULT_EMBEDDED_BARCODE,
      cardTerminal: { mode: 'manual', defaultBank: 'DSB' },

      setStoreId: (storeId) => set({ storeId: storeId ?? null }),
      setProductDisplay: (productDisplay) => set({ productDisplay }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setOnScreenKeyboard: (onScreenKeyboard) => set({ onScreenKeyboard }),
      setDefaultBtwRate: (defaultBtwRate) => set({ defaultBtwRate }),
      setPrinter: (printer) => set({ printer }),
      setPrinterShareEnabled: (printerShareEnabled) => set({ printerShareEnabled }),
      setAutoPrintReceipt: (autoPrintReceipt) => set({ autoPrintReceipt }),
      setEmbeddedBarcode: (config) => set((s) => ({ embeddedBarcode: { ...s.embeddedBarcode, ...config } })),
      setCardTerminal: (config) => set((s) => ({ cardTerminal: { ...s.cardTerminal, ...config } })),
    }),
    { name: 'josbin_pos-settings' }
  )
)
