import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication } from '@playwright/test'

/**
 * Launches the built app (run `npm run build` first — the e2e npm script does).
 *
 * ELECTRON_RUN_AS_NODE must not leak into the child process: IDE extension
 * hosts (VS Code) set it, and it turns the Electron binary into plain Node.
 */
export async function launchApp(
  envOverrides: Record<string, string> = {}
): Promise<ElectronApplication> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== 'ELECTRON_RUN_AS_NODE') env[key] = value
  }
  return electron.launch({
    args: ['.'],
    env: {
      ...env,
      // Keep e2e runs from spamming the OS notification center / system tray.
      AGENTDECK_DISABLE_NOTIFICATIONS: '1',
      AGENTDECK_DISABLE_TRAY: '1',
      // Isolate from the developer's real Codex sessions unless a test opts in.
      AGENTDECK_CODEX_SESSIONS_DIR: '/nonexistent/agentdeck-e2e-codex',
      // Never write fixture sessions into the developer's real task history.
      AGENTDECK_HISTORY_DB: tempHistoryDb(),
      ...envOverrides
    }
  })
}

/** A fresh, empty task-history database path for one launch. */
export function tempHistoryDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'agentdeck-e2e-history-')), 'history.sqlite')
}
