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

import { cashDrawerPulse, cashDrawerPulseInJob, DRAWER_ON_MS_DEFAULT } from './escpos'

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
  /**
   * Solenoid on-time in ms. Default 200 — the Epson 50 ms default is for a
   * 12 V drawer and a 24 V one often will not throw its latch in that time,
   * failing with no error anywhere. Set by the drawer sweep in Settings.
   */
  drawerOnMs?: number
  /** Wrap the pulse in a minimal print job — for firmware that discards a
   *  job containing no printable data. Costs one blank line. */
  drawerInJob?: boolean
  /** Paper roll width: 80 mm (42 chars, countertop) or 58 mm (32 chars, compact). */
  paperWidth?: 58 | 80
  /** Android USB printing: which physical device. Vendor+product survive a
   *  replug; Android's own deviceId does not, and a till must keep its
   *  printer across a cable wiggle. */
  usbVendorId?: number
  usbProductId?: number
}

/**
 * Should a saved printer type be forced back to 'network' on this platform?
 *
 * ONLY a browser tab, which has no way to reach a USB printer at all. Both
 * native shells can: Windows through the print spooler, Android through the
 * USB Host API. This used to read `platform !== 'electron'`, which quietly
 * undid an Android till's USB pairing every time Settings was opened — the
 * cashier paired a printer, walked away, came back and found it set to
 * "network" again. Kept here as a named rule with tests precisely because a
 * self-healing default that overwrites a valid configuration destroys the
 * operator's work while looking like helpfulness.
 */
export function needsPrinterTypeHeal(platform: Platform, type: PrinterConfig['type']): boolean {
  return platform === 'web' && type === 'usb'
}

export interface PrinterInfo {
  name: string
  description: string
  isDefault: boolean
}

// ── Print raw ESC/POS bytes ─────────────────────────────────────────────────

/**
 * Bytes → base64, for handing a print job to the native layer.
 *
 * `Array.from(bytes)` sent every single byte across the Capacitor bridge as
 * its own JSON number: a 3 KB receipt became ~3,000 array entries to
 * serialise in JavaScript, marshal through the WebView, and read back one at
 * a time in Java. On a till terminal that is seconds of work before the
 * printer is even addressed — and it happens on the Settings test print too,
 * which touches no network, which is how the delay was finally spotted.
 * Base64 is ~1.3 KB of string and one decode call on the other side.
 */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  const CHUNK = 0x8000 // apply() has an argument-count ceiling
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

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
      // Plain number[] — NOT Buffer. The renderer is sandboxed
      // (contextIsolation + nodeIntegration:false), so `Buffer` is undefined
      // there and this line used to throw before any printing was attempted.
      // The main process turns it back into a Buffer. Same shape the network
      // branch above has always used.
      return api.printReceipt(config.printerName ?? '', Array.from(bytes))
    }
    return { success: false, error: 'No printer configured' }
  }

  // ── Android (Capacitor) ───────────────────────────────────────────────────
  if (platform === 'android') {
    if (config.type === 'usb') {
      // Direct USB via the Android USB Host API — no spooler, no LAN card,
      // no bridge PC. The printer must have been picked (and permission
      // granted) once in Settings → Hardware.
      if (!config.usbVendorId || !config.usbProductId) {
        return { success: false, error: 'No USB printer selected — Settings → Hardware → Connect USB printer' }
      }
      try {
        const { UsbPrinter } = await import('./usbPrinter')
        await UsbPrinter.print({
          vendorId: config.usbVendorId,
          productId: config.usbProductId,
          dataB64: bytesToBase64(bytes),
        })
        return { success: true }
      } catch (err: any) {
        return { success: false, error: String(err?.message ?? err) }
      }
    }
    try {
      const { CapacitorPrinter } = await import('./capacitor-printer')
      return CapacitorPrinter.printEscPos({ data: Array.from(bytes), config })
    } catch {
      return { success: false, error: 'Capacitor printer plugin not available' }
    }
  }

  return { success: false, error: 'Hardware printing not available in browser' }
}

// ── Print an HTML sheet (labels, test pages) ────────────────────────────────

/** Delay before print() on the hidden iframe — lets the freshly written
 *  document finish decoding its inline images first. */
const IFRAME_PRINT_DELAY_MS = 400

let printFrame: HTMLIFrameElement | null = null

function getPrintFrame(): HTMLIFrameElement {
  if (printFrame && document.body.contains(printFrame)) return printFrame
  const frame = document.createElement('iframe')
  frame.style.display = 'none'
  frame.title = 'josbin-print'
  frame.setAttribute('data-josbin-print-frame', '')
  document.body.appendChild(frame)
  printFrame = frame
  return frame
}

/**
 * Print a self-contained HTML document.
 *
 *   electron/web → hidden iframe + window.print(): OS print dialog, any
 *                  installed printer (incl. label printers via their driver)
 *   android      → native PrintManager via the Capacitor bridge, because
 *                  window.print() is a silent no-op inside the WebView
 */
export async function printHtmlSheet(
  name: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  if (detectPlatform() === 'android') {
    try {
      const { CapacitorPrinter } = await import('./capacitor-printer')
      return CapacitorPrinter.printHtml(name, html)
    } catch {
      return { success: false, error: 'Capacitor printer plugin not available' }
    }
  }

  const frame = getPrintFrame()
  const doc = frame.contentDocument ?? frame.contentWindow?.document
  if (!doc) return { success: false, error: 'Print frame unavailable' }

  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => frame.contentWindow?.print(), IFRAME_PRINT_DELAY_MS)
  return { success: true }
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

  const pin = config.drawerPin ?? 1
  const onMs = config.drawerOnMs ?? DRAWER_ON_MS_DEFAULT
  const bytes = config.drawerInJob
    ? cashDrawerPulseInJob(pin, onMs)
    : cashDrawerPulse(pin, onMs)
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
