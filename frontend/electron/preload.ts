import { contextBridge, ipcRenderer } from 'electron'

// Expose a controlled API to the renderer process via window.josbin_pos
// contextIsolation: true — renderer has NO direct access to Node.js APIs
contextBridge.exposeInMainWorld('josbin_pos', {

  // ── Network TCP printing (recommended — works with any Ethernet/WiFi printer) ──
  printNetwork: (opts: { ip: string; port: number; data: number[] }) =>
    ipcRenderer.invoke('print:network', opts),

  // ── USB/spooler printing (Windows — printer must be installed in Windows) ──────
  printReceipt: (printerName: string, content: number[]) =>
    ipcRenderer.invoke('print:receipt', { printerName, content }),

  // ── Cash drawer kick (routes through printer connection) ─────────────────────
  openCashDrawer: (opts: {
    type: 'network' | 'usb'
    ip?: string
    port?: number
    printerName?: string
    data: number[]
  }) => ipcRenderer.invoke('print:cashDrawer', opts),

  // ── Printer discovery ─────────────────────────────────────────────────────────
  listPrinters: () => ipcRenderer.invoke('printers:list'),

  // ── License ───────────────────────────────────────────────────────────────────
  getHardwareFingerprint: () => ipcRenderer.invoke('license:fingerprint'),

  // ── File system (USB encrypted export) ────────────────────────────────────────
  saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options),

  // ── App info ──────────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:version'),
  platform: process.platform,
  isPackaged: !process.env.ELECTRON_IS_DEV,
})
