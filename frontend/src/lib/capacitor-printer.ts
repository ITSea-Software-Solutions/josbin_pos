/**
 * Capacitor printer bridge — Android only.
 *
 * Two strategies:
 *
 * 1. Receipt printing   → @capgo/capacitor-printer `printHtml()`
 *    Uses Android's native PrintManager (system print dialog or auto-print
 *    on Android terminals that have a built-in printer service).
 *    No USB permission prompts, works on any Android POS terminal.
 *
 * 2. Cash drawer / raw ESC/POS → TCP network (port 9100)
 *    Sends raw bytes over a socket to a network printer.
 *    Required for cash drawer pulse because Android's PrintManager
 *    does not support raw byte printing.
 *
 * Install:
 *   npm install @capgo/capacitor-printer
 *   npx cap sync android
 */

import type { PrinterConfig } from './hardware'

interface PrintResult {
  success: boolean
  error?: string
}

/**
 * Print an ESC/POS receipt on Android.
 *
 * Converts the raw ESC/POS bytes to an HTML receipt and sends it to
 * Android's PrintManager via @capgo/capacitor-printer.
 * Falls back to TCP raw bytes if a network printer IP is configured.
 */
async function printEscPos(opts: {
  data: number[]
  config: PrinterConfig
  htmlReceipt?: string    // Pre-built HTML (preferred — richer formatting)
  receiptText?: string    // Plain text fallback
}): Promise<PrintResult> {

  // ── Strategy 1: HTML via Android PrintManager ─────────────────────────────
  // Preferred — works on any Android device without extra USB config
  if (opts.htmlReceipt || opts.receiptText) {
    try {
      // @ts-ignore — @capgo/capacitor-printer is installed at runtime
      const { Printer } = await import('@capgo/capacitor-printer')
      const html = opts.htmlReceipt ?? buildHtmlFromText(opts.receiptText ?? '')
      await Printer.printHtml({ name: 'Josbin POS Receipt', html })
      return { success: true }
    } catch (err: any) {
      console.warn('[CapacitorPrinter] HTML print failed, trying TCP:', err)
      // Fall through to TCP
    }
  }

  // ── Strategy 2: TCP raw ESC/POS bytes ─────────────────────────────────────
  // Used for cash drawer pulse and as fallback if HTML print fails
  if (opts.config.type === 'network' && opts.config.ip) {
    return tcpPrint(opts.config.ip, opts.config.port ?? 9100, opts.data)
  }

  return { success: false, error: 'No print method available. Configure a network printer IP.' }
}

/**
 * Send raw bytes over TCP to port 9100 (ESC/POS network printing).
 * Used for receipts AND the cash drawer pulse on Android, since Android's
 * PrintManager does not support raw byte jobs.
 *
 * Backed by our own native plugin (android/.../TcpSocketPlugin.java),
 * registered in MainActivity — not an npm package. registerPlugin() returns
 * a proxy that only resolves inside the compiled APK; on any other platform
 * the calls reject and we fall through to the ePOS HTTP fallback below.
 */
interface TcpSocketPlugin {
  connect(options: { host: string; port: number }): Promise<void>
  write(options: { data: number[] }): Promise<void>
  disconnect(): Promise<void>
}

async function tcpPrint(ip: string, port: number, data: number[]): Promise<PrintResult> {
  try {
    const { registerPlugin } = await import('@capacitor/core')
    const TcpSocket = registerPlugin<TcpSocketPlugin>('TcpSocket')
    await TcpSocket.connect({ host: ip, port })
    await TcpSocket.write({ data })
    await TcpSocket.disconnect()
    return { success: true }
  } catch {
    // Fallback: EPSON ePOS HTTP endpoint (requires ePOS-Device service on printer)
    try {
      const hex = Array.from(new Uint8Array(data))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
      const res = await fetch(`http://${ip}/cgi-bin/epos/service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '""',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      <command>${hex}</command>
    </epos-print>
  </s:Body>
</s:Envelope>`,
      })
      return res.ok
        ? { success: true }
        : { success: false, error: `HTTP ${res.status}` }
    } catch (err: any) {
      return { success: false, error: `TCP print failed: ${err?.message ?? err}` }
    }
  }
}

/**
 * Print an arbitrary HTML document (barcode label sheets, test pages)
 * through Android's PrintManager — opens the system print dialog with
 * every printer the device knows about.
 *
 * Screens must route HTML printing through here on Android because
 * window.print() is a silent no-op inside the Capacitor WebView.
 */
async function printHtml(name: string, html: string): Promise<PrintResult> {
  try {
    const { Printer } = await import('@capgo/capacitor-printer')
    await Printer.printHtml({ name, html })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: String(err?.message ?? err) }
  }
}

/** Wrap plain text in a minimal HTML receipt layout for PrintManager. */
function buildHtmlFromText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .join('<br>')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; margin: 0; padding: 4mm; }
</style>
</head>
<body><pre style="font-family:inherit;font-size:inherit;margin:0">${escaped}</pre></body>
</html>`
}

export const CapacitorPrinter = { printEscPos, tcpPrint, printHtml }
