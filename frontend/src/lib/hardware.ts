/**
 * Hardware abstraction layer — platform-agnostic interface for:
 *   - ESC/POS receipt printing
 *   - Cash drawer kick
 *   - Printer discovery
 *   - Hardware fingerprint (for license)
 *
 * Platform routing:
 *   electron   → window.josbin_pos IPC (Electron main process)
 *   android    → Capacitor plugins
 *   web        → No native hardware access (graceful fallback)
 */

import { cashDrawerPulse } from './escpos'

// ── Platform detection ──────────────────────────────────────────────────────

export type Platform = 'electron' | 'android' | 'web'

export function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && (window as any).josbin_pos) return 'electron'
  // Capacitor sets window.Capacitor when running in a native wrapper
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) return 'android'
  return 'web'
}

// ── Printer config (persisted in settings store) ────────────────────────────

export interface PrinterConfig {
  /** 'network' = TCP/IP (recommended for countertop printers with Ethernet/WiFi)
   *  'usb'     = USB direct (Windows only via Electron; Android via Capacitor plugin)
   *  'none'    = disable hardware printing (use PDF fallback) */
  type: 'network' | 'usb' | 'none'
  /** For 'network': printer IP address (e.g. '192.168.1.100') */
  ip?: string
  /** For 'network': port — default 9100 (ESC/POS raw) */
  port?: number
  /** For 'usb' on Windows: Windows printer name as shown in Devices & Printers */
  printerName?: string
  /** Which cash drawer pin to trigger (1 = pin 2, 2 = pin 5). Most printers use 1. */
  drawerPin?: 1 | 2
}

export interface PrinterInfo {
  name: string
  description: string
  isDefault: boolean
}

// ── Print raw ESC/POS bytes ─────────────────────────────────────────────────

export async function printEscPos(
  bytes: Uint8Array,
  config: PrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  const platform = detectPlatform()

  if (config.type === 'none') {
    return { success: false, error: 'Printer disabled — use PDF' }
  }

  // ── Electron (Windows) ─────────────────────────────────────────────────────
  if (platform === 'electron') {
    const api = (window as any).josbin_pos
    if (config.type === 'network' && config.ip) {
      return api.printNetwork({ ip: config.ip, port: config.port ?? 9100, data: Array.from(bytes) })
    }
    if (config.type === 'usb') {
      return api.printReceipt(config.printerName ?? '', Buffer.from(bytes))
    }
    return { success: false, error: 'No printer configured' }
  }

  // ── Android (Capacitor) ───────────────────────────────────────────────────
  if (platform === 'android') {
    try {
      const { CapacitorPrinter } = await import('./capacitor-printer')
      return CapacitorPrinter.printEscPos({ data: Array.from(bytes), config })
    } catch {
      return { success: false, error: 'Capacitor printer plugin not available' }
    }
  }

  return { success: false, error: 'Hardware printing not available in browser' }
}

// ── Cash drawer ─────────────────────────────────────────────────────────────

/**
 * Send cash drawer kick command.
 * The pulse is sent through the receipt printer (RJ11 connector on printer).
 */
export async function openCashDrawer(
  config: PrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  if (config.type === 'none') return { success: false, error: 'No printer configured' }

  const bytes = cashDrawerPulse(config.drawerPin ?? 1)
  return printEscPos(bytes, config)
}

// ── List printers ─────────────────────────────────────────────────────────

export async function listPrinters(): Promise<PrinterInfo[]> {
  const platform = detectPlatform()
  if (platform === 'electron') {
    try {
      const printers = await (window as any).josbin_pos.listPrinters()
      return printers.map((p: any) => ({
        name: p.name,
        description: p.description ?? '',
        isDefault: p.isDefault ?? false,
      }))
    } catch {
      return []
    }
  }
  return []
}

// ── Hardware fingerprint ──────────────────────────────────────────────────

export async function getHardwareFingerprint(): Promise<{
  mac: string; cpuId: string; uuid: string
} | null> {
  const platform = detectPlatform()

  if (platform === 'electron') {
    try {
      return await (window as any).josbin_pos.getHardwareFingerprint()
    } catch {
      return null
    }
  }

  if (platform === 'android') {
    try {
      // @ts-ignore — @capacitor/device may not be installed yet
      const { Device } = await import('@capacitor/device')
      const info = await Device.getId()
      return { mac: 'android', cpuId: 'android', uuid: info.identifier }
    } catch {
      return null
    }
  }

  return null
}
