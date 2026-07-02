import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { IpcChannels, type RevealPayload } from '../shared/ipc'
import { ClaudeCodeAdapter } from './agents/claude-code'
import { CodexCliAdapter } from './agents/codex-cli'
import { WorkspaceStatsService } from './git/diff-stats'
import { broadcastWorkspaceStats, registerSessionIpc, registerWorkspaceIpc } from './ipc/register'
import { SessionNotifier } from './notifications/notifier'
import { installSecurityPolicy } from './security'
import { SessionService } from './sessions/service'
import { SettingsStore } from './settings/store'
import { AppTray } from './tray/tray'
import { createMainWindowOptions } from './window'

function createWindow(): BrowserWindow {
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
  return mainWindow
}

/** Bring the app forward and open one session's detail (notification/tray deep-link). */
function revealSession(sessionKey: string): void {
  const payload: RevealPayload = { sessionKey }
  const existing = BrowserWindow.getAllWindows()[0]
  const window = existing ?? createWindow()
  if (existing !== undefined) {
    window.webContents.send(IpcChannels.sessionsReveal, payload)
  } else {
    window.webContents.once('did-finish-load', () =>
      window.webContents.send(IpcChannels.sessionsReveal, payload)
    )
  }
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

installSecurityPolicy(app)

// Env overrides let e2e tests point the app at fixture trees.
const claudeProjectsRoot = process.env['AGENTDECK_CLAUDE_PROJECTS_DIR']
const codexSessionsRoot = process.env['AGENTDECK_CODEX_SESSIONS_DIR']
const sessionService = new SessionService([
  claudeProjectsRoot !== undefined && claudeProjectsRoot !== ''
    ? new ClaudeCodeAdapter(claudeProjectsRoot)
    : new ClaudeCodeAdapter(),
  codexSessionsRoot !== undefined && codexSessionsRoot !== ''
    ? new CodexCliAdapter(codexSessionsRoot)
    : new CodexCliAdapter()
])

void app.whenReady().then(() => {
  const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
  const notifier = new SessionNotifier({
    getStates: () => sessionService.getSnapshot(),
    getPrefs: () => settings.get().notifications,
    reveal: revealSession
  })

  registerSessionIpc(sessionService)
  sessionService.onUpdate(() => notifier.tick())

  // Tray creation fails on headless CI and is noise in e2e; opt out via env.
  if (process.env['AGENTDECK_DISABLE_TRAY'] !== '1') {
    const tray = new AppTray({
      reveal: revealSession,
      openApp: () => {
        const window = BrowserWindow.getAllWindows()[0] ?? createWindow()
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      },
      quit: () => app.quit()
    })
    tray.update(sessionService.getSnapshot())

    // Rebuild the menu on updates (debounced against delta storms) and on an
    // interval so time-decayed statuses stay accurate.
    let trayTimer: NodeJS.Timeout | null = null
    sessionService.onUpdate(() => {
      if (trayTimer !== null) return
      trayTimer = setTimeout(() => {
        trayTimer = null
        tray.update(sessionService.getSnapshot())
      }, 1000)
    })
    setInterval(() => tray.update(sessionService.getSnapshot()), 15_000)
  }

  const workspaceStats = new WorkspaceStatsService()
  registerWorkspaceIpc(workspaceStats)
  const refreshWorkspaceStats = async (): Promise<void> => {
    // Most recently active projects first; absolute paths only (a projectKey
    // placeholder means no event with a cwd has arrived yet).
    const paths = [
      ...new Set(
        sessionService
          .getSnapshot()
          .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0))
          .map((state) => state.projectPath)
          .filter((path) => path.startsWith('/'))
      )
    ].slice(0, 25)
    if (await workspaceStats.refresh(paths)) {
      broadcastWorkspaceStats({ stats: workspaceStats.getSnapshot() })
    }
  }
  setInterval(() => void refreshWorkspaceStats(), 10_000)

  void sessionService.start().then(() => {
    notifier.start()
    void refreshWorkspaceStats()
  })
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

export { revealSession }
