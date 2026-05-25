import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import * as net from 'net'
import * as os from 'os'
import * as crypto from 'crypto'
import * as fs from 'fs'

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    fullscreen: !isDev,
    frame: !isDev,
    backgroundColor: '#1a1a2e',
    icon: join(__dirname, '../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      webSecurity: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    const allowed = ['http://localhost:5173', 'http://localhost:8080']
    if (!allowed.includes(parsedUrl.origin)) event.preventDefault()
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Helper: send raw bytes to a TCP printer (port 9100) ─────────────────────

function tcpPrint(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timeout = 5000

    socket.setTimeout(timeout)

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy()
          reject(err)
        } else {
          // Wait a tick for the printer to receive data before closing
          setTimeout(() => { socket.end(); resolve() }, 200)
        }
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`TCP timeout connecting to ${ip}:${port}`))
    })

    socket.on('error', (err) => {
      socket.destroy()
      reject(err)
    })
  })
}

// ─── Helper: send raw bytes to a Windows USB/parallel printer ─────────────────
// Uses the Windows spooler via a temp RAW file passed to `print` command.
// This works for any ESC/POS-compatible printer installed in Windows.

function usbPrint(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('USB printing via spooler is Windows-only'))
    }

    const tmpPath = join(app.getPath('temp'), `josbin_pos_print_${Date.now()}.bin`)

    try {
      fs.writeFileSync(tmpPath, data)
    } catch (err) {
      return reject(new Error(`Failed to write temp print file: ${err}`))
    }

    const { exec } = require('child_process')
    // /D:<printer> sends the file directly as RAW job (bypasses GDI rendering)
    const cmd = `print /D:"${printerName}" "${tmpPath}"`

    exec(cmd, (error: Error | null) => {
      fs.unlink(tmpPath, () => {}) // cleanup regardless
      if (error) {
        reject(new Error(`Windows print command failed: ${error.message}`))
      } else {
        resolve()
      }
    })
  })
}

// ─── IPC: Network TCP printing ────────────────────────────────────────────────

ipcMain.handle('print:network', async (_event, data: {
  ip: string; port: number; data: number[]
}) => {
  try {
    await tcpPrint(data.ip, data.port, Buffer.from(data.data))
    return { success: true }
  } catch (err) {
    console.error('[IPC] print:network error', err)
    return { success: false, error: String(err) }
  }
})

// ─── IPC: USB/spooler printing (Windows) ─────────────────────────────────────

ipcMain.handle('print:receipt', async (_event, data: {
  printerName: string; content: number[]
}) => {
  try {
    await usbPrint(data.printerName, Buffer.from(data.content))
    return { success: true }
  } catch (err) {
    console.error('[IPC] print:receipt error', err)
    return { success: false, error: String(err) }
  }
})

// ─── IPC: Cash drawer kick ────────────────────────────────────────────────────
// Same ESC/POS bytes as printing — route through whichever print channel is configured.

ipcMain.handle('print:cashDrawer', async (_event, data: {
  type: 'network' | 'usb'
  ip?: string
  port?: number
  printerName?: string
  data: number[]
}) => {
  try {
    if (data.type === 'network' && data.ip) {
      await tcpPrint(data.ip, data.port ?? 9100, Buffer.from(data.data))
    } else if (data.type === 'usb' && data.printerName) {
      await usbPrint(data.printerName, Buffer.from(data.data))
    } else {
      return { success: false, error: 'No printer config provided for cash drawer' }
    }
    return { success: true }
  } catch (err) {
    console.error('[IPC] print:cashDrawer error', err)
    return { success: false, error: String(err) }
  }
})

// ─── IPC: List printers ────────────────────────────────────────────────────────

ipcMain.handle('printers:list', async () => {
  if (!mainWindow) return []
  try {
    return await mainWindow.webContents.getPrintersAsync()
  } catch {
    return []
  }
})

// ─── IPC: Hardware fingerprint (license binding) ──────────────────────────────

ipcMain.handle('license:fingerprint', async () => {
  try {
    // MAC address — use first non-internal interface
    const ifaces = os.networkInterfaces()
    let mac = 'unknown'
    outer: for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name] ?? []) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac
          break outer
        }
      }
    }

    // CPU model as a stable hardware identifier
    const cpuId = crypto
      .createHash('sha256')
      .update(os.cpus()[0]?.model ?? 'unknown')
      .update(os.hostname())
      .digest('hex')
      .substring(0, 16)

    // Installation UUID — persisted in userData so it survives reboots
    const uuidPath = join(app.getPath('userData'), 'install.uuid')
    let uuid: string
    if (fs.existsSync(uuidPath)) {
      uuid = fs.readFileSync(uuidPath, 'utf8').trim()
    } else {
      uuid = crypto.randomUUID()
      fs.writeFileSync(uuidPath, uuid, 'utf8')
    }

    return { mac, cpuId, uuid }
  } catch (err) {
    console.error('[IPC] fingerprint error', err)
    return { mac: 'error', cpuId: 'error', uuid: 'error' }
  }
})

// ─── IPC: Save file dialog ─────────────────────────────────────────────────────

ipcMain.handle('dialog:saveFile', async (_event, options: Electron.SaveDialogOptions) => {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result.canceled ? null : result.filePath
})

// ─── IPC: App version ──────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion())

// ─── IPC: App quit + restart ───────────────────────────────────────────────────
// Triggered from Settings → System on the POS UI. Renderer guards with role +
// safety checks (cart empty, no pending sync) before calling these. The main
// process just executes the action.

ipcMain.handle('app:quit', () => {
  app.quit()
})

ipcMain.handle('app:restart', () => {
  app.relaunch()
  app.exit(0) // exit immediately so relaunch can start a fresh instance
})
