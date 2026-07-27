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

  // ── Store-server discovery ("Find my server" on the server-address dialog) ────
  // Sweeps the till's own /24 for a Josbin server so a field install with a
  // wrong baked IP is fixable without anyone hunting for the address.
  discoverServers: () => ipcRenderer.invoke('network:discoverServers'),
  printerShareStart: (printerName: string) => ipcRenderer.invoke('printerShare:start', { printerName }),
  printerShareStop: () => ipcRenderer.invoke('printerShare:stop'),
  printerShareStatus: () => ipcRenderer.invoke('printerShare:status'),

  // ── License ───────────────────────────────────────────────────────────────────
  getHardwareFingerprint: () => ipcRenderer.invoke('license:fingerprint'),

  // ── File system (USB encrypted export) ────────────────────────────────────────
  saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options),

  // ── App info ──────────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:version'),
  platform: process.platform,
  isPackaged: !process.env.ELECTRON_IS_DEV,

  // ── App lifecycle (renderer guards with role + safety checks) ────────────────
  quit:    () => ipcRenderer.invoke('app:quit'),
  restart: () => ipcRenderer.invoke('app:restart'),

  // ── Auto-launch on system boot — toggleable from Settings → System ──────────
  getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('app:set-auto-launch', enabled),
})
