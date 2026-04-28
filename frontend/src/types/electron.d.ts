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
    getHardwareFingerprint: () => Promise<{ mac: string; cpuId: string; uuid: string }>
    saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>
    getVersion: () => Promise<string>
    platform: string
    isPackaged: boolean
  }
}
