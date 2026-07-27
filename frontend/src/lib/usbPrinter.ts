/**
 * Android USB printer bridge (native plugin: UsbPrinterPlugin.java).
 *
 * Registered in MainActivity, so registerPlugin() only resolves inside the
 * compiled APK — calls reject anywhere else, which the callers treat as
 * "not available on this platform".
 */
import { registerPlugin } from '@capacitor/core'

export interface UsbInterfaceInfo {
  class: number
  className: string
  subclass: number
  protocol: number
  endpoints: number
}

export interface UsbDeviceInfo {
  name: string
  manufacturer: string | null
  vendorId: number
  productId: number
  /** false when the device has no bulk OUT endpoint — it can never print. */
  printable: boolean
  hasPermission: boolean
  deviceClass: number
  deviceClassName: string
  interfaceCount: number
  interfaces: UsbInterfaceInfo[]
  /** Present only when printable is false: why this device can't take print data. */
  reason?: string
}

export interface UsbProbe {
  devices: UsbDeviceInfo[]
  count: number
  /**
   * False when the terminal has no USB host support at all. Without this an
   * empty list is ambiguous — nothing plugged in, or a terminal that can
   * never drive a printer, look identical and need opposite advice.
   */
  hostSupport: boolean
  /** Set when the plugin itself is unreachable (browser, Windows build, older APK). */
  unavailable?: boolean
}

interface UsbPrinterPlugin {
  listDevices(): Promise<UsbProbe>
  requestPermission(options: { vendorId: number; productId: number }): Promise<{ granted: boolean }>
  print(options: { vendorId: number; productId: number; data: number[] }): Promise<{ success: boolean; bytes: number }>
}

export const UsbPrinter = registerPlugin<UsbPrinterPlugin>('UsbPrinter')

/** Safe wrapper for the UI: never throws, and says so when it can't look. */
export async function probeUsbPrinters(): Promise<UsbProbe> {
  try {
    const res = await UsbPrinter.listDevices()
    return {
      devices: res.devices ?? [],
      count: res.count ?? res.devices?.length ?? 0,
      hostSupport: res.hostSupport ?? false,
    }
  } catch {
    return { devices: [], count: 0, hostSupport: false, unavailable: true }
  }
}
