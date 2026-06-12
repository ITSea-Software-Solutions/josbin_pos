import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PrinterConfig } from '@/lib/hardware'

export type ProductDisplay = 'name' | 'photo' | 'both'

interface SettingsState {
  storeId: string | null
  productDisplay: ProductDisplay
  dateFormat: string
  onScreenKeyboard: boolean
  defaultBtwRate: string
  printer: PrinterConfig
  /** Fire the print path automatically when the receipt modal opens after a
   *  sale (industry-standard POS behaviour). Thermal prints silently; the
   *  browser fallback opens the print dialog. */
  autoPrintReceipt: boolean

  setStoreId: (storeId: string | null) => void
  setProductDisplay: (display: ProductDisplay) => void
  setDateFormat: (format: string) => void
  setOnScreenKeyboard: (enabled: boolean) => void
  setDefaultBtwRate: (rate: string) => void
  setPrinter: (config: PrinterConfig) => void
  setAutoPrintReceipt: (enabled: boolean) => void
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
      },
      autoPrintReceipt: false,

      setStoreId: (storeId) => set({ storeId: storeId ?? null }),
      setProductDisplay: (productDisplay) => set({ productDisplay }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setOnScreenKeyboard: (onScreenKeyboard) => set({ onScreenKeyboard }),
      setDefaultBtwRate: (defaultBtwRate) => set({ defaultBtwRate }),
      setPrinter: (printer) => set({ printer }),
      setAutoPrintReceipt: (autoPrintReceipt) => set({ autoPrintReceipt }),
    }),
    { name: 'josbin_pos-settings' }
  )
)
