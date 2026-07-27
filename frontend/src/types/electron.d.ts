// Augment Window with the josbin_pos API exposed by the Electron preload script
// Available in renderer via window.josbin_pos.*

interface Window {
  josbin_pos: {
    // Network TCP printing (recommended — Ethernet/WiFi printers, port 9100)
    printNetwork: (opts: { ip: string; port: number; data: number[] }) => Promise<{ success: boolean; error?: string }>
    // USB printing via Windows spooler (requires printer installed in Windows)
    printReceipt: (printerName: string, content: number[]) => Promise<{ success: boolean; error?: string }>
    // Cash drawer kick — sends ESC/POS pulse through printer connection
    openCashDrawer: (opts: {
      type: 'network' | 'usb'
      ip?: string
      port?: number
      printerName?: string
      data: number[]
    }) => Promise<{ success: boolean; error?: string }>
    listPrinters: () => Promise<{ name: string; description: string; isDefault: boolean }[]>
    // LAN sweep for the store server — see src/lib/lan.ts. Always resolves
    // (empty array when nothing is found), never rejects on a wedged socket.
    discoverServers: () => Promise<{
    printerShareStart: (printerName: string) => Promise<{ success: boolean; ips?: string[]; error?: string }>
    printerShareStop: () => Promise<{ success: boolean }>
    printerShareStatus: () => Promise<{ running: boolean; printerName: string; ips: string[] }>
      url: string
      ip: string
      port: number
      appEnv: string | null
      timezone: string | null
    }[]>
    getHardwareFingerprint: () => Promise<{ mac: string; cpuId: string; uuid: string }>
    saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
    getVersion: () => Promise<string>
    platform: string
    isPackaged: boolean
    // App lifecycle — renderer guards with role + safety checks before calling
    quit:    () => Promise<void>
    restart: () => Promise<void>
    // Auto-launch on system boot — toggleable from Settings → System
    getAutoLaunch: () => Promise<boolean>
    setAutoLaunch: (enabled: boolean) => Promise<boolean>
  }
}

/**
 * App version, injected at build time from package.json by both Vite configs.
 * Shown in Settings so a terminal in the field can always be identified.
 */
declare const __APP_VERSION__: string
