import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { ClaudeCodeAdapter } from './agents/claude-code'
import { registerSessionIpc } from './ipc/register'
import { installSecurityPolicy } from './security'
import { SessionService } from './sessions/service'
import { createMainWindowOptions } from './window'

function createWindow(): void {
  const mainWindow = new BrowserWindow(
    createMainWindowOptions(join(__dirname, '../preload/index.js'))
  )

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // All external links open in the system browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

installSecurityPolicy(app)

// Env override lets e2e tests point the app at a fixture projects tree.
const claudeProjectsRoot = process.env['AGENTDECK_CLAUDE_PROJECTS_DIR']
const sessionService = new SessionService([
  claudeProjectsRoot !== undefined && claudeProjectsRoot !== ''
    ? new ClaudeCodeAdapter(claudeProjectsRoot)
    : new ClaudeCodeAdapter()
])

void app.whenReady().then(() => {
  registerSessionIpc(sessionService)
  void sessionService.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  void sessionService.stop()
})
