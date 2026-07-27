/**
 * Android USB printer bridge (native plugin: UsbPrinterPlugin.java).
 *
 * Registered in MainActivity, so registerPlugin() only resolves inside the
 * compiled APK — calls reject anywhere else, which the callers treat as
 * "not available on this platform".
 */
import { registerPlugin } from '@capacitor/core'

export interface UsbDeviceInfo {
  name: string
  manufacturer: string | null
  vendorId: number
  productId: number
  /** false when the device has no bulk OUT endpoint — it can never print. */
  printable: boolean
  hasPermission: boolean
}

interface UsbPrinterPlugin {
  listDevices(): Promise<{ devices: UsbDeviceInfo[] }>
  requestPermission(options: { vendorId: number; productId: number }): Promise<{ granted: boolean }>
  print(options: { vendorId: number; productId: number; data: number[] }): Promise<{ success: boolean; bytes: number }>
}

export const UsbPrinter = registerPlugin<UsbPrinterPlugin>('UsbPrinter')

/** Safe wrapper for the UI: returns [] anywhere the plugin isn't present. */
export async function listUsbPrinters(): Promise<UsbDeviceInfo[]> {
  try {
    const res = await UsbPrinter.listDevices()
    return res.devices ?? []
  } catch {
    return []
  }
}
