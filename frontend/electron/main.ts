import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { join } from 'path'
import * as net from 'net'
import * as os from 'os'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as http from 'http'
import {
  CANDIDATE_PORTS, apiBaseFor, buildProbeTargets, isJosbinHealthPayload,
  rankDiscoveries, subnetsFromInterfaces,
  type DiscoveredServer, type NetworkInterfaceInfo,
} from '../src/lib/lan'

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

/**
 * Send RAW bytes to a Windows printer by name.
 *
 * NOT the `print /D:` command — that is a legacy TEXT-file utility; it does
 * not send raw data, so ESC/POS control bytes never arrive intact and most
 * receipt printers either eject a blank page or ignore the job entirely.
 *
 * The supported route is the spooler API with datatype "RAW"
 * (OpenPrinter → StartDocPrinter → WritePrinter), reached through a
 * PowerShell P/Invoke so no native module is needed. The script is passed
 * as -EncodedCommand: no temp .ps1 (so ExecutionPolicy cannot block it)
 * and no quoting problems with printer names containing spaces.
 */
function usbPrint(printerName: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      return reject(new Error('USB printing via the Windows spooler is Windows-only'))
    }
    if (!printerName) {
      return reject(new Error('No Windows printer selected (Settings → Hardware)'))
    }

    const tmpPath = join(app.getPath('temp'), `josbin_pos_print_${Date.now()}.bin`)
    try {
      fs.writeFileSync(tmpPath, data)
    } catch (err) {
      return reject(new Error(`Failed to write temp print file: ${err}`))
    }

    const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class JosbinRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr h; int written = 0;
    if (!OpenPrinter(printerName, out h, IntPtr.Zero))
      throw new Exception("OpenPrinter failed for '" + printerName + "' (error " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFOW di = new DOCINFOW();
      di.pDocName = "Josbin POS";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di))
        throw new Exception("StartDocPrinter failed (error " + Marshal.GetLastWin32Error() + ")");
      try {
        if (!StartPagePrinter(h))
          throw new Exception("StartPagePrinter failed (error " + Marshal.GetLastWin32Error() + ")");
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, p, bytes.Length);
          if (!WritePrinter(h, p, bytes.Length, out written))
            throw new Exception("WritePrinter failed (error " + Marshal.GetLastWin32Error() + ")");
        } finally { Marshal.FreeCoTaskMem(p); }
        EndPagePrinter(h);
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
    if (written == 0) throw new Exception("Printer accepted 0 bytes");
  }
}
"@
[JosbinRawPrinter]::Send(${JSON.stringify(printerName)}, [System.IO.File]::ReadAllBytes(${JSON.stringify(tmpPath)}))
`

    const { execFile } = require('child_process')
    const encoded = Buffer.from(ps, 'utf16le').toString('base64')

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { windowsHide: true, timeout: 20000 },
      (error: Error | null, _stdout: string, stderr: string) => {
        fs.unlink(tmpPath, () => {})
        if (error) {
          // Surface the real spooler message — "check connection" tells a
          // field engineer nothing; "OpenPrinter failed (error 1801)" does.
          const detail = (stderr || '').trim().split('\n')[0] || error.message
          reject(new Error(`Windows raw print failed: ${detail}`))
        } else {
          resolve()
        }
      },
    )
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


// ─── Printer bridge: share this PC's USB printer on TCP 9100 ─────────────────
// A USB receipt printer is the private property of one Windows machine; real
// stores with Android tills need it on the NETWORK. This bridge makes the
// Windows till behave like a printer's own LAN card: listen on 9100, take
// each connection's bytes as one job, forward RAW to the local spooler.
// Jobs are serialized — two tills printing in the same second queue up
// instead of interleaving bytes on the printer.

let shareServer: net.Server | null = null
let sharePrinterName = ''
let shareQueue: Promise<void> = Promise.resolve()

function lanAddresses(): string[] {
  const os = require('os')
  const out: string[] = []
  const ifs = os.networkInterfaces()
  for (const name of Object.keys(ifs)) {
    for (const addr of ifs[name] ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) out.push(addr.address)
    }
  }
  return out
}

function startPrinterShare(printerName: string): Promise<{ success: boolean; ips?: string[]; error?: string }> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ success: false, error: 'Printer sharing runs on the Windows app only' })
    }
    sharePrinterName = printerName
    if (shareServer) {
      // Already listening — just retarget the printer name.
      return resolve({ success: true, ips: lanAddresses() })
    }

    const server = net.createServer((socket) => {
      const chunks: Buffer[] = []
      // A till's print job is one short-lived connection (connect → write →
      // end). Guard with an idle timeout so a wedged client can't hold a job
      // slot open forever.
      socket.setTimeout(5000, () => socket.destroy())
      socket.on('data', (c) => { chunks.push(c) })
      socket.on('error', () => { /* client vanished — drop the partial job */ })
      socket.on('end', () => {
        const job = Buffer.concat(chunks)
        if (job.length === 0) return
        shareQueue = shareQueue
          .then(() => usbPrint(sharePrinterName, job))
          .catch((err) => console.error('[printer-share] job failed:', err))
      })
    })

    server.on('error', (err) => {
      console.error('[printer-share] listener error:', err)
      shareServer = null
      resolve({ success: false, error: String(err) })
    })

    server.listen(9100, '0.0.0.0', () => {
      shareServer = server
      console.log('[printer-share] listening on 9100 →', printerName)
      resolve({ success: true, ips: lanAddresses() })
    })
  })
}

function stopPrinterShare(): void {
  if (shareServer) {
    shareServer.close()
    shareServer = null
    console.log('[printer-share] stopped')
  }
}

ipcMain.handle('printerShare:start', async (_event, data: { printerName: string }) => {
  return startPrinterShare(data.printerName)
})

ipcMain.handle('printerShare:stop', async () => {
  stopPrinterShare()
  return { success: true }
})

ipcMain.handle('printerShare:status', async () => {
  return {
    running: shareServer !== null,
    printerName: sharePrinterName,
    ips: lanAddresses(),
  }
})

app.on('before-quit', () => stopPrinterShare())

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

// ─── LAN discovery: "Find my server" ──────────────────────────────────────────
// A fresh field install often has the wrong baked server address: convention is
// 192.168.0.250, but plenty of shop routers hand out 192.168.1.x or 10.0.0.x.
// Instead of the installer tech hunting for the IP, the till sweeps its own /24
// for a Josbin server. Socket work has to live here — the sandboxed renderer
// has no raw sockets. The pure address maths lives in src/lib/lan.ts (tested).

const DISCOVERY_PROBE_TIMEOUT_MS = 800   // per host — silent hosts eat this fully
const DISCOVERY_BUDGET_MS        = 6000  // total sweep, never let the UI hang
const DISCOVERY_CONCURRENCY      = 64    // Windows chokes on much more than this

/** GET http://ip:port/api/health — resolves to a hit, or null for anything else. */
function probeHealth(ip: string, port: number, timeoutMs: number): Promise<DiscoveredServer | null> {
  return new Promise((resolve) => {
    let settled = false
    const done = (value: DiscoveredServer | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    const req = http.get(
      {
        host: ip,
        port,
        path: '/api/health',
        agent: false, // our own pool below caps concurrency; don't queue on the global agent
        headers: { Accept: 'application/json', Connection: 'close' },
        timeout: timeoutMs,
      },
      (res) => {
        // A hit is HTTP 200 with a Josbin health body. Anything else (a printer's
        // web UI, a router login page, a degraded 503) is not a usable server.
        if (res.statusCode !== 200) {
          res.resume()
          req.destroy()
          return done(null)
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
          if (body.length > 64 * 1024) { req.destroy(); done(null) } // not a health payload
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            if (!isJosbinHealthPayload(parsed)) return done(null)
            done({
              url: apiBaseFor(ip, port),
              ip,
              port,
              appEnv: typeof parsed.app_env === 'string' ? parsed.app_env : null,
              timezone: typeof parsed.timezone === 'string' ? parsed.timezone : null,
            })
          } catch {
            done(null)
          }
        })
        res.on('error', () => done(null))
      },
    )

    req.on('timeout', () => { req.destroy(); done(null) })
    req.on('error', () => done(null))
  })
}

/** Resolve with `fallback` if `promise` hasn't settled in `ms` — a wedged socket must not hang the UI. */
function withHardDeadline<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      () => { clearTimeout(timer); resolve(fallback) },
    )
  })
}

async function discoverServers(): Promise<DiscoveredServer[]> {
  const subnets = subnetsFromInterfaces(
    os.networkInterfaces() as Record<string, NetworkInterfaceInfo[] | undefined>,
  )
  if (subnets.length === 0) return [] // no private IPv4 interface — nothing sane to sweep

  const targets  = buildProbeTargets(subnets, CANDIDATE_PORTS)
  const deadline = Date.now() + DISCOVERY_BUDGET_MS
  const found: DiscoveredServer[] = []
  let cursor = 0

  const worker = async () => {
    for (;;) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) return
      const index = cursor++
      if (index >= targets.length) return
      const target = targets[index]
      const hit = await probeHealth(target.ip, target.port, Math.min(DISCOVERY_PROBE_TIMEOUT_MS, remaining))
      if (hit) found.push(hit)
    }
  }

  const workers = Array.from(
    { length: Math.min(DISCOVERY_CONCURRENCY, targets.length) },
    () => worker(),
  )
  // `found` is filled in place, so whatever the workers managed before the
  // deadline is still returned — the sweep always answers, never hangs.
  await withHardDeadline(Promise.all(workers), DISCOVERY_BUDGET_MS + 750, [] as void[])

  return rankDiscoveries(found, subnets.map((s) => s.base), CANDIDATE_PORTS)
}

ipcMain.handle('network:discoverServers', async () => {
  try {
    return await discoverServers()
  } catch (err) {
    console.error('[IPC] network:discoverServers error', err)
    return []
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

// ─── IPC: Auto-launch on system boot ───────────────────────────────────────────
// Toggleable from Settings → System. Default ON for packaged builds (a POS
// terminal should boot straight into the till), default OFF in dev so testing
// doesn't accidentally register the dev Electron in your OS startup items.

ipcMain.handle('app:get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('app:set-auto-launch', (_event, enabled: boolean) => {
  // On macOS the path is taken from app.getPath('exe') automatically; on
  // Windows electron-builder's NSIS installer puts the right .exe path in
  // the registry hive Electron reads from. No extra config needed here.
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: false,
  })
  return app.getLoginItemSettings().openAtLogin
})

// Apply the production default on first packaged launch: if the user has never
// set a preference, turn auto-launch ON. We persist a "has been set" marker so
// later flips by the manager stick.
if (app.isPackaged) {
  app.whenReady().then(() => {
    const initFlag = join(app.getPath('userData'), 'auto-launch.initialized')
    try {
      if (!fs.existsSync(initFlag)) {
        app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false })
        fs.writeFileSync(initFlag, new Date().toISOString())
      }
    } catch {
      // Non-fatal — manager can flip the toggle manually if this ever fails.
    }
  })
}
