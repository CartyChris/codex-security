// OmniForge desktop shell: runs the bundled Next.js server on a local port and shows it
// in a native window, with macOS menus and Keychain-backed storage for the OpenRouter key.
const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, safeStorage, shell, utilityProcess } = require('electron')
const fs = require('node:fs')
const http = require('node:http')
const net = require('node:net')
const path = require('node:path')

const isMac = process.platform === 'darwin'
// A stable port keeps the page origin, and with it saved preferences, the same between launches.
const PREFERRED_PORT = 47831
const APP_NAME = 'OmniForge'

let server = null
let origin = null
let mainWindow = null
let quitting = false

app.setName(APP_NAME)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

function serverDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, 'server')
}

function logFile() {
  const dir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, 'server.log')
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })
}

function randomPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume()
        if (response.statusCode && response.statusCode < 500) resolve()
        else retry()
      })
      request.on('error', retry)
      request.setTimeout(2000, () => request.destroy())
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('The local OmniForge server did not start in time.'))
      else setTimeout(attempt, 150)
    }
    attempt()
  })
}

async function startServer() {
  const dir = serverDir()
  const entry = path.join(dir, 'server.js')
  if (!fs.existsSync(entry)) throw new Error(`Bundled server not found at ${entry}. Run "npm run prepare-server" first.`)

  const port = (await portAvailable(PREFERRED_PORT)) ? PREFERRED_PORT : await randomPort()
  const log = fs.createWriteStream(logFile(), { flags: 'a' })
  log.write(`\n--- ${new Date().toISOString()} starting on port ${port}\n`)

  server = utilityProcess.fork(entry, [], {
    cwd: dir,
    serviceName: 'OmniForge Server',
    stdio: 'pipe',
    env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  })
  server.stdout?.pipe(log)
  server.stderr?.pipe(log)
  server.on('exit', (code) => {
    server = null
    if (quitting) return
    dialog.showErrorBox(APP_NAME, `The local server stopped unexpectedly (exit code ${code}).\n\nDetails are in ${logFile()}`)
    app.quit()
  })

  const url = `http://127.0.0.1:${port}`
  await waitForServer(url)
  return url
}

// ---------- OpenRouter key storage (encrypted with the macOS Keychain via safeStorage) ----------

function keyPath() {
  return path.join(app.getPath('userData'), 'openrouter-key.bin')
}

ipcMain.handle('key:get', () => {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(keyPath())) return ''
    return safeStorage.decryptString(fs.readFileSync(keyPath()))
  } catch {
    return ''
  }
})

ipcMain.handle('key:set', (_event, value) => {
  const key = typeof value === 'string' ? value.trim() : ''
  if (!key) {
    fs.rmSync(keyPath(), { force: true })
    return true
  }
  // Without OS-level encryption the key is not written to disk; it stays in the session only.
  if (!safeStorage.isEncryptionAvailable()) return false
  fs.writeFileSync(keyPath(), safeStorage.encryptString(key), { mode: 0o600 })
  return true
})

// ---------- Window ----------

function send(command) {
  if (!mainWindow) createWindow()
  mainWindow.show()
  mainWindow.webContents.send('command', command)
}

const splash = (dark) => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:${dark ? '#101014' : '#f4f5f8'};color:${dark ? '#a9a7b3' : '#6c6c75'};font:13px -apple-system,BlinkMacSystemFont,sans-serif;-webkit-app-region:drag"><div style="text-align:center"><div style="width:52px;height:52px;margin:0 auto 14px;border-radius:17px;background:linear-gradient(135deg,#7657e8,#b597ff)"></div>Starting OmniForge…</div></body></html>`)}`

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 900,
    minHeight: 620,
    title: APP_NAME,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#101014' : '#f4f5f8',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 20, y: 24 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })

  // Keep the app on its own origin; everything else opens in the default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (origin && url.startsWith(origin)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  if (origin) mainWindow.loadURL(origin)
  else mainWindow.loadURL(splash(nativeTheme.shouldUseDarkColors))
  return mainWindow
}

function buildMenu() {
  const view = (label, accelerator, target) => ({ label, accelerator, click: () => send(`view:${target}`) })
  const template = [
    ...(isMac ? [{
      label: APP_NAME,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Chat', accelerator: 'CmdOrCtrl+N', click: () => send('new-chat') },
        { label: 'Run Scan', accelerator: 'CmdOrCtrl+Shift+R', click: () => send('run-scan') },
        { type: 'separator' },
        ...(isMac ? [{ role: 'close' }] : [{ label: 'Settings…', accelerator: 'Ctrl+,', click: () => send('settings') }, { role: 'quit' }]),
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        view('Overview', 'CmdOrCtrl+1', 'overview'),
        view('Findings', 'CmdOrCtrl+2', 'findings'),
        view('Scan History', 'CmdOrCtrl+3', 'history'),
        view('AI Analyst', 'CmdOrCtrl+4', 'chat'),
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Get an OpenRouter API Key', click: () => shell.openExternal('https://openrouter.ai/keys') },
        { label: 'Show Server Log', click: () => shell.showItemInFolder(logFile()) },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: app.getVersion(), copyright: 'OmniForge Cyber AI security harness' })
  buildMenu()
  createWindow()
  try {
    origin = await startServer()
    mainWindow?.loadURL(origin)
  } catch (error) {
    dialog.showErrorBox(APP_NAME, error instanceof Error ? error.message : String(error))
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

app.on('before-quit', () => {
  quitting = true
  server?.kill()
})
